import { Request, Response } from 'express'

import {prisma} from './prismaClient'

export const putError = async (req: Request, res: Response) => {
  console.log('error')

  try {
    const { email, error } = req.body

    const errorWithClientDetails = {
      ...error,
      clientDetails: (req as any).clientDetails
    }

    const user = await prisma.userModel.findUnique({
      where: { user_name: email }
    })

    const errorObject = await prisma.clientErrorModel.create({
      data: {
        error,
        ...( email ? { 
          user: {
            connect: {
              user_name: email ? email : null
            }
          } 
        } : {}),
      }
    })

    return res.status(201)
  } catch (error) {
    console.error(error)
    return res.status(500).send('Internal Server Error')
  }
}
