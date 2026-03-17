/**
 * Microsoft Entra ID (Azure AD) OAuth 2.0 identity provider.
 *
 * Uses the Authorization Code flow to authenticate the user with their
 * Microsoft account and retrieve their verified email address and display name.
 *
 * Azure portal setup required:
 *   - App registration in Entra ID (https://portal.azure.com)
 *   - Supported account types: single tenant or multi-tenant as needed
 *   - Redirect URI (Web): value of ENTRA_REDIRECT_URI env var
 *     (e.g. https://mcp.knb.bulksource.com/oauth/callback/microsoft)
 *   - API permissions: openid, email, profile (delegated, no admin consent needed)
 */
import { type IdentityProvider } from "./base.js";

interface EntraTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

interface EntraUserInfo {
  mail: string | null;
  userPrincipalName: string;
  displayName: string;
}

export class EntraProvider implements IdentityProvider {
  readonly name = "microsoft";

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly tenantId: string;

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    tenantId = "common"
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.tenantId = tenantId;
  }

  getAuthorizationUrl(sessionId: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "openid email profile User.Read",
      // Pass our session ID as `state` — Entra echoes it back in the callback.
      state: sessionId,
      // "select_account" forces the account picker so multi-account users can
      // choose the right one.
      prompt: "select_account",
    });
    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params}`;
  }

  async getUserIdentity(
    code: string,
    _sessionId: string
  ): Promise<{ email: string; name: string }> {
    // Step 1: exchange authorization code for an access token.
    const tokenResp = await fetch(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: "authorization_code",
        }),
      }
    );

    if (!tokenResp.ok) {
      const body = await tokenResp.text();
      throw new Error(
        `Entra token exchange failed (${tokenResp.status}): ${body}`
      );
    }

    const tokens = (await tokenResp.json()) as EntraTokenResponse;

    // Step 2: fetch the user's profile from Microsoft Graph.
    const userResp = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResp.ok) {
      throw new Error(
        `Failed to fetch Entra user info (${userResp.status})`
      );
    }

    const user = (await userResp.json()) as EntraUserInfo;

    // `mail` is the primary SMTP address; userPrincipalName is the fallback
    // (works for both cloud-only and hybrid accounts).
    const email = (user.mail || user.userPrincipalName).toLowerCase();
    if (!email) {
      throw new Error("Microsoft account has no email address");
    }

    return { email, name: user.displayName || email };
  }
}
