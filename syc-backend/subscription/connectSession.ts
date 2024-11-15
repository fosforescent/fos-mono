import { Request, Response } from 'express'
import Stripe from 'stripe'
import { prisma } from './../prismaClient'

const stripe = new Stripe(process.env.STRIPE_TOKEN!, { apiVersion: '2024-10-28.acacia' })

interface ConnectAccountCreateRequest {
  success_url: string;
  cancel_url: string;
}









app.post("/account_link", async (req, res) => {
    try {
      const { account } = req.body;
  
      const accountLink = await stripe.accountLinks.create({
        account: account,
        return_url: `${req.headers.origin}/return/${account}`,
        refresh_url: `${req.headers.origin}/refresh/${account}`,
        type: "account_onboarding",
      });
  
      res.json(accountLink);
    } catch (error) {
      console.error(
        "An error occurred when calling the Stripe API to create an account link:",
        error
      );
      res.status(500);
      res.send({ error: error.message });
    }
  });
  
  app.post("/account", async (req, res) => {
    try {
      const account = await stripe.accounts.create({});
  
      res.json({
        account: account.id,
      });
    } catch (error) {
      console.error(
        "An error occurred when calling the Stripe API to create an account",
        error
      );
      res.status(500);
      res.send({ error: error.message });
    }
  });


export const postCreateOrGetConnectAccount = async (req: Request, res: Response) => {
  const { success_url, cancel_url }: ConnectAccountCreateRequest = req.body
  const claims = (req as any).claims
  const username = claims.username

  try {
    // Check if user already has a connected account
    const existingUser = await prisma.user.findUnique({
      where: { user_name: username }
    })

    if (existingUser?.stripe_connected_account_id) {
      // If they have an account, create a login link
      const loginLink = await stripe.accounts.createLoginLink(
        existingUser.stripe_connected_account_id,
        {
          redirect_url: success_url
        }
      )
      return res.json({ url: loginLink.url })
    }

    // Create a new Connect account
    const account = await stripe.accounts.create({
      type: 'express',
      email: username,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
        // If you need users to do recurring payments:
        card_issuing: { requested: true },
        // For subscriptions:
        transfers_requested: { requested: true }
      },
      settings: {
        payouts: {
          schedule: {
            interval: 'manual' // Or 'daily', 'weekly', etc.
          }
        }
      }
    })

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: cancel_url,
      return_url: success_url,
      type: 'account_onboarding'
    })

    // Save the connected account ID
    await prisma.user.update({
      where: { user_name: username },
      data: { 
        stripe_connected_account_id: account.id,
        stripe_account_enabled: false
      }
    })

    res.json({ url: accountLink.url })
  } catch (error) {
    console.error('Error with Connect account:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Process a payment between two connect accounts
export const processPayment = async (req: Request, res: Response) => {
  const { amount, recipient_id, currency = 'usd' } = req.body
  const claims = (req as any).claims
  const sender_id = claims.stripe_connected_account_id

  try {
    const payment = await stripe.charges.create({
      amount,
      currency,
      source: sender_id,
      transfer_data: {
        destination: recipient_id,
      },
    })

    res.json({ success: true, payment })
  } catch (error) {
    console.error('Payment error:', error)
    res.status(500).json({ error: 'Payment failed' })
  }
}

