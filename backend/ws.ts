import { nodeRelay } from './sync/nodeRelay';
import jwt from 'jsonwebtoken';

import { WebSocketServer, WebSocket } from 'ws';
import { addUserConnection, setSocketPeer } from './promptNotifications';
import { prisma } from './prismaClient';

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({
  noServer: true  // Important: we'll handle the upgrade ourselves
});

console.log('WebSocket server created');

export const attachWs = (server: any, event?: (claims: any, body: any) => Promise<unknown>) => {
    // Handle upgrades manually
    server.on('upgrade', (request: any, socket: any, head: any) => {


    // Other WebSocket servers (the MCP endpoint at /mcp) share this HTTP server and
    // handle their own upgrades; only /ws/{jwt} (or /{jwt}) belongs to this one.
    const upgradePath: string = (request.url || '').split('?')[0]
    if (upgradePath.startsWith('/mcp')) {
      return;
    }

    try {
        const token = request.url?.split('/')[2];

        if (!token) {
        console.log('No token provided');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
        }

        // Verify JWT
        jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err: any, decoded: any) => {
        if (err) {
            console.error('JWT verification failed:', err);
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }



        // Complete the WebSocket upgrade
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request, decoded);
        });
        });
    } catch (error) {
        console.error('Error during upgrade:', error);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
    }
    });

    // WebSocket connection handler
    wss.on('connection', async (ws: WebSocket, request: any, decodedToken: any) => {


    // Presence announcement from a device (see web/src/app.ts). Registered before any await:
    // a hello that arrives while the user lookup is pending would otherwise be dropped, and
    // the device would never show as online.
    let relayUser: number | undefined
    let relayHello: { peerId: string; scope: string[]; capabilities: string[] } | undefined
    const registerProvider = () => { if (relayUser !== undefined && relayHello) nodeRelay.register(relayUser, relayHello.peerId, ws, relayHello.scope, relayHello.capabilities) }
    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message.toString()) as { type?: unknown; peerId?: unknown; scope?: unknown; capabilities?: unknown }
            if (parsed.type === 'hello' && typeof parsed.peerId === 'string' && parsed.peerId.length <= 128 && (decodedToken.kind !== 'peer' || parsed.peerId === decodedToken.peerId)) {
              setSocketPeer(ws, parsed.peerId)
              relayHello = { peerId: parsed.peerId, scope: Array.isArray(parsed.scope) ? parsed.scope : [], capabilities: Array.isArray(parsed.capabilities) ? parsed.capabilities.filter((c): c is string => typeof c === 'string') : [] }
              registerProvider()
            }
        } catch {
            // not JSON
        }
    });

    try {
        // Get user ID from database
        const user = await prisma.userModel.findUnique({
        where: { user_name: decodedToken.username }
        });

        if (!user || !user.approved) {
        console.error('User not found for WebSocket connection:', decodedToken.username);
        ws.close(1008, 'User not found');
        return;
        }

        // Register this connection for prompt notifications
        addUserConnection(user.id, ws);
        relayUser = user.id; registerProvider()

        // Send immediate confirmation
        ws.send(JSON.stringify({
        type: 'connection_established',
        user: decodedToken,
        userId: user.id,
        fosNodeId: user.fosNodeId
        }));

        ws.on('message', (message) => {
        try {
            // Node replies are consumed below without logging their contents.
            try {
              const parsed = JSON.parse(message.toString()) as { type?: unknown }
              if (nodeRelay.receive(user.id, ws, parsed)) return
              if (parsed.type === 'hello') return // handled above
              // The WebSocket is one adapter of the event grammar: {type:'event', id, event, scope?} → {type:'event_result', id, result|error}
              if (parsed.type === 'event' && event) {
                const envelope = parsed as { id?: unknown; event?: unknown; scope?: unknown }
                if (Buffer.byteLength(message.toString()) > 100_000) { ws.close(1009, 'Event message too large'); return }
                void event(decodedToken, { event: envelope.event, scope: envelope.scope }).then(result => {
                  if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'event_result', id: envelope.id, result }))
                }).catch(error => {
                  if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'event_result', id: envelope.id, error: error instanceof Error ? error.message : 'Event failed' }))
                })
                return
              }
            } catch {
              // not JSON: fall through
            }
            ws.send(JSON.stringify({
            type: 'response',
            message: 'Message received',
            user: decodedToken
            }));
        } catch (error) {
            console.error('Error processing message:', error);
        }
        });

        ws.on('close', () => {
        console.log('Client disconnected:', decodedToken.username);
        });

        ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        });

    } catch (error) {
        console.error('Error setting up WebSocket connection:', error);
        ws.close(1011, 'Internal server error');
    }
    });
}
