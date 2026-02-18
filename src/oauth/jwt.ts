/**
 * MCP access token signing and verification.
 *
 * Tokens are compact signed JWTs (HS256) issued by this server and validated
 * on every incoming /mcp request.  The `email` claim is the stable key used to
 * look up the corresponding Wiki.js API key at request time.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export interface McpTokenClaims extends JWTPayload {
  /** Verified email of the authenticated user */
  email: string;
}

/**
 * Issue a signed MCP access token.
 *
 * @param email      - Verified email address of the authenticated user.
 * @param issuer     - OAUTH_ISSUER — used for both `iss` and `aud` claims.
 * @param secret     - Raw bytes of OAUTH_JWT_SECRET.
 * @param ttlSeconds - Token lifetime in seconds.
 */
export async function signAccessToken(
  email: string,
  issuer: string,
  secret: Uint8Array,
  ttlSeconds: number
): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setAudience(issuer)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret);
}

/**
 * Verify a token that claims to be issued by this server.
 * Returns the payload on success, null if the signature or claims are invalid.
 */
export async function verifyAccessToken(
  token: string,
  issuer: string,
  secret: Uint8Array
): Promise<McpTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer,
      audience: issuer,
    });
    return payload as McpTokenClaims;
  } catch {
    return null;
  }
}

/**
 * Fast pre-check: does the token's `iss` claim match our issuer?
 * This is a cheap decode (no signature verification) used in extractToken()
 * to decide which auth path to take before doing the full async verify.
 */
export function isOurJwt(token: string, issuer: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as Record<string, unknown>;
    return payload.iss === issuer;
  } catch {
    return false;
  }
}
