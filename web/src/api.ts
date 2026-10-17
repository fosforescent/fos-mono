import type { Capability, NodeView, SyncRequest, SyncResponse } from '../../shared/sync/index'

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
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function responseError(response: Response): Promise<ApiError> {
  try {
    const data = await response.json() as { error?: string; code?: string }
    return new ApiError(response.status, typeof data.error === 'string' ? data.error : response.statusText, data.code)
  } catch { return new ApiError(response.status, response.statusText) }
}


export async function register(baseUrl: string, username: string, password: string): Promise<void> {
  const response = await fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, accepted_terms: true, cookies: false }) })
  if (!response.ok) throw await responseError(response)
}

export async function login(baseUrl: string, username: string, password: string): Promise<Session> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  if (!response.ok) throw await responseError(response)
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
  if (!response.ok) throw await responseError(response)
  return (await response.json()) as T
}

/** Where the account says this device should attach (root by default, or a node it was invited to). */
export function getAttachment(session: Session, peerId: string): Promise<Attachment> {
  return authed<Attachment>(session, 'GET', `/user/data/peer-sync/attachment?peerId=${encodeURIComponent(peerId)}`)
}

export function createInvite(session: Session, scope: string[], scopeNames: string[]): Promise<{ token: string; inviteId: number; expiresAt: string }> {
  return authed(session, 'POST', '/user/data/peer-invite', { scope, scopeNames })
}

/** Approve or reject a submission at a node: a `decide` event (requires the approve capability there). */
export function decideProposal(session: Session, scope: string[], proposalId: string, decision: 'approve' | 'reject'): Promise<{ decision: string; proposalId: string }> {
  return sendEvent(session, { kind: 'decide', path: [], proposalId, decision }, scope)
}

export function listInviteRequests(session: Session): Promise<{ requests: InviteRequest[] }> {
  return authed(session, 'GET', '/user/data/peer-invite/requests')
}

/** Approving decides what the device may do on the node: propose changes, or also approve proposals. */
export function answerInviteRequest(session: Session, id: number, decision: 'approve' | 'deny', capabilities: Capability[] = ['edit']): Promise<unknown> {
  return authed(session, 'POST', `/user/data/peer-invite/${id}/${decision}`, decision === 'approve' ? { capabilities } : {})
}

