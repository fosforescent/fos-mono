import { Request, Response } from 'express'
import { hashPassword } from './register'

import { generateLinkToken, sendPasswordResetEmail } from '../email/email'

import {prisma} from '../prismaClient'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  console.error('JWT_SECRET not set')
  throw new Error('JWT_SECRET not set')
}

interface UserLogin {
    username: string;
    password: string;
}

export const postResetPwdUpdate = async (req: Request, res: Response) => {
  const { token, password: newPassword, email } = req.body

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required.' })
  }

  const user = await prisma.user.findUnique({
    where: {
      password_reset_token: token,
      user_name: email
    }
  })

  if (!user || new Date() > user.password_reset_expiration!) {
    return res.status(400).json({ message: 'Invalid or expired password reset token.' })
  }

  // validate password
  // match at least one uppercase letter and number
  if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'Password must contain at least one uppercase letter and one number' })
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' })
  }

  const hashedNewPassword = await hashPassword(newPassword)

  // if (hashedNewPassword === user.password) {
  //   return res.status(400).json({ message: "Password must be different from the previous password." });
  // }

  await prisma.user.update({
    where: { user_name: user.user_name },
    data: {
      password: hashedNewPassword,
      password_reset_token: '',
      password_reset_expiration: null
    }
  })

  return res.json({ message: 'Password has been successfully reset.' })
}

export const postResetPwd = async (req: Request, res: Response) => {
  const { username } = req.body

  const user = await prisma.user.findUnique({
    where: { user_name: username }
  })

  if (!user) {
    // Consider whether to reveal if a user was found for security reasons
    console.log('No user found with that email address', username)
    return res.status(200).json({ message: "If an account with that email exists, we've sent a password reset link." })
  }

  // Generate password reset token
  const { token, expiration } = generateLinkToken() // Ensure you have a generateToken function similar to the previous example
  await prisma.user.update({
    data: {
      password_reset_token: token,
      password_reset_expiration: expiration
    },
    where: {
      user_name: username
    }
  })

  console.log('clientDetails', username, (req as any).clientDetails)

  await sendPasswordResetEmail(user.user_name, token, (req as any).clientDetails)

  return res.json({ message: "If an account with that email exists, we've sent a password reset link." })
}
