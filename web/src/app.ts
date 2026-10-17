import { addSpecification, specificationRows, importSpecifications, queueSpecificationVerification, type FeatureSpecification } from '../../shared/sync/specifications'
import { executionInput, executionSnapshot } from '../../shared/sync/execution-access'
import { setConstructorEnabledAt, contextMemberRefs, discoverHandlers, contextMembers, publishTemplate, setHandlerEnabledAt, instantiateTemplateValue } from '../../shared/sync/index'
import { NODE_PERMISSION_DEFAULT, isNodeProjection, nodeBranches, nodeBranchBase, validateNodeShape, exchangeNode, nodeShape, sameNodeShape, mergeNodeShape, installNodeShape, materializedNodePaths, nodePersistenceAllowed, rememberNodeSync, nodeSyncKey, nodeSyncRequest, outgoingNodeShape, establishNodeSync, provideNode, pullNode, acceptProvidedNode, nodeLinkEndpoint, nodeRequestLinkId, setNodeLinkMask, CLIENT_CAPABILITIES, isPeerReference, type NodeMask, type NodeRequest, type NodeProvider } from '../../shared/sync/index'
import { requestPeerNode } from './api'
import { parsePastedRows } from './paste'
import { SETTING_LABELS, settingKeyFromName } from './settings'
import { exportNodeYaml, parseNodeYaml } from './yaml'
import { ensureSharedLink, type SharedAddress } from '../../shared/sync/sharing'
import { cronMatches, nodeTrigger, triggerState, triggerOccurrence, configuredTriggers, setNodeTrigger, runNodeTriggers, type TriggerKind } from '../../shared/sync/triggers'
import { readNodeValue, recoverEvaluation, evaluateNode, evaluationRecord, writeNodeValue, writeLinkedNodeValue, evaluationSteps } from '../../shared/sync/evaluation'
import { withMainBranchPolicy, withBranches, scopeBranches, bindRepository, repositoryAt, repositoryPeerId, repositoryPeerAllows, type RepositorySnapshot, type RepositoryPull, readChoice, isBranchChoice, branchSelection, proposalContent, readProposal, proposalView, valueContent, identityCid } from '../../shared/sync/index'
import { searchFosUsers, evaluateOnServer, createRepositoryBranch, readRepository, proposeRepositoryMerge, decideRepositoryPull } from './api'
/**
 * Application controller: owns the replica (a FosStore attached to the user
 * group's document or to another device's node), the connection state, the
 * sync schedule and the UI flows (connect, invite, direct). The UI only reads
 * `state`, calls `currentView()` and invokes the methods below.
 *
 * Startup
 *   stored session (token, never a password) → reconnect, ask the account where
 *   this device attaches, sync. Otherwise: local mode, red "local" badge and a
 *   Connect flow opened from Offline or the menu (sign in / invite token or QR / direct).
 *
 * Transports for sync, in order of preference
 *   account over HTTP (user session or peer credential from an invite)
 *   another device over a WebRTC data channel (direct connect)
 *   manual relay codes (when no channel could be established)
 */

import { VirtualPeers, type VirtualPeer } from './virtual'
import { EditHistory } from './history'
import {
  HOME_ID, destructureRequirement, linkRequirementOutput, bookkeepingOf, refBranches, updateAtScope, refNodeContent, refTypeCid, capabilityTarget, contextBindings, resolveBinding, refValueCid, allocationMatches, capabilityPeers, copyProposalBranch, createBranch, setBranchMergeRequest, selectBranch, mergeBranch, argumentRefs, resolveText, resolveScope, content, workHandler, proposeRefAt, newId, addRefAt, put, addSubtasksTemplate, addPlanningTemplate, decideTaskResult, taskWorkContext, workAttempts, type WorkContext,
  addRef,
  createReplica,
  importNodes,
  reachableNodes,
  commitRoot,
  mergeNodes,
  addRow,
  addMemberAt,
  addSupply,
  addTask,
  CAPABILITIES,
  copyNode,
  DEFAULT_DEVICE_POLICY,
  findTemplateByName,
  instantiateTemplate,
  INTEGRATION_PEERS,
  parsePolicy,
  removeMemberAt,
  resolveRef,
  SERVER_TRANSPORT_CAPABILITIES,
  dispatchEvent,
  requestContinuation,
  type FosEvent,
  type Principal,
  setMemberCapabilitiesAt,
  setRowContentAt,
  type PeerPolicy,
  type ResourceType,
  setQueryOptionsAt,
  setRowKind,
  applyProposalAt,
  shareHome,
  buildSyncRequest,
  completeSync,
  deleteTask,
  resetHomeContent,
  ensureHomeContext,
  homePath,
  contextScope,
  hasSynced,
  headCid,
  isDirty,
  loadReplica,
  makeLinkAt,
  moveNode,
  reattach,
  rejectProposalAt,
  discardOwnProposalAt,
  removePeerAt,
  renameTask,
  resolve,
  scopeNames,
  serializeReplica,
  serveSync,
  setTaskDone,
  view,
  type Capability,
  type CapabilityKind,
  type MovePosition,
  type NodeView,
  type Replica,
  type RowExtras,
  type RowKind,
  type Scope,
  type SyncRequest,
  type TaskView
} from '../../shared/sync/index'
import {
  ApiError,
  answerInviteRequest,
  claimInvite,
  connectEvents,
  createInvite,
  decideProposal,
  detachSelf,
  getAttachment,
  listInviteRequests,
  login, register,
  peerSync,
  pollConnect,
  type InviteRequest,
  type Session,
  describeDeviceLogin,
  decideDeviceLogin,
  transcribeVoice,
  searchRows,
  type SearchHit,
  type VoiceNote,
  getMarketNode,
  getTokenBalance,
  sendEvent,
  listIntegrations,
  startIntegration,
  disconnectIntegration,
  startPhone,
  verifyPhone,
  listMcpPeers,
  attachMcpPeer,
  type IntegrationStatus,
  type McpPeerInfo,
  submitMarketProposal,
  type MarketNode
} from './api'
import { DirectGuest, DirectHost, DirectLink, ManualRelay, isWebRtcAvailable, type ChannelMessage } from './p2p'
import { openExternal } from './project'
import type { ReplicaStorage } from './storage'

export type Connection = 'offline' | 'connecting' | 'online' | 'syncing'

export type Notice = { kind: 'info' | 'error'; text: string; at: number }

export type Credentials = { username: string; password: string }

export type ModalKind = 'connect' | 'invite' | 'direct' | 'requests' | 'device' | 'market' | 'help' | 'phone' | 'work' | 'virtual' | 'template'

/**
 * A peer in the context panel: the account server ("fos") with what it registered on the last sync, a member of the
 * viewed node (its capability rows are what this node's owner exposes to it; `disabled` ones show as switched off), or a
 * device attached here. `member` says whether the rows can be edited here (by the owner).
 */
export type ContextPeer = {
  id: string
  name: string
  online: boolean
  /** The `to` direction: what this side exposes to the peer (for the account server: what it registered with us, see `policy` for what we send it). */
  capabilities: Capability[]
  disabled: Capability[]
  /** The `from` direction on a member row: what this node's owner accepts from the peer. */
  accepts: Capability[]
  isAccount: boolean
  member: boolean
  /** The account server row: this device's policy towards it, and whether fos.config.toml fixed it. */
  policy?: PeerPolicy
  policyLocked?: boolean
  /** The account server row: the account's fos points (token balance), once fetched. */
  points?: number | null
  /** An integration peer (GitHub, Google, Stripe, the phone): what it provides and consumes, and its connection status from the server. */
  integration?: { kind: 'oauth' | 'platform' | 'channel'; provides: Capability[]; consumes: Capability[]; configured: boolean; connected: boolean; pending: boolean; accountName: string | null }
  /** An MCP peer: one of the account's MCP servers, with the tools it advertises; attached to nodes as a member `mcp:<id>`. */
  fosUser?: string
  repository?: { repo: string }
  mcp?: { serverId: number; tools: string[] }
}

export type ConnectFlow =
  | { phase: 'idle' }
  | { phase: 'claiming' }
  | { phase: 'waiting'; requestId: string; scopeNames: string[] }
  | { phase: 'denied' | 'expired' }
  | { phase: 'error'; message: string }

export type InviteState = { token: string; scope: Scope; scopeNames: string[]; expiresAt: string } | null

export type DirectState =
  | { role: 'host'; phase: 'creating' | 'offer' | 'connecting' | 'connected' | 'error'; code?: string; error?: string; pendingPeer?: { peerId: string; name: string }; remoteName?: string }
  | { role: 'guest'; phase: 'answer' | 'connecting' | 'connected' | 'denied' | 'error'; code?: string; error?: string; remoteName?: string }
  | null

export type AppState = {
  replica: Replica
  /** Path of node ids inside the replica currently displayed (relative to its scope). */
  view: Scope
  connection: Connection
  session: Session | null
  loginError: string | null
  notice: Notice | null
  highlighted: string[]
  canAutoLogin: boolean
  menuOpen: boolean
  virtual?: { name: string; hostName: string; capabilities: Capability[] }
  work?: { path: Scope; preview: WorkContext; busy: boolean; error?: string }
  templatePicker?: { path: Scope }
  modal: ModalKind | null
  connectFlow: ConnectFlow
  inviteError?: string
  invite: InviteState
  requests: InviteRequest[]
  direct: DirectState
  deviceName: string
  /** Manual relay codes (fallback when no channel could be opened). */
  manual: { requestCode?: string; resultCode?: string; error?: string }
  /** Task ids whose subtasks are hidden in the tree. */
  collapsed: string[]
  /** Peer ids the account currently sees online (from the last sync response). */
  onlinePeers: string[]
  /** What the account server registered with this device on the last sync (connection kinds and services); null before the first. */
  serverCapabilities: Capability[] | null
  /** This device's policy towards the account server: `to` = what leaves the device, `from` = what it takes in. */
  policy: PeerPolicy
  /** The policy came from fos.config.toml (project mode) and cannot be changed in the app. */
  policyLocked: boolean
  /** Keyboard selection: path (relative to the view) of the selected task. */
  selected: Scope | null
  /**
   * The stored root context: the fos server and the other peers this device
   * reaches. Root constructors use ordinary stored rows; Home is the initial constructor instance.
   */
  atRoot: boolean
  /** The account's fos points (token balance) from the last fetch; null before the first or when signed out. */
  points: number | null
  /** Integration peers as the server reports them (connected, account name, whether the flow is configured). */
  integrations: IntegrationStatus[]
  /** The account's MCP servers, as peers that can be attached to nodes. */
  mcpPeers: McpPeerInfo[]
  /** The phone-linking modal: waiting for a number, then for the code texted to it. */
  phone: { phase: 'number' | 'code' | 'busy'; number?: string; error?: string } | null
  /** Open context menu, if any. */
  contextMenu: { kind: 'task'; at: Scope; task: TaskView } | { kind: 'peer'; peerId: string } | null
  /** A `fos` CLI waiting for this browser to approve its sign-in (from ?device=CODE). */
  device: { code: string; name: string | null; status: 'loading' | 'ready' | 'approved' | 'denied' | 'error'; error?: string } | null
  /** Microphone capture: recording (with start time), uploading, or idle. */
  voice: { phase: 'recording'; startedAt: number } | { phase: 'uploading' } | null
  /** A listed node of another account opened from a market search result (the `market` modal). */
  market: { owner: string; aliasId: string; title: string; node: MarketNode | null; error?: string; phase: 'loading' | 'ready' | 'submitting' | 'submitted' } | null
}

export type AppConfig = {
  baseUrl: string
  autoLogin: Credentials | null
  storage: ReplicaStorage
  /** A peer/project replica is already attached to a constructor instance. */
  scopedDocument?: boolean
  pollIntervalMs?: number
  now?: () => number
  /** Project mode (desktop shell in a directory with fos.config.toml). `policy` is the config's `[server]` table, when present. */
  project?: { dir: string; branch: () => string | null; deviceName?: string; policy?: PeerPolicy | null }
}

type Timer = ReturnType<typeof setTimeout>

const MIN_RETRY_MS = 5_000
const MAX_RETRY_MS = 5 * 60_000

function defaultDeviceName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/iPhone|iPad/.test(ua)) return 'iPhone'
  if (/Android/.test(ua)) return 'Android phone'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows PC'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Device'
}

function loadSession(raw: unknown, baseUrl: string): Session | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Partial<Session>
  if (s.baseUrl !== undefined && (typeof s.baseUrl !== 'string' || s.baseUrl.replace(/\/$/, '') !== baseUrl.replace(/\/$/, ''))) return null
  if (typeof s.jwt !== 'string' || typeof s.username !== 'string' || !s.jwt) return null
  return { baseUrl, jwt: s.jwt, username: s.username, kind: s.kind === 'peer' ? 'peer' : 'user' }
}

export class App {
  state: AppState
  private virtualIdentity: VirtualPeer | null = null
  private virtualPeers: VirtualPeers | null = null
  private virtualCapabilities: Capability[] = []
  private virtualWelcomed = false
  private authGeneration = 0
  private history = new EditHistory()
  private branchSelections: Record<string, string> = {}
  private repositories = new Map<string, RepositorySnapshot>()
  private repositoryPollAt = 0
  private repositoryBusy = false
  private projectSwitching = false
  private groupedEdit = false
  private observedHead: string
  private config: AppConfig
  private listeners = new Set<(state: AppState) => void>()
  private syncInFlight = false
  private syncRequested = false
  private debounceTimer: Timer | null = null
  /** Integration id whose sign-in is running in the system browser (Tauri apps); checked on focus and background polls. */
  private pendingIntegration: { id: string; session: Session } | null = null
  private pollTimer: Timer | null = null
  private retryTimer: Timer | null = null
  private connectPollTimer: Timer | null = null
  private retryDelay = MIN_RETRY_MS
  private closeEvents: (() => void) | null = null
  private autoCredentials: Credentials | null
  private host: DirectHost | null = null
  private link: DirectLink | null = null
  /** Node (relative to this replica) a direct guest is attached to. */
  private hostScope: Scope = []
  private approvedNodePeer: string | null = null
  private nodeLoads = new Map<string, Promise<void>>()
  private hostBranches: Record<string, string> = {}
  private manualRequest: SyncRequest | null = null

  constructor(config: AppConfig) {
    this.config = config
    this.autoCredentials = config.autoLogin
    const replica = config.scopedDocument || config.project ? loadReplica(config.storage.loadReplica()) : ensureHomeContext(loadReplica(config.storage.loadReplica()), 0)
    const prefs = (config.storage.loadPrefs() ?? {}) as { repositories?: Array<[string, RepositorySnapshot]>; branches?: Record<string, string>; view?: unknown; connectDismissed?: unknown; deviceName?: unknown; collapsed?: unknown; policy?: unknown }
    if (Array.isArray(prefs.repositories)) this.repositories = new Map(prefs.repositories.filter(entry => Array.isArray(entry) && typeof entry[0] === 'string' && Array.isArray(entry[1]?.pulls)))
    this.branchSelections = prefs.branches && typeof prefs.branches === 'object' ? Object.fromEntries(Object.entries(prefs.branches).filter(([, name]) => typeof name === 'string')) : {}
    for (const [id, name] of Object.entries(this.branchSelections)) selectBranch(replica.store, id, name)
    const configPolicy = config.project?.policy ?? null
    const savedView = Array.isArray(prefs.view) ? prefs.view.filter((s): s is string => typeof s === 'string') : []
    const session = loadSession(config.storage.loadSession(), config.baseUrl)
    this.state = {
      replica,
      view: savedView.length && view(replica, savedView) ? contextScope(replica.store, headCid(replica), savedView) : homePath(replica),
      connection: 'offline',
      session: null,
      loginError: null,
      notice: null,
      highlighted: [],
      canAutoLogin: !!config.autoLogin,
      menuOpen: false,
      modal: null,
      connectFlow: { phase: 'idle' },
      invite: null,
      requests: [],
      direct: null,
      deviceName: typeof prefs.deviceName === 'string' && prefs.deviceName ? prefs.deviceName : (config.project?.deviceName ?? defaultDeviceName()),
      manual: {},
      collapsed: Array.isArray(prefs.collapsed) ? prefs.collapsed.filter((s): s is string => typeof s === 'string') : [HOME_ID],
      onlinePeers: [],
      serverCapabilities: null,
      policy: configPolicy ?? parsePolicy(prefs.policy) ?? DEFAULT_DEVICE_POLICY,
      policyLocked: !!configPolicy,
      selected: null,
      atRoot: false,
      points: null,
      integrations: [],
      mcpPeers: [],
      phone: null,
      contextMenu: null,
      device: null,
      voice: null,
      market: null
    }
    this.observedHead = headCid(replica)
    this.pendingSession = session
    this.connectDismissed = prefs.connectDismissed === true
  }

  private pendingSession: Session | null
  private connectDismissed: boolean

  private now(): number {
    return this.config.now ? this.config.now() : Date.now()
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  private set(patch: Partial<AppState>): void {
    const previous = this.state
    const contentChanged = patch.replica && headCid(patch.replica) !== this.observedHead
    if (patch.replica) {
      if (patch.replica.store !== previous.replica.store) { this.autoNodeAttempts.clear(); this.autoNodeQueue = [] }
      if (patch.replica.store !== previous.replica.store || JSON.stringify(patch.replica.meta.scope) !== JSON.stringify(previous.replica.meta.scope)) this.history.clear()
      this.observedHead = headCid(patch.replica)
    }
    if (contentChanged) this.virtualPeers?.changed()
    if (patch.session && previous.session && patch.session.username !== previous.session.username) this.history.clear()
    if (patch.replica) for (const [id, name] of Object.entries(this.branchSelections)) selectBranch(patch.replica.store, id, name)
    this.state = { ...previous, ...patch }
    if (patch.replica) {
      const name = this.settingValue<string>('name'), theme = this.settingValue<string>('theme')
      if (typeof name === 'string' && name.trim()) this.state.deviceName = name
      if (typeof theme === 'string' && ['system', 'light', 'dark'].includes(theme)) document.documentElement.dataset.theme = theme
    }
    if (patch.replica && patch.replica !== previous.replica) {
      this.config.storage.saveReplica(serializeReplica(this.state.replica))
    }
    if (patch.view && patch.view !== previous.view) this.savePrefs()
    if ('session' in patch && (patch.session !== previous.session || patch.session === null)) {
      this.config.storage.saveSession(patch.session ? { jwt: patch.session.jwt, username: patch.session.username, kind: patch.session.kind, baseUrl: patch.session.baseUrl } : null)
    }
    for (const listener of this.listeners) listener(this.state)
  }

  private savePrefs(): void {
    this.config.storage.savePrefs({ repositories: [...this.repositories], branches: this.branchSelections, view: this.state.view, connectDismissed: this.connectDismissed, deviceName: this.state.deviceName, collapsed: this.state.collapsed, ...(this.state.policyLocked ? {} : { policy: this.state.policy }) })
  }

  notify(kind: Notice['kind'], text: string): void {
    this.set({ notice: { kind, text, at: this.now() } })
  }

  // -------------------------------------------------------------------------
  // Derived views for the UI

  private documentReplica(replica: Replica): Replica {
    return this.config.scopedDocument || this.config.project || this.virtualIdentity || replica.meta.scope.length ? replica : ensureHomeContext(replica, this.now())
  }

  currentView(): NodeView | null {
    const node = view(this.state.replica, this.state.view, this.state.atRoot)
    const remote = this.state.replica.meta.serverPeerId && this.state.replica.meta.nodeSync?.[nodeSyncKey(this.state.replica.meta.serverPeerId, this.state.view, nodeBranches(this.state.replica, this.state.view))]?.remote
    if (node && remote && remote.proposals) node.proposals = remote.proposals
    if (node) for (const row of node.tasks) { const key = settingKeyFromName(row.construction?.name); if (key) row.title = SETTING_LABELS[key] ?? key }
    return node
  }

  labels(): { scope: string[]; view: string[] } {
    const { replica, view: path } = this.state
    return { scope: replica.meta.scopeNames, view: scopeNames(replica.store, headCid(replica), path) }
  }

  currentScope(): Scope {
    return [...this.state.replica.meta.scope, ...this.state.view]
  }

  /** Git branch of the project directory, when running in project mode. */
  projectDirectory(): string | null { return this.config.project?.dir ?? null }

  currentBranch(): string | null {
    return this.config.project?.branch() ?? null
  }

  /** Project mode: the directory switched git branch; show that branch's replica. */
  reloadReplica(): void {
    const replica = this.documentReplica(loadReplica(this.config.storage.loadReplica()))
    this.set({ replica, view: homePath(replica), selected: null, contextMenu: null })
    this.notify('info', `Now on branch ${this.currentBranch() ?? 'local'}.`)
    if (this.transport()) void this.syncNow('branch switch')
  }

  /** What this device is currently syncing with, if anything. */
  transport(): 'account' | 'direct' | 'virtual' | null {
    if (this.virtualIdentity) return this.virtualPeers?.connected ? 'virtual' : null
    if (this.state.session) return 'account'
    if (this.link?.open && this.state.direct?.role === 'guest' && this.state.direct.phase === 'connected') return 'direct'
    return null
  }

  isLocal(): boolean {
    return this.transport() === null
  }

  // -------------------------------------------------------------------------
  // Lifecycle

  private triggerTimer: ReturnType<typeof setInterval> | null = null
  private runningTriggers = false
  private triggerScanKey = ''
  private triggerCandidates: ReturnType<typeof configuredTriggers> = []
  start(): void {
    if (!this.triggerTimer) {
      this.triggerTimer = setInterval(() => void this.runTriggers(), 1000)
      window.addEventListener('pagehide', () => { if (this.triggerTimer) clearInterval(this.triggerTimer); this.triggerTimer = null })
    }
    window.addEventListener('online', () => this.reconnect('network back'))
    window.addEventListener('offline', () => {
      if (this.state.connection !== 'offline') this.set({ connection: 'offline' })
    })
    window.addEventListener('focus', () => void this.checkPendingIntegration())
    document.addEventListener('visibilitychange', () => void this.checkPendingIntegration())
    if (this.virtualIdentity) {
      this.pendingSession = null
      if (this.config.storage.loadSession()) this.set({ session: loadSession(this.config.storage.loadSession(), this.config.baseUrl) })
    } else if (this.pendingSession) {
      void this.resume(this.pendingSession)
      this.pendingSession = null
    } else if (this.autoCredentials) {
      void this.login(this.autoCredentials.username, this.autoCredentials.password, true)
    }
  }

  /** Reconnect with a session stored by a previous run. */
  private async resume(session: Session): Promise<void> {
    const generation = this.authGeneration
    this.set({ connection: 'connecting' })
    try {
      await this.afterConnect(session, false, generation)
      if (generation !== this.authGeneration) return
      this.pendingSession = null
    } catch (error) {
      if (generation !== this.authGeneration) return
      if (error instanceof ApiError && error.status === 401) {
        this.pendingSession = null
        this.set({ session: null, connection: 'offline', loginError: 'Your session expired. Sign in again to sync.', notice: { kind: 'error', text: 'Your session expired. Click Offline to sign in again. Local changes are safe.', at: this.now() }, modal: null })
      } else {
        // Attachment lookup must also be retried before syncing a restored session.
        this.pendingSession = session
        this.set({ session, connection: 'offline' })
        this.notify('error', `Could not reach the server: ${error instanceof Error ? error.message : String(error)}`)
        this.scheduleRetry()
      }
    }
  }

  async registerAccount(username: string, password: string): Promise<void> {
    const generation = this.authGeneration
    this.set({ loginError: null })
    try {
      await register(this.config.baseUrl, username.trim(), password)
      if (generation !== this.authGeneration) return
      await this.login(username, password)
    } catch (error) { if (generation === this.authGeneration) this.set({ loginError: error instanceof Error ? error.message : String(error) }) }
  }
  async copyNodeLink(path: Scope): Promise<void> {
    try { await navigator.clipboard.writeText(`fos-ref:${encodeURIComponent(path.at(-1)!)}`); this.notify('info', 'Reference copied. Paste into a blank row in this workspace.') }
    catch { this.notify('error', 'Clipboard access failed. Allow clipboard access and try again.') }
  }
  pasteNodeLink(at: Scope, id: string | null, targetId: string): void {
    const target = resolveRef(this.state.replica, targetId)
    if (!target) { this.notify('error', 'This reference is not available in this workspace.'); return }
    const parent = [...this.state.view, ...at]
    if (parent.includes(targetId) || id === targetId) { this.notify('error', 'A node cannot contain a reference to itself.'); return }
    this.together(() => {
      let r = addRef(this.state.replica, parent, targetId, this.now(), id ? { relativeTo: id, position: 'below' } : undefined)
      if (id) r = deleteTask(r, parent, id, this.now())
      this.edit(r); this.select(null)
    })
  }
  pasteRows(rows: import('./rows').ParsedInput[], at: Scope, id?: string): void {
    this.together(() => {
      if (id) {
        const first = rows[0]!
        if (first.kind === 'allocation' && first.extras?.allocation && !this.bankFor(at, first.extras.allocation.type)) {
          this.edit(setRowContentAt(this.state.replica, [...this.state.view, ...at], id, first.kind, first.text, first.extras, this.now()))
          if (first.children?.length) this.addParsedChildren([...at, id], first.children, undefined, true)
        } else this.rewriteRowAt(at, id, first)
        rows = rows.slice(1)
      }
      let previous = id
      for (const row of rows) {
        const created = this.addRowAt(at, row.kind, row.text, { done: row.done, extras: row.extras, templateName: row.templateName, preserveUnbound: true, ...(previous ? { position: { relativeTo: previous, position: 'below' as const } } : {}) })
        if (row.peer !== undefined) this.setPeerRow([...this.state.view, ...at, created], row.peer)
        if (row.children?.length) this.addParsedChildren([...at, created], row.children, undefined, true)
        previous = created
      }
      this.select(null)
    })
  }
  editLinkedTemplate(): void {
    const path = this.state.templatePicker?.path
    if (!path) return
    const row = view(this.state.replica, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1))
    const template = row?.template && resolveRef(this.state.replica, row.template.id)
    if (template) { this.closeModal(); this.goTo([...template.path, template.row.id]) }
    else if (row?.kind === 'template') { this.closeModal(); this.goTo(path) }
    else this.notify('info', 'This is a built-in constructor. Use + to create an editable template.')
  }
  async login(username: string, password: string, automatic = false, mergeOffline = false): Promise<void> {
    const generation = ++this.authGeneration
    this.clearTimer('retry')
    this.set({ connection: 'connecting', loginError: null })
    try {
      const session = await login(this.config.baseUrl, username.trim(), password)
      if (generation !== this.authGeneration) return
      if (!automatic) this.autoCredentials = null
      this.retryDelay = MIN_RETRY_MS
      await this.afterConnect(session, mergeOffline, generation)
      if (generation !== this.authGeneration) return
      this.set({ modal: null, connectFlow: { phase: 'idle' } })
    } catch (error) {
      if (generation !== this.authGeneration) return
      const message = error instanceof Error ? error.message : String(error)
      this.set({ connection: 'offline', loginError: message, session: null })
      if (automatic) this.scheduleRetry()
    }
  }

