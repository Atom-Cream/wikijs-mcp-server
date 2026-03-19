#!/usr/bin/env bash
#
# Provision per-user MCP API keys for Wiki.js
#
# Creates a personal "mcp-{email}" group for each regular user,
# copies permissions from a template group, assigns the user,
# and generates an API key tied to that group.
#
# Usage:
#   ./scripts/provision-mcp-keys.sh <admin-token> <template-group-name> [wikijs-url]
#
# Arguments:
#   admin-token          Full-access Wiki.js API token (from Admin → API Access)
#   template-group-name  Name of the group whose permissions to copy (e.g. "editors")
#   wikijs-url           Wiki.js base URL (default: http://localhost:3000)
#
# Output:
#   Generated keys are saved to ./mcp-keys.json
#

set -euo pipefail

ADMIN_TOKEN="${1:?Usage: $0 <admin-token> <template-group-name> [wikijs-url]}"
TEMPLATE_GROUP="${2:?Usage: $0 <admin-token> <template-group-name> [wikijs-url]}"
WIKIJS_URL="${3:-http://localhost:3000}"
OUTPUT_FILE="$(dirname "$0")/../mcp-keys.json"
# API key expiration: 3 years expressed as days (Wiki.js expects a timespan string, not ISO date)
EXPIRATION="1095d"

gql() {
  local query="$1"
  curl -s -X POST "${WIKIJS_URL}/graphql" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -d "{\"query\": $(echo "$query" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')}"
}

echo "=== Wiki.js MCP Key Provisioning ==="
echo "Wiki.js URL: ${WIKIJS_URL}"
echo "Template group: ${TEMPLATE_GROUP}"
echo "Output file: ${OUTPUT_FILE}"
echo ""

