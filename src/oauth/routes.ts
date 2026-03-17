/**
 * OAuth 2.1 routes — registered as a Fastify plugin in server.ts.
 *
 * Endpoints implemented:
 *
 *   GET  /.well-known/oauth-protected-resource   RFC 9728  — tells clients which AS to use
 *   GET  /.well-known/oauth-authorization-server RFC 8414  — AS metadata (endpoints, PKCE, etc.)
 *   GET  /oauth/authorize                        Authorization endpoint
 *   GET  /oauth/callback/:provider               Identity-provider callback (e.g. /oauth/callback/google)
 *   POST /oauth/token                            Token endpoint
 *
 * Flow:
 *   1. Claude hits /mcp → gets 401 with WWW-Authenticate pointing to our metadata.
 *   2. Claude fetches /.well-known/* to discover endpoints.
 *   3. Claude opens /oauth/authorize in the user's browser.
 *   4. We redirect the browser to the identity provider (Google).
 *   5. Provider redirects back to /oauth/callback/google.
 *   6. We verify identity, look up (or provision) the user's Wiki.js key,
 *      issue a one-time auth code, and redirect to Claude's redirect_uri.
 *   7. Claude POSTs to /oauth/token, we verify PKCE + client credentials,
 *      and return a signed JWT access token.
 *   8. Claude includes that JWT as Bearer on every /mcp request.
 *      server.ts validates it and resolves it to a Wiki.js API key.
 */
import {
  type FastifyInstance,
  type FastifyRequest,
  type FastifyReply,
  type FastifyPluginAsync,
} from "fastify";
import { randomBytes, createHash } from "crypto";
import { oauthConfig } from "./config.js";
import { GoogleProvider } from "./providers/google.js";
import { EntraProvider } from "./providers/entra.js";
import { type IdentityProvider } from "./providers/base.js";
import {
  storeSession,
  consumeSession,
  storeAuthCode,
  consumeAuthCode,
  getWikiJsKeyForEmail,
} from "./store.js";
import { signAccessToken } from "./jwt.js";
import { provisionWikiJsKey } from "./provision.js";

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

/**
 * Map of provider name → IdentityProvider instance.
 *
 * To add Microsoft Entra ID in the future:
 *   import { EntraProvider } from "./providers/entra.js";
 *   providers.set("entra", new EntraProvider(...));
 * Then add ENTRA_* env vars to config.ts.  No other changes needed.
 */
const providers = new Map<string, IdentityProvider>();

if (oauthConfig.google.clientId) {
  providers.set(
    "google",
    new GoogleProvider(
      oauthConfig.google.clientId,
      oauthConfig.google.clientSecret,
      oauthConfig.google.redirectUri
    )
  );
}

if (oauthConfig.entra.clientId) {
  providers.set(
    "microsoft",
    new EntraProvider(
      oauthConfig.entra.clientId,
      oauthConfig.entra.clientSecret,
      oauthConfig.entra.redirectUri,
      oauthConfig.entra.tenantId
    )
  );
}

// ---------------------------------------------------------------------------
// Shared secret (loaded once)
// ---------------------------------------------------------------------------

const jwtSecretBytes = new TextEncoder().encode(oauthConfig.jwtSecret);

// ---------------------------------------------------------------------------
// Helper — validate client credentials
// ---------------------------------------------------------------------------

function validateClient(clientId: string, clientSecret: string): boolean {
  // Constant-time comparison to prevent timing attacks.
  if (!oauthConfig.clientId || !oauthConfig.clientSecret) return false;
  const idOk = timingSafeEqual(clientId, oauthConfig.clientId);
  const secretOk = timingSafeEqual(clientSecret, oauthConfig.clientSecret);
  return idOk && secretOk;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still run a comparison to keep timing consistent.
    createHash("sha256").update(a).digest();
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Helper — verify PKCE S256
// ---------------------------------------------------------------------------

function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return timingSafeEqual(computed, codeChallenge);
}

