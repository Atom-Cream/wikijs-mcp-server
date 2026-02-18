/**
 * Google OAuth 2.0 identity provider.
 *
 * Uses the Authorization Code flow to authenticate the user with their Google
 * account and retrieve their verified email address and display name.
 *
 * Google Cloud Console setup required:
 *   - OAuth 2.0 Client ID of type "Web application"
 *   - Authorized redirect URI: value of GOOGLE_REDIRECT_URI env var
 *     (e.g. https://mcp.knb.bulksource.com/oauth/callback/google)
 */
import { type IdentityProvider } from "./base.js";

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

interface GoogleUserInfo {
  email: string;
  name: string;
  verified_email: boolean;
}

export class GoogleProvider implements IdentityProvider {
  readonly name = "google";

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  getAuthorizationUrl(sessionId: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      // Pass our session ID as `state` — Google echoes it back in the callback.
      state: sessionId,
      // "select_account" forces the account picker so multi-account users can
      // choose the right one (usually their company @bulksource.com account).
      prompt: "select_account",
      access_type: "online",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async getUserIdentity(
    code: string,
    _sessionId: string
  ): Promise<{ email: string; name: string }> {
    // Step 1: exchange authorization code for an access token.
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResp.ok) {
      const body = await tokenResp.text();
      throw new Error(`Google token exchange failed (${tokenResp.status}): ${body}`);
    }

    const tokens = (await tokenResp.json()) as GoogleTokenResponse;

    // Step 2: fetch the user's profile from Google's userinfo endpoint.
    const userResp = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    if (!userResp.ok) {
      throw new Error(`Failed to fetch Google user info (${userResp.status})`);
    }

    const user = (await userResp.json()) as GoogleUserInfo;

    if (!user.verified_email) {
      throw new Error(`Google account email is not verified: ${user.email}`);
    }

    return { email: user.email.toLowerCase(), name: user.name };
  }
}
