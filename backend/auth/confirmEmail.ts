import { Request, Response } from 'express'

import { generateLinkToken, sendConfirmationEmail } from '../email/email'

import {prisma} from '../prismaClient'

const POSTMARK_API_TOKEN = process.env.POSTMARK_API_TOKEN

if (!POSTMARK_API_TOKEN) {
  console.error('POSTMARK_API_TOKEN not set')
  throw new Error('POSTMARK_API_TOKEN not set')
}

export const postConfirmEmail = async (req: Request, res: Response) => {
  const { token } = req.body

  try {
    console.log('token', token)
    const emailConfirmationUser = await prisma.user.findUnique({
      where: {
        email_confirmation_token: token
      }
    })

    if (!emailConfirmationUser) {
      return res.status(404).json({ error: 'Token not found' })
    }

    await prisma.user.update({
      where: { user_name: emailConfirmationUser.user_name },
      data: {
        email_confirmation_token: null,
        email_confirmation_expiration: null
      }
    })

    return res.json({ message: 'Email successfully confirmed!' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export const postConfirmEmailInit = async (req: Request, res: Response) => {
  const claims = (req as any).claims
  const username = claims.username

  try {
    const user = await prisma.user.findUnique({
      where: { user_name: username }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (user.email_confirmation_token === '') {
      return res.status(400).json({ message: 'Email already confirmed.' })
    }

    // Generate a new confirmation token
    const { token: newToken, expiration: newExpiration } = generateLinkToken()
    await prisma.user.update({
      data: {
        email_confirmation_token: newToken,
        email_confirmation_expiration: newExpiration // 24 hours from now
      },
      where: { user_name: username }
    })

    await sendConfirmationEmail(username, newToken, (req as any).clientDetails)

    return res.json({ message: 'A new confirmation email has been sent.' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
