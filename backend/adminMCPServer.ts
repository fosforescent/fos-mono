import { Request, Response } from 'express'
import { prisma } from './prismaClient'
import { AdminRequest } from './adminAuth'
import { generateMCPEmbedding } from './embedding'

interface AdminMCPServerRequest {
  name: string
  description?: string
  endpoint: string
  credentials?: Record<string, any>
  capabilities?: string[]
  isGlobal?: boolean
}

interface AdminUpdateMCPServerRequest {
  name?: string
  description?: string
  endpoint?: string
  credentials?: Record<string, any>
  capabilities?: string[]
  status?: string
  isGlobal?: boolean
}

// Get all MCP servers (admin view with global servers)
export const getAdminMCPServers = async (req: AdminRequest, res: Response) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query

    let whereClause: any = {}

    // If search query provided, search by name or description
    if (search && typeof search === 'string') {
      whereClause = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      }
    }

    const servers = await prisma.mCPServerModel.findMany({
      where: whereClause,
      include: {
        UserAccess: {
          include: {
            user: {
              select: {
                id: true,
                user_name: true,
                role: true
              }
            }
          }
        },
        Tools: true,
        _count: {
          select: {
            UserAccess: true,
            Tools: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: parseInt(offset as string),
      take: parseInt(limit as string)
    })

    // Get total count for pagination
    const totalCount = await prisma.mCPServerModel.count({
      where: whereClause
    })

    res.json({
      servers,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: totalCount > parseInt(offset as string) + parseInt(limit as string)
      }
    })
  } catch (error) {
    console.error('Error fetching admin MCP servers:', error)
    res.status(500).json({ error: 'Failed to fetch MCP servers' })
  }
}

// Get server statistics for admin dashboard
export const getAdminMCPServerStats = async (req: AdminRequest, res: Response) => {
  try {
    const stats = await prisma.$transaction(async (tx) => {
      const totalServers = await tx.mCPServerModel.count()
      const connectedServers = await tx.mCPServerModel.count({
        where: { status: 'connected' }
      })
      const disconnectedServers = await tx.mCPServerModel.count({
        where: { status: 'disconnected' }
      })
      const errorServers = await tx.mCPServerModel.count({
        where: { status: 'error' }
      })
      const totalTools = await tx.mCPToolModel.count()
      const totalUserAccess = await tx.userMCPServerAccessModel.count()
      const uniqueUsers = await tx.userMCPServerAccessModel.findMany({
        select: { userId: true },
        distinct: ['userId']
      })

      return {
        totalServers,
        connectedServers,
        disconnectedServers,
        errorServers,
        totalTools,
        totalUserAccess,
        uniqueUsersWithAccess: uniqueUsers.length
      }
    })

    res.json({ stats })
  } catch (error) {
    console.error('Error fetching admin MCP server stats:', error)
    res.status(500).json({ error: 'Failed to fetch server statistics' })
  }
}

// Create global MCP server (admin only)
export const createAdminMCPServer = async (req: AdminRequest, res: Response) => {
  try {
    const { 
      name, 
      description, 
      endpoint, 
      credentials, 
      capabilities,
      isGlobal = false 
    }: AdminMCPServerRequest = req.body

    if (!name || !endpoint) {
      return res.status(400).json({ error: 'Name and endpoint are required' })
    }

    // Check if server with this name already exists
    const existingServer = await prisma.mCPServerModel.findUnique({
      where: { name }
    })

    if (existingServer) {
      return res.status(400).json({ error: 'Server with this name already exists' })
    }

    // Generate embedding for description if provided
    let descriptionEmbedding = null
    if (description) {
      try {
        descriptionEmbedding = await generateMCPEmbedding(description)
      } catch (embeddingError) {
        console.warn('Failed to generate embedding for server description:', embeddingError)
      }
    }

    const server = await prisma.mCPServerModel.create({
      data: {
        name,
        description,
        endpoint,
        credentials: credentials || {},
        capabilities: capabilities || [],
        descriptionEmbedding
      },
      include: {
        UserAccess: true,
        Tools: true,
        _count: {
          select: {
            UserAccess: true,
            Tools: true
          }
        }
      }
    })

    // If this is a global server, grant access to all users
    if (isGlobal) {
      // Get all users
      const allUsers = await prisma.userModel.findMany({
        where: { approved: true },
        select: { id: true }
      })

      // Create access records for all users
      if (allUsers.length > 0) {
        await prisma.userMCPServerAccessModel.createMany({
          data: allUsers.map(user => ({
            userId: user.id,
            serverId: server.id,
            role: 'user'
          })),
          skipDuplicates: true
        })
      }
    }

    res.status(201).json({ server })
  } catch (error) {
    console.error('Error creating admin MCP server:', error)
    res.status(500).json({ error: 'Failed to create MCP server' })
  }
}

