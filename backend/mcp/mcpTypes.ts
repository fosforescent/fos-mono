// MCP Protocol Types based on the Model Context Protocol specification

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: any
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: any
  error?: JsonRpcError
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: any
}

export interface JsonRpcError {
  code: number
  message: string
  data?: any
}

export interface MCPCapabilities {
  resources?: {
    subscribe?: boolean
    listChanged?: boolean
  }
  tools?: {
    listChanged?: boolean
  }
  prompts?: {
    listChanged?: boolean
  }
  logging?: {}
}

export interface MCPInitializeRequest {
  protocolVersion: string
  capabilities: MCPCapabilities
  clientInfo: {
    name: string
    version: string
  }
}

export interface MCPInitializeResult {
  protocolVersion: string
  capabilities: MCPCapabilities
  serverInfo: {
    name: string
    version: string
  }
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPTool {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, any>
    required?: string[]
  }
}

export interface MCPPrompt {
  name: string
  description?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

export interface MCPContent {
  type: 'text' | 'image' | 'resource'
  text?: string
  data?: string
  mimeType?: string
}

export interface MCPMessage {
  role: 'user' | 'assistant'
  content: MCPContent
}

// Standard MCP method names
export const MCP_METHODS = {
  INITIALIZE: 'initialize',
  PING: 'ping',
  LIST_RESOURCES: 'resources/list',
  READ_RESOURCE: 'resources/read',
  LIST_TOOLS: 'tools/list',
  CALL_TOOL: 'tools/call',
  LIST_PROMPTS: 'prompts/list',
  GET_PROMPT: 'prompts/get',
  COMPLETE: 'completion/complete',
  LOGGING_SET_LEVEL: 'logging/setLevel'
} as const

// Error codes based on JSON-RPC 2.0 and MCP extensions
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_START: -32000,
  SERVER_ERROR_END: -32099
} as const