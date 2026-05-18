import { WebSocket } from 'ws'

// Store active WebSocket connections by user ID
const userConnections = new Map<number, Set<WebSocket>>()

// Add a WebSocket connection for a user
export function addUserConnection(userId: number, ws: WebSocket) {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set())
  }
  userConnections.get(userId)?.add(ws)

  // Clean up on close
  ws.on('close', () => {
    removeUserConnection(userId, ws)
  })
}

// Remove a WebSocket connection for a user
export function removeUserConnection(userId: number, ws: WebSocket) {
  const connections = userConnections.get(userId)
  if (connections) {
    connections.delete(ws)
    if (connections.size === 0) {
      userConnections.delete(userId)
    }
  }
}

// Send a prompt notification to a specific user
export function notifyUserOfPrompt(userId: number, promptData: {
  promptId: string
  title: string
  message: string
  priority: string
  promptType: string
  serverId?: number
  serverName?: string
}) {
  const connections = userConnections.get(userId)
  if (!connections || connections.size === 0) {
    console.log(`No active connections for user ${userId}`)
    return
  }

  const notification = {
    type: 'prompt_notification',
    ...promptData,
    timestamp: new Date().toISOString()
  }

  const message = JSON.stringify(notification)
  
  // Send to all active connections for this user
  connections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message)
        console.log(`Sent prompt notification to user ${userId}:`, promptData.promptId)
      } catch (error) {
        console.error(`Failed to send notification to user ${userId}:`, error)
        // Remove broken connection
        connections.delete(ws)
      }
    } else {
      // Remove closed connection
      connections.delete(ws)
    }
  })
}

// Send a prompt response confirmation to a specific user
export function notifyUserOfPromptResponse(userId: number, promptData: {
  promptId: string
  status: string
  response?: string
}) {
  const connections = userConnections.get(userId)
  if (!connections || connections.size === 0) {
    return
  }

  const notification = {
    type: 'prompt_response_confirmation',
    ...promptData,
    timestamp: new Date().toISOString()
  }

  const message = JSON.stringify(notification)
  
  connections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message)
      } catch (error) {
        console.error(`Failed to send response confirmation to user ${userId}:`, error)
        connections.delete(ws)
      }
    } else {
      connections.delete(ws)
    }
  })
}

// Get active user count for debugging
export function getActiveUserCount(): number {
  return userConnections.size
}

// Get connection count for a specific user
export function getUserConnectionCount(userId: number): number {
  return userConnections.get(userId)?.size || 0
}

// Broadcast to all connected users (admin functionality)
export function broadcastToAllUsers(message: any) {
  const notification = {
    type: 'system_notification',
    ...message,
    timestamp: new Date().toISOString()
  }

  const messageString = JSON.stringify(notification)
  let sentCount = 0

  userConnections.forEach((connections, userId) => {
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageString)
          sentCount++
        } catch (error) {
          console.error(`Failed to broadcast to user ${userId}:`, error)
          connections.delete(ws)
        }
      } else {
        connections.delete(ws)
      }
    })
  })

  console.log(`Broadcasted message to ${sentCount} connections`)
  return sentCount
}