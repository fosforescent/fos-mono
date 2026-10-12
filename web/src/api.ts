import type { SyncRequest, SyncResponse } from '../../shared/sync/index'

export type Session = {
  baseUrl: string
  jwt: string
  username: string
  /** 'user' after a password sign-in; 'peer' for a credential granted through an invite. */
  kind: 'user' | 'peer'
}

export type Attachment = {
  username: string
  serverPeerId: string
  peerId: string
  scope: string[]
  scopeNames: string[]
  attached: boolean
  kind: 'user' | 'peer'
}

export type InviteRequest = {
  id: number
  peerId: string | null
  peerName: string | null
  scope: string[]
  scopeNames: string[]
  status: string
  createdAt: string
  expiresAt: string
}

export type ConnectPoll =
  | { status: 'pending' | 'denied' | 'expired' }
  | { status: 'approved'; jwt?: string; username?: string; scope?: string[]; scopeNames?: string[] }

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown }
    if (typeof data?.error === 'string') return data.error
  } catch {
    // not JSON
  }
  return `${response.status} ${response.statusText}`.trim()
}

export async function login(baseUrl: string, username: string, password: string): Promise<Session> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  if (!response.ok) throw new ApiError(response.status, await readError(response))
  const data = (await response.json()) as { access_token?: string }
  if (!data.access_token) throw new ApiError(500, 'login response had no token')
  return { baseUrl, jwt: data.access_token, username, kind: 'user' }
}

async function authed<T>(session: Session, method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${session.baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.jwt}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  if (!response.ok) throw new ApiError(response.status, await readError(response))
  return (await response.json()) as T
}

/** Where the account says this device should attach (root by default, or a node it was invited to). */
export function getAttachment(session: Session, peerId: string): Promise<Attachment> {
  return authed<Attachment>(session, 'GET', `/user/data/peer-sync/attachment?peerId=${encodeURIComponent(peerId)}`)
}

export function createInvite(session: Session, scope: string[], scopeNames: string[]): Promise<{ token: string; inviteId: number; expiresAt: string }> {
  return authed(session, 'POST', '/user/data/peer-invite', { scope, scopeNames })
}

export function decideProposal(session: Session, scope: string[], proposalId: string, decision: 'approve' | 'reject'): Promise<{ changed: boolean }> {
  return authed(session, 'POST', '/user/data/peer-sync/proposals', { scope, proposalId, decision })
}

export function listInviteRequests(session: Session): Promise<{ requests: InviteRequest[] }> {
  return authed(session, 'GET', '/user/data/peer-invite/requests')
}

/** Approving decides what the device may do on the node: propose changes, or also approve proposals. */
export function answerInviteRequest(session: Session, id: number, decision: 'approve' | 'deny', capabilities: Array<'edit' | 'approve'> = ['edit']): Promise<unknown> {
  return authed(session, 'POST', `/user/data/peer-invite/${id}/${decision}`, decision === 'approve' ? { capabilities } : {})
}

/** Claim an invite token with no session yet. */
export async function claimInvite(baseUrl: string, token: string, peerId: string, name: string): Promise<{ requestId: string; scope: string[]; scopeNames: string[] }> {
  const response = await fetch(`${baseUrl}/peer/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token.trim(), peerId, name })
  })
  if (!response.ok) throw new ApiError(response.status, await readError(response))
  return (await response.json()) as { requestId: string; scope: string[]; scopeNames: string[] }
}

export async function pollConnect(baseUrl: string, requestId: string, peerId: string): Promise<ConnectPoll> {
  const response = await fetch(`${baseUrl}/peer/connect/${encodeURIComponent(requestId)}?peerId=${encodeURIComponent(peerId)}`)
  if (!response.ok) throw new ApiError(response.status, await readError(response))
  return (await response.json()) as ConnectPoll
}

export async function peerSync(session: Session, request: SyncRequest): Promise<SyncResponse> {
  const response = await fetch(`${session.baseUrl}/user/data/peer-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.jwt}`
    },
    body: JSON.stringify(request)
  })
  if (!response.ok) throw new ApiError(response.status, await readError(response))
  return (await response.json()) as SyncResponse
}

export type EventHandlers = {
  onMessage(message: Record<string, unknown>): void
  onOpen?(): void
  onClose?(): void
}

/** A device deliberately detaches itself from the node it is attached to. */
export function detachSelf(session: Session, peerId: string): Promise<{ detached: boolean }> {
  return authed(session, 'DELETE', `/user/data/peer-sync/attachment?peerId=${encodeURIComponent(peerId)}`)
}

/**
 * Open the backend's per-user WebSocket, announce which device this is (for
 * presence), and return a function that closes it.
 */
export function connectEvents(session: Session, peerId: string, handlers: EventHandlers): () => void {
  const wsUrl = session.baseUrl.replace(/^http/, 'ws') + `/ws/${session.jwt}`
  let socket: WebSocket | null = null
  let closedByUs = false
  try {
    socket = new WebSocket(wsUrl)
  } catch (error) {
    console.warn('websocket unavailable', error)
    return () => undefined
  }
  socket.addEventListener('open', () => {
    try { socket?.send(JSON.stringify({ type: 'hello', peerId })) } catch { /* ignore */ }
    handlers.onOpen?.()
  })
  socket.addEventListener('message', (event) => {
    try {
      const parsed = JSON.parse(String(event.data)) as Record<string, unknown>
      handlers.onMessage(parsed)
    } catch {
      // ignore non-JSON frames
    }
  })
  socket.addEventListener('close', () => {
    if (!closedByUs) handlers.onClose?.()
  })
  socket.addEventListener('error', () => undefined)
  return () => {
    closedByUs = true
    socket?.close()
  }
}

/** Browser approval of a `fos` CLI sign-in (?device=CODE). */
export function describeDeviceLogin(session: Session, code: string): Promise<{ code: string; name: string; status: string }> {
  return authed(session, 'GET', `/user/data/device-login/${encodeURIComponent(code)}`)
}

export function decideDeviceLogin(session: Session, code: string, decision: 'approve' | 'deny'): Promise<unknown> {
  return authed(session, 'POST', `/user/data/device-login/${encodeURIComponent(code)}/${decision}`)
}

export type VoiceCluster = { title: string; sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'; summary: string; points: string[] }
export type VoiceNote = { transcript: string; title: string; summary: string; clusters: VoiceCluster[] }

/** Send a recording; the account transcribes it and organizes it into clustered notes. */
export async function transcribeVoice(session: Session, audio: Blob): Promise<VoiceNote> {
  const response = await fetch(`${session.baseUrl}/user/data/voice-notes`, {
    method: 'POST',
    headers: { 'Content-Type': audio.type || 'audio/webm', Authorization: `Bearer ${session.jwt}` },
    body: audio
  })
  if (!response.ok) throw new ApiError(response.status, await readError(response))
  return (await response.json()) as VoiceNote
}
