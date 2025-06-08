import { Request, Response } from 'express'
import { prisma } from './prismaClient'
import { generateMCPEmbedding, generateMCPEmbeddingsBatch, searchMCPServers, searchMCPTools } from './embedding'

interface MCPServerCreateRequest {
  name: string
  description?: string
  endpoint: string
  credentials?: object
}

interface MCPServerUpdateRequest {
  name?: string
  description?: string
  endpoint?: string
  status?: string
  credentials?: object
  capabilities?: string[]
}

export const getMCPServers = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)

    // Get servers that the user has access to
    const userAccess = await prisma.userMCPServerAccessModel.findMany({
      where: { userId },
      include: {
        server: {
          include: {
            Tools: true,
            _count: {
              select: {
                Tools: true,
                UserAccess: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const servers = userAccess.map(access => ({
      ...access.server,
      userRole: access.role,
      userCredentials: access.credentials,
      toolCount: access.server._count.Tools,
      userCount: access.server._count.UserAccess
    }))

    res.json({ servers })
  } catch (error) {
    console.error('Error fetching MCP servers:', error)
    res.status(500).json({ error: 'Failed to fetch MCP servers' })
  }
}

export const getMCPServer = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)
    const serverId = parseInt(req.params.id)

    const server = await prisma.mCPServerModel.findFirst({
      where: { 
        id: serverId,
        userId 
      }
    })

    if (!server) {
      return res.status(404).json({ error: 'MCP server not found' })
    }

    res.json({ server })
  } catch (error) {
    console.error('Error fetching MCP server:', error)
    res.status(500).json({ error: 'Failed to fetch MCP server' })
  }
}

export const createMCPServer = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)
    const { name, description, endpoint, credentials }: MCPServerCreateRequest = req.body

    if (!name || !endpoint) {
      return res.status(400).json({ error: 'Name and endpoint are required' })
    }

    // Check if server with same name already exists globally
    const existingServer = await prisma.mCPServerModel.findUnique({
      where: { name }
    })

    if (existingServer) {
      return res.status(400).json({ error: 'MCP server with this name already exists' })
    }

    // Generate embedding for description if provided
    const descriptionEmbedding = await generateMCPEmbedding(description || null)

    // Create the server
    const server = await prisma.mCPServerModel.create({
      data: {
        name,
        description: description || '',
        endpoint,
        credentials: credentials || {},
        status: 'disconnected',
        descriptionEmbedding: descriptionEmbedding
      }
    })

    // Grant the creator admin access to the server
    await prisma.userMCPServerAccessModel.create({
      data: {
        userId,
        serverId: server.id,
        role: 'admin',
        credentials: credentials || {}
      }
    })

    res.status(201).json({ server })
  } catch (error) {
    console.error('Error creating MCP server:', error)
    res.status(500).json({ error: 'Failed to create MCP server' })
  }
}

export const updateMCPServer = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)
    const serverId = parseInt(req.params.id)
    const { name, description, endpoint, status, credentials, capabilities }: MCPServerUpdateRequest = req.body

    // Check if server exists and belongs to user
    const existingServer = await prisma.mCPServerModel.findFirst({
      where: { 
        id: serverId,
        userId 
      }
    })

    if (!existingServer) {
      return res.status(404).json({ error: 'MCP server not found' })
    }

    // If updating name, check for conflicts
    if (name && name !== existingServer.name) {
      const nameConflict = await prisma.mCPServerModel.findFirst({
        where: { 
          userId,
          name,
          id: { not: serverId }
        }
      })

      if (nameConflict) {
        return res.status(400).json({ error: 'MCP server with this name already exists' })
      }
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (endpoint !== undefined) updateData.endpoint = endpoint
    if (status !== undefined) updateData.status = status
    if (credentials !== undefined) updateData.credentials = credentials
    if (capabilities !== undefined) updateData.capabilities = capabilities

    const server = await prisma.mCPServerModel.update({
      where: { id: serverId },
      data: updateData
    })

    res.json({ server })
  } catch (error) {
    console.error('Error updating MCP server:', error)
    res.status(500).json({ error: 'Failed to update MCP server' })
  }
}

