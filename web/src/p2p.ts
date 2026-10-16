/**
 * Direct (peer-to-peer) connection between two devices.
 *
 * The inviting device is the *host*: it serves the same sync protocol the
 * backend does (`serveSync`) for the node it is showing, so the guest's
 * replica attaches to that node exactly as it would to an account. If the host
 * is itself signed in, the guest's changes reach the account through it.
 *
 * Bootstrapping needs one offer and one answer to cross between the devices.
 * They travel over whatever transport the devices have in common:
 *   - text  (copy/paste, any messenger)
 *   - video (QR code shown on one screen, scanned by the other's camera)
 *   - audio (not implemented yet; the Transport interface is the slot for it)
 * Once the WebRTC data channel is open, sync runs over it. If WebRTC cannot be
 * bootstrapped, the same `encodeMessage`/`decodeMessage` envelopes can be
 * relayed by hand over the signalling transport (`ManualRelay`), which is slower
 * but needs nothing else.
 */

import type { SyncError, SyncRequest, SyncResponse } from '../../shared/sync/index'
import type { NodeRequest, ProvidedNode, Capability, Scope } from '../../shared/sync/index'

export type Signal = { v: 1; role: 'offer' | 'answer'; sdp: string; peerId: string; name: string }

export type ChannelMessage =
  | { t: 'hello'; peerId: string; name: string; capabilities?: Capability[]; scope?: Scope }
  | { t: 'welcome'; peerId: string; name: string; capabilities?: Capability[]; scope?: Scope }
  | { t: 'node'; id: number; request: NodeRequest }
  | { t: 'node-result'; id: number; node?: ProvidedNode; error?: string }
  | { t: 'denied' }
  | { t: 'sync'; id: number; request: SyncRequest }
  | { t: 'sync-result'; id: number; response?: SyncResponse; error?: SyncError }
  | { t: 'changed' }

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

// --- envelopes: compact strings that fit in a QR code or a chat message ----

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeMessage(value: unknown): string {
  return 'fosp2p.' + toBase64Url(JSON.stringify(value))
}

export function decodeMessage<T = unknown>(text: string): T {
  const trimmed = text.trim()
  if (!trimmed.startsWith('fosp2p.')) throw new Error('not a Fosforescent connection code')
  return JSON.parse(fromBase64Url(trimmed.slice('fosp2p.'.length))) as T
}

export function isWebRtcAvailable(): boolean {
  return typeof RTCPeerConnection !== 'undefined'
}

/** Strip candidates we never use so the offer stays small enough for a QR code. */
function compactSdp(sdp: string): string {
  return sdp
    .split(/\r?\n/)
    .filter((line) => !/^a=candidate:.* (tcp|TCP) /.test(line) && !line.startsWith('a=extmap') && !line.startsWith('a=msid-semantic'))
    .join('\r\n')
}

async function gatherLocalDescription(pc: RTCPeerConnection, make: () => Promise<RTCSessionDescriptionInit>, timeoutMs = 4000): Promise<string> {
  await pc.setLocalDescription(await make())
  await new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve()
    const timer = setTimeout(resolve, timeoutMs) // use whatever candidates arrived in time
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') { clearTimeout(timer); resolve() }
    })
  })
  return compactSdp(pc.localDescription?.sdp ?? '')
}

// --- a connection, once open ----------------------------------------------

type Pending = { resolve: (r: SyncResponse) => void; reject: (e: Error) => void }

export class DirectLink {
  readonly pc: RTCPeerConnection
  readonly channel: RTCDataChannel
  remotePeerId: string | null = null
  remoteName: string | null = null
  remoteScope: Scope = []
  remoteCapabilities: Capability[] = []
  private nextId = 1
  private pending = new Map<number, Pending>()
  private nodePending = new Map<number, { resolve: (node: ProvidedNode) => void; reject: (error: Error) => void }>()
  onMessage: ((message: ChannelMessage) => void) | null = null
  onClose: (() => void) | null = null

  constructor(pc: RTCPeerConnection, channel: RTCDataChannel) {
    this.pc = pc
    this.channel = channel
    channel.addEventListener('message', (event) => {
      let message: ChannelMessage
      try { message = JSON.parse(String(event.data)) as ChannelMessage } catch { return }
      if ((message.t === 'welcome' || message.t === 'hello') && message.peerId === this.remotePeerId) { this.remoteScope = message.scope ?? []; this.remoteCapabilities = message.capabilities ?? [] }
      if (message.t === 'node-result') {
        const pending = this.nodePending.get(message.id)
        if (pending) { this.nodePending.delete(message.id); if (message.node) pending.resolve(message.node); else pending.reject(new Error(message.error ?? 'Node request failed.')) }
        return
      }
      if (message.t === 'sync-result') {
        const waiter = this.pending.get(message.id)
        if (waiter) {
          this.pending.delete(message.id)
          if (message.response) waiter.resolve(message.response)
          else waiter.reject(new Error(message.error?.error ?? 'sync failed'))
        }
        return
      }
      this.onMessage?.(message)
    })
    channel.addEventListener('close', () => {
      for (const waiter of this.pending.values()) waiter.reject(new Error('connection closed'))
      this.pending.clear()
      for (const waiter of this.nodePending.values()) waiter.reject(new Error('connection closed'))
      this.nodePending.clear()
      this.onClose?.()
    })
  }

  get open(): boolean {
    return this.channel.readyState === 'open'
  }

  send(message: ChannelMessage): void {
    if (!this.open) throw new Error('connection is not open')
    this.channel.send(JSON.stringify(message))
  }

