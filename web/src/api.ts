import { USER_SERVER_ATTESTATION, userAttestationPayload, type Capability, type MarketBid, type NodeView, type UserRecord } from '../../shared/sync/index'

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
  /** The rest of the error body (e.g. where a confirmation code went). */
  details: Record<string, unknown>
  constructor(status: number, message: string, code?: string, details: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

async function responseError(response: Response): Promise<ApiError> {
  try {
    const data = await response.json() as { error?: string; code?: string } & Record<string, unknown>
    return new ApiError(response.status, typeof data.error === 'string' ? data.error : response.statusText, data.code, data)
  } catch { return new ApiError(response.status, response.statusText) }
}


export type RegistrationInput = { username: string; password: string; confirmPassword: string; email?: string; phone?: string }
/** What a new account still needs: the code sent to its email or phone (`destination` is masked; `error` when it could not be sent yet). */
export type PendingConfirmation = { username: string; pending: 'email' | 'phone'; destination: string | null; error?: string }

async function publicPost<T>(baseUrl: string, path: string, body: unknown): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) throw await responseError(response)
  return response.json() as Promise<T>
}

/** Create an account; it is confirmed with the code sent to the email address or phone number given. */
export function register(baseUrl: string, input: RegistrationInput): Promise<PendingConfirmation> {
  return publicPost(baseUrl, '/auth/register', { ...input, accepted_terms: true, cookies: false })
}
export function confirmAccount(baseUrl: string, body: { username: string; code: string } | { token: string }): Promise<{ confirmed: boolean; username?: string; already?: boolean }> {
  return publicPost(baseUrl, '/auth/confirm', body)
}
export function resendConfirmation(baseUrl: string, username: string): Promise<{ sent: boolean; channel?: 'email' | 'phone'; destination?: string }> {
  return publicPost(baseUrl, '/auth/confirm/resend', { username })
}
export function requestPasswordReset(baseUrl: string, username: string): Promise<{ message: string }> {
  return publicPost(baseUrl, '/auth/reset-pwd', { username })
}
export function completePasswordReset(baseUrl: string, input: { token: string; username: string; password: string }): Promise<unknown> {
  return publicPost(baseUrl, '/auth/reset-pwd-update', { token: input.token, password: input.password, email: input.username })
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

/** A node from the account server; with `owner`, a node of that other account shared with this user (acting as `user:<me>` there). */
export function requestPeerNode(session: Session, request: import('../../shared/sync/node-provider').NodeRequest, owner?: string): Promise<import('../../shared/sync/node-provider').ProvidedNode> {
  return authed(session, 'POST', '/user/data/peer-sync/provide-node', owner ? { ...request, owner } : request)
}
export type SharedNodeLocation = { owner: string; aliasId: string; path: string[]; title: string; grants: import('../../shared/sync/index').Capability[] }
/** Where a node another account shared with this user lives there, and what they may do on it (403 when nothing was granted). */
export function locateSharedNode(session: Session, owner: string, aliasId: string): Promise<SharedNodeLocation> {
  return authed(session, 'GET', `/user/data/peer-sync/locate?owner=${encodeURIComponent(owner)}&id=${encodeURIComponent(aliasId)}`)
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

/** Send a recording; the account only transcribes it (the client then organizes the transcript through an `organize` requirement). */
export async function transcribeAudio(session: Session, audio: Blob): Promise<{ transcript: string }> {
  const response = await fetch(`${session.baseUrl}/user/data/voice-notes?transcript=only`, {
    method: 'POST',
    headers: { 'Content-Type': audio.type || 'audio/webm', Authorization: `Bearer ${session.jwt}` },
    body: audio
  })
  if (!response.ok) throw await responseError(response)
  return (await response.json()) as { transcript: string }
}


export type MarketNode = { capability?: boolean; owner: string; aliasId: string; view: NodeView; myProposal: { id: string; status: string } | null }

export function getMarketNode(session: Session, owner: string, aliasId: string): Promise<MarketNode> {
  return authed(session, 'GET', `/user/data/market/node?owner=${encodeURIComponent(owner)}&id=${encodeURIComponent(aliasId)}`)
}

/** Submit (or replace) this account's proposal on a node of another account: the rows of a bid it built (shared/sync/market.ts). */
export function submitMarketProposal(session: Session, owner: string, aliasId: string, bid: MarketBid): Promise<{ proposalId: string }> {
  return authed(session, 'POST', '/user/data/market/proposals', { owner, aliasId, bid })
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

/** Stripe Connect onboarding for receiving payments (or the Express dashboard once onboarded): the page to send the browser to. */
export function createConnectSession(session: Session, urls: { success_url: string; cancel_url: string }): Promise<{ url: string }> {
  return authed(session, 'POST', '/subscription/connect-session', urls)
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
export function readRepositoryDeployment(session: Session, repo: string, branch: string, environment: string): Promise<{ sha: string; ready: boolean }> {
  return authed(session, 'POST', '/user/integrations/repo', { action: 'deployment', repo, branch, environment })
}

/** One event of the grammar (shared/sync/events.ts) for the account; owners address a node with `scope`. */
export function sendEvent<T = unknown>(session: Session, event: import('../../shared/sync/events').FosEvent, scope: string[] = [], owner?: string): Promise<T> {
  return authed(session, 'POST', '/user/data/events', owner ? { event, scope, owner } : { event, scope })
}

/** Evaluate a node on the account server (its handler registry runs the effects): a `complete` event at that node. */
export function evaluateOnServer(session: Session, path: string[], expected: string, branches: Record<string, string>, action?: 'recover', owner?: string): Promise<{ evaluation: import('../../shared/sync/evaluation').EvaluationRecord; status?: undefined } | { status: 'requested'; proposalId: string; request: string; node: string[] }> {
  return sendEvent(session, { kind: 'complete', path: [], expected, selections: branches, ...(action === 'recover' ? { recover: true } : {}) }, path, owner)
}

export type ShareAddress = import('../../shared/sync/sharing').SharedAddress
export type GuestResult = { node: import('../../shared/sync/sharing').SharedNode; visitorToken?: string; entryToken?: string; address?: ShareAddress }
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

const bytes = (base64: string): ArrayBuffer => Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer as ArrayBuffer
/**
 * The device's verify check for a server attestation: WebCrypto Ed25519 against the key that server published in this
 * graph (`publishedKey`, the `fos:key:<peer>` row in Home; no endpoint). No key, another verifier or another method is
 * false. Where the platform has no Ed25519 (older webviews) the answer is null: the object came through this
 * account's own graph, and the server re-checks the attestation whenever it acts on it (payments, fos points).
 */
export async function checkUserAttestation(key: { peer: string; publicKey: string | null }, user: UserRecord): Promise<boolean | null> {
  const v = user.verification
  if (!v || v.method !== USER_SERVER_ATTESTATION || v.by !== key.peer || !key.publicKey) return false
  let publicKey: CryptoKey
  try { publicKey = await crypto.subtle.importKey('raw', bytes(key.publicKey), { name: 'Ed25519' }, false, ['verify']) } catch { return null }
  return crypto.subtle.verify({ name: 'Ed25519' }, publicKey, bytes(v.attestation), new TextEncoder().encode(userAttestationPayload(user, v.by, v.method, v.issuedAt)))
}
