import { Request, Response } from 'express'
import { InboundEmail, OutboundEmail } from '@prisma/client'
import { deliverInboundEmail } from './email'

import {prisma} from '../prismaClient'

export const postContactMessage = async (req: Request, res: Response) => {
  console.log('contact message')
  try {
    const { message, email } = req.body

    const inboundEmail = await prisma.inboundEmail.create({
      data: {
        from: 'inbound@fosforescent.com',
        to: 'dmn322@gmail.com ',
        subject: `Fos inbound email from ${email}`,
        textBody: message
      }
    })

    deliverInboundEmail(inboundEmail)

    res.status(201).json(inboundEmail)
  } catch (error) {
    console.error(error)
    res.status(500).send('Internal Server Error')
  }
}
