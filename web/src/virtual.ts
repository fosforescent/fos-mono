import { createReplica, serializeReplica, type Capability, type Scope } from '../../shared/sync/index'
import { FosStore } from '../../shared/dag-implementation/store'
import type { NodeRequest, ProvidedNode } from '../../shared/sync/index'
import type { Session } from './api'
import { createLocalStorageAdapter, type ReplicaStorage } from './storage'

export type VirtualPeer = { id: string; token: string; hostTab: string; name: string; scope: Scope; branches?: Record<string, string>; dataSessionId?: string; shareAccount: boolean }
const PREFIX = 'fos.virtual.'

export function virtualPeerToken(): string | null {
  const url = new URL(location.href)
  const explicit = url.searchParams.get('virtual')
  if (url.searchParams.has('virtual')) {
    try { sessionStorage.setItem(PREFIX + 'identity', explicit || 'invalid') } catch { /* URL still binds this peer when tab storage is restricted */ }
    return explicit || 'invalid'
  }
  try { return sessionStorage.getItem(PREFIX + 'identity') } catch { return null }
}

export function virtualPeerFromUrl(): VirtualPeer | null {
  const token = virtualPeerToken()
  if (!token || !/^[a-f0-9-]{36}$/.test(token)) return null
  try {
    const value = JSON.parse(localStorage.getItem(PREFIX + token + '.connection') ?? 'null') as VirtualPeer | null
    return value?.token === token && typeof value.id === 'string' && typeof value.hostTab === 'string' && Array.isArray(value.scope) ? value : null
  } catch { return null }
}

export function virtualStorage(peer: VirtualPeer): ReplicaStorage {
  const prefix = PREFIX + peer.token + '.'
  const storage: Storage = {
    get length() { return 0 }, key: () => null, clear: () => { throw new Error('Use the replica storage API') },
    getItem: (key) => localStorage.getItem(prefix + key),
    setItem: (key, value) => localStorage.setItem(prefix + key, value),
    removeItem: (key) => localStorage.removeItem(prefix + key)
  }
  return createLocalStorageAdapter(storage)
}

type Hooks = {
  provide?: (peer: VirtualPeer, request: NodeRequest) => ProvidedNode
  presence: () => void
  dataSessionId: () => string | undefined
  decide: (peer: VirtualPeer, scope: Scope, proposalId: string, decision: 'approve' | 'reject') => Promise<void>
  grants: (peer: VirtualPeer) => Capability[] | null
  welcome: (capabilities: Capability[], hostName: string, session?: Session) => void
  changed: () => void
  revision: () => string
  session: () => Session | null
  name: () => string
}

