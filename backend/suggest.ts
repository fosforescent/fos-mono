import { Request, Response } from 'express'
import {prisma} from './prismaClient'

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OpenAI API key not found')
}


export const getSuggest = async (req: Request, res: Response) => {
  const claims = (req as any).claims
  const username = claims.username

  const user = await prisma.userModel.findUnique({
    where: { user_name: username }
  })

  if (!user) {
    res.status(401).send('User not found')
    return
  }

  if (user.api_calls_used > user.api_calls_available) {
    res.status(429).send('API limit reached')
    return
  }

  const response: any = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(req.body)
  })

  const responseJson = await response.json()

  const updatedUser = await prisma.userModel.update({
    where: { user_name: username },
    data: {
      api_calls_total: user.api_calls_total + 1,
      api_calls_used: user.api_calls_used + 1
    }
  })

  res.json({
    subscription_data: {
      api_calls_used: updatedUser.api_calls_used,
      api_calls_total: updatedUser.api_calls_total,
      api_calls_available: updatedUser.api_calls_available,
      subscription_status: updatedUser.subscription_status
    },
    responses: responseJson
  })
}
