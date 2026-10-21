import { Request, Response } from 'express'
import { getUserId } from './requestUser'
import { tokenManager } from './tokenManager'
import { prisma } from './prismaClient'

// Get user's token balance
export const getUserTokenBalance = async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req)
    const balance = await tokenManager.getUserTokenBalance(userId)
    
    res.json({ balance })
  } catch (error) {
    console.error('Error fetching token balance:', error)
    res.status(500).json({ error: 'Failed to fetch token balance' })
  }
}

// Get user's token transaction history
export const getUserTokenTransactions = async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req)
    const { limit = 50, offset = 0, type } = req.query

    const result = await tokenManager.getUserTransactionHistory(
      userId,
      parseInt(limit.toString()),
      parseInt(offset.toString()),
      type?.toString()
    )

    res.json(result)
  } catch (error) {
    console.error('Error fetching token transactions:', error)
    res.status(500).json({ error: 'Failed to fetch token transactions' })
  }
}

// Create token purchase checkout session
export const createTokenPurchaseCheckout = async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req)
    const { tokenAmount, pricePerTokenCents } = req.body

    if (!tokenAmount || tokenAmount <= 0) {
      return res.status(400).json({ error: 'Invalid token amount' })
    }

    if (!pricePerTokenCents || pricePerTokenCents <= 0) {
      return res.status(400).json({ error: 'Invalid price per token' })
    }

    // Get base URL for redirects
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    const successUrl = `${baseUrl}/tokens?purchase=success`
    const cancelUrl = `${baseUrl}/tokens?purchase=cancelled`

    const checkout = await tokenManager.createTokenPurchaseCheckout(
      userId,
      tokenAmount,
      pricePerTokenCents,
      successUrl,
      cancelUrl
    )

    res.json({
      checkoutUrl: checkout.checkoutUrl,
      sessionId: checkout.sessionId,
      purchaseId: checkout.purchaseId
    })
  } catch (error) {
    console.error('Error creating token purchase checkout:', error)
    res.status(500).json({ error: 'Failed to create token purchase checkout' })
  }
}

// Get token purchase history
export const getTokenPurchases = async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req)
    const { limit = 20, offset = 0, status } = req.query

    const where: any = { userId }
    if (status) {
      where.status = status
    }

    const purchases = await prisma.tokenPurchaseModel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: parseInt(offset.toString()),
      take: parseInt(limit.toString())
    })

    const totalCount = await prisma.tokenPurchaseModel.count({ where })

    res.json({
      purchases,
      pagination: {
        total: totalCount,
        limit: parseInt(limit.toString()),
        offset: parseInt(offset.toString()),
        hasMore: totalCount > parseInt(offset.toString()) + parseInt(limit.toString())
      }
    })
  } catch (error) {
    console.error('Error fetching token purchases:', error)
    res.status(500).json({ error: 'Failed to fetch token purchases' })
  }
}
