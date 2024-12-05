import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import uaParser from 'ua-parser-js'


import {prisma} from './prismaClient'

export interface Claims {
  username: string;
  exp: number;
  // Add other properties as needed
}

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  console.error('JWT_SECRET not set')
  throw new Error('JWT_SECRET not set')
}

// Middleware to verify JWT
export const verifyJWTMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Auth Header' })
    }

    const token = authHeader.slice(7) // Remove "Bearer " prefix
    const decoded = jwt.verify(token, JWT_SECRET) as Claims; // Cast the decoded token to your Claims interface
    // console.log('decoded', decoded);

    // Attach the claims to the request object to use in subsequent handlers
    (req as any).claims = decoded

    // Query user and make sure they're approved
    const user = await prisma.userModel.findUnique({
      where: { user_name: (req as any).claims.username }
    })

    if (!user) {
      return res.status(401).json({ error: 'User not found or not approved' })
    }

    if (!user.approved) {
      return res.status(401).json({ error: 'User not approved' })
    }

    return next()
  } catch (error) {
    console.error(error)
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token Expired' })
    } else {
      return res.status(401).json({ error: 'Invalid token' })
    }
  }
}
