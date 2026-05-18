import { Request, Response, NextFunction } from 'express'
import { prisma } from './prismaClient'
import { getUserId, getUsername } from './apiTokenAuth'

// Extended request type to include admin info
export interface AdminRequest extends Request {
  user?: {
    id: number
    username: string
    role: string
  }
}

// Middleware to require admin or superadmin role
export const requireAdminRole = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get user ID from either JWT or API token
    const userId = await getUserId(req)
    const username = getUsername(req)

    // Get user with role information
    const user = await prisma.userModel.findUnique({
      where: { id: userId },
      select: {
        id: true,
        user_name: true,
        role: true,
        approved: true
      }
    })

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    if (!user.approved) {
      return res.status(401).json({ error: 'User not approved' })
    }

    // Check if user has admin or superadmin role
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({ 
        error: 'Admin privileges required',
        userRole: user.role,
        requiredRoles: ['admin', 'superadmin']
      })
    }

    // Add user info to request for downstream handlers
    req.user = {
      id: user.id,
      username: user.user_name,
      role: user.role
    }

    next()
  } catch (error) {
    console.error('Error in admin authorization middleware:', error)
    return res.status(500).json({ 
      error: 'Internal server error during authorization' 
    })
  }
}

// Middleware to require superadmin role only
export const requireSuperAdminRole = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get user ID from either JWT or API token
    const userId = await getUserId(req)
    const username = getUsername(req)

    // Get user with role information
    const user = await prisma.userModel.findUnique({
      where: { id: userId },
      select: {
        id: true,
        user_name: true,
        role: true,
        approved: true
      }
    })

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    if (!user.approved) {
      return res.status(401).json({ error: 'User not approved' })
    }

    // Check if user has superadmin role
    if (user.role !== 'superadmin') {
      return res.status(403).json({ 
        error: 'Superadmin privileges required',
        userRole: user.role,
        requiredRoles: ['superadmin']
      })
    }

    // Add user info to request for downstream handlers
    req.user = {
      id: user.id,
      username: user.user_name,
      role: user.role
    }

    next()
  } catch (error) {
    console.error('Error in superadmin authorization middleware:', error)
    return res.status(500).json({ 
      error: 'Internal server error during authorization' 
    })
  }
}

// Utility function to check if user has admin privileges
export const isAdmin = (role: string): boolean => {
  return role === 'admin' || role === 'superadmin'
}

// Utility function to check if user has superadmin privileges
export const isSuperAdmin = (role: string): boolean => {
  return role === 'superadmin'
}

// Utility function to get user role
export const getUserRole = async (userId: number): Promise<string | null> => {
  try {
    const user = await prisma.userModel.findUnique({
      where: { id: userId },
      select: { role: true }
    })
    
    return user?.role || null
  } catch (error) {
    console.error('Error getting user role:', error)
    return null
  }
}