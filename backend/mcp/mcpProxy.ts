import { MCPClientManager, MCPClient } from './mcpClient'
import { MCPResourceProvider, MCPToolProvider, MCPPromptProvider } from './mcpServer'
import { MCPResource, MCPTool, MCPPrompt } from './mcpTypes'
import { prisma } from '../prismaClient'

export interface MCPProxyOptions {
  userId: number
  clientManager: MCPClientManager
}

// Resource provider that aggregates resources from all configured MCP servers
export class MCPProxyResourceProvider implements MCPResourceProvider {
  private userId: number
  private clientManager: MCPClientManager

  constructor(options: MCPProxyOptions) {
    this.userId = options.userId
    this.clientManager = options.clientManager
  }

  async listResources(): Promise<MCPResource[]> {
    const allResources: MCPResource[] = []

    // Get user's configured MCP servers
    const servers = await prisma.mCPServerModel.findMany({
      where: { 
        userId: this.userId,
        status: 'connected'
      }
    })

    // Fetch resources from each connected server
    for (const server of servers) {
      const client = this.clientManager.getClient(server.id)
      if (client && client.isConnected() && client.isInitialized()) {
        try {
          const result = await client.listResources()
          
          // Prefix resources with server name to avoid conflicts
          const prefixedResources = result.resources.map(resource => ({
            ...resource,
            uri: `mcp://${server.name}/${resource.uri}`,
            name: `[${server.name}] ${resource.name}`
          }))
          
          allResources.push(...prefixedResources)
        } catch (error) {
          console.error(`Error fetching resources from MCP server ${server.name}:`, error)
        }
      }
    }

    return allResources
  }

  async readResource(uri: string): Promise<{ contents: any[] }> {
    // Parse MCP URI: mcp://{serverName}/{originalUri}
    const match = uri.match(/^mcp:\/\/([^\/]+)\/(.+)$/)
    if (!match) {
      throw new Error(`Invalid MCP URI: ${uri}`)
    }

    const [, serverName, originalUri] = match
    
    if (!originalUri) {
      throw new Error(`Invalid MCP URI format: ${uri}`)
    }

    // Find the server by name
    const server = await prisma.mCPServerModel.findFirst({
      where: {
        userId: this.userId,
        name: serverName,
        status: 'connected'
      }
    })

    if (!server) {
      throw new Error(`MCP server not found or not connected: ${serverName}`)
    }

    const client = this.clientManager.getClient(server.id)
    if (!client || !client.isConnected() || !client.isInitialized()) {
      throw new Error(`MCP server not available: ${serverName}`)
    }

    return await client.readResource(originalUri)
  }
}

// Tool provider that aggregates tools from all configured MCP servers
export class MCPProxyToolProvider implements MCPToolProvider {
  private userId: number
  private clientManager: MCPClientManager

  constructor(options: MCPProxyOptions) {
    this.userId = options.userId
    this.clientManager = options.clientManager
  }

  async listTools(): Promise<MCPTool[]> {
    const allTools: MCPTool[] = []

    const servers = await prisma.mCPServerModel.findMany({
      where: { 
        userId: this.userId,
        status: 'connected'
      }
    })

    for (const server of servers) {
      const client = this.clientManager.getClient(server.id)
      if (client && client.isConnected() && client.isInitialized()) {
        try {
          const result = await client.listTools()
          
          // Prefix tool names with server name to avoid conflicts
          const prefixedTools = result.tools.map(tool => ({
            ...tool,
            name: `${server.name}_${tool.name}`,
            description: `[${server.name}] ${tool.description || tool.name}`
          }))
          
          allTools.push(...prefixedTools)
        } catch (error) {
          console.error(`Error fetching tools from MCP server ${server.name}:`, error)
        }
      }
    }

    return allTools
  }

  async callTool(name: string, args?: any): Promise<{ content: any[] }> {
    // Parse tool name: {serverName}_{originalToolName}
    const underscoreIndex = name.indexOf('_')
    if (underscoreIndex === -1) {
      throw new Error(`Invalid tool name format: ${name}`)
    }

    const serverName = name.substring(0, underscoreIndex)
    const originalToolName = name.substring(underscoreIndex + 1)

    const server = await prisma.mCPServerModel.findFirst({
      where: {
        userId: this.userId,
        name: serverName,
        status: 'connected'
      }
    })

    if (!server) {
      throw new Error(`MCP server not found or not connected: ${serverName}`)
    }

    const client = this.clientManager.getClient(server.id)
    if (!client || !client.isConnected() || !client.isInitialized()) {
      throw new Error(`MCP server not available: ${serverName}`)
    }

    return await client.callTool(originalToolName, args)
  }
}

// Prompt provider that aggregates prompts from all configured MCP servers
export class MCPProxyPromptProvider implements MCPPromptProvider {
  private userId: number
  private clientManager: MCPClientManager

  constructor(options: MCPProxyOptions) {
    this.userId = options.userId
    this.clientManager = options.clientManager
  }

