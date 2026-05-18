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

export const postCreateCheckoutSession = async (req: Request, res: Response) => {
  const { success_url, cancel_url }: CheckoutSessionCreateRequest = req.body
  const claims = (req as any).claims
  const username = claims.username
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: process.env.STRIPE_SUBSCRIPTION_PRICE_ID, // Ensure you have a .env variable or another config for this
        quantity: 1
      }],
      mode: 'subscription',
      success_url,
      cancel_url,
      customer_email: username // Optional: Only if you want to specify the customer email upfront
    })

    // Optional: Save the session ID to your database
    const user = await prisma.userModel.update({
      where: { user_name: username },
      data: { subscription_checkout_session_id: session.id }
    })

    res.json({ url: session.url })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
