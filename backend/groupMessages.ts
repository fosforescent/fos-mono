import { Request, Response } from 'express'
import { prisma } from './prismaClient'
import { dbToStore, storeToDb } from './util'
import { emitGroupMessage } from './groupEvents'

/**
 * Send a message to a group via FosExpression
 * Emits real-time event to all group members
 */
export const sendMessageToGroup = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const username = claims.username
    const { groupCid } = req.params
    const { message } = req.body

    if (!groupCid) {
      return res.status(400).json({ error: 'Group CID required' })
    }

    if (!message) {
      return res.status(400).json({ error: 'Message content required' })
    }

    const user = await prisma.userModel.findUnique({
      where: { user_name: username },
      include: { fosNode: true }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const store = await dbToStore(prisma, user)

    // Find the group expression
    const rootExpr = store.getRootExpression()
    const groupExpr = rootExpr.getTargetChildren().find(
      child => child.targetNode.getId() === groupCid
    )

    if (!groupExpr) {
      return res.status(404).json({ error: 'Group not found' })
    }

    // Get user display name from profile
    const userProfile = user.user_profile as any
    const displayName: string = userProfile?.displayName || user.user_name

    // Check user has a root node
    if (!user.fosNodeId) {
      return res.status(400).json({ error: 'User has no root node' })
    }

    // Use FosExpression method to send message
    const messageExpr = await groupExpr.sendGroupMessage(
      message,
      user.fosNodeId,
      displayName
    )

    await storeToDb(prisma, user, store)

    await emitGroupMessage(
      groupCid,
      message,
      user.fosNodeId,
      displayName,
      store
    )

    const createdMessage = await prisma.fosNodeModel.findUnique({
      where: { cid: messageExpr.targetNode.getId() }
    })

    return res.json({ message: createdMessage })
  } catch (error) {
    console.error('Error sending message to group:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Get messages from a group
 */
export const getGroupMessages = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const username = claims.username
    const { groupCid } = req.params
    const { limit = 50, offset = 0 } = req.query

    const user = await prisma.userModel.findUnique({
      where: { user_name: username },
      include: { fosNode: true }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const store = await dbToStore(prisma, user)

    // Find the group expression
    const rootExpr = store.getRootExpression()
    const groupExpr = rootExpr.getTargetChildren().find(
      child => child.targetNode.getId() === groupCid
    )

    if (!groupExpr) {
      return res.status(404).json({ error: 'Group not found' })
    }

    // Get COMMENT_FIELD children (messages)
    const commentFieldCid = store.primitive.commentConstructor.getId()
    const messageExprs = groupExpr.getTargetChildren()
      .filter(child => child.instructionNode.getId() === commentFieldCid)

    // Extract message data and sort by timestamp
    const messages = messageExprs
      .map(expr => {
        const data = expr.targetNode.getData()
        return {
          cid: expr.targetNode.getId(),
          ...data.comment,
          createdAt: data.comment?.time || Date.now()
        }
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(
        parseInt(offset as string),
        parseInt(offset as string) + parseInt(limit as string)
      )

    return res.json({
      messages,
      total: messageExprs.length,
      hasMore: messageExprs.length > parseInt(offset as string) + parseInt(limit as string)
    })
  } catch (error) {
    console.error('Error getting group messages:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
