import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

// Create a service to manage WebSocket broadcast and message handling
export class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocketServer;
  private eventEmitter: EventEmitter;
  private workerInterval: NodeJS.Timeout | null = null;

  private constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.eventEmitter = new EventEmitter();
    console.log('WebSocket Service initialized');
  }

  public static getInstance(wss: WebSocketServer): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService(wss);
    }
    return WebSocketService.instance;
  }

  // Broadcast to all clients
  public broadcast(message: any): void {
    console.log('Broadcasting message:', message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // Broadcast to specific users
  public broadcastToUsers(userIds: string[], message: any): void {
    console.log('Broadcasting to users:', userIds, message);
    this.wss.clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN && 
          client.userId && 
          userIds.includes(client.userId)) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // Start a worker process
  public startWorker(intervalMs: number = 5000): void {
    if (this.workerInterval) {
      console.log('Worker already running');
      return;
    }

    console.log('Starting worker with interval:', intervalMs);
    this.workerInterval = setInterval(() => {
      this.processWork();
    }, intervalMs);
  }

  // Stop the worker process
  public stopWorker(): void {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
      console.log('Worker stopped');
    }
  }

  // Process work and send messages
  private async processWork(): Promise<void> {
    try {
      // Example: Check for active clients
      const activeClients = Array.from(this.wss.clients).length;
      console.log(`Processing work. Active clients: ${activeClients}`);

      if (activeClients > 0) {
        // Example: Send a heartbeat message
        this.broadcast({
          type: 'heartbeat',
          timestamp: new Date().toISOString(),
          activeClients
        });

        // Emit event for other parts of the application
        this.eventEmitter.emit('workProcessed', {
          timestamp: new Date(),
          activeClients
        });
      }
    } catch (error) {
      console.error('Error processing work:', error);
    }
  }

  // Subscribe to worker events
  public onWorkProcessed(callback: (data: any) => void): void {
    this.eventEmitter.on('workProcessed', callback);
  }

  // Get active connections count
  public getActiveConnections(): number {
    return this.wss.clients.size;
  }
}

// Example usage in your server file:
const initializeWebSocketWorker = (wss: WebSocketServer) => {
  const wsService = WebSocketService.getInstance(wss);

  // Start the worker
  wsService.startWorker(5000); // Run every 5 seconds

  // Listen for work processed events
  wsService.onWorkProcessed((data) => {
    console.log('Work processed:', data);
  });

  return wsService;
};

export { initializeWebSocketWorker };