# Change Request: MCP Server Improvements

## CR-1: Translate error/log messages to English

**Priority:** Low
**Scope:** `src/tools.ts`, `src/server.ts`

All Russian-language strings in console.log, error messages, and comments should be replaced with English equivalents. This includes:

- Constructor log: `"Конструктор вызван"` → `"Constructor called"`
- Auth header log: `"Устанавливается заголовок Authorization"` → `"Setting Authorization header"`
- Config header: `"Конфигурация MCP сервера"` → `"MCP server configuration"`
- Any other Russian strings in error responses, debug output, and inline comments

No functional changes. Purely cosmetic/i18n cleanup.

## CR-2: Add page title update capability

**Priority:** Medium
**Scope:** `src/tools.ts`

Currently `update_page` only updates the page body content. Add support for updating the page title.

Changes needed:
- Add optional `title` parameter to the `update_page` tool definition (in `wikiJsTools` array)
- Modify the `updatePage` GraphQL mutation to include `title` when provided
- Keep `title` optional — if omitted, only content is updated (current behavior preserved)

## CR-3: Per-user Wiki.js authentication via MCP

**Priority:** High
**Scope:** `src/server.ts`, `src/mcp/handlers.ts`, `src/mcp/jsonrpc.ts`, `src/tools.ts`

### Problem

1. All MCP operations use a single admin API token — every article is authored as the admin user regardless of who actually created it.
2. The MCP endpoint is publicly accessible — anyone who discovers the URL can read/write the entire knowledge base.

### Solution

Require each MCP client to provide their own Wiki.js API token via HTTP header. The server uses that token for all Wiki.js GraphQL calls in that session, so:
- Articles are created/updated under the correct author
- Unauthenticated requests are rejected

### Design

**Client side (Claude Code `.mcp.json`):**
```json
{
  "mcpServers": {
    "wikijs": {
      "type": "http",
      "url": "https://mcp.knb.bulksource.com/mcp",
      "headers": {
        "Authorization": "Bearer <user-personal-wiki-api-token>"
      }
    }
  }
}
```

Each teammate generates their own Wiki.js API token (Wiki.js → User menu → API Keys) and puts it in their local `.mcp.json` (which should be in `.gitignore`).

**Server side — request flow:**

1. `POST /mcp` and `GET /mcp/events` routes extract `Authorization: Bearer <token>` from the request header.
2. If no token is provided → respond with JSON-RPC error (`-32001 Unauthorized`).
3. For each request, instantiate a `WikiJsAPI` with the caller's token instead of the server-wide admin token.
4. Pass this per-request API instance into `McpHandlers` / `JsonRpcRouter` so all tool calls use it.

**Key implementation details:**

- The server's own `WIKIJS_TOKEN` env var becomes a fallback/default only for health checks and server startup validation — not for MCP tool calls.
- `WikiJsAPI` class already accepts `token` in its constructor, so no changes needed there.
- `McpHandlers.handleToolCall` currently uses a module-level `wikiJsToolsWithImpl` map. This needs to be refactored so each call gets a fresh `WikiJsAPI` instance bound to the caller's token.
- SSE connections (`GET /mcp/events`) should also validate the token on connect.

**What does NOT change:**
- REST endpoints (`/api/*`) if any — those keep using the server token
- Health check endpoint (`/health`) — no auth required
- Root endpoint (`GET /`) — no auth required

### Teammate setup update

After this change, `TEAMMATE_SETUP.md` needs to be updated:
- Each user must create a Wiki.js API key
- `.mcp.json` must include the `headers` field with their personal token
- `.mcp.json` should be listed in `.gitignore` (contains secrets)

### Known risk: Claude Code header bug

There are open GitHub issues (#14977, #7290) where custom headers in `.mcp.json` are not transmitted to the server. If this bug is present in the current Claude Code version, implement a fallback: accept the token as a query parameter (`?token=<token>`) in addition to the `Authorization` header. Test header delivery early in implementation.

### Testing checklist

- [ ] Verify custom headers actually arrive at the server (Claude Code bug check)
- [ ] If headers don't arrive, implement and test query parameter fallback
- [ ] Request without `Authorization` header → `Unauthorized` error
- [ ] Request with invalid token → Wiki.js GraphQL error propagated
- [ ] Request with valid user token → tools work, articles authored by that user
- [ ] `list_pages`, `search_pages`, `get_page` respect user's permissions
- [ ] `create_page` shows correct author in Wiki.js
- [ ] `update_page` shows correct "last edited by" in Wiki.js
- [ ] Health check still works without auth
- [ ] SSE endpoint rejects unauthenticated connections
