import { prisma } from './prismaClient'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_TOKEN || '', {
  apiVersion: '2024-11-20.acacia'
})

export interface TokenTransaction {
  transactionId: string
  userId: number
  toolUseId?: string
  tokenPurchaseId?: number
  type: 'debit' | 'credit' | 'subscription_grant' | 'purchase'
  amount: number
  description: string
  balanceBefore: number
  balanceAfter: number
  metadata?: any
  stripePaymentIntentId?: string
}

export interface TokenBalance {
  userId: number
  availableTokens: number
  totalPurchased: number
  totalUsed: number
  subscriptionTokens: number
  purchasedTokens: number
}

export class TokenManager {
  
  /**
   * Get or create token balance for a user
   */
  async getUserTokenBalance(userId: number): Promise<TokenBalance> {
    let balance = await prisma.userTokenBalanceModel.findUnique({
      where: { userId }
    })

    if (!balance) {
      balance = await prisma.userTokenBalanceModel.create({
        data: {
          userId,
          availableTokens: 0,
          totalPurchased: 0,
          totalUsed: 0,
          subscriptionTokens: 0,
          purchasedTokens: 0
        }
      })
    }

    return {
      userId: balance.userId,
      availableTokens: balance.availableTokens,
      totalPurchased: balance.totalPurchased,
      totalUsed: balance.totalUsed,
      subscriptionTokens: balance.subscriptionTokens,
      purchasedTokens: balance.purchasedTokens
    }
  }

  /**
   * Check if user has sufficient tokens for a transaction
   */
  async hasEnoughTokens(userId: number, requiredTokens: number): Promise<boolean> {
    const balance = await this.getUserTokenBalance(userId)
    return balance.availableTokens >= requiredTokens
  }

  /**
   * Debit tokens from user's balance (for tool usage)
   */
  async debitTokens(
    userId: number, 
    amount: number, 
    description: string,
    toolUseId?: string,
    metadata?: any
  ): Promise<TokenTransaction> {
    return await prisma.$transaction(async (tx) => {
      // Get current balance
      const balance = await tx.userTokenBalanceModel.findUnique({
        where: { userId }
      })

      if (!balance) {
        throw new Error('User token balance not found')
      }

      if (balance.availableTokens < amount) {
        throw new Error('Insufficient tokens')
      }

      const balanceBefore = balance.availableTokens
      const balanceAfter = balanceBefore - amount

      // Update balance
      await tx.userTokenBalanceModel.update({
        where: { userId },
        data: {
          availableTokens: balanceAfter,
          totalUsed: balance.totalUsed + amount
        }
      })

      // Create transaction record
      const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const transaction = await tx.tokenTransactionModel.create({
        data: {
          transactionId,
          userId,
          toolUseId,
          type: 'debit',
          amount: -amount, // Negative for debit
          description,
          balanceBefore,
          balanceAfter,
          metadata: metadata || {}
        }
      })

      return {
        transactionId: transaction.transactionId,
        userId: transaction.userId,
        toolUseId: transaction.toolUseId || undefined,
        type: transaction.type as 'debit',
        amount: transaction.amount,
        description: transaction.description,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        metadata: transaction.metadata
      }
    })
  }

  /**
   * Credit tokens to user's balance (for purchases, grants, refunds)
   */
  async creditTokens(
    userId: number,
    amount: number,
    description: string,
    type: 'credit' | 'subscription_grant' | 'purchase' = 'credit',
    tokenPurchaseId?: number,
    stripePaymentIntentId?: string,
    metadata?: any
  ): Promise<TokenTransaction> {
    return await prisma.$transaction(async (tx) => {
      // Get or create balance
      let balance = await tx.userTokenBalanceModel.findUnique({
        where: { userId }
      })

      if (!balance) {
        balance = await tx.userTokenBalanceModel.create({
          data: {
            userId,
            availableTokens: 0,
            totalPurchased: 0,
            totalUsed: 0,
            subscriptionTokens: 0,
            purchasedTokens: 0
          }
        })
      }

      const balanceBefore = balance.availableTokens
      const balanceAfter = balanceBefore + amount

      // Update balance based on type
      const updateData: any = {
        availableTokens: balanceAfter,
        totalPurchased: balance.totalPurchased + amount
      }

      if (type === 'subscription_grant') {
        updateData.subscriptionTokens = balance.subscriptionTokens + amount
      } else if (type === 'purchase') {
        updateData.purchasedTokens = balance.purchasedTokens + amount
      }

      await tx.userTokenBalanceModel.update({
        where: { userId },
        data: updateData
      })

      // Create transaction record
      const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const transaction = await tx.tokenTransactionModel.create({
        data: {
          transactionId,
          userId,
          tokenPurchaseId,
          type,
          amount, // Positive for credit
          description,
          balanceBefore,
          balanceAfter,
          metadata: metadata || {},
          stripePaymentIntentId
        }
      })

      return {
        transactionId: transaction.transactionId,
        userId: transaction.userId,
        tokenPurchaseId: transaction.tokenPurchaseId || undefined,
        type: transaction.type as any,
        amount: transaction.amount,
        description: transaction.description,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        metadata: transaction.metadata,
        stripePaymentIntentId: transaction.stripePaymentIntentId || undefined
      }
    })
  }

