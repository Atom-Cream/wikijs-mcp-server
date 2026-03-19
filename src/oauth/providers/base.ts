/**
 * Common interface that every identity provider must implement.
 *
 * To add Microsoft Entra ID (or any other provider) in the future:
 *   1. Create src/oauth/providers/entra.ts implementing this interface.
 *   2. Add env vars for that provider in src/oauth/config.ts.
 *   3. Register a new callback route in src/oauth/routes.ts following the same
 *      pattern as the Google route:
 *        GET /oauth/callback/:provider  →  provider.handleCallback(req, reply)
 *   4. Export the provider instance from this file alongside googleProvider.
 */
export interface IdentityProvider {
  /** Short identifier used in the callback URL path, e.g. "google". */
  readonly name: string;

  /**
   * Returns the URL to redirect the user's browser to for authentication.
   * @param sessionId - Opaque value stored server-side; passed as OAuth `state`
   *                    so we can retrieve the session when the provider redirects back.
   */
  getAuthorizationUrl(sessionId: string): string;

  /**
   * Exchanges the provider's one-time authorization code for the user's identity.
   * Called from the provider-specific callback route after the user authenticates.
   *
   * @param code      - Authorization code received from the provider.
   * @param sessionId - The same session ID that was passed as `state` to the provider.
   * @returns Verified user identity (email is the canonical key used throughout).
   */
  getUserIdentity(
    code: string,
    sessionId: string
  ): Promise<{ email: string; name: string }>;
}