  /**
   * Common path after obtaining a session: ask the account where this device
   * attaches (root by default, or the node it was invited to), then sync.
   */
  private async afterConnect(session: Session, mergeOffline = false, generation = this.authGeneration): Promise<void> {
    if (this.virtualIdentity) {
      this.set({ session })
      void this.refreshIntegrations()
      await this.syncNow('virtual sign-in')
      return
    }
    const offline = mergeOffline && this.canMergeOffline() ? serializeReplica(this.state.replica) : null
    if (this.config.storage.selectAccount?.(session)) {
      this.stopAccountConnection()
      this.loadDataSession(true)
    }
    const attachment = await getAttachment(session, this.state.replica.meta.peerId)
    // Owner Home attachments live below this device's private root. Invited scopes stay unchanged.
    if (session.kind === 'user' && !this.config.project && !this.config.scopedDocument && attachment.scope.length === 1 && attachment.scope[0] === HOME_ID) { attachment.scope = []; attachment.scopeNames = [] }
    if (generation !== this.authGeneration) return
    let replica = this.state.replica
    const same = replica.meta.scope.length === attachment.scope.length && replica.meta.scope.every((s, i) => attachment.scope[i] === s)
    if (!same && (!hasSynced(replica) || session.kind === 'peer')) {
      // A fresh link at the assigned node: local work merges into it on the first sync.
      replica = { store: replica.store, meta: { ...replica.meta, scope: attachment.scope, scopeNames: attachment.scopeNames, baseCid: null } }
    } else if (same && replica.meta.scopeNames.length !== attachment.scopeNames.length) {
      replica = { store: replica.store, meta: { ...replica.meta, scopeNames: attachment.scopeNames } }
    }
    if (offline) {
      const source = loadReplica(offline)
      const sourceHead = headCid(source)
      importNodes(replica.store, reachableNodes(source.store, [sourceHead]))
      commitRoot(replica.store, mergeNodes(replica.store, null, headCid(replica), sourceHead, { ours: session.username, theirs: 'Offline session' }).cid, this.now())
      replica = { ...replica }
    }
    replica = this.documentReplica(replica)
    this.set({ session, replica, connection: 'online', loginError: null, view: homePath(replica) })
    this.openEvents()
    this.startPolling()
    if (session.kind === 'user') void this.refreshRequests()
    if (session.kind === 'user' && this.state.device && this.state.device.status === 'loading') void this.loadDevice()
    await this.syncNow('connect')
  }

  private stopAccountConnection(): void {
    this.pendingSession = null
    this.autoCredentials = null
    this.clearTimer('retry'); this.clearTimer('poll'); this.clearTimer('debounce'); this.clearTimer('connectPoll')
    this.closeEvents?.(); this.closeEvents = null
  }
  disconnect(): void {
    this.repositories.clear(); this.repositoryPollAt = 0
    ++this.authGeneration
    this.stopAccountConnection()
    this.recorder?.stop(); this.recorder = null
    this.set({ voice: null, session: null, connection: this.virtualPeers?.connected ? 'online' : 'offline', loginError: null, canAutoLogin: false,
      requests: [], invite: null, points: null, integrations: [], mcpPeers: [], menuOpen: false })
  }
  logout(): void {
    this.history.clear()
    this.disconnect()
    // A virtual peer's document belongs to its host connection, independently of account sign-in.
    if (this.virtualIdentity || this.config.project) return
    this.cancelDirect()
    this.config.storage.startOffline?.()
    this.loadDataSession()
  }
  private loadDataSession(keepModal = false): void {
    this.cancelDirect()
    this.history.clear()
    this.virtualPeers?.close(); this.virtualPeers = null
    const replica = this.documentReplica(loadReplica(this.config.storage.loadReplica()))
    const prefs = (this.config.storage.loadPrefs() ?? {}) as { branches?: Record<string, string>; view?: Scope; collapsed?: string[]; policy?: unknown; deviceName?: string }
    this.branchSelections = prefs.branches ?? {}
    this.repositories.clear()
    this.repositoryPollAt = 0
    this.set({ replica, session: null, view: Array.isArray(prefs.view) && view(replica, prefs.view) ? prefs.view : homePath(replica), selected: null, atRoot: false,
      modal: keepModal ? this.state.modal : null, connectFlow: { phase: 'idle' }, manual: {}, device: null, voice: null, requests: [], invite: null,
      collapsed: Array.isArray(prefs.collapsed) ? prefs.collapsed : [HOME_ID], contextMenu: null, work: undefined, highlighted: [], notice: null,
      onlinePeers: [], serverCapabilities: null, policy: parsePolicy(prefs.policy) ?? DEFAULT_DEVICE_POLICY,
      deviceName: prefs.deviceName ?? defaultDeviceName(), connection: 'offline', points: null, integrations: [], mcpPeers: [], phone: null, market: null })
    this.enableVirtualPeers(null)
  }
  canMergeOffline(): boolean { return !this.virtualIdentity && !this.config.project && this.config.storage.dataSession?.().owner === null && isDirty(this.state.replica) }
  dataSessions() { return this.virtualIdentity || this.config.project ? [] : this.config.storage.listDataSessions?.() ?? [] }
  activeDataSession() { return this.config.storage.dataSession?.() ?? null }
  switchDataSession(id: string): void {
    if (!this.dataSessions().some((session) => session.id === id)) return
    this.disconnect(); this.cancelDirect()
    this.config.storage.selectDataSession?.(id)
    this.config.storage.saveSession(null)
    this.loadDataSession()
    this.goToRoot()
  }

  reconnect(reason: string): void {
    this.clearTimer('retry')
    if (this.virtualPeers?.guest) { void this.syncNow(reason); return }
    if (this.pendingSession) { void this.resume(this.pendingSession); return }
    if (this.state.session) {
      if (this.state.connection === 'offline') this.set({ connection: 'connecting' })
      void this.syncNow(reason)
    } else if (this.autoCredentials) {
      void this.login(this.autoCredentials.username, this.autoCredentials.password, true)
    }
  }

  private scheduleRetry(): void {
    this.clearTimer('retry')
    const delay = this.retryDelay
    this.retryDelay = Math.min(this.retryDelay * 2, MAX_RETRY_MS)
    this.retryTimer = setTimeout(() => this.reconnect('retry'), delay)
  }

  private startPolling(): void {
    this.clearTimer('poll')
    const interval = this.config.pollIntervalMs ?? 30_000
    this.pollTimer = setInterval(() => void this.syncNow('poll'), interval)
  }

  private clearTimer(which: 'retry' | 'poll' | 'debounce' | 'connectPoll'): void {
    if (which === 'retry' && this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null }
    if (which === 'poll' && this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
    if (which === 'debounce' && this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null }
    if (which === 'connectPoll' && this.connectPollTimer) { clearTimeout(this.connectPollTimer); this.connectPollTimer = null }
  }

  private openEvents(): void {
    this.closeEvents?.()
    const session = this.state.session
    if (!session) return
    const providerScope = this.state.replica.meta.localScope ?? homePath(this.state.replica)
    const providerStore = this.state.replica.store, providerSession = this.activeDataSession()?.id
    this.closeEvents = connectEvents(session, this.state.replica.meta.peerId, {
      providerScope,
      onNodeRequest: async request => {
        if (session !== this.state.session || providerStore !== this.state.replica.store || providerSession !== this.activeDataSession()?.id || !this.state.policy.to.includes('read')) throw new Error('Node provider context is no longer available.')
        if (request.update || request.peerId !== `user:${session.username}`) throw new Error('Relay requests may only read nodes as the account peer.')
        if (!withMainBranchPolicy(this.state.replica.store, () => nodePersistenceAllowed(this.state.replica, [...request.scope, ...request.path]))) throw new Error('This node is private to this device.')
        const context = request.branches ?? []
        if (this.config.project && context.some(b => JSON.stringify(b.scope) === JSON.stringify(providerScope) && b.name !== this.currentBranch())) throw new Error('The requested project branch is not checked out.')
        const effective = this.config.project ? { ...request, branches: context.filter(b => JSON.stringify(b.scope) !== JSON.stringify(providerScope)) } : request
        const result = exchangeNode(this.state.replica, effective, { peerId: `user:${session.username}`, scope: providerScope, owner: true, capabilities: CLIENT_CAPABILITIES }, this.now())
        if (context.length) result.node.address.branches = context
        this.set({ replica: result.replica })
        return result.node
      },
      onMessage: (message) => {
        if (message.type === 'sync_changed' && message.byPeerId !== this.state.replica.meta.peerId) {
          void this.syncNow('remote change')
        } else if (message.type === 'peer_request') {
          this.notify('info', `${String(message.peerName || 'A device')} wants to connect to ${this.pathLabel((message.scopeNames as string[]) ?? [])}.`)
          void this.refreshRequests()
        }
      },
      onClose: () => {
        setTimeout(() => { if (this.state.session === session) this.openEvents() }, MIN_RETRY_MS)
      }
    })
  }

  pathLabel(names: string[]): string {
    return names.length === 0 ? 'the whole account' : '/' + names.join('/')
  }

  // -------------------------------------------------------------------------
  // Sync

  private scheduleSync(): void {
    if (!this.transport()) return
    this.clearTimer('debounce')
    this.debounceTimer = setTimeout(() => void this.syncNow('edit'), 600)
  }

  pullPeers(): Array<{ id: string; name: string }> {
    const transport = this.transport()
    if (!transport) return []
    return [{ id: transport, name: transport === 'account' ? 'Fos' : transport === 'virtual' ? this.state.virtual?.hostName ?? 'Parent tab' : 'Connected device' }]
  }
  async pullPeer(id: string): Promise<void> {
    if (id !== this.transport()) { this.notify('error', 'This peer is no longer connected.'); return }
    if (this.syncInFlight) { this.notify('info', 'Wait for the current sync to finish, then pull.'); return }
    await this.syncNow('pull', true)
  }
  async syncNow(_reason: string, pullOnly = false): Promise<void> {
    if (this.projectSwitching) { this.syncRequested = true; return }
    const transport = this.transport()
    if (!transport) return
    if (this.syncInFlight) { this.syncRequested = true; return }
    // The policy towards the account server decides what a sync round moves: nothing comes in without `from: read`
    // (the device still answers its own explicit actions), and nothing local goes out without `to: autopush`.
    const policy = transport === 'account' ? this.state.policy : null
    if (policy && !policy.from.includes('read')) { this.set({ connection: 'online' }); return }
    this.syncInFlight = true
    this.clearTimer('debounce')
    this.set({ connection: 'syncing' })

    const session = this.state.session
    const generation = this.authGeneration
    if (transport === 'account' && session?.kind === 'user') this.set({ replica: shareHome(this.state.replica) })
    try {
      await this.syncNodes(pullOnly)
      if (this.state.session !== session || generation !== this.authGeneration) return
      this.set({ connection: 'online' })
      if (transport === 'account') { void this.refreshRepositories(); void this.refreshPoints(); if (this.pendingIntegration) void this.checkPendingIntegration(); else if (!this.state.integrations.length) void this.refreshIntegrations() }
      this.retryDelay = MIN_RETRY_MS
    } catch (error) {
      if ((this.state.session !== session || generation !== this.authGeneration)) return
      if (error instanceof ApiError && error.status === 401) {
        this.closeEvents?.()
        this.closeEvents = null
        this.clearTimer('poll')
        this.set({ session: null, connection: 'offline', loginError: 'Your session expired. Sign in again to sync.', notice: { kind: 'error', text: 'Your session expired. Click Offline to sign in again. Local changes are safe.', at: this.now() }, modal: null })
      } else if (error instanceof ApiError && error.status === 409) {
        this.clearTimer('poll')
        this.set({ connection: 'offline', loginError: `This app cannot sync with the server: ${error.message}. Please update the app.` })
      } else if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
        this.set({ connection: 'online' })
        this.notify('error', `The account refused this device's node: ${error.message}`)
      } else {
        const message = error instanceof Error ? error.message : String(error)
        this.set({ connection: 'offline' })
        this.notify('error', `Sync failed: ${message.replace(/[.!]+$/, '')}. Changes are saved on this device.`)
        this.scheduleRetry()
      }
    } finally {
      this.syncInFlight = false
      if (this.syncRequested) { this.syncRequested = false; void this.syncNow('queued') }
    }
  }

  /** Poll displayed nodes and send shallow local edits. Unopened descendants remain references. */
  private async syncNodes(pullOnly: boolean): Promise<void> {
    const transport = this.transport(), session = this.state.session, generation = this.authGeneration
    const branch = this.currentBranch()
    if (branch !== (this.state.replica.meta.branch ?? null) && this.config.project) this.set({ replica: { ...this.state.replica, meta: { ...this.state.replica.meta, branch: branch ?? undefined } } })
    const initial = this.state.replica, store = initial.store, dataSession = this.activeDataSession()?.id
    const selection = JSON.stringify(this.branchSelections)
    const localRoot = initial.meta.localScope ?? []
    const scope = transport === 'account' ? (session?.kind === 'peer' ? initial.meta.scope : [])
      : transport === 'virtual' ? this.virtualIdentity!.scope : this.link!.remoteScope
    const remoteRoot = transport === 'account' && session?.kind === 'user' ? [...initial.meta.scope, ...localRoot] : scope
    let peer = transport === 'account' ? initial.meta.serverPeerId ?? `user:${session!.username}`
      : transport === 'direct' ? this.link!.remotePeerId! : initial.meta.serverPeerId
    const send = (request: NodeRequest) => transport === 'account' ? requestPeerNode(session!, request)
      : transport === 'virtual' ? this.virtualPeers!.requestNode(request) : this.link!.requestNode(request)
    const valid = () => generation === this.authGeneration && session === this.state.session && store === this.state.replica.store && dataSession === this.activeDataSession()?.id && branch === this.currentBranch() && selection === JSON.stringify(this.branchSelections)
    const push = !pullOnly && (transport === 'account' ? this.state.policy.to.includes('autopush') : transport === 'virtual' ? this.virtualCapabilities.includes('edit') : true)
    const paths = materializedNodePaths(initial, localRoot)
    for (const path of paths) {
      if (!valid()) return
      let r = this.state.replica
      if (!resolveScope(r.store, headCid(r), path)) continue
      if (transport === 'account' && !nodePersistenceAllowed(r, path)) continue
      const local = nodeShape(r, path)
      const branches: import('../../shared/sync/index').NodeBranch[] = []
      if (branch) branches.push({ scope: remoteRoot, name: branch })
      const selected = scopeBranches(r.store, headCid(r), path)
      for (let i = localRoot.length; i <= path.length; i++) {
        const name = selected[path[i - 1]!] ?? this.branchSelections[path[i - 1]!]
        const at = [...remoteRoot, ...path.slice(localRoot.length, i)]
        if (name && !branches.some(b => JSON.stringify(b.scope) === JSON.stringify(at))) branches.push({ scope: at, name })
      }
      const state = peer ? r.meta.nodeSync?.[nodeSyncKey(peer, path, branches)] : undefined
      const legacyBase = r.meta.baseCid ? nodeShape(r, path.slice(localRoot.length), r.meta.baseCid) : { data: {}, children: [] }
      const mainState = peer && branches.length ? r.meta.nodeSync?.[nodeSyncKey(peer, path, branches.map(b => ({ ...b, name: 'main' })))] ?? r.meta.nodeSync?.[nodeSyncKey(peer, path)] : undefined
      const baseline = state?.local ?? nodeBranchBase(r, path) ?? mainState?.local ?? legacyBase
      const dirty = !sameNodeShape(local, baseline)
      const visible = path.length === localRoot.length || (path.length <= this.state.view.length && path.every((id, i) => id === this.state.view[i]))
      if (!visible && !(push && dirty)) continue
      const remotePath = [...remoteRoot.slice(scope.length), ...path.slice(localRoot.length)]
      const request = { ...nodeSyncRequest(r, path, peer ?? 'virtual-host', scope, remotePath), ...(branches.length ? { branches } : {}) }
      const remote = await send(push && dirty ? { ...request, update: { base: { data: {}, children: [] }, value: { data: {}, children: [] } } } : request)
      if (!valid()) return
      if (peer && remote.peerId !== peer) throw new Error('Node provider identity changed.')
      validateNodeShape(remote)
      peer = remote.peerId
      if (remote.remoteLinkId !== request.linkId || JSON.stringify(remote.address.scope) !== JSON.stringify([...scope, ...remotePath])) throw new Error('Node response does not match its attachment.')
      r = establishNodeSync(this.state.replica, path, request, remote, this.now())
      if (transport === 'account' && remote.capabilities) r = this.withServerOffers(r, remote.capabilities)
      this.set({ replica: r, ...(transport === 'account' && remote.capabilities ? { serverCapabilities: [...remote.capabilities] } : {}) })
      const filterRemote = (shape: import('../../shared/sync/index').NodeShape) => ({
        data: Object.fromEntries(Object.entries(shape.data).filter(([key]) => !remote.mask?.fields || remote.mask.fields.includes(key))),
        children: shape.children.filter(child => !remote.mask?.children || remote.mask.children.includes(child.id))
      })
      const outgoingBase = filterRemote(outgoingNodeShape(r, path, peer, baseline))
      const outgoing = filterRemote(outgoingNodeShape(r, path, peer, local))
      const finalRemote = push && !sameNodeShape(outgoingBase, outgoing)
        ? await send({ ...request, update: { base: remote, value: mergeNodeShape(outgoingBase, outgoing, remote) } }) : remote
      if (!valid()) return
      validateNodeShape(finalRemote)
      r = this.state.replica
      const current = nodeShape(r, path)
      const normalized = { ...finalRemote, children: finalRemote.children.map(child => {
        const existing = local.children.find(c => c.id === child.id)
        return child.address.peerId === r.meta.peerId && existing ? { ...child, kind: existing.kind } : child
      }) }
      const filtered = outgoingNodeShape(r, path, peer, normalized)
      const previousRemote = outgoingNodeShape(r, path, peer, state?.remote ?? nodeBranchBase(r, path) ?? mainState?.remote ?? legacyBase)
      const accepted = mergeNodeShape(previousRemote, filtered, local)
      const merged = mergeNodeShape(local, accepted, current)
      if (!sameNodeShape(current, merged)) r = installNodeShape(r, path, merged, this.now())
      r = rememberNodeSync(r, path, normalized, accepted)
      this.set({ replica: { ...r, meta: { ...r.meta, lastSyncAt: this.now() } } })
    }
  }

  // -------------------------------------------------------------------------
  // Local edits (always allowed)

  private together<T>(run: () => T): T {
    if (this.groupedEdit) return run()
    this.groupedEdit = true
    try { return run() }
    finally { this.groupedEdit = false; this.edit({ ...this.state.replica }) }
  }
  private edit(next: Replica, settings = this.state.atRoot, preferred = this.state.selected ? [...this.state.view, ...this.state.selected] : undefined): void {
    if (this.groupedEdit) return
    if (next === this.state.replica) return
    this.history.record(next, this.observedHead, settings, preferred)
    this.set({ replica: next })
    this.scheduleSync()
    if (this.link?.open && this.state.direct?.role === 'host') {
      try { this.link.send({ t: 'changed' }) } catch { /* ignore */ }
    }
  }

  canResetHome(): boolean {
    return !this.virtualIdentity && !this.config.project && (!this.state.session || this.state.session.kind === 'user')
  }
  resetHome(): void {
    if (!this.canResetHome()) return
    this.edit(resetHomeContent(this.state.replica, this.now()), false)
    this.set({ view: homePath(this.state.replica), selected: null })
    this.notify('info', 'Attached node content reset. You can undo this. The change syncs under your current peer policy.')
  }

  async resetAccount(): Promise<void> {
    const session = this.state.session
    if (!session || session.kind !== 'user' || this.virtualIdentity || this.config.project) return
    this.disconnect()
    const generation = this.authGeneration
    this.set({ connection: 'connecting' })
    try {
      let replica = shareHome(this.state.replica.meta.scope.length ? ensureHomeContext(createReplica(), this.now()) : this.documentReplica(loadReplica(serializeReplica(this.state.replica))))
      const at = replica.meta.localScope ?? []
      const peer = `user:${session.username}`
      const request = nodeSyncRequest(replica, at, peer, [], at)
      const remote = await requestPeerNode(session, request)
      if (generation !== this.authGeneration) return
      replica = acceptProvidedNode(replica, at, request, remote, this.now())
      const before = headCid(replica)
      replica = resetHomeContent(replica, this.now())
      const saved = await requestPeerNode(session, { ...request, update: { base: remote, value: nodeShape(replica, at) } })
      if (generation !== this.authGeneration) return
      replica = rememberNodeSync(replica, at, saved)
      this.virtualPeers?.close(); this.virtualPeers = null
      this.set({ replica, session, view: homePath(replica), selected: null, connection: 'online', atRoot: false })
      this.history.record(replica, before, false)
      this.enableVirtualPeers(null)
      this.openEvents(); this.startPolling()
      this.notify('info', 'Shared Home content reset. You can undo this.')
    } catch (error) {
      if (generation === this.authGeneration) { this.set({ connection: 'offline' }); this.notify('error', `Reset failed: ${error instanceof Error ? error.message : String(error)}. Local data was kept.`) }
    }
  }

  get canUndo(): boolean { return this.history.canUndo }
  get canRedo(): boolean { return this.history.canRedo }
  undo(): void { this.restoreEdit(false) }
  redo(): void { this.restoreEdit(true) }
  canUndoNode(redo = false): boolean { return this.history.canApply(this.state.replica, redo, this.state.view) }
  undoNode(redo = false): void { this.restoreEdit(redo, this.state.view) }
  private restoreEdit(redo: boolean, scope?: Scope): void {
    const result = this.history.apply(this.state.replica, redo, this.now(), scope)
    if (!result) return
    const path = [...result.path]
    while (path.length && !view(result.replica, path)) path.pop()
    const current = this.state.view
    const keepView = current.length <= path.length && current.every((id, i) => path[i] === id) && !!view(result.replica, current)
    const parent = keepView ? current : path.slice(0, -1)
    const selected = path.slice(parent.length)
    this.set({ replica: result.replica, view: parent, selected: selected.length ? selected : null,
      atRoot: scope ? this.state.atRoot : result.settings, collapsed: this.state.collapsed.filter((id) => !path.includes(id)), menuOpen: false, contextMenu: null, notice: null })
    this.scheduleSync()
    if (this.link?.open && this.state.direct?.role === 'host') {
      try { this.link.send({ t: 'changed' }) } catch { /* next sync retries */ }
    }
    if (result.conflicts) this.notify('info', 'This change overlaps newer edits. Choose which version to keep.')
  }

  addTask(title: string): void { this.edit(addTask(this.state.replica, this.state.view, title, this.now())) }

