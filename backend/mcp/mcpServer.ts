import { EventEmitter } from 'events'
import { WebSocket } from 'ws'
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  MCPCapabilities,
  MCPInitializeRequest,
  MCPInitializeResult,
  MCPResource,
  MCPTool,
  MCPPrompt,
  MCPMessage,
  MCP_METHODS,
  MCP_ERROR_CODES
} from './mcpTypes'

export interface MCPServerOptions {
  name: string
  version: string
  capabilities?: MCPCapabilities
}

export interface MCPResourceProvider {
  listResources(): Promise<MCPResource[]>
  readResource(uri: string): Promise<{ contents: any[] }>
}

export interface MCPToolProvider {
  listTools(): Promise<MCPTool[]>
  callTool(name: string, args?: any): Promise<{ content: any[] }>
}

export interface MCPPromptProvider {
  listPrompts(): Promise<MCPPrompt[]>
  getPrompt(name: string, args?: any): Promise<{ description?: string; messages: MCPMessage[] }>
}

export class MCPServerInstance extends EventEmitter {
  private name: string
  private version: string
  private capabilities: MCPCapabilities
  private initialized: boolean = false
  private resources: MCPResourceProvider[] = []
  private tools: MCPToolProvider[] = []
  private prompts: MCPPromptProvider[] = []

  constructor(options: MCPServerOptions) {
    super()
    this.name = options.name
    this.version = options.version
    this.capabilities = options.capabilities || {
      resources: { subscribe: true, listChanged: true },
      tools: { listChanged: true },
      prompts: { listChanged: true },
      logging: {}
    }
  }

  // Add providers
  addResourceProvider(provider: MCPResourceProvider) {
    this.resources.push(provider)
  }

  addToolProvider(provider: MCPToolProvider) {
    this.tools.push(provider)
  }

  addPromptProvider(provider: MCPPromptProvider) {
    this.prompts.push(provider)
  }

  // Get the first tool provider (for user context setting)
  getToolProvider(): MCPToolProvider | undefined {
    return this.tools[0]
  }

  // Handle incoming JSON-RPC messages
  async handleMessage(message: string): Promise<string | null> {
    try {
      const parsed = JSON.parse(message)
      
      // Handle notifications (no response needed)
      if (!parsed.id) {
        await this.handleNotification(parsed as JsonRpcNotification)
        return null
      }

      // Handle requests
      const request = parsed as JsonRpcRequest
      const response = await this.handleRequest(request)
      return JSON.stringify(response)

    } catch (error) {
      console.error('MCP Server: Error handling message:', error)
      return JSON.stringify({
        jsonrpc: '2.0',
        id: 0,
        error: {
          code: MCP_ERROR_CODES.PARSE_ERROR,
          message: 'Parse error'
        }
      } as JsonRpcResponse)
    }
  }

  private async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      let result: any

      switch (request.method) {
        case MCP_METHODS.INITIALIZE:
          result = await this.handleInitialize(request.params as MCPInitializeRequest)
          break

        case MCP_METHODS.PING:
          result = {}
          break

        case MCP_METHODS.LIST_RESOURCES:
          result = await this.handleListResources()
          break

        case MCP_METHODS.READ_RESOURCE:
          result = await this.handleReadResource(request.params)
          break

        case MCP_METHODS.LIST_TOOLS:
          result = await this.handleListTools()
          break

        case MCP_METHODS.CALL_TOOL:
          result = await this.handleCallTool(request.params)
          break

        case MCP_METHODS.LIST_PROMPTS:
          result = await this.handleListPrompts()
          break

        case MCP_METHODS.GET_PROMPT:
          result = await this.handleGetPrompt(request.params)
          break

        default:
          throw {
            code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
            message: `Method '${request.method}' not found`
          }
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      }

    } catch (error: any) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: error.code || MCP_ERROR_CODES.INTERNAL_ERROR,
          message: error.message || 'Internal error',
          data: error.data
        }
      }
    }
  }

  private async handleNotification(notification: JsonRpcNotification) {
    console.log(`MCP Server: Received notification: ${notification.method}`)
    // Handle notifications like progress updates, cancellations, etc.
  }

  private async handleInitialize(params: MCPInitializeRequest): Promise<MCPInitializeResult> {
    this.initialized = true
    
    return {
      protocolVersion: '2024-11-05',
      capabilities: this.capabilities,
      serverInfo: {
        name: this.name,
        version: this.version
      }
    }
  }

  private async handleListResources() {
    const allResources: MCPResource[] = []
    
    for (const provider of this.resources) {
      const resources = await provider.listResources()
      allResources.push(...resources)
    }

    return { resources: allResources }
  }

  private async handleReadResource(params: { uri: string }) {
    if (!params.uri) {
      throw {
        code: MCP_ERROR_CODES.INVALID_PARAMS,
        message: 'Missing required parameter: uri'
      }
    }

    for (const provider of this.resources) {
      try {
        const result = await provider.readResource(params.uri)
        return result
      } catch (error) {
        // Continue to next provider
        continue
      }
    }

    throw {
      code: MCP_ERROR_CODES.INVALID_PARAMS,
      message: `Resource not found: ${params.uri}`
    }
  }

  private async handleListTools() {
    const allTools: MCPTool[] = []
    
    for (const provider of this.tools) {
      const tools = await provider.listTools()
      allTools.push(...tools)
    }

    return { tools: allTools }
  }

  private async handleCallTool(params: { name: string; arguments?: any }) {
    if (!params.name) {
      throw {
        code: MCP_ERROR_CODES.INVALID_PARAMS,
        message: 'Missing required parameter: name'
      }
    }

    for (const provider of this.tools) {
      try {
        const result = await provider.callTool(params.name, params.arguments)
        return result
      } catch (error) {
        // Continue to next provider
        continue
      }
    }

    throw {
      code: MCP_ERROR_CODES.INVALID_PARAMS,
      message: `Tool not found: ${params.name}`
    }
  }

  private async handleListPrompts() {
    const allPrompts: MCPPrompt[] = []
    
    for (const provider of this.prompts) {
      const prompts = await provider.listPrompts()
      allPrompts.push(...prompts)
    }

    return { prompts: allPrompts }
  }

  private async handleGetPrompt(params: { name: string; arguments?: any }) {
    if (!params.name) {
      throw {
        code: MCP_ERROR_CODES.INVALID_PARAMS,
        message: 'Missing required parameter: name'
      }
    }

    for (const provider of this.prompts) {
      try {
        const result = await provider.getPrompt(params.name, params.arguments)
        return result
      } catch (error) {
        // Continue to next provider
        continue
      }
    }

    throw {
      code: MCP_ERROR_CODES.INVALID_PARAMS,
      message: `Prompt not found: ${params.name}`
    }
  }

  // Notify clients of changes
  notifyResourcesChanged() {
    this.emit('notification', {
      jsonrpc: '2.0',
      method: 'notifications/resources/list_changed'
    })
  }

  notifyToolsChanged() {
    this.emit('notification', {
      jsonrpc: '2.0',
      method: 'notifications/tools/list_changed'
    })
  }

  notifyPromptsChanged() {
    this.emit('notification', {
      jsonrpc: '2.0',
      method: 'notifications/prompts/list_changed'
    })
  }
}