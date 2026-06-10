/**
 * Peer Connection via WebRTC
 *
 * Per-node peer connections for syncing specific subtrees.
 * Each node can have multiple peers.
 *
 * Automatically uses Tauri backend when running in desktop app,
 * falls back to browser WebRTC otherwise.
 */

import { el, div, span, button } from './render';
import { FosPath } from '@fosforescent/shared/types';
import { isTauri, TauriPeerConnectionBuilder, TauriNodePeer } from './peer-connection-tauri';

// ============================================================================
// Types
// ============================================================================

export type ConnectionState = 'idle' | 'creating-offer' | 'waiting-for-answer' | 'connecting' | 'connected' | 'error';

export type PeerMessage =
  | { type: 'SYNC_REQUEST'; path: FosPath }
  | { type: 'SYNC_RESPONSE'; path: FosPath; nodeAddress: string | null }
  | { type: 'NODE_CHANGED'; path: FosPath; nodeAddress: string }
  | { type: 'PING' }
  | { type: 'PONG' };

// Common interface for peer connections (browser WebRTC and Tauri backend)
export interface IPeer {
  readonly id: string;
  readonly path: FosPath;
  onMessage(handler: (message: PeerMessage) => void): () => void;
  onClose(handler: () => void): () => void;
  send(message: PeerMessage): void | Promise<void>;
  requestSync(): void;
  sendNodeChanged(nodeAddress: string): void;
  isConnected(): boolean;
  close(): void | Promise<void>;
}

// ============================================================================
// NodePeer - A single peer connection (browser WebRTC)
// ============================================================================

export class NodePeer implements IPeer {
  readonly id: string;
  readonly path: FosPath;
  private channel: RTCDataChannel;
  private pc: RTCPeerConnection;
  private messageHandlers: Set<(message: PeerMessage) => void> = new Set();
  private closeHandlers: Set<() => void> = new Set();

  constructor(id: string, path: FosPath, pc: RTCPeerConnection, channel: RTCDataChannel) {
    this.id = id;
    this.path = path;
    this.pc = pc;
    this.channel = channel;

    this.channel.addEventListener('message', this.handleMessage);
    this.channel.addEventListener('close', this.handleClose);
  }

