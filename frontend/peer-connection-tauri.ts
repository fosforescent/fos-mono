/**
 * Tauri-based peer connection using Rust WebRTC backend
 *
 * This module provides the same interface as peer-connection.ts
 * but uses Tauri IPC commands to the Rust backend for WebRTC.
 */

import { FosPath } from '@fosforescent/shared/types';

// Check if running in Tauri
declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' &&
    (window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined);
}

// Types matching the Rust backend
export type TauriConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

export type TauriPeerInfo = {
  id: string;
  path: number[];
  state: TauriConnectionState;
  /** Base64-encoded remote peer's public key (if key exchange completed) */
  public_key: string | null;
};

export type TauriPeerMessage =
  | { type: 'KEY_EXCHANGE'; public_key: string }
  // Legacy sync
  | { type: 'ROOT_ADDRESS_REQUEST' }
  | { type: 'ROOT_ADDRESS_RESPONSE'; root_address: string | null }
  | { type: 'ROOT_ADDRESS_CHANGED'; root_address: string }
  | { type: 'NODE_DATA'; path: number[]; data: string }
  | { type: 'NODE_REQUEST'; path: number[] }
  // DHT-based sync
  | { type: 'ROOT_CID'; cid: string }
  | { type: 'WANT_NODES'; cids: string[] }
  | { type: 'HAVE_NODES'; nodes: Record<string, string> }
  // Keepalive
  | { type: 'PING' }
  | { type: 'PONG' }
  // Proposal/Consensus messages (same format as browser)
  | {
      type: 'PROPOSAL_CREATED';
      proposal_id: string;
      target_node_cid: string;
      proposed_content: string;
      proposer_peer_id: string;
      color: string;
    }
  | {
      type: 'PROPOSAL_APPROVAL';
      proposal_id: string;
      approver_peer_id: string;
      signature: string;
    }
  | {
      type: 'PROPOSAL_ACCEPTED';
      proposal_id: string;
      new_node_cid: string;
    }
  | {
      type: 'MEMBERS_UPDATE';
      node_cid: string;
      members: string[];
    };

// Tauri invoke helper
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error('Not running in Tauri');
  }
  // Dynamic import to avoid issues when not in Tauri
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

// ============================================================================
// Tauri Peer Commands
// ============================================================================

/**
 * Create an offer to initiate a peer connection.
 * Returns [peerId, offerString]
 */
export async function createOffer(path: FosPath): Promise<[string, string]> {
  return invoke<[string, string]>('peer_create_offer', { path });
}

/**
 * Accept an offer from another peer.
 * Returns [peerId, answerString]
 */
export async function acceptOffer(offer: string, path: FosPath): Promise<[string, string]> {
  return invoke<[string, string]>('peer_accept_offer', { offer, path });
}

/**
 * Accept an answer to complete the connection (for the offerer).
 */
export async function acceptAnswer(peerId: string, answer: string): Promise<void> {
  return invoke<void>('peer_accept_answer', { peerId, answer });
}

/**
 * Send a message to a specific peer.
 */
export async function sendMessage(peerId: string, message: TauriPeerMessage): Promise<void> {
  return invoke<void>('peer_send_message', { peerId, message });
}

/**
 * Broadcast a message to all peers for a specific path.
 */
export async function broadcast(path: FosPath, message: TauriPeerMessage): Promise<void> {
  return invoke<void>('peer_broadcast', { path, message });
}

/**
 * Get info about all peers.
 */
export async function listPeers(): Promise<TauriPeerInfo[]> {
  return invoke<TauriPeerInfo[]>('peer_list');
}

/**
 * Get info about peers for a specific path.
 */
export async function listPeersForPath(path: FosPath): Promise<TauriPeerInfo[]> {
  return invoke<TauriPeerInfo[]>('peer_list_for_path', { path });
}

/**
 * Close a specific peer connection.
 */
export async function closePeer(peerId: string): Promise<void> {
  return invoke<void>('peer_close', { peerId });
}

/**
 * Close all peer connections.
 */
export async function closeAllPeers(): Promise<void> {
  return invoke<void>('peer_close_all');
}

/**
 * Get our local public key (base64 encoded).
 */
export async function getPublicKey(): Promise<string> {
  return invoke<string>('peer_get_public_key');
}

