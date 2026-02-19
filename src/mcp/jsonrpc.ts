/**
 * JSON-RPC 2.0 request router for MCP HTTP transport
 * Validates incoming requests and routes to appropriate MCP handlers
 * Ported from lib/fixed_mcp_http_server.js
 */

import { FastifyRequest, FastifyReply } from "fastify";
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JSON_RPC_ERRORS,
} from "./protocol.js";
import { McpHandlers } from "./handlers.js";
import { SSEManager } from "./sse.js";
import { WikiJsAPI } from "../tools.js";

export class JsonRpcRouter {
  private handlers: McpHandlers;
  private sse: SSEManager;

  constructor(handlers: McpHandlers, sse: SSEManager) {
    this.handlers = handlers;
    this.sse = sse;
  }

  /**
   * Handle incoming POST /mcp request
   * @param api - optional per-request WikiJsAPI instance (for per-user auth)
   */
  async handle(
    request: FastifyRequest,
    reply: FastifyReply,
    api?: WikiJsAPI
  ): Promise<JsonRpcResponse> {
    let parsedBody: JsonRpcRequest;

    try {
      parsedBody = request.body as JsonRpcRequest;
    } catch {
      return this.errorResponse(
        reply,
        JSON_RPC_ERRORS.PARSE_ERROR,
        "Parse error",
        null
      );
    }

    console.log(
      `[JSON-RPC] ${parsedBody.method} (id: ${parsedBody.id ?? "notification"})`
    );

    // Validate JSON-RPC 2.0 format
    if (parsedBody.jsonrpc !== "2.0") {
      return this.errorResponse(
        reply,
        JSON_RPC_ERRORS.INVALID_REQUEST,
        "Invalid Request: jsonrpc must be '2.0'",
        parsedBody.id ?? null
      );
    }

    // JSON-RPC notifications have no `id` — must NOT receive any response per spec
    if (!("id" in parsedBody)) {
      console.log(`[JSON-RPC] Notification ${parsedBody.method} — no response sent`);
      reply.code(200).send({});
      return {} as JsonRpcResponse;
    }

    try {
      const result = await this.route(parsedBody.method, parsedBody.params, api);
      return this.successResponse(reply, result, parsedBody.id ?? null);
    } catch (error: any) {
      const code = error.code || JSON_RPC_ERRORS.INTERNAL_ERROR;
      const message = error.message || "Internal error";
      const data = error.data || undefined;

      console.error(`[JSON-RPC] Error in ${parsedBody.method}: ${message}`);

      // Broadcast error via SSE
      this.sse.broadcast("tool_error", {
        method: parsedBody.method,
        error: message,
      });

      return this.errorResponse(
        reply,
        code,
        message,
        parsedBody.id ?? null,
        data
      );
    }
  }

  /**
   * Route method to appropriate handler
   * Supports: initialize, tools/list, tools/call, ping,
   *   workspace/tools, workspace/executeCommand, tools/execute,
   *   and direct tool calls by name
   */
  private async route(method: string, params?: Record<string, any>, api?: WikiJsAPI): Promise<any> {
    switch (method) {
      case "initialize":
        return this.handlers.handleInitialize(params as any);

      case "tools/list":
      case "workspace/tools":
        return this.handlers.handleToolsList();

      case "tools/call": {
        const result = await this.handlers.handleToolCall({
          name: params?.name,
          arguments: params?.arguments || {},
        }, api);
        this.sse.broadcast("tool_executed", {
          tool: params?.name,
          status: "success",
        });
        return result;
      }

      // Legacy Cursor methods
      case "tools/execute":
      case "workspace/executeCommand": {
        const toolName = params?.command || params?.name;
        const toolArgs = params?.arguments || params?.params || {};
        const result = await this.handlers.handleToolCall({
          name: toolName,
          arguments: toolArgs,
        }, api);
        this.sse.broadcast("command_executed", {
          tool: toolName,
          status: "success",
        });
        return result;
      }

      case "ping":
        return {};

      // Claude Desktop sends these even when capabilities declare them disabled.
      // Return empty lists rather than Method Not Found errors.
      case "resources/list":
        return { resources: [] };

      case "prompts/list":
        return { prompts: [] };

      case "logging/setLevel":
        return {};

      default:
        // Direct tool call by method name (e.g., method: "get_page")
        if (this.handlers.isDirectToolCall(method)) {
          const result = await this.handlers.handleToolCall({
            name: method,
            arguments: params || {},
          }, api);
          this.sse.broadcast("tool_executed", {
            tool: method,
            status: "success",
          });
          return result;
        }

        throw Object.assign(
          new Error(`Method not found: ${method}`),
          { code: JSON_RPC_ERRORS.METHOD_NOT_FOUND }
        );
    }
  }

  private successResponse(
    reply: FastifyReply,
    result: any,
    id: string | number | null
  ): JsonRpcResponse {
    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      id: id,
      result,
    };
    reply.send(response);
    return response;
  }

  private errorResponse(
    reply: FastifyReply,
    code: number,
    message: string,
    id: string | number | null,
    data?: any
  ): JsonRpcResponse {
    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      id: id,
      error: { code, message, ...(data !== undefined && { data }) },
    };
    reply.send(response);
    return response;
  }
}
