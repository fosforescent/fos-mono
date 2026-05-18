import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import uaParser from 'ua-parser-js'


export interface Claims {
  username: string;
  exp: number;
  // Add other properties as needed
}

export interface ClientDetails {
  ipAddress: string;
  userAgent: string;
  browser: string;
  os: string;
}

// Middleware to verify JWT
export const clientDetailsMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    const userAgent = req.headers['user-agent']
    // parse browser and os from user-agent
    const ua = uaParser(userAgent)
    const browser = ua.browser.name
    const os = ua.os.name;

    (req as any).clientDetails = {
      ipAddress,
      userAgent,
      browser,
      os
    }

    return next()
  } catch (error) {
    console.error(error)
    return res.status(400).json({ error: 'client detail read failed' })
  }
}