export const deleteMCPServer = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)
    const serverId = parseInt(req.params.id)

    // Check if server exists and belongs to user
    const existingServer = await prisma.mCPServerModel.findFirst({
      where: { 
        id: serverId,
        userId 
      }
    })

    if (!existingServer) {
      return res.status(404).json({ error: 'MCP server not found' })
    }

    await prisma.mCPServerModel.delete({
      where: { id: serverId }
    })

    res.json({ message: 'MCP server deleted successfully' })
  } catch (error) {
    console.error('Error deleting MCP server:', error)
    res.status(500).json({ error: 'Failed to delete MCP server' })
  }
}

export const testMCPConnection = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)
    const serverId = parseInt(req.params.id)

    // Check if server exists and belongs to user
    const server = await prisma.mCPServerModel.findFirst({
      where: { 
        id: serverId,
        userId 
      }
    })

    if (!server) {
      return res.status(404).json({ error: 'MCP server not found' })
    }

    // Get the global MCP proxy instance
    const mcpProxy = (global as any).mcpProxy
    if (!mcpProxy) {
      return res.status(500).json({ error: 'MCP proxy not available' })
    }

    // Test the actual connection
    const isConnected = await mcpProxy.testServerConnection(serverId)
    const newStatus = isConnected ? 'connected' : 'error'

    // Update server status and last ping
    const updatedServer = await prisma.mCPServerModel.update({
      where: { id: serverId },
      data: {
        status: newStatus,
        lastPing: isConnected ? new Date() : server.lastPing
      }
    })

    res.json({ 
      success: isConnected,
      status: newStatus,
      server: updatedServer,
      message: isConnected ? 'Connection successful' : 'Connection failed'
    })
  } catch (error) {
    console.error('Error testing MCP connection:', error)
    res.status(500).json({ error: 'Failed to test MCP connection' })
  }
}

export const connectUserMCPServers = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)

    // Get the global MCP proxy instance
    const mcpProxy = (global as any).mcpProxy
    if (!mcpProxy) {
      return res.status(500).json({ error: 'MCP proxy not available' })
    }

    // Connect to all user's MCP servers
    await mcpProxy.connectUserServers(userId)

    res.json({ message: 'MCP servers connection initiated' })
  } catch (error) {
    console.error('Error connecting MCP servers:', error)
    res.status(500).json({ error: 'Failed to connect MCP servers' })
  }
}

export const disconnectUserMCPServers = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)

    // Get the global MCP proxy instance
    const mcpProxy = (global as any).mcpProxy
    if (!mcpProxy) {
      return res.status(500).json({ error: 'MCP proxy not available' })
    }

    // Disconnect all user's MCP servers
    await mcpProxy.disconnectUserServers(userId)

    res.json({ message: 'MCP servers disconnected' })
  } catch (error) {
    console.error('Error disconnecting MCP servers:', error)
    res.status(500).json({ error: 'Failed to disconnect MCP servers' })
  }
}

// Search MCP servers
export const searchMCPServersEndpoint = async (req: Request, res: Response) => {
  try {
    const { query, limit, minScore } = req.query
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' })
    }

    const results = await searchMCPServers(query, {
      limit: limit ? parseInt(limit as string) : undefined,
      minScore: minScore ? parseFloat(minScore as string) : undefined
    })

    res.json({ results })
  } catch (error) {
    console.error('Error searching MCP servers:', error)
    res.status(500).json({ error: 'Failed to search MCP servers' })
  }
}

// Search MCP tools
export const searchMCPToolsEndpoint = async (req: Request, res: Response) => {
  try {
    const { query, serverId, limit, minScore } = req.query
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' })
    }

    const results = await searchMCPTools(query, {
      serverId: serverId ? parseInt(serverId as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      minScore: minScore ? parseFloat(minScore as string) : undefined
    })

    res.json({ results })
  } catch (error) {
    console.error('Error searching MCP tools:', error)
    res.status(500).json({ error: 'Failed to search MCP tools' })
  }
}