# --- Step 1: Fetch template group permissions ---
echo "[1/5] Fetching groups..."
GROUPS_JSON=$(gql '{ groups { list { id name isSystem } } }')
TEMPLATE_ID=$(echo "$GROUPS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
groups = data['data']['groups']['list']
for g in groups:
    if g['name'] == '${TEMPLATE_GROUP}':
        print(g['id'])
        break
else:
    print('NOT_FOUND')
")

if [ "$TEMPLATE_ID" = "NOT_FOUND" ]; then
  echo "ERROR: Template group '${TEMPLATE_GROUP}' not found."
  echo "Available groups:"
  echo "$GROUPS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for g in data['data']['groups']['list']:
    print(f\"  - {g['name']} (id: {g['id']}, system: {g['isSystem']})\")"
  exit 1
fi

echo "  Found template group '${TEMPLATE_GROUP}' (id: ${TEMPLATE_ID})"

echo "[2/5] Fetching template group permissions..."
TEMPLATE_DETAIL=$(gql "{ groups { single(id: ${TEMPLATE_ID}) { redirectOnLogin permissions pageRules { id deny match roles path locales } } } }")
PERMISSIONS=$(echo "$TEMPLATE_DETAIL" | python3 -c "
import sys, json
data = json.load(sys.stdin)
g = data['data']['groups']['single']
print(json.dumps(g['permissions']))")
PAGE_RULES=$(echo "$TEMPLATE_DETAIL" | python3 -c "
import sys, json
data = json.load(sys.stdin)
g = data['data']['groups']['single']
print(json.dumps(g['pageRules']))")
REDIRECT_ON_LOGIN=$(echo "$TEMPLATE_DETAIL" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['data']['groups']['single'].get('redirectOnLogin') or '/')")
echo "  Permissions: $(echo "$PERMISSIONS" | python3 -c "import sys,json; p=json.load(sys.stdin); print(f'{len(p)} entries')")"
echo "  Page rules: $(echo "$PAGE_RULES" | python3 -c "import sys,json; p=json.load(sys.stdin); print(f'{len(p)} entries')")"
echo "  Redirect on login: ${REDIRECT_ON_LOGIN}"

# --- Step 2: Fetch all users ---
echo "[3/5] Fetching users..."
USERS_JSON=$(gql '{ users { list { id name email isSystem isActive } } }')

# --- Step 3: Build list of existing mcp- groups ---
EXISTING_MCP_GROUPS=$(echo "$GROUPS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for g in data['data']['groups']['list']:
    if g['name'].startswith('mcp-'):
        print(g['name'])")

echo "  Existing mcp- groups: $(echo "$EXISTING_MCP_GROUPS" | grep -c . || echo 0)"

# --- Step 4: Process each user ---
echo "[4/5] Processing users..."

# Initialize output file if it doesn't exist
if [ ! -f "$OUTPUT_FILE" ]; then
  echo '{}' > "$OUTPUT_FILE"
fi

PROCESSED=0
SKIPPED=0
CREATED=0

# Get user list and process
python3 - "$GROUPS_JSON" "$USERS_JSON" "$PERMISSIONS" "$PAGE_RULES" "$EXISTING_MCP_GROUPS" "$ADMIN_TOKEN" "$WIKIJS_URL" "$EXPIRATION" "$OUTPUT_FILE" "$TEMPLATE_GROUP" "$REDIRECT_ON_LOGIN" <<'PYEOF'
import sys, json, subprocess, os

groups_json = json.loads(sys.argv[1])
users_json = json.loads(sys.argv[2])
permissions = json.loads(sys.argv[3])
page_rules = json.loads(sys.argv[4])
existing_mcp = set(sys.argv[5].strip().split('\n')) if sys.argv[5].strip() else set()
admin_token = sys.argv[6]
wikijs_url = sys.argv[7]
expiration = sys.argv[8]
output_file = sys.argv[9]
template_name = sys.argv[10]
redirect_on_login = sys.argv[11]

# Load existing output
try:
    with open(output_file) as f:
        output = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    output = {}

users = users_json['data']['users']['list']
all_groups = {g['name']: g['id'] for g in groups_json['data']['groups']['list']}

# Identify admin group IDs (Administrators and any system groups with admin in name)
admin_group_names = set()
for g in groups_json['data']['groups']['list']:
    if g['isSystem'] or g['name'].lower() in ('administrators', 'guests'):
        admin_group_names.add(g['name'])

def gql(query):
    result = subprocess.run(
        ['curl', '-s', '-X', 'POST', f'{wikijs_url}/graphql',
         '-H', 'Content-Type: application/json',
         '-H', f'Authorization: Bearer {admin_token}',
         '-d', json.dumps({'query': query})],
        capture_output=True, text=True
    )
    return json.loads(result.stdout)

skipped = 0
created = 0

for user in users:
    uid = user['id']
    name = user['name']
    email = user['email']

    # Skip system users (Guest, etc.)
    if user['isSystem']:
        print(f"  SKIP (system): {name} <{email}>")
        skipped += 1
        continue

    # Skip inactive users
    if not user['isActive']:
        print(f"  SKIP (inactive): {name} <{email}>")
        skipped += 1
        continue

    # Check if user is an admin by fetching their groups
    user_detail = gql(f'{{ users {{ single(id: {uid}) {{ groups {{ id name }} }} }} }}')
    user_groups = user_detail['data']['users']['single']['groups']
    user_group_names = {g['name'] for g in user_groups}

    if 'Administrators' in user_group_names:
        print(f"  SKIP (admin): {name} <{email}>")
        skipped += 1
        continue

    # Check if mcp group already exists AND key is saved
    mcp_group_name = f"mcp-{email}"
    if mcp_group_name in existing_mcp and email in output:
        print(f"  SKIP (already provisioned): {name} <{email}> → group '{mcp_group_name}'")
        skipped += 1
        continue

    # --- Create group ---
    print(f"  PROVISION: {name} <{email}>")

    result = gql(f'mutation {{ groups {{ create(name: "{mcp_group_name}") {{ responseResult {{ succeeded message }} group {{ id }} }} }} }}')
    resp = result['data']['groups']['create']
    if not resp['responseResult']['succeeded']:
        print(f"    ERROR creating group: {resp['responseResult']['message']}")
        continue

    group_id = resp['group']['id']
    print(f"    Created group '{mcp_group_name}' (id: {group_id})")

    # --- Set permissions (copy from template) ---
    perms_str = json.dumps(permissions)
    # GraphQL requires enum values (like match: START) without quotes.
    # Convert page_rules to GraphQL input syntax manually.
    def to_gql_input(obj, enum_fields=frozenset({'match'})):
        if isinstance(obj, list):
            return '[' + ', '.join(to_gql_input(i, enum_fields) for i in obj) + ']'
        if isinstance(obj, dict):
            parts = []
            for k, v in obj.items():
                if k in enum_fields and isinstance(v, str):
                    parts.append(f'{k}: {v}')
                else:
                    parts.append(f'{k}: {to_gql_input(v, enum_fields)}')
            return '{' + ', '.join(parts) + '}'
        return json.dumps(obj)
    rules_str = to_gql_input(page_rules)
    update_query = 'mutation { groups { update(id: %d, name: "%s", redirectOnLogin: "%s", permissions: %s, pageRules: %s) { responseResult { succeeded message } } } }' % (
        group_id, mcp_group_name, redirect_on_login, perms_str, rules_str
    )
    result = gql(update_query)
    update_resp = result['data']['groups']['update']
    if not update_resp['responseResult']['succeeded']:
        print(f"    ERROR setting permissions: {update_resp['responseResult']['message']}")
        continue
    print(f"    Copied permissions from '{template_name}'")

    # --- Assign user to group ---
    result = gql(f'mutation {{ groups {{ assignUser(groupId: {group_id}, userId: {uid}) {{ responseResult {{ succeeded message }} }} }} }}')
    assign_resp = result['data']['groups']['assignUser']
    if not assign_resp['responseResult']['succeeded']:
        print(f"    ERROR assigning user: {assign_resp['responseResult']['message']}")
        continue
    print(f"    Assigned user to group")

    # --- Create API key ---
    result = gql(f'mutation {{ authentication {{ createApiKey(name: "mcp-{name}", expiration: "{expiration}", fullAccess: false, group: {group_id}) {{ responseResult {{ succeeded message }} key }} }} }}')
    key_resp = result['data']['authentication']['createApiKey']
    if not key_resp['responseResult']['succeeded']:
        print(f"    ERROR creating API key: {key_resp['responseResult']['message']}")
        continue

    api_key = key_resp['key']
    print(f"    Created API key (mcp-{name})")

    # Save to output
    output[email] = {
        'name': name,
        'userId': uid,
        'groupId': group_id,
        'groupName': mcp_group_name,
        'apiKey': api_key,
        'expiration': expiration
    }
    created += 1

# Write output
with open(output_file, 'w') as f:
    json.dump(output, f, indent=2)

print(f"\n[5/5] Done. Created: {created}, Skipped: {skipped}")
if created > 0:
    print(f"  API keys saved to: {output_file}")
    print(f"  Distribute keys to users for their ~/.claude/.mcp.json config")
PYEOF

echo ""
echo "=== Provisioning complete ==="