  private handleMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as PeerMessage;
      for (const handler of this.messageHandlers) {
        handler(message);
      }
    } catch {
      // Ignore non-JSON messages
    }
  };

  private handleClose = () => {
    for (const handler of this.closeHandlers) {
      handler();
    }
  };

  onMessage(handler: (message: PeerMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onClose(handler: () => void): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  send(message: PeerMessage): void {
    if (this.channel.readyState === 'open') {
      this.channel.send(JSON.stringify(message));
    }
  }

  requestSync(): void {
    this.send({ type: 'SYNC_REQUEST', path: this.path });
  }

  sendNodeChanged(nodeAddress: string): void {
    this.send({ type: 'NODE_CHANGED', path: this.path, nodeAddress });
  }

  isConnected(): boolean {
    return this.channel.readyState === 'open';
  }

  close(): void {
    this.channel.removeEventListener('message', this.handleMessage);
    this.channel.removeEventListener('close', this.handleClose);
    this.channel.close();
    this.pc.close();
  }
}

// ============================================================================
// NodePeers - Manages multiple peers for a node
// ============================================================================

export class NodePeers {
  readonly path: FosPath;
  private peers: Map<string, IPeer> = new Map();
  private peerAddedHandlers: Set<(peer: IPeer) => void> = new Set();
  private peerRemovedHandlers: Set<(peerId: string) => void> = new Set();
  private messageHandlers: Set<(peer: IPeer, message: PeerMessage) => void> = new Set();

  constructor(path: FosPath) {
    this.path = path;
  }

  addPeer(peer: IPeer): void {
    this.peers.set(peer.id, peer);

    // Forward messages
    peer.onMessage((msg) => {
      for (const handler of this.messageHandlers) {
        handler(peer, msg);
      }
    });

    // Handle disconnect
    peer.onClose(() => {
      this.peers.delete(peer.id);
      for (const handler of this.peerRemovedHandlers) {
        handler(peer.id);
      }
    });

    for (const handler of this.peerAddedHandlers) {
      handler(peer);
    }
  }

  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.close();
      this.peers.delete(peerId);
      for (const handler of this.peerRemovedHandlers) {
        handler(peerId);
      }
    }
  }

  getPeer(peerId: string): IPeer | undefined {
    return this.peers.get(peerId);
  }

  getAllPeers(): IPeer[] {
    return Array.from(this.peers.values());
  }

  getPeerCount(): number {
    return this.peers.size;
  }

  broadcast(message: PeerMessage): void {
    for (const peer of this.peers.values()) {
      peer.send(message);
    }
  }

  broadcastNodeChanged(nodeAddress: string): void {
    this.broadcast({ type: 'NODE_CHANGED', path: this.path, nodeAddress });
  }

  requestSyncFromAll(): void {
    for (const peer of this.peers.values()) {
      peer.requestSync();
    }
  }

  onPeerAdded(handler: (peer: IPeer) => void): () => void {
    this.peerAddedHandlers.add(handler);
    return () => this.peerAddedHandlers.delete(handler);
  }

  onPeerRemoved(handler: (peerId: string) => void): () => void {
    this.peerRemovedHandlers.add(handler);
    return () => this.peerRemovedHandlers.delete(handler);
  }

  onMessage(handler: (peer: IPeer, message: PeerMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  closeAll(): void {
    for (const peer of this.peers.values()) {
      peer.close();
    }
    this.peers.clear();
  }
}

// ============================================================================
// PeerConnectionBuilder - Creates a new peer connection
// ============================================================================

export class PeerConnectionBuilder {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private path: FosPath;
  private peerId: string;
  private state: ConnectionState = 'idle';
  private stateHandlers: Set<(state: ConnectionState) => void> = new Set();

  constructor(path: FosPath) {
    this.path = path;
    this.peerId = `peer-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
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
   * Create an offer. Returns the base64-encoded SDP string.
   * Waits for ICE gathering to complete so candidates are embedded in SDP.
   */
  async createOffer(): Promise<string> {
    this.setState('creating-offer');

    try {
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      // Log connection state changes for debugging
      this.pc.onconnectionstatechange = () => {
        console.log('[Peer Offerer] Connection state:', this.pc?.connectionState);
      };
      this.pc.oniceconnectionstatechange = () => {
        console.log('[Peer Offerer] ICE connection state:', this.pc?.iceConnectionState);
      };

      const channelName = `fos-${this.path.join('-') || 'root'}`;
      console.log('[Peer Offerer] Creating data channel:', channelName);
      this.dc = this.pc.createDataChannel(channelName, { ordered: true });

      this.dc.onopen = () => {
        console.log('[Peer Offerer] Data channel opened');
      };
      this.dc.onerror = (e) => {
        console.error('[Peer Offerer] Data channel error:', e);
      };

      // Create offer and wait for ICE gathering to complete
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('ICE gathering timed out')), 30000);

        this.pc!.onicegatheringstatechange = () => {
          if (this.pc!.iceGatheringState === 'complete') {
            clearTimeout(timeout);
            resolve();
          }
        };

        this.pc!.createOffer()
          .then((offer) => this.pc!.setLocalDescription(offer))
          .catch(reject);
      });

      this.setState('waiting-for-answer');

      // Standard format: type + sdp only (for compatibility with Tauri/webrtc-rs)
      // Path and peerId are stored locally, not sent in SDP
      return btoa(JSON.stringify({
        type: 'offer',
        sdp: this.pc.localDescription?.sdp,
      }));
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  /**
   * Accept an answer and return the connected peer.
   */
  async acceptAnswer(answerString: string): Promise<NodePeer> {
    this.setState('connecting');

    try {
      const answer = JSON.parse(atob(answerString));

      if (answer.type !== 'answer' || !this.pc || !this.dc) {
        throw new Error('Invalid state');
      }

      // Set remote description - candidates are embedded in SDP
      await this.pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp });

      // Wait for channel to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);

        if (this.dc!.readyState === 'open') {
          clearTimeout(timeout);
          resolve();
        } else {
          this.dc!.onopen = () => {
            clearTimeout(timeout);
            resolve();
          };
        }
      });

      this.setState('connected');
      return new NodePeer(this.peerId, this.path, this.pc, this.dc);
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  /**
   * Accept an offer and return both the answer string and (eventually) the peer.
   */
  async acceptOffer(offerString: string): Promise<{ answer: string; waitForConnection: () => Promise<NodePeer> }> {
    this.setState('connecting');

    try {
      const offer = JSON.parse(atob(offerString));
      console.log('[Peer Answerer] Accepting offer:', { type: offer.type, path: offer.path, hasSdp: !!offer.sdp });

      // Log critical SDP sections for debugging DTLS/data channel issues
      if (offer.sdp) {
        const sdp = offer.sdp as string;
        // Find a=setup line (DTLS role)
        const setupMatch = sdp.match(/a=setup:(\w+)/);
        console.log('[Peer Answerer] Offer a=setup:', setupMatch?.[1] || 'NOT FOUND');

        // Find m=application line (data channel)
        const applicationMatch = sdp.match(/m=application.*/);
        console.log('[Peer Answerer] Offer m=application:', applicationMatch?.[0] || 'NOT FOUND');

        // Find fingerprint
        const fingerprintMatch = sdp.match(/a=fingerprint:(\S+\s+\S+)/);
        console.log('[Peer Answerer] Offer fingerprint:', fingerprintMatch?.[1]?.substring(0, 30) + '...' || 'NOT FOUND');

        // Find ice-ufrag and ice-pwd (verify ICE credentials exist)
        const ufragMatch = sdp.match(/a=ice-ufrag:(\S+)/);
        const pwdMatch = sdp.match(/a=ice-pwd:(\S+)/);
        console.log('[Peer Answerer] Offer ICE credentials:', ufragMatch ? 'present' : 'MISSING', pwdMatch ? 'present' : 'MISSING');
      }

      if (offer.type !== 'offer') {
        throw new Error('Invalid offer');
      }

      this.path = offer.path || [];
      this.peerId = `peer-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      // Log connection state changes
      this.pc.onconnectionstatechange = () => {
        console.log('[Peer Answerer] Connection state:', this.pc?.connectionState);
        if (this.pc?.connectionState === 'failed') {
          console.error('[Peer Answerer] Connection failed! ICE state:', this.pc?.iceConnectionState);
        }
      };
      this.pc.oniceconnectionstatechange = () => {
        console.log('[Peer Answerer] ICE connection state:', this.pc?.iceConnectionState);
      };
      this.pc.onicecandidateerror = (e) => {
        console.error('[Peer Answerer] ICE candidate error:', e);
      };

      // Wait for data channel from offerer
      const dcPromise = new Promise<RTCDataChannel>((resolve, reject) => {
        console.log('[Peer Answerer] Waiting for data channel from offerer...');

        // Timeout if data channel never arrives
        const timeout = setTimeout(() => {
          console.error('[Peer Answerer] Data channel timeout! PC state:', this.pc?.connectionState);
          reject(new Error('Data channel not received'));
        }, 15000);

        this.pc!.ondatachannel = (e) => {
          clearTimeout(timeout);
          console.log('[Peer Answerer] Data channel received:', e.channel.label, 'state:', e.channel.readyState);
          resolve(e.channel);
        };
      });

      // Set remote description and create answer, wait for ICE gathering
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('ICE gathering timed out')), 30000);

        this.pc!.onicegatheringstatechange = () => {
          if (this.pc!.iceGatheringState === 'complete') {
            clearTimeout(timeout);
            resolve();
          }
        };

        this.pc!.setRemoteDescription({ type: 'offer', sdp: offer.sdp })
          .then(() => this.pc!.createAnswer())
          .then((answer) => this.pc!.setLocalDescription(answer))
          .catch(reject);
      });

      // Log our answer SDP before sending
      const answerSdp = this.pc.localDescription?.sdp;
      if (answerSdp) {
        const setupMatch = answerSdp.match(/a=setup:(\w+)/);
        console.log('[Peer Answerer] Answer a=setup:', setupMatch?.[1] || 'NOT FOUND');

        const fingerprintMatch = answerSdp.match(/a=fingerprint:(\S+\s+\S+)/);
        console.log('[Peer Answerer] Answer fingerprint:', fingerprintMatch?.[1]?.substring(0, 30) + '...' || 'NOT FOUND');
      }

      // Standard format: type + sdp only (for compatibility with Tauri/webrtc-rs)
      // Path and peerId are handled separately, not in the SDP exchange
      const answer = btoa(JSON.stringify({
        type: 'answer',
        sdp: answerSdp,
      }));

      const waitForConnection = async (): Promise<NodePeer> => {
        console.log('[Peer] waitForConnection: waiting for data channel...');
        const dc = await dcPromise;
        this.dc = dc;
        console.log('[Peer] waitForConnection: got data channel, state:', dc.readyState);

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.log('[Peer] waitForConnection: timeout! dc.readyState:', dc.readyState);
            reject(new Error('Connection timeout'));
          }, 10000);

          if (dc.readyState === 'open') {
            console.log('[Peer] waitForConnection: already open');
            clearTimeout(timeout);
            resolve();
          } else {
            console.log('[Peer] waitForConnection: waiting for open event...');
            dc.onopen = () => {
              console.log('[Peer] waitForConnection: data channel opened!');
              clearTimeout(timeout);
              resolve();
            };
          }
        });

        this.setState('connected');
        console.log('[Peer] waitForConnection: connected!');
        return new NodePeer(this.peerId, this.path, this.pc!, dc);
      };

      return { answer, waitForConnection };
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  cancel(): void {
    if (this.dc) this.dc.close();
    if (this.pc) this.pc.close();
    this.setState('idle');
  }
}

