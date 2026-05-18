import { Request, Response, NextFunction } from 'express'
import { authenticateApiToken } from './apiTokens'
import { prisma } from './prismaClient'

// Extended request type to include API token info
export interface ApiTokenRequest extends Request {
  apiToken?: {
    userId: number
    scopes: string[]
    username: string
  }
}

// Middleware to authenticate API tokens
export const authenticateApiTokenMiddleware = async (
  req: ApiTokenRequest, 
  res: Response, 
  next: NextFunction
) => {
  try {
    // Check for API token in Authorization header
    const authHeader = req.headers.authorization
    
    if (!authHeader) {
      return next() // No API token, continue with normal flow
    }

    // Check for Bearer token format
    let token: string | null = null
    
    if (authHeader.startsWith('Bearer ')) {
      const bearerToken = authHeader.substring(7)
      // Check if it's an API token (starts with fos_)
      if (bearerToken.startsWith('fos_')) {
        token = bearerToken
      }
    }

    if (!token) {
      return next() // Not an API token, continue with normal flow
    }

    // Authenticate the API token
    const tokenAuth = await authenticateApiToken(token)
    
    if (!tokenAuth) {
      return res.status(401).json({ 
        error: 'Invalid or expired API token' 
      })
    }

    // Get user information
    const user = await prisma.userModel.findUnique({
      where: { id: tokenAuth.userId }
    })

    if (!user) {
      return res.status(401).json({ 
        error: 'User associated with API token not found' 
      })
    }

    // Add API token info to request for use in downstream handlers
    req.apiToken = {
      userId: tokenAuth.userId,
      scopes: tokenAuth.scopes,
      username: user.user_name
    }

    // Set claims for compatibility with existing JWT middleware
    ;(req as any).claims = {
      username: user.user_name,
      userId: tokenAuth.userId
    }

    next()
  } catch (error) {
    console.error('Error in API token authentication middleware:', error)
    return res.status(500).json({ 
      error: 'Internal server error during authentication' 
    })
  }
}

// Middleware to verify API token has required scopes
export const requireApiTokenScopes = (requiredScopes: string[]) => {
  return (req: ApiTokenRequest, res: Response, next: NextFunction) => {
    // If this is not an API token request, skip scope checking
    if (!req.apiToken) {
      return next()
    }

    const { scopes } = req.apiToken

    // Check if user has all required scopes
    const hasAllScopes = requiredScopes.every(scope => 
      scopes.includes(scope) || scopes.includes('*')
    )

    if (!hasAllScopes) {
      return res.status(403).json({
        error: 'Insufficient token permissions',
        required: requiredScopes,
        available: scopes
      })
    }

    next()
  }
}

// Middleware to require either JWT or API token authentication
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiTokenReq = req as ApiTokenRequest
  
  // Check if authenticated via API token
  if (apiTokenReq.apiToken) {
    return next()
  }

  // Check if authenticated via JWT
  if ((req as any).claims) {
    return next()
  }

  return res.status(401).json({
    error: 'Authentication required. Provide either a valid JWT or API token.'
  })
}

// Utility function to check if request is using API token
export const isApiTokenRequest = (req: Request): boolean => {
  return !!(req as ApiTokenRequest).apiToken
}

// Utility function to get user ID from either JWT or API token
export const getUserId = async (req: Request): Promise<number> => {
  const apiTokenReq = req as ApiTokenRequest
  
  // If API token request
  if (apiTokenReq.apiToken) {
    return apiTokenReq.apiToken.userId
  }

  // If JWT request
  const claims = (req as any).claims
  if (claims && claims.username) {
    const user = await prisma.userModel.findUnique({
      where: { user_name: claims.username }
    })
    
    if (!user) {
      throw new Error('User not found')
    }
    
    return user.id
  }

  throw new Error('No valid authentication found')
}

// Utility function to get username from either JWT or API token
export const getUsername = (req: Request): string => {
  const apiTokenReq = req as ApiTokenRequest
  
  // If API token request
  if (apiTokenReq.apiToken) {
    return apiTokenReq.apiToken.username
  }

  // If JWT request
  const claims = (req as any).claims
  if (claims && claims.username) {
    return claims.username
  }

  throw new Error('No valid authentication found')
}