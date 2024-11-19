import { Request, Response } from 'express'

import {prisma} from './prismaClient'
import { InfoState, SubscriptionInfo, UserProfile } from '@/frontend/types'

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



    const result: InfoState =  {
      profile: user.user_profile as unknown as UserProfile,
      cookies: user.cookies as unknown as { acceptRequiredCookies: boolean, acceptSharingWithThirdParties: boolean },
      emailConfirmed: !user.email_confirmation_token,
      subscription: {
        apiCallsAvailable: user.api_calls_available,
        apiCallsUsed: user.api_calls_used,
        apiCallsTotal: user.api_calls_total,
        subscriptionStatus: user.subscription_status,
        connectedAccountCreated: !!user.stripe_connected_account_id,
        connectedAccountLinked: !!user.stripe_connect_linked,
        connectedAccountEnabled: !!user.stripe_connect_enabled,
        // subscription_session: !!updatedUser.subscription_checkout_session_id,
      },
    }
    return res.json(result)


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
          data: {
            user_profile: userData.user_profile.profileInfo,
            cookies: userData.user_profile.dataSettings,

          }
        })

      

      const result: InfoState =  {
        profile: updatedUser.user_profile as unknown as UserProfile,
        cookies: updatedUser.cookies as unknown as { acceptRequiredCookies: boolean, acceptSharingWithThirdParties: boolean },
        emailConfirmed: !updatedUser.email_confirmation_token,
        subscription: {
          apiCallsAvailable: updatedUser.api_calls_available,
          apiCallsUsed: updatedUser.api_calls_used,
          apiCallsTotal: updatedUser.api_calls_total,
          subscriptionStatus: updatedUser.subscription_status,
          connectedAccountCreated: !!updatedUser.stripe_connected_account_id,
          connectedAccountLinked: !!updatedUser.stripe_connect_linked,
          connectedAccountEnabled: !!updatedUser.stripe_connect_enabled,
          // subscription_session: !!updatedUser.subscription_checkout_session_id,
        },
      }
      return res.json(result)
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
          apiCallsAvailable: user.api_calls_available,
          apiCallsUsed: user.api_calls_used,
          apiCallsTotal: user.api_calls_total,
          subscriptionStatus: user.subscription_status,
          connectedAccountCreated: !!user.stripe_connected_account_id,
          connectedAccountLinked: !!user.stripe_connect_linked,
          connectedAccountEnabled: !!user.stripe_connect_enabled,
          // subscription_session: !!user.subscription_checkout_session_id,
        },
      })
    }

  } catch (error) {
    console.error(error)
    return res.status(500).send('Internal Server Error')
  }
}
