import fastify, { FastifyRequest } from "fastify";
import { WikiJsApi } from "./api.js";
import { wikiJsTools, WikiJsAPI } from "./tools.js";
import { ServerConfig } from "./types.js";
import { config as dotenvConfig } from "dotenv";
import { McpHandlers } from "./mcp/handlers.js";
import { JsonRpcRouter } from "./mcp/jsonrpc.js";
import { SSEManager } from "./mcp/sse.js";

// Load environment variables from .env file
dotenvConfig();

// Load configuration from environment variables
const config: ServerConfig = {
  port: parseInt(process.env.PORT || "8000"),
  wikijs: {
    baseUrl: process.env.WIKIJS_BASE_URL || "http://localhost:3000",
    token: process.env.WIKIJS_TOKEN || "",
  },
};

// Print current configuration for debugging
console.log("MCP server configuration:");
console.log(`PORT: ${config.port}`);
console.log(`WIKIJS_BASE_URL: ${config.wikijs.baseUrl}`);
console.log(`WIKIJS_TOKEN: ${config.wikijs.token.substring(0, 10)}...`);

// Create Fastify instance
const server = fastify({ logger: true });

// Create Wiki.js API instance
const wikiJsApi = new WikiJsApi(config.wikijs.baseUrl, config.wikijs.token);

// Wiki.js locale from env
const WIKIJS_LOCALE = process.env.WIKIJS_LOCALE || "en";

/**
 * Extract Bearer token from request.
 * Checks Authorization header first, then ?token= query parameter as fallback
 * (workaround for Claude Code header bug — see GitHub issues #14977, #7290).
 */
function extractToken(request: FastifyRequest): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  // 2. Query parameter fallback: ?token=<token>
  const query = request.query as Record<string, string>;
  if (query?.token) {
    return query.token;
  }
  return null;
}

/**
 * Create a per-request WikiJsAPI instance from the caller's token.
 */
function createUserApi(token: string): WikiJsAPI {
  return new WikiJsAPI(config.wikijs.baseUrl, token, WIKIJS_LOCALE);
}

// ---- MCP HTTP Protocol Setup ----
const mcpHandlers = new McpHandlers();
const sseManager = new SSEManager();
const jsonRpcRouter = new JsonRpcRouter(mcpHandlers, sseManager);

// CORS support for MCP endpoints
server.addHook("onRequest", async (request, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (request.method === "OPTIONS") {
    reply.code(204).send();
  }
});

// MCP JSON-RPC 2.0 endpoint (requires per-user auth)
server.post("/mcp", async (request, reply) => {
  const token = extractToken(request);
  if (!token) {
    reply.code(401).send({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32001, message: "Unauthorized: provide Authorization Bearer token or ?token= query parameter" },
    });
    return reply;
  }
  const userApi = createUserApi(token);
  await jsonRpcRouter.handle(request, reply, userApi);
});

// MCP Server-Sent Events endpoint (requires per-user auth)
server.get("/mcp/events", async (request, reply) => {
  const token = extractToken(request);
  if (!token) {
    reply.code(401).send({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32001, message: "Unauthorized: provide Authorization Bearer token or ?token= query parameter" },
    });
    return reply;
  }
  sseManager.handleConnection(request, reply);
  return reply;
});

// Root endpoint with server info
server.get("/", async () => {
  return {
    status: "ok",
    message: "Wiki.js MCP Server is running",
    version: "1.3.0",
    endpoints: {
      "/health": "Server health check",
      "/tools": "List available tools (legacy format)",
      "/mcp": "MCP JSON-RPC 2.0 endpoint",
      "/mcp/events": "MCP SSE notifications endpoint",
    },
  };
});

// Health check endpoint
server.get("/health", async () => {
  try {
    const isConnected = await wikiJsApi.checkConnection();
    return {
      status: isConnected ? "ok" : "error",
      message: isConnected
        ? "Connected to Wiki.js"
        : "Failed to connect to Wiki.js",
    };
  } catch (error) {
    return {
      status: "error",
      message: "Failed to connect to Wiki.js",
      error: String(error),
    };
  }
});

// Endpoint to list available tools
server.get("/tools", async () => {
  return wikiJsTools;
});