  /**
   * Get transaction history for a user
   */
  async getUserTransactionHistory(
    userId: number,
    limit: number = 50,
    offset: number = 0,
    type?: string
  ) {
    const where: any = { userId }
    if (type) {
      where.type = type
    }

    const transactions = await prisma.tokenTransactionModel.findMany({
      where,
      include: {
        toolUse: {
          select: {
            toolName: true,
            server: {
              select: {
                name: true
              }
            }
          }
        },
        tokenPurchase: {
          select: {
            tokenAmount: true,
            priceInCents: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    })

    const totalCount = await prisma.tokenTransactionModel.count({ where })

    return {
      transactions,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: totalCount > offset + limit
      }
    }
  }

  /**
   * Reset subscription tokens (called monthly for subscription users)
   */
  async resetSubscriptionTokens(userId: number, newSubscriptionTokens: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const balance = await tx.userTokenBalanceModel.findUnique({
        where: { userId }
      })

      if (!balance) {
        throw new Error('User token balance not found')
      }

      // Calculate new available tokens (purchased tokens + new subscription tokens)
      const newAvailableTokens = balance.purchasedTokens + newSubscriptionTokens

      await tx.userTokenBalanceModel.update({
        where: { userId },
        data: {
          availableTokens: newAvailableTokens,
          subscriptionTokens: newSubscriptionTokens,
          lastResetAt: new Date()
        }
      })

      // Create transaction record for subscription grant
      const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      await tx.tokenTransactionModel.create({
        data: {
          transactionId,
          userId,
          type: 'subscription_grant',
          amount: newSubscriptionTokens,
          description: 'Monthly subscription token grant',
          balanceBefore: balance.availableTokens,
          balanceAfter: newAvailableTokens,
          metadata: {
            resetType: 'monthly_subscription',
            previousSubscriptionTokens: balance.subscriptionTokens
          }
        }
      })
    })
  }

  /**
   * Create a Stripe checkout session for token purchase
   */
  async createTokenPurchaseCheckout(
    userId: number,
    tokenAmount: number,
    pricePerTokenCents: number,
    successUrl: string,
    cancelUrl: string
  ) {
    const totalPriceInCents = Math.round(tokenAmount * pricePerTokenCents)
    
    // Create purchase record
    const purchaseId = `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${tokenAmount} Tokens`,
              description: `Purchase ${tokenAmount} tokens for tool usage`
            },
            unit_amount: totalPriceInCents
          },
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: 'token_purchase',
        userId: userId.toString(),
        tokenAmount: tokenAmount.toString(),
        pricePerTokenCents: pricePerTokenCents.toString(),
        purchaseId
      }
    })

    // Store purchase record
    await prisma.tokenPurchaseModel.create({
      data: {
        purchaseId,
        userId,
        tokenAmount,
        priceInCents: totalPriceInCents,
        pricePerTokenCents,
        stripeCheckoutSessionId: session.id,
        status: 'pending'
      }
    })

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      purchaseId
    }
  }

  /**
   * Process completed token purchase (called from Stripe webhook)
   */
  async processTokenPurchase(stripePaymentIntentId: string): Promise<void> {
    const purchase = await prisma.tokenPurchaseModel.findUnique({
      where: { stripePaymentIntentId }
    })

    if (!purchase) {
      throw new Error('Token purchase not found')
    }

    if (purchase.status === 'completed') {
      return // Already processed
    }

    // Credit tokens to user
    await this.creditTokens(
      purchase.userId,
      purchase.tokenAmount,
      `Token purchase: ${purchase.tokenAmount} tokens`,
      'purchase',
      purchase.id,
      stripePaymentIntentId,
      {
        priceInCents: purchase.priceInCents,
        pricePerTokenCents: purchase.pricePerTokenCents.toString()
      }
    )

    // Update purchase status
    await prisma.tokenPurchaseModel.update({
      where: { id: purchase.id },
      data: {
        status: 'completed',
        processedAt: new Date()
      }
    })
  }

  /**
   * Get token pricing for a specific tool
   */
  async getToolPricing(serverId: number, toolName: string): Promise<number> {
    const pricing = await prisma.mCPToolPricingModel.findFirst({
      where: {
        serverId,
        toolName,
        isEnabled: true
      }
    })

    return pricing?.pricePerUseTokens || 0
  }

  /**
   * Set token pricing for a tool
   */
  async setToolPricing(
    serverId: number,
    toolName: string,
    pricePerUseTokens: number,
    isEnabled: boolean = true
  ): Promise<void> {
    await prisma.mCPToolPricingModel.upsert({
      where: {
        serverId_toolName: {
          serverId,
          toolName
        }
      },
      update: {
        pricePerUseTokens,
        isEnabled
      },
      create: {
        serverId,
        toolName,
        pricePerUseTokens,
        isEnabled
      }
    })
  }

  /**
   * Get all tool pricing for a server
   */
  async getServerToolPricing(serverId: number) {
    return await prisma.mCPToolPricingModel.findMany({
      where: { serverId },
      orderBy: { toolName: 'asc' }
    })
  }
}

export const tokenManager = new TokenManager()