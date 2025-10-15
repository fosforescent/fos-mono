import { Request, Response } from 'express'
import { getUserId } from './apiTokenAuth'
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

// Get token pricing for a tool (public endpoint)
export const getToolTokenPricing = async (req: Request, res: Response) => {
  try {
    const { serverId, toolName } = req.params

    if (!serverId || !toolName) {
      return res.status(400).json({ error: 'Server ID and tool name are required' })
    }

    const priceTokens = await tokenManager.getToolPricing(
      parseInt(serverId),
      toolName
    )

    res.json({
      serverId: parseInt(serverId),
      toolName,
      pricePerUseTokens: priceTokens
    })
  } catch (error) {
    console.error('Error fetching tool pricing:', error)
    res.status(500).json({ error: 'Failed to fetch tool pricing' })
  }
}

// Set token pricing for a tool (server owner only)
export const setToolTokenPricing = async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req)
    const { serverId, toolName } = req.params
    const { pricePerUseTokens, isEnabled = true } = req.body

    if (!serverId || !toolName) {
      return res.status(400).json({ error: 'Server ID and tool name are required' })
    }

    if (pricePerUseTokens < 0) {
      return res.status(400).json({ error: 'Price cannot be negative' })
    }

    // Check if user owns or has admin access to the server
    const serverAccess = await prisma.userMCPServerAccessModel.findFirst({
      where: {
        userId,
        serverId: parseInt(serverId),
        role: { in: ['owner', 'admin'] }
      }
    })

    if (!serverAccess) {
      return res.status(403).json({ error: 'Access denied: you must be a server owner or admin' })
    }

    await tokenManager.setToolPricing(
      parseInt(serverId),
      toolName,
      parseInt(pricePerUseTokens.toString()),
      isEnabled
    )

    res.json({
      success: true,
      serverId: parseInt(serverId),
      toolName,
      pricePerUseTokens: parseInt(pricePerUseTokens.toString()),
      isEnabled
    })
  } catch (error) {
    console.error('Error setting tool pricing:', error)
    res.status(500).json({ error: 'Failed to set tool pricing' })
  }
}

// Get all tool pricing for a server
export const getServerToolPricing = async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params

    if (!serverId) {
      return res.status(400).json({ error: 'Server ID is required' })
    }

    const pricing = await tokenManager.getServerToolPricing(parseInt(serverId))

    res.json({
      serverId: parseInt(serverId),
      toolPricing: pricing
    })
  } catch (error) {
    console.error('Error fetching server tool pricing:', error)
    res.status(500).json({ error: 'Failed to fetch server tool pricing' })
  }
}

// Admin: Credit tokens to a user
export const adminCreditTokens = async (req: Request, res: Response) => {
  try {
    const { userId, amount, description, type = 'credit' } = req.body

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid user ID and amount are required' })
    }

    const transaction = await tokenManager.creditTokens(
      userId,
      amount,
      description || `Admin credit: ${amount} tokens`,
      type
    )

    res.json({
      success: true,
      transaction
    })
  } catch (error) {
    console.error('Error crediting tokens:', error)
    res.status(500).json({ error: 'Failed to credit tokens' })
  }
}

// Admin: Get token statistics
export const getTokenStatistics = async (req: Request, res: Response) => {
  try {
    const stats = await prisma.$transaction(async (tx) => {
      // Total tokens in circulation
      const totalTokensInCirculation = await tx.userTokenBalanceModel.aggregate({
        _sum: { availableTokens: true }
      })

      // Total tokens ever purchased
      const totalTokensPurchased = await tx.userTokenBalanceModel.aggregate({
        _sum: { totalPurchased: true }
      })

      // Total tokens used
      const totalTokensUsed = await tx.userTokenBalanceModel.aggregate({
        _sum: { totalUsed: true }
      })

      // Recent purchases (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const recentPurchases = await tx.tokenPurchaseModel.count({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          status: 'completed'
        }
      })

      // Revenue from token sales (last 30 days)
      const recentRevenue = await tx.tokenPurchaseModel.aggregate({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          status: 'completed'
        },
        _sum: { priceInCents: true }
      })

      // Active users with tokens
      const activeUsersWithTokens = await tx.userTokenBalanceModel.count({
        where: { availableTokens: { gt: 0 } }
      })

      return {
        totalTokensInCirculation: totalTokensInCirculation._sum.availableTokens || 0,
        totalTokensPurchased: totalTokensPurchased._sum.totalPurchased || 0,
        totalTokensUsed: totalTokensUsed._sum.totalUsed || 0,
        recentPurchases,
        recentRevenueInCents: recentRevenue._sum.priceInCents || 0,
        activeUsersWithTokens
      }
    })

    res.json({ stats })
  } catch (error) {
    console.error('Error fetching token statistics:', error)
    res.status(500).json({ error: 'Failed to fetch token statistics' })
  }
}