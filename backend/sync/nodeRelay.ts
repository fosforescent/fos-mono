import { randomUUID } from 'node:crypto'
import type { NodeRequest, ProvidedNode } from '@fosforescent/shared/sync/index'

type Socket = { readyState: number; send(data: string): void; on(event: 'close', callback: () => void): unknown }
type Provider = { socket: Socket; scope: string[]; capabilities: string[] }

/** Authenticated, account-isolated rendezvous. Responses are accepted only from
 * the exact socket asked, and requests never broadcast to other devices. */
export class NodeRelay {
  private providers = new Map<string, Provider>()
  private pending = new Map<string, { user: number; provider: Provider; resolve(node: ProvidedNode): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>()
  constructor(private timeoutMs = 8000) {}
  register(user: number, peer: string, socket: Socket, scope: string[], capabilities: string[]): void {
    if (!peer || peer.length > 128 || !Array.isArray(scope) || scope.length > 64 || scope.some(s => typeof s !== 'string' || !s || s === '.' || s === '..')) return
    const key = JSON.stringify([user, peer]), provider = { socket, scope: [...scope], capabilities: [...capabilities] }
    this.providers.set(key, provider)
    socket.on('close', () => {
      if (this.providers.get(key) === provider) this.providers.delete(key)
      for (const [id, pending] of this.pending) if (pending.provider.socket === socket) { clearTimeout(pending.timer); this.pending.delete(id); pending.reject(new Error('Node provider disconnected.')) }
    })
  }
  request(user: number, peer: string, address: string[], input: Omit<NodeRequest, 'scope' | 'path'>): Promise<ProvidedNode> {
    const provider = this.providers.get(JSON.stringify([user, peer]))
    if (!provider || provider.socket.readyState !== 1 || !provider.capabilities.includes('provideNode')) return Promise.reject(new Error('Node provider is offline or does not offer provideNode.'))
    if (provider.scope.length > address.length || !provider.scope.every((s, i) => address[i] === s)) return Promise.reject(new Error('Node is outside the provider attachment.'))
    if ([...this.pending.values()].filter(p => p.user === user).length >= 64) return Promise.reject(new Error('Too many pending node requests.'))
    const request: NodeRequest = { ...input, scope: provider.scope, path: address.slice(provider.scope.length) }
    return new Promise((resolve, reject) => {
      const id = randomUUID()
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Node provider timed out.')) }, this.timeoutMs)
      this.pending.set(id, { user, provider, resolve, reject, timer })
      try { provider.socket.send(JSON.stringify({ type: 'provide_node', id, request })) }
      catch { clearTimeout(timer); this.pending.delete(id); reject(new Error('Node provider is unavailable.')) }
    })
  }
  receive(user: number, socket: Socket, message: { type?: unknown; id?: unknown; node?: unknown; error?: unknown }): boolean {
    if (message.type !== 'provided_node' || typeof message.id !== 'string') return false
    const pending = this.pending.get(message.id)
    if (!pending || pending.user !== user || pending.provider.socket !== socket) return true
    clearTimeout(pending.timer); this.pending.delete(message.id)
    if (message.node && typeof message.node === 'object') pending.resolve(message.node as ProvidedNode)
    else pending.reject(new Error(typeof message.error === 'string' ? message.error : 'Node provider refused the request.'))
    return true
  }
}

export const nodeRelay = new NodeRelay()