  async listPrompts(): Promise<MCPPrompt[]> {
    const allPrompts: MCPPrompt[] = []

    const servers = await prisma.mCPServerModel.findMany({
      where: { 
        userId: this.userId,
        status: 'connected'
      }
    })

    for (const server of servers) {
      const client = this.clientManager.getClient(server.id)
      if (client && client.isConnected() && client.isInitialized()) {
        try {
          const result = await client.listPrompts()
          
          // Prefix prompt names with server name to avoid conflicts
          const prefixedPrompts = result.prompts.map(prompt => ({
            ...prompt,
            name: `${server.name}_${prompt.name}`,
            description: `[${server.name}] ${prompt.description || prompt.name}`
          }))
          
          allPrompts.push(...prefixedPrompts)
        } catch (error) {
          console.error(`Error fetching prompts from MCP server ${server.name}:`, error)
        }
      }
    }

    return allPrompts
  }

  async getPrompt(name: string, args?: any): Promise<{ description?: string; messages: any[] }> {
    // Parse prompt name: {serverName}_{originalPromptName}
    const underscoreIndex = name.indexOf('_')
    if (underscoreIndex === -1) {
      throw new Error(`Invalid prompt name format: ${name}`)
    }

    const serverName = name.substring(0, underscoreIndex)
    const originalPromptName = name.substring(underscoreIndex + 1)

    const server = await prisma.mCPServerModel.findFirst({
      where: {
        userId: this.userId,
        name: serverName,
        status: 'connected'
      }
    })

    if (!server) {
      throw new Error(`MCP server not found or not connected: ${serverName}`)
    }

    const client = this.clientManager.getClient(server.id)
    if (!client || !client.isConnected() || !client.isInitialized()) {
      throw new Error(`MCP server not available: ${serverName}`)
    }

    return await client.getPrompt(originalPromptName, args)
  }
}

// Main MCP Proxy class that manages connections and provides unified interface
export class MCPProxy {
  private clientManager: MCPClientManager
  private userProxies = new Map<number, {
    resourceProvider: MCPProxyResourceProvider
    toolProvider: MCPProxyToolProvider
    promptProvider: MCPProxyPromptProvider
  }>()

  constructor() {
    this.clientManager = new MCPClientManager()
  }

  // Get or create proxy providers for a user
  getProxyProviders(userId: number) {
    if (!this.userProxies.has(userId)) {
      const options = { userId, clientManager: this.clientManager }
      this.userProxies.set(userId, {
        resourceProvider: new MCPProxyResourceProvider(options),
        toolProvider: new MCPProxyToolProvider(options),
        promptProvider: new MCPProxyPromptProvider(options)
      })
    }

    return this.userProxies.get(userId)!
  }

  // Connect to all configured servers for a user
  async connectUserServers(userId: number): Promise<void> {
    const servers = await prisma.mCPServerModel.findMany({
      where: { userId }
    })

    const connectionPromises = servers.map(async (server) => {
      try {
        await this.clientManager.connectToServer(
          server.id,
          server.endpoint,
          server.credentials as Record<string, any>
        )

        // Update server status to connected
        await prisma.mCPServerModel.update({
          where: { id: server.id },
          data: { 
            status: 'connected',
            lastPing: new Date()
          }
        })

        console.log(`Connected to MCP server: ${server.name}`)
      } catch (error) {
        console.error(`Failed to connect to MCP server ${server.name}:`, error)
        
        // Update server status to error
        await prisma.mCPServerModel.update({
          where: { id: server.id },
          data: { status: 'error' }
        })
      }
    })

    await Promise.all(connectionPromises)
  }

  // Disconnect all servers for a user
  async disconnectUserServers(userId: number): Promise<void> {
    const servers = await prisma.mCPServerModel.findMany({
      where: { userId }
    })

    const disconnectionPromises = servers.map(async (server) => {
      await this.clientManager.disconnectFromServer(server.id)
      
      // Update server status to disconnected
      await prisma.mCPServerModel.update({
        where: { id: server.id },
        data: { status: 'disconnected' }
      })
    })

    await Promise.all(disconnectionPromises)
    this.userProxies.delete(userId)
  }

  // Test connection to a specific server
  async testServerConnection(serverId: number): Promise<boolean> {
    const server = await prisma.mCPServerModel.findUnique({
      where: { id: serverId }
    })

    if (!server) {
      throw new Error('Server not found')
    }

    try {
      const client = await this.clientManager.connectToServer(
        serverId,
        server.endpoint,
        server.credentials as Record<string, any>
      )

      await client.ping()
      return true
    } catch (error) {
      console.error(`Failed to test MCP server ${server.name}:`, error)
      return false
    }
  }

  // Cleanup all connections
  async cleanup(): Promise<void> {
    await this.clientManager.disconnectAll()
    this.userProxies.clear()
  }

  // Get client manager for direct access
  getClientManager(): MCPClientManager {
    return this.clientManager
  }
}