// ============================================================================
// UI Component - Multiple peers per node
// ============================================================================

export type NodePeersUIOptions = {
  peers: NodePeers;
};

/**
 * Renders peer list and connection UI for a node.
 */
export function renderNodePeersUI(options: NodePeersUIOptions): HTMLElement {
  const { peers } = options;

  const container = div({ class: 'fos-node-peers' });

  // Header
  const header = div({ class: 'fos-node-peers-header' }, [
    span({ class: 'fos-node-peers-title' }, ['Peers']),
    span({ class: 'fos-node-peers-count' }, [`(${peers.getPeerCount()})`]),
  ]);

  // Peer list
  const listEl = div({ class: 'fos-node-peers-list' });

  // Add peer button
  const addBtn = button({ class: 'fos-button fos-button--small' }, ['+ Add Peer']);

  // Connection form (hidden by default)
  const formEl = div({ class: 'fos-node-peers-form', style: 'display: none;' });

  const renderPeerList = () => {
    listEl.innerHTML = '';
    header.querySelector('.fos-node-peers-count')!.textContent = `(${peers.getPeerCount()})`;

    const allPeers = peers.getAllPeers();

    if (allPeers.length === 0) {
      listEl.appendChild(div({ class: 'fos-node-peers-empty' }, ['No peers connected']));
      return;
    }

    for (const peer of allPeers) {
      const peerEl = div({ class: 'fos-node-peers-item' }, [
        span({ class: 'fos-node-peers-item-id' }, [peer.id.slice(0, 12)]),
        span({ class: `fos-node-peers-item-status ${peer.isConnected() ? 'connected' : 'disconnected'}` }, [
          peer.isConnected() ? '\u2022' : '\u25CB',
        ]),
      ]);

      const removeBtn = button({ class: 'fos-button fos-button--small fos-button--secondary' }, ['\u00D7']);
      removeBtn.addEventListener('click', () => peers.removePeer(peer.id));

      peerEl.appendChild(removeBtn);
      listEl.appendChild(peerEl);
    }
  };

  const renderAddForm = () => {
    formEl.innerHTML = '';
    formEl.style.display = 'block';
    addBtn.style.display = 'none';

    let builder: AnyPeerConnectionBuilder | null = null;

    const tabs = div({ class: 'fos-node-peers-tabs' });
    const createTab = button({ class: 'fos-button fos-button--small active' }, ['Create']);
    const joinTab = button({ class: 'fos-button fos-button--small' }, ['Join']);

    const contentEl = div({ class: 'fos-node-peers-form-content' });

    const renderCreateForm = () => {
      createTab.classList.add('active');
      joinTab.classList.remove('active');
      contentEl.innerHTML = '';

      const createBtn = button({ class: 'fos-button' }, ['Generate Invite']);

      createBtn.addEventListener('click', async () => {
        builder = createPeerConnectionBuilder(peers.path);

        try {
          const offer = await builder.createOffer();

          contentEl.innerHTML = '';

          const textarea = el('textarea', { class: 'fos-peer-connection-textarea', readonly: 'true' }) as HTMLTextAreaElement;
          textarea.value = offer;

          const copyBtn = button({ class: 'fos-button fos-button--small' }, ['Copy']);
          copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(offer);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
          });

          const answerInput = el('textarea', {
            class: 'fos-peer-connection-textarea',
            placeholder: 'Paste response...',
          }) as HTMLTextAreaElement;

          const connectBtn = button({ class: 'fos-button' }, ['Connect']);
          const statusEl = div({ class: 'fos-peer-connection-status' });

          connectBtn.addEventListener('click', async () => {
            if (!builder || !answerInput.value.trim()) return;

            // Show connecting state
            connectBtn.disabled = true;
            connectBtn.textContent = 'Connecting...';
            statusEl.textContent = '';
            statusEl.className = 'fos-peer-connection-status';

            try {
              const peer = await builder.acceptAnswer(answerInput.value.trim());
              peers.addPeer(peer);

              // Show success
              statusEl.textContent = 'Connected!';
              statusEl.className = 'fos-peer-connection-status fos-peer-connection-status--success';
              connectBtn.textContent = 'Connected!';

              // Brief delay to show success before hiding
              setTimeout(() => hideForm(), 1000);
            } catch (e: any) {
              connectBtn.disabled = false;
              connectBtn.textContent = 'Connect';
              statusEl.textContent = `Error: ${e.message}`;
              statusEl.className = 'fos-peer-connection-status fos-peer-connection-status--error';
            }
          });

          contentEl.appendChild(div({}, ['Send this invite:']));
          contentEl.appendChild(textarea);
          contentEl.appendChild(div({ class: 'fos-peer-connection-row' }, [copyBtn]));
          contentEl.appendChild(div({}, ['Paste response:']));
          contentEl.appendChild(answerInput);
          contentEl.appendChild(div({ class: 'fos-peer-connection-row' }, [connectBtn]));
          contentEl.appendChild(statusEl);
        } catch (e: any) {
          alert(`Error: ${e.message}`);
        }
      });

      contentEl.appendChild(createBtn);
    };

    const renderJoinForm = () => {
      createTab.classList.remove('active');
      joinTab.classList.add('active');
      contentEl.innerHTML = '';

      const offerInput = el('textarea', {
        class: 'fos-peer-connection-textarea',
        placeholder: 'Paste invite...',
      }) as HTMLTextAreaElement;

      const joinBtn = button({ class: 'fos-button' }, ['Join']);

      joinBtn.addEventListener('click', async () => {
        if (!offerInput.value.trim()) return;

        builder = createPeerConnectionBuilder(peers.path);

        try {
          const { answer, waitForConnection } = await builder.acceptOffer(offerInput.value.trim());

          contentEl.innerHTML = '';

          const textarea = el('textarea', { class: 'fos-peer-connection-textarea', readonly: 'true' }) as HTMLTextAreaElement;
          textarea.value = answer;

          const copyBtn = button({ class: 'fos-button fos-button--small' }, ['Copy']);
          copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(answer);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
          });

          const waitingEl = div({ class: 'fos-peer-connection-waiting' }, ['Waiting for connection...']);

          contentEl.appendChild(div({}, ['Send this response:']));
          contentEl.appendChild(textarea);
          contentEl.appendChild(div({ class: 'fos-peer-connection-row' }, [copyBtn]));
          contentEl.appendChild(waitingEl);

          const peer = await waitForConnection();
          peers.addPeer(peer);

          // Show success
          waitingEl.textContent = 'Connected!';
          waitingEl.className = 'fos-peer-connection-status fos-peer-connection-status--success';

          // Brief delay to show success before hiding
          setTimeout(() => hideForm(), 1000);
        } catch (e: any) {
          alert(`Error: ${e.message}`);
        }
      });

      contentEl.appendChild(div({}, ['Paste the invite:']));
      contentEl.appendChild(offerInput);
      contentEl.appendChild(div({ class: 'fos-peer-connection-row' }, [joinBtn]));
    };

    createTab.addEventListener('click', renderCreateForm);
    joinTab.addEventListener('click', renderJoinForm);

    const cancelBtn = button({ class: 'fos-button fos-button--secondary fos-button--small' }, ['Cancel']);
    cancelBtn.addEventListener('click', () => {
      builder?.cancel();
      hideForm();
    });

    tabs.appendChild(createTab);
    tabs.appendChild(joinTab);
    tabs.appendChild(div({ style: 'flex: 1;' }));
    tabs.appendChild(cancelBtn);

    formEl.appendChild(tabs);
    formEl.appendChild(contentEl);

    renderCreateForm();
  };

  const hideForm = () => {
    formEl.style.display = 'none';
    formEl.innerHTML = '';
    addBtn.style.display = 'inline-flex';
    renderPeerList();
  };

  addBtn.addEventListener('click', renderAddForm);

  // Subscribe to peer changes
  peers.onPeerAdded(() => renderPeerList());
  peers.onPeerRemoved(() => renderPeerList());

  container.appendChild(header);
  container.appendChild(listEl);
  container.appendChild(addBtn);
  container.appendChild(formEl);

  renderPeerList();

  return container;
}

// ============================================================================
// Factory function - creates appropriate builder based on environment
// ============================================================================

export type AnyPeerConnectionBuilder = PeerConnectionBuilder | TauriPeerConnectionBuilder;
export type AnyNodePeer = NodePeer | TauriNodePeer;

/**
 * Creates a peer connection builder appropriate for the current environment.
 * Uses Tauri backend in desktop app, browser WebRTC otherwise.
 */
export function createPeerConnectionBuilder(path: FosPath): AnyPeerConnectionBuilder {
  if (isTauri()) {
    console.log('[Peer] Using Tauri WebRTC backend');
    return new TauriPeerConnectionBuilder(path);
  } else {
    console.log('[Peer] Using browser WebRTC');
    return new PeerConnectionBuilder(path);
  }
}

/**
 * Check if WebRTC is available in the current environment.
 */
export function isWebRTCAvailable(): boolean {
  if (isTauri()) {
    // Tauri backend always supports WebRTC via webrtc-rs
    return true;
  }
  return typeof RTCPeerConnection !== 'undefined';
}