/**
 * Send key exchange to a peer (initiates signature verification).
 */
export async function sendKeyExchange(peerId: string): Promise<void> {
  return invoke<void>('peer_send_key_exchange', { peerId });
}

/**
 * Sign content for a proposal using our Ed25519 signing key.
 * @param content - The content to sign (typically JSON-serialized proposal data)
 * @returns Base64-encoded Ed25519 signature
 */
export async function signProposal(content: string): Promise<string> {
  return invoke<string>('sign_proposal', { content });
}

/**
 * Verify a proposal signature from a specific peer.
 * @param peerId - The peer ID who allegedly signed the content
 * @param content - The content that was signed
 * @param signature - Base64-encoded Ed25519 signature
 * @throws If signature is invalid or peer has no public key
 */
export async function verifyProposalSignature(
  peerId: string,
  content: string,
  signature: string
): Promise<void> {
  return invoke<void>('verify_proposal_signature', { peerId, content, signature });
}

// ============================================================================
// Tauri-based NodePeer wrapper (same interface as browser version)
// ============================================================================

import type { PeerMessage as BrowserPeerMessage, ConnectionState, IPeer } from './peer-connection';

// Global registry of active peers for routing incoming messages
const activePeers = new Map<string, TauriNodePeer>();
let globalListenerSetup = false;

// Event payload from Rust
type PeerMessageEvent = {
  peer_id: string;
  message: TauriPeerMessage;
};

// Set up global event listener (called once)
async function setupGlobalMessageListener(): Promise<void> {
  if (globalListenerSetup) return;
  globalListenerSetup = true;

  try {
    const { listen } = await import('@tauri-apps/api/event');

    await listen<PeerMessageEvent>('peer-message', (event) => {
      const { peer_id, message } = event.payload;
      console.log('[Tauri Peer] Received message for peer', peer_id, ':', message);

      const peer = activePeers.get(peer_id);
      if (peer) {
        peer.handleIncomingMessage(message);
      } else {
        console.warn('[Tauri Peer] No active peer found for id:', peer_id);
      }
    });

    console.log('[Tauri Peer] Global message listener set up');
  } catch (e) {
    console.error('[Tauri Peer] Failed to set up event listener:', e);
    globalListenerSetup = false;
  }
}

// Convert Tauri message to browser message format
// Note: Rust uses number[] for path, but FosPath is [FosNodeId, FosNodeId][]
// For now we cast through unknown; this should be aligned in the protocol later
function fromTauriMessage(msg: TauriPeerMessage, path: FosPath): BrowserPeerMessage | null {
  switch (msg.type) {
    // DHT messages - same format, pass through
    case 'ROOT_CID':
      return { type: 'ROOT_CID', cid: msg.cid };
    case 'WANT_NODES':
      return { type: 'WANT_NODES', cids: msg.cids };
    case 'HAVE_NODES':
      return { type: 'HAVE_NODES', nodes: msg.nodes };
    // Legacy sync messages
    case 'NODE_REQUEST':
      return { type: 'SYNC_REQUEST', path: msg.path as unknown as FosPath };
    case 'NODE_DATA':
      return { type: 'SYNC_RESPONSE', path: msg.path as unknown as FosPath, nodeAddress: msg.data || null };
    case 'ROOT_ADDRESS_REQUEST':
      return { type: 'SYNC_REQUEST', path };
    case 'ROOT_ADDRESS_RESPONSE':
      return { type: 'SYNC_RESPONSE', path, nodeAddress: msg.root_address };
    case 'ROOT_ADDRESS_CHANGED':
      return { type: 'NODE_CHANGED', path, nodeAddress: msg.root_address };
    // Keepalive
    case 'PING':
      return { type: 'PING' };
    case 'PONG':
      return { type: 'PONG' };
    // Proposal messages - same format, pass through
    case 'PROPOSAL_CREATED':
      return {
        type: 'PROPOSAL_CREATED',
        proposal_id: msg.proposal_id,
        target_node_cid: msg.target_node_cid,
        proposed_content: msg.proposed_content,
        proposer_peer_id: msg.proposer_peer_id,
        color: msg.color,
      };
    case 'PROPOSAL_APPROVAL':
      return {
        type: 'PROPOSAL_APPROVAL',
        proposal_id: msg.proposal_id,
        approver_peer_id: msg.approver_peer_id,
        signature: msg.signature,
      };
    case 'PROPOSAL_ACCEPTED':
      return {
        type: 'PROPOSAL_ACCEPTED',
        proposal_id: msg.proposal_id,
        new_node_cid: msg.new_node_cid,
      };
    case 'MEMBERS_UPDATE':
      return {
        type: 'MEMBERS_UPDATE',
        node_cid: msg.node_cid,
        members: msg.members,
      };
    default:
      console.warn('[Tauri Peer] Unknown message type:', msg);
      return null;
  }
}