  /**
   * Add a row of `kind` under `at` (relative to the view). Comments carry this device as the author; an allocation
   * draws from the parent context (`bankFor`); a task naming a template executes it (its requirements are copied
   * underneath); a task requirement naming a template gets that execution as its child right away.
   */
  addRowAt(at: Scope, kind: RowKind, text: string, options: { done?: boolean; refId?: string; position?: MovePosition; id?: string; extras?: Omit<RowExtras, 'store'>; templateName?: string; replica?: Replica; preserveUnbound?: boolean } = {}): string {
    const author = kind === 'comment' ? { id: this.state.replica.meta.peerId, name: this.state.session?.username ?? this.state.deviceName } : undefined
    const id = options.id ?? crypto.randomUUID()
    const { extras, templateName, replica: branch, preserveUnbound, ...rest } = options
    const replica = branch ?? this.state.replica
    let data: Omit<RowExtras, 'store'> = { ...(extras ?? {}) }
    if (kind === 'allocation') {
      const resolved = preserveUnbound && data.allocation && !this.bankFor(at, data.allocation.type, data.allocation.person, replica) ? { ...data.allocation, resource: '' } : this.allocationWithBank(at, data.allocation, replica)
      if (!resolved) return id
      data = { ...data, allocation: resolved }
    }
    const next = addRow(replica, [...this.state.view, ...at], kind, text, this.now(), { ...rest, ...data, author, id })
    if (!branch) this.edit(next)
    if (templateName && kind === 'task') this.applyTemplate(at, id, templateName, branch)
    if (templateName && kind === 'requirement' && data.requirement?.capability === 'task') {
      // "-[ ] `name`": the required task is created at once as an execution of the template
      const child = this.addRowAt([...at, id], 'task', templateName, { templateName, replica: branch })
      if (!branch) this.set({ collapsed: this.state.collapsed.filter((c) => c !== id && c !== child) })
    }
    return id
  }
  /** Make the task `taskId` an execution of the template called `name`: its requirement rows are copied underneath, unfilled. */
  applyTemplate(at: Scope, taskId: string, name: string, branch?: Replica): void {
    const replica = branch ?? this.state.replica
    const template = findTemplateByName(replica, name)
    if (!template) { this.notify('error', `No template called “${name}”. Make one with a \`${name} row and put its requirements (- …) inside.`); return }
    const next = instantiateTemplate(replica, [...this.state.view, ...at], taskId, template.row.id, this.now())
    if (!branch) this.edit(next)
    if (!branch) this.set({ collapsed: this.state.collapsed.filter((c) => c !== taskId) })
  }
  /** The closest resource-bank row on the path `at` (relative to the view), if any. */
  nearestBank(at: Scope): (TaskView & { resource: NonNullable<TaskView['resource']> }) | null {
    for (let i = at.length; i > 0; i--) {
      const parentAt = at.slice(0, i - 1)
      const id = at[i - 1] as string
      const row = view(this.state.replica, [...this.state.view, ...parentAt])?.tasks.find((t) => t.id === id)
      if (row?.kind === 'resource' && row.resource) return row as TaskView & { resource: NonNullable<TaskView['resource']> }
    }
    return null
  }
  /** The row `at` points at (relative to the view), if any. */
  rowAt(at: Scope): TaskView | null {
    const id = at[at.length - 1]
    if (!id) return null
    return view(this.state.replica, [...this.state.view, ...at.slice(0, -1)], true)?.tasks.find((t) => t.id === id) ?? null
  }
  /**
   * The bank an allocation of `type` added under `at` draws from, its parent context: the nearest bank of that type
   * above it; otherwise, under an allocation requirement, a bank of the resource the requirement names; otherwise
   * the default pool of the type (the first bank of that type at the top level, else the first anywhere); with no
   * type (legacy), the nearest bank above or the only bank there is.
   */
  bankFor(at: Scope, type?: ResourceType | null, person?: string, replica = this.state.replica): (TaskView & { resource: NonNullable<TaskView['resource']> }) | null {
    type Bank = TaskView & { resource: NonNullable<TaskView['resource']> }
    const fits = (b: Bank) => (!type || b.resource.type === type) && (type !== 'person' || !person || b.title.trim().toLowerCase() === person.toLowerCase())
    const path = [...this.state.view, ...at]
    for (let i = path.length; i > 0; i--) {
      const row = view(replica, path.slice(0, i - 1))?.tasks.find(row => row.id === path[i - 1])
      if (row?.kind === 'resource' && row.resource && fits(row as Bank)) return row as Bank
    }
    const all = this.banks(replica)
    const parent = view(replica, [...this.state.view, ...at.slice(0, -1)])?.tasks.find(row => row.id === at[at.length - 1])
    const req = parent?.kind === 'requirement' ? parent.requirement : undefined
    if (req?.capability === 'allocation' && req.resource && (!type || req.resource === type)) {
      const match = all.find(({ row }) => row.resource.type === req.resource && fits(row))
      if (match) return match.row
    }
    if (type) {
      const pool = all.find(({ row, path }) => path.length === 0 && fits(row)) ?? all.find(({ row }) => fits(row))
      return pool ? pool.row : null
    }
    return all.length === 1 ? (all[0] as { row: Bank }).row : null
  }
  /**
   * An allocation with its bank resolved from the parent context (`bankFor`), or null (with a notice) when there is
   * none. A person allocation needs that person's bank only when it holds a window; otherwise it stands on its own.
   */
  allocationWithBank(at: Scope, allocation: NonNullable<RowExtras['allocation']> | undefined, replica = this.state.replica): NonNullable<RowExtras['allocation']> | null {
    const by = this.state.session?.username ?? this.state.deviceName
    const base = allocation ?? { resource: '', type: 'inventory' as ResourceType, amount: 0, unit: 'unit' }
    const windowed = base.start !== undefined || base.end !== undefined
    if (base.type === 'person' && !windowed) return { ...base, by }
    const bank = this.bankFor(at, allocation ? base.type : null, base.person, replica)
    if (!bank && base.type === 'points') {
      // fos points without a bank row draw from the account's balance (the fos peer is the pool); a payout moves them on the server's ledger when the task runs
      if (this.state.points !== null && base.amount > this.state.points) this.notify('error', `That is more than the ${this.state.points} fos points on the account; the allocation is recorded anyway.`)
      return { ...base, resource: 'fos:points', by }
    }
    if (!bank) {
      const names: Record<ResourceType, string> = { account: '@money Travel 500', calendar: '@calendar Week 40h', inventory: '@inventory Shelf 12', person: `@person ${base.person ?? 'name'} 40h`, points: '@points Pool 500' }
      this.notify('error', base.type === 'person' ? `A person allocation with a window needs ${base.person ?? 'their'}'s calendar: add "${names.person}" at the top level.` : `No ${base.type === 'account' ? 'money' : base.type} bank in this context: add one at the top level as the default pool ("${names[base.type]}"), or above this row.`)
      return null
    }
    return { ...base, resource: bank.id, type: bank.resource.type, unit: base.unit === 'unit' ? bank.resource.unit : base.unit, by }
  }
  /**
   * A row's text was edited in its raw marker form: re-parse it and rewrite the row in place (kind, text, data),
   * keeping its id and children. Templates named in the text are applied as for a new row.
   */
  dropBlankRow(parent: Scope, id: string, store: Replica['store']): void {
    if (store !== this.state.replica.store) return
    const row = view(this.state.replica, parent)?.tasks.find((t) => t.id === id)
    if (row && !row.title.trim() && !row.childCount && !row.childChoices) this.edit(deleteTask(this.state.replica, parent, id, this.now()))
  }
  rewriteRowAt(at: Scope, id: string, parsed: import('./rows').ParsedInput, draft?: { store: Replica['store']; head: string; parent: Scope }): void {
    if (id === HOME_ID) return
    if ((parsed.children?.length || parsed.peer !== undefined) && !this.groupedEdit) { this.together(() => this.rewriteRowAt(at, id, parsed, draft)); return }
    if (draft && draft.store !== this.state.replica.store) return
    let extras: Omit<RowExtras, 'store'> = { ...(parsed.extras ?? {}), done: parsed.done }
    if (parsed.kind === 'allocation') {
      const resolved = this.allocationWithBank(at, parsed.extras?.allocation)
      if (!resolved) return
      extras = { ...extras, allocation: resolved }
    }
    const before = this.rowAt([...at, id])
    const rebasing = !!draft && draft.head !== headCid(this.state.replica)
    if (rebasing) {
      let branch = createReplica(this.state.replica.meta.peerId)
      importNodes(branch.store, reachableNodes(draft.store, [draft.head]))
      commitRoot(branch.store, draft.head, this.now())
      for (const [id, name] of Object.entries(this.branchSelections)) selectBranch(branch.store, id, name)
      branch = parsed.kind === 'ref' || parsed.kind === 'supply' ? renameTask(branch, draft.parent, id, parsed.text, this.now()) : setRowContentAt(branch, draft.parent, id, parsed.kind, parsed.text, extras, this.now())
      if (parsed.peer !== undefined || before?.construction?.handler) branch = this.peerRowReplica(branch, [...draft.parent, id], parsed.peer)
      if (parsed.children?.length) this.addParsedChildren([...at, id], parsed.children, branch)
      const current = this.state.replica
      importNodes(current.store, reachableNodes(branch.store, [headCid(branch)]))
      const merged = mergeNodes(current.store, draft.head, headCid(current), headCid(branch), { ours: 'Incoming edit', theirs: this.state.deviceName })
      commitRoot(current.store, merged.cid, this.now())
      this.edit({ ...current })
      if (merged.newChoiceCids.length) { this.notify('info', 'This row changed in two places. Choose which version to keep.'); return }
    } else {
      this.edit(parsed.kind === 'ref' || parsed.kind === 'supply' ? renameTask(this.state.replica, [...this.state.view, ...at], id, parsed.text, this.now()) : setRowContentAt(this.state.replica, [...this.state.view, ...at], id, parsed.kind, parsed.text, extras, this.now()))
    }
    if ((parsed.peer !== undefined || before?.construction?.handler) && !rebasing) this.setPeerRow([...this.state.view, ...at, id], parsed.peer)
    if (parsed.children?.length && !rebasing) this.addParsedChildren([...at, id], parsed.children)
    if (parsed.templateName && parsed.kind === 'task' && before?.template?.name !== parsed.templateName) this.applyTemplate(at, id, parsed.templateName)
    if (parsed.templateName && parsed.kind === 'requirement' && extras.requirement?.capability === 'task') {
      const inside = view(this.state.replica, [...this.state.view, ...at, id])?.tasks ?? []
      if (!inside.some((t) => t.kind === 'task' && t.template?.name === parsed.templateName)) this.addRowAt([...at, id], 'task', parsed.templateName, { templateName: parsed.templateName })
    }
  }
  /**
   * A peer dropped on a row makes that row a group: the peer becomes a member (may read and propose). The first
   * member brings the fos account server along as a member too (it can be removed like any other).
   */
  addPeerToRow(at: Scope, rowId: string, peerId: string, name: string): void {
    const path = [...this.state.view, ...at, rowId]
    const node = view(this.state.replica, path)
    if (!node) return
    let replica = this.state.replica
    const session = this.state.session
    const serverId = this.state.replica.meta.serverPeerId ?? (session?.kind === 'user' ? `user:${session.username}` : null)
    if (!node.members.length && serverId && peerId !== serverId) replica = addMemberAt(replica, path, serverId, 'fos', ['read', 'edit', 'relay'], this.now())
    if (!node.members.some((m) => m.peerId === peerId)) replica = addMemberAt(replica, path, peerId, name, ['read', 'edit'], this.now())
    this.edit(replica)
    this.notify('info', `@${name} is a member of “${node.name ?? 'this row'}” (a group: its members see it and may propose).`)
  }
  /** Resource banks anywhere in the replica, with their paths. */
  banks(replica = this.state.replica): Array<{ row: TaskView & { resource: NonNullable<TaskView['resource']> }; path: Scope }> {
    const out: Array<{ row: TaskView & { resource: NonNullable<TaskView['resource']> }; path: Scope }> = []
    const walk = (path: Scope) => {
      const node = view(replica, path)
      if (!node) return
      for (const row of node.tasks) {
        if (row.kind === 'resource' && row.resource) out.push({ row: row as TaskView & { resource: NonNullable<TaskView['resource']> }, path })
        if (row.childCount) walk([...path, row.id])
      }
    }
    walk([])
    return out
  }
  /** Banks visible from the current view: those above it (the context) plus those at this level. */
  contextBanks(): Array<{ row: TaskView & { resource: NonNullable<TaskView['resource']> }; path: Scope }> {
    const here = this.state.view
    return this.banks().filter(({ path }) => path.length <= here.length && path.every((p, i) => here[i] === p))
  }
  /**
   * Peers in the context of the viewed node: the account server ("fos") with what it registered on the last sync
   * (the transport facts until then), the node's members with the capability rows this node's owner exposes to each
   * (editable here by the owner), and devices attached here (a direct-connected one is reachable `direct`).
   */
  private peerContextPath(): Scope { return this.currentRow()?.construction ? this.state.view.slice(0, -1) : this.state.view }
  contextPeers(path = this.peerContextPath()): ContextPeer[] {
    const peers: ContextPeer[] = []
    const session = this.state.session
    const me = this.state.replica.meta.peerId
    const local = view(this.state.replica, path)
    // Constructor arguments are the surrounding context; nearer peer bindings shadow ancestors.
    const members = new Map<string, NonNullable<NodeView>['members'][number]>()
    for (const member of contextMembers(this.state.replica, path)) members.set(member.peerId, member)
    const node = local ? { ...local, members: [...members.values()] } : local
    const nameOf = (id: string) => (id.startsWith('user:') ? id.slice(5) : id.slice(0, 8))
    // the fos account server is always a peer of the root context (sign in happens on its row when not connected)
    if (!this.config.scopedDocument && !this.virtualIdentity && (session?.kind === 'user' || this.state.view.length <= homePath(this.state.replica).length)) {
      const id = this.state.replica.meta.serverPeerId ?? (session ? `user:${session.username}` : 'fos')
      const online = this.isOnline('fos')
      peers.push({ id, name: 'fos', online, capabilities: [...this.serverOffers()], disabled: [], accepts: [], isAccount: true, member: false, policy: this.state.policy, policyLocked: this.state.policyLocked, points: this.state.points })
    }
    // integration peers (sign in with GitHub, Google, Discord; Stripe on the account; the phone): the server's status when signed in, the registry otherwise
    if (!this.virtualIdentity && !this.state.atRoot && (homePath(this.state.replica).every((id, index) => path[index] === id) || node?.members.some(member => member.peerId.startsWith('integration:')))) {
      for (const i of INTEGRATION_PEERS) {
        const s = this.state.integrations.find((p) => p.id === i.id)
        const provides = this.integrationOffers(i.id)
        peers.push({ id: `integration:${i.id}`, name: i.name, online: this.isOnline(`integration:${i.id}`), capabilities: [...provides], disabled: [], accepts: [...i.consumes], isAccount: false, member: false, integration: { kind: i.kind, provides: [...provides], consumes: [...i.consumes], configured: s?.configured ?? false, connected: s?.connected ?? false, pending: s?.pending ?? false, accountName: s?.accountName ?? null } })
      }
      for (const m of this.state.mcpPeers) {
        if (peers.some((x) => x.id === m.id)) continue
        peers.push({ id: m.id, name: m.name, online: this.isOnline(m.id), capabilities: ['tool', 'read', 'edit'], disabled: [], accepts: [], isAccount: false, member: false, mcp: { serverId: m.serverId, tools: m.tools } })
      }
    }
    for (const m of node?.members ?? []) {
      if (m.peerId === me || m.peerId === 'fos' || peers.some((x) => x.id === m.peerId)) continue
      peers.push({ id: m.peerId, name: m.name ?? nameOf(m.peerId), online: this.isOnline(m.peerId), capabilities: [...m.capabilities], disabled: [...(m.disabled ?? [])], accepts: [...(m.accepts ?? [])], isAccount: m.peerId.startsWith('user:'), member: true, ...(m.peerId.startsWith('user:') ? { fosUser: m.peerId.slice(5) } : {}), ...(m.peerId.startsWith('github:') ? { repository: { repo: m.peerId.slice(7) } } : {}) })
    }
    const directPeer = this.state.direct?.phase === 'connected' ? this.state.replica.meta.serverPeerId ?? null : null
    for (const p of node?.peers ?? []) {
      if (p === me) continue
      const known = peers.find((x) => x.id === p)
      if (known) { if (p === directPeer && !known.capabilities.includes('direct')) known.capabilities.push('direct'); continue }
      peers.push({ id: p, name: nameOf(p), online: this.isOnline(p), capabilities: p === directPeer ? ['direct'] : [], disabled: [], accepts: [], isAccount: p.startsWith('user:'), member: false, ...(p.startsWith('user:') ? { fosUser: p.slice(5) } : {}) })
    }
    peers.push({ id: me, name: this.state.deviceName, online: true, capabilities: [], disabled: [], accepts: CLIENT_CAPABILITIES, isAccount: false, member: false })
    for (const p of peers) {
      const member = members.get(p.name === 'fos' ? 'fos' : p.id)
      if (member) { p.disabled = [...(member.disabled ?? [])]; p.accepts = [...(member.accepts ?? [])] }
    }
    return peers
  }
  /** Every capability a peer row can carry, for the owner's "add" control. */
  allCapabilities(): Capability[] { return [...CAPABILITIES] }
  /**
   * What the account server offers: the list it reported in its last response, else what this device recorded on its
   * fos member from an earlier session, else only the transport facts. Services appear here only when the server's
   * handler registry has them, so the palette never shows a constructor without a handler behind it.
   */
  serverOffers(): Capability[] {
    if (this.state.serverCapabilities) return this.state.serverCapabilities
    const recorded = this.state.replica.meta.scope.length ? undefined : view(this.state.replica, [])?.members.find(m => m.peerId === 'fos')?.accepts
    return recorded?.length ? recorded : SERVER_TRANSPORT_CAPABILITIES
  }
  /** What an integration peer provides: the server's live answer, else what Home recorded for it. */
  integrationOffers(id: string): Capability[] {
    const live = this.state.integrations.find(p => p.id === id)?.provides
    if (live) return live.filter((c): c is Capability => (CAPABILITIES as string[]).includes(c))
    return view(this.state.replica, homePath(this.state.replica))?.members.find(m => m.peerId === `integration:${id}`)?.accepts ?? []
  }
  /** Record the server's reported offers on this device's own fos member (the root is device-local). */
  private withServerOffers(replica: Replica, capabilities: Capability[]): Replica {
    if (this.config.scopedDocument || this.config.project || this.virtualIdentity || replica.meta.scope.length) return replica
    return ensureHomeContext(replica, this.now(), { server: capabilities })
  }
  /** The account server reported what it offers (a sync or node response): remember it and record it on the fos member. */
  recordServerOffers(capabilities: Capability[]): void {
    const replica = this.withServerOffers(this.state.replica, capabilities)
    this.set({ serverCapabilities: [...capabilities], ...(replica !== this.state.replica ? { replica } : {}) })
  }
  private withIntegrationPeer(replica: Replica, path: Scope, id: string): Replica {
    const integration = INTEGRATION_PEERS.find(peer => peer.id === id)
    if (!integration || view(replica, path)?.members.some(peer => peer.peerId === `integration:${id}`)) return replica
    replica = addMemberAt(replica, path, `integration:${id}`, integration.name, [], this.now())
    return setMemberCapabilitiesAt(replica, path, `integration:${id}`, [], [], this.now(), [...this.integrationOffers(id)])
  }
  /** Integration peers and MCP peers as the server sees them for this account. */
  async refreshIntegrations(): Promise<void> {
    const session = this.state.session
    if (!session || session.kind !== 'user') { if (this.state.integrations.length || this.state.mcpPeers.length) this.set({ integrations: [], mcpPeers: [] }); return }
    try {
      const [{ providers }, mcp] = await Promise.all([listIntegrations(session), listMcpPeers(session).catch(() => ({ peers: [] as McpPeerInfo[] }))])
      if (this.state.session === session) {
        let replica = this.state.replica
        // Existing OAuth connections were formerly only synthetic Settings rows; persist their root offers.
        if (!this.virtualIdentity && !this.config.scopedDocument && !replica.meta.scope.length) for (const provider of providers.filter(p => p.connected)) replica = this.withIntegrationPeer(replica, homePath(replica), provider.id)
        this.set({ integrations: providers, mcpPeers: mcp.peers, ...(replica !== this.state.replica ? { replica } : {}) })
        if (isDirty(replica)) this.scheduleSync()
        void this.refreshRepositories()
      }
    } catch { /* the rows fall back to the static registry */ }
  }
  /** Reuse the account OAuth or phone connection transport. */
  async connectIntegration(id: string): Promise<void> {
    const session = this.state.session
    if (!session || session.kind !== 'user') { this.notify('error', 'Sign in to your fos account first; integrations attach to it.'); this.openModal('connect'); return }
    const status = this.state.integrations.find((p) => p.id === id)
    this.edit(this.withIntegrationPeer(this.state.replica, this.state.view, id))
    if (id === 'phone') { this.set({ phone: { phase: 'number' } }); this.openModal('phone'); return }
    if (status?.kind === 'platform') { this.notify('info', `${status.name} is set up on the account itself (payments); there is nothing to connect here.`); return }
    try {
      const { url } = await startIntegration(session, id)
      if (session !== this.state.session) return
      // In the Tauri apps the sign-in runs in the system browser: Google (and others) refuse embedded webviews
      // ("disallowed_useragent"), and navigating the app's own window away would lose the app. The provider's
      // callback lands on the web site, so the app learns the result when it regains focus (`checkPendingIntegration`).
      this.pendingIntegration = { id, session }
      const external = openExternal(url)
      if (!external) { window.location.assign(url); return }
      await external
      if (session !== this.state.session) return
      this.notify('info', `Finish signing in to ${status?.name ?? id} in your browser, then come back here.`)
      void this.checkPendingIntegration()
    } catch (error) {
      if (session !== this.state.session) return
      if (this.pendingIntegration?.id === id && this.pendingIntegration.session === session) this.pendingIntegration = null
      this.notify('error', error instanceof Error ? error.message : String(error))
    }
  }
  /** After a sign-in opened in the system browser: on return, see whether the peer is now connected. */
  private async checkPendingIntegration(): Promise<void> {
    const pending = this.pendingIntegration
    if (!pending) return
    if (pending.session !== this.state.session) { this.pendingIntegration = null; return }
    if (document.visibilityState === 'hidden') return
    await this.refreshIntegrations()
    if (this.pendingIntegration !== pending || this.state.session !== pending.session) return
    const status = this.state.integrations.find(p => p.id === pending.id)
    if (status?.connected) { this.pendingIntegration = null; this.notify('info', `${status.name} is connected.`) }
  }

