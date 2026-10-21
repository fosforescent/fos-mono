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

// Send an arbitrary JSON message to every open connection of one user.
// Returns the number of sockets the message was written to.
export function sendToUser(userId: number, message: Record<string, unknown>): number {
  const connections = userConnections.get(userId)
  if (!connections || connections.size === 0) return 0

  const payload = JSON.stringify({ ...message, timestamp: new Date().toISOString() })
  let sentCount = 0
  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload)
        sentCount++
      } catch (error) {
        console.error(`Failed to send message to user ${userId}:`, error)
      }
    }
  })
  return sentCount
}
// Presence: which device (peer id) a socket belongs to. Devices announce it with a
// {type: 'hello', peerId} message; attachments in the graph persist regardless.
const socketPeers = new Map<WebSocket, string>()

export function setSocketPeer(ws: WebSocket, peerId: string): void {
  socketPeers.set(ws, peerId)
  ws.on('close', () => socketPeers.delete(ws))
}

export function onlinePeersOf(userId: number): string[] {
  const out = new Set<string>()
  userConnections.get(userId)?.forEach((ws) => {
    const peer = socketPeers.get(ws)
    if (peer && ws.readyState === WebSocket.OPEN) out.add(peer)
  })
  return [...out]
}
