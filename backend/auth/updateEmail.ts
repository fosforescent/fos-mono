import { Request, Response } from 'express'
import { hashPassword } from './register'
import bcrypt from 'bcrypt'
import { generateLinkToken, sendConfirmationEmail } from '../email/email'

import jwt from 'jsonwebtoken'

import {prisma} from '../prismaClient'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  console.error('JWT_SECRET not set')
  throw new Error('JWT_SECRET not set')
}


export const postUpdateEmail = async (req: Request, res: Response) => {
  const claims = (req as any).claims
  const username = claims.username
  const { email } = req.body

  if (claims.username === email) {
    return res.status(400).json({ error: 'New email is the same as the old email' })
  }
  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }

  const user = await prisma.user.findUnique({
    where: { user_name: username }
  })

  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }
  const { token, expiration } = generateLinkToken()

  const newUser = await prisma.user.update({
    where: { user_name: user.user_name },
    data: {
      user_name: email,
      email_confirmation_token: token,
      email_confirmation_expiration: expiration
    }
  })

  console.log('newUser:', newUser, 'email: ', email, newUser)

  await sendConfirmationEmail(newUser.user_name, token, (req as any).clientDetails)

  const newClaims = {
    username: newUser.user_name,
    exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60) // 8 hours from now
  }

  const newToken = jwt.sign(claims, JWT_SECRET)

  return res.json({ access_token: token, type: 'Bearer' })
}
