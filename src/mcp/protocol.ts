/**
 * MCP Protocol type definitions
 * JSON-RPC 2.0 + MCP-specific types for HTTP transport
 */

// ---- JSON-RPC 2.0 ----

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, any>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: any;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

// Standard JSON-RPC 2.0 error codes
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// ---- MCP Protocol ----

export interface McpInitializeParams {
  protocolVersion: string;
  capabilities: Record<string, any>;
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: {
    tools: { enabled: boolean };
    prompts: { enabled: boolean };
    resources: { enabled: boolean };
    logging: { enabled: boolean };
    roots?: { listChanged: boolean };
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  outputSchema?: Record<string, any>;
  metadata?: {
    title: string;
    description: string;
    ui: Record<string, any>;
  };
}

export interface McpToolsListResult {
  tools: McpTool[];
}

export interface McpToolCallParams {
  name: string;
  arguments?: Record<string, any>;
}

export interface McpToolCallResult {
  content: McpToolContent[];
  isError?: boolean;
}

export interface McpToolContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
}

// ---- Tool execution types ----

export type ToolImplementation = (params: any) => Promise<any>;

export interface ToolWithImpl {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
  implementation: ToolImplementation;
}
