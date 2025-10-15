import { Request, Response } from 'express'
import Stripe from 'stripe'

import {prisma} from '../prismaClient'
import { tokenManager } from '../tokenManager'

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

const stripe = new Stripe(STRIPE_TOKEN, { apiVersion: '2024-10-28.acacia' })

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
      console.log('⚠️  No body in request')
      return res.sendStatus(400)
    }

    if(!signature) {
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
      console.log('⚠️  Webhook signature verification failed.', !!req.body, !!signature, !!webhookSecret, err.message)
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

  console.log('Received Connect event:', eventType)

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
    // ... handle other event
    case 'account.updated':
      const account = data.object as Stripe.Account
      await handleAccountUpdated(account)
      break
    case 'account.application.authorized':
      const authorizedAccount = data.object as Stripe.Account
      await handleAccountAuthorized(authorizedAccount)
      break
    case 'account.application.deauthorized':
      const deauthorizedAccount = data.object as Stripe.Account
      await handleAccountDeauthorized(deauthorizedAccount)
      break
    case 'account.external_account.created':
      const bankAccount = data.object as Stripe.BankAccount
      await handleBankAccountCreated(bankAccount)
      break
    case 'payout.created':
      const payout = data.object as Stripe.Payout
      await handlePayoutCreated(payout)
      break
    case 'payout.failed':
      const failedPayout = data.object as Stripe.Payout
      await handlePayoutFailed(failedPayout)
      break
    case 'payout.paid':
      const paidPayout = data.object as Stripe.Payout
      await handlePayoutPaid(paidPayout)
      break
    case 'payment_intent.succeeded':
      const paymentIntent = data.object as Stripe.PaymentIntent;
      if (paymentIntent.application_fee_amount) {
        await prisma.platformFee.create({
          data: {
            amount: paymentIntent.application_fee_amount,
            payment_intent_id: paymentIntent.id,
            connected_account_id: paymentIntent.transfer_data?.destination as string,
            status: 'collected'
          }
        });
      }
      break;

    case 'charge.failed':
      const charge = data.object as Stripe.Charge;
      // Handle failed platform fee collection
      await handleFailedCharge(charge);
      break;
    default:
      console.log(`Unhandled event type ${eventType}`)
  }

  // Return a response to acknowledge receipt of the event
  return res.json({ received: true })
}

async function handleAccountUpdated(account: Stripe.Account) {
  console.log('Account updated:', account.id)
  await prisma.userModel.update({
    where: { stripe_connected_account_id: account.id },
    data: {
      stripe_account_enabled: account.charges_enabled,
      stripe_payouts_enabled: account.payouts_enabled,
      stripe_account_status: account.details_submitted ? 'complete' : 'pending'
    }
  })
}

async function handleAccountAuthorized(account: Stripe.Account) {
  console.log('Account authorized:', account.id)
  await prisma.userModel.update({
    where: { stripe_connected_account_id: account.id },
    data: {
      stripe_account_status: 'authorized',
      stripe_account_enabled: true
    }
  })
}

async function handleAccountDeauthorized(account: Stripe.Account) {
  console.log('Account deauthorized:', account.id)
  await prisma.userModel.update({
    where: { stripe_connected_account_id: account.id },
    data: {
      stripe_account_status: 'deauthorized',
      stripe_account_enabled: false,
      stripe_payouts_enabled: false
    }
  })
}

async function handleBankAccountCreated(bankAccount: Stripe.BankAccount) {
  console.log('Bank account created:', bankAccount.account)
  // Optionally track bank account details
  await prisma.userModel.update({
    where: { stripe_connected_account_id: bankAccount.account as string },
    data: {
      has_bank_account: true,
      last_bank_account_added: new Date()
    }
  })
}

async function handlePayoutCreated(payout: Stripe.Payout) {
  console.log('Payout created:', payout.id)
  await prisma.stripePayoutModel.create({
    data: {
      payout_id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      user: {
        connect: {
          stripe_connected_account_id: payout.destination as string
        }
      }
    }
  })
}

async function handlePayoutFailed(payout: Stripe.Payout) {
  console.log('Payout failed:', payout.id)
  await prisma.stripePayoutModel.update({
    where: { payout_id: payout.id },
    data: {
      status: 'failed',
      failure_reason: payout.failure_message || 'Unknown error'
    }
  })
}

async function handlePayoutPaid(payout: Stripe.Payout) {
  console.log('Payout paid:', payout.id)
  await prisma.stripePayoutModel.update({
    where: { payout_id: payout.id },
    data: {
      status: 'paid',
      arrival_date: new Date(payout.arrival_date * 1000)
    }
  })
}

async function handleFailedCharge(charge: Stripe.Charge) {
  // Update user's payment status
  await prisma.userModel.update({
    where: { stripe_connected_account_id: charge.on_behalf_of as string },
    data: {
      payment_status: 'failed',
      last_payment_error: charge.failure_message
    }
  });

}
  
async function handleSessionCompleted (session: Stripe.Checkout.Session) {
  console.log('Session completed', session.id, session)

  // Check if this is a token purchase
  if (session.metadata?.type === 'token_purchase') {
    try {
      await handleTokenPurchaseCompleted(session)
      return
    } catch (error) {
      console.error('Error handling token purchase completion:', error)
      return
    }
  }

  // Handle subscription checkout
  const user = await prisma.userModel.update({
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

async function handleTokenPurchaseCompleted(session: Stripe.Checkout.Session) {
  if (!session.metadata?.userId || !session.metadata?.tokenAmount || !session.metadata?.purchaseId) {
    console.error('Missing required metadata in token purchase session:', session.id)
    return
  }
  
  const { userId, tokenAmount, purchaseId } = session.metadata
  
  console.log('Token purchase completed:', {
    sessionId: session.id,
    userId,
    tokenAmount,
    purchaseId
  })

  try {
    // Update purchase record with payment intent
    const purchase = await prisma.tokenPurchaseModel.update({
      where: { stripeCheckoutSessionId: session.id },
      data: {
        stripePaymentIntentId: session.payment_intent as string,
        status: 'completed',
        processedAt: new Date()
      }
    })

    // Credit tokens to user
    await tokenManager.creditTokens(
      parseInt(userId),
      parseInt(tokenAmount),
      `Token purchase: ${tokenAmount} tokens`,
      'purchase',
      purchase.id,
      session.payment_intent as string,
      {
        sessionId: session.id,
        priceInCents: purchase.priceInCents,
        pricePerTokenCents: purchase.pricePerTokenCents.toString()
      }
    )

    console.log('Token purchase processed successfully:', purchaseId)
  } catch (error) {
    console.error('Error processing token purchase:', error)
    
    // Mark purchase as failed
    await prisma.tokenPurchaseModel.update({
      where: { stripeCheckoutSessionId: session.id },
      data: { status: 'failed' }
    })
  }
}

async function handleInvoicePaid (invoice: Stripe.Invoice) {
  // Example: Update user's subscription status or credits
  const user = await prisma.userModel.update({
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
  const user = await prisma.userModel.update({
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
