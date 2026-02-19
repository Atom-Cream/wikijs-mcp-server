# OAuth 2.1 Setup — Admin Guide

This guide walks the team admin through enabling Claude Desktop Custom Connectors
for the whole team via OAuth 2.1 + Google sign-in.

**Time to complete:** ~20 minutes
**What users get:** any team member can open Claude Desktop → Settings → Connectors,
click "Connect", sign in with their Google account, and start using all 17 Wiki.js
tools — no token management, no `.mcp.json` edits.

> **Claude Code users are not affected.** Their existing Bearer-token setup
> continues to work exactly as before.

---

## Prerequisites

- Admin access to [Google Cloud Console](https://console.cloud.google.com)
- SSH access to the server running the MCP Docker stack
- The `.env` file used by the MCP server container

---

## Step 1 — Create a Google OAuth App

1. Open **Google Cloud Console → APIs & Services → Credentials**
2. Click **"Create Credentials" → "OAuth 2.0 Client ID"**
3. Application type: **Web application**
4. Name: `Wiki.js MCP Server` (or anything recognizable)
5. Under **Authorized redirect URIs**, add exactly:
   ```
   https://mcp.knb.bulksource.com/oauth/callback/google
   ```
6. Click **Create**
7. Copy the **Client ID** and **Client Secret** — you'll need them in Step 2

> If the team uses Google Workspace, restrict access to your domain in
> **OAuth consent screen → "Internal"** so only company accounts can log in.

---

## Step 2 — Generate Server Secrets

SSH into the server and run the following to generate two strong secrets:

```bash
# MCP OAuth client secret (what Claude Desktop will use)
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"

# JWT signing secret (internal — never shared)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save both outputs — you'll paste them into the `.env` file next.

---

## Step 3 — Update the Server `.env` File

Open the `.env` file for the MCP server container and add the following block.
Keep all existing variables unchanged.

```dotenv
# ── OAuth 2.1 ────────────────────────────────────────────────────────────────

# Public base URL of this server (no trailing slash)
OAUTH_ISSUER=https://mcp.knb.bulksource.com

# Credentials you will enter in the Claude Desktop Connector UI (Step 5).
# OAUTH_CLIENT_ID can be any stable string — the value below is fine as-is.
# OAUTH_CLIENT_SECRET is the first secret you generated in Step 2.
OAUTH_CLIENT_ID=wikijs-mcp-client
OAUTH_CLIENT_SECRET=<first secret from Step 2>

# JWT signing secret — the second value from Step 2.  Never share this.
OAUTH_JWT_SECRET=<second secret from Step 2>

# Access token lifetime (seconds).  3600 = 1 hour.
OAUTH_ACCESS_TOKEN_TTL=3600

# Path to mcp-keys.json inside the container (see Step 4)
MCP_KEYS_PATH=/app/mcp-keys.json

# Wiki.js group whose permissions are copied for newly provisioned users.
# Must be an existing group in your Wiki.js instance (e.g. "editors").
WIKIJS_TEMPLATE_GROUP=editors

# ── Google identity provider ──────────────────────────────────────────────────

GOOGLE_CLIENT_ID=<Client ID from Step 1>
GOOGLE_CLIENT_SECRET=<Client Secret from Step 1>
GOOGLE_REDIRECT_URI=https://mcp.knb.bulksource.com/oauth/callback/google
```

---

## Step 4 — Mount `mcp-keys.json` into the Container

The OAuth layer reads and updates `mcp-keys.json` to map user emails to their
Wiki.js API keys.  The file must be accessible inside the container.

In your `docker-compose.yml`, add a volume mount for the MCP server service:

```yaml
services:
  mcp-server:
    # ... existing config ...
    volumes:
      - ./mcp-keys.json:/app/mcp-keys.json
```

If `mcp-keys.json` does not exist yet on the host, create an empty one:

```bash
echo '{}' > mcp-keys.json
```

> **Note:** existing entries in `mcp-keys.json` (provisioned by
> `scripts/provision-mcp-keys.sh`) are reused automatically.  OAuth users who
> already have a key will not be re-provisioned.  New users who have never logged
> in to Wiki.js before must log in to Wiki.js at least once (via the Wiki.js
> web UI) before their first OAuth login to the MCP server.

---

## Step 5 — Restart the Container

```bash
docker compose up -d --build mcp-server
```

Verify the new endpoints are live:

```bash
# Should return JSON with authorization_servers
curl https://mcp.knb.bulksource.com/.well-known/oauth-protected-resource

# Should return authorization_endpoint, token_endpoint, etc.
curl https://mcp.knb.bulksource.com/.well-known/oauth-authorization-server
```

---

## Step 6 — Add the Connector in Claude Desktop (Org Admin)

The connector must be created at the **organisation** level so it appears for all
team members automatically.

1. Open **Claude Desktop → Organisation Settings → Connectors** (you need org-admin rights)
2. Click **"Add Connector"**
3. Fill in:
   - **Connector URL:** `https://mcp.knb.bulksource.com/mcp`
   - **OAuth Client ID:** the value of `OAUTH_CLIENT_ID` from your `.env`
     (e.g. `wikijs-mcp-client`)
   - **OAuth Client Secret:** the value of `OAUTH_CLIENT_SECRET` from your `.env`
4. Save — the connector is now visible to every member of the organisation

> **Important:** if you previously added the connector and need to reset it (e.g.
> after a server rebuild or config change), remove it at the **org level** and
> re-add it.  Removing it only from Personal Settings does not clear Claude
> Desktop's cached tool metadata.

---

## Step 7 — User Connection (Each Team Member)

Each user does this once:

1. Open **Claude Desktop → Settings → Connectors**
2. Find the **BulkSource Knowledge Base** connector added by the admin
3. Click **"Connect"**
4. A browser window opens → sign in with your Google (act.software) account
5. Done — Claude Desktop now has access to all Wiki.js tools

Edits made through Claude Desktop are attributed to the correct user in Wiki.js
page history (same as Claude Code).

> **First-time users:** you must have logged in to the Wiki.js web UI at least
> once before connecting via Claude Desktop.  The OAuth provisioning step looks
> you up by email and will fail if your account doesn't exist in Wiki.js yet.

---

## Troubleshooting

### "Your account is not provisioned"

The user's email was not found in Wiki.js.  Ask the user to log in to the Wiki.js
web UI at least once, then try connecting again.  If the issue persists, run the
provisioning script manually:

```bash
./scripts/provision-mcp-keys.sh <admin-token> editors
```

### "Identity provider error: access_denied"

The user clicked "Cancel" on the Google consent screen, or their Google account
is not in the allowed domain.  Ask the user to try again and approve the consent
screen using their `act.software` Google account.

### Tools appear to return errors even though the server is healthy

Disconnect the connector at the **org level** (Organisation Settings → Connectors
→ Remove), then re-add it.  Claude Desktop caches the tool metadata from the
first connection; stale cache can cause tools to be reported as failing even
when the server returns valid data.

### Token expires and Claude Desktop doesn't reconnect automatically

The access token lifetime is controlled by `OAUTH_ACCESS_TOKEN_TTL` (default 1 hour).
Claude Desktop will re-initiate the OAuth flow when the token expires.  This is
expected behaviour.

### Adding a second identity provider (e.g. Microsoft Entra ID)

See `src/oauth/providers/base.ts` for the interface and
`src/oauth/providers/google.ts` for a reference implementation.
A future Entra ID provider only requires:
1. A new `src/oauth/providers/entra.ts` file
2. Three new env vars (`ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_REDIRECT_URI`)
3. Registering the provider in `src/oauth/routes.ts` (one `providers.set(...)` line)
