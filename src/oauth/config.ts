/**
 * OAuth 2.1 configuration loaded from environment variables.
 *
 * Two separate sets of credentials:
 *   1. MCP OAuth credentials  — what the Claude Desktop admin enters in the
 *      Connector settings UI (Client ID / Client Secret).  Our server validates
 *      these at the token endpoint.
 *   2. Identity provider credentials — Google OAuth app used to authenticate
 *      the actual user and learn their email address.
 *
 * Adding a second provider (e.g. Microsoft Entra ID) in the future only
 * requires adding new env vars here and a new class in src/oauth/providers/.
 */
export const oauthConfig = {
  // Public base URL of this MCP server (no trailing slash)
  issuer: process.env.OAUTH_ISSUER || "https://mcp.knb.bulksource.com",

  // Credentials the Claude Desktop admin configures in the Connector UI
  clientId: process.env.OAUTH_CLIENT_ID || "",
  clientSecret: process.env.OAUTH_CLIENT_SECRET || "",

  // Secret used to sign MCP access tokens (HS256).  Generate with:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  jwtSecret: process.env.OAUTH_JWT_SECRET || "",

  // Access token lifetime in seconds (default 1 hour)
  accessTokenTtlSeconds: parseInt(process.env.OAUTH_ACCESS_TOKEN_TTL || "3600", 10),

  // Path to mcp-keys.json produced by scripts/provision-mcp-keys.sh
  mcpKeysPath: process.env.MCP_KEYS_PATH || "/app/mcp-keys.json",

  // ---- Google identity provider ----
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    // Must match an authorized redirect URI in the Google Cloud Console OAuth app.
    // Points to THIS server's callback endpoint, not Claude's.
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      "https://mcp.knb.bulksource.com/oauth/callback/google",
  },

  // Name of the Wiki.js permission group whose rules are copied for new users
  wikijsTemplateGroup: process.env.WIKIJS_TEMPLATE_GROUP || "editors",
};
