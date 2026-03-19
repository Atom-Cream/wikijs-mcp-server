# Deployment Instructions: MCP HTTP Protocol Update

## What Changed

New files added to enable MCP HTTP protocol (JSON-RPC 2.0 + SSE):
- `src/mcp/protocol.ts` - Type definitions
- `src/mcp/handlers.ts` - MCP method handlers (initialize, tools/list, tools/call)
- `src/mcp/jsonrpc.ts` - JSON-RPC 2.0 request router
- `src/mcp/sse.ts` - Server-Sent Events manager
- `src/server.ts` - Modified to include MCP routes

All existing REST endpoints remain unchanged.

---

## Step-by-Step Remote Server Update

### 1. SSH into the remote server

```bash
ssh your-user@<your-mcp-host>
```

### 2. Navigate to the project directory

```bash
cd /path/to/wikijs-mcp-server
```

### 3. Add the fork as remote and pull changes

If the server currently tracks the original repo:
```bash
# Add BulkSource fork as a new remote
git remote add bulksource https://github.com/BulkSource/wikijs-mcp-server.git

# Fetch and checkout the feature branch
git fetch bulksource
git checkout -b feature/mcp-http-protocol bulksource/feature/mcp-http-protocol
```

If the server already uses the BulkSource fork:
```bash
git fetch origin
git checkout feature/mcp-http-protocol
git pull
```

### 4. Install dependencies (if any new ones were added)

```bash
npm install
```

### 5. Build TypeScript

```bash
npm run build
```

This compiles `src/**/*.ts` into `dist/**/*.js`.

### 6. Verify the build succeeded

```bash
# Check that the new MCP files were compiled
ls dist/mcp/
# Should show: protocol.js  handlers.js  jsonrpc.js  sse.js
```

### 7. Restart the server

```bash
# If using PM2:
pm2 restart wikijs-mcp

# If using systemd:
sudo systemctl restart wikijs-mcp

# If running directly:
npm run stop
npm run start
```

### 8. Verify MCP endpoints are working

```bash
# Health check
curl http://localhost:8000/health

# Root info (should show /mcp in endpoints list)
curl http://localhost:8000/

# Test MCP initialize
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0"}
    }
  }'

# Test tools/list
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'

# Test tools/call (list pages)
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "list_pages",
      "arguments": {"limit": 3}
    }
  }'

# Test SSE connection (Ctrl+C to stop)
curl -N http://localhost:8000/mcp/events
```

---

## Claude Desktop Configuration

Once the server is verified, team members can add this to their Claude Desktop config:

**File:** `~/.config/claude/claude_desktop_config.json` (Linux/Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "wikijs": {
      "transport": "http",
      "url": "https://<your-mcp-host>/mcp",
      "events": "https://<your-mcp-host>/mcp/events"
    }
  }
}
```

## Claude Code CLI Configuration

```bash
claude mcp add wikijs --transport http --url https://<your-mcp-host>/mcp
```

---

## Installing Claude Code CLI on Remote Server

If you want Claude Code to help manage the remote server:

```bash
# Install via npm (Node.js 18+ required)
npm install -g @anthropic-ai/claude-code

# Authenticate
claude login

# Navigate to project and let Claude help
cd /path/to/wikijs-mcp-server
claude
```

---

## Rollback

If something goes wrong:
```bash
git checkout main
npm run build
# restart server
```

---

## Reverse Proxy Note

If the server runs behind nginx/Caddy on `<your-mcp-host>`, ensure:
- `POST /mcp` is proxied with JSON body support
- `GET /mcp/events` is proxied with SSE support (no buffering)

Nginx example:
```nginx
location /mcp/events {
    proxy_pass http://localhost:8000;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    chunked_transfer_encoding off;
    proxy_buffering off;
    proxy_cache off;
}

location /mcp {
    proxy_pass http://localhost:8000;
    proxy_set_header Content-Type $http_content_type;
}
```
