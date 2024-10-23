import { Request, Response } from 'express'

import {prisma} from './prismaClient'

export const getUserProfile = async (req: Request, res: Response) => {
  console.log('user profile')
  try {
    const claims = (req as any).claims
    const username = claims.username

    const user = await prisma.user.findUnique({
      where: { user_name: username }
    })

    if (!user) {
      return res.status(404).send('User not found')
    }

    return res.json({ 
      user_profile: user.user_profile,           
      subscription_data: {
        api_calls_available: user.api_calls_available,
        api_calls_used: user.api_calls_used,
        api_calls_total: user.api_calls_total,
        subscription_status: user.subscription_status
      }, 
      email_confirmed: !user.email_confirmation_token,
      subscription_status: user.subscription_status,
      subscription_session: !!user.subscription_checkout_session_id,
      cookies: user.cookies,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).send('Internal Server Error')
  }
}

export const postUserProfile = async (req: Request, res: Response) => {
  console.log('user profile post')
  try {
    const claims = (req as any).claims
    const username = claims.username

    const parseUserDataFromRequest = (req: Request) => {
      const profileInfo = {
        profileInfo: req.body.user_profile.profileInfo,
        dataSettings: req.body.user_profile.cookies,
      }

      return {
        user_profile: profileInfo

      }
    }

    if (req.body.user_profile) {
      const userData = parseUserDataFromRequest(req)
      const updatedUser = await prisma.user.update({
          where: { user_name: username },
          data: userData
        })

      return res.json({
        user_profile: updatedUser.user_profile,
        cookies: updatedUser.cookies,
        email_confirmed: !updatedUser.email_confirmation_token,
        subscription_status: updatedUser.subscription_status,
        subscription_session: !!updatedUser.subscription_checkout_session_id,          
        subscription_data: {
          api_calls_available: updatedUser.api_calls_available,
          api_calls_used: updatedUser.api_calls_used,
          api_calls_total: updatedUser.api_calls_total,
          subscription_status: updatedUser.subscription_status
        },
      })
    } else {

      const user = await prisma.user.findUnique({
        where: { user_name: username }
      })

      if (!user) {
        return res.status(404).send('User not found')
      }

      return res.json({
        user_profile: user.user_profile,
        cookies: user.cookies,
        email_confirmed: !user.email_confirmation_token,
        subscription_status: user.subscription_status,
        subscription_session: !!user.subscription_checkout_session_id,
        subscription_data: {
          api_calls_available: user.api_calls_available,
          api_calls_used: user.api_calls_used,
          api_calls_total: user.api_calls_total,
          subscription_status: user.subscription_status
        },
      })
    }

  } catch (error) {
    console.error(error)
    return res.status(500).send('Internal Server Error')
  }
}
