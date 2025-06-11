import { Request, Response, NextFunction } from 'express'
import { WebSocket, WebSocketServer } from 'ws'
import { Server as HttpServer } from 'http'
import { MCPServerInstance, MCPResourceProvider, MCPToolProvider, MCPPromptProvider } from './mcpServer'
import { MCPTool } from './mcpTypes'
import { prisma } from '../prismaClient'
import { notifyUserOfPrompt } from '../promptNotifications'
import { tokenManager } from '../tokenManager'
import { toolBidManager } from '../toolBidManager'
import { getUserId } from '../apiTokenAuth'

export interface MCPMiddlewareOptions {
  path?: string
  serverName?: string
  serverVersion?: string
}

export class MCPExpressMiddleware {
  private mcpServer: MCPServerInstance
  private wss: WebSocketServer | null = null
  private connections = new Set<WebSocket>()

  constructor(options: MCPMiddlewareOptions = {}) {
    this.mcpServer = new MCPServerInstance({
      name: options.serverName || 'Fosforescent MCP Server',
      version: options.serverVersion || '1.0.0',
      capabilities: {
        resources: { subscribe: true, listChanged: true },
        tools: { listChanged: true },
        prompts: { listChanged: true },
        logging: {}
      }
    })

    this.setupDefaultProviders()
  }

  // Setup default providers for Fosforescent functionality
  private setupDefaultProviders() {
    // Add a basic resource provider for user data
    this.mcpServer.addResourceProvider(new FosResourceProvider())

    // Add tool providers for common operations
    this.mcpServer.addToolProvider(new FosToolProvider())

    // Add prompt providers
    this.mcpServer.addPromptProvider(new FosPromptProvider())
  }

  // Attach WebSocket server for MCP connections
  attachToServer(httpServer: HttpServer, path: string = '/mcp') {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: path
    })

    this.wss.on('connection', (ws: WebSocket, request) => {
      console.log('MCP Client connected')
      this.connections.add(ws)

      ws.on('message', async (data: Buffer) => {
        try {
          const message = data.toString()
          console.log('MCP Received:', message)

          const response = await this.mcpServer.handleMessage(message)
          if (response) {
            ws.send(response)
            console.log('MCP Sent:', response)
          }
        } catch (error) {
          console.error('MCP Error handling message:', error)
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32603,
              message: 'Internal error'
            }
          }))
        }
      })

      ws.on('close', () => {
        console.log('MCP Client disconnected')
        this.connections.delete(ws)
      })

      ws.on('error', (error) => {
        console.error('MCP WebSocket error:', error)
        this.connections.delete(ws)
      })
    })

    // Listen for notifications from the MCP server
    this.mcpServer.on('notification', (notification) => {
      const message = JSON.stringify(notification)
      this.connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message)
        }
      })
    })

    console.log(`MCP Server attached to ${path}`)
  }

  // Express middleware for HTTP JSON-RPC requests (alternative to WebSocket)
  getHTTPMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'POST') {
        return next()
      }

      try {
        // Extract user context from JWT for tool provider
        let userId: number | undefined
        let serverId: number | undefined
        
        try {
          userId = await getUserId(req)
          // For now, we'll assume a default server ID or extract from request
          // This could be enhanced to determine the appropriate server
        } catch (error) {
          // Handle unauthenticated requests - some tools might be public
          console.warn('No valid JWT found for MCP request')
        }

        // Set user context in tool provider before handling message
        const toolProvider = this.mcpServer.getToolProvider() as FosToolProvider
        if (toolProvider && userId) {
          toolProvider.setUserContext(userId, serverId)
        }

        const message = JSON.stringify(req.body)
        const response = await this.mcpServer.handleMessage(message)

        if (response) {
          res.json(JSON.parse(response))
        } else {
          res.status(204).send()
        }
      } catch (error) {
        console.error('MCP HTTP Error:', error)
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: -32603,
            message: 'Internal error'
          }
        })
      }
    }
  }

  // Get the MCP server instance for adding custom providers
  getMCPServer(): MCPServerInstance {
    return this.mcpServer
  }
}

