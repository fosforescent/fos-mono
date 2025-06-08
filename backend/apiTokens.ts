import { Request, Response } from 'express'
import { prisma } from './prismaClient'
import crypto from 'crypto'
import bcrypt from 'bcrypt'

interface CreateApiTokenRequest {
  name: string
  scopes?: string[]
  expiresAt?: string // ISO date string
}

interface UpdateApiTokenRequest {
  name?: string
  scopes?: string[]
  isActive?: boolean
}

// Generate a cryptographically secure API token
function generateApiToken(): string {
  // Generate a 32-byte random token and encode as base64url
  const token = crypto.randomBytes(32).toString('base64url')
  return `fos_${token}`
}

// Hash token for secure storage
async function hashToken(token: string): Promise<string> {
  const saltRounds = 12
  return await bcrypt.hash(token, saltRounds)
}

// Verify token against hash
async function verifyToken(token: string, hashedToken: string): Promise<boolean> {
  return await bcrypt.compare(token, hashedToken)
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

// Get all API tokens for a user
export const getUserApiTokens = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)

    const tokens = await prisma.apiTokenModel.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        scopes: true,
        lastUsed: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Don't return the actual token or hash for security
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ tokens })
  } catch (error) {
    console.error('Error fetching API tokens:', error)
    res.status(500).json({ error: 'Failed to fetch API tokens' })
  }
}

// Create a new API token
export const createApiToken = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)
    const { name, scopes, expiresAt }: CreateApiTokenRequest = req.body

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Token name is required' })
    }

    // Check if user already has a token with this name
    const existingToken = await prisma.apiTokenModel.findFirst({
      where: { 
        userId,
        name: name.trim()
      }
    })

    if (existingToken) {
      return res.status(400).json({ error: 'Token with this name already exists' })
    }

    // Generate token and hash
    const token = generateApiToken()
    const hashedToken = await hashToken(token)

    // Parse expiration date if provided
    let expirationDate: Date | null = null
    if (expiresAt) {
      expirationDate = new Date(expiresAt)
      if (isNaN(expirationDate.getTime())) {
        return res.status(400).json({ error: 'Invalid expiration date' })
      }
      if (expirationDate <= new Date()) {
        return res.status(400).json({ error: 'Expiration date must be in the future' })
      }
    }

    // Create the token
    const apiToken = await prisma.apiTokenModel.create({
      data: {
        userId,
        name: name.trim(),
        token,
        hashedToken,
        scopes: scopes || [],
        expiresAt: expirationDate
      },
      select: {
        id: true,
        name: true,
        token: true, // Return the token only on creation
        scopes: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      }
    })

    res.status(201).json({ 
      token: apiToken,
      message: 'Token created successfully. Make sure to copy it now as it will not be shown again.'
    })
  } catch (error) {
    console.error('Error creating API token:', error)
    res.status(500).json({ error: 'Failed to create API token' })
  }
}

// Update an API token
export const updateApiToken = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)
    const tokenId = parseInt(req.params.id)
    const { name, scopes, isActive }: UpdateApiTokenRequest = req.body

    // Check if token exists and belongs to user
    const existingToken = await prisma.apiTokenModel.findFirst({
      where: { 
        id: tokenId,
        userId 
      }
    })

    if (!existingToken) {
      return res.status(404).json({ error: 'API token not found' })
    }

    // If updating name, check for conflicts
    if (name && name !== existingToken.name) {
      const nameConflict = await prisma.apiTokenModel.findFirst({
        where: { 
          userId,
          name: name.trim(),
          id: { not: tokenId }
        }
      })

      if (nameConflict) {
        return res.status(400).json({ error: 'Token with this name already exists' })
      }
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (scopes !== undefined) updateData.scopes = scopes
    if (isActive !== undefined) updateData.isActive = isActive

    const updatedToken = await prisma.apiTokenModel.update({
      where: { id: tokenId },
      data: updateData,
      select: {
        id: true,
        name: true,
        scopes: true,
        lastUsed: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    res.json({ token: updatedToken })
  } catch (error) {
    console.error('Error updating API token:', error)
    res.status(500).json({ error: 'Failed to update API token' })
  }
}

// Delete an API token
export const deleteApiToken = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)
    const tokenId = parseInt(req.params.id)

    // Check if token exists and belongs to user
    const existingToken = await prisma.apiTokenModel.findFirst({
      where: { 
        id: tokenId,
        userId 
      }
    })

    if (!existingToken) {
      return res.status(404).json({ error: 'API token not found' })
    }

    await prisma.apiTokenModel.delete({
      where: { id: tokenId }
    })

    res.json({ message: 'API token deleted successfully' })
  } catch (error) {
    console.error('Error deleting API token:', error)
    res.status(500).json({ error: 'Failed to delete API token' })
  }
}

// Revoke an API token (set to inactive)
export const revokeApiToken = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const userId = await getUserIdFromClaims(claims)
    const tokenId = parseInt(req.params.id)

    // Check if token exists and belongs to user
    const existingToken = await prisma.apiTokenModel.findFirst({
      where: { 
        id: tokenId,
        userId 
      }
    })

    if (!existingToken) {
      return res.status(404).json({ error: 'API token not found' })
    }

    const updatedToken = await prisma.apiTokenModel.update({
      where: { id: tokenId },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        scopes: true,
        lastUsed: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    res.json({ token: updatedToken, message: 'API token revoked successfully' })
  } catch (error) {
    console.error('Error revoking API token:', error)
    res.status(500).json({ error: 'Failed to revoke API token' })
  }
}

// Verify and authenticate an API token
export async function authenticateApiToken(token: string): Promise<{ userId: number; scopes: string[] } | null> {
  try {
    if (!token || !token.startsWith('fos_')) {
      return null
    }

    // Find the token in database
    const apiToken = await prisma.apiTokenModel.findUnique({
      where: { 
        token,
        isActive: true
      },
      include: {
        user: true
      }
    })

    if (!apiToken) {
      return null
    }

    // Check if token is expired
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      // Automatically deactivate expired tokens
      await prisma.apiTokenModel.update({
        where: { id: apiToken.id },
        data: { isActive: false }
      })
      return null
    }

    // Update last used timestamp
    await prisma.apiTokenModel.update({
      where: { id: apiToken.id },
      data: { lastUsed: new Date() }
    })

    return {
      userId: apiToken.userId,
      scopes: Array.isArray(apiToken.scopes) ? apiToken.scopes as string[] : []
    }
  } catch (error) {
    console.error('Error authenticating API token:', error)
    return null
  }
}