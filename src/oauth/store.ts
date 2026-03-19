/**
 * In-memory stores for the OAuth 2.1 authorization flow.
 *
 * - OAuthSession  tracks the state of an authorization request from Claude
 *   through the identity-provider redirect loop.
 * - AuthCode      is a single-use code returned to Claude after successful login.
 * - mcp-keys.json lookup maps an email address to its Wiki.js API key.
 *
 * All stores are periodically cleaned up to prevent unbounded growth.
 * Production deployments with multiple server replicas would need to move
 * these into Redis or a database; for now a single Fastify instance is
 * sufficient.
 */
import { readFileSync } from "fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OAuthSession {
  /** redirect_uri Claude sent in the original /oauth/authorize request */
  claudeRedirectUri: string;
  /** state value Claude sent — echoed back when we redirect to Claude */
  claudeState: string;
  /** PKCE code_challenge sent by Claude */
  codeChallenge: string;
  /** Always "S256" — the only method we accept */
  codeChallengeMethod: "S256";
  /** Which identity provider the user chose (e.g. "google") */
  provider: string;
  createdAt: number;
}

export interface AuthCode {
  /** Verified email from the identity provider */
  email: string;
  /** PKCE code_challenge — verified against code_verifier at token exchange */
  codeChallenge: string;
  createdAt: number;
}

interface McpKeyEntry {
  name: string;
  userId: number;
  groupId: number;
  groupName: string;
  apiKey: string;
  expiration: string;
}

// ---------------------------------------------------------------------------
// TTLs
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MCP_KEYS_CACHE_TTL_MS = 60 * 1000; // re-read mcp-keys.json every minute

// ---------------------------------------------------------------------------
// Session store
// ---------------------------------------------------------------------------

const sessions = new Map<string, OAuthSession>();

export function storeSession(id: string, session: OAuthSession): void {
  sessions.set(id, session);
  pruneMap(sessions, SESSION_TTL_MS);
}

/**
 * Retrieve and delete a session (each session is single-use).
 * Returns undefined if the session is missing or expired.
 */
export function consumeSession(id: string): OAuthSession | undefined {
  const s = sessions.get(id);
  sessions.delete(id);
  if (!s || Date.now() - s.createdAt > SESSION_TTL_MS) return undefined;
  return s;
}

// ---------------------------------------------------------------------------
// Auth code store
// ---------------------------------------------------------------------------

const authCodes = new Map<string, AuthCode>();

export function storeAuthCode(code: string, data: AuthCode): void {
  authCodes.set(code, data);
  pruneMap(authCodes, CODE_TTL_MS);
}

/**
 * Retrieve and delete an auth code (each code is single-use).
 * Returns undefined if the code is missing or expired.
 */
export function consumeAuthCode(code: string): AuthCode | undefined {
  const entry = authCodes.get(code);
  authCodes.delete(code);
  if (!entry || Date.now() - entry.createdAt > CODE_TTL_MS) return undefined;
  return entry;
}

// ---------------------------------------------------------------------------
// mcp-keys.json cache
// ---------------------------------------------------------------------------

let mcpKeysCache: Record<string, McpKeyEntry> | null = null;
let mcpKeysCacheTime = 0;

/** Read and cache mcp-keys.json. Returns an empty object if the file is missing. */
function loadMcpKeys(keysPath: string): Record<string, McpKeyEntry> {
  const now = Date.now();
  if (mcpKeysCache !== null && now - mcpKeysCacheTime < MCP_KEYS_CACHE_TTL_MS) {
    return mcpKeysCache;
  }
  try {
    mcpKeysCache = JSON.parse(readFileSync(keysPath, "utf8")) as Record<
      string,
      McpKeyEntry
    >;
  } catch {
    // File not present or malformed — return whatever we have cached (or empty).
    if (mcpKeysCache === null) mcpKeysCache = {};
  }
  mcpKeysCacheTime = now;
  return mcpKeysCache;
}

/**
 * Returns the Wiki.js API key for the given email, or undefined if the user
 * has not been provisioned yet.
 */
export function getWikiJsKeyForEmail(
  email: string,
  keysPath: string
): string | undefined {
  return loadMcpKeys(keysPath)[email.toLowerCase()]?.apiKey;
}

/**
 * Returns the Wiki.js userId for the given email, or undefined if not found.
 */
export function getUserIdByEmail(
  email: string,
  keysPath: string
): number | undefined {
  return loadMcpKeys(keysPath)[email.toLowerCase()]?.userId;
}

/**
 * Returns the Wiki.js userId for the given mcp-keys.json groupId, or undefined.
 * Used to resolve raw Wiki.js token (grp field) → userId.
 */
export function getUserIdByGroupId(
  groupId: number,
  keysPath: string
): number | undefined {
  for (const entry of Object.values(loadMcpKeys(keysPath))) {
    if (entry.groupId === groupId) return entry.userId;
  }
  return undefined;
}

/** Force a cache refresh — call this after provisioning a new key. */
export function invalidateMcpKeysCache(): void {
  mcpKeysCache = null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pruneMap<V extends { createdAt: number }>(
  map: Map<string, V>,
  ttlMs: number
): void {
  const cutoff = Date.now() - ttlMs;
  for (const [k, v] of map) {
    if (v.createdAt < cutoff) map.delete(k);
  }
}