// Default resource provider for Fosforescent data
class FosResourceProvider implements MCPResourceProvider {
  async listResources() {
    return [
      {
        uri: 'fos://user/profile',
        name: 'User Profile',
        description: 'Current user profile information',
        mimeType: 'application/json'
      },
      {
        uri: 'fos://user/data',
        name: 'User Data',
        description: 'User workflow and node data',
        mimeType: 'application/json'
      }
    ]
  }

  async readResource(uri: string) {
    switch (uri) {
      case 'fos://user/profile':
        // This would need user context from the request
        return {
          contents: [{
            type: 'text',
            text: 'User profile data would be provided here'
          }]
        }

      case 'fos://user/data':
        return {
          contents: [{
            type: 'text',
            text: 'User workflow data would be provided here'
          }]
        }

      default:
        throw new Error(`Resource not found: ${uri}`)
    }
  }
}

// Default tool provider for Fosforescent operations
class FosToolProvider implements MCPToolProvider {
  private userContext: { userId?: number; serverId?: number } = {}

  setUserContext(userId: number, serverId?: number) {
    this.userContext = { userId, serverId }
  }

  async listTools(): Promise<MCPTool[]> {
    return [
      {
        name: 'create_node',
        description: 'Create a new workflow node',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Node type' },
            data: { type: 'object', description: 'Node data' }
          },
          required: ['type']
        }
      },
      {
        name: 'search_nodes',
        description: 'Search workflow nodes',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', description: 'Maximum results' }
          },
          required: ['query']
        }
      },
      {
        name: 'prompt_user',
        description: 'Prompt the user for input or confirmation',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Prompt title' },
            message: { type: 'string', description: 'Prompt message to display to the user' },
            promptType: {
              type: 'string',
              enum: ['input', 'confirmation', 'choice'],
              description: 'Type of prompt: input (text input), confirmation (yes/no), choice (multiple options)'
            },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: 'Options for choice prompts'
            },
            defaultValue: { type: 'string', description: 'Default value for input prompts' },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high', 'urgent'],
              description: 'Priority level of the prompt'
            },
            expiresInMinutes: { type: 'number', description: 'Minutes until prompt expires' },
            inputSchema: { type: 'object', description: 'JSON schema for input validation' }
          },
          required: ['title', 'message', 'promptType']
        }
      },
      {
        name: 'get_prompt_response',
        description: 'Get the response to a previously sent prompt',
        inputSchema: {
          type: 'object',
          properties: {
            promptId: { type: 'string', description: 'ID of the prompt to check' }
          },
          required: ['promptId']
        }
      },
      {
        name: 'list_user_prompts',
        description: 'List prompts for the current user',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['pending', 'responded', 'expired', 'cancelled'],
              description: 'Filter by prompt status'
            },
            limit: { type: 'number', description: 'Maximum number of prompts to return' }
          }
        }
      },
      {
        name: 'get_bids',
        description: 'Get tool bids for a specific task from available MCP servers',
        inputSchema: {
          type: 'object',
          properties: {
            taskDescription: { 
              type: 'string', 
              description: 'Description of the task you want to accomplish' 
            },
            context: { 
              type: 'object', 
              description: 'Additional context for the task (optional)' 
            }
          },
          required: ['taskDescription']
        }
      },
      {
        name: 'proxy_tool',
        description: 'Execute a tool from a bid session through the proxy system',
        inputSchema: {
          type: 'object',
          properties: {
            bidId: { 
              type: 'string', 
              description: 'ID of the bid to execute (from get_bids response)' 
            },
            parameters: { 
              type: 'object', 
              description: 'Parameters to pass to the tool' 
            }
          },
          required: ['bidId']
        }
      },
      {
        name: 'agent_chat',
        description: 'Chat with the ConsoleAgent and get intelligent tool suggestions',
        inputSchema: {
          type: 'object',
          properties: {
            message: { 
              type: 'string', 
              description: 'User message or request' 
            },
            mode: {
              type: 'string',
              enum: ['auto', 'confirm', 'prompt'],
              description: 'Execution mode: auto (execute best tool under threshold), confirm (ask yes/no), prompt (show all options)',
              default: 'prompt'
            },
            maxTokens: {
              type: 'number',
              description: 'Maximum tokens to spend (for auto mode)',
              default: 100
            },
            context: {
              type: 'object',
              description: 'Additional context for better tool selection'
            }
          },
          required: ['message']
        }
      },
      {
        name: 'agent_execute_with_mode',
        description: 'Execute tools with specific prompting behavior',
        inputSchema: {
          type: 'object',
          properties: {
            taskDescription: { 
              type: 'string', 
              description: 'Description of task to accomplish' 
            },
            mode: {
              type: 'string',
              enum: ['auto', 'confirm', 'prompt'],
              description: 'Execution mode'
            },
            maxTokens: {
              type: 'number',
              description: 'Maximum tokens to spend (for auto mode)'
            },
            selectedBidId: {
              type: 'string',
              description: 'Specific bid to execute (when user has chosen from prompts)'
            },
            parameters: {
              type: 'object',
              description: 'Parameters for the tool execution'
            }
          },
          required: ['taskDescription', 'mode']
        }
      }
    ]
  }

  async callTool(name: string, args?: any) {
    const startTime = Date.now()
    let toolUseId: string | null = null
    let tokenCost = 0
    
    try {
      // Generate unique tool use ID
      toolUseId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Get tool description for tracking
      const tools = await this.listTools()
      const toolInfo = tools.find(tool => tool.name === name)
      
      // Get token cost for this tool
      if (this.userContext.serverId) {
        tokenCost = await tokenManager.getToolPricing(this.userContext.serverId, name)
      }
      
      // Check if user has enough tokens (if tool has a cost)
      if (tokenCost > 0 && this.userContext.userId) {
        const hasEnoughTokens = await tokenManager.hasEnoughTokens(this.userContext.userId, tokenCost)
        if (!hasEnoughTokens) {
          throw new Error(`Insufficient tokens. Required: ${tokenCost} tokens`)
        }
      }
      
      // Record tool usage start
      await this.recordToolUseStart(toolUseId, name, toolInfo?.description, args, tokenCost)
      
      let result: any
      
      switch (name) {
        case 'prompt_user':
          result = await this.handlePromptUser(args)
          break

        case 'get_prompt_response':
          result = await this.handleGetPromptResponse(args)
          break

        case 'list_user_prompts':
          result = await this.handleListUserPrompts(args)
          break

        case 'get_bids':
          result = await this.handleGetBids(args)
          break

        case 'proxy_tool':
          result = await this.handleProxyTool(args)
          break

        case 'agent_chat':
          result = await this.handleAgentChat(args)
          break

        case 'agent_execute_with_mode':
          result = await this.handleAgentExecuteWithMode(args)
          break

        default:
          throw new Error(`Tool not found: ${name}`)
      }
      
      // Record successful completion and charge tokens
      const duration = Date.now() - startTime
      await this.recordToolUseCompletion(toolUseId, result, duration, tokenCost)
      
      return result
      
    } catch (error) {
      // Record failure
      if (toolUseId) {
        const duration = Date.now() - startTime
        await this.recordToolUseFailure(toolUseId, error, duration, tokenCost)
      }
      throw error
    }
  }

  private async handlePromptUser(args: any) {
    const userId = this.userContext.userId
    const serverId = this.userContext.serverId

    if (!userId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'User context not available'
          })
        }]
      }
    }

    const promptId = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Calculate expiration if provided
    let expiresAt = null
    if (args.expiresInMinutes) {
      expiresAt = new Date(Date.now() + args.expiresInMinutes * 60 * 1000)
    }

    try {
      const prompt = await prisma.userPromptModel.create({
        data: {
          userId,
          serverId,
          promptId,
          title: args.title,
          message: args.message,
          promptType: args.promptType || 'input',
          options: args.options || [],
          inputSchema: args.inputSchema || {},
          defaultValue: args.defaultValue,
          priority: args.priority || 'normal',
          expiresAt
        }
      })

      // Send real-time notification to user
      const serverName = serverId ? (await prisma.mCPServerModel.findUnique({
        where: { id: serverId },
        select: { name: true }
      }))?.name : undefined

      notifyUserOfPrompt(userId, {
        promptId: prompt.promptId,
        title: prompt.title,
        message: prompt.message,
        priority: prompt.priority,
        promptType: prompt.promptType,
        serverId,
        serverName
      })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            promptId,
            message: 'Prompt sent to user successfully'
          })
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Failed to create prompt',
            details: error instanceof Error ? error.message : 'Unknown error'
          })
        }]
      }
    }
  }

  private async handleGetPromptResponse(args: any) {
    if (!args.promptId) {
      throw new Error('promptId is required')
    }

    try {
      const prompt = await prisma.userPromptModel.findUnique({
        where: { promptId: args.promptId }
      })

      if (!prompt) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Prompt not found'
            })
          }]
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            promptId: prompt.promptId,
            status: prompt.status,
            response: prompt.response,
            respondedAt: prompt.respondedAt,
            isExpired: prompt.expiresAt ? new Date() > prompt.expiresAt : false
          })
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Failed to get prompt response',
            details: error instanceof Error ? error.message : 'Unknown error'
          })
        }]
      }
    }
  }

  private async handleListUserPrompts(args: any) {
    const userId = this.userContext.userId

    if (!userId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'User context not available'
          })
        }]
      }
    }

    try {
      const where: any = { userId }

      if (args.status) {
        where.status = args.status
      }

      const prompts = await prisma.userPromptModel.findMany({
        where,
        take: args.limit || 50,
        orderBy: { createdAt: 'desc' },
        select: {
          promptId: true,
          title: true,
          message: true,
          promptType: true,
          status: true,
          priority: true,
          createdAt: true,
          expiresAt: true,
          respondedAt: true
        }
      })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            prompts: prompts.map(prompt => ({
              ...prompt,
              isExpired: prompt.expiresAt ? new Date() > prompt.expiresAt : false
            }))
          })
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Failed to list prompts',
            details: error instanceof Error ? error.message : 'Unknown error'
          })
        }]
      }
    }
  }

  private async recordToolUseStart(toolUseId: string, toolName: string, toolDescription: string | undefined, inputParameters: any, tokenCost: number = 0) {
    const userId = this.userContext.userId
    const serverId = this.userContext.serverId

    if (!userId) {
      console.warn('Cannot record tool use: no user context available')
      return
    }

    try {
      await prisma.toolUseModel.create({
        data: {
          toolUseId,
          callerUserId: userId,
          serverId,
          toolName,
          toolDescription,
          inputParameters: inputParameters || {},
          tokenCost,
          status: 'pending',
          metadata: {
            userAgent: 'MCP-Client', // Could be enhanced with actual user agent
            source: 'mcp_server',
            tokenCostAtStart: tokenCost
          }
        }
      })
    } catch (error) {
      console.error('Failed to record tool use start:', error)
    }
  }

  private async recordToolUseCompletion(toolUseId: string, outputResult: any, duration: number, tokenCost: number = 0) {
    try {
      await prisma.$transaction(async (tx) => {
        // Update tool use record
        await tx.toolUseModel.update({
          where: { toolUseId },
          data: {
            status: 'completed',
            outputResult: outputResult || {},
            duration,
            completedAt: new Date()
          }
        })

        // Charge tokens if there's a cost and user context
        if (tokenCost > 0 && this.userContext.userId) {
          await tokenManager.debitTokens(
            this.userContext.userId,
            tokenCost,
            `Tool usage: ${toolUseId.split('_')[0]} (${duration}ms)`,
            toolUseId,
            {
              toolName: toolUseId.split('_')[0], // Extract tool name from ID for metadata
              duration,
              serverId: this.userContext.serverId
            }
          )
        }
      })
    } catch (error) {
      console.error('Failed to record tool use completion:', error)
      throw error // Re-throw to trigger failure handling
    }
  }

  private async recordToolUseFailure(toolUseId: string, error: any, duration: number, tokenCost: number = 0) {
    try {
      await prisma.toolUseModel.update({
        where: { toolUseId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          duration,
          completedAt: new Date()
        }
      })
      
      // Note: We don't charge tokens for failed tool calls
      console.log(`Tool use ${toolUseId} failed, no tokens charged (would have been ${tokenCost} tokens)`)
    } catch (dbError) {
      console.error('Failed to record tool use failure:', dbError)
    }
  }

  private async handleGetBids(args: any) {
    const userId = this.userContext.userId
    
    if (!userId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'User context not available'
          })
        }]
      }
    }

    const { taskDescription, context = {} } = args

    if (!taskDescription) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'taskDescription is required'
          })
        }]
      }
    }

    try {
      const bidSession = await toolBidManager.getBidsForTask(
        userId,
        taskDescription,
        context
      )

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            sessionId: bidSession.sessionId,
            taskDescription: bidSession.taskDescription,
            bids: bidSession.bids.map(bid => ({
              bidId: bid.bidId,
              serverName: bid.serverName,
              toolName: bid.toolName,
              toolDescription: bid.toolDescription,
              tokenCost: bid.tokenCost,
              relevanceScore: bid.relevanceScore,
              bidReason: bid.bidReason
            })),
            totalBids: bidSession.bids.length
          })
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Failed to get bids for task',
            details: error instanceof Error ? error.message : 'Unknown error'
          })
        }]
      }
    }
  }

  private async handleProxyTool(args: any) {
    const userId = this.userContext.userId
    
    if (!userId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'User context not available'
          })
        }]
      }
    }

    const { bidId, parameters = {} } = args

    if (!bidId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'bidId is required'
          })
        }]
      }
    }

    try {
      // Get the bid details
      const bid = await prisma.toolBidModel.findFirst({
        where: {
          bidId,
          session: {
            userId // Ensure the bid belongs to this user
          }
        },
        include: {
          server: true,
          session: true
        }
      })

      if (!bid) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Bid not found or access denied'
            })
          }]
        }
      }

      // Check if user has enough tokens
      const tokenCost = bid.tokenCost
      if (tokenCost > 0) {
        const hasEnoughTokens = await tokenManager.hasEnoughTokens(userId, tokenCost)
        if (!hasEnoughTokens) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Insufficient tokens. Required: ${tokenCost} tokens`,
                tokenCost
              })
            }]
          }
        }
      }

      // Generate tool use ID
      const toolUseId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Record tool usage start
      await this.recordToolUseStart(
        toolUseId, 
        bid.toolName, 
        bid.toolDescription ?? undefined, 
        parameters, 
        tokenCost
      )

      // Mark bid as chosen
      await toolBidManager.markBidAsChosen(bidId, toolUseId)

      // TODO: Here we would actually call the MCP server to execute the tool
      // For now, we'll simulate the execution
      const mockResult = {
        success: true,
        toolName: bid.toolName,
        serverName: bid.server.name,
        result: `Executed ${bid.toolName} with parameters: ${JSON.stringify(parameters)}`,
        tokenCost,
        executedAt: new Date().toISOString()
      }

      // Record successful completion and charge tokens
      const duration = 1500 // Mock duration
      await this.recordToolUseCompletion(toolUseId, mockResult, duration, tokenCost)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            toolUseId,
            bidId,
            result: mockResult,
            tokenCost,
            duration
          })
        }]
      }

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Failed to execute tool via proxy',
            details: error instanceof Error ? error.message : 'Unknown error'
          })
        }]
      }
    }
  }

  private async handleAgentChat(args: any) {
    const userId = this.userContext.userId
    
    if (!userId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'User context not available'
          })
        }]
      }
    }

    const { message, mode = 'prompt', maxTokens = 100, context = {} } = args

    if (!message) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Message is required'
          })
        }]
      }
    }

    try {
      // Get available tools for this request
      const bidSession = await toolBidManager.getBidsForTask(userId, message, context)
      
      let response: any = {
        message: `I understand you want: "${message}".`,
        sessionId: bidSession.sessionId,
        availableTools: bidSession.bids.length,
        mode
      }

      if (bidSession.bids.length === 0) {
        response.message += ' Unfortunately, no suitable tools are currently available for this task.'
        response.suggestion = 'Try rephrasing your request or check that MCP servers are connected.'
      } else {
        switch (mode) {
          case 'auto':
            // Auto mode: execute cheapest tool under threshold
            const freeBids = bidSession.bids.filter(bid => bid.tokenCost === 0)
            const affordableBids = bidSession.bids.filter(bid => bid.tokenCost <= maxTokens)
            
            const candidateBids = freeBids.length > 0 ? freeBids : affordableBids
            
            if (candidateBids.length > 0) {
              const bestBid = candidateBids[0]! // Already sorted by relevance then cost, array length checked above
              
              // Auto-execute the best tool
              const toolResult = await this.handleProxyTool({
                bidId: bestBid.bidId,
                parameters: { query: message, ...context }
              })
              
              response.autoExecuted = true
              response.executedTool = {
                name: bestBid.toolName,
                cost: bestBid.tokenCost,
                server: bestBid.serverName
              }
              response.result = toolResult
            } else {
              response.message += ` No affordable tools found within ${maxTokens} token limit.`
              response.suggestion = 'Increase your maxTokens limit or use a different mode.'
            }
            break

          case 'confirm':
            // Confirm mode: suggest best tool and ask for confirmation
            if (bidSession.bids.length === 0) {
              response.message += ' No tools available for this task.'
              break
            }
            const bestTool = bidSession.bids[0]!
            response.message += ` I recommend using "${bestTool.toolName}" from ${bestTool.serverName}.`
            response.recommendedTool = {
              bidId: bestTool.bidId,
              name: bestTool.toolName,
              description: bestTool.toolDescription,
              cost: bestTool.tokenCost,
              server: bestTool.serverName,
              reason: bestTool.bidReason
            }
            response.confirmation = {
              question: `Execute "${bestTool.toolName}" for ${bestTool.tokenCost} tokens?`,
              yesAction: {
                tool: 'agent_execute_with_mode',
                params: {
                  taskDescription: message,
                  mode: 'confirm',
                  selectedBidId: bestTool.bidId,
                  parameters: { query: message, ...context }
                }
              }
            }
            break

          case 'prompt':
          default:
            // Prompt mode: show all options
            response.message += ` Here are your options:`
            response.toolOptions = bidSession.bids.slice(0, 5).map(bid => ({
              bidId: bid.bidId,
              name: bid.toolName,
              description: bid.toolDescription,
              cost: bid.tokenCost,
              server: bid.serverName,
              reason: bid.bidReason,
              relevanceScore: bid.relevanceScore
            }))
            response.instruction = 'Use agent_execute_with_mode to execute your chosen tool.'
            break
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response)
        }]
      }

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Failed to process agent chat',
            details: error instanceof Error ? error.message : 'Unknown error'
          })
        }]
      }
    }
  }

  private async handleAgentExecuteWithMode(args: any) {
    const userId = this.userContext.userId
    
    if (!userId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'User context not available'
          })
        }]
      }
    }

    const { taskDescription, mode, maxTokens, selectedBidId, parameters = {} } = args

    if (!taskDescription || !mode) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'taskDescription and mode are required'
          })
        }]
      }
    }

    try {
      if (selectedBidId) {
        // Execute specific bid
        const toolResult = await this.handleProxyTool({
          bidId: selectedBidId,
          parameters: { query: taskDescription, ...parameters }
        })
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Tool executed successfully',
              mode,
              selectedBidId,
              result: toolResult
            })
          }]
        }
      } else {
        // Get new bids and execute according to mode
        return await this.handleAgentChat({
          message: taskDescription,
          mode,
          maxTokens,
          context: parameters
        })
      }

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Failed to execute tool with mode',
            details: error instanceof Error ? error.message : 'Unknown error'
          })
        }]
      }
    }
  }

}

// Default prompt provider for Fosforescent
class FosPromptProvider implements MCPPromptProvider {
  async listPrompts() {
    return [
      {
        name: 'analyze_workflow',
        description: 'Analyze a workflow for optimization opportunities',
        arguments: [
          {
            name: 'workflow_id',
            description: 'ID of the workflow to analyze',
            required: true
          }
        ]
      },
      {
        name: 'suggest_improvements',
        description: 'Suggest improvements for a given context',
        arguments: [
          {
            name: 'context',
            description: 'Context to analyze for improvements',
            required: true
          }
        ]
      }
    ]
  }

  async getPrompt(name: string, args?: any) {
    switch (name) {
      case 'analyze_workflow':
        return {
          description: 'Workflow analysis prompt',
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: `Please analyze workflow ${args?.workflow_id} and provide optimization suggestions.`
              }
            }
          ]
        }

      case 'suggest_improvements':
        return {
          description: 'Improvement suggestions prompt',
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: `Based on this context: ${args?.context}, what improvements would you suggest?`
              }
            }
          ]
        }

      default:
        throw new Error(`Prompt not found: ${name}`)
    }
  }
}