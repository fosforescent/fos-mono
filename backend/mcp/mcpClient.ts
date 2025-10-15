import { WebSocket } from 'ws'
import { EventEmitter } from 'events'
import {
  JsonRpcRequest,
  JsonRpcResponse,
  MCPInitializeRequest,
  MCPInitializeResult,
  MCPResource,
  MCPTool,
  MCPPrompt,
  MCP_METHODS,
  MCP_ERROR_CODES
} from './mcpTypes'

export interface MCPClientOptions {
  endpoint: string
  credentials?: Record<string, any>
  timeout?: number
}

export class MCPClient extends EventEmitter {
  private ws: WebSocket | null = null
  private endpoint: string
  private credentials: Record<string, any>
  private timeout: number
  private initialized: boolean = false
  private pendingRequests = new Map<string | number, {
    resolve: (value: any) => void
    reject: (error: any) => void
    timer: NodeJS.Timeout
  }>()
  private requestId = 0

  constructor(options: MCPClientOptions) {
    super()
    this.endpoint = options.endpoint
    this.credentials = options.credentials || {}
    this.timeout = options.timeout || 30000
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.endpoint)

        this.ws.on('open', () => {
          console.log(`MCP Client connected to ${this.endpoint}`)
          this.emit('connected')
          resolve()
        })

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data.toString())
        })

        this.ws.on('close', () => {
          console.log(`MCP Client disconnected from ${this.endpoint}`)
          this.initialized = false
          this.emit('disconnected')
          this.cleanup()
        })

        this.ws.on('error', (error) => {
          console.error(`MCP Client error for ${this.endpoint}:`, error)
          this.emit('error', error)
          reject(error)
        })

      } catch (error) {
        reject(error)
      }
    })
  }

  async initialize(): Promise<MCPInitializeResult> {
    if (this.initialized) {
      throw new Error('Client already initialized')
    }

    const initRequest: MCPInitializeRequest = {
      protocolVersion: '2024-11-05',
      capabilities: {
        resources: { subscribe: true, listChanged: true },
        tools: { listChanged: true },
        prompts: { listChanged: true },
        logging: {}
      },
      clientInfo: {
        name: 'Fosforescent MCP Client',
        version: '1.0.0'
      }
    }

    const result = await this.sendRequest(MCP_METHODS.INITIALIZE, initRequest)
    this.initialized = true
    return result
  }

  async ping(): Promise<void> {
    await this.sendRequest(MCP_METHODS.PING)
  }

  async listResources(): Promise<{ resources: MCPResource[] }> {
    return await this.sendRequest(MCP_METHODS.LIST_RESOURCES)
  }

  async readResource(uri: string): Promise<{ contents: any[] }> {
    return await this.sendRequest(MCP_METHODS.READ_RESOURCE, { uri })
  }

  async listTools(): Promise<{ tools: MCPTool[] }> {
    return await this.sendRequest(MCP_METHODS.LIST_TOOLS)
  }

  async callTool(name: string, args?: any): Promise<{ content: any[] }> {
    return await this.sendRequest(MCP_METHODS.CALL_TOOL, { name, arguments: args })
  }

  async listPrompts(): Promise<{ prompts: MCPPrompt[] }> {
    return await this.sendRequest(MCP_METHODS.LIST_PROMPTS)
  }

  async getPrompt(name: string, args?: any): Promise<{ description?: string; messages: any[] }> {
    return await this.sendRequest(MCP_METHODS.GET_PROMPT, { name, arguments: args })
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }

    const id = ++this.requestId
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request timeout for method: ${method}`))
      }, this.timeout)

      this.pendingRequests.set(id, { resolve, reject, timer })

      try {
        this.ws!.send(JSON.stringify(request))
      } catch (error) {
        this.pendingRequests.delete(id)
        clearTimeout(timer)
        reject(error)
      }
    })
  }

  private handleMessage(message: string) {
    try {
      const parsed = JSON.parse(message)

      // Handle notifications
      if (!parsed.id) {
        this.emit('notification', parsed)
        return
      }

      // Handle responses
      const response = parsed as JsonRpcResponse
      const pending = this.pendingRequests.get(response.id)
      
      if (pending) {
        this.pendingRequests.delete(response.id)
        clearTimeout(pending.timer)

        if (response.error) {
          pending.reject(new Error(`MCP Error ${response.error.code}: ${response.error.message}`))
        } else {
          pending.resolve(response.result)
        }
      }

    } catch (error) {
      console.error('Error parsing MCP message:', error)
    }
  }

  private cleanup() {
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Connection closed'))
    }
    this.pendingRequests.clear()
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.initialized = false
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  isInitialized(): boolean {
    return this.initialized
  }
}

// MCP Client Manager to handle multiple server connections
export class MCPClientManager {
  private clients = new Map<number, MCPClient>()

  async connectToServer(serverId: number, endpoint: string, credentials?: Record<string, any>): Promise<MCPClient> {
    // Disconnect existing client if any
    await this.disconnectFromServer(serverId)

    const client = new MCPClient({ endpoint, credentials })
    
    try {
      await client.connect()
      await client.initialize()
      
      this.clients.set(serverId, client)
      
      // Handle disconnections
      client.on('disconnected', () => {
        this.clients.delete(serverId)
      })

      return client
    } catch (error) {
      await client.disconnect()
      throw error
    }
  }

  async disconnectFromServer(serverId: number): Promise<void> {
    const client = this.clients.get(serverId)
    if (client) {
      await client.disconnect()
      this.clients.delete(serverId)
    }
  }

  getClient(serverId: number): MCPClient | undefined {
    return this.clients.get(serverId)
  }

  getAllClients(): Map<number, MCPClient> {
    return new Map(this.clients)
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.values()).map(client => 
      client.disconnect().catch(console.error)
    )
    
    await Promise.all(disconnectPromises)
    this.clients.clear()
  }
}