// Tool endpoints
// Get page by ID
server.get("/get_page", async (request) => {
  const { id } = request.query as { id: string };
  try {
    return await wikiJsApi.getPageById(parseInt(id));
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// Get page content
server.get("/get_page_content", async (request) => {
  const { id } = request.query as { id: string };
  try {
    return { content: await wikiJsApi.getPageContent(parseInt(id)) };
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// List pages
server.get("/list_pages", async (request) => {
  const { limit, orderBy } = request.query as {
    limit?: string;
    orderBy?: string;
  };
  try {
    return await wikiJsApi.getPagesList(
      limit ? parseInt(limit) : undefined,
      orderBy || undefined
    );
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// Search pages
server.get("/search_pages", async (request) => {
  const { query, limit } = request.query as { query: string; limit?: string };
  try {
    return await wikiJsApi.searchPages(
      query,
      limit ? parseInt(limit) : undefined
    );
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// Create page
server.post("/create_page", async (request) => {
  const { title, content, path, description } = request.body as {
    title: string;
    content: string;
    path: string;
    description?: string;
  };
  try {
    return await wikiJsApi.createPage(title, content, path, description);
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// Update page
server.post("/update_page", async (request) => {
  const { id, content } = request.body as { id: number; content: string };
  try {
    return await wikiJsApi.updatePage(id, content);
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// Delete page
server.post("/delete_page", async (request) => {
  const { id } = request.body as { id: number };
  try {
    return await wikiJsApi.deletePage(id);
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// List users
server.get("/list_users", async () => {
  try {
    return await wikiJsApi.getUsersList();
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// Search users
server.get("/search_users", async (request) => {
  const { query } = request.query as { query: string };
  try {
    return await wikiJsApi.searchUsers(query);
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// List groups
server.get("/list_groups", async () => {
  try {
    return await wikiJsApi.getGroupsList();
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// Create user
server.post("/create_user", async (request) => {
  const {
    email,
    name,
    passwordRaw,
    providerKey,
    groups,
    mustChangePassword,
    sendWelcomeEmail,
  } = request.body as {
    email: string;
    name: string;
    passwordRaw: string;
    providerKey?: string;
    groups?: number[];
    mustChangePassword?: boolean;
    sendWelcomeEmail?: boolean;
  };
  try {
    return await wikiJsApi.createUser(
      email,
      name,
      passwordRaw,
      providerKey,
      groups,
      mustChangePassword,
      sendWelcomeEmail
    );
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// Update user
server.post("/update_user", async (request) => {
  const { id, name } = request.body as { id: number; name: string };
  try {
    return await wikiJsApi.updateUser(id, name);
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// List all pages including unpublished
server.get("/list_all_pages", async (request) => {
  const { limit, orderBy, includeUnpublished } = request.query as {
    limit?: string;
    orderBy?: string;
    includeUnpublished?: string;
  };
  try {
    return await wikiJsApi.getAllPagesList(
      limit ? parseInt(limit) : undefined,
      orderBy || undefined,
      includeUnpublished !== "false"
    );
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// Search unpublished pages
server.get("/search_unpublished_pages", async (request) => {
  const { query, limit } = request.query as { query: string; limit?: string };
  try {
    return await wikiJsApi.searchUnpublishedPages(
      query,
      limit ? parseInt(limit) : undefined
    );
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// Force delete page
server.post("/force_delete_page", async (request) => {
  const { id } = request.body as { id: number };
  try {
    return await wikiJsApi.forceDeletePage(id);
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// Get page publication status
server.get("/get_page_status", async (request) => {
  const { id } = request.query as { id: string };
  try {
    return await wikiJsApi.getPageStatus(parseInt(id));
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// Publish page
server.post("/publish_page", async (request) => {
  const { id } = request.body as { id: number };
  try {
    return await wikiJsApi.publishPage(id);
  } catch (error) {
    server.log.error(error);
    return { error: String(error) };
  }
});

// Start the server
const start = async () => {
  try {
    // Check Wiki.js connection before starting the server
    const isConnected = await wikiJsApi.checkConnection();
    if (!isConnected) {
      console.warn(
        "Warning: Failed to connect to Wiki.js API. Server is running but functionality will be limited."
      );
    }

    await server.listen({ port: config.port, host: "0.0.0.0" });
    console.log(`Wiki.js MCP server started on port ${config.port}`);
    console.log(`MCP JSON-RPC endpoint: http://localhost:${config.port}/mcp`);
    console.log(`MCP SSE endpoint: http://localhost:${config.port}/mcp/events`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
