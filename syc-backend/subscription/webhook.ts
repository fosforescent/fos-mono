import { Request, Response } from 'express'
import Stripe from 'stripe'

import {prisma} from './../prismaClient'

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

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

if (!STRIPE_WEBHOOK_SECRET) {
  console.error('STRIPE_WEBHOOK_SECRET not set')
  throw new Error('STRIPE_WEBHOOK_SECRET not set')
}

const stripe = new Stripe(STRIPE_TOKEN, { apiVersion: '2023-10-16' })

interface CheckoutSessionCreateRequest {
  success_url: string;
  cancel_url: string;
}

export const postSubscriptionWebhook = async (req: Request, res: Response) => {
  let data
  let eventType
  // Check if webhook signing is configured.
  const webhookSecret = STRIPE_WEBHOOK_SECRET
  if (webhookSecret) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event
    const signature = req.headers['stripe-signature']!

    if(!req.body) {
      console.log('body', typeof req.body, req.body)
      console.log('⚠️  No body in request')
      return res.sendStatus(400)
    }

    if(!signature) {
      // console.log('signature', typeof signature, signature)
      console.log('⚠️  No signature in request')
      return res.sendStatus(400)
    }

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      )
    } catch (err: any) {
      // console.log('body', typeof req.body, signature, webhookSecret, req.body)
      console.log('⚠️  Webhook signature verification failed.',  !!req.body, !!signature, !!webhookSecret, err.message)
      return res.sendStatus(400)
    }
    // Extract the object from the event.
    data = event.data
    eventType = event.type
  } else {
    // Webhook signing is recommended, but if the secret is not configured in `config.js`,
    // retrieve the event data directly from the request body.
    data = req.body.data
    eventType = req.body.type
  }

  console.log('Received event:', eventType)

  // Handle the event
  switch (eventType) {
    case 'checkout.session.completed':
      const session = data.object
      // Handle checkout session completion
      await handleSessionCompleted(session)
      break
    case 'invoice.paid':
      const invoice = data.object
      // Handle invoice payment
      await handleInvoicePaid(invoice)
      break
    case 'invoice.payment_failed':
      const failedInvoice = data.object
      // Handle failed invoice payment
      await handlePaymentFailed(failedInvoice)
      break
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${eventType}`)
  }

  // Return a response to acknowledge receipt of the event
  return res.json({ received: true })
}

async function handleSessionCompleted (session: Stripe.Checkout.Session) {
  // Example: Update user's subscription status based on session details
  console.log('Session completed', session.id, session)
  const user = await prisma.user.update({
    where: { subscription_checkout_session_id: session.id },
    data: { 
      subscription_status: 'active',
      stripe_customer_id: session.customer as string,
      subscription_checkout_session_id: null
    }
  })
  if (!user) {
    console.error('User not found -- session completed')
    return
  }
  console.log('Checkout session completed')
}

async function handleInvoicePaid (invoice: Stripe.Invoice) {
  // Example: Update user's subscription status or credits
  const user = await prisma.user.update({
    where: { stripe_customer_id: invoice.customer as string },
    data: { 
      subscription_status: 'active',
      api_calls_available: {
        increment: 3000
      }
     }    
  })
  if (!user) {
    console.error('User not found -- invoice paid')
    return
  }
  console.log('Invoice paid')
  // Similar database update logic as handleSessionCompleted
}

async function handlePaymentFailed (invoice: Stripe.Invoice) {
  // Example: Mark subscription as inactive or payment as failed
  const user = await prisma.user.update({
    where: { stripe_customer_id: invoice.customer as string },
    data: { subscription_status: 'lapsed' }    
  })
  if (!user) {
    console.error('User not found -- payment failed')
    return
  }
  console.log('Payment failed')
  // Similar database update logic as handleSessionCompleted
}
