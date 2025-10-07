import { WebSocket } from 'ws'
import { FosExpression } from '@fosforescent/shared/dag-implementation/expression'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { prisma } from './prismaClient'

// Store active WebSocket connections by user node CID
const userConnectionsByNodeCid = new Map<string, Set<WebSocket>>()

// Map user ID to node CID for quick lookups
const userIdToNodeCid = new Map<number, string>()

/**
 * Register a user's WebSocket connection
 */
export function addGroupConnection(userId: number, userNodeCid: string, ws: WebSocket) {
  // Track mapping
  userIdToNodeCid.set(userId, userNodeCid)

  // Add connection
  if (!userConnectionsByNodeCid.has(userNodeCid)) {
    userConnectionsByNodeCid.set(userNodeCid, new Set())
  }
  userConnectionsByNodeCid.get(userNodeCid)?.add(ws)

  console.log(`User ${userId} (${userNodeCid}) connected for group events`)

  // Clean up on close
  ws.on('close', () => {
    removeGroupConnection(userNodeCid, ws)
  })
}

/**
 * Remove a user's WebSocket connection
 */
export function removeGroupConnection(userNodeCid: string, ws: WebSocket) {
  const connections = userConnectionsByNodeCid.get(userNodeCid)
  if (connections) {
    connections.delete(ws)
    if (connections.size === 0) {
      userConnectionsByNodeCid.delete(userNodeCid)
    }
  }
}

/**
 * Group event types
 */
export interface GroupEvent {
  type: 'group_message' | 'member_joined' | 'member_left' | 'group_updated' | 'node_update'
  groupCid: string
  data: any
  timestamp: string
  authorCid?: string
  authorName?: string
}

/**
 * Emit event to a specific user by node CID
 */
function emitToUser(userNodeCid: string, event: GroupEvent) {
  const connections = userConnectionsByNodeCid.get(userNodeCid)
  if (!connections || connections.size === 0) {
    return
  }

  const message = JSON.stringify(event)

  connections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message)
      } catch (error) {
        console.error(`Failed to send event to user ${userNodeCid}:`, error)
        connections.delete(ws)
      }
    } else {
      connections.delete(ws)
    }
  })
}

/**
 * Propagate event through group structure
 * Recursively traverses PERSON_FIELD and GROUP_FIELD children
 */
export function propagateGroupEvent(
  groupExpr: FosExpression,
  event: GroupEvent,
  visited: Set<string> = new Set()
) {
  const groupCid = groupExpr.targetNode.getId()

  // Prevent infinite loops in nested groups
  if (visited.has(groupCid)) {
    return
  }
  visited.add(groupCid)

  const store = groupExpr.store
  const personFieldCid = store.primitive.personField.getId()
  const groupFieldCid = store.primitive.groupField.getId()

  // Get all children
  const children = groupExpr.getTargetChildren()

  // Emit to direct members (PERSON_FIELD children)
  const members = children.filter(
    child => child.instructionNode.getId() === personFieldCid
  )

  for (const member of members) {
    const memberNodeCid = member.targetNode.getId()
    emitToUser(memberNodeCid, event)
  }

  // Recursively propagate to nested groups (GROUP_FIELD children)
  const nestedGroups = children.filter(
    child => child.instructionNode.getId() === groupFieldCid
  )

  for (const nested of nestedGroups) {
    propagateGroupEvent(nested, event, visited)
  }

  console.log(`Propagated event to group ${groupCid}: ${members.length} direct members, ${nestedGroups.length} nested groups`)
}

/**
 * Send a message event to a group
 */
export async function emitGroupMessage(
  groupCid: string,
  message: string,
  authorCid: string,
  authorName: string,
  store: FosStore
) {
  // Find group expression
  const rootExpr = store.getRootExpression()
  const groupExpr = findGroupExpression(rootExpr, groupCid)

  if (!groupExpr) {
    console.error(`Group ${groupCid} not found for event emission`)
    return
  }

  const event: GroupEvent = {
    type: 'group_message',
    groupCid,
    data: {
      message,
      messageCid: null // Will be set after message node is created
    },
    authorCid,
    authorName,
    timestamp: new Date().toISOString()
  }

  propagateGroupEvent(groupExpr, event)
}

/**
 * Emit member joined event
 */
export async function emitMemberJoined(
  groupCid: string,
  memberCid: string,
  memberName: string,
  store: FosStore
) {
  const rootExpr = store.getRootExpression()
  const groupExpr = findGroupExpression(rootExpr, groupCid)

  if (!groupExpr) {
    return
  }

  const event: GroupEvent = {
    type: 'member_joined',
    groupCid,
    data: {
      memberCid,
      memberName
    },
    timestamp: new Date().toISOString()
  }

  propagateGroupEvent(groupExpr, event)
}

/**
 * Emit member left event
 */
export async function emitMemberLeft(
  groupCid: string,
  memberCid: string,
  memberName: string,
  store: FosStore
) {
  const rootExpr = store.getRootExpression()
  const groupExpr = findGroupExpression(rootExpr, groupCid)

  if (!groupExpr) {
    return
  }

  const event: GroupEvent = {
    type: 'member_left',
    groupCid,
    data: {
      memberCid,
      memberName
    },
    timestamp: new Date().toISOString()
  }

  propagateGroupEvent(groupExpr, event)
}

/**
 * Helper: Find group expression by CID
 */
function findGroupExpression(rootExpr: FosExpression, groupCid: string): FosExpression | null {
  // Search through all children recursively
  const search = (expr: FosExpression): FosExpression | null => {
    if (expr.targetNode.getId() === groupCid) {
      return expr
    }

    const children = expr.getTargetChildren()
    for (const child of children) {
      const found = search(child)
      if (found) return found
    }

    return null
  }

  return search(rootExpr)
}

/**
 * Get active group members count
 */
export function getActiveGroupMembersCount(groupExpr: FosExpression): number {
  const personFieldCid = groupExpr.store.primitive.personField.getId()
  const members = groupExpr.getTargetChildren().filter(
    child => child.instructionNode.getId() === personFieldCid
  )

  let activeCount = 0
  for (const member of members) {
    const memberNodeCid = member.targetNode.getId()
    const connections = userConnectionsByNodeCid.get(memberNodeCid)
    if (connections && connections.size > 0) {
      activeCount++
    }
  }

  return activeCount
}

/**
 * Get all groups a user is a member of (for connection setup)
 */
export async function getUserGroups(userId: number): Promise<string[]> {
  const user = await prisma.userModel.findUnique({
    where: { id: userId },
    include: { fosNode: true }
  })

  if (!user) return []

  const personFieldCid = user.fosNode.cid // Simplified - would need store to get actual primitive

  // Find all nodes where user is a PERSON_FIELD child
  const groups = await prisma.fosNodeModel.findMany({
    where: {
      data: {
        path: ['children'],
        array_contains: [personFieldCid, user.fosNodeId]
      }
    },
    select: {
      cid: true
    }
  })

  return groups.map(g => g.cid)
}
