# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-03-19

### Added
- **MCP HTTP Protocol**: Full JSON-RPC 2.0 + Server-Sent Events (SSE) transport (MCP 2025-03-26 spec)
- **OAuth 2.1 support**: Authorization server for Claude Desktop Custom Connectors with provider picker UI
- **Microsoft Entra ID OAuth provider**: Enterprise SSO integration
- **Google OAuth provider**: Reuses existing Wiki.js Google OAuth infrastructure
- **Per-user authentication**: Individual API keys per user; edits attributed in Wiki.js page history
- **Dockerfile**: Containerized deployment support
- **DB patch for history attribution**: Direct PostgreSQL patch to fix page history attribution for MCP edits
- **`update_page` title parameter**: Optional `title` field for page updates
- **Per-user MCP key provisioning script**: `scripts/provision-mcp-keys.sh`
- **`OAUTH_SETUP.md`**: Administrator setup guide for OAuth

### Changed
- **Locale default**: Changed from `ru` to `en`
- **Project structure**: Refactored to factory pattern for per-request WikiJsAPI instances
- **MCP tool errors**: Return `isError: true` instead of JSON-RPC errors for tool failures
- **`update_page`**: Fetches page metadata before update for proper history entries; sets `isPublished: true`

### Fixed
- JSON-RPC compliance: removed `outputSchema` and non-standard metadata from `tools/list`
- Handle `resources/list`, `prompts/list`, `logging/setLevel` gracefully (no crash on unknown methods)
- Don't send JSON-RPC response to notifications
- Handle GET `/mcp` for Streamable HTTP SSE transport
- Parse `application/x-www-form-urlencoded` on `/oauth/token`
- Fix Fastify "Reply was already sent" error on `/mcp` endpoint
- Fix GraphQL queries: removed `updatedAt` from `UserMinimal` and `GroupMinimal`

---

## [1.2.0] - 2025-05-22

### Added

- **Smart multi-level search**: Fully reworked search system with 4 stages
- **HTTP fallback for search**: Alternative content retrieval method when API permissions are limited
- **Content search**: Deep search inside HTML page content
- **Forced check**: Fallback search on known pages
- **Auto-publish**: Pages are automatically published on update

### Changed

- **`searchPages()` method**: Now uses a multi-stage search algorithm
- **New `getPageContentViaHTTP()` method**: Content retrieval via HTTP requests
- **Updated `updatePage` GraphQL query**: Added `isPublished: true` parameter
- **Improved error handling**: Better logging and fallback mechanisms

### Fixed

- **Permission issue**: Resolved "You are not authorized to view this page" error
- **Incorrect HTML extraction**: Fixed regex for content in `<template slot="contents">`
- **Missing auto-publish**: Pages are now automatically published on create/update
- **Limited `listPages` results**: Added alternative search methods

### Search pipeline stages

1. **GraphQL API search** — fast search over indexed content
2. **Metadata search** — search in titles, paths, and descriptions
3. **HTTP content search** — extract and search in HTML content
4. **Forced check** — check known pages (IDs 103–110)

### Project cleanup

- Removed debug files (`test-search-debug.js`, `test-update-publish.js`)
- Removed temporary logs and PID files

---

## [1.1.0] - 2025-05-22

### Added

- **Automatic page URL generation**: All page methods now return a `url` field with a direct link to the page
- **URL locale support**: Configure locale via `WIKIJS_LOCALE` environment variable
- **Flexible base URL**: `WIKIJS_BASE_URL` variable for Wiki.js server address

### Changed

- **`WikiJsPage` type**: Added optional `url: string` field
- **`WikiJsAPI` class**: Constructor now accepts a `locale` parameter
- **Updated API methods**:
  - `getPage()` — returns page URL
  - `listPages()` — returns URL for each page
  - `searchPages()` — returns URL in search results
  - `createPage()` — returns URL of the created page
  - `updatePage()` — returns URL of the updated page

### Environment variables

```bash
# New variables
WIKIJS_LOCALE=ru              # Locale for URL (default: ru)

# Updated variables
WIKIJS_BASE_URL=http://localhost:8080  # Now used for URL generation
```

URL format: `{WIKIJS_BASE_URL}/{WIKIJS_LOCALE}/{page_path}`

---

## [1.0.0] - 2025-05-22

### Added

- Base tools for working with Wiki.js via MCP
- Page management (CRUD operations)
- User management
- Page and user search
- GraphQL API integration
