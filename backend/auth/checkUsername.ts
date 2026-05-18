import { Request, Response } from 'express'

import {prisma} from '../prismaClient'

export const checkUsernameExists = async (req: Request, res: Response) => {
  const { username } = req.body

  const user = await prisma.userModel.findUnique({
    where: { user_name: username }
  })

  if (user) {
    return res.json({ exists: true })
  } else {
    return res.json({ exists: false })
  }
}
