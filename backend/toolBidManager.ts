import { prisma } from './prismaClient'
import { tokenManager } from './tokenManager'

export interface ToolBid {
  bidId: string
  serverId: number
  serverName: string
  toolName: string
  toolDescription?: string
  tokenCost: number
  relevanceScore?: number
  bidReason?: string
}

export interface BidSession {
  sessionId: string
  userId: number
  taskDescription: string
  context: any
  bids: ToolBid[]
  createdAt: Date
}

export class ToolBidManager {
  
  /**
   * Create a new bidding session for a task
   */
  async createBidSession(
    userId: number,
    taskDescription: string,
    context: any = {}
  ): Promise<string> {
    const sessionId = `bid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    await prisma.toolBidSessionModel.create({
      data: {
        sessionId,
        userId,
        taskDescription,
        context
      }
    })
    
    return sessionId
  }

  /**
   * Get available tools for a task and create bids
   */
  async getBidsForTask(
    userId: number,
    taskDescription: string,
    context: any = {}
  ): Promise<BidSession> {
    // Create bid session
    const sessionId = await this.createBidSession(userId, taskDescription, context)
    
    // Get all available MCP servers and their tools
    const servers = await prisma.mCPServerModel.findMany({
      where: {
        status: 'connected',
        OR: [
          // Global servers
          { UserAccess: { none: {} } },
          // Servers user has access to
          { 
            UserAccess: { 
              some: { 
                userId,
                role: { in: ['user', 'admin', 'owner'] }
              } 
            } 
          }
        ]
      },
      include: {
        Tools: true,
        ToolPricing: true
      }
    })

    const bids: ToolBid[] = []

    // Generate bids from available tools
    for (const server of servers) {
      for (const tool of server.Tools) {
        // Get token cost for this tool
        const pricing = server.ToolPricing.find(p => 
          p.toolName === tool.name && p.isEnabled
        )
        const tokenCost = pricing?.pricePerUseTokens || 0

        // Calculate relevance score (simple keyword matching for now)
        const relevanceScore = this.calculateRelevance(
          taskDescription,
          tool.name,
          tool.description || ''
        )

        // Only include tools with some relevance or if they're free
        if (relevanceScore > 0.1 || tokenCost === 0) {
          const bidId = `bid_${sessionId}_${tool.id}`
          
          const bid: ToolBid = {
            bidId,
            serverId: server.id,
            serverName: server.name,
            toolName: tool.name,
            toolDescription: tool.description ?? undefined,
            tokenCost,
            relevanceScore,
            bidReason: this.generateBidReason(taskDescription, tool.name, tool.description ?? undefined)
          }

          bids.push(bid)

          // Store bid in database
          await prisma.toolBidModel.create({
            data: {
              bidId,
              sessionId,
              serverId: server.id,
              toolName: tool.name,
              toolDescription: tool.description,
              tokenCost,
              relevanceScore,
              bidReason: bid.bidReason
            }
          })
        }
      }
    }

    // Sort bids by relevance and cost
    bids.sort((a, b) => {
      // First by relevance (higher is better)
      const relevanceDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0)
      if (relevanceDiff !== 0) return relevanceDiff
      
      // Then by cost (lower is better)
      return a.tokenCost - b.tokenCost
    })

    return {
      sessionId,
      userId,
      taskDescription,
      context,
      bids: bids.slice(0, 10), // Return top 10 bids
      createdAt: new Date()
    }
  }

  /**
   * Mark a bid as chosen when a tool is executed
   */
  async markBidAsChosen(
    bidId: string,
    toolUseId: string
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Update the bid as chosen
      await tx.toolBidModel.update({
        where: { bidId },
        data: {
          isChosen: true,
          chosenAt: new Date()
        }
      })

      // Note: The ToolUseModel relation will be handled by the tool execution logic
    })
  }

  /**
   * Get bid session with all bids
   */
  async getBidSession(sessionId: string): Promise<BidSession | null> {
    const session = await prisma.toolBidSessionModel.findUnique({
      where: { sessionId },
      include: {
        bids: {
          include: {
            server: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    if (!session) return null

    return {
      sessionId: session.sessionId,
      userId: session.userId,
      taskDescription: session.taskDescription,
      context: session.context,
      bids: session.bids.map(bid => ({
        bidId: bid.bidId,
        serverId: bid.serverId,
        serverName: bid.server.name,
        toolName: bid.toolName,
        toolDescription: bid.toolDescription ?? undefined,
        tokenCost: bid.tokenCost,
        relevanceScore: bid.relevanceScore ? parseFloat(bid.relevanceScore.toString()) : undefined,
        bidReason: bid.bidReason ?? undefined
      })),
      createdAt: session.createdAt
    }
  }

  /**
   * Get bid analytics for a user
   */
  async getBidAnalytics(userId: number, days: number = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const stats = await prisma.$transaction(async (tx) => {
      // Total bid sessions
      const totalSessions = await tx.toolBidSessionModel.count({
        where: {
          userId,
          createdAt: { gte: startDate }
        }
      })

      // Total bids created
      const totalBids = await tx.toolBidModel.count({
        where: {
          session: {
            userId,
            createdAt: { gte: startDate }
          }
        }
      })

      // Total bids chosen
      const chosenBids = await tx.toolBidModel.count({
        where: {
          isChosen: true,
          session: {
            userId,
            createdAt: { gte: startDate }
          }
        }
      })

      // Most successful tools (highest chosen rate)
      const toolStats = await tx.toolBidModel.groupBy({
        by: ['serverId', 'toolName'],
        where: {
          session: {
            userId,
            createdAt: { gte: startDate }
          }
        },
        _count: {
          _all: true
        }
      })

      // Get chosen counts per tool
      const chosenToolStats = await tx.toolBidModel.groupBy({
        by: ['serverId', 'toolName'],
        where: {
          isChosen: true,
          session: {
            userId,
            createdAt: { gte: startDate }
          }
        },
        _count: {
          _all: true
        }
      })

      // Create a map for quick lookup of chosen counts
      const chosenCountMap = new Map(
        chosenToolStats.map(stat => 
          [`${stat.serverId}-${stat.toolName}`, stat._count._all]
        )
      )

      return {
        totalSessions,
        totalBids,
        chosenBids,
        choiceRate: totalBids > 0 ? (chosenBids / totalBids) * 100 : 0,
        toolStats: toolStats.map(stat => {
          const totalBids = stat._count._all
          const chosenCount = chosenCountMap.get(`${stat.serverId}-${stat.toolName}`) || 0
          return {
            serverId: stat.serverId,
            toolName: stat.toolName,
            totalBids,
            chosenCount,
            choiceRate: totalBids > 0 ? (chosenCount / totalBids) * 100 : 0
          }
        })
      }
    })

    return stats
  }

  /**
   * Calculate relevance score between task and tool
   * This is a simple implementation - could be enhanced with ML/semantic search
   */
  private calculateRelevance(
    taskDescription: string,
    toolName: string,
    toolDescription: string
  ): number {
    const task = taskDescription.toLowerCase()
    const name = toolName.toLowerCase()
    const desc = toolDescription.toLowerCase()
    
    let score = 0
    
    // Check for exact tool name matches
    if (task.includes(name)) {
      score += 0.8
    }
    
    // Check for keyword matches in description
    const taskWords = task.split(/\s+/)
    const descWords = desc.split(/\s+/)
    
    const commonWords = taskWords.filter(word => 
      word.length > 3 && descWords.includes(word)
    )
    
    score += (commonWords.length / Math.max(taskWords.length, 1)) * 0.6
    
    // Boost score for common action words
    const actionWords = ['create', 'get', 'search', 'find', 'update', 'delete', 'send', 'fetch']
    for (const action of actionWords) {
      if (task.includes(action) && (name.includes(action) || desc.includes(action))) {
        score += 0.2
        break
      }
    }
    
    return Math.min(score, 1.0)
  }

  /**
   * Generate a reason why this tool was suggested
   */
  private generateBidReason(
    taskDescription: string,
    toolName: string,
    toolDescription?: string
  ): string {
    const relevanceScore = this.calculateRelevance(taskDescription, toolName, toolDescription || '')
    
    if (relevanceScore > 0.7) {
      return `High relevance: Tool name/description closely matches your task`
    } else if (relevanceScore > 0.4) {
      return `Moderate relevance: Tool capabilities may help with your task`
    } else if (relevanceScore > 0.1) {
      return `Possible match: Tool might be useful for related functionality`
    } else {
      return `General purpose tool that could potentially help`
    }
  }
}

export const toolBidManager = new ToolBidManager()