/** Each invitation has one same-origin channel; node exchange (`requestNode`) does the syncing. */
export class VirtualPeers {
  private nodePending = new Map<number, { resolve: (node: ProvidedNode) => void; reject: (error: Error) => void }>()
  private closed = false
  readonly hostTab: string
  private rooms = new Map<string, { peer: VirtualPeer; channel: BroadcastChannel; seen: number }>()
  private channel: BroadcastChannel | null = null
  private revision: string | null = null
  private seen = 0
  private serial = 0
  private decisions = new Map<number, { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>()
  private heartbeat: ReturnType<typeof setInterval> | null = null
  constructor(readonly guest: VirtualPeer | null, private hooks: Hooks) {
    // A window opened by window.open initially inherits its opener's sessionStorage.
    const tabKey = PREFIX + 'tab' + (guest ? '.' + guest.token : '')
    this.hostTab = sessionStorage.getItem(tabKey) ?? crypto.randomUUID()
    sessionStorage.setItem(tabKey, this.hostTab)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.endsWith('.connection') || !key.startsWith(PREFIX)) continue
      try {
        const peer = JSON.parse(localStorage.getItem(key)!) as VirtualPeer
        if (peer.hostTab === this.hostTab) {
          if (!peer.dataSessionId) { peer.dataSessionId = hooks.dataSessionId(); localStorage.setItem(key, JSON.stringify(peer)) }
          if (peer.dataSessionId === hooks.dataSessionId()) this.host(peer)
        }
      } catch { /* ignore damaged descriptors */ }
    }
    if (guest) {
      this.channel = new BroadcastChannel(PREFIX + guest.token)
      this.channel.onmessage = ({ data }) => {
        if (data.t === 'node-result') {
          const pending = this.nodePending.get(data.id)
          if (pending) { this.nodePending.delete(data.id); if (data.node) pending.resolve(data.node); else pending.reject(new Error(data.error ?? 'Node request failed.')) }
          return
        }
        if (data.t === 'welcome') {
          this.seen = Date.now()
          const first = !localStorage.getItem(PREFIX + guest.token + '.account-initialized')
          localStorage.setItem(PREFIX + guest.token + '.account-initialized', '1')
          const previousRevision = this.revision
          this.revision = data.revision
          this.hooks.welcome(data.capabilities, data.name, first && guest.shareAccount ? data.session : undefined)
          if (previousRevision !== null && previousRevision !== data.revision) this.hooks.changed()
        } else if (data.t === 'revoked') { this.seen = 0; this.hooks.welcome([], data.name); this.hooks.changed() }
        else if (data.t === 'changed') this.hooks.changed()
        else if (data.t === 'decision-result') {
          const pending = this.decisions.get(data.id)
          if (!pending) return
          clearTimeout(pending.timer); this.decisions.delete(data.id)
          if (data.error) pending.reject(new Error(data.error)); else pending.resolve()
        }
      }
    }
    if (guest) this.heartbeat = setInterval(() => this.hello(), 3000)
    this.hello()
  }
  get connected(): boolean { return !this.closed && !!this.guest && Date.now() - this.seen < 12_000 }
  isOnline(id: string): boolean { return [...this.rooms.values()].some((room) => room.peer.id === id && Date.now() - room.seen < 12_000) }
  private hello(): void { this.channel?.postMessage({ t: 'hello', peerId: this.guest!.id, requestAccount: !localStorage.getItem(PREFIX + this.guest!.token + '.account-initialized') }); if (this.guest && !this.connected) this.hooks.changed() }
  register(peer: VirtualPeer): void {
    localStorage.setItem(PREFIX + peer.token + '.connection', JSON.stringify(peer))
    const storage = virtualStorage(peer)
    storage.saveReplica(serializeReplica(createReplica(peer.id, new FosStore())))
    storage.savePrefs({ deviceName: peer.name })
    this.host(peer)
  }
  unregister(peer: VirtualPeer): void {
    this.rooms.get(peer.token)?.channel.close(); this.rooms.delete(peer.token)
    localStorage.removeItem(PREFIX + peer.token + '.connection')
  }
  private host(peer: VirtualPeer): void {
    const channel = new BroadcastChannel(PREFIX + peer.token)
    this.rooms.set(peer.token, { peer, channel, seen: 0 })
    channel.onmessage = ({ data }) => {
      if (this.closed) return
      if (data.peerId !== peer.id) return
      const room = this.rooms.get(peer.token)!
      if (data.t === 'bye') { room.seen = 0; this.hooks.presence(); return }
      const wasOnline = Date.now() - room.seen < 12_000
      room.seen = Date.now()
      if (!wasOnline) this.hooks.presence()
      if (data.t === 'hello') {
        // Resolve current grants through the host hook; no replica content is sent before this check.
        const capabilities = this.hooks.grants(peer)
        if (!capabilities?.includes('read')) { channel.postMessage({ t: 'revoked', name: this.hooks.name() }); return }
        channel.postMessage({ t: 'welcome', revision: this.hooks.revision(), name: this.hooks.name(), capabilities, session: peer.shareAccount && data.requestAccount ? this.hooks.session() : undefined })
      } else if (data.t === 'node') {
        try {
          if (!this.hooks.provide || !this.hooks.grants(peer)?.includes('read')) throw new Error('Node access denied.')
          channel.postMessage({ t: 'node-result', id: data.id, node: this.hooks.provide(peer, data.request) })
        } catch (error) { channel.postMessage({ t: 'node-result', id: data.id, error: error instanceof Error ? error.message : String(error) }) }
      } else if (data.t === 'decision') {
        void this.hooks.decide(peer, data.scope, data.proposalId, data.decision).then(
          () => { if (!this.closed) channel.postMessage({ t: 'decision-result', id: data.id }) },
          (error) => { if (!this.closed) channel.postMessage({ t: 'decision-result', id: data.id, error: error instanceof Error ? error.message : String(error) }) }
        )
      }
    }
  }
  changed(): void { if (this.closed) return; for (const room of this.rooms.values()) room.channel.postMessage({ t: 'changed' }) }
  requestNode(request: NodeRequest): Promise<ProvidedNode> {
    if (!this.channel || !this.connected) return Promise.reject(new Error('The parent tab is unavailable.'))
    return new Promise((resolve, reject) => {
      const id = ++this.serial
      const timer = setTimeout(() => { this.nodePending.delete(id); reject(new Error('Node request timed out.')) }, 8000)
      this.nodePending.set(id, { resolve: node => { clearTimeout(timer); resolve(node) }, reject: error => { clearTimeout(timer); reject(error) } })
      try { this.channel!.postMessage({ t: 'node', id, peerId: this.guest!.id, request }) }
      catch (error) { clearTimeout(timer); this.nodePending.delete(id); reject(error) }
    })
  }
  decide(scope: Scope, proposalId: string, decision: 'approve' | 'reject'): Promise<void> {
    if (!this.channel || !this.connected) return Promise.reject(new Error('The parent tab is unavailable.'))
    return new Promise((resolve, reject) => {
      const id = ++this.serial
      const timer = setTimeout(() => { this.decisions.delete(id); reject(new Error('The parent tab did not answer.')) }, 8000)
      this.decisions.set(id, { resolve, reject, timer })
      this.channel!.postMessage({ t: 'decision', id, peerId: this.guest!.id, scope, proposalId, decision })
    })
  }
  close(): void {
    for (const pending of this.nodePending.values()) pending.reject(new Error('Virtual connection closed.'))
    this.nodePending.clear()
    if (this.closed) return
    this.channel?.postMessage({ t: 'bye', peerId: this.guest!.id })
    this.closed = true
    this.seen = 0
    if (this.heartbeat) clearInterval(this.heartbeat); this.channel?.close(); this.channel = null
    for (const room of this.rooms.values()) room.channel.close()
    this.rooms.clear()
    for (const p of this.decisions.values()) { clearTimeout(p.timer); p.reject(new Error('Virtual connection closed')) }
    this.decisions.clear()
  }
}