// Get tools for a specific server
export const getMCPServerTools = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)
    const serverId = parseInt(req.params.id)

    // Check if user has access to this server
    const access = await prisma.userMCPServerAccessModel.findFirst({
      where: { userId, serverId }
    })

    if (!access) {
      return res.status(404).json({ error: 'MCP server not found or access denied' })
    }

    const tools = await prisma.mCPToolModel.findMany({
      where: { serverId },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ tools })
  } catch (error) {
    console.error('Error fetching MCP server tools:', error)
    res.status(500).json({ error: 'Failed to fetch MCP server tools' })
  }
}

// Add tool to server
export const addMCPServerTool = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)
    const serverId = parseInt(req.params.id)
    const { name, description, inputSchema, outputSchema } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Tool name is required' })
    }

    // Check if user has admin access to this server
    const access = await prisma.userMCPServerAccessModel.findFirst({
      where: { userId, serverId, role: { in: ['admin', 'owner'] } }
    })

    if (!access) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Check if tool already exists
    const existingTool = await prisma.mCPToolModel.findFirst({
      where: { serverId, name }
    })

    if (existingTool) {
      return res.status(400).json({ error: 'Tool with this name already exists on this server' })
    }

    // Generate embedding for description
    const descriptionEmbedding = await generateMCPEmbedding(description || null)

    const tool = await prisma.mCPToolModel.create({
      data: {
        serverId,
        name,
        description: description || '',
        inputSchema: inputSchema || {},
        outputSchema: outputSchema || {},
        descriptionEmbedding: descriptionEmbedding
      }
    })

    res.status(201).json({ tool })
  } catch (error) {
    console.error('Error adding MCP server tool:', error)
    res.status(500).json({ error: 'Failed to add MCP server tool' })
  }
}

// Update tool
export const updateMCPServerTool = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)
    const serverId = parseInt(req.params.id)
    const toolId = parseInt(req.params.toolId)
    const { name, description, inputSchema, outputSchema } = req.body

    // Check if user has admin access to this server
    const access = await prisma.userMCPServerAccessModel.findFirst({
      where: { userId, serverId, role: { in: ['admin', 'owner'] } }
    })

    if (!access) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Check if tool exists and belongs to this server
    const existingTool = await prisma.mCPToolModel.findFirst({
      where: { id: toolId, serverId }
    })

    if (!existingTool) {
      return res.status(404).json({ error: 'Tool not found' })
    }

    // Generate new embedding if description changed
    let descriptionEmbedding = existingTool.descriptionEmbedding
    if (description !== undefined && description !== existingTool.description) {
      descriptionEmbedding = await generateMCPEmbedding(description || null)
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (inputSchema !== undefined) updateData.inputSchema = inputSchema
    if (outputSchema !== undefined) updateData.outputSchema = outputSchema
    if (descriptionEmbedding !== existingTool.descriptionEmbedding) {
      updateData.descriptionEmbedding = descriptionEmbedding
    }

    const tool = await prisma.mCPToolModel.update({
      where: { id: toolId },
      data: updateData
    })

    res.json({ tool })
  } catch (error) {
    console.error('Error updating MCP server tool:', error)
    res.status(500).json({ error: 'Failed to update MCP server tool' })
  }
}

// Delete tool
export const deleteMCPServerTool = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)
    const serverId = parseInt(req.params.id)
    const toolId = parseInt(req.params.toolId)

    // Check if user has admin access to this server
    const access = await prisma.userMCPServerAccessModel.findFirst({
      where: { userId, serverId, role: { in: ['admin', 'owner'] } }
    })

    if (!access) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Check if tool exists and belongs to this server
    const existingTool = await prisma.mCPToolModel.findFirst({
      where: { id: toolId, serverId }
    })

    if (!existingTool) {
      return res.status(404).json({ error: 'Tool not found' })
    }

    await prisma.mCPToolModel.delete({
      where: { id: toolId }
    })

    res.json({ message: 'Tool deleted successfully' })
  } catch (error) {
    console.error('Error deleting MCP server tool:', error)
    res.status(500).json({ error: 'Failed to delete MCP server tool' })
  }
}

// Helper function to get userId from JWT claims
async function getUserIdFromClaims(claims: any): Promise<number> {
  const username = claims.username
  const user = await prisma.userModel.findUnique({
    where: { user_name: username }
  })
  
  if (!user) {
    throw new Error('User not found')
  }
  
  return user.id
}