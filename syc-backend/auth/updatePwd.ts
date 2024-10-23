import { Request, Response } from 'express'
import { hashPassword } from './register'
import bcrypt from 'bcrypt'

import { sendUpdatePasswordEmail } from '../email/email'

import {prisma} from './../prismaClient'

export const postUpdatePwd = async (req: Request, res: Response) => {
  const claims = (req as any).claims
  const username = claims.username
  const { currentPassword, newPassword } = req.body

  // Check if username or password is a blank string
  if (!username || !currentPassword || !newPassword) {
    // console.log('Missing required arguments', username, currentPassword, newPassword, claims)
    return res.status(400).json({ error: 'Missing required arguments' })
  }

  const user = await prisma.user.findUnique({
    where: { user_name: username }
  })

  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  // console.log(currentPassword, user.password, newPassword);

  // Verify password
  const match = await bcrypt.compare(currentPassword, user.password)

  if (!match) {
    return res.status(401).json({ error: 'Wrong credentials' })
  }

  const hashedNewPassword = await hashPassword(newPassword)

  await prisma.user.update({
    where: { user_name: user.user_name },
    data: {
      password: hashedNewPassword,
      password_reset_token: null,
      password_reset_expiration: null
    }
  })

  sendUpdatePasswordEmail(username, (req as any).clientDetails)

  return res.json({ message: 'Password has been successfully reset.' })
}