  async disconnectIntegration(id: string): Promise<void> {
    const session = this.state.session
    if (!session || session.kind !== 'user') return
    try { await disconnectIntegration(session, id); await this.refreshIntegrations(); this.notify('info', `${this.state.integrations.find((p) => p.id === id)?.name ?? id} disconnected.`) } catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)) }
  }
  /** Back from a provider's sign-in page (main.ts reads ?integration=&ok=&message=). */
  integrationReturned(provider: string, ok: boolean, message: string | null): void {
    const name = this.state.integrations.find((p) => p.id === provider)?.name ?? provider
    this.notify(ok ? 'info' : 'error', ok ? `${name} is connected.` : `${name}: ${message ?? 'sign-in failed'}`)
    void this.refreshIntegrations()
  }
  async phoneStart(number: string): Promise<void> {
    const session = this.state.session
    if (!session) return
    this.set({ phone: { phase: 'busy', number } })
    try { const r = await startPhone(session, number); this.set({ phone: { phase: 'code', number: r.number } }) } catch (error) { this.set({ phone: { phase: 'number', number, error: error instanceof Error ? error.message : String(error) } }) }
  }
  phoneRestart(): void { this.set({ phone: { phase: 'number' } }) }
  async phoneVerify(code: string): Promise<void> {
    const session = this.state.session
    const number = this.state.phone?.number
    if (!session) return
    this.set({ phone: { phase: 'busy', number } })
    try {
      const r = await verifyPhone(session, code)
      this.set({ phone: null, modal: null })
      this.notify('info', `${r.number} is linked: you get texts about proposals, and texts you send become rows (“done …”, “list”, or anything to add).`)
      await this.refreshIntegrations()
    } catch (error) {
      this.set({ phone: { phase: 'code', number, error: error instanceof Error ? error.message : String(error) } })
    }
  }
  /** Attach one of the account's MCP servers to the viewed node (Home when at the root): it becomes a member advertising `tool`. */
  async attachMcpPeer(serverId: number, at: Scope = []): Promise<void> {
    const session = this.state.session
    if (!session || session.kind !== 'user') { this.notify('error', 'Sign in to attach MCP peers.'); return }
    const scope = [...this.currentScope(), ...at]
    try {
      const r = await attachMcpPeer(session, scope, serverId)
      this.notify('info', `Attached: it runs ${r.tools.length ? r.tools.join(', ') : 'its tools'} for "-tool" requirements under ${scope.length ? 'this node' : 'Home'}.`)
      await this.syncNow('mcp attach')
    } catch (error) {
      this.notify('error', error instanceof Error ? error.message : String(error))
    }
  }
  /** The account's fos points (token balance), shown on the fos row and the default pool for "ff" allocations. */
  async refreshPoints(): Promise<void> {
    const session = this.state.session
    if (!session || session.kind !== 'user') { if (this.state.points !== null) this.set({ points: null }); return }
    try {
      const { balance } = await getTokenBalance(session)
      if (this.state.session === session && typeof balance?.availableTokens === 'number' && balance.availableTokens !== this.state.points) this.set({ points: balance.availableTokens })
    } catch { /* the balance is informational; keep the last value */ }
  }
  /** Owner side: the capability rows under the peer `peerId` on the viewed node: `to` (granted, and which are switched off) and `from` (accepted). */
  setPeerCapabilities(peerId: string, capabilities: Capability[], disabled: Capability[], accepts?: Capability[]): void {
    if (!this.canApprove()) { this.notify('error', 'Only the owner of this node (or a member who may approve) changes what peers get here.'); return }
    this.edit(setMemberCapabilitiesAt(this.state.replica, this.peerContextPath(), peerId, capabilities, disabled, this.now(), accepts))
  }
  /** A nearer member binding shadows inherited offers without changing the parent. */
  setPeerOffers(peerId: string, offers: Capability[], enabled: boolean): void {
    if (!this.canApprove()) return
    const inherited = new Map<string, NodeView['members'][number]>()
    for (let i = 0; i <= this.peerContextPath().length; i++) for (const m of view(this.state.replica, this.peerContextPath().slice(0, i))?.members ?? []) inherited.set(m.peerId, m)
    const member = inherited.get(peerId)
    const provider = this.contextPeers().find(p => p.id === peerId)
    const accepts = [...new Set([...(member?.accepts ?? provider?.integration?.provides ?? provider?.accepts ?? []), ...offers])]
    const disabled = enabled ? (member?.disabled ?? []).filter(c => !offers.includes(c)) : [...new Set([...(member?.disabled ?? []), ...offers])]
    let r = this.state.replica
    // Older Home constructors passed the exact root member as a default argument.
    // Keep that default linked when changing root offers, but preserve Home overrides.
    const home = homePath(r), passed = !this.peerContextPath().length && home.length ? view(r, home)?.members.find(m => m.peerId === peerId) : null
    const same = (a: readonly string[] = [], b: readonly string[] = []) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
    const inheritedDefault = member && passed && same(member.capabilities, passed.capabilities) && same(member.accepts, passed.accepts) && same(member.disabled, passed.disabled)
    r = setMemberCapabilitiesAt(r, this.peerContextPath(), peerId, member?.capabilities ?? [], disabled, this.now(), accepts)
    if (inheritedDefault) r = setMemberCapabilitiesAt(r, home, peerId, passed.capabilities, disabled, this.now(), accepts)
    this.edit(r)
  }
  /** This device's policy towards the account server (unless fos.config.toml fixed it). Turning `from: read` on syncs at once. */
  setServerPolicy(policy: PeerPolicy): void {
    if (this.state.policyLocked) { this.notify('error', 'This policy is set in fos.config.toml ([server] to / from); edit the file to change it.'); return }
    const before = this.state.policy
    this.set({ policy: { to: [...new Set(policy.to)], from: [...new Set(policy.from)] } })
    this.savePrefs()
    if (!before.from.includes('read') && policy.from.includes('read')) void this.syncNow('policy')
    if (!before.to.includes('autopush') && policy.to.includes('autopush')) this.scheduleSync()
  }
  /** May this device submit proposals to the account (send rows, market proposals)? `to: edit` in its policy. */
  mayPropose(): boolean { return this.state.policy.to.includes('edit') }
  /** Does this device read the requests (proposals) addressed to it? `from: read-requests` in its policy. */
  readsRequests(): boolean { return this.state.policy.from.includes('read-requests') }
  /** Owner side: a peer row for another account on the viewed node, starting with `edit` (so it may send proposals here, e.g. allocation bins). */
  async findFosUsers(query: string): Promise<string[]> {
    const session = this.state.session
    if (session?.kind !== 'user' || !this.isOnline('fos')) throw new Error('Connect to Fos to search users.')
    if (!query.trim()) return []
    const users = await searchFosUsers(session, query)
    return session === this.state.session ? users : []
  }
  attachAgentPeer(path: Scope, id: string, name: string): void {
    if (!this.canApprove(view(this.state.replica, path)) || !id.startsWith('agent:')) throw new Error('Only node owners can connect agents.')
    this.edit(addMemberAt(this.state.replica, path, id, name, ['read', 'edit'], this.now()))
  }
  removeAgentPeer(path: Scope, id: string): void {
    if (!this.canApprove(view(this.state.replica, path)) || !id.startsWith('agent:')) throw new Error('Only node owners can remove agents.')
    this.edit(removeMemberAt(this.state.replica, path, id, this.now()))
  }
  /**
   * Make a Fos user a member of the viewed node: an `invite` event. The account server records the member grant and
   * delivers the node into that user's Home, so the membership reaches them (a local edge alone never would).
   */
  async addPeerHere(username: string): Promise<void> {
    const name = username.trim().replace(/^@/, '')
    if (!name) return
    if (!this.canApprove()) { this.notify('error', 'Only the owner of this node adds peers to it.'); return }
    if (contextMembers(this.state.replica, this.peerContextPath()).some(m => m.peerId === `user:${name}`)) return
    const session = this.state.session
    if (!session || session.kind !== 'user' || !this.isOnline('fos')) { this.notify('error', 'Connect to your account to invite a Fos user: the server delivers the node to them.'); return }
    try {
      await this.syncNow('before invite') // the server must hold the node before it records the grant
      await sendEvent(session, { kind: 'invite', path: [], user: name }, [...this.state.replica.meta.scope, ...this.peerContextPath()])
      await this.syncNow('invite')
      this.notify('info', `@${name} is a member here: the node is in their Home and they can propose on it. Add or switch off capabilities on their row.`)
    } catch (error) {
      this.notify('error', error instanceof Error ? error.message : String(error))
    }
  }
  /** Owner side: drop a peer row (and everything it was granted) from the viewed node. */
  removePeerHere(peerId: string): void {
    if (!this.canApprove()) return
    this.edit(removeMemberAt(this.state.replica, this.peerContextPath(), peerId, this.now()))
  }
  /** Nodes of other accounts this account can send proposals to: market results in the tree (ref rows with an owner), one per node. */
  knownListings(): Array<{ owner: string; aliasId: string; title: string }> {
    const out: Array<{ owner: string; aliasId: string; title: string }> = []
    const walk = (path: Scope) => {
      const node = view(this.state.replica, path)
      if (!node) return
      for (const row of node.tasks) {
        if (row.kind === 'ref' && row.refOwner && row.refId && !out.some((l) => l.owner === row.refOwner && l.aliasId === row.refId)) out.push({ owner: row.refOwner, aliasId: row.refId, title: row.title })
        if (row.childCount) walk([...path, row.id])
      }
    }
    walk([])
    return out
  }
  /**
   * Send a row to another account as a proposed transaction: the row and its requirement, allocation, task and comment
   * children go as one proposal on the target node (an allocation bin: what they must fill, and what they receive).
   * The receiver sees it in that node's link panel and approves it to take the rows in.
   */
  async sendRowTo(at: Scope, row: TaskView, owner: string, aliasId: string): Promise<void> {
    const session = this.state.session
    if (!session || session.kind !== 'user') { this.notify('error', 'Sign in to your account to send rows to other accounts.'); this.openModal('connect'); return }
    if (!this.mayPropose()) { this.notify('error', 'This device does not submit proposals (policy towards fos: add "submit proposals" under "to").'); return }
    const binId = `${row.id}-${session.username}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
    const rows: Array<{ kind: string; text: string; data?: Record<string, unknown>; under?: string; id?: string }> = [
      { kind: row.kind === 'task' ? 'task' : row.kind === 'note' ? 'note' : 'plain', text: row.title || 'allocation bin', id: binId }
    ]
    for (const child of view(this.state.replica, [...this.state.view, ...at, row.id])?.tasks ?? []) {
      if (child.kind === 'requirement' && child.requirement) { const { satisfied: _s, summary: _m, ...requirement } = child.requirement; rows.push({ kind: 'requirement', text: child.title, data: { requirement }, under: binId }) }
      else if (child.kind === 'allocation' && child.allocation) rows.push({ kind: 'allocation', text: child.title, data: { allocation: child.allocation }, under: binId })
      else if (child.kind === 'task' || child.kind === 'plain' || child.kind === 'comment' || child.kind === 'note') rows.push({ kind: child.kind, text: child.title, under: binId })
    }
    try {
      await submitMarketProposal(session, owner, aliasId, rows)
      this.notify('info', `Sent to @${owner} as a proposal with ${rows.length - 1} row${rows.length === 2 ? '' : 's'} inside; they approve it to take it in.`)
    } catch (error) {
      this.notify('error', `Could not send: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  /** Requirements in the viewed subtree assigned to the peer `name` ("-@name …"), with the task they belong to. */
  assignmentsTo(name: string): Array<{ at: Scope; row: TaskView; task: TaskView | null }> {
    const out: Array<{ at: Scope; row: TaskView; task: TaskView | null }> = []
    const walk = (at: Scope, parent: TaskView | null) => {
      const node = view(this.state.replica, [...this.state.view, ...at])
      if (!node) return
      for (const row of node.tasks) {
        if (row.kind === 'requirement' && row.requirement?.capability === 'peer' && row.requirement.peer === name) out.push({ at, row, task: parent })
        if (row.childCount) walk([...at, row.id], row)
      }
    }
    walk([], null)
    return out
  }
  /** Who this device acts as when it confirms: the account username, else the device name. */
  actorName(): string { return this.state.session?.username ?? this.state.deviceName }
  private peerRowReplica(r: Replica, path: Scope, handler: string | undefined): Replica {
    if (!resolveScope(r.store, headCid(r), path)) return r
    const next = updateAtScope(r.store, headCid(r), path, identity => {
      const cid = put(r.store, identity), value = valueContent(r.store, cid)
      const { name: _name, ...data } = identity.data
      return refNodeContent(r.store, { ...data, ...(handler !== undefined ? { name: { content: handler || 'peer' } } : {}) },
        put(r.store, value), [...bookkeepingOf(r.store, identity), [r.store.primitive.previousVersion.getId(), cid]], handler !== undefined ? capabilityTarget(r.store, 'peer') : null)
    }, 'node')
    commitRoot(r.store, next, this.now()); return { ...r }
  }
  attachNamedPeer(name: string): void {
    const peer = this.knownPeers().find(p => p.name === name || p.id === name)
    if (!peer) { this.notify('info', `No available peer handler named “${name}”. Edit the constructor to choose one.`); return }
    this.edit(addMemberAt(this.state.replica, this.peerContextPath(), peer.id, peer.name, ['read', 'edit'], this.now()))
  }
  setPeerRow(path: Scope, handler: string | undefined): void { this.edit(this.peerRowReplica(this.state.replica, path, handler)) }
  newBranchAt(path: Scope): void {
    const row = view(this.state.replica, path.slice(0, -1))?.tasks.find(r => r.id === path.at(-1))
    if (!row) return
    let n = 1; while (row.branches?.names.includes(`branch ${n}`)) n++
    void this.createNodeBranch(path.slice(0, -1), row.id, `branch ${n}`, true).then(() => {
      if (JSON.stringify(path.slice(0, this.state.view.length)) === JSON.stringify(this.state.view)) this.select(path.slice(this.state.view.length))
    })
  }
  toggleBranchMergeRequest(path: Scope, name: string): void {
    if (this.state.voice || this.state.work?.busy || this.evaluating) return
    const row = view(this.state.replica, path.slice(0, -1))?.tasks.find(r => r.id === path.at(-1))
    if (!row?.branches) return
    this.edit(setBranchMergeRequest(this.state.replica, path, name, !row.branches.mergeRequests?.includes(name), this.now()))
  }
  async createNodeBranch(at: Scope, id: string, name: string, absolute = false): Promise<void> {
    if (this.evaluating || this.state.voice || this.state.work?.busy) { this.notify('info', 'Finish the current recording or task before switching branches.'); return }
    try {
      const path = absolute ? [...at, id] : [...this.state.view, ...at, id], info = this.repositoryInfo(path)
      const session = this.state.session, generation = this.authGeneration
      if (info) {
        if (!session || !info.snapshot || !this.canPushRepository(path)) throw new Error('Connect GitHub and refresh this repository first')
        const cid = resolveScope(this.state.replica.store, headCid(this.state.replica), path)!
        const from = isBranchChoice(this.state.replica.store, content(this.state.replica.store, cid)) ? branchSelection(this.state.replica.store, cid) : info.snapshot.defaultBranch
        await createRepositoryBranch(session, info.repo, name, from)
        if (generation !== this.authGeneration || session !== this.state.session || repositoryAt(this.state.replica, path) !== info.repo || !this.canPushRepository(path)) return
      }
      const next = createBranch(this.state.replica, path, name, this.now(), info?.snapshot?.defaultBranch ?? 'main')
      this.branchSelections[id] = name
      this.edit(next)
      this.savePrefs()
      this.set({ selected: null })
    } catch (error) { this.notify('error', String(error)) }
  }
  copyProposalToBranch(proposalId: string, name: string): boolean {
    try {
      const path = this.state.view
      const next = copyProposalBranch(this.state.replica, path, proposalId, name, this.now())
      this.branchSelections[path.at(-1)!] = name; this.edit(next); this.savePrefs(); return true
    } catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)); return false }
  }
  selectNodeBranch(at: Scope, id: string, name: string, absolute = false): void {
    document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
    if (this.evaluating || this.state.voice || this.state.work?.busy) { this.notify('info', 'Finish the current recording or task before switching branches.'); return }
    const path = absolute ? [...at, id] : [...this.state.view, ...at, id]
    const row = view(this.state.replica, path.slice(0, -1))?.tasks.find(row => row.id === id)
    if (!row?.branches?.names.includes(name)) return
    this.branchSelections[id] = name
    selectBranch(this.state.replica.store, id, name)
    this.history.clear()
    this.savePrefs()
    this.set({ selected: null, contextMenu: null, work: undefined })
  }
  mergeNodeBranch(at: Scope, id: string, target: string): void {
    if (repositoryAt(this.state.replica, [...this.state.view, ...at, id])) { void this.proposeRepoMerge([...this.state.view, ...at, id], target); return }
    const row = this.rowAt([...at, id])
    if (!row?.branches) return
    try {
      const next = mergeBranch(this.state.replica, [...this.state.view, ...at, id], row.branches.selected, target, this.now())
      this.branchSelections[id] = target
      this.edit(next)
      this.savePrefs()
    } catch (error) { this.notify('error', String(error)) }
  }
  beginProjectSwitch(): void {
    this.projectSwitching = true
    this.clearTimer('debounce')
    this.authGeneration++
    this.recorder?.stop(); this.recorder = null
    this.set({ voice: null })
    this.history.clear()
    this.set({ selected: null, work: undefined })
  }
  endProjectSwitch(): void {
    this.projectSwitching = false
    if (this.transport()) void this.syncNow('checkout complete')
  }
  hasRepositoryPeer(path: Scope, direction: 'pull' | 'push' = 'pull'): boolean {
    const repo = repositoryAt(this.state.replica, path)
    return !!repo && this.isOnline(repositoryPeerId(repo)) && repositoryPeerAllows(this.state.replica, path, repo, direction)
  }
  canPushRepository(path: Scope): boolean {
    return this.hasRepositoryPeer(path, 'push') && !!this.repositoryInfo(path)?.snapshot?.canPush
  }

  repositoryInfo(path: Scope = this.state.view): { repo: string; snapshot?: RepositorySnapshot } | null {
    const repo = repositoryAt(this.state.replica, path)
    return repo ? { repo, snapshot: this.repositories.get(repo) } : null
  }
  bindNodeRepository(at: Scope, id: string, repo: string, absolute = false): void {
    const path = [...(absolute ? [] : this.state.view), ...at, id]
    try {
      let next = bindRepository(this.state.replica, path, repo.trim(), this.now())
      next = this.withIntegrationPeer(next, path, 'github')
      this.edit(next)
      this.repositoryPollAt = 0
      void this.refreshRepositories()
    } catch (error) { this.notify('error', String(error)) }
  }
  async refreshRepositories(force = false): Promise<void> {
    const session = this.state.session, generation = this.authGeneration
    if (this.projectSwitching || !session || session.kind !== 'user' || this.repositoryBusy || (!force && this.now() - this.repositoryPollAt < 30_000)) return
    if (!this.state.integrations.some(i => i.id === 'github' && i.connected)) return
    const found: Array<{ path: Scope; repo: string }> = []
    const walk = (path: Scope) => {
      const repo = repositoryAt(this.state.replica, path)
      if (repo) {
        if (this.hasRepositoryPeer(path)) found.push({ path, repo })
        return
      }
      for (const row of view(this.state.replica, path)?.tasks ?? []) {
        const child = [...path, row.id]
        if (child.length < 32 && (row.childCount || repositoryAt(this.state.replica, child))) walk(child)
      }
    }
    walk([])
    if (!found.length) return
    this.repositoryBusy = true; this.repositoryPollAt = this.now()
    try {
      for (const { path, repo } of found) {
        const previous = this.repositories.get(repo)
        const beforeCid = resolveScope(this.state.replica.store, headCid(this.state.replica), path)
        const beforeOptions = beforeCid && isBranchChoice(this.state.replica.store, content(this.state.replica.store, beforeCid)) ? readChoice(this.state.replica.store, beforeCid).options : []
        const snapshot = await readRepository(session, repo, previous?.pulls.filter(p => p.state === 'open').map(p => p.number) ?? [])
        if (generation !== this.authGeneration || session !== this.state.session) return
        if (repositoryAt(this.state.replica, path) !== repo || !this.hasRepositoryPeer(path)) continue
        let next = this.state.replica
        const id = path.at(-1)
        if (id) {
          let cid = resolveScope(next.store, headCid(next), path)!
          const priorSelection = isBranchChoice(next.store, content(next.store, cid)) ? branchSelection(next.store, cid) : snapshot.defaultBranch
          for (const branch of snapshot.branches) {
            cid = resolveScope(next.store, headCid(next), path)!
            const names = isBranchChoice(next.store, content(next.store, cid)) ? readChoice(next.store, cid).options.map(o => o.peerId) : [snapshot.defaultBranch]
            if (names.includes(branch.name)) continue
            selectBranch(next.store, id, snapshot.defaultBranch)
            next = createBranch(next, path, branch.name, this.now(), snapshot.defaultBranch)
          }
          selectBranch(next.store, id, priorSelection)
          this.branchSelections[id] = priorSelection
        }
        for (const pull of snapshot.pulls) {
          if (pull.state !== 'merged' || previous?.pulls.find(p => p.number === pull.number)?.state !== 'open' || pull.headRepo.toLowerCase() !== repo.toLowerCase() || !path.length) continue
          const cid = resolveScope(next.store, headCid(next), path)!
          if (!isBranchChoice(next.store, content(next.store, cid))) continue
          const names = readChoice(next.store, cid).options.map(o => o.peerId)
          if (!names.includes(pull.head) || !names.includes(pull.base)) continue
          const selected = branchSelection(next.store, cid)
          const proposed = beforeOptions.find(o => o.peerId === pull.head)
          if (!proposed) continue
          next = mergeBranch(next, path, pull.head, pull.base, this.now(), proposed)
          selectBranch(next.store, path.at(-1)!, selected)
        }
        snapshot.pulls.push(...(previous?.pulls ?? []).filter(p => p.state !== 'open' && !snapshot.pulls.some(current => current.number === p.number)).slice(-100))
        this.repositories.set(repo, snapshot)
        const changed = next !== this.state.replica
        this.set({ replica: next })
        this.savePrefs()
        if (changed) this.scheduleSync()
      }
    } catch (error) { this.notify('error', `Repository sync: ${error instanceof Error ? error.message : String(error)}`) }
    finally { this.repositoryBusy = false }
  }
  async proposeRepoMerge(path: Scope, target: string): Promise<void> {
    const session = this.state.session, info = this.repositoryInfo(path), generation = this.authGeneration
    if (!session || !info || !this.canPushRepository(path)) { this.notify('error', 'Connect your account and GitHub peer first.'); return }
    const cid = resolveScope(this.state.replica.store, headCid(this.state.replica), path)
    if (!cid || !isBranchChoice(this.state.replica.store, content(this.state.replica.store, cid))) return
    const source = branchSelection(this.state.replica.store, cid)
    try {
      const pull = await proposeRepositoryMerge(session, info.repo, source, target, `Merge ${source} into ${target}`)
      if (generation !== this.authGeneration || session !== this.state.session || repositoryAt(this.state.replica, path) !== info.repo || !this.canPushRepository(path)) return
      if (info.snapshot) this.repositories.set(info.repo, { ...info.snapshot, pulls: [...info.snapshot.pulls.filter(p => p.number !== pull.number), pull] })
      this.notify('info', `GitHub PR #${pull.number} opened: ${pull.url}`)
      await this.refreshRepositories(true)
    } catch (error) { this.notify('error', String(error)) }
  }
  repositoryDiff(pull: RepositoryPull): string {
    const r = this.state.replica, cid = resolveScope(r.store, headCid(r), this.state.view)
    if (!cid || !isBranchChoice(r.store, content(r.store, cid))) return 'Connect the branch replicas to compare their Fos tasks.'
    const choice = readChoice(r.store, cid)
    const from = choice.options.find(o => o.peerId === pull.head)?.edge, to = choice.options.find(o => o.peerId === pull.base)?.edge
    if (!from || !to || pull.headRepo.toLowerCase() !== this.repositoryInfo()?.repo.toLowerCase()) return 'External branch: review the code diff on GitHub.'
    const proposal = put(r.store, proposalContent(r.store, 'integration:github', pull.title, identityCid(r.store, from), identityCid(r.store, to), 0))
    const summary = proposalView(r.store, valueContent(r.store, identityCid(r.store, to)), readProposal(r.store, proposal)!).summary
    return [`adds ${summary.added.length}`, `changes ${summary.changed.length}`, `removes ${summary.removed.length}`].join(' · ') + ' Fos rows'
  }
  async decideRepoPull(pull: RepositoryPull, decision: 'merge' | 'close'): Promise<void> {
    const session = this.state.session, info = this.repositoryInfo(), path = [...this.state.view], generation = this.authGeneration
    if (!session || !info || !this.canPushRepository(path)) return
    const reviewedCid = resolveScope(this.state.replica.store, headCid(this.state.replica), path)
    const reviewed = reviewedCid && isBranchChoice(this.state.replica.store, content(this.state.replica.store, reviewedCid)) ? readChoice(this.state.replica.store, reviewedCid).options.find(o => o.peerId === pull.head) : undefined
    try {
      await decideRepositoryPull(session, info.repo, pull.number, decision, pull.sha)
      if (generation !== this.authGeneration || session !== this.state.session || repositoryAt(this.state.replica, path) !== info.repo || !this.canPushRepository(path)) return
      if (decision === 'merge' && reviewed && pull.headRepo.toLowerCase() === info.repo.toLowerCase()) {
        this.edit(mergeBranch(this.state.replica, path, pull.head, pull.base, this.now(), reviewed))
        this.branchSelections[path.at(-1)!] = pull.base
      }
      if (info.snapshot) this.repositories.set(info.repo, { ...info.snapshot, pulls: info.snapshot.pulls.map(p => p.number === pull.number ? { ...p, state: decision === 'merge' ? 'merged' : 'closed' } : p) })
      this.savePrefs()
      this.notify('info', `GitHub PR #${pull.number} ${decision === 'merge' ? 'merged' : 'closed'}.`)
      await this.refreshRepositories(true)
    } catch (error) { this.notify('error', String(error)) }
  }
  /** Reachability is runtime state; keeping a configured peer does not make it available. */
  capabilityAvailable(capability: Capability, path = this.state.view): boolean {
    return capabilityPeers(this.state.replica, path, capability).some(id => this.isOnline(id))
  }

  currentRow(): TaskView | null {
    const path = this.state.view
    const row = path.length ? view(this.state.replica, path.slice(0, -1), true)?.tasks.find(row => row.id === path.at(-1)) ?? null : null
    const key = settingKeyFromName(row?.construction?.name); if (row && key) row.title = SETTING_LABELS[key] ?? key
    return row
  }
  /** The full text editor uses the same three-way merge as cells, preserving remote edits. */
  editCurrentText(text: string, draft: { store: Replica['store']; head: string; path: Scope }): void {
    if (draft.store !== this.state.replica.store || !draft.path.length || draft.path.at(-1) === HOME_ID) return
    const parent = draft.path.slice(0, -1), id = draft.path.at(-1)!
    if (headCid(this.state.replica) === draft.head) { this.edit(renameTask(this.state.replica, parent, id, text, this.now())); return }
    const branch = createReplica(this.state.replica.meta.peerId)
    importNodes(branch.store, reachableNodes(draft.store, [draft.head])); commitRoot(branch.store, draft.head, this.now())
    for (const [id, name] of Object.entries(this.branchSelections)) selectBranch(branch.store, id, name)
    const next = renameTask(branch, parent, id, text, this.now())
    const current = this.state.replica
    importNodes(current.store, reachableNodes(next.store, [headCid(next)]))
    const merged = mergeNodes(current.store, draft.head, headCid(current), headCid(next), { ours: 'Incoming edit', theirs: this.state.deviceName })
    commitRoot(current.store, merged.cid, this.now()); this.edit({ ...current })
    if (merged.newChoiceCids.length) this.notify('info', 'This text changed in two places. Choose which version to keep.')
  }
  destructure(path: Scope, name: string, amount?: number): void {
    try { this.edit(destructureRequirement(this.state.replica, path, name, amount, this.now())) }
    catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)) }
  }
  bindOutputArgument(at: Scope, id: string, cid: string): void {
    const r = this.state.replica, parent = resolveScope(r.store, headCid(r), [...this.state.view, ...at])
    const arg = parent && argumentRefs(r.store, parent).find(a => content(r.store, a.cid).data.alias?.id === id)
    if (!arg || !r.store.table.has(cid) || refTypeCid(r.store, content(r.store, cid)) !== arg.type) { this.notify('error', 'The placeholder has an incompatible type.'); return }
    this.setArgumentValue(at, id, cid)
  }
  linkOutput(path: Scope, cid: string): void {
    try { this.edit(linkRequirementOutput(this.state.replica, path, cid, this.now())) }
    catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)) }
  }
  templateIcon(path: Scope): string {
    const own = readNodeValue<string>(this.state.replica, path, 'fos:icon')
    if (typeof own === 'string') return own
    const row = view(this.state.replica, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1))
    const template = row?.template && resolveRef(this.state.replica, row.template.id)
    const value = template ? readNodeValue<string>(this.state.replica, [...template.path, template.row.id], 'fos:icon') : null
    return typeof value === 'string' ? value : ''
  }
  openTemplatePicker(path: Scope): void {
    document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
    this.set({ templatePicker: { path: [...path] }, modal: 'template', contextMenu: null })
  }
  changeTemplate(kind: RowKind, templateId?: string): void {
    const path = this.state.templatePicker?.path
    if (!path?.length || path.at(-1) === HOME_ID) return
    this.together(() => {
      let r = this.state.replica
      if (templateId) r = instantiateTemplate(r, path.slice(0, -1), path.at(-1)!, templateId, this.now())
      else r = setRowKind(r, path.slice(0, -1), path.at(-1)!, kind, this.now())
      this.edit(r); this.closeModal()
    })
  }
  createLinkedTemplate(name: string, icon: string, inHome: boolean): void {
    const path = this.state.templatePicker?.path
    if (!path?.length || path.at(-1) === HOME_ID) return
    const parent = inHome ? homePath(this.state.replica) : path.slice(0, -1), id = newId(), title = name.trim() || 'Untitled template'
    this.together(() => {
      let r = addRow(this.state.replica, parent, 'template', title, this.now(), { id })
      if (icon.trim()) r = writeNodeValue(r, [...parent, id], 'fos:icon', icon.trim(), this.now())
      r = instantiateTemplate(r, path.slice(0, -1), path.at(-1)!, id, this.now())
      this.edit(r); this.closeModal(); this.goTo([...parent, id])
    })
  }
  handlerOffers(path = this.constructorContext()) {
    return discoverHandlers(this.state.replica, path, { isPeerActive: id => id === this.state.replica.meta.peerId || this.isOnline(id) })
  }
  publishCurrentTemplate(market = false): void {
    if (!this.canApprove() || this.currentRow()?.kind !== 'template') return
    if (market && (!this.state.session || !this.isOnline('fos'))) { this.notify('error', 'Connect to Fos before publishing to the marketplace.'); return }
    try { this.edit(publishTemplate(this.state.replica, this.state.view.slice(0, -1), this.state.view, this.currentRow()!.title, this.now(), market)); this.notify('info', market ? 'This template version is published to the Fos marketplace after sync.' : 'This template version is advertised by this device in its parent context.') }
    catch (error) { this.notify('error', String(error)) }
  }
  constructorEnabled(peerId: string, id: string): boolean {
    const cid = contextMemberRefs(this.state.replica, this.peerContextPath()).get(peerId)
    return !cid || !(content(this.state.replica.store, cid).data.disabledCapabilities?.content ?? []).includes(`fos:constructor:${id}`)
  }
  setConstructorEnabled(peerId: string, id: string, enabled: boolean): void {
    if (!this.canApprove()) return
    let replica = this.state.replica
    if (!contextMemberRefs(replica, this.peerContextPath()).has(peerId)) {
      const provider = this.contextPeers().find(p => p.id === peerId)
      replica = addMemberAt(replica, this.peerContextPath(), peerId, provider?.name ?? peerId, [], this.now())
      replica = setMemberCapabilitiesAt(replica, this.peerContextPath(), peerId, [], [], this.now(), provider?.integration?.provides ?? provider?.accepts ?? [])
    }
    this.edit(setConstructorEnabledAt(replica, this.peerContextPath(), peerId, id, enabled, this.now()))
  }
  toggleHandler(peerId: string, id: string, enabled: boolean): void {
    if (!this.canApprove()) return
    try { this.edit(setHandlerEnabledAt(this.state.replica, this.peerContextPath(), peerId, id, enabled, this.now())) }
    catch (error) { this.notify('error', String(error)) }
  }
  insertHandler(cid: string, path = this.constructorContext()): void {
    const offer = this.handlerOffers(path).find(o => o.cid === cid && o.enabled && o.active)
    if (!offer || offer.type !== this.state.replica.store.primitive.templateField.getId()) throw new Error('This template handler is unavailable.')
    const source = refValueCid(this.state.replica.store, content(this.state.replica.store, offer.cid))
    if (!source) throw new Error('Template is unbound.')
    this.together(() => {
      const id = newId()
      let r = addRow(this.state.replica, path, 'task', offer.label, this.now(), { id })
      r = instantiateTemplateValue(r, path, id, source, this.now())
      this.edit(r)
    })
  }
  constructorContext(): Scope { return this.state.selected ? [...this.state.view, ...this.state.selected] : [...this.state.view] }
  constructorNeeds(path = this.constructorContext()): string[] {
    const row = path.length ? view(this.state.replica, path.slice(0, -1))?.tasks.find(r => r.id === path.at(-1)) : undefined
    const needs: string[] = []
    if (row?.requirement && !row.requirement.satisfied) needs.push(row.requirement.capability === 'allocation' ? row.requirement.resource ?? 'allocation' : row.requirement.capability)
    const cid = resolveScope(this.state.replica.store, headCid(this.state.replica), path)
    if (cid) for (const arg of argumentRefs(this.state.replica.store, cid)) {
      if (arg.name?.startsWith('fos:') || refValueCid(this.state.replica.store, content(this.state.replica.store, arg.cid))) continue
      needs.push(CAPABILITIES.find(c => capabilityTarget(this.state.replica.store, c) === arg.type) ?? content(this.state.replica.store, arg.type).data.name?.content?.replace('fos:type:', '') ?? '')
    }
    return needs
  }
  addPullConstructor(path = this.constructorContext()): Scope {
    const peer = this.pullPeers()[0]
    if (!peer) throw new Error('Connect a document peer before adding Pull.')
    return this.applyConstructor(path, { kind: 'requirement', text: `Pull from ${peer.name}`, done: false, extras: { requirement: { capability: 'tool', tool: 'fos.pull', peer: peer.id } } })
  }
  /** Palette input uses the same row documents as typed input; no separate palette model. */
  applyConstructor(path: Scope, parsed: import('./rows').ParsedInput, replace = false, repo?: string, localDirectory?: string): Scope {
    if (!view(this.state.replica, path)) throw new Error('The destination no longer exists.')
    const current = path.length ? view(this.state.replica, path.slice(0, -1))?.tasks.find(row => row.id === path.at(-1)) : undefined
    replace = replace && !!current && current.id !== HOME_ID && current.kind !== 'requirement'
    const parent = replace ? path.slice(0, -1) : path, id = replace ? path.at(-1)! : newId(), target = [...parent, id]
    if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Use owner/repository.')
    if (localDirectory) {
      const cid = resolveScope(this.state.replica.store, headCid(this.state.replica), target)
      if (cid && argumentRefs(this.state.replica.store, cid).some(a => a.name === 'local-repository')) throw new Error('This node already has a local repository; edit its local-repository argument to change the path.')
    }
    const allocation = parsed.extras?.allocation
    if (allocation?.resource && !this.banks().some(b => b.row.id === allocation.resource && b.row.resource.type === allocation.type)) throw new Error('The source bank is unavailable or has a different resource type.')
    const parentCid = path.length && resolveScope(this.state.replica.store, headCid(this.state.replica), path.slice(0, -1))
    const argument = parentCid && argumentRefs(this.state.replica.store, parentCid).find(a => content(this.state.replica.store, a.cid).data.alias?.id === path.at(-1))
    const suppliedType = localDirectory ? capabilityTarget(this.state.replica.store, 'repo') : parsed.peer !== undefined ? capabilityTarget(this.state.replica.store, 'peer') : parsed.kind === 'requirement' && parsed.extras?.requirement && CAPABILITIES.includes(parsed.extras.requirement.capability as Capability) ? capabilityTarget(this.state.replica.store, parsed.extras.requirement.capability as Capability) : parsed.kind === 'allocation' ? put(this.state.replica.store, { data: { name: { content: 'fos:type:allocation' } }, children: [] }) : repo ? capabilityTarget(this.state.replica.store, 'repo') : null
    if (argument && argument.type !== suppliedType) throw new Error('Choose a constructor matching this input type.')
    if (repo && repositoryAt(this.state.replica, target) && repositoryAt(this.state.replica, target) !== repo) throw new Error('Edit the existing repository argument to change its repository.')
    this.together(() => {
      let r = this.state.replica
      if (replace && current?.construction?.handler) r = this.peerRowReplica(r, target, undefined)
      r = replace ? setRowContentAt(r, parent, id, parsed.kind, parsed.text, parsed.extras ?? {}, this.now()) : addRow(r, parent, parsed.kind, parsed.text, this.now(), { id, done: parsed.done, ...parsed.extras })
      if (parsed.peer !== undefined) r = this.peerRowReplica(r, target, parsed.peer)
      if (repo) { r = bindRepository(r, target, repo, this.now()); r = this.withIntegrationPeer(r, target, 'github') }
      if (localDirectory) {
        const peer = `git:${r.meta.peerId}:${encodeURIComponent(localDirectory)}`
        r = addRefAt(r, target, 'fos:local-repository', capabilityTarget(r.store, 'repo'), this.now(), put(r.store, { data: { description: { content: JSON.stringify({ path: localDirectory, device: r.meta.peerId, peer }) } }, children: [] }), 'local-repository')
        r = addMemberAt(r, target, peer, 'Local Git', ['repo'], this.now())
        r = setMemberCapabilitiesAt(r, target, peer, ['repo'], [], this.now(), ['repo'])
      }
      if (argument) {
        const value = resolveScope(r.store, headCid(r), target)!
        const proposed = proposeRefAt(r, path, value, r.meta.peerId, this.now())
        r = applyProposalAt(proposed.replica, path, proposed.proposalCid, r.meta.peerId, this.now())
      }
      this.edit(r)
    })
    if (repo) { this.repositoryPollAt = 0; void this.refreshRepositories() }
    return target
  }
  changeCurrentKind(kind: RowKind): void {
    const path = this.state.view
    if (path.length && path.at(-1) !== 'fos:home') this.edit(setRowKind(this.state.replica, path.slice(0, -1), path.at(-1)!, kind, this.now()))
  }
  searchLocalNodes(query: string, kind?: RowKind): Array<{ row: TaskView; path: Scope }> {
    const found: Array<{ row: TaskView; path: Scope }> = [], visited = new Set<string>()
    const walk = (path: Scope) => {
      if (path.length > 64 || visited.size > 5000) return
      for (const row of view(this.state.replica, path)?.tasks ?? []) {
        if (visited.has(row.id)) continue
        visited.add(row.id)
        const full = [...path, row.id]
        if ((!kind || row.kind === kind) && row.title.toLowerCase().includes(query.toLowerCase()) && row.kind !== 'ref' && !this.state.view.includes(row.id)) found.push({ row, path: full })
        if (row.childCount) walk(full)
      }
    }
    walk([]); return found.slice(0, 50)
  }
  canLinkNode(id: string, destination = this.state.view): boolean {
    const target = resolveRef(this.state.replica, id)?.row
    if (!target || destination.includes(id)) return false
    const req = destination.length ? view(this.state.replica, destination.slice(0, -1))?.tasks.find(row => row.id === destination.at(-1))?.requirement : null
    if (!req) return true
    if (req.capability === 'allocation') return target.kind === 'allocation' && allocationMatches(req, target.allocation)
    if (req.capability === 'task') return target.kind === 'task' && target.done
    if (req.capability === 'search') return target.kind === 'query' && !!target.query?.executedAt
    return false
  }
  linkNode(id: string, destination = this.state.view): void {
    if (!this.canLinkNode(id, destination)) { this.notify('error', 'This value does not match the destination requirement.'); return }
    const req = destination.length ? view(this.state.replica, destination.slice(0, -1))?.tasks.find(row => row.id === destination.at(-1))?.requirement : null
    this.edit(req ? addSupply(this.state.replica, destination.slice(0, -1), destination.at(-1)!, { capability: req.capability, by: this.actorName(), ref: id }, this.now()) : addRef(this.state.replica, destination, id, this.now()))
  }
  private evaluationBranches(path: Scope): Record<string, string> {
    const r = this.state.replica
    return { ...r.meta.branches, ...(r.meta.branch && r.meta.scope.length ? { [r.meta.scope.at(-1)!]: r.meta.branch } : {}), ...scopeBranches(r.store, headCid(r), path) }
  }
  execution: { path: Scope; store: Replica['store'] } | null = null
  executionPath(): Scope | null {
    return this.execution?.store === this.state.replica.store && JSON.stringify(this.execution.path) === JSON.stringify(this.state.view) ? this.execution.path : null
  }
  registerLocalGitPeer(root: Scope, directory: string): void {
    const data = readNodeValue<{ path: string; device: string; peer?: string }>(this.state.replica, root, 'local-repository')
    if (!data || data.peer || data.device !== this.state.replica.meta.peerId || data.path !== directory) return
    const peer = `git:${data.device}:${encodeURIComponent(directory)}`
    let r = writeNodeValue(this.state.replica, root, 'local-repository', { ...data, peer }, this.now())
    r = addMemberAt(r, root, peer, 'Local Git', ['repo'], this.now())
    this.edit(setMemberCapabilitiesAt(r, root, peer, ['repo'], [], this.now(), ['repo']))
  }
  addFeatureSpecification(parent: Scope): void {
    const result = addSpecification(this.state.replica, parent, 'Feature specification', this.now())
    this.edit(result.replica); this.goTo(result.path)
  }
  importFeatureSpecifications(root: Scope, specifications: FeatureSpecification[]): void { this.edit(importSpecifications(this.state.replica, root, specifications, this.now())) }
  queueFeatureVerification(root: Scope, commit: string, branch: string): void { this.edit(queueSpecificationVerification(this.state.replica, root, commit, branch, this.now())) }
  recordFeatureVerification(root: Scope, report: { commit: string; specifications: FeatureSpecification[]; results: Array<{ id: string; status: string; evidence: string }> }): void {
    const current = specificationRows(this.state.replica, root)
    if (JSON.stringify(current) !== JSON.stringify(report.specifications)) throw new Error('Specifications changed during verification. Run again.')
    const valid = new Set(current.map(spec => spec.id))
    if (report.results.length !== valid.size || new Set(report.results.map(result => result.id)).size !== valid.size || report.results.some(result => !valid.has(result.id) || !['pass', 'fail', 'blocked'].includes(result.status) || typeof result.evidence !== 'string' || !result.evidence.trim() || result.evidence.length > 16000)) throw new Error('Provide one pass, fail, or blocked result with evidence for every specification.')
    const prior = readNodeValue(this.state.replica,root,`fos:verification-result:${report.commit}`)
    if (prior) throw new Error('Results for this commit have already been recorded.')
    let r = writeNodeValue(this.state.replica, root, `fos:verification-result:${report.commit}`, report, this.now())
    const queued = readNodeValue(r,root,`fos:verification:${report.commit}`) as {task?: string} | null
    if (queued?.task) { const path=[...root,queued.task]; const request=readNodeValue(r,path,'fos:verification-request'); if(request) r=writeNodeValue(r,path,'fos:verification-request',{...request as object,status:'reviewed'},this.now()) }
    for (const result of report.results.filter(item => item.status !== 'pass')) {
      const id = newId(); r = addTask(r, root, `${result.status === 'fail' ? 'Issue' : 'Blocked verification'}: ${current.find(spec => spec.id === result.id)!.text.split('\n')[0]}`, this.now(), id)
      r = writeNodeValue(r, [...root, id], 'fos:verification-issue', { commit: report.commit, specification: result.id, evidence: result.evidence }, this.now())
      r = addRow(r, [...root,id], 'note', result.evidence, this.now())
    }
    this.edit(r)
  }
  async startExecution(path: Scope): Promise<void> {
    const row = path.length ? view(this.state.replica, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1)) : null
    if (row?.kind === 'template' && row.id !== HOME_ID) {
      const id = newId(), parent = path.slice(0, -1)
      let r = addTask(this.state.replica, parent, row.title, this.now(), id)
      r = instantiateTemplate(r, parent, id, row.id, this.now())
      this.edit(r); path = [...parent, id]
    }
    this.goTo(path)
    this.execution = { path: [...this.state.view], store: this.state.replica.store }
    this.refresh()
  }
  /**
   * One event of the grammar against this device's replica (the desktop loopback endpoints and local agents). The
   * principal comes from the transport; owners' evaluations run through this app's own evaluator.
   */
  async dispatchLocalEvent(principal: Principal, event: FosEvent): Promise<unknown> {
    const dispatched = dispatchEvent(this.state.replica, event, principal, this.now())
    if (dispatched.changed) { this.edit(dispatched.replica); this.scheduleSync(); await this.config.storage.flush?.() }
    if (dispatched.evaluate) {
      if (this.evaluating) throw new Error('Evaluation is running.')
      const path = dispatched.evaluate.path
      if (JSON.stringify(path) === JSON.stringify(this.executionPath())) {
        const snapshot = executionSnapshot(this.state.replica, path)
        if (snapshot.inputs.length || !['idle', 'rolled-back', 'awaiting-review'].includes(snapshot.status)) throw new Error('Satisfy the evaluation\'s current inputs before completing it.')
        await this.finishExecution()
      } else await this.evaluateAt(path, true)
      await this.config.storage.flush?.()
      return executionSnapshot(this.state.replica, path)
    }
    return dispatched.result
  }
  executionTimeEntries(): Array<{ start: number; end?: number; notes: string }> {
    const path = this.executionPath()
    return path ? readNodeValue(this.state.replica, path, 'fos:execution-time') ?? [] : []
  }
  setExecutionTimeNotes(notes: string): void {
    const path = this.executionPath(), entries = this.executionTimeEntries()
    const active = entries.find(entry => entry.end === undefined)
    if (!path || !active || this.evaluating) return
    active.notes = notes
    this.edit(writeNodeValue(this.state.replica, path, 'fos:execution-time', entries, this.now()))
  }
  toggleExecutionTimer(notes: string): void {
    const path = this.executionPath()
    if (!path || this.evaluating) return
    const entries = this.executionTimeEntries(), active = entries.find(entry => entry.end === undefined)
    if (active) { active.end = this.now(); active.notes = notes }
    else {
      if (this.evaluationStatus(path)?.status === 'committed') return
      entries.push({ start: this.now(), notes })
    }
    this.edit(writeNodeValue(this.state.replica, path, 'fos:execution-time', entries, this.now()))
  }
  async finishExecution(abort = false): Promise<void> {
    const path = this.executionPath()
    if (!path || this.evaluating) return
    const active = this.executionTimeEntries().find(entry => entry.end === undefined)
    if (active) this.toggleExecutionTimer(active.notes)
    if (abort) {
      const record = this.evaluationStatus(path)
      if (record && record.status !== 'committed') this.edit(writeNodeValue(this.state.replica, path, 'fos:evaluation', { ...record, status: 'rolled-back', error: 'Aborted by user' }, this.now()))
      this.exitExecution()
    } else await this.evaluateAt(path)
  }
  consumeExecutionAllocation(path: Scope, amount: number): void {
    const root = this.executionPath()
    if (!root || !root.every((id, i) => path[i] === id) || !Number.isFinite(amount) || amount < 0) return
    const row = view(this.state.replica, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1))
    const status = this.evaluationStatus(root)?.status
    if (!row?.allocation || amount > row.allocation.amount || this.evaluating || status && status !== 'idle' && status !== 'rolled-back' && status !== 'awaiting-review' || readNodeValue(this.state.replica, path, 'fos:consumed')) return
    this.edit(writeNodeValue(this.state.replica, path, 'fos:consumed', { peer: this.state.replica.meta.peerId, value: { ...row.allocation, amount }, time: this.now() }, this.now()))
  }
  exitExecution(): void { this.execution = null; this.refresh() }
  evaluating = false
  evaluationStatus(path = this.state.view) { return evaluationRecord(this.state.replica, path) }
  addEvaluationConstructor(path: Scope): void {
    if (evaluationRecord(this.state.replica, path)) return
    this.edit(writeNodeValue(this.state.replica, path, 'fos:evaluation', { id: crypto.randomUUID(), status: 'idle', started: this.now(), effects: [] }, this.now()))
  }
  async evaluateCurrent(): Promise<void> { await this.evaluateAt(this.currentRow()?.construction?.name === 'fos:evaluation' ? this.state.view.slice(0, -1) : [...this.state.view]) }
  /** Requirements the account server's handler registry executes: its own model, the integration peers' repositories and calendar, attached MCP tools. */
  private serverHandles(step: import('../../shared/sync/evaluation').EvaluationStep): boolean {
    const r = step.row?.requirement
    if (!r || r.satisfied) return false
    if (r.capability === 'llm' || r.capability === 'repo' || r.capability === 'market') return true
    if (r.capability === 'tool') return r.tool !== 'fos.pull'
    // a poll resolves its choice on the server (the fos poll handler tallies the responses)
    if (r.capability === 'choice') return !!readNodeValue(this.state.replica, step.path, 'fos:poll')
    if (r.capability === 'allocation' && r.resource === 'points') return true
    return r.capability === 'allocation' && (r.resource === 'calendar' || r.resource === 'person') && r.start !== undefined && capabilityPeers(this.state.replica, step.path, 'calendar').some(p => p.startsWith('integration:'))
  }
  async evaluateAt(path: Scope, triggered = false): Promise<void> {
    if (!triggered) document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
    if (this.evaluating) { if (triggered) throw new Error('Another evaluation is running.'); return }
    this.evaluating = true; this.refresh()
    const store = this.state.replica.store, generation = this.authGeneration
    const valid = () => { if (this.state.replica.store !== store || generation !== this.authGeneration) throw new Error('The data session changed during evaluation.') }
    try {
      const localPull = (step: import('../../shared/sync/evaluation').EvaluationStep) => step.row?.requirement?.tool === 'fos.pull'
      const needsServer = evaluationSteps(this.state.replica, path).some(step => this.serverHandles(step))
      if (needsServer && evaluationSteps(this.state.replica, path).some(localPull)) throw new Error('Evaluate local Pull separately from server integration effects.')
      if (needsServer) {
        if (!this.isOnline('fos') || this.state.session?.kind !== 'user' || this.virtualIdentity) throw new Error('Connect to the account server to evaluate integration effects.')
        await this.syncNow('before evaluation'); valid()
        if (isDirty(this.state.replica) || !this.isOnline('fos')) throw new Error('Sync these changes before evaluating them.')
        const r = this.state.replica, cid = resolveScope(r.store, headCid(r), path)
        if (!cid) throw new Error('The node no longer exists.')
        try {
          const answer = await evaluateOnServer(this.state.session!, [...r.meta.scope, ...path], put(r.store, valueContent(r.store, cid)), this.evaluationBranches(path))
          if (answer.status === 'requested') {
            // Another peer owns this node: the request waits on their rules; this node continues when they answer.
            this.edit(requestContinuation(this.state.replica, path, { request: answer.request, node: answer.node.slice(r.meta.scope.length), requestedAt: this.now() }, this.now()))
            this.notify('info', 'Evaluation requested from the node\'s owner. This node continues automatically when they answer.')
          }
        }
        finally { if (generation === this.authGeneration) await this.syncNow('evaluation results') }
        valid()
        return
      }
      const record = await evaluateNode(path, {
        get: () => { valid(); return this.state.replica },
        save: async replica => { valid(); this.set({ replica }); await this.config.storage.flush?.(); valid(); this.scheduleSync() },
        now: () => this.now(), isPeerActive: id => this.isOnline(id), handles: localPull,
        check: step => localPull(step) && !this.pullPeers().some(p => p.id === step.row?.requirement?.peer) ? ['The Pull peer is not connected.'] : [],
        effect: async step => {
          if (!localPull(step)) throw new Error('No local handler for this constructor.')
          if (this.syncInFlight) throw new Error('Wait for current sync to finish before evaluating Pull.')
          await this.syncNow('evaluate pull', true); valid()
          if (this.state.connection !== 'online') throw new Error('Pull failed; review the sync status.')
          this.set({ replica: addSupply(this.state.replica, step.path.slice(0, -1), step.path.at(-1)!, { capability: 'tool', by: this.state.replica.meta.peerId, ref: 'unit' }, this.now()) })
        }
      })
      if (record.status !== 'committed' && record.status !== 'awaiting-review') throw new Error(record.error ?? 'Evaluation needs recovery.')
    } catch (error) { if (triggered) throw error; this.notify('error', error instanceof Error ? error.message : String(error)) }
    finally { this.evaluating = false; this.refresh() }
  }
  async recoverCurrentEvaluation(path = [...this.state.view]): Promise<void> {
    if (this.evaluating) return
    const r = this.state.replica, generation = this.authGeneration
    try {
      if (this.state.session?.kind === 'user' && !this.virtualIdentity && this.isOnline('fos')) {
        await this.syncNow('before recovery')
        if (r.store !== this.state.replica.store || generation !== this.authGeneration) throw new Error('The data session changed during recovery.')
        if (isDirty(this.state.replica)) throw new Error('Sync these changes before recovery.')
        const cid = resolveScope(r.store, headCid(this.state.replica), path)
        if (!cid) return
        try { await evaluateOnServer(this.state.session, [...r.meta.scope, ...path], put(r.store, valueContent(r.store, cid)), this.evaluationBranches(path), 'recover') }
        finally { await this.syncNow('recovery results') }
      } else {
        if (evaluationRecord(r, path)?.effects.length) throw new Error('Reconnect to the executor before recovering external effects.')
        this.set({ replica: recoverEvaluation(r, path, this.now()) })
      }
      this.notify('info', 'Complete each manual recovery task, then choose Review recovery again to unlock evaluation.')
    } catch (error) { this.notify('error', String(error)) }
  }
  retryCurrentTrigger(): void {
    const state = this.currentTriggerState()
    if (!state) return
    const evaluation = evaluationRecord(this.state.replica, state.target)
    if (evaluation && !['idle', 'committed', 'rolled-back', 'awaiting-review'].includes(evaluation.status)) {
      this.goTo(state.target); this.notify('info', 'Review recovery before rearming this trigger.'); return
    }
    this.edit(writeNodeValue(this.state.replica, this.state.view, 'fos:trigger-state', { ...state, occurrence: '', status: 'finished', error: undefined }, this.now()))
  }
  currentTrigger() { return nodeTrigger(this.state.replica, this.state.view) }
  currentTriggerState() { return triggerState(this.state.replica, this.state.view) }
  triggerKinds(path = this.state.view): TriggerKind[] {
    const peers = this.contextPeers(path), device = peers.find(p => p.id === this.state.replica.meta.peerId), server = peers.find(p => p.name === 'fos')
    return [...(navigator.locks ? (['timer', 'task-completion', 'request'] as TriggerKind[]).filter(kind => !device?.disabled.includes(kind)) : []), ...(this.isOnline('fos') && this.serverOffers().includes('cron') && !server?.disabled.includes('cron') ? ['cron' as const] : [])]
  }
  configureTrigger(kind: TriggerKind, value?: string, newTemplate = false, destination = this.state.view, enabled = true): void {
    try {
      const peer = kind === 'cron' ? 'fos' : this.state.replica.meta.peerId
      if (!this.triggerKinds(destination).includes(kind)) throw new Error('The trigger provider is not active.')
      if (kind === 'cron') cronMatches(value ?? '', this.now())
      if (kind === 'timer' && (!Number.isFinite(Date.parse(value ?? '')) || Date.parse(value!) < this.now())) throw new Error('Choose a future time.')
      const source = this.state.replica, parentCid = destination.length && resolveScope(source.store, headCid(source), destination.slice(0, -1))
      const arg = newTemplate && parentCid && argumentRefs(source.store, parentCid).find(a => content(source.store, a.cid).data.alias?.id === destination.at(-1))
      if (arg && arg.type !== capabilityTarget(source.store, kind)) throw new Error('Choose a trigger matching this input type.')
      let r = source
      if (peer === 'fos') {
        const member = view(r, [])?.members.find(m => m.peerId === 'fos')
        if (member) r = setMemberCapabilitiesAt(r, [], 'fos', member.capabilities, member.disabled ?? [], this.now(), [...new Set([...(member.accepts ?? []), 'cron'] as Capability[])])
      } else {
        const home = homePath(r), member = view(r, home)?.members.find(m => m.peerId === peer)
        if (!member) r = addMemberAt(r, home, peer, this.state.deviceName, [], this.now())
        r = setMemberCapabilitiesAt(r, home, peer, member?.capabilities ?? [], member?.disabled ?? [], this.now(), [...new Set([...(member?.accepts ?? []), 'timer', 'task-completion', 'request'] as Capability[])])
      }
      const trigger = { kind, peer, enabled, created: this.now(), ...(kind === 'timer' ? { due: Date.parse(value ?? '') } : {}), ...(kind === 'cron' ? { expression: value ?? '' } : {}) }
      let path = [...destination]
      if (newTemplate && view(r, destination.slice(0, -1))?.tasks.find(row => row.id === destination.at(-1))?.kind !== 'template') {
        const id = newId(); r = addRow(r, destination, 'template', `${kind} workflow`, this.now(), { id }); path = [...destination, id]
      }
      r = setNodeTrigger(r, path, trigger, this.now())
      if (arg) {
        const proposed = proposeRefAt(r, destination, resolveScope(r.store, headCid(r), path)!, r.meta.peerId, this.now())
        r = applyProposalAt(proposed.replica, destination, proposed.proposalCid, r.meta.peerId, this.now())
      }
      this.edit(r)
      if (newTemplate) this.notify('info', 'Trigger workflow created. Add the tasks and requirements to run inside it.')
      this.notify('info', !enabled ? 'Trigger created paused. Add its children, then enable it.' : kind === 'cron' ? 'Cron configured on fos (UTC).' : 'Trigger configured on this device; it runs while this app is open.')
    } catch (error) { this.notify('error', String(error)) }
  }
  toggleTrigger(): void {
    const trigger = this.currentTrigger()
    if (!trigger) return
    this.edit(writeNodeValue(this.state.replica, this.state.view, 'fos:trigger', { ...trigger, enabled: !trigger.enabled }, this.now()))
  }
  async runTriggers(): Promise<void> {
    if (this.runningTriggers || this.evaluating || this.projectSwitching || !navigator.locks) return
    const scanKey = headCid(this.state.replica) + JSON.stringify(this.branchSelections)
    if (scanKey !== this.triggerScanKey) { this.triggerScanKey = scanKey; this.triggerCandidates = configuredTriggers(this.state.replica) }
    const due = this.triggerCandidates.some(({ path, trigger }) => {
      if (!trigger.enabled || trigger.peer !== this.state.replica.meta.peerId || trigger.kind === 'cron') return false
      const prior = triggerState(this.state.replica, path)
      if (prior && prior.status !== 'finished') return false
      const occurrence = triggerOccurrence(this.state.replica, path, trigger, this.now())
      return occurrence ? occurrence !== prior?.occurrence : trigger.kind === 'task-completion' && !!prior?.occurrence
    })
    if (!due) return
    this.runningTriggers = true
    const store = this.state.replica.store
    try {
      await navigator.locks.request(`fos:triggers:${this.state.replica.meta.peerId}`, { ifAvailable: true }, async lock => {
        if (!lock) return
        const persisted = loadReplica(this.config.storage.loadReplica())
        for (const [id, name] of Object.entries(this.branchSelections)) selectBranch(persisted.store, id, name)
        await runNodeTriggers({
        get: () => { if (this.state.replica.store !== store) throw new Error('Data session changed'); return this.state.replica },
        save: async replica => { if (this.state.replica.store !== store) throw new Error('Data session changed'); this.set({ replica }); await this.config.storage.flush?.(); this.scheduleSync() },
        now: () => this.now(),
        available: (peer, kind, path) => {
          if (peer !== this.state.replica.meta.peerId || kind === 'cron' || !capabilityPeers(this.state.replica, path, kind).includes(peer)) return false
          const saved = triggerState(persisted, path), current = nodeTrigger(this.state.replica, path)
          const own = triggerState(this.state.replica, path)
          if (kind === 'request' && saved && current && triggerOccurrence(persisted, path, current, this.now()) !== triggerOccurrence(this.state.replica, path, current, this.now())) return false
          if (saved && saved.occurrence !== own?.occurrence && (saved.status !== 'finished' || (current && saved.occurrence === triggerOccurrence(this.state.replica, path, current, this.now())))) return false
          return true
        },
        evaluate: path => this.evaluateAt(path, true)
        })
      })
    } catch (error) { this.notify('error', String(error)) }
    finally { this.runningTriggers = false }
  }
  textArguments(at: Scope) {
    const path = [...this.state.view, ...at], r = this.state.replica
    const cid = resolveScope(r.store, headCid(r), path)
    if (!cid) return []
    return argumentRefs(r.store, cid).filter(arg => arg.type === r.store.primitive.documentField.getId() && !content(r.store, arg.cid).data.ref && content(r.store, arg.cid).data.name?.content && !arg.name?.startsWith('fos:')).map(arg => {
      const result = resolveText(r, path, `{{${arg.name}}}`)
      return { id: content(r.store, arg.cid).data.alias!.id, name: arg.name!, text: result.bindings[0]?.status === 'ready' ? result.text : '', problems: result.bindings.flatMap(b => b.problems) }
    })
  }
  private setArgumentValue(at: Scope, id: string, value: string): void {
    const r = this.state.replica, path = [...this.state.view, ...at, id]
    const proposed = proposeRefAt(r, path, value, r.meta.peerId, this.now())
    const next = applyProposalAt(proposed.replica, path, proposed.proposalCid, r.meta.peerId, this.now())
    const cid = resolveScope(next.store, headCid(next), path)
    const branches = cid && refBranches(next.store, content(next.store, cid))
    if (branches) this.branchSelections[branches.id] = branches.selected
    this.edit(next); this.savePrefs()
  }
  setTextArgument(at: Scope, id: string, text: string): void {
    this.setArgumentValue(at, id, put(this.state.replica.store, { data: { description: { content: text } }, children: [] }))
  }
  addTextArgument(at: Scope, name: string, text: string): void {
    if (!/^[A-Za-z_][\w.-]*$/.test(name)) { this.notify('error', 'Use letters, digits, underscores, dots or hyphens for the argument name.'); return }
    const store = this.state.replica.store
    const value = text ? put(store, { data: { description: { content: text } }, children: [] }) : null
    this.edit(addRefAt(this.state.replica, [...this.state.view, ...at], newId(), store.primitive.documentField.getId(), this.now(), value, name))
    this.notify('info', `Text argument ${name} added. Use {{${name}}} in notes in this context.`)
  }
  addPlaceholder(name: string, typeName: string, destination = this.state.view): void {
    if (!/^[A-Za-z_][\w.-]*$/.test(name) || !typeName.trim()) { this.notify('error', 'Give the placeholder a name and type.'); return }
    const r = this.state.replica
    const template = typeName.startsWith('template:') ? resolveRef(r, typeName.slice(9)) : null
    const type = template ? resolveScope(r.store, headCid(r), [...template.path, template.row.id])! : typeName === 'text' ? r.store.primitive.documentField.getId() : CAPABILITIES.includes(typeName as Capability) ? capabilityTarget(r.store, typeName as Capability) : put(r.store, { data: { name: { content: `fos:type:${typeName.trim()}` } }, children: [] })
    this.edit(addRefAt(r, destination, newId(), type, this.now(), null, name))
  }
  placeholders(at: Scope = []) {
    const path = [...this.state.view, ...at]
    const r = this.state.replica, cid = resolveScope(r.store, headCid(r), path)
    if (!cid) return []
    const candidates = contextBindings(r, path, { isPeerActive: id => this.isOnline(id) })
    return argumentRefs(r.store, cid).filter(a => !a.name?.startsWith('fos:')).map(a => ({
      id: content(r.store, a.cid).data.alias!.id, name: a.name ?? 'Value',
      branches: refBranches(r.store, content(r.store, a.cid)),
      child: (() => { const target = refValueCid(r.store, content(r.store, a.cid)); return target && refTypeCid(r.store, content(r.store, target)) === a.type ? content(r.store, target).data.name?.content ?? 'Value' : null })(),
      type: a.type === r.store.primitive.documentField.getId() ? 'text' : (CAPABILITIES.find(c => capabilityTarget(r.store, c) === a.type) ?? content(r.store, a.type).data.name?.content ?? 'Named type').replace(/^fos:(capability|type):/, ''),
      status: resolveBinding(r.store, a.type, refValueCid(r.store, content(r.store, a.cid)), candidates, a.name, { isPeerActive: id => this.isOnline(id) }).status,
      candidates: candidates.filter(c => c.type === a.type && c.cid !== a.cid).map(c => ({ cid: c.cid, label: c.name ?? content(r.store, c.cid).data.description?.content ?? 'Matching handler' }))
    }))
  }
  selectArgumentBranch(at: Scope, id: string, name: string): void {
    const branches = this.placeholders(at).find(p => p.id === id)?.branches
    if (!branches?.names.includes(name)) return
    document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
    selectBranch(this.state.replica.store, branches.id, name)
    this.branchSelections[branches.id] = name; this.savePrefs(); this.refresh()
  }
  bindPlaceholder(id: string, cid: string, at: Scope = []): void {
    if (!this.placeholders(at).some(p => p.id === id && p.candidates.some(c => c.cid === cid))) return
    this.setArgumentValue(at, id, cid)
  }
  createArgumentChild(id: string): void {
    const r = this.state.replica, parent = resolveScope(r.store, headCid(r), this.state.view)
    if (!parent) return
    const arg = argumentRefs(r.store, parent).find(a => content(r.store, a.cid).data.alias?.id === id)
    if (!arg || refValueCid(r.store, content(r.store, arg.cid))) return
    const child = put(r.store, refNodeContent(r.store, { alias: { id: newId() }, name: { content: `${arg.name ?? 'Value'} child` } }, null, [], arg.type))
    this.setArgumentValue([], id, child)
  }
  dropArgument(at: Scope, id: string, sourceId: string): void {
    const arg = this.placeholders(at).find(p => p.id === id)
    if (!arg || sourceId === id) return
    const store = this.state.replica.store
    const candidate = arg.candidates.find(c => c.cid === sourceId || content(store, c.cid).data.alias?.id === sourceId)
    if (candidate) { this.bindPlaceholder(id, candidate.cid, at); return }
    const source = resolveRef(this.state.replica, sourceId)
    if (arg.type === 'text' && source && ['plain', 'note', 'comment'].includes(source.row.kind)) {
      const cid = resolveScope(store, headCid(this.state.replica), [...source.path, source.row.id])
      if (cid) {
        this.setArgumentValue(at, id, cid)
        return
      }
    }
    this.notify('error', 'Drop a value with the matching argument type.')
  }
  subtasksAvailability(at: Scope) {
    return workHandler(this.state.replica, [...this.state.view, ...at], { isPeerActive: id => this.isOnline(id) })
  }
  generateSubtasks(at: Scope): void {
    try {
      if (this.subtasksAvailability(at).status !== 'ready') throw new Error('Connect an active language-model peer first.')
      const result = addSubtasksTemplate(this.state.replica, [...this.state.view, ...at], this.now())
      this.edit(result.replica)
      this.openWork(at, result.requestId)
    } catch (error) { this.notify('error', String(error)) }
  }
  addWorkTemplate(at: Scope, id: string): void {
    try {
      this.edit(addPlanningTemplate(this.state.replica, [...this.state.view, ...at, id], this.now()))
      this.set({ collapsed: this.state.collapsed.filter((c) => c !== id) })
      this.notify('info', 'Fill in the specification and acceptance examples, then confirm readiness and preview the agent context.')
    } catch (error) { this.notify('error', String(error)) }
  }
  openWork(at: Scope, id: string, absolute = false): void {
    if (this.state.work?.busy) { this.notify('info', 'An agent request is still running.'); return }
    try {
      const path = absolute ? [...at, id] : [...this.state.view, ...at, id]
      this.set({ work: { path, preview: taskWorkContext(this.state.replica, path), busy: false }, modal: 'work', contextMenu: null })
    } catch (error) { this.notify('error', String(error)) }
  }
  refreshWork(): void {
    const work = this.state.work
    if (!work || work.busy) return
    try { this.set({ work: { ...work, preview: taskWorkContext(this.state.replica, work.path), error: undefined } }) }
    catch (error) { this.set({ work: { ...work, error: String(error) } }) }
  }
  async runWork(): Promise<void> {
    const work = this.state.work, session = this.state.session
    if (!work || work.busy) return
    if (!session || session.kind !== 'user') { this.notify('error', 'Sign in to use the fos model.'); return }
    this.set({ work: { ...work, busy: true, error: undefined } })
    try {
      const handler = workHandler(this.state.replica, work.path, { isPeerActive: id => this.isOnline(id) })
      if (handler.status !== 'ready') throw new Error(handler.problems.join('; '))
      // The fos model is the server's llm handler: completing the request node pins the attempt and leaves the answer as a proposal for review.
      await this.evaluateAt(work.path, true)
      if (this.state.session !== session) throw new Error('The account changed while the model was running.')
      this.notify('info', 'The result is ready for review. The task is still awaiting acceptance.')
      this.set({ work: { ...work, preview: taskWorkContext(this.state.replica, work.path), busy: false } })
    } catch (error) { this.set({ work: { ...work, busy: false, error: error instanceof Error ? error.message : String(error) } }) }
  }
  reviewWork(resultPath: Scope, proposalCid: string, accept: boolean): void {
    const work = this.state.work
    if (!work || work.busy || !this.canApprove(view(this.state.replica, work.path))) return
    try {
      this.edit(decideTaskResult(this.state.replica, work.path, resultPath, proposalCid, accept, this.now()))
      this.refreshWork()
    } catch (error) { this.set({ work: { ...work, error: error instanceof Error ? error.message : String(error) } }) }
  }
  workResults() { return this.state.work ? workAttempts(this.state.replica, this.state.work.path) : [] }
  /**
   * Hand a requirement to the peer that registered its capability. search: a query row with the requirement's text
   * is placed inside and run (filling it); market: the task is listed and the listing recorded as the supply.
   */
  async askPeerAt(at: Scope, req: TaskView): Promise<void> {
    const r = req.requirement
    if (!r) return
    if (r.capability === 'tool' && r.tool === 'fos.pull') { await this.evaluateAt([...this.state.view, ...at, req.id]); return }
    if (r.capability === 'search') {
      const inside = view(this.state.replica, [...this.state.view, ...at, req.id])?.tasks ?? []
      let query = inside.find((q) => q.kind === 'query')
      if (!query) {
        const id = this.addRowAt([...at, req.id], 'query', req.title || 'search', { extras: { query: {} } })
        query = view(this.state.replica, [...this.state.view, ...at, req.id])?.tasks.find((q) => q.id === id)
      }
      if (query) await this.runQueryAt([...at, req.id], query)
      this.set({ collapsed: this.state.collapsed.filter((c) => c !== req.id) })
      return
    }
    const session = this.state.session
    if (!session || session.kind !== 'user') { this.notify('error', 'Sign in to your account: its peers handle this.'); this.openModal('connect'); return }
    const task = this.rowAt(at)
    try {
      if (r.capability === 'llm') { this.openWork(at, req.id); return }
      const poll = r.capability === 'choice' && !!readNodeValue(this.state.replica, [...this.state.view, ...at, req.id], 'fos:poll')
      if (r.capability === 'repo' || r.capability === 'tool' || r.capability === 'market' || poll || (r.capability === 'allocation' && (r.resource === 'points' || ((r.resource === 'calendar' || r.resource === 'person') && r.start !== undefined)))) {
        if (r.capability === 'repo' && !r.repo) { this.notify('error', 'Name the repository: "-repo owner/name title".'); return }
        // the peer that registered the capability runs it as an evaluation effect of this requirement (the account server's handler registry)
        await this.evaluateAt([...this.state.view, ...at, req.id])
        this.set({ collapsed: this.state.collapsed.filter((c) => c !== req.id) })
        return
      }
    } catch (error) {
      this.notify('error', error instanceof Error ? error.message : String(error))
      return
    }
    this.notify('error', `No peer handles “${r.capability}” yet.`)
  }
  /** Resource banks and allocations anywhere in the replica, for picking an allocation to supply. */
  allocations(): Array<{ row: TaskView; path: Scope }> {
    const out: Array<{ row: TaskView; path: Scope }> = []
    const walk = (path: Scope) => {
      const node = view(this.state.replica, path)
      if (!node) return
      for (const row of node.tasks) {
        if (row.kind === 'allocation') out.push({ row, path })
        if (row.childCount) walk([...path, row.id])
      }
    }
    walk([])
    return out
  }
  /** Supply a requirement: a confirmation by this user, a choice, or a reference to an allocation/query row. */
  supplyRequirementAt(at: Scope, requirementId: string, supply: { capability: CapabilityKind; ref?: string; choice?: number }, absolute = false): void {
    if ((supply.capability === 'confirmation' || supply.capability === 'peer') && !this.state.session) { this.notify('error', 'Sign in to confirm: confirmation is a capability of a logged-in person.'); this.openModal('connect'); return }
    const by = this.state.session?.username ?? this.state.deviceName
    const parent = absolute ? at : [...this.state.view, ...at]
    this.edit(addSupply(this.state.replica, parent, requirementId, { ...supply, by }, this.now()))
    this.set({ collapsed: this.state.collapsed.filter((c) => c !== requirementId) })
  }
  /** Run a query row: semantic search through the account; results become reference rows under it (replacing the previous ones). */
  async runQueryAt(at: Scope, query: TaskView): Promise<void> {
    const session = this.state.session
    if (!session) { this.notify('error', 'Connect to your account to run searches.'); this.openModal('connect'); return }
    try {
      const { hits } = await searchRows(session, query.title, { market: !!query.query?.market, limit: 10 })
      this.applyQueryResults(at, query, hits)
    } catch (error) {
      this.notify('error', `Search failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  applyQueryResults(at: Scope, query: TaskView, hits: SearchHit[]): void {
    const path = [...this.state.view, ...at, query.id]
    // drop previous results (reference rows, local or market), keep anything else the user put there
    const existing = view(this.state.replica, path)?.tasks ?? []
    let replica = this.state.replica
    for (const row of existing) if (row.kind === 'ref') replica = deleteTask(replica, path, row.id, this.now())
    for (const hit of hits) {
      if (hit.owner === null && hit.aliasId !== query.id && resolveRef(replica, hit.aliasId)) {
        replica = addRef(replica, path, hit.aliasId, this.now())
      } else if (hit.owner) {
        // a row listed on the market by another account: a reference row that remembers the owner (opens the market modal)
        replica = addRow(replica, path, 'ref', hit.title, this.now(), { refId: hit.aliasId, refOwner: hit.owner })
      }
    }
    replica = setQueryOptionsAt(replica, [...this.state.view, ...at], query.id, { executedAt: this.now(), count: hits.length }, this.now())
    this.edit(replica)
    this.notify('info', hits.length ? `${hits.length} result${hits.length === 1 ? '' : 's'}.` : 'No results.')
  }
  /** Open a listed node of another account (from a market result row): what they show, and this account's proposal. */
  async openMarket(owner: string, aliasId: string, title: string): Promise<void> {
    const session = this.state.session
    if (!session || session.kind !== 'user') { this.notify('error', 'Sign in to your account to view market listings.'); this.openModal('connect'); return }
    this.set({ market: { owner, aliasId, title, node: null, phase: 'loading' }, modal: 'market', menuOpen: false, contextMenu: null })
    try {
      const node = await getMarketNode(session, owner, aliasId)
      if (this.state.market?.aliasId === aliasId) this.set({ market: { ...this.state.market, node, phase: 'ready' } })
    } catch (error) {
      if (this.state.market?.aliasId === aliasId) this.set({ market: { ...this.state.market, phase: 'ready', error: error instanceof Error ? error.message : String(error) } })
    }
  }
  /** Submit this account's proposal on the open market node: a comment, plus allocations supplied to its requirements. */
  async submitProposal(comment: string, supplies: Array<{ requirementId: string; allocationId: string }>): Promise<void> {
    const session = this.state.session
    const market = this.state.market
    if (!session || session.kind !== 'user' || !market) return
    if (!this.mayPropose()) { this.notify('error', 'This device does not submit proposals (policy towards fos: add "submit proposals" under "to").'); return }
    const rows: Array<{ kind: string; text: string; data?: Record<string, unknown>; under?: string; id?: string }> = []
    if (comment.trim()) rows.push({ kind: 'comment', text: comment.trim() })
    for (const s of supplies) {
      const found = this.allocations().find(({ row }) => row.id === s.allocationId)
      if (!found?.row.allocation) continue
      // the allocation itself travels with the proposal (the owner cannot see our banks); the supply references its copy
      const copyId = `${s.allocationId}-${session.username}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
      rows.push({ kind: 'allocation', text: found.row.title, id: copyId, data: { allocation: { ...found.row.allocation, by: session.username } } })
      rows.push({ kind: 'supply', text: '', under: s.requirementId, data: { supply: { capability: 'allocation', ref: copyId } } })
    }
    if (!rows.length) { this.notify('error', 'Write a comment or supply an allocation first.'); return }
    this.set({ market: { ...market, phase: 'submitting', error: undefined } })
    try {
      await submitMarketProposal(session, market.owner, market.aliasId, rows)
      const node = await getMarketNode(session, market.owner, market.aliasId)
      this.set({ market: { ...market, node, phase: 'submitted' } })
      this.notify('info', `Proposal sent to ${market.owner}. They see it under “${market.title}”; you only see your own.`)
    } catch (error) {
      this.set({ market: { ...market, phase: 'ready', error: error instanceof Error ? error.message : String(error) } })
    }
  }
  /** Toggle whether a query also searches rows other accounts listed on the market. */
  toggleQueryMarket(at: Scope, query: TaskView): void {
    const market = !query.query?.market
    this.edit(setQueryOptionsAt(this.state.replica, [...this.state.view, ...at], query.id, { market }, this.now()))
  }
  /** Workflowy-style Enter: a blank plain row right after `id` (same parent), selected for typing. */
  addRowBelow(at: Scope, id: string): void {
    const created = this.addRowAt(at, 'plain', '', { position: { relativeTo: id, position: 'below' } })
    this.set({ selected: [...at, created] })
  }
  /**
   * Ctrl+Shift+Enter: a blank row inside `id` (plain, or a comment from the menu), selected for typing. `seed` starts
   * the row's text with a marker ("-", "$ ", "@money ") so the menu can open a requirement, allocation or bank row.
   */
  addRowInside(at: Scope, id: string, kind: 'plain' | 'comment' = 'plain', seed = ''): void {
    const created = this.addRowAt([...at, id], kind, kind === 'comment' ? ' ' : seed)
    this.set({ selected: [...at, id, created], collapsed: this.state.collapsed.filter((c) => c !== id) })
  }
  /** A row below `id` whose text starts with `seed` (a marker), selected for typing. */
  addRowBelowWith(at: Scope, id: string, seed: string): void {
    const created = this.addRowAt(at, 'plain', seed, { position: { relativeTo: id, position: 'below' } })
    this.set({ selected: [...at, created] })
  }
  /** The blank row at the top of the view was typed into: a row of the parsed kind becomes the first row here. */
  private addParsedChildren(at: Scope, children: import('./rows').ParsedInput[], replica?: Replica, preserveUnbound = false): void {
    for (const child of children) {
      const id = this.addRowAt(at, child.kind, child.text, { done: child.done, extras: child.extras, templateName: child.templateName, replica, preserveUnbound })
      if (child.peer !== undefined) { if (replica) this.peerRowReplica(replica, [...this.state.view, ...at, id], child.peer); else this.setPeerRow([...this.state.view, ...at, id], child.peer) }
      if (view(replica ?? this.state.replica, [...this.state.view, ...at])?.tasks.some(row => row.id === id) && child.children?.length) this.addParsedChildren([...at, id], child.children, replica, preserveUnbound)
    }
  }
  addRowAtTop(parsed: import('./rows').ParsedInput): string | null {
    if ((parsed.children?.length || parsed.peer !== undefined) && !this.groupedEdit) return this.together(() => this.addRowAtTop(parsed))
    const created = this.addRowAt([], parsed.kind, parsed.text, { done: parsed.done, extras: parsed.extras, templateName: parsed.templateName })
    if (parsed.peer !== undefined) this.setPeerRow([...this.state.view, created], parsed.peer)
    if (this.currentView()?.tasks.some((t) => t.id === created) && parsed.children?.length) this.addParsedChildren([created], parsed.children)
    return this.currentView()?.tasks.some((t) => t.id === created) ? created : null
  }
  setDoneAt(at: Scope, id: string, done: boolean): void {
    this.edit(setTaskDone(this.state.replica, [...this.state.view, ...at], id, done, this.now()))
  }
  setRowKindAt(at: Scope, id: string, kind: RowKind): void {
    this.edit(setRowKind(this.state.replica, [...this.state.view, ...at], id, kind, this.now()))
  }
  /** Alt+drag: a reference to `targetId` placed at `position` under `toAt`. */
  addRefAt(toAt: Scope, targetId: string, position?: MovePosition): void {
    this.edit(addRef(this.state.replica, [...this.state.view, ...toAt], targetId, this.now(), position))
  }
  /** Ctrl+drag: a copy of the row `id` (with its subtree) at `position` under `toAt`. */
  copyRowAt(fromAt: Scope, id: string, toAt: Scope, position: MovePosition): void {
    const base = this.state.view
    this.edit(copyNode(this.state.replica, [...base, ...fromAt], id, [...base, ...toAt], position, this.now()))
  }
  // -------------------------------------------------------------------------
  // Voice notes: record in the browser, let the account transcribe and organize

  private recorder: MediaRecorder | null = null
  private recorded: Blob[] = []

  canRecordVoice(): boolean {
    return this.capabilityAvailable('llm') && this.state.session?.kind === 'user' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  }

  async toggleVoice(): Promise<void> {
    if (this.state.voice?.phase === 'recording') { this.recorder?.stop(); return }
    if (this.state.voice) return
    if (!this.state.session) { this.notify('error', 'Connect to your account to transcribe voice notes.'); this.openModal('connect'); return }
    if (!this.canRecordVoice()) { this.notify('error', 'Recording needs an active Fos peer and a browser with audio recording support.'); return }
    const at = [...this.state.view]
    const generation = this.authGeneration
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (generation !== this.authGeneration) { stream.getTracks().forEach((t) => t.stop()); return }
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m))
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      this.recorded = []
      recorder.addEventListener('dataavailable', (e) => { if (e.data.size) this.recorded.push(e.data) })
      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(this.recorded, { type: recorder.mimeType || 'audio/webm' })
        this.recorder = null
        if (generation === this.authGeneration) void this.submitVoice(blob, at)
      })
      recorder.start(1000)
      this.recorder = recorder
      this.set({ voice: { phase: 'recording', startedAt: this.now() } })
    } catch (error) {
      this.notify('error', `Microphone unavailable: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async submitVoice(blob: Blob, at: Scope): Promise<void> {
    const session = this.state.session
    if (!session || blob.size < 1000) { this.set({ voice: null }); if (blob.size < 1000) this.notify('error', 'The recording was empty.'); return }
    const generation = this.authGeneration
    this.set({ voice: { phase: 'uploading' } })
    try {
      const note = await transcribeVoice(session, blob)
      if (generation !== this.authGeneration || this.state.session !== session) return
      this.insertVoiceNote(note, at)
      this.notify('info', `Voice note added: ${note.clusters.length} cluster${note.clusters.length === 1 ? '' : 's'}.`)
    } catch (error) {
      if (generation !== this.authGeneration) return
      this.notify('error', error instanceof Error ? error.message : String(error))
    } finally {
      if (generation === this.authGeneration) this.set({ voice: null })
    }
  }

  /** Note blocks from a transcription: one parent note (summary) with a note per cluster and its points as rows, plus the transcript. */
  async inputMedia(file: File, at: Scope = [...this.state.view]): Promise<void> {
    const session = this.state.session, store = this.state.replica.store
    if (!session) { this.notify('error', 'Connect to Fos to process media.'); return }
    if (!/^(image\/(jpeg|png|webp)|video\/(mp4|webm))$/.test(file.type) || file.size > 25 * 1024 * 1024) { this.notify('error', 'Choose JPEG, PNG, WebP, MP4 or WebM, up to 25 MB.'); return }
    this.notify('info', `Processing ${file.name}…`)
    try {
      const note = await transcribeVoice(session, file)
      if (this.state.replica.store !== store || this.state.session !== session) return
      this.insertVoiceNote(note, at, 'Source description')
      this.notify('info', 'Media organized into child notes.')
    } catch (error) { if (this.state.replica.store === store) this.notify('error', error instanceof Error ? error.message : String(error)) }
  }
  async attachFile(file: File, at: Scope = [...this.state.view]): Promise<void> {
    const store = this.state.replica.store
    if (file.size > 1024 * 1024) { this.notify('error', 'Attachments are limited to 1 MB while documents use browser storage.'); return }
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Could not read file.')); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file) })
    if (this.state.replica.store !== store || !view(this.state.replica, at)) return
    const id = newId()
    let r = addRow(this.state.replica, at, 'plain', file.name, this.now(), { id })
    r = writeNodeValue(r, [...at, id], 'fos:attachment', { name: file.name, type: file.type, data, size: file.size }, this.now())
    this.edit(r)
  }
  attachment(at: Scope) { return readNodeValue<{ name: string; type: string; data: string; size: number }>(this.state.replica, at, 'fos:attachment') }
  insertVoiceNote(note: VoiceNote, at: Scope = this.state.view, sourceLabel = 'Transcript'): void {
    if (!view(this.state.replica, at)) throw new Error('The recording location was removed. Voice note could not be added.')
    const stamp = new Date(this.now()).toLocaleString()
    const parentId = crypto.randomUUID()
    let replica = addRow(this.state.replica, at, 'note', `# ${note.title || 'Voice note'}\n\n_${stamp}_\n\n${note.summary}`, this.now(), { id: parentId })
    for (const cluster of note.clusters) {
      const clusterId = crypto.randomUUID()
      replica = addRow(replica, [...at, parentId], 'note', `## ${cluster.title}\n\n**${cluster.sentiment}** — ${cluster.summary}`, this.now(), { id: clusterId })
      for (const point of cluster.points) replica = addRow(replica, [...at, parentId, clusterId], 'plain', point, this.now())
    }
    replica = addRow(replica, [...at, parentId], 'note', `## ${sourceLabel}\n\n${note.transcript}`, this.now())
    this.edit(replica)
  }

  /** Where a reference points, relative to the replica root (null when the target is gone). */
  refTarget(refId: string): { path: Scope; row: TaskView } | null {
    return resolveRef(this.state.replica, refId)
  }
  sharedLink(id: string): SharedAddress | null {
    const found = resolveRef(this.state.replica, id)
    return found ? readNodeValue(this.state.replica, [...found.path, found.row.id], 'fos:shared-link') : null
  }
  receiveSharedLink(address: SharedAddress, title: string): Scope {
    const result = ensureSharedLink(this.state.replica, address, title, this.now(), this.state.session?.kind !== 'user')
    this.edit(result.replica)
    return result.path
  }
  rememberSharedSources(path: Scope, sources: Record<string, string>): void {
    this.edit(writeLinkedNodeValue(this.state.replica, path, 'fos:input-links', sources, this.now(), Object.fromEntries(Object.entries(sources).map(([key, id]) => [key, { id }]))))
  }
  openSharedLink(id: string): void {
    const address = this.sharedLink(id), found = resolveRef(this.state.replica, id)
    if (!address || !found) return
    location.hash = `share=${encodeURIComponent(JSON.stringify(address))}`
    this.goTo([...found.path, found.row.id])
    window.dispatchEvent(new window.HashChangeEvent('hashchange'))
  }
  /** Follow a reference: zoom to the target's parent and select it. */
  followRef(refId: string): void {
    const target = this.refTarget(refId)
    if (!target) { this.notify('error', 'The referenced row no longer exists.'); return }
    this.goTo(target.path)
    this.set({ selected: [target.row.id], highlighted: [...this.state.highlighted.filter((h) => h !== target.row.id), target.row.id] })
  }
  toggleTask(task: TaskView): void { if (!task.checkable) return; this.edit(setTaskDone(this.state.replica, this.state.view, task.id, !task.done, this.now())) }
  renameTask(taskId: string, title: string): void { this.edit(renameTask(this.state.replica, this.state.view, taskId, title, this.now())) }
  deleteTask(taskId: string): void { this.edit(deleteTask(this.state.replica, this.state.view, taskId, this.now())) }

  /** `at` is relative to the current view (e.g. [parentTaskId] for a subtask). */
  addTaskAt(at: Scope, title: string): void {
    this.edit(addTask(this.state.replica, [...this.state.view, ...at], title, this.now()))
  }
  toggleTaskAt(at: Scope, task: TaskView): void {
    if (!task.checkable) return
    this.edit(setTaskDone(this.state.replica, [...this.state.view, ...at], task.id, !task.done, this.now()))
  }
  renameTaskAt(at: Scope, taskId: string, title: string): void {
    if (taskId === HOME_ID) return
    this.edit(renameTask(this.state.replica, [...this.state.view, ...at], taskId, title, this.now()))
  }
  deleteTaskAt(at: Scope, taskId: string): void {
    this.edit(deleteTask(this.state.replica, [...this.state.view, ...at], taskId, this.now()))
  }
  /** A blank/plain row typed with a data prefix (`-` requirement, `?` query, `@calendar` bank, `$ 50` allocation, `` ` `` template) becomes a row of that kind in its place. */
  convertPlainRowAt(at: Scope, id: string, parsed: { kind: RowKind; text: string; done: boolean; extras?: Omit<RowExtras, 'store'>; templateName?: string }): void {
    this.rewriteRowAt(at, id, parsed)
  }
  resolveChoiceAt(at: Scope, choiceId: string, pick: number | null): void {
    this.edit(resolve(this.state.replica, [...this.state.view, ...at], choiceId, pick, this.now()))
    this.set({ highlighted: this.state.highlighted.filter((id) => id !== choiceId) })
  }

  /** Drag and drop / indent: move the task `id` from `fromAt` to `toAt` (both relative to the view). */
  moveTask(fromAt: Scope, id: string, toAt: Scope, position: MovePosition): void {
    const base = this.state.view
    this.edit(moveNode(this.state.replica, [...base, ...fromAt], id, [...base, ...toAt], position, this.now()), this.state.atRoot, [...base, ...fromAt, id])
  }

  toggleCollapsed(id: string): void {
    const collapsed = this.state.collapsed.includes(id) ? this.state.collapsed.filter((c) => c !== id) : [...this.state.collapsed, id]
    this.set({ collapsed })
    this.savePrefs()
  }

  private proposalPreviews = new Map<string, { replica: Replica; path: Scope; request: NodeRequest; store: Replica['store']; generation: number }>()
  proposalPreviewData(id: string) {
    const cached = this.proposalPreviews.get(id)
    if (!cached || cached.store !== this.state.replica.store || cached.generation !== this.authGeneration) return null
    return { node: view(cached.replica, [])!, cid: headCid(cached.replica), store: cached.replica.store, remote: true }
  }
  async loadProposalPreview(path: Scope, id: string, relative: Scope = []): Promise<void> {
    const store = this.state.replica.store, generation = this.authGeneration, session = this.state.session
    const transport = this.transport()
    if (!transport || !this.readsRequests()) return
    const cached = this.proposalPreviews.get(id)
    if (relative.length && (!cached || cached.store !== store || cached.generation !== generation)) return
    const scope = transport === 'account' ? (session?.kind === 'peer' ? this.state.replica.meta.scope : []) : transport === 'virtual' ? this.virtualIdentity!.scope : this.link!.remoteScope
    const address = transport === 'account' ? [...this.state.replica.meta.scope, ...path] : [...scope, ...path]
    const peer = this.state.replica.meta.serverPeerId ?? (session ? `user:${session.username}` : this.link?.remotePeerId ?? 'virtual-host')
    const request: NodeRequest = { ...nodeSyncRequest(this.state.replica, path, peer, scope, [...address.slice(scope.length), ...relative]), proposal: { scope: address, id } }
    if (relative.length) request.linkId = nodeRequestLinkId(this.state.replica.meta.peerId, { peerId: peer, scope: [...address, ...relative] })
    try {
      const node = transport === 'account' ? await requestPeerNode(session!, request) : transport === 'virtual' ? await this.virtualPeers!.requestNode(request) : await this.link!.requestNode(request)
      if (store !== this.state.replica.store || generation !== this.authGeneration || session !== this.state.session) return
      validateNodeShape(node)
      let replica = relative.length ? cached!.replica : createReplica(this.state.replica.meta.peerId)
      replica = acceptProvidedNode(replica, relative, request, node, this.now())
      this.proposalPreviews.set(id, { replica, path, request, store, generation })
      this.refresh()
    } catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)) }
  }

  /** Can the current identity approve proposals on the node being viewed? */
  canApprove(node: NodeView | null = this.currentView()): boolean {
    const session = this.state.session
    if (this.virtualIdentity) return this.virtualCapabilities.includes('approve')
    if (!session) return true
    if (session.kind === 'user') return true
    const remote = this.state.replica.meta.serverPeerId && this.state.replica.meta.nodeSync?.[nodeSyncKey(this.state.replica.meta.serverPeerId, this.state.view, nodeBranches(this.state.replica, this.state.view))]?.remote
    return remote ? !!remote.grants?.includes('approve') : !!node?.members.some((m) => m.peerId === this.state.replica.meta.peerId && m.capabilities.includes('approve'))
  }

  discardProposal(id: string): void {
    this.edit(discardOwnProposalAt(this.state.replica, this.state.view, id, this.now()))
    this.set({ selected: null, notice: null })
  }

  async decideProposal(proposalId: string, decision: 'approve' | 'reject'): Promise<void> {
    if (this.virtualPeers?.guest) {
      if (!this.canApprove()) { this.notify('error', 'This role cannot approve proposals.'); return }
      try { await this.virtualPeers.decide(this.state.view, proposalId, decision); await this.syncNow('virtual decision') }
      catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)) }
      return
    }
    const session = this.state.session
    if (session) {
      try {
        await decideProposal(session, this.currentScope(), proposalId, decision)
        this.notify('info', decision === 'approve' ? 'Proposal merged.' : 'Proposal rejected.')
        await this.syncNow('proposal decided')
      } catch (error) {
        this.notify('error', error instanceof Error ? error.message : String(error))
      }
      return
    }
    // No account: decide locally (e.g. a direct-connect host owning the node).
    const at = this.state.view
    const next = decision === 'approve'
      ? applyProposalAt(this.state.replica, at, proposalId, this.state.replica.meta.peerId, this.now())
      : rejectProposalAt(this.state.replica, at, proposalId, this.now())
    this.edit(next)
  }
  resolveChoice(choiceId: string, pick: number | null): void {
    this.edit(resolve(this.state.replica, this.state.view, choiceId, pick, this.now()))
    this.set({ highlighted: this.state.highlighted.filter((id) => id !== choiceId) })
  }

  // -------------------------------------------------------------------------
  // Navigation, menu, modals

  /** Zoom into a descendant: `at` is its path relative to the current view (any depth). */
  zoomTo(at: Scope): void { this.goTo([...this.state.view, ...at]) }
  /** Fetch only a requested peer-held row; its children remain unloaded references. */
  nodeLinkMask(peer: string): NodeMask | null {
    const id = peer === 'fos' ? this.state.replica.meta.serverPeerId ?? peer : peer
    return nodeLinkEndpoint(this.state.replica, this.peerContextPath(), id)?.mask ?? null
  }
  setNodeMask(peer: string, mask: NodeMask, path: Scope = this.peerContextPath()): void {
    const id = peer === 'fos' ? this.state.replica.meta.serverPeerId ?? peer : peer
    const endpoint = nodeLinkEndpoint(this.state.replica, path, id)
    this.set({ replica: setNodeLinkMask(this.state.replica, path, id, endpoint?.remoteId ?? '', mask, this.now()) })
  }
  nodePermissions(path: Scope, peer = NODE_PERMISSION_DEFAULT): NodeMask {
    const id = peer === 'fos' ? this.state.replica.meta.serverPeerId ?? peer : peer
    return nodeLinkEndpoint(this.state.replica, path, id)?.mask ?? {}
  }
  isPeerNode(path: Scope): boolean { return isNodeProjection(this.state.replica, path) }
  private autoNodeAttempts = new Map<string, number>()
  private autoNodeQueue: Array<{ path: Scope; store: Replica['store']; generation: number; view: string; load?: () => Promise<void> }> = []
  private autoNodeActive = 0
  autoLoadPeerNode(path: Scope): void {
    const cid = resolveScope(this.state.replica.store, headCid(this.state.replica), path)
    if (!cid || !isPeerReference(content(this.state.replica.store, cid))) return
    const key = JSON.stringify([this.authGeneration, this.branchSelections, path, cid])
    if (Date.now() - (this.autoNodeAttempts.get(key) ?? 0) < 30000) return
    if (this.autoNodeAttempts.size > 1000) this.autoNodeAttempts.clear()
    this.autoNodeAttempts.set(key, Date.now())
    this.autoNodeQueue.push({ path: [...path], store: this.state.replica.store, generation: this.authGeneration, view: JSON.stringify(this.state.view) })
    this.drainAutoNodes()
  }
  autoLoadProposalNode(path: Scope, id: string, relative: Scope): void {
    const key = JSON.stringify(['proposal', this.authGeneration, id, path, relative])
    if (Date.now() - (this.autoNodeAttempts.get(key) ?? 0) < 30000) return
    this.autoNodeAttempts.set(key, Date.now())
    this.autoNodeQueue.push({ path, store: this.state.replica.store, generation: this.authGeneration, view: JSON.stringify(this.state.view), load: () => this.loadProposalPreview(path, id, relative) })
    this.drainAutoNodes()
  }
  private drainAutoNodes(): void {
    while (this.autoNodeActive < 4 && this.autoNodeQueue.length) {
      const next = this.autoNodeQueue.shift()!
      if (next.store !== this.state.replica.store || next.generation !== this.authGeneration || next.view !== JSON.stringify(this.state.view)) continue
      this.autoNodeActive++
      void (next.load ? next.load() : this.loadPeerNode(next.path)).finally(() => { this.autoNodeActive--; this.drainAutoNodes() })
    }
  }
  loadPeerNode(path: Scope): Promise<void> {
    const key = JSON.stringify(path), existing = this.nodeLoads.get(key)
    if (existing) return existing
    const pending = this.loadPeerNodeOnce(path).finally(() => this.nodeLoads.delete(key))
    this.nodeLoads.set(key, pending)
    return pending
  }
  private async loadPeerNodeOnce(path: Scope): Promise<void> {
    const replica = this.state.replica, cid = resolveScope(replica.store, headCid(replica), path)
    if (!cid || !isPeerReference(content(replica.store, cid))) return
    const ref = content(replica.store, cid).data.ref!, session = this.state.session, generation = this.authGeneration
    const dataSession = this.activeDataSession()?.id, branch = this.currentBranch(), selection = JSON.stringify(this.branchSelections)
    let scope: Scope = [], address = ref.scope ?? [...replica.meta.scope, ...path], provider: NodeProvider | null = null
    if (this.link?.open && this.link.remotePeerId === ref.peer && this.link.remoteCapabilities.includes('provideNode')) {
      const link = this.link; scope = link.remoteScope
      provider = { id: ref.peer!, capabilities: link.remoteCapabilities, request: request => link.requestNode(request) }
    } else if (this.virtualPeers?.connected && this.virtualIdentity && this.state.replica.meta.serverPeerId === ref.peer) {
      scope = this.virtualIdentity.scope
      provider = { id: ref.peer!, capabilities: CLIENT_CAPABILITIES, request: request => this.virtualPeers!.requestNode(request) }
    } else if (session && (ref.peer === 'fos' || ref.peer === replica.meta.serverPeerId) && this.serverOffers().includes('provideNode') && this.state.policy.from.includes('read')) {
      scope = session.kind === 'peer' ? replica.meta.scope : []
      provider = { id: replica.meta.serverPeerId ?? `user:${session.username}`, capabilities: this.serverOffers(), request: request => requestPeerNode(session, request) }
    }
    if (!provider && session && this.state.policy.from.includes('read') && this.state.policy.from.includes('relay')) {
      scope = session.kind === 'peer' ? replica.meta.scope : []
      address = [...replica.meta.scope, ...path]
      provider = { id: replica.meta.serverPeerId ?? `user:${session.username}`, capabilities: this.serverOffers(), request: request => requestPeerNode(session, request) }
    }
    if (!provider || !scope.every((id, i) => address[i] === id)) { this.notify('error', 'The peer that holds this node is unavailable or does not offer provideNode.'); return }
    const request: NodeRequest = { peerId: replica.meta.peerId, scope, path: address.slice(scope.length), ...(ref.branches ? { branches: ref.branches } : {}), linkId: nodeLinkEndpoint(replica, path, provider.id)?.id ?? nodeRequestLinkId(replica.meta.peerId, { peerId: provider.id, scope: address }) }
    try {
      const node = await pullNode(request, [provider])
      if (generation !== this.authGeneration || session !== this.state.session || this.state.replica.store !== replica.store || dataSession !== this.activeDataSession()?.id || branch !== this.currentBranch() || selection !== JSON.stringify(this.branchSelections) || this.state.replica.meta.peerId !== replica.meta.peerId || resolveScope(this.state.replica.store, headCid(this.state.replica), path) !== cid) return
      this.set({ replica: rememberNodeSync(acceptProvidedNode(this.state.replica, path, request, node, this.now()), path, node) })
    } catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)) }
  }
  goTo(path: Scope): void {
    document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
    const home = homePath(this.state.replica), seen = new Set<string>()
    if (!path.length) path = home
    const requested = resolveScope(this.state.replica.store, headCid(this.state.replica), path)
    if (requested && isPeerReference(content(this.state.replica.store, requested))) {
      this.set({ view: path, selected: null, contextMenu: null, atRoot: false })
      void this.loadPeerNode(path)
      return
    }
    while (path.length && seen.size < 64) {
      const row = view(this.state.replica, path.slice(0, -1), true)?.tasks.find(row => row.id === path.at(-1))
      if (!row?.refId || row.refOwner || seen.has(row.refId)) break
      seen.add(row.refId)
      const target = resolveRef(this.state.replica, row.refId)
      if (!target) break
      path = [...target.path, target.row.id]
    }
    this.set({ view: view(this.state.replica, path) ? path : home, selected: null, contextMenu: null, atRoot: false })
  }

  /** Zoom out within Home; device settings are reached through the menu. */
  zoomOut(): void { if (this.state.view.length > homePath(this.state.replica).length) this.goTo(this.state.view.slice(0, -1)) }
  goToAccountPeer(): void {
    this.goToRoot()
    const row = view(this.state.replica, [], true)?.tasks.find(row => row.construction?.peerId === 'fos')
    if (row) this.goTo([row.id])
    else this.notify('error', 'The Fos peer is unavailable in this context.')
  }
  goToRoot(): void { document.activeElement?.dispatchEvent(new window.Event('commit-edit')); this.ensureSettings(); this.set({ atRoot: true, view: [], selected: null, collapsed: [...new Set([...this.state.collapsed, HOME_ID])], contextMenu: null }) }
  /** Peers this device knows, for the "add as member" menu entries: fos and the members/devices of the viewed node. */
  knownPeers(): Array<{ id: string; name: string }> {
    return this.contextPeers().map((p) => ({ id: p.id, name: p.name }))
  }
  select(path: Scope | null): void { this.set({ selected: path }) }
  openContextMenu(menu: AppState['contextMenu']): void { this.set({ contextMenu: menu, menuOpen: false }) }
  closeContextMenu(): void { if (this.state.contextMenu) this.set({ contextMenu: null }) }

  /** Owner side: remove a device (its PEER and MEMBER edges) from the node being viewed. */
  removePeer(peerId: string): void {
    this.edit(removePeerAt(this.state.replica, this.state.view, peerId, this.now()))
    this.set({ contextMenu: null })
  }

  /** This device leaves the node it is attached to (deliberate; signing out alone keeps the attachment). */
  async detach(): Promise<void> {
    const session = this.state.session
    if (!session) return
    try {
      await detachSelf(session, this.state.replica.meta.peerId)
      this.notify('info', 'This device is no longer attached. Sign in or connect again to re-attach.')
      this.logout()
    } catch (error) {
      this.notify('error', error instanceof Error ? error.message : String(error))
    }
  }

  isOnline(peerId: string): boolean {
    if (peerId === 'fos' || peerId === this.state.replica.meta.serverPeerId) return this.transport() === 'account' && ['online', 'syncing'].includes(this.state.connection)
    if (peerId.startsWith('github:')) return this.isOnline('integration:github')
    if (peerId.startsWith('integration:')) return this.isOnline('fos') && !!this.state.integrations.find(peer => `integration:${peer.id}` === peerId)?.connected
    if (peerId.startsWith('mcp:')) return this.isOnline('fos') && this.state.mcpPeers.some(peer => peer.id === peerId)
    if (peerId === this.state.replica.meta.peerId) return true
    return !!this.virtualPeers?.isOnline(peerId) || this.state.onlinePeers.includes(peerId)
  }

  /** Move the selected task one step up or down among its siblings. */
  moveSelected(direction: 'up' | 'down'): void {
    const sel = this.state.selected
    if (!sel || sel.length === 0) return
    const at = sel.slice(0, -1)
    const id = sel[sel.length - 1] as string
    const siblings = view(this.state.replica, [...this.state.view, ...at])?.tasks ?? []
    const index = siblings.findIndex((t) => t.id === id)
    const neighbour = siblings[direction === 'up' ? index - 1 : index + 1]
    if (!neighbour) return
    this.moveTask(at, id, at, { relativeTo: neighbour.id, position: direction === 'up' ? 'above' : 'below' })
  }

  indentSelected(outdent = false): void {
    const sel = this.state.selected
    if (!sel || sel.length === 0) return
    const at = sel.slice(0, -1)
    const id = sel[sel.length - 1] as string
    if (outdent) {
      const parentId = at[at.length - 1]
      if (!parentId) return
      this.moveTask(at, id, at.slice(0, -1), { relativeTo: parentId, position: 'below' })
      this.set({ selected: [...at.slice(0, -1), id] })
      return
    }
    const siblings = view(this.state.replica, [...this.state.view, ...at])?.tasks ?? []
    const index = siblings.findIndex((t) => t.id === id)
    const prev = siblings[index - 1]
    if (!prev) return
    this.moveTask(at, id, at, { into: prev.id })
    this.set({ selected: [...at, prev.id, id], collapsed: this.state.collapsed.filter((c) => c !== prev.id) })
  }
  refresh(): void { this.set({}) }
  toggleMenu(open = !this.state.menuOpen): void { this.set({ menuOpen: open }) }

  /** A CLI asked this browser to approve its sign-in: show it once signed in. */
  setDeviceCode(code: string): void {
    const clean = code.trim().toUpperCase()
    if (!clean) return
    this.set({ device: { code: clean, name: null, status: 'loading' }, modal: this.state.session?.kind === 'user' ? 'device' : 'connect' })
    this.connectDismissed = false
    if (this.state.session?.kind === 'user') void this.loadDevice()
  }

  private async loadDevice(): Promise<void> {
    const device = this.state.device
    const session = this.state.session
    if (!device || !session) return
    try {
      const info = await describeDeviceLogin(session, device.code)
      this.set({ device: { ...device, name: info.name, status: info.status === 'pending' ? 'ready' : 'error', error: info.status === 'pending' ? undefined : `This code was already ${info.status}.` }, modal: 'device' })
    } catch (error) {
      this.set({ device: { ...device, status: 'error', error: error instanceof Error ? error.message : String(error) }, modal: 'device' })
    }
  }

  async decideDevice(decision: 'approve' | 'deny'): Promise<void> {
    const device = this.state.device
    const session = this.state.session
    if (!device || !session) return
    try {
      await decideDeviceLogin(session, device.code, decision)
      this.set({ device: { ...device, status: decision === 'approve' ? 'approved' : 'denied' } })
    } catch (error) {
      this.set({ device: { ...device, status: 'error', error: error instanceof Error ? error.message : String(error) } })
    }
  }

  openModal(kind: ModalKind): void {
    this.set({ modal: kind, menuOpen: false })
    if (kind === 'requests') void this.refreshRequests()
  }

  closeModal(): void {
    if (this.state.modal === 'connect') {
      this.connectDismissed = true
      this.savePrefs()
      this.clearTimer('connectPoll')
    }
    if (this.state.modal === 'direct' && this.state.direct?.phase !== 'connected') this.cancelDirect()
    this.set({ modal: null, connectFlow: { phase: 'idle' }, manual: {}, device: this.state.modal === 'device' ? null : this.state.device })
  }

  settingKey(key: string): string { return `fos:setting:${this.state.replica.meta.peerId}:${key}` }
  settingValue<T>(key: string): T | null { return readNodeValue<T>(this.state.replica, [], this.settingKey(key)) }
  setSetting(key: string, value: unknown): void { this.edit(writeNodeValue(this.state.replica, [], this.settingKey(key), value, this.now())) }
  ensureSettings(): void {
    let r = this.state.replica
    const defaults: Record<string, unknown> = { history: { handler: 'history' }, name: this.state.deviceName, theme: document.documentElement.dataset.theme || 'system', microphone: 'Not checked', camera: 'Not checked', geolocation: 'Not checked', server: { handler: 'connect' }, direct: { handler: 'direct' }, peer: { handler: 'peer' }, invite: { handler: 'invite' }, virtual: { handler: 'virtual' }, phone: { handler: 'phone' }, share: { handler: 'share' }, resetHome: { handler: 'reset-home' }, resetAccount: { handler: 'reset-account' }, sessions: { handler: 'sessions' }, export: { handler: 'export-yaml' }, import: { handler: 'import-yaml' } }
    const installedName = `fos:settings-installed:${r.meta.peerId}`
    const installed = readNodeValue<string[]>(r, [], installedName) ?? []
    for (const [key, value] of Object.entries(defaults)) {
      const name = this.settingKey(key), existing = readNodeValue(r, [], name)
      const peerHandler = ['server', 'direct', 'peer', 'invite', 'virtual', 'phone', 'share'].includes(key)
      const type = capabilityTarget(r.store, peerHandler ? 'peer' : 'tool')
      const argument = argumentRefs(r.store, headCid(r)).find(arg => arg.name === name)
      if ((!installed.includes(key) && existing === null) || (peerHandler && argument && argument.type !== type)) r = writeNodeValue(r, [], name, existing ?? value, this.now(), typeof value === 'object' ? { type, peer: r.meta.peerId } : undefined)
    }
    if (Object.keys(defaults).some(key => !installed.includes(key))) r = writeNodeValue(r, [], installedName, [...new Set([...installed, ...Object.keys(defaults)])], this.now())
    const root = headCid(r), store = r.store
    const next = updateAtScope(store, root, [], node => ({ ...node, children: node.children.map(edge => {
      if (![store.primitive.memberField.getId(), store.primitive.peerField.getId()].includes(edge[0])) return edge
      const peer = content(store, edge[1]), id = peer.data.peerId?.content
      if (!id || peer.data.alias) return edge
      return [edge[0], put(store, { ...peer, data: { ...peer.data, alias: { id: `${edge[0] === store.primitive.memberField.getId() ? 'fos:peer' : 'fos:device'}:${id}` } } })]
    }) }), 'node')
    if (next !== root) { commitRoot(store, next, this.now()); r = { ...r } }
    if (r !== this.state.replica) { this.set({ replica: r }); this.scheduleSync() }
  }
  exportYaml(): string { return exportNodeYaml(this.state.replica, this.state.view) }
  importText(text: string, format: string, at: Scope): void {
    if (!view(this.state.replica, at)) throw new Error('The import destination was removed.')
    if (format === 'yaml' && /^\s*["']?v2-[a-f0-9]+["']?:/i.test(text)) { this.importYaml(text, at); return }
    const rows = parsePastedRows(format === 'yaml' ? '```yaml\n' + text + '\n```' : text)
    this.together(() => {
      const append = (parent: Scope, rows: import('./rows').ParsedInput[]) => {
        for (const row of rows) {
          const id = newId(); this.edit(addRow(this.state.replica, parent, row.kind, row.text, this.now(), { id, done: row.done, ...row.extras }))
          if (row.peer !== undefined) this.setPeerRow([...parent, id], row.peer)
          if (row.children) append([...parent, id], row.children)
        }
      }
      append(at, rows)
    })
  }
  importYaml(text: string, destination = this.state.view): void {
    const parsed = parseNodeYaml(text), r = this.state.replica
    importNodes(r.store, parsed.nodes)
    const imported = content(r.store, parsed.root), id = newId()
    const node = put(r.store, { ...imported, data: { ...imported.data, alias: { id } } })
    commitRoot(r.store, updateAtScope(r.store, headCid(r), destination, value => ({ ...value, children: [...value.children, [node, r.store.primitive.descriptionField.getId()]] })), this.now())
    this.edit({ ...r })
  }
  setDeviceName(name: string): void {
    const clean = name.trim().slice(0, 80)
    if (!clean) return
    this.setSetting('name', clean)
    this.set({ deviceName: clean })
    this.savePrefs()
  }

  canAttach(scope: Scope): boolean {
    const { replica, connection, session } = this.state
    if (this.virtualIdentity || session?.kind === 'peer') return false // a peer credential is fixed to its node
    const attached = [...replica.meta.scope, ...(replica.meta.localScope ?? [])]
    const target = replica.meta.localScope?.length && !scope.length ? [HOME_ID] : scope
    const same = attached.length === target.length && attached.every((s, i) => target[i] === s)
    return (connection === 'online' || connection === 'syncing') && !isDirty(replica) && replica.meta.baseCid !== null && !same
  }

  attachAt(scope: Scope): void {
    if (!this.canAttach(scope)) {
      this.notify('error', 'Sync first: this device can only move while online with no unsynced changes.')
      return
    }
    try {
      const next = reattach(this.state.replica, scope, this.now(), scope.length === 0 ? [] : undefined)
      this.set({ replica: next, view: next.meta.localScope ?? [], menuOpen: false })
      this.notify('info', scope.length === 0 ? 'This device now syncs Home.' : 'This device now syncs only this node.')
      void this.syncNow('reattach')
    } catch (error) {
      this.notify('error', error instanceof Error ? error.message : String(error))
    }
  }

  // -------------------------------------------------------------------------
  // Invites (inviting side)

  async startInvite(): Promise<void> {
    const session = this.state.session
    if (!session || session.kind !== 'user') { this.notify('error', 'Sign in to invite a device.'); return }
    const scope = [...this.state.replica.meta.scope, ...this.peerContextPath()]
    const names = [...this.labels().scope, ...scopeNames(this.state.replica.store, headCid(this.state.replica), this.peerContextPath())]
    // The invited node becomes a link node: it keeps its history and collects members and proposals.
    this.edit(makeLinkAt(this.state.replica, this.peerContextPath(), this.now()))
    const generation = this.authGeneration
    this.set({ modal: 'invite', menuOpen: false, invite: null, inviteError: undefined })
    try {
      const created = await createInvite(session, scope, names)
      if (generation !== this.authGeneration || session !== this.state.session) return
      this.set({ invite: { token: created.token, scope, scopeNames: names, expiresAt: created.expiresAt } })
    } catch (error) {
      if (generation !== this.authGeneration || session !== this.state.session) return
      this.set({ inviteError: error instanceof Error ? error.message : String(error) })
      this.notify('error', `Could not create an invite: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async refreshRequests(): Promise<void> {
    const session = this.state.session
    if (!session || session.kind !== 'user') return
    try {
      const { requests } = await listInviteRequests(session)
      if (this.state.session === session) this.set({ requests })
    } catch { /* non-fatal */ }
  }

  async answerRequest(id: number, decision: 'approve' | 'deny', capabilities: Capability[] = ['edit']): Promise<void> {
    const session = this.state.session
    if (!session) return
    try {
      await answerInviteRequest(session, id, decision, capabilities)
      this.notify('info', decision === 'approve' ? `Device approved (${capabilities.includes('approve') ? 'may propose and approve' : 'may propose changes'}). It will attach on its next check.` : 'Request denied.')
      await this.refreshRequests()
    } catch (error) {
      this.notify('error', error instanceof Error ? error.message : String(error))
    }
  }

  // -------------------------------------------------------------------------
  // Connect with an invite token (connecting side)

  async connectWithToken(token: string): Promise<void> {
    const clean = token.trim()
    if (!clean) return
    this.clearTimer('connectPoll')
    this.set({ connectFlow: { phase: 'claiming' } })
    try {
      const claimed = await claimInvite(this.config.baseUrl, clean, this.state.replica.meta.peerId, this.state.deviceName)
      this.set({ connectFlow: { phase: 'waiting', requestId: claimed.requestId, scopeNames: claimed.scopeNames } })
      this.pollConnectApproval(claimed.requestId)
    } catch (error) {
      this.set({ connectFlow: { phase: 'error', message: error instanceof Error ? error.message : String(error) } })
    }
  }

  private pollConnectApproval(requestId: string): void {
    this.clearTimer('connectPoll')
    this.connectPollTimer = setTimeout(async () => {
      if (this.state.connectFlow.phase !== 'waiting') return
      try {
        const result = await pollConnect(this.config.baseUrl, requestId, this.state.replica.meta.peerId)
        if (result.status === 'approved' && result.jwt && result.username) {
          const session: Session = { baseUrl: this.config.baseUrl, jwt: result.jwt, username: result.username, kind: 'peer' }
          this.set({ connection: 'connecting' })
          await this.afterConnect(session)
          this.set({ modal: null, connectFlow: { phase: 'idle' } })
          this.notify('info', `Connected to ${this.pathLabel(result.scopeNames ?? [])} of ${result.username}.`)
          return
        }
        if (result.status === 'denied' || result.status === 'expired') {
          this.set({ connectFlow: { phase: result.status } })
          return
        }
      } catch (error) {
        this.set({ connectFlow: { phase: 'error', message: error instanceof Error ? error.message : String(error) } })
        return
      }
      this.pollConnectApproval(requestId)
    }, 2000)
  }

  // Virtual browser peers use the same replica/proposal protocol as normal peers.
  enableVirtualPeers(guest: VirtualPeer | null): void {
    this.virtualIdentity = guest
    if (!('BroadcastChannel' in window)) return
    try {
      this.virtualPeers = new VirtualPeers(guest, {
        provide: (peer, request) => {
          const served = exchangeNode(this.state.replica, request, { peerId: peer.id, scope: peer.scope, proposeOnly: !this.virtualGrants(peer)?.includes('autopush'), capabilities: CLIENT_CAPABILITIES }, this.now())
          this.set({ replica: served.replica })
          if (request.update) this.scheduleSync()
          return served.node
        },
        presence: () => this.set({}),
        dataSessionId: () => this.activeDataSession()?.id,
        decide: async (peer, scope, proposalId, decision) => {
          if (!this.virtualGrants(peer)?.includes('approve') || !Array.isArray(scope) || scope.some((id) => typeof id !== 'string') || !['approve', 'reject'].includes(decision)) throw new Error('This role cannot decide this proposal.')
          const at = [...peer.scope, ...scope]
          if (!withBranches(this.state.replica.store, peer.branches ?? {}, () => view(this.state.replica, at)?.proposals.some((p) => p.id === proposalId && p.status === 'open'))) throw new Error('Proposal no longer available.')
          if (this.virtualPeers?.guest) { await this.virtualPeers.decide(at, proposalId, decision); await this.syncNow('nested virtual decision'); return }
          this.edit(withBranches(this.state.replica.store, peer.branches ?? {}, () => decision === 'approve' ? applyProposalAt(this.state.replica, at, proposalId, peer.id, this.now()) : rejectProposalAt(this.state.replica, at, proposalId, this.now())))
        },
        grants: (peer) => this.virtualGrants(peer),
        serve: (peer, request) => {
          const served = withBranches<import('../../shared/sync/protocol').ServeResult>(this.state.replica.store, peer.branches ?? {}, () => {
          const capabilities = this.virtualGrants(peer)
          if (!capabilities || !capabilities.includes('read')) return { error: 'This virtual peer no longer has access to the node.', code: 'scope-not-found' }
          if (request.peerId !== peer.id || request.scope.length) return { error: 'Virtual peer scope mismatch', code: 'bad-request' }
          if (!capabilities.includes('edit') && request.headCid !== request.baseCid && !(request.baseCid === null && request.nodes[request.headCid]?.children.length === 0 && Object.keys(request.nodes[request.headCid]?.data ?? {}).length === 0)) return { error: 'This role is read-only.', code: 'bad-request' }
          const served = serveSync(this.state.replica.store, { ...request, branches: undefined, branch: peer.branches?.[peer.scope.at(-1)!] ?? request.branch, scope: peer.scope }, this.state.replica.meta.peerId, this.now(),
            { proposeOnly: capabilities.includes('edit') && !capabilities.includes('autopush'), peerName: peer.name, capabilities })
          return 'error' in served ? served : { ...served, response: { ...served.response, scope: request.scope } }
          })
          if (!('error' in served) && served.changed) { this.set({ replica: { ...this.state.replica } }); this.scheduleSync() }
          return served
        },
        welcome: (capabilities, hostName, session) => {
          if (!capabilities.length && this.state.virtual) {
            this.virtualCapabilities = []
            this.set({ connection: 'offline', notice: { kind: 'error', text: 'This virtual peer no longer has access to the node. Reconnects when access is restored.', at: this.now() } })
            return
          }
          const changed = JSON.stringify(capabilities) !== JSON.stringify(this.virtualCapabilities)
          this.virtualCapabilities = capabilities
          if (changed || !this.state.virtual || this.state.virtual.hostName !== hostName || session) this.set({ virtual: { name: guest!.name, hostName, capabilities }, ...(session ? { session } : {}) })
          if (!this.virtualWelcomed || changed || this.state.connection === 'offline') {
            this.virtualWelcomed = true
            void this.syncNow('virtual connected')
          }
        },
        changed: () => {
          if (!this.virtualPeers?.connected) { if (guest) this.set({ connection: 'offline' }); return }
          void this.syncNow('virtual change')
        },
        revision: () => headCid(this.state.replica),
        session: () => this.state.session,
        name: () => this.state.deviceName
      })
      window.addEventListener('pagehide', (event) => { if (!event.persisted) this.virtualPeers?.close() })
    } catch { this.virtualPeers = null; if (guest) this.notify('error', 'Browser tab storage is unavailable; this virtual peer cannot connect.') }
  }
  private virtualGrants(peer: VirtualPeer): Capability[] | null {
    if (peer.dataSessionId && peer.dataSessionId !== this.activeDataSession()?.id) return null
    const member = withBranches(this.state.replica.store, peer.branches ?? {}, () => view(this.state.replica, peer.scope)?.members.find((m) => m.peerId === peer.id))
    return member ? member.capabilities.filter((c) => !member.disabled?.includes(c)) : null
  }
  canSpawnVirtualPeer(): boolean { return !this.config.project && !!this.virtualPeers && this.canApprove() }
  spawnVirtualPeer(name: string, role: 'editor' | 'proposer' | 'reviewer' | 'viewer', shareAccount: boolean): void {
    if (!this.canSpawnVirtualPeer() || !name.trim()) return
    const token = crypto.randomUUID()
    const peer: VirtualPeer = { id: crypto.randomUUID(), token, hostTab: this.virtualPeers!.hostTab, scope: [...this.peerContextPath()], branches: scopeBranches(this.state.replica.store, headCid(this.state.replica), this.peerContextPath()), dataSessionId: this.activeDataSession()?.id, name: name.trim().slice(0, 80), shareAccount }
    const capabilities: Capability[] = role === 'viewer' ? ['read'] : role === 'proposer' ? ['read', 'edit'] : role === 'reviewer' ? ['read', 'edit', 'approve'] : ['read', 'edit', 'autopush']
    this.virtualPeers!.register(peer)
    const url = new URL(location.href); url.search = ''; url.hash = ''; url.searchParams.set('virtual', token)
    const tab = window.open(url.href, '_blank')
    if (!tab) { this.virtualPeers!.unregister(peer); this.notify('error', 'Allow popups for this site to spawn a virtual peer.'); return }
    this.edit(addMemberAt(this.state.replica, peer.scope, peer.id, peer.name, capabilities, this.now()))
    this.closeModal()
    this.notify('info', `${peer.name} opened as ${role === 'editor' ? 'an' : 'a'} ${role} at this node.`)
  }

  // -------------------------------------------------------------------------
  // Direct connection (another device, no account needed)

  async startDirectHost(): Promise<void> {
    this.cancelDirect()
    this.hostScope = [...this.peerContextPath()]
    this.hostBranches = scopeBranches(this.state.replica.store, headCid(this.state.replica), this.hostScope)
    this.set({ modal: 'direct', menuOpen: false, direct: { role: 'host', phase: 'creating' } })
    try {
      this.host = new DirectHost(this.state.replica.meta.peerId, this.state.deviceName)
      const code = await this.host.createOffer()
      this.set({ direct: { role: 'host', phase: 'offer', code } })
    } catch (error) {
      this.set({ direct: { role: 'host', phase: 'error', error: error instanceof Error ? error.message : String(error) } })
    }
  }

  async hostAcceptAnswer(code: string): Promise<void> {
    if (!this.host || this.state.direct?.role !== 'host') return
    this.set({ direct: { ...this.state.direct, phase: 'connecting' } })
    try {
      const link = await this.host.acceptAnswer(code)
      this.attachLink(link, 'host')
      this.set({ direct: { role: 'host', phase: 'connected', remoteName: link.remoteName ?? undefined } })
    } catch (error) {
      this.set({ direct: { role: 'host', phase: 'error', error: error instanceof Error ? error.message : String(error) } })
    }
  }

  async startDirectGuest(offerCode: string): Promise<void> {
    this.cancelDirect()
    this.set({ modal: 'direct', menuOpen: false, direct: { role: 'guest', phase: 'connecting' } })
    try {
      const guest = new DirectGuest(this.state.replica.meta.peerId, this.state.deviceName)
      const { answer, hostName, link } = await guest.acceptOffer(offerCode)
      this.set({ direct: { role: 'guest', phase: 'answer', code: answer, remoteName: hostName } })
      const opened = await link
      this.attachLink(opened, 'guest')
      opened.send({ t: 'hello', peerId: this.state.replica.meta.peerId, name: this.state.deviceName, capabilities: CLIENT_CAPABILITIES, scope: [] })
    } catch (error) {
      this.set({ direct: { role: 'guest', phase: 'error', error: error instanceof Error ? error.message : String(error) } })
    }
  }

  private attachLink(link: DirectLink, role: 'host' | 'guest'): void {
    this.link = link
    link.onClose = () => {
      if (this.link === link) {
        this.link = null
        this.set({ direct: null, connection: this.state.session ? this.state.connection : 'offline' })
        this.notify('info', 'Direct connection closed.')
      }
    }
    link.onMessage = (message) => { if (this.link === link) this.onLinkMessage(message, role) }
  }

  private onLinkMessage(message: ChannelMessage, role: 'host' | 'guest'): void {
    if (message.t === 'node') {
      const link = this.link
      if (!link) return
      try {
        if (!this.approvedNodePeer || link.remotePeerId !== this.approvedNodePeer) throw new Error('Peer connection has not been approved.')
        const served = exchangeNode(this.state.replica, message.request, { peerId: this.approvedNodePeer, scope: role === 'host' ? this.hostScope : [], capabilities: CLIENT_CAPABILITIES }, this.now())
        this.set({ replica: served.replica })
        if (message.request.update) this.scheduleSync()
        link.send({ t: 'node-result', id: message.id, node: served.node })
      } catch (error) { link.send({ t: 'node-result', id: message.id, error: error instanceof Error ? error.message : String(error) }) }
      return
    }
    if (role === 'host') {
      if (message.t === 'hello') {
        this.set({ direct: { role: 'host', phase: 'connected', remoteName: message.name, pendingPeer: { peerId: message.peerId, name: message.name } } })
      } else if (message.t === 'sync') {
        if (!this.approvedNodePeer || message.request.peerId !== this.approvedNodePeer || this.link?.remotePeerId !== this.approvedNodePeer) {
          this.link?.send({ t: 'sync-result', id: message.id, error: { error: 'Peer connection has not been approved.', code: 'bad-request' } })
          return
        }
        this.serveDirect(message.id, message.request)
      }
      return
    }
    if (message.t === 'welcome') {
      if (message.peerId !== this.link?.remotePeerId) return
      this.approvedNodePeer = this.link?.remotePeerId ?? null
      // Attached to the host's node: a fresh link at scope [] relative to that node.
      const replica = addMemberAt(this.state.replica, [], message.peerId, message.name, ['read'], this.now())
      this.set({
        direct: { role: 'guest', phase: 'connected', remoteName: message.name },
        replica: { store: replica.store, meta: { ...replica.meta, scope: [], localScope: undefined, scopeNames: [`${message.name}`], baseCid: null, serverPeerId: message.peerId } },
        connection: 'online',
        view: [],
        modal: null
      })
      void this.syncNow('direct connected')
    } else if (message.t === 'denied') {
      this.set({ direct: { role: 'guest', phase: 'denied' } })
    } else if (message.t === 'changed') {
      void this.syncNow('host changed')
    }
  }

  approveDirectPeer(allow: boolean): void {
    const d = this.state.direct
    if (!this.link || !d || d.role !== 'host' || !d.pendingPeer) return
    if (allow) {
      if (d.pendingPeer.peerId !== this.link.remotePeerId) { this.notify('error', 'Peer identity does not match this connection.'); return }
      this.approvedNodePeer = d.pendingPeer.peerId
      this.set({ replica: addMemberAt(this.state.replica, this.hostScope, d.pendingPeer.peerId, d.pendingPeer.name, ['read', 'edit'], this.now()) })
      this.link.send({ t: 'welcome', peerId: this.state.replica.meta.peerId, name: this.state.deviceName, capabilities: CLIENT_CAPABILITIES, scope: this.hostScope })
      this.set({ direct: { role: 'host', phase: 'connected', remoteName: d.pendingPeer.name }, modal: null })
      this.notify('info', `${d.pendingPeer.name} is now syncing with this device.`)
    } else {
      this.link.send({ t: 'denied' })
      this.link.close()
      this.set({ direct: null })
    }
  }

  /** Host side: answer a guest's sync request against this replica's node. */
  private serveDirect(id: number, request: SyncRequest): void {
    if (!this.link) return
    const served = this.serveRequest(request)
    try {
      this.link.send('error' in served ? { t: 'sync-result', id, error: served } : { t: 'sync-result', id, response: served.response })
    } catch { /* link closed */ }
  }

  private serveRequest(request: SyncRequest): import('../../shared/sync/protocol').ServeResult {
    const branch = this.currentBranch()
    if (branch && request.branch && request.branch !== branch) return { error: 'This checkout is serving another branch', code: 'scope-not-found' }
    const scoped: SyncRequest = { ...request, branches: undefined, branch: this.hostBranches[this.hostScope.at(-1)!] ?? request.branch, scope: [...this.hostScope, ...request.scope] }
    const served = withBranches(this.state.replica.store, this.hostBranches, () => serveSync(this.state.replica.store, scoped, this.state.replica.meta.peerId, this.now()))
    if (!('error' in served) && branch) served.response.branch = branch
    if (!('error' in served) && served.changed) {
      this.set({ replica: { ...this.state.replica } })
      this.scheduleSync() // pass the guest's changes on to the account if we have one
    }
    return served
  }

  cancelDirect(): void {
    this.approvedNodePeer = null
    this.host?.cancel()
    this.host = null
    if (this.link) { const l = this.link; this.link = null; l.close() }
    if (this.state.direct) this.set({ direct: null })
  }

  // -------------------------------------------------------------------------
  // Manual relay (fallback when no channel could be opened)

  manualMakeRequest(): void {
    this.manualRequest = buildSyncRequest(this.state.replica, undefined, { recipient: 'device' })
    this.set({ manual: { requestCode: ManualRelay.encodeRequest(this.manualRequest) } })
  }

  manualServe(code: string): void {
    try {
      const request = ManualRelay.decodeRequest(code)
      const served = this.serveRequest(request)
      this.set({ manual: { resultCode: ManualRelay.encodeResult('error' in served ? served : served.response) } })
    } catch (error) {
      this.set({ manual: { error: error instanceof Error ? error.message : String(error) } })
    }
  }

  manualApplyResult(code: string): void {
    if (!this.manualRequest) { this.set({ manual: { error: 'Create a request code first.' } }); return }
    try {
      const response = ManualRelay.decodeResult(code)
      const done = completeSync(this.state.replica, this.manualRequest, response, this.now())
      const replica = { store: done.replica.store, meta: { ...done.replica.meta, scope: [], serverPeerId: response.peerId } }
      this.manualRequest = null
      this.set({ replica, manual: {}, modal: null })
      this.notify('info', `Merged with the other device (${response.action}).`)
    } catch (error) {
      this.set({ manual: { ...this.state.manual, error: error instanceof Error ? error.message : String(error) } })
    }
  }

  webRtcAvailable(): boolean {
    return isWebRtcAvailable()
  }
}