export class TauriNodePeer implements IPeer {
  readonly id: string;
  readonly path: FosPath;
  private messageHandlers: Set<(message: BrowserPeerMessage) => void> = new Set();
  private closeHandlers: Set<() => void> = new Set();
  private _connected: boolean = true;

  constructor(id: string, path: FosPath) {
    this.id = id;
    this.path = path;

    // Register this peer for incoming messages
    activePeers.set(id, this);

    // Ensure global listener is set up
    setupGlobalMessageListener();
  }

  // Called by the global message listener
  handleIncomingMessage(tauriMsg: TauriPeerMessage): void {
    const browserMsg = fromTauriMessage(tauriMsg, this.path);
    if (browserMsg) {
      for (const handler of this.messageHandlers) {
        handler(browserMsg);
      }
    }
  }

  onMessage(handler: (message: BrowserPeerMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onClose(handler: () => void): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  async send(message: BrowserPeerMessage): Promise<void> {
    // Convert browser message format to Tauri format
    const tauriMsg = this.toTauriMessage(message);
    await sendMessage(this.id, tauriMsg);
  }

  private toTauriMessage(msg: BrowserPeerMessage): TauriPeerMessage {
    switch (msg.type) {
      // DHT messages - same format, pass through
      case 'ROOT_CID':
        return { type: 'ROOT_CID', cid: msg.cid };
      case 'WANT_NODES':
        return { type: 'WANT_NODES', cids: msg.cids };
      case 'HAVE_NODES':
        return { type: 'HAVE_NODES', nodes: msg.nodes };
      // Legacy sync messages
      case 'SYNC_REQUEST':
        return { type: 'NODE_REQUEST', path: msg.path as unknown as number[] };
      case 'SYNC_RESPONSE':
        return { type: 'NODE_DATA', path: msg.path as unknown as number[], data: msg.nodeAddress || '' };
      case 'NODE_CHANGED':
        return { type: 'ROOT_ADDRESS_CHANGED', root_address: msg.nodeAddress };
      // Keepalive
      case 'PING':
        return { type: 'PING' };
      case 'PONG':
        return { type: 'PONG' };
      // Proposal messages - same format, pass through
      case 'PROPOSAL_CREATED':
        return {
          type: 'PROPOSAL_CREATED',
          proposal_id: msg.proposal_id,
          target_node_cid: msg.target_node_cid,
          proposed_content: msg.proposed_content,
          proposer_peer_id: msg.proposer_peer_id,
          color: msg.color,
        };
      case 'PROPOSAL_APPROVAL':
        return {
          type: 'PROPOSAL_APPROVAL',
          proposal_id: msg.proposal_id,
          approver_peer_id: msg.approver_peer_id,
          signature: msg.signature,
        };
      case 'PROPOSAL_ACCEPTED':
        return {
          type: 'PROPOSAL_ACCEPTED',
          proposal_id: msg.proposal_id,
          new_node_cid: msg.new_node_cid,
        };
      case 'MEMBERS_UPDATE':
        return {
          type: 'MEMBERS_UPDATE',
          node_cid: msg.node_cid,
          members: msg.members,
        };
      default:
        console.warn('[Tauri Peer] Unknown message type to convert:', msg);
        return { type: 'PING' };
    }
  }

  requestSync(): void {
    this.send({ type: 'SYNC_REQUEST', path: this.path });
  }

  sendNodeChanged(nodeAddress: string): void {
    this.send({ type: 'NODE_CHANGED', path: this.path, nodeAddress });
  }

  isConnected(): boolean {
    return this._connected;
  }

  async close(): Promise<void> {
    // Unregister from global message routing
    activePeers.delete(this.id);

    await closePeer(this.id);
    this._connected = false;
    for (const handler of this.closeHandlers) {
      handler();
    }
  }
}

// ============================================================================
// Helper to wait for connection
// ============================================================================

async function waitForPeerConnected(peerId: string, timeoutMs: number = 30000): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 200; // Check every 200ms

  console.log('[Tauri Peer] Waiting for peer to connect:', peerId);

  while (Date.now() - startTime < timeoutMs) {
    const peers = await listPeers();
    const peer = peers.find(p => p.id === peerId);

    if (peer) {
      console.log('[Tauri Peer] Peer state:', peer.state);
      if (peer.state === 'connected') {
        console.log('[Tauri Peer] Connected!');
        return; // Success!
      }
      if (peer.state === 'failed' || peer.state === 'closed') {
        throw new Error(`Connection ${peer.state}`);
      }
    } else {
      console.log('[Tauri Peer] Peer not found in list');
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Connection timeout');
}

// ============================================================================
// Tauri-based PeerConnectionBuilder
// ============================================================================

export class TauriPeerConnectionBuilder {
  private path: FosPath;
  private peerId: string | null = null;
  private state: ConnectionState = 'idle';
  private stateHandlers: Set<(state: ConnectionState) => void> = new Set();

  constructor(path: FosPath) {
    this.path = path;
  }

  private setState(state: ConnectionState) {
    this.state = state;
    for (const handler of this.stateHandlers) {
      handler(state);
    }
  }

  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Create an offer. Returns the SDP string.
   */
  async createOffer(): Promise<string> {
    this.setState('creating-offer');

    try {
      const [peerId, offerString] = await createOffer(this.path);
      this.peerId = peerId;
      this.setState('waiting-for-answer');
      return offerString;
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  /**
   * Accept an answer and return the connected peer.
   */
  async acceptAnswer(answerString: string): Promise<TauriNodePeer> {
    this.setState('connecting');

    try {
      if (!this.peerId) {
        throw new Error('No peer ID - did you create an offer first?');
      }

      await acceptAnswer(this.peerId, answerString);

      // Poll until actually connected
      await waitForPeerConnected(this.peerId);

      // Create peer FIRST so it's registered in activePeers to receive key exchange response
      const peer = new TauriNodePeer(this.peerId, this.path);
      this.setState('connected');

      // Now initiate key exchange - peer is registered and can receive the response
      console.log('[Tauri Peer] Sending key exchange...');
      await sendKeyExchange(this.peerId);

      return peer;
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  /**
   * Accept an offer and return both the answer string and (eventually) the peer.
   */
  async acceptOffer(offerString: string): Promise<{ answer: string; waitForConnection: () => Promise<TauriNodePeer> }> {
    this.setState('connecting');

    try {
      console.log('[Tauri Peer] acceptOffer called, offer length:', offerString.length);
      const result = await acceptOffer(offerString, this.path);
      console.log('[Tauri Peer] acceptOffer result:', result);

      if (!result || !Array.isArray(result) || result.length < 2) {
        throw new Error(`Invalid response from acceptOffer: ${JSON.stringify(result)}`);
      }

      const [peerId, answerString] = result;
      this.peerId = peerId;

      console.log('[Tauri Peer] Got peerId:', peerId, 'answer length:', answerString?.length);

      const waitForConnection = async (): Promise<TauriNodePeer> => {
        // Poll until actually connected
        await waitForPeerConnected(peerId);

        // Create peer FIRST so it's registered in activePeers to receive key exchange response
        const peer = new TauriNodePeer(peerId, this.path);
        this.setState('connected');

        // Now initiate key exchange - peer is registered and can receive the response
        console.log('[Tauri Peer] Sending key exchange...');
        await sendKeyExchange(peerId);

        return peer;
      };

      return { answer: answerString, waitForConnection };
    } catch (error) {
      console.error('[Tauri Peer] acceptOffer error:', error);
      this.setState('error');
      throw error;
    }
  }

  async cancel(): Promise<void> {
    if (this.peerId) {
      await closePeer(this.peerId);
    }
    this.setState('idle');
  }
}
