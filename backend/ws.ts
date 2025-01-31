import jwt from 'jsonwebtoken';

import { WebSocketServer, WebSocket } from 'ws';

var WSServer = require('ws').Server;

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ 
  noServer: true  // Important: we'll handle the upgrade ourselves
});

console.log('WebSocket server created');

export const attachWs = (server: any) => {
    // Handle upgrades manually
    server.on('upgrade', (request: any, socket: any, head: any) => {
    console.log('Upgrade request received:', request.url);

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

        console.log('JWT verified successfully:', decoded);
        
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
    wss.on('connection', (ws: WebSocket, request: any, decodedToken: any) => {
    console.log('New WebSocket connection:', decodedToken);
    
    // Send immediate confirmation
    ws.send(JSON.stringify({ 
        type: 'connection_established',
        user: decodedToken
    }));

    ws.on('message', (message) => {
        try {
        console.log('Received message:', message.toString());
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
        console.log('Client disconnected:', decodedToken);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
    });
}
