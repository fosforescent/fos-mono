import { Request, Response } from 'express'
import { prisma } from './prismaClient'
import { getUserId } from './apiTokenAuth'

interface GetToolUsageRequest {
  limit?: number
  offset?: number
  status?: 'pending' | 'completed' | 'failed' | 'cancelled'
  toolName?: string
  serverId?: number
  startDate?: string
  endDate?: string
}

interface ToolUsageStatsResponse {
  totalCalls: number
  completedCalls: number
  failedCalls: number
  averageDuration: number
  mostUsedTools: Array<{
    toolName: string
    count: number
    averageDuration: number
  }>
  callsByStatus: Record<string, number>
  callsByDate: Array<{
    date: string
    count: number
  }>
}

// Get tool usage for the authenticated user
export const getUserToolUsage = async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req)
    const { 
      limit = 50, 
      offset = 0, 
      status, 
      toolName, 
      serverId, 
      startDate, 
      endDate 
    }: GetToolUsageRequest = req.query as any

    const where: any = { callerUserId: userId }
    
    if (status) {
      where.status = status
    }
    
    if (toolName) {
      where.toolName = { contains: toolName, mode: 'insensitive' }
    }
    
    if (serverId) {
      where.serverId = parseInt(serverId.toString())
    }
    
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string)
      }
    }

    const toolUsages = await prisma.toolUseModel.findMany({
      where,
      include: {
        server: {
          select: {
            id: true,
            name: true
          }
        },
        targetUser: {
          select: {
            id: true,
            user_name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: parseInt(offset.toString()),
      take: parseInt(limit.toString())
    })

    const totalCount = await prisma.toolUseModel.count({ where })

    res.json({
      toolUsages,
      pagination: {
        total: totalCount,
        limit: parseInt(limit.toString()),
        offset: parseInt(offset.toString()),
        hasMore: totalCount > parseInt(offset.toString()) + parseInt(limit.toString())
      }
    })
  } catch (error) {
    console.error('Error fetching user tool usage:', error)
    res.status(500).json({ error: 'Failed to fetch tool usage' })
  }
}

// Get tool usage statistics for the authenticated user
export const getUserToolUsageStats = async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req)
    const { startDate, endDate, serverId } = req.query

    const where: any = { callerUserId: userId }
    
    if (serverId) {
      where.serverId = parseInt(serverId.toString())
    }
    
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string)
      }
    }

    // Get basic stats
    const stats = await prisma.$transaction(async (tx) => {
      const totalCalls = await tx.toolUseModel.count({ where })
      
      const completedCalls = await tx.toolUseModel.count({ 
        where: { ...where, status: 'completed' } 
      })
      
      const failedCalls = await tx.toolUseModel.count({ 
        where: { ...where, status: 'failed' } 
      })

      // Average duration for completed calls
      const avgDurationResult = await tx.toolUseModel.aggregate({
        where: { ...where, status: 'completed', duration: { not: null } },
        _avg: { duration: true }
      })

      // Most used tools
      const toolUsageGroups = await tx.toolUseModel.groupBy({
        by: ['toolName'],
        where,
        _count: { toolName: true },
        _avg: { duration: true },
        orderBy: { _count: { toolName: 'desc' } },
        take: 10
      })

      // Calls by status
      const statusGroups = await tx.toolUseModel.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      })

      // Calls by date (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const dateGroups = await tx.toolUseModel.groupBy({
        by: ['createdAt'],
        where: {
          ...where,
          createdAt: { gte: thirtyDaysAgo }
        },
        _count: { createdAt: true }
      })

      return {
        totalCalls,
        completedCalls,
        failedCalls,
        averageDuration: avgDurationResult._avg.duration || 0,
        mostUsedTools: toolUsageGroups.map(group => ({
          toolName: group.toolName,
          count: group._count.toolName,
          averageDuration: group._avg.duration || 0
        })),
        callsByStatus: statusGroups.reduce((acc, group) => {
          acc[group.status] = group._count.status
          return acc
        }, {} as Record<string, number>),
        callsByDate: dateGroups.map(group => ({
          date: group.createdAt.toISOString().split('T')[0],
          count: group._count.createdAt
        }))
      }
    })

    res.json({ stats })
  } catch (error) {
    console.error('Error fetching tool usage stats:', error)
    res.status(500).json({ error: 'Failed to fetch tool usage statistics' })
  }
}

// Get a specific tool usage record
export const getToolUsage = async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req)
    const { toolUseId } = req.params

    const toolUsage = await prisma.toolUseModel.findFirst({
      where: {
        toolUseId,
        callerUserId: userId
      },
      include: {
        server: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        targetUser: {
          select: {
            id: true,
            user_name: true
          }
        }
      }
    })

    if (!toolUsage) {
      return res.status(404).json({ error: 'Tool usage record not found' })
    }

    res.json({ toolUsage })
  } catch (error) {
    console.error('Error fetching tool usage record:', error)
    res.status(500).json({ error: 'Failed to fetch tool usage record' })
  }
}

// Get tool usage for a specific server (admin or server owner only)
export const getServerToolUsage = async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req)
    const { serverId } = req.params
    const { limit = 50, offset = 0, status, toolName } = req.query

    // Check if user has access to this server
    const serverAccess = await prisma.userMCPServerAccessModel.findFirst({
      where: {
        userId,
        serverId: parseInt(serverId),
        role: { in: ['admin', 'owner'] }
      }
    })

    if (!serverAccess) {
      return res.status(403).json({ error: 'Access denied to this server' })
    }

    const where: any = { serverId: parseInt(serverId) }
    
    if (status) {
      where.status = status
    }
    
    if (toolName) {
      where.toolName = { contains: toolName as string, mode: 'insensitive' }
    }

    const toolUsages = await prisma.toolUseModel.findMany({
      where,
      include: {
        callerUser: {
          select: {
            id: true,
            user_name: true
          }
        },
        targetUser: {
          select: {
            id: true,
            user_name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: parseInt(offset.toString()),
      take: parseInt(limit.toString())
    })

    const totalCount = await prisma.toolUseModel.count({ where })

    res.json({
      toolUsages,
      pagination: {
        total: totalCount,
        limit: parseInt(limit.toString()),
        offset: parseInt(offset.toString()),
        hasMore: totalCount > parseInt(offset.toString()) + parseInt(limit.toString())
      }
    })
  } catch (error) {
    console.error('Error fetching server tool usage:', error)
    res.status(500).json({ error: 'Failed to fetch server tool usage' })
  }
}

// Cancel a pending tool usage (for cleanup/admin purposes)
export const cancelToolUsage = async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req)
    const { toolUseId } = req.params

    const toolUsage = await prisma.toolUseModel.findFirst({
      where: {
        toolUseId,
        callerUserId: userId,
        status: 'pending'
      }
    })

    if (!toolUsage) {
      return res.status(404).json({ error: 'Pending tool usage record not found' })
    }

    const updatedToolUsage = await prisma.toolUseModel.update({
      where: { id: toolUsage.id },
      data: {
        status: 'cancelled',
        completedAt: new Date()
      }
    })

    res.json({
      success: true,
      toolUsage: updatedToolUsage
    })
  } catch (error) {
    console.error('Error cancelling tool usage:', error)
    res.status(500).json({ error: 'Failed to cancel tool usage' })
  }
}