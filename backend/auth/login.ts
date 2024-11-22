import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

import {prisma} from '../prismaClient'
import { InfoState, LoginResult } from '@/shared/types'

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
        exp: Math.floor(Date.now() / 1000) + (72 * 60 * 60) // 8 hours from now
      }

      const token = jwt.sign(claims, JWT_SECRET)

      const result: LoginResult = { 
        access_token: token, 
        type: 'Bearer',
        profile: user.user_profile as InfoState['profile'],           
        subscription: {
          apiCallsAvailable: user.api_calls_available,
          apiCallsUsed: user.api_calls_used,
          apiCallsTotal: user.api_calls_total,
          subscriptionStatus: user.subscription_status,
          connectedAccountCreated: !!user.stripe_connected_account_id,
          connectedAccountLinked: !!user.stripe_connect_linked,
          connectedAccountEnabled: !!user.stripe_connect_enabled,
          // subscription_session: !!user.subscription_checkout_session_id,
        }, 
        emailConfirmed: !user.email_confirmation_token,
        cookies: user.cookies as InfoState['cookies']
       }
      return res.json(result)
    } else {
      return res.status(401).json({ error: 'Wrong credentials' })
    }
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