/** Claim an invite token with no session yet. */
export async function claimInvite(baseUrl: string, token: string, peerId: string, name: string): Promise<{ requestId: string; scope: string[]; scopeNames: string[] }> {
  const response = await fetch(`${baseUrl}/peer/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token.trim(), peerId, name })
  })
  if (!response.ok) throw await responseError(response)
  return (await response.json()) as { requestId: string; scope: string[]; scopeNames: string[] }
}

export async function pollConnect(baseUrl: string, requestId: string, peerId: string): Promise<ConnectPoll> {
  const response = await fetch(`${baseUrl}/peer/connect/${encodeURIComponent(requestId)}?peerId=${encodeURIComponent(peerId)}`)
  if (!response.ok) throw await responseError(response)
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
  if (!response.ok) throw await responseError(response)
  return (await response.json()) as SyncResponse
}

export function requestPeerNode(session: Session, request: import('../../shared/sync/node-provider').NodeRequest): Promise<import('../../shared/sync/node-provider').ProvidedNode> {
  return authed(session, 'POST', '/user/data/peer-sync/provide-node', request)
}

export type EventHandlers = {
  onMessage(message: Record<string, unknown>): void
  onNodeRequest?(request: import('../../shared/sync/index').NodeRequest): Promise<import('../../shared/sync/index').ProvidedNode>
  providerScope?: string[]
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
    try { socket?.send(JSON.stringify({ type: 'hello', peerId, scope: handlers.providerScope ?? [], capabilities: handlers.onNodeRequest ? ['provideNode'] : [] })) } catch { /* ignore */ }
    handlers.onOpen?.()
  })
  socket.addEventListener('message', (event) => {
    try {
      const parsed = JSON.parse(String(event.data)) as Record<string, unknown>
      if (parsed.type === 'provide_node' && typeof parsed.id === 'string' && handlers.onNodeRequest) {
        const id = parsed.id
        void handlers.onNodeRequest(parsed.request as import('../../shared/sync/index').NodeRequest).then(
          node => { if (!closedByUs && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'provided_node', id, node })) },
          error => { if (!closedByUs && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'provided_node', id, error: error instanceof Error ? error.message : 'Node access denied.' })) }
        )
        return
      }
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
  if (!response.ok) throw await responseError(response)
  return (await response.json()) as VoiceNote
}

export type SearchHit = { aliasId: string; title: string; kind: string; score: number; owner: string | null; path?: string[] }

/** Semantic search over this account's rows (and, with `market`, rows other accounts listed). */
export function searchRows(session: Session, query: string, options: { market?: boolean; limit?: number } = {}): Promise<{ hits: SearchHit[] }> {
  return authed(session, 'POST', '/user/data/search', { query, market: !!options.market, limit: options.limit ?? 10 })
}

export type MarketNode = { capability?: boolean; owner: string; aliasId: string; view: NodeView; myProposal: { id: string; status: string } | null }

export function getMarketNode(session: Session, owner: string, aliasId: string): Promise<MarketNode> {
  return authed(session, 'GET', `/user/data/market/node?owner=${encodeURIComponent(owner)}&id=${encodeURIComponent(aliasId)}`)
}

/** Submit (or replace) this account's proposal on a listed node: rows to add under it (comments, allocation references, supplies). */
export function submitMarketProposal(session: Session, owner: string, aliasId: string, rows: Array<{ kind: string; text: string; data?: Record<string, unknown>; under?: string; id?: string }>): Promise<{ proposalId: string }> {
  return authed(session, 'POST', '/user/data/market/proposals', { owner, aliasId, rows })
}

/** The account's fos points (its token balance): the default pool for "ff" allocations. */
/** The account's fos points: the server's ledger record (`availableTokens` is the spendable balance). */
export function getTokenBalance(session: Session): Promise<{ balance: { availableTokens: number; totalPurchased: number; totalUsed: number } }> {
  return authed(session, 'GET', '/tokens/balance')
}

// --- integration peers (OAuth sign-ins, the phone channel) and the handlers they provide ---------------------------

export type IntegrationStatus = { id: string; name: string; kind: 'oauth' | 'platform' | 'channel'; provides: string[]; consumes: string[]; configured: boolean; connected: boolean; pending: boolean; accountName: string | null }

export function listIntegrations(session: Session): Promise<{ providers: IntegrationStatus[] }> {
  return authed(session, 'GET', '/user/integrations')
}

/** OAuth: the authorize URL to send the browser to; it comes back to the web app with ?integration=<id>&ok=1. */
export function startIntegration(session: Session, provider: string): Promise<{ url: string }> {
  return authed(session, 'GET', `/user/integrations/${encodeURIComponent(provider)}/start`)
}

export function disconnectIntegration(session: Session, provider: string): Promise<{ ok: true }> {
  return authed(session, 'DELETE', `/user/integrations/${encodeURIComponent(provider)}`)
}

export function startPhone(session: Session, number: string): Promise<{ ok: true; number: string }> {
  return authed(session, 'POST', '/user/integrations/phone', { number })
}

export function verifyPhone(session: Session, code: string): Promise<{ ok: true; number: string }> {
  return authed(session, 'POST', '/user/integrations/phone/verify', { code })
}


// --- MCP peers: the account's MCP servers attached to nodes as members that run "-tool" requirements -----------------

export type McpPeerInfo = { id: string; serverId: number; name: string; tools: string[] }

export function listMcpPeers(session: Session): Promise<{ peers: McpPeerInfo[] }> {
  return authed(session, 'GET', '/user/data/mcp-peers')
}

export function attachMcpPeer(session: Session, scope: string[], serverId: number): Promise<{ ok: true; peerId: string; tools: string[] }> {
  return authed(session, 'POST', '/user/data/mcp-peers/attach', { scope, serverId })
}


export function readRepository(session: Session, repo: string, tracked: number[] = []): Promise<import('../../shared/sync/repository').RepositorySnapshot> {
  return authed(session, 'POST', '/user/integrations/repo', { action: 'read', repo, tracked })
}
export function proposeRepositoryMerge(session: Session, repo: string, head: string, base: string, title: string): Promise<import('../../shared/sync/repository').RepositoryPull> {
  return authed(session, 'POST', '/user/integrations/repo', { action: 'propose', repo, head, base, title })
}
export function decideRepositoryPull(session: Session, repo: string, number: number, action: 'merge' | 'close', sha: string): Promise<{ ok: true }> {
  return authed(session, 'POST', '/user/integrations/repo', { action, repo, number, sha })
}

export function createRepositoryBranch(session: Session, repo: string, name: string, from: string): Promise<{ ok: true }> {
  return authed(session, 'POST', '/user/integrations/repo', { action: 'branch', repo, name, from })
}

/** One event of the grammar (shared/sync/events.ts) for the account; owners address a node with `scope`. */
export function sendEvent<T = unknown>(session: Session, event: import('../../shared/sync/events').FosEvent, scope: string[] = []): Promise<T> {
  return authed(session, 'POST', '/user/data/events', { event, scope })
}

/** Evaluate a node on the account server (its handler registry runs the effects): a `complete` event at that node. */
export function evaluateOnServer(session: Session, path: string[], expected: string, branches: Record<string, string>, action?: 'recover'): Promise<{ evaluation: import('../../shared/sync/evaluation').EvaluationRecord; status?: undefined } | { status: 'requested'; proposalId: string; request: string; node: string[] }> {
  return sendEvent(session, { kind: 'complete', path: [], expected, selections: branches, ...(action === 'recover' ? { recover: true } : {}) }, path)
}

export type ShareAddress = import('../../shared/sync/sharing').SharedAddress
export type GuestResult = { node: import('../../shared/sync/sharing').SharedNode; visitorToken?: string; entryToken?: string; address?: ShareAddress }
export function configureSharing(session: Session, body: { path: string[]; expected: string; audience: 'public' | 'users'; enabled: boolean; template?: boolean; poll: 'approval' | 'rank' | null }): Promise<ShareAddress> {
  return authed(session, 'POST', '/user/data/sharing', body)
}
export async function sharedRequest(baseUrl: string, session: Session | null, action: 'visit' | 'input', body: unknown): Promise<GuestResult> {
  if (session?.kind === 'user') return authed(session, 'POST', `/user/data/sharing/${action}`, body)
  const response = await fetch(`${baseUrl}/public/node/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) throw await responseError(response)
  return response.json() as Promise<GuestResult>
}

/** Account directory lookup; credentials use the active Fos server session. */
export async function searchFosUsers(session: Session, query: string): Promise<string[]> {
  const result = await authed<{ users: Array<{ user_name: string }> }>(session, 'GET', `/groups/search/name?name=${encodeURIComponent(query.trim())}`)
  return [...new Set(result.users.map(user => user.user_name).filter(name => typeof name === 'string' && name !== session.username))]
}