  /** Guest side: run one sync round trip over the channel. */
  requestNode(request: NodeRequest, timeoutMs = 20000): Promise<ProvidedNode> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.nodePending.delete(id); reject(new Error('Node request timed out.')) }, timeoutMs)
      this.nodePending.set(id, { resolve: node => { clearTimeout(timer); resolve(node) }, reject: error => { clearTimeout(timer); reject(error) } })
      try { this.send({ t: 'node', id, request }) }
      catch (error) { clearTimeout(timer); this.nodePending.delete(id); reject(error) }
    })
  }

  sync(request: SyncRequest, timeoutMs = 20000): Promise<SyncResponse> {
    const id = this.nextId++
    return new Promise<SyncResponse>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('sync timed out')) }, timeoutMs)
      this.pending.set(id, {
        resolve: (r) => { clearTimeout(timer); resolve(r) },
        reject: (e) => { clearTimeout(timer); reject(e) }
      })
      this.send({ t: 'sync', id, request })
    })
  }

  close(): void {
    try { this.channel.close() } catch { /* ignore */ }
    try { this.pc.close() } catch { /* ignore */ }
  }
}

function waitForOpen(channel: RTCDataChannel, timeoutMs = 30000): Promise<void> {
  if (channel.readyState === 'open') return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the other device did not connect in time')), timeoutMs)
    channel.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
    channel.addEventListener('error', () => { clearTimeout(timer); reject(new Error('connection failed')) }, { once: true })
  })
}

// --- host (inviting device) ---------------------------------------------------

export class DirectHost {
  private pc: RTCPeerConnection | null = null
  private channel: RTCDataChannel | null = null
  readonly peerId: string
  readonly name: string

  constructor(peerId: string, name: string) {
    this.peerId = peerId
    this.name = name
  }

  /** Step 1: produce the offer code to show or send to the guest. */
  async createOffer(): Promise<string> {
    if (!isWebRtcAvailable()) throw new Error('WebRTC is not available on this device')
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.channel = this.pc.createDataChannel('fos-sync', { ordered: true })
    const sdp = await gatherLocalDescription(this.pc, () => this.pc!.createOffer())
    const signal: Signal = { v: 1, role: 'offer', sdp, peerId: this.peerId, name: this.name }
    return encodeMessage(signal)
  }

  /** Step 3: take the guest's answer code; resolves with the open link. */
  async acceptAnswer(code: string): Promise<DirectLink> {
    if (!this.pc || !this.channel) throw new Error('create an offer first')
    const signal = decodeMessage<Signal>(code)
    if (signal.v !== 1 || signal.role !== 'answer') throw new Error('that is not an answer code')
    await this.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp })
    await waitForOpen(this.channel)
    const link = new DirectLink(this.pc, this.channel)
    link.remotePeerId = signal.peerId
    link.remoteName = signal.name
    return link
  }

  cancel(): void {
    try { this.pc?.close() } catch { /* ignore */ }
    this.pc = null
    this.channel = null
  }
}

// --- guest (connecting device) ----------------------------------------------

export class DirectGuest {
  readonly peerId: string
  readonly name: string

  constructor(peerId: string, name: string) {
    this.peerId = peerId
    this.name = name
  }

  /** Step 2: take the host's offer code; returns the answer code and the (future) link. */
  async acceptOffer(code: string): Promise<{ answer: string; hostPeerId: string; hostName: string; link: Promise<DirectLink> }> {
    if (!isWebRtcAvailable()) throw new Error('WebRTC is not available on this device')
    const signal = decodeMessage<Signal>(code)
    if (signal.v !== 1 || signal.role !== 'offer') throw new Error('that is not an offer code')
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const link = new Promise<DirectLink>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('the other device did not connect in time')), 60000)
      pc.addEventListener('datachannel', (event) => {
        waitForOpen(event.channel).then(() => {
          clearTimeout(timer)
          const l = new DirectLink(pc, event.channel)
          l.remotePeerId = signal.peerId
          l.remoteName = signal.name
          resolve(l)
        }, reject)
      })
    })
    await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp })
    const sdp = await gatherLocalDescription(pc, () => pc.createAnswer())
    const answer: Signal = { v: 1, role: 'answer', sdp, peerId: this.peerId, name: this.name }
    return { answer: encodeMessage(answer), hostPeerId: signal.peerId, hostName: signal.name, link }
  }
}

// --- manual relay fallback ---------------------------------------------------

/**
 * When no data channel can be established, sync messages are carried by hand:
 * the guest copies a request code to the host, the host pastes it and copies
 * the result code back. Slow, but it works over any channel that moves text.
 */
export const ManualRelay = {
  encodeRequest: (request: SyncRequest) => encodeMessage({ t: 'sync', id: 0, request }),
  decodeRequest: (code: string): SyncRequest => {
    const m = decodeMessage<ChannelMessage>(code)
    if (m.t !== 'sync') throw new Error('that is not a sync request code')
    return m.request
  },
  encodeResult: (response: SyncResponse | SyncError) =>
    encodeMessage('error' in response ? { t: 'sync-result', id: 0, error: response } : { t: 'sync-result', id: 0, response }),
  decodeResult: (code: string): SyncResponse => {
    const m = decodeMessage<ChannelMessage>(code)
    if (m.t !== 'sync-result') throw new Error('that is not a sync result code')
    if (!m.response) throw new Error(m.error?.error ?? 'sync failed')
    return m.response
  }
}
