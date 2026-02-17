/**
 * MCP method handlers
 * Implements initialize, tools/list, tools/call and edge cases
 * Ported from lib/fixed_mcp_http_server.js
 */

import { wikiJsTools, wikiJsToolsWithImpl, WikiJsAPI, createToolImplementations } from "../tools.js";
import {
  safeValidateToolParams,
  safeValidateToolResult,
} from "../schemas.js";
import type {
  McpInitializeResult,
  McpToolsListResult,
  McpToolCallResult,
  McpInitializeParams,
  McpToolCallParams,
  ToolImplementation,
} from "./protocol.js";

// Default tools lookup map (used when no per-request API is provided)
const defaultToolsMap: Record<string, ToolImplementation> = {};
for (const tool of wikiJsToolsWithImpl) {
  defaultToolsMap[tool.function.name] = tool.implementation;
}

// Tool names for direct-call routing
const toolNames = wikiJsTools.map((t) => t.function.name);

// Tools that accept no required params (skip validation for empty args)
const NO_PARAMS_TOOLS = new Set(["list_users", "list_groups"]);

export class McpHandlers {
  /**
   * Handle MCP initialize handshake
   */
  handleInitialize(params?: McpInitializeParams): McpInitializeResult {
    return {
      protocolVersion: params?.protocolVersion || "2024-11-05",
      capabilities: {
        tools: { enabled: true },
        prompts: { enabled: false },
        resources: { enabled: false },
        logging: { enabled: true },
        roots: { listChanged: false },
      },
      serverInfo: {
        name: "wikijs-mcp",
        version: "1.3.0",
      },
    };
  }

  /**
   * Handle tools/list - returns all tools in MCP format
   */
  handleToolsList(): McpToolsListResult {
    const tools = wikiJsTools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      inputSchema: tool.function.parameters,
      outputSchema: { type: "object" as const },
      metadata: {
        title: tool.function.name
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        description: tool.function.description,
        ui: {
          icon: "document",
          ui_type: "default",
        },
      },
    }));

    return { tools };
  }

  /**
   * Handle tools/call - execute a tool by name
   * Ported edge cases: search_users q->query, no-params tools bypass
   * @param params - tool call parameters (name + arguments)
   * @param api - optional per-request WikiJsAPI instance (for per-user auth)
   */
  async handleToolCall(params: McpToolCallParams, api?: WikiJsAPI): Promise<McpToolCallResult> {
    const toolName = params.name;
    let args = { ...(params.arguments || {}) };

    console.log(
      `[MCP] tools/call: ${toolName} with params: ${JSON.stringify(args)}`
    );

    // Edge case from JS version: Cursor sends 'q' instead of 'query' for search_users
    if (
      toolName === "search_users" &&
      (args as any).q &&
      !(args as any).query
    ) {
      console.log(`[MCP] Remapping param q -> query for search_users`);
      (args as any).query = (args as any).q;
      delete (args as any).q;
    }

    // Build per-request implementations if a custom API instance is provided,
    // otherwise fall back to the default (server-wide) tools map
    const toolsMap = api
      ? createToolImplementations(api)
      : defaultToolsMap;

    // Find implementation
    const implementation = toolsMap[toolName];
    if (!implementation) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Validate params (skip for no-params tools like list_users, list_groups)
    let validatedParams = args;
    if (!NO_PARAMS_TOOLS.has(toolName)) {
      const validation = safeValidateToolParams(toolName, args);
      if (validation.success === false) {
        const errorDetail =
          typeof validation.error === "object" && "format" in validation.error
            ? (validation.error as any).format()
            : validation.error;
        throw Object.assign(
          new Error(`Invalid params for ${toolName}`),
          { code: -32602, data: errorDetail }
        );
      }
      if (validation.success && "data" in validation) {
        validatedParams = validation.data;
      }
    }

    // Execute
    const result = await implementation(validatedParams);

    // Validate result (warning only, don't block)
    const resultValidation = safeValidateToolResult(toolName, result);
    if (resultValidation.success === false) {
      console.warn(
        `[MCP] Result validation warning for ${toolName}: ${JSON.stringify(
          resultValidation.error
        )}`
      );
    }

    console.log(`[MCP] Tool ${toolName} executed successfully`);

    // Format as MCP content
    return {
      content: [
        {
          type: "text",
          text:
            typeof result === "string"
              ? result
              : JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Check if a method name is a direct tool name (e.g., "get_page" sent as method)
   */
  isDirectToolCall(method: string): boolean {
    return toolNames.includes(method);
  }
}