// Update MCP server (admin only)
export const updateAdminMCPServer = async (req: AdminRequest, res: Response) => {
  try {
    const serverId = parseInt(req.params.id)
    const updateData: AdminUpdateMCPServerRequest = req.body

    // Check if server exists
    const existingServer = await prisma.mCPServerModel.findUnique({
      where: { id: serverId }
    })

    if (!existingServer) {
      return res.status(404).json({ error: 'MCP server not found' })
    }

    // If updating name, check for conflicts
    if (updateData.name && updateData.name !== existingServer.name) {
      const nameConflict = await prisma.mCPServerModel.findFirst({
        where: { 
          name: updateData.name,
          id: { not: serverId }
        }
      })

      if (nameConflict) {
        return res.status(400).json({ error: 'Server with this name already exists' })
      }
    }

    // Generate new embedding if description is being updated
    let descriptionEmbedding = undefined
    if (updateData.description !== undefined) {
      if (updateData.description) {
        try {
          descriptionEmbedding = await generateMCPEmbedding(updateData.description)
        } catch (embeddingError) {
          console.warn('Failed to generate embedding for server description:', embeddingError)
        }
      } else {
        descriptionEmbedding = null
      }
    }

    const server = await prisma.mCPServerModel.update({
      where: { id: serverId },
      data: {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        ...(updateData.endpoint && { endpoint: updateData.endpoint }),
        ...(updateData.credentials && { credentials: updateData.credentials }),
        ...(updateData.capabilities && { capabilities: updateData.capabilities }),
        ...(updateData.status && { status: updateData.status }),
        ...(descriptionEmbedding !== undefined && { descriptionEmbedding })
      },
      include: {
        UserAccess: {
          include: {
            user: {
              select: {
                id: true,
                user_name: true,
                role: true
              }
            }
          }
        },
        Tools: true,
        _count: {
          select: {
            UserAccess: true,
            Tools: true
          }
        }
      }
    })

    res.json({ server })
  } catch (error) {
    console.error('Error updating admin MCP server:', error)
    res.status(500).json({ error: 'Failed to update MCP server' })
  }
}

// Delete MCP server (admin only)
export const deleteAdminMCPServer = async (req: AdminRequest, res: Response) => {
  try {
    const serverId = parseInt(req.params.id)

    // Check if server exists
    const existingServer = await prisma.mCPServerModel.findUnique({
      where: { id: serverId }
    })

    if (!existingServer) {
      return res.status(404).json({ error: 'MCP server not found' })
    }

    // Delete the server (this will cascade delete related records)
    await prisma.mCPServerModel.delete({
      where: { id: serverId }
    })

    res.json({ message: 'MCP server deleted successfully' })
  } catch (error) {
    console.error('Error deleting admin MCP server:', error)
    res.status(500).json({ error: 'Failed to delete MCP server' })
  }
}

