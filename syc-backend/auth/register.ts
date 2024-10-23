import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { generateLinkToken, sendConfirmationEmail } from '../email/email'

import {prisma} from './../prismaClient'
import { createUserGroup } from '../data/util'

export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, 10)
}

export const postRegister = async (req: Request, res: Response) => {
  const { username, password, accepted_terms, cookies } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' })
  }

  if (!accepted_terms) {
    return res.status(400).json({ error: 'You must accept the terms and conditions' })
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: {
      user_name: username
    }
  })

  if (existingUser) {
    return res.status(409).json({ error: 'User already exists' })
  }

  // validate password
  // match at least one uppercase letter and number
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one uppercase letter and one number' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' })
  }

  // Hash password
  const hashedPassword = await hashPassword(password) // You can adjust the salt rounds

  // Create user
  try {
    const { token, expiration } = generateLinkToken()
    const fosGroup = await createUserGroup(prisma)
    const user = await prisma.user.create({
      data: {
        user_name: username,
        password: hashedPassword,
        subscription_status: 'inactive',
        user_profile: {},
        email_confirmation_token: token,
        email_confirmation_expiration: expiration,
        password_reset_expiration: new Date(),
        accepted_terms: new Date(),
        api_calls_available: 1000,
        api_calls_used: 0,
        api_calls_total: 0,
        approved: true,
        cookies,
        fosGroup: {
          connect: {
            id: fosGroup.id
          }
        }
      },
    })


    // Omit sending password back in the response
    const { password, ...result } = user

    // Send email confirmation email
    await sendConfirmationEmail(username, token, (req as any).clientDetails)

    return res.status(201).json(result)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export const deleteAccount = async (req: Request, res: Response) => {
  const claims = (req as any).claims
  const username = claims.username

  try {
    const user = await prisma.user.delete({
      where: {
        user_name: username
      }
    })

    const appUserRoles = await prisma.appUserRole.deleteMany({
      where: {
        userId: user.id
      }
    })

    const userEvents = await prisma.userEvent.deleteMany({
      where: {
        userId: user.id
      }
    })

    res.json(user)
  } catch (error) {
    console.error(error)
    res.status(500).send('Internal Server Error')
  }
}
