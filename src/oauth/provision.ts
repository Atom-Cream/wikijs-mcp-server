/**
 * Auto-provisioning of Wiki.js API keys for users who authenticate via OAuth
 * but don't yet have an entry in mcp-keys.json.
 *
 * Mirrors the logic of scripts/provision-mcp-keys.sh in TypeScript so that
 * users can start using Claude Desktop immediately after their first OAuth
 * login without requiring a manual admin step.
 *
 * The admin token (WIKIJS_ADMIN_TOKEN) must have full access; the provisioned
 * key is scoped to a per-user group copied from the template group.
 */
import { GraphQLClient } from "graphql-request";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { invalidateMcpKeysCache } from "./store.js";

const KEY_EXPIRATION = "1095d"; // 3 years — same as the shell script

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function gqlClient(baseUrl: string, adminToken: string): GraphQLClient {
  return new GraphQLClient(`${baseUrl}/graphql`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

async function gql<T>(
  client: GraphQLClient,
  query: string
): Promise<T> {
  return client.request<T>(query);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Ensure the given user has a Wiki.js API key and return it.
 *
 * Steps performed (idempotent — safe to call multiple times):
 *   1. Find the user in Wiki.js by email.
 *   2. Find or create a personal "mcp-{email}" permission group.
 *   3. Copy permissions from the template group.
 *   4. Assign the user to the group.
 *   5. Create an API key scoped to that group.
 *   6. Persist the key to mcp-keys.json and invalidate the in-memory cache.
 *
 * Returns the API key string on success, throws on unrecoverable error.
 */
export async function provisionWikiJsKey(
  email: string,
  displayName: string,
  wikijsBaseUrl: string,
  adminToken: string,
  templateGroupName: string,
  keysPath: string
): Promise<string> {
  const client = gqlClient(wikijsBaseUrl, adminToken);

  // ---- Load existing keys (may already be provisioned) ----
  let keys: Record<string, Record<string, unknown>> = {};
  try {
    keys = JSON.parse(readFileSync(keysPath, "utf8")) as typeof keys;
  } catch {
    // File may not exist yet — that's fine.
  }

  const existing = keys[email];
  if (existing?.apiKey) {
    return existing.apiKey as string;
  }

  console.log(`[OAuth/provision] Provisioning Wiki.js key for ${email}`);

  // ---- Fetch all groups ----
  const groupsData = await gql<{
    groups: { list: Array<{ id: number; name: string; isSystem: boolean }> };
  }>(
    client,
    `{ groups { list { id name isSystem } } }`
  );
  const allGroups = groupsData.groups.list;
  const mcpGroupName = `mcp-${email}`;
  const existingMcpGroup = allGroups.find((g) => g.name === mcpGroupName);

  // ---- Find template group ----
  const templateGroup = allGroups.find((g) => g.name === templateGroupName);
  if (!templateGroup) {
    throw new Error(
      `[OAuth/provision] Template group "${templateGroupName}" not found in Wiki.js. ` +
        `Set WIKIJS_TEMPLATE_GROUP to an existing group name.`
    );
  }

  // ---- Fetch template group permissions ----
  const templateDetail = await gql<{
    groups: {
      single: {
        redirectOnLogin: string;
        permissions: string[];
        pageRules: Array<{
          id: string;
          deny: boolean;
          match: string;
          roles: string[];
          path: string;
          locales: string[];
        }>;
      };
    };
  }>(
    client,
    `{ groups { single(id: ${templateGroup.id}) {
        redirectOnLogin permissions
        pageRules { id deny match roles path locales }
      } } }`
  );
  const { permissions, pageRules, redirectOnLogin } =
    templateDetail.groups.single;

  // ---- Find Wiki.js user by email ----
  const usersData = await gql<{
    users: {
      search: Array<{ id: number; name: string; email: string; isActive: boolean }>;
    };
  }>(client, `{ users { search(query: ${JSON.stringify(email)}) { id name email isActive } } }`);

  const wikiUser = usersData.users.search.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
  if (!wikiUser) {
    throw new Error(
      `[OAuth/provision] User "${email}" not found in Wiki.js. ` +
        `The user must log in to Wiki.js at least once before OAuth provisioning.`
    );
  }
  if (!wikiUser.isActive) {
    throw new Error(`[OAuth/provision] Wiki.js account for "${email}" is inactive.`);
  }

  // ---- Create or reuse the mcp group ----
  let groupId: number;
  if (existingMcpGroup) {
    groupId = existingMcpGroup.id;
    console.log(
      `[OAuth/provision] Reusing existing group "${mcpGroupName}" (id: ${groupId})`
    );
  } else {
    const createResult = await gql<{
      groups: {
        create: {
          responseResult: { succeeded: boolean; message: string };
          group: { id: number };
        };
      };
    }>(
      client,
      `mutation { groups { create(name: ${JSON.stringify(mcpGroupName)}) {
          responseResult { succeeded message } group { id }
        } } }`
    );
    const cr = createResult.groups.create;
    if (!cr.responseResult.succeeded) {
      throw new Error(
        `[OAuth/provision] Failed to create group: ${cr.responseResult.message}`
      );
    }
    groupId = cr.group.id;
    console.log(`[OAuth/provision] Created group "${mcpGroupName}" (id: ${groupId})`);
  }

  // ---- Copy permissions from template ----
  // pageRules contains GraphQL enum values for `match` that must NOT be quoted.
  const pageRulesGql = JSON.stringify(pageRules)
    .replace(/"match":"([A-Z_]+)"/g, '"match":$1')
    // GraphQL input: remove quotes around enum values
    .replace(/"match":([A-Z_]+)/g, "match:$1");

  const updateResult = await gql<{
    groups: { update: { responseResult: { succeeded: boolean; message: string } } };
  }>(
    client,
    `mutation { groups { update(
        id: ${groupId}
        name: ${JSON.stringify(mcpGroupName)}
        redirectOnLogin: ${JSON.stringify(redirectOnLogin || "/")}
        permissions: ${JSON.stringify(permissions)}
        pageRules: ${pageRulesGql.replace(/^"/, "").replace(/"$/, "")}
      ) { responseResult { succeeded message } } } }`
  );
  if (!updateResult.groups.update.responseResult.succeeded) {
    console.warn(
      `[OAuth/provision] Could not copy permissions: ${updateResult.groups.update.responseResult.message}`
    );
    // Non-fatal — the group still works with default permissions.
  }

  // ---- Assign user to group ----
  await gql<unknown>(
    client,
    `mutation { groups { assignUser(groupId: ${groupId}, userId: ${wikiUser.id}) {
        responseResult { succeeded message }
      } } }`
  );

  // ---- Create API key ----
  const keyResult = await gql<{
    authentication: {
      createApiKey: {
        responseResult: { succeeded: boolean; message: string };
        key: string;
      };
    };
  }>(
    client,
    `mutation { authentication { createApiKey(
        name: ${JSON.stringify(`mcp-${displayName}`)}
        expiration: "${KEY_EXPIRATION}"
        fullAccess: false
        group: ${groupId}
      ) { responseResult { succeeded message } key } } }`
  );
  const kr = keyResult.authentication.createApiKey;
  if (!kr.responseResult.succeeded) {
    throw new Error(
      `[OAuth/provision] Failed to create API key: ${kr.responseResult.message}`
    );
  }

  const apiKey = kr.key;
  console.log(`[OAuth/provision] Created API key for ${email}`);

  // ---- Persist to mcp-keys.json ----
  keys[email] = {
    name: displayName,
    userId: wikiUser.id,
    groupId,
    groupName: mcpGroupName,
    apiKey,
    expiration: KEY_EXPIRATION,
  };
  mkdirSync(keysPath.replace(/\/[^/]+$/, ""), { recursive: true });
  writeFileSync(keysPath, JSON.stringify(keys, null, 2));
  invalidateMcpKeysCache();

  return apiKey;
}
