# Task: Add OAuth 2.0 Support to Wiki.js MCP Server

## Context

The Wiki.js MCP server is running at `https://mcp.knb.bulksource.com` and is used by engineers via Claude Code. The goal is to extend it to also work as a Custom Connector in Claude Desktop for the whole team (designers, PMs, QA, support, etc.) on an Anthropic Team plan.

### Current authentication

Each request must include a personal Wiki.js API token in the `Authorization: Bearer <token>` header. This is per-user — edits are attributed to the token owner in Wiki.js page history. This functionality must continue to work exactly as it does today.

### The problem

Claude Desktop Custom Connectors on Team plans work differently from Claude Code:
- An Owner adds a **single connector URL** for the entire organization
- Each team member then clicks "Connect" individually
- The connector UI provides two optional fields: **OAuth Client ID** and **OAuth Client Secret**
- There is no way for individual users to supply custom HTTP headers through this UI

This means the current Bearer token approach cannot work for Claude Desktop. The only clean solution is an OAuth 2.0 flow: when a user clicks "Connect", they go through OAuth and receive their own token automatically.

### Existing infrastructure

- Wiki.js already uses Google OAuth for user login — investigate whether this can be reused or extended
- The MCP server is built on Fastify + TypeScript
- Docker Compose stack: PostgreSQL + Wiki.js + MCP server on the same host
- Nginx reverse proxy handles HTTPS termination

---

## Your Task

Implement OAuth 2.0 support in the MCP server so that Claude Desktop can authenticate users via the OAuth Client ID / OAuth Client Secret fields in the Connector settings UI.

### Before writing any code

1. Read the existing source code thoroughly — understand the current auth implementation (Bearer token, per-user token lookup, how `WikiJsAPI` is instantiated per request)
2. Read the MCP remote auth specification: https://modelcontextprotocol.io/docs/concepts/authentication
3. Check what OAuth flow Claude Desktop expects — SSE/Streamable HTTP + OAuth spec used by Claude is documented at https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers
4. Propose an implementation plan and discuss it before writing any code

### Requirements

- OAuth 2.0 flow must result in a per-user token being used for all Wiki.js GraphQL calls — same as the current Bearer token approach
- The existing `Authorization: Bearer <token>` authentication must continue to work unchanged (Claude Code users are not affected)
- Wiki.js already has per-user API tokens provisioned via `scripts/provision-mcp-keys.sh` — the OAuth implementation should map authenticated users to their existing tokens, or provision new ones
- All new code comments must be in **English**
- Do not break any existing functionality

### Out of scope

- Changes to how Claude Code connects (`.mcp.json` with Bearer token stays as-is)
- Changes to Wiki.js itself
- Any UI changes

---

## Definition of Done

- A team member can open Claude Desktop → Settings → Connectors, find the Wiki.js connector added by the Owner, click "Connect", complete an OAuth flow, and start using all 17 Wiki.js MCP tools
- Edits made through Claude Desktop are attributed to the correct user in Wiki.js page history
- Claude Code continues to work exactly as before
- All new code and comments are in English