// ---------------------------------------------------------------------------
// Fastify plugin
// ---------------------------------------------------------------------------

export const oauthPlugin: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Claude Desktop (and all spec-compliant OAuth clients) POST to /oauth/token
  // with Content-Type: application/x-www-form-urlencoded per RFC 6749 §4.1.3.
  // Fastify only parses application/json by default, so we add a parser here.
  fastify.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_req, body, done) => {
      try {
        const parsed = Object.fromEntries(new URLSearchParams(body as string));
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  // ---- RFC 9728: Protected Resource Metadata ----
  // Tells Claude (and any MCP client) which Authorization Server to use.
  fastify.get("/.well-known/oauth-protected-resource", async (_req, reply) => {
    reply.header("Content-Type", "application/json");
    return {
      resource: oauthConfig.issuer,
      authorization_servers: [oauthConfig.issuer],
    };
  });

  // ---- RFC 8414: Authorization Server Metadata ----
  // Full AS capability advertisement — PKCE requirement, supported grant types, etc.
  fastify.get(
    "/.well-known/oauth-authorization-server",
    async (_req, reply) => {
      reply.header("Content-Type", "application/json");
      const base = oauthConfig.issuer;
      return {
        issuer: base,
        authorization_endpoint: `${base}/oauth/authorize`,
        token_endpoint: `${base}/oauth/token`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: [
          "client_secret_post",
          "client_secret_basic",
        ],
        scopes_supported: ["openid", "email", "profile"],
      };
    }
  );

  // ---- Authorization endpoint ----
  // Claude redirects the user's browser here to start the login flow.
  fastify.get(
    "/oauth/authorize",
    async (
      request: FastifyRequest<{
        Querystring: {
          response_type?: string;
          client_id?: string;
          redirect_uri?: string;
          state?: string;
          code_challenge?: string;
          code_challenge_method?: string;
          // Optional: which identity provider to use (defaults to "google")
          provider?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const q = request.query;

      // Validate required OAuth parameters.
      if (q.response_type !== "code") {
        return reply.code(400).send({ error: "unsupported_response_type" });
      }
      if (!q.client_id || !q.redirect_uri || !q.code_challenge) {
        return reply.code(400).send({ error: "invalid_request", error_description: "Missing required parameters" });
      }
      if (q.code_challenge_method && q.code_challenge_method !== "S256") {
        return reply.code(400).send({ error: "invalid_request", error_description: "Only S256 PKCE is supported" });
      }
      if (!validateClient(q.client_id, "")) {
        // Client ID check only (no secret at this step — it comes at token exchange).
        if (q.client_id !== oauthConfig.clientId) {
          return reply.code(401).send({ error: "invalid_client" });
        }
      }

      // If no provider specified and multiple are registered, show a picker page.
      // If only one provider is registered, default to it automatically.
      let providerName = q.provider;
      if (!providerName) {
        if (providers.size === 1) {
          providerName = providers.keys().next().value as string;
        } else {
          // Show provider selection page — preserve all OAuth params in each button URL.
          const baseParams = new URLSearchParams({
            response_type: q.response_type!,
            client_id: q.client_id!,
            redirect_uri: q.redirect_uri!,
            code_challenge: q.code_challenge!,
            code_challenge_method: q.code_challenge_method || "S256",
            ...(q.state ? { state: q.state } : {}),
          });
          const buttons = Array.from(providers.entries())
            .map(([name]) => {
              const p = new URLSearchParams(baseParams);
              p.set("provider", name);
              const label =
                name === "google"
                  ? "Sign in with Google"
                  : name === "microsoft"
                  ? "Sign in with Microsoft"
                  : `Sign in with ${name.charAt(0).toUpperCase() + name.slice(1)}`;
              return `<a href="/oauth/authorize?${p}" class="btn btn-${name}">${label}</a>`;
            })
            .join("\n          ");
          reply.header("Content-Type", "text/html; charset=utf-8");
          return reply.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to Wiki.js MCP</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0;
      background: #f5f5f5;
    }
    .card {
      background: #fff; border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.12);
      padding: 40px 48px; max-width: 400px; width: 100%; text-align: center;
    }
    h1 { font-size: 1.4rem; margin: 0 0 8px; color: #1a1a1a; }
    p  { color: #666; margin: 0 0 32px; font-size: .95rem; }
    .btn {
      display: block; width: 100%; padding: 12px 16px; margin-bottom: 12px;
      border-radius: 8px; font-size: 1rem; font-weight: 500;
      text-decoration: none; cursor: pointer; transition: opacity .15s;
    }
    .btn:hover { opacity: .85; }
    .btn-google  { background: #fff; color: #444; border: 1px solid #ddd; }
    .btn-microsoft { background: #0078d4; color: #fff; border: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign in to Wiki.js MCP</h1>
    <p>Choose your account type to continue.</p>
    ${buttons}
  </div>
</body>
</html>`);
        }
      }

      const provider = providers.get(providerName!);
      if (!provider) {
        return reply
          .code(400)
          .send({ error: "invalid_request", error_description: `Unknown provider: ${providerName}` });
      }

      // Store the session keyed by a random ID that doubles as the provider `state`.
      const sessionId = randomBytes(24).toString("base64url");
      storeSession(sessionId, {
        claudeRedirectUri: q.redirect_uri,
        claudeState: q.state || "",
        codeChallenge: q.code_challenge,
        codeChallengeMethod: "S256",
        provider: providerName,
        createdAt: Date.now(),
      });

      // Redirect user's browser to the identity provider.
      const providerUrl = provider.getAuthorizationUrl(sessionId);
      return reply.redirect(302, providerUrl);
    }
  );

  // ---- Identity-provider callback ----
  // The identity provider (Google, Entra, …) redirects here after the user
  // authenticates.  The :provider param matches the provider name in the registry.
  fastify.get(
    "/oauth/callback/:provider",
    async (
      request: FastifyRequest<{
        Params: { provider: string };
        Querystring: { code?: string; state?: string; error?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { provider: providerName } = request.params;
      const { code, state: sessionId, error } = request.query;

      // Recover the session before doing anything else so we can redirect
      // errors back to Claude rather than showing a raw JSON response.
      const session = sessionId ? consumeSession(sessionId) : undefined;

      // Identity provider reported an error (e.g. user denied consent).
      if (error) {
        if (session) {
          const errUrl = buildRedirectError(
            session.claudeRedirectUri,
            "access_denied",
            `Identity provider error: ${error}`,
            session.claudeState
          );
          return reply.redirect(302, errUrl);
        }
        return reply.code(400).send({ error: "access_denied", error_description: error });
      }

      if (!code || !session) {
        return reply.code(400).send({ error: "invalid_request", error_description: "Missing code or invalid state" });
      }

      const provider = providers.get(providerName);
      if (!provider) {
        const errUrl = buildRedirectError(
          session.claudeRedirectUri,
          "server_error",
          `Unknown provider: ${providerName}`,
          session.claudeState
        );
        return reply.redirect(302, errUrl);
      }

      // Exchange provider code for user identity.
      let email: string;
      let name: string;
      try {
        ({ email, name } = await provider.getUserIdentity(code, sessionId!));
      } catch (err) {
        fastify.log.error({ err }, "[OAuth] Identity provider error");
        const errUrl = buildRedirectError(
          session.claudeRedirectUri,
          "server_error",
          "Failed to retrieve user identity",
          session.claudeState
        );
        return reply.redirect(302, errUrl);
      }

      // Resolve or auto-provision the user's Wiki.js API key.
      let wikiJsKey = getWikiJsKeyForEmail(email, oauthConfig.mcpKeysPath);
      if (!wikiJsKey) {
        const adminToken = process.env.WIKIJS_ADMIN_TOKEN || process.env.WIKIJS_TOKEN || "";
        const wikijsBaseUrl = process.env.WIKIJS_BASE_URL || "http://localhost:3000";
        try {
          wikiJsKey = await provisionWikiJsKey(
            email,
            name,
            wikijsBaseUrl,
            adminToken,
            oauthConfig.wikijsTemplateGroup,
            oauthConfig.mcpKeysPath
          );
        } catch (err) {
          fastify.log.error({ err }, "[OAuth] Provisioning failed");
          const errUrl = buildRedirectError(
            session.claudeRedirectUri,
            "server_error",
            "Your account is not provisioned. Ask your admin to run the provisioning script.",
            session.claudeState
          );
          return reply.redirect(302, errUrl);
        }
      }

      // Issue a short-lived one-time auth code and redirect to Claude.
      const authCode = randomBytes(24).toString("base64url");
      storeAuthCode(authCode, {
        email,
        codeChallenge: session.codeChallenge,
        createdAt: Date.now(),
      });

      const redirectUrl = new URL(session.claudeRedirectUri);
      redirectUrl.searchParams.set("code", authCode);
      if (session.claudeState) {
        redirectUrl.searchParams.set("state", session.claudeState);
      }
      return reply.redirect(302, redirectUrl.toString());
    }
  );

  // ---- Token endpoint ----
  // Claude exchanges the auth code for an MCP access token here.
  fastify.post(
    "/oauth/token",
    async (
      request: FastifyRequest<{
        Body: {
          grant_type?: string;
          code?: string;
          redirect_uri?: string;
          client_id?: string;
          client_secret?: string;
          code_verifier?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      reply.header("Content-Type", "application/json");

      const body = request.body || {};

      // Support both application/json and application/x-www-form-urlencoded.
      const grantType = body.grant_type;
      if (grantType !== "authorization_code") {
        return reply
          .code(400)
          .send({ error: "unsupported_grant_type" });
      }

      // Validate client credentials (from body or Basic auth header).
      let clientId = body.client_id || "";
      let clientSecret = body.client_secret || "";

      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith("Basic ")) {
        const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
        const sep = decoded.indexOf(":");
        if (sep !== -1) {
          clientId = clientId || decodeURIComponent(decoded.slice(0, sep));
          clientSecret = clientSecret || decodeURIComponent(decoded.slice(sep + 1));
        }
      }

      if (!validateClient(clientId, clientSecret)) {
        return reply.code(401).send({ error: "invalid_client" });
      }

      // Validate the auth code.
      const code = body.code;
      if (!code) {
        return reply.code(400).send({ error: "invalid_request", error_description: "Missing code" });
      }
      const codeEntry = consumeAuthCode(code);
      if (!codeEntry) {
        return reply.code(400).send({ error: "invalid_grant", error_description: "Code expired or invalid" });
      }

      // Verify PKCE.
      const codeVerifier = body.code_verifier;
      if (!codeVerifier) {
        return reply.code(400).send({ error: "invalid_request", error_description: "Missing code_verifier" });
      }
      if (!verifyPkce(codeVerifier, codeEntry.codeChallenge)) {
        return reply.code(400).send({ error: "invalid_grant", error_description: "PKCE verification failed" });
      }

      // Issue the MCP access token.
      const accessToken = await signAccessToken(
        codeEntry.email,
        oauthConfig.issuer,
        jwtSecretBytes,
        oauthConfig.accessTokenTtlSeconds
      );

      return {
        access_token: accessToken,
        token_type: "bearer",
        expires_in: oauthConfig.accessTokenTtlSeconds,
      };
    }
  );
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function buildRedirectError(
  redirectUri: string,
  error: string,
  description: string,
  state: string
): string {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}
