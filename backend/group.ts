import { Request, Response } from 'express'
import { prisma } from './prismaClient'
import { dbToStore, ensureNodeInStore, storeToDb } from './util'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { FosNode } from '@fosforescent/shared/dag-implementation/node'
import { emitMemberJoined } from './groupEvents'
import { v4 as uuidv4 } from 'uuid'

/**
 * Find users by email (exact match)
 */
export const queryUserByEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.query

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email required' })
    }

    const users = await prisma.userModel.findMany({
      where: {
        user_profile: {
          path: ['email'],
          equals: email
        }
      },
      select: {
        id: true,
        user_name: true,
        user_profile: true,
        fosNodeId: true
      },
      take: 10
    })

    return res.json({ users })
  } catch (error) {
    console.error('Error querying user by email:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Find users by display name (fuzzy search)
 */
export const queryUserByDisplayName = async (req: Request, res: Response) => {
  try {
    const { name } = req.query

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name required' })
    }

    const users = await prisma.userModel.findMany({
      where: {
        OR: [
          { user_name: { contains: name, mode: 'insensitive' } },
          {
            user_profile: {
              path: ['displayName'],
              string_contains: name
            }
          }
        ]
      },
      select: {
        id: true,
        user_name: true,
        user_profile: true,
        fosNodeId: true
      },
      take: 20
    })

    return res.json({ users })
  } catch (error) {
    console.error('Error querying user by display name:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Get all groups/nodes where user is a member (has PERSON_FIELD child pointing to their node)
 */
export const getUserGroups = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const username = claims.username

    const user = await prisma.userModel.findUnique({
      where: { user_name: username },
      include: { fosNode: true }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userStore = await dbToStore(prisma, user)
    const personFieldCid = userStore.primitive.personField.getId()
    const groupFieldCid = userStore.primitive.groupField.getId()

    // Find all nodes that have this user's node as a PERSON_FIELD child
    const groupNodes = await prisma.fosNodeModel.findMany({
      where: {
        data: {
          path: ['children'],
          array_contains: [
            { path: [0], equals: personFieldCid },
            { path: [1], equals: user.fosNodeId }
          ]
        }
      }
    })

    const groups = groupNodes.map(node => ({
      cid: node.cid,
      data: node.data,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt
    }))

    return res.json({ groups })
  } catch (error) {
    console.error('Error getting user groups:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Find or create a DM node between two users using FosExpression
 */
export const findOrCreateDM = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const username = claims.username
    const { targetUserId } = req.body

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId required' })
    }

    const [currentUser, targetUser] = await Promise.all([
      prisma.userModel.findUnique({
        where: { user_name: username },
        include: { fosNode: true }
      }),
      prisma.userModel.findUnique({
        where: { id: parseInt(targetUserId) },
        include: { fosNode: true }
      })
    ])

    if (!currentUser || !targetUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    const store = await dbToStore(prisma, currentUser)
    await ensureNodeInStore(prisma, store, targetUser.fosNodeId)
    const rootExpr = store.getRootExpression()

    // Use FosExpression method to create DM
    const dmExpr = await rootExpr.createDM(targetUser.fosNodeId)

    await storeToDb(prisma, currentUser, store)

    const createdDM = await prisma.fosNodeModel.findUnique({
      where: { cid: dmExpr.targetNode.getId() }
    })

    return res.json({ dm: createdDM, created: true })
  } catch (error) {
    console.error('Error finding/creating DM:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Create a custom group node using FosExpression
 */
export const createGroup = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const username = claims.username
    const { name, description, memberIds, visibility = 'private' } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Group name required' })
    }

    const user = await prisma.userModel.findUnique({
      where: { user_name: username },
      include: { fosNode: true }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const store = await dbToStore(prisma, user)
    const rootExpr = store.getRootExpression()

    // Use FosExpression method to create group
    const groupExpr = await rootExpr.createGroup(name, description, visibility)

    // Add additional members if specified
    if (memberIds && Array.isArray(memberIds)) {
      for (const memberId of memberIds) {
        const member = await prisma.userModel.findUnique({
          where: { id: parseInt(memberId) }
        })
        if (member && member.fosNodeId !== user.fosNodeId) {
          await groupExpr.addMemberToGroup(member.fosNodeId)
        }
      }
    }

    await storeToDb(prisma, user, store)

    const createdGroup = await prisma.fosNodeModel.findUnique({
      where: { cid: groupExpr.targetNode.getId() }
    })

    return res.json({ group: createdGroup })
  } catch (error) {
    console.error('Error creating group:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Add user to existing group using FosExpression
 */
export const addUserToGroup = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const username = claims.username
    const { groupCid, targetUserId } = req.body

    if (!groupCid || !targetUserId) {
      return res.status(400).json({ error: 'groupCid and targetUserId required' })
    }

    const [currentUser, targetUser] = await Promise.all([
      prisma.userModel.findUnique({
        where: { user_name: username },
        include: { fosNode: true }
      }),
      prisma.userModel.findUnique({
        where: { id: parseInt(targetUserId) },
        include: { fosNode: true }
      })
    ])

    if (!currentUser || !targetUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    const store = await dbToStore(prisma, currentUser)

    // Find the group expression by navigating from root
    const rootExpr = store.getRootExpression()
    const groupExpr = rootExpr.getTargetChildren().find(
      child => child.targetNode.getId() === groupCid
    )

    if (!groupExpr) {
      return res.status(404).json({ error: 'Group not found' })
    }

    // Use FosExpression method to add member
    await groupExpr.addMemberToGroup(targetUser.fosNodeId)

    await storeToDb(prisma, currentUser, store)

    // Emit real-time event to all group members
    const targetUserProfile = targetUser.user_profile as any
    const displayName = targetUserProfile?.displayName || targetUser.user_name
    await emitMemberJoined(groupCid, targetUser.fosNodeId, displayName, store)

    const updated = await prisma.fosNodeModel.findUnique({
      where: { cid: groupCid }
    })

    return res.json({ group: updated })
  } catch (error) {
    console.error('Error adding user to group:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Browse public groups
 */
export const browsePublicGroups = async (req: Request, res: Response) => {
  try {
    const { limit = 20, offset = 0 } = req.query

    const groups = await prisma.fosNodeModel.findMany({
      where: {
        data: {
          path: ['group', 'visibility'],
          equals: 'public'
        }
      },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      orderBy: { updatedAt: 'desc' }
    })

    return res.json({ groups })
  } catch (error) {
    console.error('Error browsing public groups:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