// Get server access details (admin only)
export const getAdminMCPServerAccess = async (req: AdminRequest, res: Response) => {
  try {
    const serverId = parseInt(req.params.id)

    const accessRecords = await prisma.userMCPServerAccessModel.findMany({
      where: { serverId },
      include: {
        user: {
          select: {
            id: true,
            user_name: true,
            role: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ access: accessRecords })
  } catch (error) {
    console.error('Error fetching admin MCP server access:', error)
    res.status(500).json({ error: 'Failed to fetch server access records' })
  }
}

// Grant server access to user (admin only)
export const grantAdminMCPServerAccess = async (req: AdminRequest, res: Response) => {
  try {
    const serverId = parseInt(req.params.id)
    const { userId, role = 'user' } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    // Check if server exists
    const server = await prisma.mCPServerModel.findUnique({
      where: { id: serverId }
    })

    if (!server) {
      return res.status(404).json({ error: 'MCP server not found' })
    }

    // Check if user exists
    const user = await prisma.userModel.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Create or update access record
    const accessRecord = await prisma.userMCPServerAccessModel.upsert({
      where: {
        userId_serverId: {
          userId,
          serverId
        }
      },
      update: { role },
      create: {
        userId,
        serverId,
        role
      },
      include: {
        user: {
          select: {
            id: true,
            user_name: true,
            role: true
          }
        }
      }
    })

    res.json({ access: accessRecord })
  } catch (error) {
    console.error('Error granting admin MCP server access:', error)
    res.status(500).json({ error: 'Failed to grant server access' })
  }
}

// Revoke server access from user (admin only)
export const revokeAdminMCPServerAccess = async (req: AdminRequest, res: Response) => {
  try {
    const serverId = parseInt(req.params.id)
    const userId = parseInt(req.params.userId)

    // Check if access record exists
    const accessRecord = await prisma.userMCPServerAccessModel.findUnique({
      where: {
        userId_serverId: {
          userId,
          serverId
        }
      }
    })

    if (!accessRecord) {
      return res.status(404).json({ error: 'Access record not found' })
    }

    // Delete the access record
    await prisma.userMCPServerAccessModel.delete({
      where: {
        userId_serverId: {
          userId,
          serverId
        }
      }
    })

    res.json({ message: 'Server access revoked successfully' })
  } catch (error) {
    console.error('Error revoking admin MCP server access:', error)
    res.status(500).json({ error: 'Failed to revoke server access' })
  }
}

// Make server globally accessible (admin only)
export const makeServerGlobal = async (req: AdminRequest, res: Response) => {
  try {
    const serverId = parseInt(req.params.id)

    // Check if server exists
    const server = await prisma.mCPServerModel.findUnique({
      where: { id: serverId }
    })

    if (!server) {
      return res.status(404).json({ error: 'MCP server not found' })
    }

    // Get all approved users
    const allUsers = await prisma.userModel.findMany({
      where: { approved: true },
      select: { id: true }
    })

    if (allUsers.length === 0) {
      return res.json({ 
        message: 'No approved users found to grant access to',
        usersGranted: 0
      })
    }

    // Create access records for all users who don't already have access
    const existingAccess = await prisma.userMCPServerAccessModel.findMany({
      where: { serverId },
      select: { userId: true }
    })

    const existingUserIds = new Set(existingAccess.map(access => access.userId))
    const usersToGrant = allUsers.filter(user => !existingUserIds.has(user.id))

    if (usersToGrant.length > 0) {
      await prisma.userMCPServerAccessModel.createMany({
        data: usersToGrant.map(user => ({
          userId: user.id,
          serverId,
          role: 'user'
        })),
        skipDuplicates: true
      })
    }

    res.json({ 
      message: 'Server made globally accessible successfully',
      usersGranted: usersToGrant.length,
      totalUsers: allUsers.length,
      alreadyHadAccess: existingAccess.length
    })
  } catch (error) {
    console.error('Error making server global:', error)
    res.status(500).json({ error: 'Failed to make server global' })
  }
}

// Get all users (admin only)
export const getAdminUsers = async (req: AdminRequest, res: Response) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query

    let whereClause: any = {}

    // If search query provided, search by username or email
    if (search && typeof search === 'string') {
      whereClause = {
        OR: [
          { user_name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      }
    }

    const users = await prisma.userModel.findMany({
      where: whereClause,
      select: {
        id: true,
        user_name: true,
        email: true,
        role: true,
        approved: true,
        createdAt: true,
        _count: {
          select: {
            UserMCPServerAccess: true,
            ApiTokens: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: parseInt(offset as string),
      take: parseInt(limit as string)
    })

    // Get total count for pagination
    const totalCount = await prisma.userModel.count({
      where: whereClause
    })

    res.json({
      users,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: totalCount > parseInt(offset as string) + parseInt(limit as string)
      }
    })
  } catch (error) {
    console.error('Error fetching admin users:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
}

// Update user role (admin only)
export const updateUserRole = async (req: AdminRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.userId)
    const { role, approved } = req.body

    // Validate role
    if (role && !['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be user, admin, or superadmin' })
    }

    // Check if user exists
    const existingUser = await prisma.userModel.findUnique({
      where: { id: userId }
    })

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Prevent superadmin from being demoted unless by another superadmin
    if (existingUser.role === 'superadmin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can modify superadmin users' })
    }

    // Prevent admin from creating superadmin unless they are superadmin
    if (role === 'superadmin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can grant superadmin role' })
    }

    const updateData: any = {}
    if (role !== undefined) updateData.role = role
    if (approved !== undefined) updateData.approved = approved

    const updatedUser = await prisma.userModel.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        user_name: true,
        email: true,
        role: true,
        approved: true,
        createdAt: true,
        _count: {
          select: {
            UserMCPServerAccess: true,
            ApiTokens: true
          }
        }
      }
    })

    res.json({ user: updatedUser })
  } catch (error) {
    console.error('Error updating user role:', error)
    res.status(500).json({ error: 'Failed to update user role' })
  }
}

// Get user statistics for admin dashboard
export const getAdminUserStats = async (req: AdminRequest, res: Response) => {
  try {
    const stats = await prisma.$transaction(async (tx) => {
      const totalUsers = await tx.userModel.count()
      const approvedUsers = await tx.userModel.count({
        where: { approved: true }
      })
      const adminUsers = await tx.userModel.count({
        where: { role: { in: ['admin', 'superadmin'] } }
      })
      const recentUsers = await tx.userModel.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      })

      return {
        totalUsers,
        approvedUsers,
        pendingApproval: totalUsers - approvedUsers,
        adminUsers,
        recentUsers
      }
    })

    res.json({ stats })
  } catch (error) {
    console.error('Error fetching admin user stats:', error)
    res.status(500).json({ error: 'Failed to fetch user statistics' })
  }
}