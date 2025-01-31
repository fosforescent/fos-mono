import { Request, Response } from 'express'
import Stripe from 'stripe'

import {prisma} from '../prismaClient'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  console.error('JWT_SECRET not set')
  throw new Error('JWT_SECRET not set')
}

const STRIPE_TOKEN = process.env.STRIPE_TOKEN

if (!STRIPE_TOKEN) {
  console.error('STRIPE_TOKEN not set')
  throw new Error('STRIPE_TOKEN not set')
}

const stripe = new Stripe(STRIPE_TOKEN, { apiVersion: '2024-10-28.acacia' })

interface CheckoutSessionCreateRequest {
  success_url: string;
  cancel_url: string;
}

interface PortalSessionRequest {
    return_url: string;
  }

export const postCreatePortalSession = async (req: Request, res: Response) => {
  const { return_url }: PortalSessionRequest = req.body
  const claims = (req as any).claims
  const username = claims.username

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Fetch the user by username
    const user = await prisma.userModel.findUnique({
      where: { user_name: username }
    })

    if (!user || !user.stripe_customer_id) {
      return res.status(404).json({ error: 'Stripe customer ID not found' })
    }

    // Create a Stripe Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url
    })

    // Optional: Update the user with the portal session ID in your database
    // This step is not typically necessary for portal sessions but is included for completeness
    await prisma.userModel.update({
      where: { user_name: username },
      data: { portal_session_id: session.id } // Adjust according to your schema
    })

    return res.json({ url: session.url })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
