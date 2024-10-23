import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

import {prisma} from './../prismaClient'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  console.error('JWT_SECRET not set')
  throw new Error('JWT_SECRET not set')
}

interface UserLogin {
    username: string;
    password: string;
}

export const postLogin = async (req: Request, res: Response) => {
  const credentials: UserLogin = req.body

  // Check if username or password is a blank string
  if (!credentials.username || !credentials.password) {
    return res.status(400).json({ error: 'Missing credentials' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { user_name: credentials.username }
    })

    if (!user) {
      return res.status(404).json({ error: 'User does not exist' })
    }

    // Verify password
    const match = await bcrypt.compare(credentials.password, user.password)

    if (match) {
      const claims = {
        username: user.user_name,
        exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60) // 8 hours from now
      }

      const token = jwt.sign(claims, JWT_SECRET)

      return res.json({ access_token: token, type: 'Bearer' })
    } else {
      return res.status(401).json({ error: 'Wrong credentials' })
    }
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
