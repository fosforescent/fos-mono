import { askAt } from '../../shared/sync/arguments'
import { textValue, textOf as fieldTextOf } from '../../shared/sync/fields'
import { primitive } from '../../shared/sync/primitives'
import { resourceHandlers } from '../../shared/sync/resource-bindings'
import { capabilityPresentation } from './capability-presentation'
import { setLibraryArg } from '../../shared/sync/library'
import { nodeTransportAt, offerNodeTransport, type NodeTransport } from '../../shared/sync/primitives'
import { primitiveRef } from '../../shared/sync/primitives'
import type { FosStore } from '../../shared/dag-implementation/store'
import { primitiveImplementation } from '../../shared/sync/primitives'
import { handlerOfferId } from '../../shared/sync/graph'
/** A device's location reader: the primitive it passes its library for `requires.deviceLocation`. */
type DeviceLocation = { available(): boolean; locate(): Promise<{ lat: number; lng: number }> }
import { settingOf, isTemplateType } from '../../shared/sync/graph'
import { hashContent } from '../../shared/dag-implementation/cid'
import { primitiveValues } from '../../shared/sync/primitives'
import { sameValue } from '../../shared/sync/merge'
import { parseRowInput } from './rows'
import { isHandlerStateLeft } from '../../shared/sync/capabilities'
import { capabilityDeclarations, visibleBindings, bindingTree, bindingLayers, selectBinding, sameCapabilityType, compileInstructions, executionInputs, addRefCall, primitiveValue, refSubmissions, matchesInstructionRef, templateValuePattern, solveAt, usePatternAt, patternBindings, choosePatternBindingAt, findEdge, valueCidOf, type PatternBinding, constructAt, namesInLibrary, rowConstructor, openRefs, assignedValue, assignRefAt, capabilityName, rowTitle, readProposals, type OpenRef, isLibraryType } from '../../shared/sync/index'
import { createDeviceHandlers } from './device-handlers'
import { compileConstructorCall } from '../../shared/sync/constructor-rows'
import { capabilityOfTarget } from '../../shared/sync/graph'
import { workClaims, saveWorkClaims } from '../../shared/sync/work-claims'
import { BUNDLED_LIBRARY as LIBRARY_BUNDLE } from '../../shared/sync/library'
import { runProjectWorkflows, queueAgentEffect } from './project-workflow'
import { AGENT_TOOL } from '../../shared/sync/project-workflow'
import { libraryPath, MANUAL_HANDLERS } from '../../shared/sync/library'
import { libraryBindingAt, childRows, rowView } from '../../shared/sync/graph'
import { addSpecification, specificationRows, importSpecifications, queueSpecificationVerification, type FeatureSpecification } from '../../shared/sync/specifications'
import { executionInput, executionSnapshot } from '../../shared/sync/execution-access'
import { setConstructorEnabledAt, contextMemberRefs, discoverHandlers, contextMembers, publishTemplate, setHandlerEnabledAt, instantiateTemplateValue, shareRefAt, transferRefGraph, copyBidRow, draftBid, rowsOfType } from '../../shared/sync/index'
import { ensureLocalMcp, stopLocalMcp } from './node-agent'
import { capabilityLabels, MARKET_PEER } from '../../shared/sync/graph'
import { NODE_PERMISSION_DEFAULT, isNodeProjection, nodeBranches, nodeBranchBase, validateNodeShape, exchangeNode, nodeShape, sameNodeShape, mergeNodeShape, installNodeShape, materializedNodePaths, nodePersistenceAllowed, rememberNodeSync, nodeSyncKey, nodeSyncRequest, outgoingNodeShape, establishNodeSync, provideNode, pullNode, acceptProvidedNode, acceptTemplateNodes, planNodeSync, nodeSyncPush, finishNodeSync, nodeTemplateRequests, blankNodeRequest, ownHeldChildren, isBlank as isBlankShape, finishBlankNode, nodeLinkEndpoint, nodeRequestLinkId, setNodeLinkMask, isPeerReference, acceptSubmissionRows, type NodeMask, type NodeRequest, type NodeProvider, type ProvidedNode, type ProposalView } from '../../shared/sync/index'
import { requestPeerNode } from './api'
import { membershipSyncContext, sendPullRequest, UNKNOWN_PROVIDER, type NodeSyncContext } from '../../shared/sync/node-sync'
import { parsePastedRows } from './paste'
import { ORGANIZE_PEER, captureNoteText, requestOrganize, organizedRowCount, typeAt } from '../../shared/sync/organize'
import { valueOfPattern, tagNode } from '../../shared/sync/structural'
import { NOTE_TYPE } from '../../shared/sync/published-types'
import { microphoneError, recordedType, recordingMimeType, recordingUnsupported } from './recording'
import { SETTING_LABELS, settingKeyOf } from './settings'
import { exportNodeYaml, parseNodeYaml } from './yaml'
import { ensureSharedLink, sharedAddressAt, type SharedAddress } from '../../shared/sync/sharing'
import { writeTriggerState, triggerOffers as discoverTriggerOffers, triggerObservation, missingSchedule, nodeTrigger, triggerState, triggerOccurrence, configuredTriggers, setNodeTrigger, runNodeTriggers, type TriggerKind } from '../../shared/sync/triggers'
import { executionTime, writeExecutionTime, writeHandlerResult } from '../../shared/sync/evaluation'
import { recordVerificationIssue, recordVerificationReport, verificationReport, verificationTask } from '../../shared/sync/specifications'
import { workflowJob } from '../../shared/sync/project-workflow'
import { bindLocalRepository, localRepositoryHere } from '../../shared/sync/repository'
import { acceptSubmission } from '../../shared/sync/approvals'
import { setRefValueAt } from '../../shared/sync/replica'
import { setTemplateIcon, templateIconAt } from '../../shared/sync/replica'
import { consumeAllocation, handleAt, issueGrant, debitGrant, addRequirement, addAllocation, addBank, supplyRequirement, bindUserAt, contractPin, allocateCapability, ownerContract, edit as editValue, type Allocation } from '../../shared/sync/index'
import type { StepExecutor } from '../../shared/sync/evaluation'
import { argumentType, isArgumentInput, type RowInputExtras } from './rows'
import { addAttachment, attachmentAt } from '../../shared/sync/replica'
import { readNodeValue, recoverEvaluation, evaluateNode, evaluationRecord, writeEvaluationRecord, writeNodeValue, writeLinkedNodeValue, evaluationSteps } from '../../shared/sync/evaluation'
import { withMainBranchPolicy, withBranches, scopeBranches, bindRepository, repositoryAt, repositoryPeerId, repositoryPeerAllows, type RepositorySnapshot, type RepositoryPull, readChoice, isBranchChoice, branchSelection, proposalContent, readProposal, proposalView, valueContent, identityCid, rowEdgeAt, nestScope } from '../../shared/sync/index'
import { checkUserAttestation } from './api'
import { requestTitle, truncateTitle, requirementAnswer } from '../../shared/sync/index'
import { addTypedRow, cacheUser, cachedUser, publishedKey, rebindUsers, requestVerification, verifiedAt, membershipIdOf, memberEntryPeerAt, peerEntryId, accountContextAbove, syncNodeTree, addRelayMessage, addRelayAck, relayQueues, relayInbox, type RelayDelivery, type UserRecord } from '../../shared/sync/index'
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
  HOME_ID, isLibraryRef, ensureDeviceLibrary, linkLocalStore, localStores, findRowByAlias, type LibraryBundle, type ManualHandler, bookkeepingOf, refBranches, updateAtScope, refNodeContent, matchesGraph, isRefNode, libAt, contextBindings, resolveBinding, refValueCid, capabilityPeers, copyProposalBranch, createBranch, setBranchMergeRequest, selectBranch, mergeBranch, argumentRefs, resolveText, resolveScope, content, workHandler, proposeRefAt, newId, addRefAt, put, addSubtasksTemplate, addPlanningTemplate, decideTaskResult, taskWorkContext, workAttempts, type WorkContext,
  addRef,
  createReplica,
  importNodes,
  copyOuterScope,
  reachableNodes,
  commitRoot,
  mergeNodes,
  addRow,
  addMemberAt,
  addTask,
  capabilityNames,
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
  addFileReference,
  setFileReferenceAt,
  setRowFieldsAt,
  fileReferenceAt,
  type FileReference,
  setRowType,
  applyProposalAt,
  shareHome,
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
  removePeerAt,
  renameTask,
  resolve,
  scopeNames,
  serializeReplica,
  setTaskDone,
  view,
  type Capability,
  type MovePosition,
  type NodeView,
  type Replica,
  type RowExtras,
  type Scope,
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
  pollConnect,
  type InviteRequest,
  type Session,
  describeDeviceLogin,
  decideDeviceLogin,
  transcribeVoice,
  transcribeAudio,
  type VoiceNote,
  getMarketNode,
  getTokenBalance,
  sendEvent,
  locateSharedNode,
  confirmAccount,
  resendConfirmation,
  requestPasswordReset,
  completePasswordReset,
  type RegistrationInput,
  listIntegrations,
  startIntegration,
  createConnectSession,
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
import { inTauri, openExternal, tauriInvoke } from './project'
import type { ReplicaStorage } from './storage'
import { TASK_TYPE, PLAIN_TYPE, COMMENT_TYPE, QUERY_TYPE, RESOURCE_TYPE, TEMPLATE_TYPE, HOME_TYPE } from '../../shared/sync/library-types'

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
  /** An agent CLI found on this computer's PATH (desktop): a read-only local peer, never a graph row. */
  agentCli?: { provider: 'claude' | 'codex'; path: string; vscode?: boolean }
  /** An agent app on this computer (Claude Desktop): a local peer, launched with a prompt and connected through its config. */
  agentApp?: 'claude-desktop'
  /** An MCP server peer: the device's loopback endpoint for this node, or the account server's hosted one. */
  mcpServer?: { transport: 'desktop' | 'server' }
  /** A sub-peer: shown as an icon inside its parent's constructor grid rather than as a top-level tab. */
  parent?: 'device' | 'server'
}
/** The three grants a peer's toggles control; everything else a member may hold stays as it is. */
export const GRANTS = ['read', 'edit', 'execute'] as const
export type Grant = typeof GRANTS[number]
export type PeerStatus = 'online' | 'offline' | 'disabled'
/** An agent CLI on this computer; `vscode` when VS Code has its extension (Claude Code's opens a tab with a prompt). */
export type LocalAgent = { provider: 'claude' | 'codex'; name: string; path: string; vscode?: boolean }

/** The account form's step: sign in, create, confirm the code, or reset a password. */
export type AuthFlow =
  | { phase: 'signin' }
  | { phase: 'register' }
  | { phase: 'confirm'; username: string; channel: 'email' | 'phone'; destination: string | null; notice?: string }
  | { phase: 'forgot'; sent?: boolean }
  | { phase: 'reset'; token: string }
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
  authFlow: AuthFlow
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
  /** Agent CLIs on this computer (`agent_clis`), discovered at startup; the constructor panel shows each as a local peer. */
  localAgents: LocalAgent[]
  /** Claude Desktop is set up on this computer (desktop): a local peer whose panel opens a chat and connects its MCP. */
  claudeDesktop: boolean
  /** The phone-linking modal: waiting for a number, then for the code texted to it. */
  phone: { phase: 'number' | 'code' | 'busy'; number?: string; error?: string } | null
  /** Open context menu, if any. */
  contextMenu: { kind: 'task'; at: Scope; task: TaskView } | { kind: 'peer'; peerId: string } | null
  /** A `fos` CLI waiting for this browser to approve its sign-in (from ?device=CODE). */
  device: { code: string; name: string | null; status: 'loading' | 'ready' | 'approved' | 'denied' | 'error'; error?: string } | null
  /** Microphone capture: recording (with start time), uploading, or idle. */
  /** A capture in progress: recording, uploading the audio, or organizing text (voice or typed) into its node. */
  voice: { phase: 'recording'; startedAt: number } | { phase: 'uploading' } | { phase: 'organizing' } | null
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
  project?: { dir: string; branch: () => string | null; deviceName?: string; policy?: PeerPolicy | null; home?: boolean }
  /**
   * Set when this window's replica is a virtual peer's document, not the browser's device root: that device root
   * (read only; null when this browser has none yet), which its rows resolve through.
   */
  deviceRoot?: { serialized: unknown }
  /**
   * Desktop: the other `.fos` stores' replicas as they are on disk (project.ts), to exchange nodes with them on their
   * files: read, and write back after an exchange changed one (one fos process runs at a time).
   */
  localStores?: { read(peerId: string): Promise<unknown | null>; write(peerId: string, serialized: unknown): Promise<void> }
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
  get workflowReady(): boolean { return !this.projectSwitching && !this.evaluating }
  private groupedEdit = false
  private observedHead: string
  private config: AppConfig
  private listeners = new Set<(state: AppState) => void>()
  /** Usernames whose user objects are being fetched from the account server (`resolveUser`). */
  private resolvingUsers = new Set<string>()
  private titling = new Set<string>()
  /**
   * A headline row (a note) made or rewritten from several lines is titled at once by the `title` handler every
   * peer runs (`truncateTitle`). Where the account server offers `title` (its model), it is asked too: a `title`
   * requirement in the row (`requestTitle`) runs there (`runOnServer`), and its summary replaces the title unless the
   * title was edited meanwhile; the request is then removed. Offline, or with the server's handler switched off, the
   * truncated title stays.
   */
  titleFromText(path: Scope): void {
    const row = () => view(this.state.replica, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1))
    const session = this.state.session, key = JSON.stringify(path)
    if (row()?.body === undefined || !session || session.kind !== 'user' || this.virtualIdentity || !this.isOnline('fos') || !this.capabilityAvailable('title', path) || this.titling.has(key)) return
    this.titling.add(key)
    void (async () => {
      const store = this.state.replica.store, before = row()!.title
      const asked = requestTitle(this.state.replica, path, this.now())
      this.edit(asked.replica)
      let failure: string | null = null
      try { await this.runOnServer(asked.path) } catch (error) { failure = error instanceof Error ? error.message : String(error) }
      if (this.state.replica.store !== store) return
      const titled = failure ? null : requirementAnswer(this.state.replica, asked.path)
      let next = this.state.replica
      if (resolveScope(next.store, headCid(next), asked.path)) next = deleteTask(next, path, asked.path.at(-1)!, this.now())
      if (titled && row()?.title === before) next = renameTask(next, path.slice(0, -1), path.at(-1)!, truncateTitle(titled, 120), this.now())
      this.edit(next)
      if (failure) this.notify('error', `Could not title the note: ${failure}`)
    })().catch(error => this.notify('error', error instanceof Error ? error.message : String(error))).finally(() => this.titling.delete(key))
  }
  /**
   * The device's verify handlers, by the peer that attested: a user object the fos server attested is checked
   * against the key that server publishes on its member entry (the key row on the fos membership of the root, graph data that node exchange brought here).
   */
  private readonly verifiers: Record<string, (user: UserRecord) => Promise<boolean | null>> = {
    fos: user => checkUserAttestation({ peer: 'fos', publicKey: publishedKey(this.state.replica, 'fos') }, user)
  }
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
  private manualPlans: import('../../shared/sync/index').NodeSyncPlan[] = []
  /** The device synced with by hand (its node links are keyed by it). */
  private manualPeer: string | null = null

  readonly deviceHandlers = createDeviceHandlers({
    peerId: () => this.state.replica.meta.peerId,
    pull: async () => {
      if (this.syncInFlight) throw new Error('Wait for current sync to finish before evaluating Pull.')
      await this.syncNow('evaluate pull', true)
      if (this.state.connection !== 'online') throw new Error('Pull failed; review the sync status.')
    },
    agent: async (path, evaluation) => {
      await this.saveWorkflowReplica(queueAgentEffect(this.state.replica, path, `${evaluation}:${JSON.stringify(path)}`, this.now()))
      this.notify('info', 'Execution queued for the configured desktop. Track its status in the project workflow.')
    },
    // A network request made by this device (the desktop shell natively, the browser with fetch); the primitive binds the body to the row's `response` output.
    fetch: (url, method) => this.fetchUrl(url, method)
  })
  /** One request from this device. The desktop shell makes it natively (no browser CORS); the browser uses fetch. */
  async fetchUrl(url: string, method: string): Promise<{ status: number; body: string }> {
    if (!/^https?:\/\//i.test(url)) throw new Error('Only http and https addresses can be fetched.')
    const desktop = tauriInvoke<{ status: number; body: string }>('fetch_url', { url, method })
    if (desktop) return desktop
    const response = await fetch(url, { method })
    return { status: response.status, body: (await response.text()).slice(0, 1_000_000) }
  }
  deviceCapabilities(): Capability[] {
    return [...new Set(this.handlerOffers([]).filter(offer => offer.peerId === this.state.replica.meta.peerId && offer.enabled).flatMap(offer => offer.capability ? [offer.capability] : []))]
  }

  constructor(config: AppConfig) {
    this.config = config
    this.autoCredentials = config.autoLogin
    const loaded = this.withRootContext(loadReplica(config.storage.loadReplica()))
    const replica = config.scopedDocument || config.project ? loaded : ensureHomeContext(loaded, 0)
    const prefs = (config.storage.loadPrefs() ?? {}) as { repositories?: Array<[string, RepositorySnapshot]>; branches?: Record<string, string>; connectDismissed?: unknown; deviceName?: unknown; collapsed?: unknown; policy?: unknown; installedSettings?: unknown }
    if (Array.isArray(prefs.installedSettings)) this.installedSettings = prefs.installedSettings.filter((key): key is string => typeof key === 'string')
    if (Array.isArray(prefs.repositories)) this.repositories = new Map(prefs.repositories.filter(entry => Array.isArray(entry) && typeof entry[0] === 'string' && Array.isArray(entry[1]?.pulls)))
    this.branchSelections = prefs.branches && typeof prefs.branches === 'object' ? Object.fromEntries(Object.entries(prefs.branches).filter(([, name]) => typeof name === 'string')) : {}
    for (const [id, name] of Object.entries(this.branchSelections)) selectBranch(replica.store, id, name)
    const configPolicy = config.project?.policy ?? null
    const session = loadSession(config.storage.loadSession(), config.baseUrl)
    this.state = {
      replica,
      // A visit resumes at the Home descendant last viewed on this device (a row in Home), else at Home itself.
      view: this.savedHomeView(replica),
      connection: 'offline',
      session: null,
      loginError: null,
      authFlow: { phase: 'signin' },
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
      localAgents: [],
      claudeDesktop: false,
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
  /** The default settings this device already made (a deleted setting row is not made again). */
  private installedSettings: string[] = []

  now(): number {
    return this.config.now ? this.config.now() : Date.now()
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  private set(patch: Partial<AppState>, render = true): void {
    const previous = this.state
    const contentChanged = patch.replica && headCid(patch.replica) !== this.observedHead
    if (patch.replica) {
      if (patch.replica.store !== previous.replica.store) {
        this.autoNodeAttempts.clear(); this.autoNodeQueue = []
        // a virtual peer's document stays nested in the browser's device root whatever store its replica moves to
        if (this.deviceRoot) nestScope(patch.replica.store, { store: this.deviceRoot.store, root: headCid(this.deviceRoot), at: [] })
      }
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
    if ('session' in patch && (patch.session !== previous.session || patch.session === null)) {
      this.config.storage.saveSession(patch.session ? { jwt: patch.session.jwt, username: patch.session.username, kind: patch.session.kind, baseUrl: patch.session.baseUrl } : null)
    }
    if (render) for (const listener of this.listeners) listener(this.state)
  }

  private savePrefs(): void {
    this.config.storage.savePrefs({ installedSettings: this.installedSettings, repositories: [...this.repositories], branches: this.branchSelections, connectDismissed: this.connectDismissed, deviceName: this.state.deviceName, collapsed: this.state.collapsed, ...(this.state.policyLocked ? {} : { policy: this.state.policy }) })
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
    if (node) for (const row of node.tasks) { const key = settingKeyOf(row); if (key) row.title = SETTING_LABELS[key] ?? key }
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
  /** The directory a project window (`fos <dir>`) was opened on, whose files its root lists (web/src/filesystem.ts); null in the home context. */
  projectRoot(): string | null { return this.config.project && !this.config.project.home ? this.config.project.dir : null }

  currentBranch(): string | null {
    return this.config.project?.branch() ?? null
  }

  /** Project mode: the directory switched git branch; show that branch's replica. */
  /**
   * This window's replica in its root context. A device root ships the standard library, filled from this build
   * (compiled from .fos/library.json) so templates and row types work offline from the first run: the browser's replica, and on
   * the desktop every window's store (Home's and each project's, `.fos`). A virtual peer's document is not a device
   * root; it is nested in the browser's and resolves its rows through it.
   */
  private withRootContext(replica: Replica): Replica {
    if (!this.config.deviceRoot && !this.config.scopedDocument) return this.deviceHandlers.publish(this.passDevicePrimitives(ensureDeviceLibrary(replica, LIBRARY_BUNDLE as LibraryBundle, Date.now())), [], replica.meta.peerId, 0, undefined, 'this-device')
    if (!this.deviceRoot) {
      const stored = this.config.deviceRoot?.serialized
      this.deviceRoot = this.passDevicePrimitives(ensureDeviceLibrary(stored ? loadReplica(stored) : createReplica(), LIBRARY_BUNDLE as LibraryBundle, Date.now()))
    }
    this.deviceRoot = this.deviceHandlers.publish(this.deviceRoot, [], replica.meta.peerId, 0, undefined, 'this-device')
    nestScope(replica.store, { store: this.deviceRoot.store, root: headCid(this.deviceRoot), at: [] })
    return replica
  }
  /**
   * What this device passes the standard library it uses (its `lib` instance on the device root): the primitives the
   * library requires, registered here. The library never calls device code itself; it uses what it is passed.
   */
  private passDevicePrimitives(r: Replica): Replica {
    const peer = r.meta.peerId
    const reader: DeviceLocation = {
      available: () => typeof navigator !== 'undefined' && !!navigator.geolocation,
      locate: () => new Promise((resolve, reject) => {
        const geolocation = typeof navigator !== 'undefined' ? navigator.geolocation : undefined
        if (!geolocation) { reject(new Error('This device does not report its location.')); return }
        geolocation.getCurrentPosition(position => resolve({ lat: Math.round(position.coords.latitude * 1e5) / 1e5, lng: Math.round(position.coords.longitude * 1e5) / 1e5 }), reject, { timeout: 15_000, maximumAge: 60_000 })
      })
    }
    const location = primitiveRef(r.store, peer, { id: 'location', label: 'This device', capability: (store: FosStore, at: Scope) => libAt(store, at).capabilities.allocation! }, reader as never)
    try { return setLibraryArg(r, [], 'deviceLocation', location, 0) } catch { return r }
  }
  /** The primitive a device fallback runs (what this device passed its library), when the device can run it now. */
  devicePrimitive(handler: ManualHandler): DeviceLocation | null {
    if (!handler.primitive) return null
    const value = primitiveImplementation<DeviceLocation>(this.state.replica.store, valueCidOf(this.state.replica.store, handler.primitive))?.value
    return value && value.available() ? value : null
  }
  /** The device root a virtual peer's document is nested in (read only). */
  private deviceRoot: Replica | null = null

  /**
   * Desktop: link the other `.fos` stores on this machine with this store, both sides (`linkLocalStore`; one fos
   * process runs at a time, so the other store's file is written directly). What Home's store shares is its Home,
   * another project store its root; `home` says whether this store is Home's.
   */
  async linkLocalStores(stores: Array<{ peerId: string; name: string; home?: boolean }>, home = false): Promise<void> {
    const me = { peerId: this.state.replica.meta.peerId, name: this.state.deviceName || this.config.project?.deviceName || 'this store' }
    let replica = this.state.replica
    for (const store of stores) {
      if (store.peerId === me.peerId) continue
      replica = linkLocalStore(replica, store.peerId, store.name, this.now(), store.home ? homePath(replica) : [])
      const stored = await this.config.localStores?.read(store.peerId).catch(() => null)
      if (!stored) continue
      const other = loadReplica(stored), linked = linkLocalStore(other, me.peerId, me.name, this.now(), home ? homePath(other) : [])
      if (linked !== other) await this.config.localStores!.write(store.peerId, serializeReplica(linked))
    }
    if (replica !== this.state.replica) this.set({ replica })
  }

  /**
   * The connections this device has now, each the transport of the peer it reaches: the account session (its account
   * peer; what the server itself holds is reached through it, as the peer that gave this device the node), the accounts whose nodes were shared with this one (through the server),
   * a direct link, the tab this is a virtual peer of, and the other stores on this machine. Each is offered on its
   * peer's row (`offerNodeTransport`), so a node is reached through the peer that holds it like any capability.
   */
  private connectionTransports(r: Replica): Array<[string, NodeTransport]> {
    const out: Array<[string, NodeTransport]> = [], session = this.state.session
    if (session) {
      const account: NodeTransport = {
        get capabilities() { return app.serverOffers() },
        available: () => this.state.session === session && this.serverOffers().includes('provideNode') && this.state.policy.from.includes('read'),
        attachment: () => session.kind === 'peer' ? this.state.replica.meta.scope : [],
        request: request => requestPeerNode(session, request),
      }, app = this
      out.push([r.meta.serverPeerId ?? `user:${session.username}`, account])
      if (session.kind === 'user') for (const { owner } of Object.values(r.meta.sharedNodes ?? {})) out.push([`user:${owner}`, this.sharedAccountTransport(session, owner)])
    }
    const link = this.link
    if (link?.remotePeerId) out.push([link.remotePeerId, {
      get capabilities() { return link.remoteCapabilities },
      available: () => this.link === link && link.open,
      attachment: () => link.remoteScope,
      request: request => link.requestNode(request),
    }])
    const virtual = this.virtualIdentity, peers = this.virtualPeers
    if (virtual && peers) out.push([r.meta.serverPeerId ?? UNKNOWN_PROVIDER, {
      capabilities: this.deviceCapabilities(),
      available: () => this.virtualPeers === peers && peers.connected,
      attachment: () => virtual.scope,
      request: request => peers.requestNode(request),
    }])
    if (this.config.localStores) for (const store of localStores(r)) out.push([store.peerId, this.localStoreTransport(store.peerId)])
    return out
  }
  /** A node another account (`owner`) shared with this one: the server provides it as that account's peer `user:<me>`. */
  private sharedAccountTransport(session: Session, owner: string): NodeTransport {
    const app = this
    return {
      get capabilities() { return app.serverOffers() },
      available: () => this.state.session === session && this.serverOffers().includes('provideNode'),
      attachment: address => address,
      request: request => requestPeerNode(session, request, owner),
    }
  }
  /** What reaches `peer` from the node at `at`: its transport found in scope, the connections here offered first. */
  private transportTo(at: Scope, peer: string | null): (NodeProvider & Pick<NodeTransport, 'attachment'>) | null {
    let r = this.state.replica
    for (const [holder, transport] of this.connectionTransports(r)) {
      try { r = offerNodeTransport(r, holder, transport, this.now()) } catch { /* a peer this node cannot have a member for */ }
    }
    if (r !== this.state.replica) this.set({ replica: r }, false)
    return nodeTransportAt(r, at, peer ?? UNKNOWN_PROVIDER)
  }
  /** The peer this device's attachment syncs with: its account, the host it is linked to, the tab it is a virtual peer of. */
  private attachmentPeer(): string | null {
    const r = this.state.replica, transport = this.transport(), session = this.state.session
    return transport === 'account' ? r.meta.serverPeerId ?? `user:${session!.username}` : transport === 'direct' ? this.link!.remotePeerId : transport === 'virtual' ? r.meta.serverPeerId ?? UNKNOWN_PROVIDER : null
  }

  /** Node exchange with another `.fos` store on this machine, on its files, as this store (its member). */
  private localStoreTransport(peerId: string): NodeTransport {
    const io = this.config.localStores!
    return { capabilities: this.deviceCapabilities(), available: () => localStores(this.state.replica).some(s => s.peerId === peerId), attachment: () => [], request: async request => {
      const stored = await io.read(peerId)
      if (!stored) throw new Error('That store is not on this machine (or where it is is not known here yet).')
      const peer = loadReplica(stored), before = peer.store.rootNodeId
      const served = exchangeNode(peer, request, { peerId: this.state.replica.meta.peerId, scope: [], capabilities: this.deviceCapabilities() }, this.now())
      if (served.replica.store.rootNodeId !== before) await io.write(peerId, serializeReplica(served.replica))
      return served.node
    } }
  }

  private localSyncing = false
  private hasHeldNodes(): boolean { return !!this.config.localStores && Object.keys(this.state.replica.meta.heldNodes ?? {}).length > 0 }

  /**
   * Edits to nodes opened from another store on this machine go back to it node by node (`planNodeSync` ->
   * `nodeSyncPush` -> `finishNodeSync` through that store's transport), and what changed there comes in: every loaded
   * node below each one opened (`meta.heldNodes`).
   */
  private async syncLocalStores(pullOnly: boolean): Promise<void> {
    for (const [alias, held] of Object.entries(this.state.replica.meta.heldNodes ?? {})) {
      const found = findRowByAlias(this.state.replica.store, headCid(this.state.replica), alias)
      if (!found) continue
      const root = [...found.path, alias], provider = this.transportTo(root, held.peer), store = this.state.replica.store
      if (!provider) continue
      for (const path of materializedNodePaths(this.state.replica, root, held.peer)) {
        if (this.state.replica.store !== store) return
        const plan = planNodeSync(this.state.replica, path, { peer: held.peer, scope: [], remoteRoot: held.scope, localRoot: root, branches: [], push: !pullOnly })
        try {
          const remote = await provider.request(plan.first)
          const step = nodeSyncPush(this.state.replica, plan, remote, this.now())
          this.set({ replica: step.replica })
          const accepted = step.update ? await provider.request(step.update) : remote
          this.set({ replica: finishNodeSync(this.state.replica, plan, accepted, this.now()) })
        } catch (error) { this.notify('error', `${found.row.title || 'A linked store'}: ${error instanceof Error ? error.message : String(error)}`); return }
      }
    }
  }
  reloadReplica(): void {
    const replica = this.documentReplica(this.withRootContext(loadReplica(this.config.storage.loadReplica())))
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
  /** The read / write / execute grants a peer holds at the context node (the nearest member binding). */
  peerGrants(peerId: string, path = this.peerContextPath()): Grant[] {
    const member = [...contextMembers(this.state.replica, path)].reverse().find(m => m.peerId === peerId)
    if (!member) return []
    return GRANTS.filter(g => member.capabilities.includes(g) && !member.disabled?.includes(g))
  }
  /** Everything the peer may do here (the toggles plus what they imply, such as approve with write), for acting as that peer. */
  peerCapabilities(peerId: string, path = this.peerContextPath()): Capability[] {
    const member = [...contextMembers(this.state.replica, path)].reverse().find(m => m.peerId === peerId)
    return member ? member.capabilities.filter(c => !member.disabled?.includes(c)) : []
  }
  /** Toggle one grant for a peer here; a peer with no member binding yet gets one. Other capabilities it holds stay. */
  setPeerGrant(peerId: string, grant: Grant, on: boolean): void {
    if (!this.canApprove()) { this.notify('error', 'Only the owner of this node (or a member who may approve) changes what peers get here.'); return }
    const path = this.peerContextPath()
    const member = [...contextMembers(this.state.replica, path)].reverse().find(m => m.peerId === peerId)
    const provider = this.contextPeers().find(p => p.id === peerId)
    let r = this.state.replica
    if (!contextMemberRefs(r, path).has(peerId)) r = addMemberAt(r, path, peerId, provider?.name ?? peerId, [], this.now())
    const capabilities = new Set<Capability>(member?.capabilities ?? [])
    const caps: Capability[] = [grant]
    for (const cap of caps) { if (on) capabilities.add(cap); else capabilities.delete(cap) }
    const disabled = (member?.disabled ?? []).filter(c => !caps.includes(c))
    this.edit(setMemberCapabilitiesAt(r, path, peerId, [...capabilities], disabled, this.now(), member?.accepts ?? provider?.integration?.provides ?? provider?.accepts ?? []))
    this.syncLocalMcp()
  }
  /** Green: reachable and granted something here; orange: granted but unreachable; grey: nothing granted (the device and the account are always their own). */
  peerStatus(peer: ContextPeer): PeerStatus {
    if (peer.isAccount || peer.id === this.state.replica.meta.peerId) return peer.online ? 'online' : 'offline'
    if (!this.peerGrants(peer.id).length) return 'disabled'
    return peer.online ? 'online' : 'offline'
  }
  /** The device's MCP endpoint for the viewed node follows the `mcp:local` grants: started while any is on, stopped when all are off. */
  syncLocalMcp(): void {
    if (!inTauri() || this.virtualIdentity) return
    const scope = [...this.state.view], grants = this.peerGrants('mcp:local', scope)
    void (grants.length ? ensureLocalMcp(this, scope) : stopLocalMcp(this))
  }
  /** Which agent CLIs this computer has (desktop only): a PATH query, refreshed at startup. */
  async probeLocalAgents(): Promise<void> {
    if (!inTauri()) return
    try {
      const found = await tauriInvoke<{ claude: string | null; codex: string | null; vscode?: { claude?: boolean }; claudeDesktop?: boolean }>('agent_clis')
      const names = { claude: 'Claude Code', codex: 'Codex' } as const
      const agents: LocalAgent[] = (['claude', 'codex'] as const).flatMap(provider => found?.[provider] ? [{ provider, name: names[provider], path: found[provider]!, ...(provider === 'claude' && found.vscode?.claude ? { vscode: true } : {}) }] : [])
      const claudeDesktop = !!found?.claudeDesktop
      if (JSON.stringify(agents) !== JSON.stringify(this.state.localAgents) || claudeDesktop !== this.state.claudeDesktop) this.set({ localAgents: agents, claudeDesktop })
    } catch { /* no desktop shell, or the command is unavailable: no local agents */ }
  }
  start(): void {
    void this.probeLocalAgents()
    if (!this.triggerTimer) {
      this.triggerTimer = setInterval(() => { void this.runTriggers(); void runProjectWorkflows(this).catch(error => this.notify('error', String(error))) }, 1000)
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

  /** The password typed at registration or sign-in, kept only until the confirmation code signs the account in. */
  private pendingPassword: string | null = null
  setAuthFlow(flow: AuthFlow): void { this.set({ authFlow: flow, loginError: null }) }
  /** Create the account; the server sends a code to its email or phone and the form moves to the code step. */
  async registerAccount(input: RegistrationInput): Promise<void> {
    const generation = this.authGeneration
    this.set({ loginError: null })
    try {
      const pending = await register(this.config.baseUrl, { ...input, username: input.username.trim() })
      if (generation !== this.authGeneration) return
      this.pendingPassword = input.password
      this.set({ authFlow: { phase: 'confirm', username: pending.username, channel: pending.pending, destination: pending.destination, notice: pending.error } })
    } catch (error) { if (generation === this.authGeneration) this.set({ loginError: error instanceof Error ? error.message : String(error) }) }
  }
  /** The code from the email or text: confirms the account, then signs in with the password typed before. */
  async confirmAccount(code: string): Promise<void> {
    const flow = this.state.authFlow
    if (flow.phase !== 'confirm') return
    this.set({ loginError: null })
    try {
      await confirmAccount(this.config.baseUrl, { username: flow.username, code: code.trim() })
      if (this.pendingPassword) { const password = this.pendingPassword; this.pendingPassword = null; await this.login(flow.username, password) }
      else { this.set({ authFlow: { phase: 'signin' } }); this.notify('info', 'Account confirmed. Sign in to continue.') }
    } catch (error) { this.set({ loginError: error instanceof Error ? error.message : String(error) }) }
  }
  /** The one-click link from the confirmation email (?confirm-email-token=…). */
  async confirmWithToken(token: string): Promise<void> {
    try {
      const result = await confirmAccount(this.config.baseUrl, { token })
      this.set({ authFlow: { phase: 'signin' }, modal: this.state.session ? this.state.modal : 'connect' })
      this.notify('info', result.already ? 'This account was already confirmed.' : `Account${result.username ? ` @${result.username}` : ''} confirmed. Sign in to continue.`)
    } catch (error) { this.set({ modal: 'connect', loginError: error instanceof Error ? error.message : String(error) }) }
  }
  async resendConfirmation(): Promise<void> {
    const flow = this.state.authFlow
    if (flow.phase !== 'confirm') return
    try {
      const sent = await resendConfirmation(this.config.baseUrl, flow.username)
      this.set({ authFlow: { ...flow, destination: sent.destination ?? flow.destination, notice: `A new code is on its way to ${sent.destination ?? flow.destination ?? 'you'}.` }, loginError: null })
    } catch (error) { this.set({ loginError: error instanceof Error ? error.message : String(error) }) }
  }
  async requestPasswordReset(username: string): Promise<void> {
    try { await requestPasswordReset(this.config.baseUrl, username.trim()); this.set({ authFlow: { phase: 'forgot', sent: true }, loginError: null }) }
    catch (error) { this.set({ loginError: error instanceof Error ? error.message : String(error) }) }
  }
  async completePasswordReset(username: string, password: string, confirm: string): Promise<void> {
    const flow = this.state.authFlow
    if (flow.phase !== 'reset') return
    if (password !== confirm) { this.set({ loginError: 'Passwords do not match' }); return }
    try {
      await completePasswordReset(this.config.baseUrl, { token: flow.token, username: username.trim(), password })
      this.set({ authFlow: { phase: 'signin' }, loginError: null }); this.notify('info', 'Password updated. Sign in with it.')
    } catch (error) { this.set({ loginError: error instanceof Error ? error.message : String(error) }) }
  }
  async copyNodeLink(path: Scope): Promise<void> {
    try { await navigator.clipboard.writeText(`fos-ref:${encodeURIComponent(path.at(-1)!)}`); this.notify('info', 'Reference copied. Paste into a blank row in this workspace.') }
    catch { this.notify('error', 'Clipboard access failed. Allow clipboard access and try again.') }
  }
  pasteNodeLink(at: Scope, id: string | null, targetId: string): void {
    const target = findRowByAlias(this.state.replica.store, headCid(this.state.replica), targetId)
    if (!target) { this.notify('error', 'This reference is not available in this workspace.'); return }
    const parent = [...this.state.view, ...at]
    if (parent.includes(targetId) || id === targetId) { this.notify('error', 'A node cannot contain a reference to itself.'); return }
    try {
      this.together(() => {
        let r = addRef(this.state.replica, parent, targetId, this.now(), id ? { relativeTo: id, position: 'below' } : undefined)
        if (id) r = deleteTask(r, parent, id, this.now())
        this.edit(r); this.select(null)
      })
    } catch (error) { this.notify('error', String(error)) }
  }
  pasteRows(rows: import('./rows').ParsedInput[], at: Scope, id?: string): void {
    this.together(() => {
      if (id) {
        const first = rows[0]!
        this.rewriteRowAt(at, id, first)
        rows = rows.slice(1)
      }
      let previous = id
      for (const row of rows) {
        const created = this.addRowAt(at, row.type, row.text, { done: row.done, extras: row.extras, templateName: row.templateName, preserveUnbound: true, ...(previous ? { position: { relativeTo: previous, position: 'below' as const } } : {}) })
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
    const template = row?.template && findRowByAlias(this.state.replica.store, headCid(this.state.replica), row.template.id)
    if (template) { this.closeModal(); this.goTo([...template.path, template.row.id]) }
    else if (row?.type === TEMPLATE_TYPE) { this.closeModal(); this.goTo(path) }
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
      // the right password for an account that has not confirmed its email or phone: offer the code step
      if (error instanceof ApiError && error.code === 'unconfirmed' && !automatic) {
        this.pendingPassword = password
        const channel = error.details.channel === 'phone' ? 'phone' : 'email', destination = typeof error.details.destination === 'string' ? error.details.destination : null
        this.set({ connection: 'offline', session: null, loginError: null, authFlow: { phase: 'confirm', username: username.trim(), channel, destination } })
        return
      }
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
    if (session.kind === 'user' && !this.config.project && !this.config.scopedDocument && attachment.scope.length === 1 && attachment.scope[0] === homePath(this.state.replica)[0]) { attachment.scope = []; attachment.scopeNames = [] }
    if (generation !== this.authGeneration) return
    let replica = this.state.replica
    const same = replica.meta.scope.length === attachment.scope.length && replica.meta.scope.every((s, i) => attachment.scope[i] === s)
    if (!same && (!hasSynced(replica) || session.kind === 'peer')) {
      // A fresh link at the assigned node: local work merges into it on the first sync.
      replica = { store: replica.store, meta: { ...replica.meta, scope: attachment.scope, scopeNames: attachment.scopeNames } }
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
    const replica = this.documentReplica(this.withRootContext(loadReplica(this.config.storage.loadReplica())))
    const prefs = (this.config.storage.loadPrefs() ?? {}) as { branches?: Record<string, string>; collapsed?: string[]; policy?: unknown; deviceName?: string }
    this.branchSelections = prefs.branches ?? {}
    this.repositories.clear()
    this.repositoryPollAt = 0
    this.set({ replica, session: null, view: this.savedHomeView(replica), selected: null, atRoot: false,
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
        const result = exchangeNode(this.state.replica, effective, { peerId: `user:${session.username}`, scope: providerScope, owner: true, capabilities: this.deviceCapabilities() }, this.now())
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
    if (!this.transport() && !this.hasHeldNodes()) return
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
    // nodes opened from other stores on this machine sync with them, signed in or not
    if (this.hasHeldNodes() && !this.localSyncing) {
      this.localSyncing = true
      try { await this.syncLocalStores(pullOnly) } finally { this.localSyncing = false }
    }
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
      await this.syncSharedNodes(pullOnly)
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
    let peer = transport === 'virtual' ? initial.meta.serverPeerId : this.attachmentPeer()
    const connection = this.transportTo(localRoot, peer)
    if (!connection) throw new Error('No connection here reaches the peer this device syncs with.')
    const address = [...initial.meta.scope, ...localRoot], scope = connection.attachment(address)
    const remoteRoot = transport === 'account' && session?.kind === 'user' ? address : scope
    const send = (request: NodeRequest) => connection.request(request)
    const valid = () => generation === this.authGeneration && session === this.state.session && store === this.state.replica.store && dataSession === this.activeDataSession()?.id && branch === this.currentBranch() && selection === JSON.stringify(this.branchSelections)
    const push = !pullOnly && (transport === 'account' ? this.state.policy.to.includes('autopush') : transport === 'virtual' ? this.virtualCapabilities.includes('edit') : true)
    // Member entries are children of their node: an entry syncs with a node that syncs (it is policy, small), and this
    // device's own entries sync with everything in them (what peers left for it, its relay queues). Other rows stay
    // lazy until they are on screen.
    const onScreen = (path: Scope) => path.length === localRoot.length || (path.length <= this.state.view.length && path.every((id, i) => id === this.state.view[i]))
    // a path into one of this device's own memberships, at any node
    const own = (path: Scope) => path.some((_, i) => memberEntryPeerAt(this.state.replica.store, headCid(this.state.replica), path.slice(0, i + 1)) === initial.meta.peerId)
    const eager = (path: Scope) => own(path) || (memberEntryPeerAt(this.state.replica.store, headCid(this.state.replica), path) !== null && onScreen(path.slice(0, -1)))
    const queue = materializedNodePaths(initial, localRoot, peer), seen = new Set<string>()
    // a row's handler state (its execute row, its trigger row) syncs whenever the row does: it is that row's state
    const state = new Set<string>()
    while (queue.length) {
      const path = queue.shift()!
      if (seen.has(JSON.stringify(path))) continue
      seen.add(JSON.stringify(path))
      if (!valid()) return
      const r = this.state.replica
      if (!resolveScope(r.store, headCid(r), path)) continue
      const branches: import('../../shared/sync/index').NodeBranch[] = []
      if (branch) branches.push({ scope: remoteRoot, name: branch })
      const selected = scopeBranches(r.store, headCid(r), path)
      for (let i = localRoot.length; i <= path.length; i++) {
        const name = selected[path[i - 1]!] ?? this.branchSelections[path[i - 1]!]
        const at = [...remoteRoot, ...path.slice(localRoot.length, i)]
        if (name && !branches.some(b => JSON.stringify(b.scope) === JSON.stringify(at))) branches.push({ scope: at, name })
      }
      if (transport === 'account' && !nodePersistenceAllowed(r, path)) {
        // Fos storage switched off here: the node is sent blank; the account keeps its history and holds it as ours
        const blank = push ? blankNodeRequest(r, path, { peer, scope, remoteRoot, localRoot, branches, push }) : null
        if (blank) { const answer = await send(blank); if (!valid()) return; this.set({ replica: finishBlankNode(this.state.replica, path, answer) }) }
        continue
      }
      const plan = planNodeSync(r, path, { peer, scope, remoteRoot, localRoot, branches, push })
      const visible = onScreen(path) || eager(path) || state.has(JSON.stringify(path))
      if (!visible && !(push && plan.dirty)) continue
      const remote = await send(plan.first)
      if (!valid()) return
      const step = nodeSyncPush(this.state.replica, plan, remote, this.now())
      peer = step.peer
      const offered = transport === 'account' && remote.capabilities ? this.withServerOffers(step.replica, remote.capabilities) : step.replica
      this.set({ replica: offered, ...(transport === 'account' && remote.capabilities ? { serverCapabilities: [...remote.capabilities] } : {}), ...(transport === 'account' && remote.presence ? { onlinePeers: [...remote.presence] } : {}) })
      const finalRemote = step.update ? await send(step.update) : remote
      if (!valid()) return
      this.set({ replica: finishNodeSync(this.state.replica, plan, finalRemote, this.now()) })
      const templates = nodeTemplateRequests(this.state.replica, plan, finalRemote)
      if (templates.ask) {
        const reply = await send(templates.ask)
        if (!valid()) return
        if (reply.templates) this.set({ replica: acceptTemplateNodes(this.state.replica, path, reply.templates, this.now()) })
      }
      if (templates.answer) await send(templates.answer)
      // the entries the peer listed here (arrived unloaded or changed), and what lies in this device's own entries
      for (const child of finalRemote.children) {
        if (child.pinned || (child.held && child.address.peerId !== finalRemote.peerId)) continue
        const next = [...path, child.id]
        const held = isHandlerStateLeft(this.state.replica.store, child.template) && (visible || plan.dirty)
        if (held) state.add(JSON.stringify(next))
        if (child.peer !== undefined ? visible || child.peer === initial.meta.peerId : eager(next) || held) queue.push(next)
      }
    }
    // an owner's device attached at Home takes its server's own entry above it (its offers, its published key)
    const above = transport === 'account' && session?.kind === 'user' ? accountContextAbove(this.state.replica) : []
    for (const at of above) {
      const membership = valid() && resolveScope(this.state.replica.store, headCid(this.state.replica), at) ? membershipSyncContext(this.state.replica, at, peer) : null
      if (!membership) continue
      const done = await syncNodeTree(this.state.replica, membership, send, () => this.now())
      if (!valid()) return
      this.set({ replica: done.replica })
    }
  }

  // -------------------------------------------------------------------------
  // Nodes other accounts shared with this one

  /** The shared projection a path lies in, if any: whose node, where it lives in their account, and its local root. */
  sharedNodeAt(path: Scope): { owner: string; scope: Scope; root: Scope } | null {
    for (const [key, info] of Object.entries(this.state.replica.meta.sharedNodes ?? {})) {
      const root = JSON.parse(key) as Scope
      if (root.length <= path.length && root.every((id, i) => path[i] === id)) return { ...info, root }
    }
    return null
  }
  /** What the owner granted this account on a shared node (from the last pull). */
  sharedGrants(path: Scope): Capability[] | null {
    const shared = this.sharedNodeAt(path)
    if (!shared) return null
    return this.state.replica.meta.nodeSync?.[nodeSyncKey(`user:${shared.owner}`, shared.root)]?.remote.grants ?? null
  }
  /**
   * Open a node another account shared with this one (a ref row with `refOwner`): it becomes a live projection, like a
   * peer-held node, provided by the account server as that account's peer `user:<me>`. Edits sync back as proposals,
   * Run goes to the owner's host (with the `execute` grant), Analyze reads what is loaded. Without a grant (a market
   * listing only) the read-only market view opens instead.
   */
  async openSharedNode(path: Scope, navigate = true): Promise<void> {
    const session = this.state.session, r = this.state.replica
    const row = view(r, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1))
    if (!row?.refOwner || !row.refId) return
    if (!session || session.kind !== 'user' || !this.isOnline('fos')) { if (navigate) { this.notify('error', 'Connect to your account to open a node shared with you.'); this.openModal('connect') } return }
    if (this.isPeerNode(path)) { if (navigate) this.goTo(path); return }
    let located: Awaited<ReturnType<typeof locateSharedNode>>
    try { located = await locateSharedNode(session, row.refOwner, row.refId) }
    catch (error) {
      if (error instanceof ApiError && error.status === 403) { await this.openMarket(row.refOwner, row.refId, row.title); return }
      this.notify('error', error instanceof Error ? error.message : String(error)); return
    }
    const owner = located.owner, peer = `user:${owner}`
    this.set({ replica: offerNodeTransport(this.state.replica, peer, this.sharedAccountTransport(session, owner), this.now()) }, false)
    const provider = this.transportTo(path, peer)
    if (!provider) { if (navigate) this.notify('error', 'Connect to your account to open a node shared with you.'); return }
    const request: NodeRequest = { peerId: r.meta.peerId, scope: located.path, path: [], linkId: nodeLinkEndpoint(r, path, peer)?.id ?? nodeRequestLinkId(r.meta.peerId, { peerId: peer, scope: located.path }) }
    try {
      const node = await pullNode(request, [provider])
      if (this.state.replica.store !== r.store || this.state.session !== session) return
      let next = rememberNodeSync(acceptProvidedNode(this.state.replica, path, request, node, this.now()), path, node)
      next = { ...next, meta: { ...next.meta, sharedNodes: { ...next.meta.sharedNodes, [JSON.stringify(path)]: { owner, scope: located.path } } } }
      this.set({ replica: next })
      if (navigate) { this.goTo(path); this.notify('info', `Shared by @${owner}: you can ${(node.grants ?? []).map(g => capabilityLabels(this.state.replica.store, path)[g] ?? g).join(', ') || 'read'} here.`) }
      // a library is used offline: pull all of it, not just the node being looked at
      if (this.isLibrary(path)) void this.materializeSharedTree(path)
    } catch (error) { if (navigate) this.notify('error', error instanceof Error ? error.message : String(error)) }
  }
  /** Pull every node below a shared projection (its stubs are peer references loaded one by one) so it is complete offline. */
  private async materializeSharedTree(root: Scope, limit = 500): Promise<void> {
    const store = this.state.replica.store, queue: Scope[] = [root]
    let loaded = 0
    while (queue.length && loaded < limit) {
      const at = queue.shift()!
      if (this.state.replica.store !== store) return
      const cid = resolveScope(this.state.replica.store, headCid(this.state.replica), at)
      if (!cid) continue
      if (isPeerReference(content(this.state.replica.store, cid))) {
        await this.loadPeerNode(at, true); loaded++
        // Keep background loading responsive without rendering the entire library
        // once for every property. State and storage still update for each reply.
        if (loaded % 25 === 0) { this.refresh(); await new Promise(resolve => setTimeout(resolve, 0)) }
      }
      for (const row of view(this.state.replica, at)?.tasks ?? []) if (row.refId === undefined || row.refPeer) queue.push([...at, row.id])
    }
    this.refresh()
  }
  /** Shared projections sync with their owner's account as `user:<me>`: pulls, and pushes of local edits as proposals there. */
  private async syncSharedNodes(pullOnly: boolean): Promise<void> {
    const session = this.state.session, generation = this.authGeneration
    if (!session || session.kind !== 'user' || this.transport() !== 'account') return
    // a library referenced here is used offline: keep all of it current, not just the nodes looked at
    for (const key of Object.keys(this.state.replica.meta.sharedNodes ?? {})) { const root = JSON.parse(key) as Scope; if (this.isLibrary(root)) void this.materializeSharedTree(root) }
    const store = this.state.replica.store
    const valid = () => generation === this.authGeneration && session === this.state.session && store === this.state.replica.store
    for (const [key, info] of Object.entries(this.state.replica.meta.sharedNodes ?? {})) {
      const root = JSON.parse(key) as Scope, peer = `user:${info.owner}`, connection = this.transportTo(root, peer)
      if (!connection || !resolveScope(this.state.replica.store, headCid(this.state.replica), root)) continue
      for (const path of materializedNodePaths(this.state.replica, root, peer)) {
        if (!valid()) return
        let r = this.state.replica
        if (!resolveScope(r.store, headCid(r), path)) continue
        const remotePath = path.slice(root.length)
        const state = r.meta.nodeSync?.[nodeSyncKey(peer, path)]
        const local = nodeShape(r, path)
        let baseline = state?.local ?? local
        const request = nodeSyncRequest(r, path, peer, info.scope, remotePath)
        try {
          // rows this account pushed come back held by it (`user:<me>`): they are its own rows
          const selves = [`user:${session.username}`, r.meta.peerId]
          let remote = ownHeldChildren(await connection.request(request), selves)
          if (!valid()) return
          validateNodeShape(remote)
          if (remote.peerId !== peer || remote.remoteLinkId !== request.linkId) throw new Error('Node response does not match its attachment.')
          // a row added here and never synced: the owner holds it blank, so all of it is this round's change
          if (!state && isBlankShape(remote)) baseline = remote
          const dirty = !pullOnly && !sameNodeShape(local, baseline)
          r = establishNodeSync(this.state.replica, path, request, remote, this.now())
          const outgoingBase = outgoingNodeShape(r, path, peer, baseline), outgoing = outgoingNodeShape(r, path, peer, local)
          if (dirty && !sameNodeShape(outgoingBase, outgoing)) {
            remote = ownHeldChildren(await connection.request({ ...request, update: { base: remote, value: mergeNodeShape(outgoingBase, outgoing, remote) } }), selves)
            if (!valid()) return
            validateNodeShape(remote)
          }
          const current = nodeShape(r, path)
          const accepted = mergeNodeShape(outgoingNodeShape(r, path, peer, state?.remote ?? baseline), outgoingNodeShape(r, path, peer, remote), local)
          const merged = mergeNodeShape(local, accepted, current)
          if (!sameNodeShape(current, merged)) r = installNodeShape(r, path, merged, this.now())
          this.set({ replica: rememberNodeSync(r, path, remote, accepted) })
        } catch (error) { this.notify('error', `@${info.owner}'s node: ${error instanceof Error ? error.message : String(error)}`); return }
      }
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
   * Add a row of `type` (a library row type id or a type cid) under `at` (relative to the view). Comments carry this device as the author; an allocation
   * draws from the parent context (`bankFor`); a task naming a template executes it (its requirements are copied
   * underneath); a task requirement naming a template gets that execution as its child right away.
   */
  addRowAt(at: Scope, type: string, text: string, options: { done?: boolean; refId?: string; position?: MovePosition; id?: string; extras?: RowInputExtras; templateName?: string; replica?: Replica; preserveUnbound?: boolean } = {}): string {
    const author = { id: this.state.replica.meta.peerId, name: this.state.session?.username ?? this.state.deviceName }
    const id = options.id ?? crypto.randomUUID()
    const { extras, templateName, replica: branch, preserveUnbound: _preserveUnbound, ...rest } = options
    const replica = branch ?? this.state.replica
    const data: RowInputExtras = { ...(extras ?? {}) }
    const { demand, allocation, grant, ...rowExtras } = data
    let next: Replica, invocation: string | null = null
    // argument rows (a requirement, an allocation) are made by sync/arguments.ts; every other row by its library type
    if (demand || allocation) next = this.argumentRowReplica(replica, [...this.state.view, ...at], id, text, data, rest.position)
    else if (type === RESOURCE_TYPE) {
      // a bank declares the contract its grants are checked by
      next = addBank(replica, [...this.state.view, ...at], text, this.now(), rowExtras.resource ?? { type: 'inventory', unit: 'unit' }, id)
      if (rest.position && 'relativeTo' in rest.position) next = moveNode(next, [...this.state.view, ...at], id, [...this.state.view, ...at], rest.position, this.now())
    }
    else next = addRow(replica, [...this.state.view, ...at], type, text, this.now(), { ...rest, ...rowExtras, author, id })
    // The amount typed on a new bank is authority only once its issuing invocation is evaluated by the allocate handler its scope resolves.
    if (type === RESOURCE_TYPE && grant && grant.amount > 0) {
      invocation = newId()
      try { next = issueGrant(next, [...this.state.view, ...at, id], grant, this.now(), undefined, invocation) }
      catch (error) { invocation = null; this.notify('error', `The bank holds no spendable authority: ${error instanceof Error ? error.message : String(error)}`) }
    }
    if (!branch) this.edit(next)
    if (!branch && invocation) this.queueEvaluation([...this.state.view, ...at, invocation])
    if (!branch && text.trim().includes('\n')) this.titleFromText([...this.state.view, ...at, id])
    this.resolveUser(data.user)
    if (templateName && type === TASK_TYPE) this.applyTemplate(at, id, templateName, branch)
    if (templateName && demand?.capability === 'task') {
      // "-[ ] `name`": the required task is created at once as an execution of the template
      const child = this.addRowAt([...at, id], TASK_TYPE, templateName, { templateName, replica: branch })
      if (!branch) this.set({ collapsed: this.state.collapsed.filter((c) => c !== id && c !== child) })
    }
    return id
  }
  /**
   * The argument row `id` under `parent` (an absolute path) as `extras` say: a requirement asking for `demand`, or an
   * allocation holding the typed amount (data, not authority: a bank's grants move through `consumeAllocation`). An
   * existing row of that id is replaced (argument rows have no in-place edit: their pattern is their type).
   */
  argumentRowReplica(replica: Replica, parent: Scope, id: string, text: string, extras: RowInputExtras, position?: MovePosition): Replica {
    const now = this.now()
    let r = replica
    const existing = view(r, parent)?.tasks.find(row => row.id === id)
    if (existing) r = deleteTask(r, parent, id, now)
    if (extras.demand) r = addRequirement(r, parent, text, now, extras.demand, id)
    else if (extras.allocation) r = addAllocation(r, parent, text, now, this.allocationWithBank(parent, extras.allocation, r, extras.user?.username), { id })
    else throw new Error('An argument row asks for or supplies a value.')
    if (position && 'relativeTo' in position && position.relativeTo !== id) r = moveNode(r, parent, id, parent, position, now)
    if (extras.user) r = bindUserAt(r, [...parent, id], cachedUser(r, extras.user.username) ?? extras.user, now)
    return r
  }
  /** The row at `path` as a bank: its value declares the allocate contract of its scope (what `addBank` does for a new row). */
  bankReplica(r: Replica, path: Scope): Replica {
    const store = r.store
    return editValue(r, path, this.now(), value => ownerContract(store, value) ? value : { ...value, children: [...value.children, contractPin(store, allocateCapability(store, path.slice(0, -1)))] })
  }
  /** Evaluations the UI starts one after another (a bank's issuing invocations); each waits for the one before it. */
  private evaluationQueue: Promise<void> = Promise.resolve()
  queueEvaluation(path: Scope): Promise<void> {
    this.evaluationQueue = this.evaluationQueue.then(() => this.evaluateAt(path)).catch(() => undefined)
    return this.evaluationQueue
  }
  /** Make the task `taskId` an execution of the template called `name`: its requirement rows are copied underneath, unfilled. */
  applyTemplate(at: Scope, taskId: string, name: string, branch?: Replica): void {
    const replica = branch ?? this.state.replica
    const template = findTemplateByName(replica, name, [...this.state.view, ...at])
    if (!template) { this.notify('error', `No template called “${name}”. Make one with a \`${name} row and put its requirements (- …) inside.`); return }
    const next = instantiateTemplateValue(replica, [...this.state.view, ...at], taskId, template.cid, this.now())
    if (!branch) this.edit(next)
    if (!branch) this.set({ collapsed: this.state.collapsed.filter((c) => c !== taskId) })
  }
  /** The row `at` points at (relative to the view), if any. */
  rowAt(at: Scope): TaskView | null {
    const id = at[at.length - 1]
    if (!id) return null
    return view(this.state.replica, [...this.state.view, ...at.slice(0, -1)], true)?.tasks.find((t) => t.id === id) ?? null
  }
  /** Resolve a resource handler in the allocation's parent scope; multiple handlers require a choice. */
  bankFor(at: Scope, type?: ResourceType | null, person?: string, replica = this.state.replica): (TaskView & { resource: NonNullable<TaskView['resource']> }) | null {
    const path = [...this.state.view, ...at]
    const handlers = resourceHandlers(replica, path).filter(({ row }) =>
      (!type || row.resource.type === type) && (type !== 'person' || !person || row.title.trim().toLowerCase() === person.toLowerCase()))
    // Distinct handlers are a choice; traversal order must not select a bank.
    return handlers.length === 1 ? handlers[0]!.row : null
  }
  /**
   * An allocation with its bank resolved from the parent context (`bankFor`), or null (with a notice) when there is
   * none. A person allocation needs that person's bank only when it holds a window; otherwise it stands on its own.
   */
  allocationWithBank(parent: Scope, allocation: Allocation, replica = this.state.replica, person?: string): Allocation {
    const by = this.state.session?.username ?? this.state.deviceName
    const at = parent.slice(this.state.view.length)
    const bank = parent.every((id, i) => this.state.view[i] === id) ? this.bankFor(at, allocation.type, person, replica) : null
    return { ...allocation, resource: '', by, ...(bank && allocation.unit === 'unit' ? { unit: bank.resource.unit } : {}) }
  }
  /**
   * A row's text was edited in its raw marker form: re-parse it and rewrite the row in place (type, text, data),
   * keeping its id and children. Templates named in the text are applied as for a new row.
   */
  dropBlankRow(parent: Scope, id: string, store: Replica['store']): void {
    if (store !== this.state.replica.store) return
    const row = view(this.state.replica, parent)?.tasks.find((t) => t.id === id)
    if (row?.type === PLAIN_TYPE && !row.fields && !row.scalar && !this.rowInputs([...parent, id]) && !row.title.trim() && !row.childCount && !row.childChoices) this.edit(deleteTask(this.state.replica, parent, id, this.now()))
  }
  rewriteRowAt(at: Scope, id: string, parsed: import('./rows').ParsedInput, draft?: { store: Replica['store']; head: string; parent: Scope }): void {
    if (this.isHome([...this.state.view, ...at, id])) return
    if ((parsed.children?.length || parsed.peer !== undefined) && !this.groupedEdit) { this.together(() => this.rewriteRowAt(at, id, parsed, draft)); return }
    if (draft && draft.store !== this.state.replica.store) return
    const extras: RowInputExtras = { ...(parsed.extras ?? {}), done: parsed.done }
    const argument = isArgumentInput(parsed)
    this.resolveUser(parsed.extras?.user)
    const before = this.rowAt([...at, id])
    // a reference keeps its type and data: its text is all an edit changes
    const renameOnly = !!before && parsed.type === before.type && before.refId !== undefined
    const rebasing = !!draft && draft.head !== headCid(this.state.replica)
    if (rebasing) {
      let branch = createReplica(this.state.replica.meta.peerId)
      importNodes(branch.store, reachableNodes(draft.store, [draft.head]))
      commitRoot(branch.store, draft.head, this.now())
      for (const [id, name] of Object.entries(this.branchSelections)) selectBranch(branch.store, id, name)
      branch = argument ? this.argumentRowReplica(branch, draft.parent, id, parsed.text, extras) : renameOnly ? renameTask(branch, draft.parent, id, parsed.text, this.now()) : setRowContentAt(branch, draft.parent, id, parsed.type, parsed.text, extras, this.now())
      if (parsed.type === RESOURCE_TYPE && !renameOnly) branch = this.bankReplica(branch, [...draft.parent, id])
      if (parsed.peer !== undefined || before?.construction?.handler) branch = this.peerRowReplica(branch, [...draft.parent, id], parsed.peer)
      if (parsed.children?.length) this.addParsedChildren([...at, id], parsed.children, branch)
      const current = this.state.replica
      importNodes(current.store, reachableNodes(branch.store, [headCid(branch)]))
      const merged = mergeNodes(current.store, draft.head, headCid(current), headCid(branch), { ours: 'Incoming edit', theirs: this.state.deviceName })
      commitRoot(current.store, merged.cid, this.now())
      this.edit({ ...current })
      if (merged.newChoiceCids.length) { this.notify('info', 'This row changed in two places. Choose which version to keep.'); return }
    } else {
      let next = argument ? this.argumentRowReplica(this.state.replica, [...this.state.view, ...at], id, parsed.text, extras) : renameOnly ? renameTask(this.state.replica, [...this.state.view, ...at], id, parsed.text, this.now()) : setRowContentAt(this.state.replica, [...this.state.view, ...at], id, parsed.type, parsed.text, extras, this.now())
      if (parsed.type === RESOURCE_TYPE && !renameOnly) next = this.bankReplica(next, [...this.state.view, ...at, id])
      this.edit(next)
      if (parsed.text.includes('\n')) this.titleFromText([...this.state.view, ...at, id])
    }
    if ((parsed.peer !== undefined || before?.construction?.handler) && !rebasing) this.setPeerRow([...this.state.view, ...at, id], parsed.peer)
    if (parsed.children?.length && !rebasing) this.addParsedChildren([...at, id], parsed.children)
    if (parsed.templateName && parsed.type === TASK_TYPE && before?.template?.name !== parsed.templateName) this.applyTemplate(at, id, parsed.templateName)
    if (parsed.templateName && extras.demand?.capability === 'task') {
      const inside = view(this.state.replica, [...this.state.view, ...at, id])?.tasks ?? []
      if (!inside.some((t) => t.checkable && t.template?.name === parsed.templateName)) this.addRowAt([...at, id], TASK_TYPE, parsed.templateName, { templateName: parsed.templateName })
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
        if (row.type === RESOURCE_TYPE && row.resource) out.push({ row: row as TaskView & { resource: NonNullable<TaskView['resource']> }, path })
        if (row.childCount) walk([...path, row.id])
      }
    }
    walk([])
    return out
  }
  /** Resource handlers available through the same enclosing declarations as other capabilities. */
  contextBanks(at: Scope = this.state.view): Array<{ row: TaskView & { resource: NonNullable<TaskView['resource']> }; path: Scope }> {
    return resourceHandlers(this.state.replica, at).map(handler => ({ row: handler.row, path: handler.scope?.path ?? at }))
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
    // agent CLIs on this computer and the MCP servers are sub-peers that exist whether or not the node lists them as
    // members (a grant adds them as one); they come before the members so the member entry never shadows them
    // agent CLIs on this computer: local sub-peers of the device, read-only (masks apply to them like any peer)
    if (!this.virtualIdentity) for (const agent of this.state.localAgents) peers.push({ id: `agent-cli:${agent.provider}`, name: agent.name, online: true, capabilities: ['tool'], disabled: [], accepts: ['read'], isAccount: false, member: false, agentCli: { provider: agent.provider, path: agent.path, ...(agent.vscode ? { vscode: true } : {}) }, parent: 'device' })
    if (!this.virtualIdentity && this.state.claudeDesktop) peers.push({ id: 'agent-app:claude-desktop', name: 'Claude Desktop', online: true, capabilities: ['tool'], disabled: [], accepts: ['read'], isAccount: false, member: false, agentApp: 'claude-desktop', parent: 'device' })
    // MCP servers: the device's loopback endpoint for this node (desktop) and the account server's hosted one; what each exposes follows its grants here
    if (!this.virtualIdentity && !this.state.atRoot) {
      if (inTauri()) peers.push({ id: 'mcp:local', name: 'Local MCP server', online: true, capabilities: [], disabled: [], accepts: [], isAccount: false, member: false, mcpServer: { transport: 'desktop' }, parent: 'device' })
      if (session?.kind === 'user') peers.push({ id: 'mcp:server', name: 'Fos MCP server', online: this.isOnline('fos'), capabilities: [], disabled: [], accepts: [], isAccount: false, member: false, mcpServer: { transport: 'server' }, parent: 'server' })
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
    peers.push({ id: me, name: this.state.deviceName, online: true, capabilities: [], disabled: [], accepts: this.deviceCapabilities(), isAccount: false, member: false })
    // the other `.fos` stores on this machine (Home's, other projects') are this device's, not peers of their own
    for (const p of peers) if (!p.parent && p.id !== me && p.capabilities.includes('local')) p.parent = 'device'
    // audiences (anyone, every Fos user) are reached through the server
    for (const p of peers) if (!p.parent && p.id.startsWith('audience:')) p.parent = 'server'
    for (const p of peers) if (!p.parent && (p.integration || p.mcp || p.repository || p.fosUser)) p.parent = 'server'
    for (const p of peers) {
      const member = members.get(p.name === 'fos' ? 'fos' : p.id)
      if (member) { p.disabled = [...(member.disabled ?? [])]; p.accepts = [...(member.accepts ?? [])] }
    }
    return peers
  }
  /** Every capability a peer row can carry, for the owner's "add" control. */
  allCapabilities(): Capability[] { return [...new Set([...capabilityNames(this.state.replica.store, this.constructorContext()), ...this.handlerOffers().flatMap(offer => offer.capability ? [offer.capability] : [offer.type])])] }
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
    if (live) return live.filter((c): c is Capability => typeof c === 'string' && !!c)
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

  /** Stripe Connect onboarding (or the dashboard once onboarded), so this account can receive `-$` payments. */
  async setupPayouts(): Promise<void> {
    const session = this.state.session
    if (!session || session.kind !== 'user') { this.notify('error', 'Sign in to your fos account first; payouts attach to it.'); this.openModal('connect'); return }
    try {
      const base = location.origin + location.pathname
      const { url } = await createConnectSession(session, { success_url: `${base}?integration=stripe&ok=1`, cancel_url: `${base}?integration=stripe&ok=0&message=${encodeURIComponent('Payout setup was not completed.')}` })
      if (session !== this.state.session) return
      this.pendingIntegration = { id: 'stripe', session }
      const external = openExternal(url)
      if (external) await external; else location.assign(url)
    } catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)) }
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
        if (row.refId !== undefined && row.refOwner && row.refId && !out.some((l) => l.owner === row.refOwner && l.aliasId === row.refId)) out.push({ owner: row.refOwner, aliasId: row.refId, title: row.title })
        if (row.childCount) walk([...path, row.id])
      }
    }
    walk([])
    return out
  }
  /**
   * Who a row at `path` can be sent to through a relay (shared/sync/relay.ts): when a peer offers `relay` where the
   * row is, the peers that are members there or above (devices, agent peers, other accounts), but not this device, the
   * fos server, the market, audiences or integrations.
   */
  relayRecipients(path: Scope): Array<{ peerId: string; name: string }> {
    const r = this.state.replica, at = path.slice(0, -1)
    if (!path.length || !resolveScope(r.store, headCid(r), path) || !discoverHandlers(r, at).some(offer => offer.capability === 'relay' && offer.enabled)) return []
    const skip = (peer: string) => peer === r.meta.peerId || peer === 'fos' || peer === MARKET_PEER || /^(audience|integration|mcp):/.test(peer)
    return contextMembers(r, at).filter(m => !skip(m.peerId)).map(m => ({ peerId: m.peerId, name: m.name || m.peerId }))
  }
  /**
   * "Send to peer": the row moves into a relay message addressed to `peerId` (a row of the library's relay message
   * type) left where it was; the relay delivers it to that peer's queue under its member entry, which reaches the
   * peer by ordinary sync.
   */
  sendToPeer(path: Scope, peerId: string): void {
    const at = path.slice(0, -1), id = path.at(-1)!, now = this.now()
    const message = `relay:${id}:${now.toString(36)}`
    try {
      let r = addRelayMessage(this.state.replica, at, peerId, now, message)
      r = moveNode(r, at, id, at, { into: message }, now)
      this.edit(r)
      this.notify('info', `Left for ${this.relayRecipients([...at, message]).find(p => p.peerId === peerId)?.name ?? peerId} at the relay; it is delivered when they sync.`)
    } catch (error) { this.notify('error', `Could not send: ${error instanceof Error ? error.message : String(error)}`) }
  }
  /** What was delivered to this device: the unacknowledged messages in its queues here (its member entries' `relay:queue`). */
  relayInbox(): Array<RelayDelivery & { queue: Scope }> {
    const r = this.state.replica
    return relayQueues(r, r.meta.peerId).flatMap(queue => relayInbox(r, queue).map(delivery => ({ ...delivery, queue })))
  }
  /** Acknowledge a delivered message: an ack row in the queue; the relay takes both out after the next sync. */
  acknowledgeRelay(queue: Scope, messageId: string): void {
    try { this.edit(addRelayAck(this.state.replica, queue, messageId, this.now())) }
    catch (error) { this.notify('error', `Could not acknowledge: ${error instanceof Error ? error.message : String(error)}`) }
  }
  /**
   * Send a row to another account as a proposed transaction: a copy of the row with everything inside it goes as one
   * proposal on the target node (an allocation bin: what they must fill, and what they receive). The receiver sees it
   * in that node's link panel and approves it to take the rows in.
   */
  async sendRowTo(at: Scope, row: TaskView, owner: string, aliasId: string): Promise<void> {
    const session = this.state.session
    if (!session || session.kind !== 'user') { this.notify('error', 'Sign in to your account to send rows to other accounts.'); this.openModal('connect'); return }
    if (!this.mayPropose()) { this.notify('error', 'This device does not submit proposals (policy towards fos: add "submit proposals" under "to").'); return }
    const binId = `${row.id}-${session.username}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
    try {
      await submitMarketProposal(session, owner, aliasId, copyBidRow(this.state.replica, [...this.state.view, ...at, row.id], this.now(), binId))
      this.notify('info', `Sent to @${owner} as a proposal; they approve it to take it in.`)
    } catch (error) {
      this.notify('error', `Could not send: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  /**
   * `@name` binds an unverified user object (the username only) until the account server attests it. The device
   * asks through the graph: a `verify` requirement for that name (`requestVerification`, under the People row (`lib.people`)) run on
   * the account server (`runOnServer`), whose `verify` handler binds the attested object as its user field. The
   * device's own verify handler (`verifiers`) checks the attestation against the key the server publishes on its member entry;
   * then the object is kept in the graph (the People row), every row that named that username is rebound and the
   * request removed. Offline, rows keep the unverified object; the next edit retries.
   */
  private resolveUser(user: UserRecord | null | undefined): void {
    const session = this.state.session
    // offline, or a server without a verify handler: the row keeps the unverified object until a later edit
    if (!user || user.verification || !session || session.kind !== 'user' || this.virtualIdentity || !this.capabilityAvailable('verify', [])) return
    const key = user.username.toLowerCase()
    // a cached object is what addRow bound already (`knownUser`)
    if (cachedUser(this.state.replica, user.username) || this.resolvingUsers.has(key)) return
    this.resolvingUsers.add(key)
    void (async () => {
      const store = this.state.replica.store
      const asked = requestVerification(this.state.replica, user.username, this.now())
      this.edit(asked.replica)
      let failure: string | null = null
      try { await this.runOnServer(asked.path) } catch (error) { failure = error instanceof Error ? error.message : String(error) }
      if (this.state.replica.store !== store) return
      const verified = failure ? null : verifiedAt(this.state.replica, asked.path)
      let next = this.state.replica
      if (resolveScope(next.store, headCid(next), asked.path)) next = deleteTask(next, asked.path.slice(0, -1), asked.path.at(-1)!, this.now())
      const checked = verified ? await (this.verifiers[verified.verification!.by]?.(verified) ?? Promise.resolve(false)) : false
      if (verified && checked !== false) next = rebindUsers(cacheUser(next, verified, this.now()), verified, this.now())
      this.edit(next)
      if (!verified) this.notify('error', failure ?? `No Fos user is named @${user.username}.`)
      else if (checked === false) this.notify('error', `The server's verification of @${user.username} does not check out.`)
    })().catch(error => this.notify('error', error instanceof Error ? error.message : String(error))).finally(() => this.resolvingUsers.delete(key))
  }
  /**
   * Run the requirement at `path` on the account server: sync it there, a `complete` event on it (the server's
   * handler registry fills it), then sync the result back. For requests this device makes of its server (verify,
   * organize); a node with several peers goes through `evaluateAt`.
   */
  private async runOnServer(path: Scope): Promise<void> {
    const session = this.state.session
    if (!session || session.kind !== 'user' || this.virtualIdentity || !this.isOnline('fos')) throw new Error('Connect to your account to reach its server.')
    await this.syncNow('before evaluation')
    const r = this.state.replica, cid = resolveScope(r.store, headCid(r), path)
    if (!cid) throw new Error('The request was removed before it reached the server.')
    try { await evaluateOnServer(session, [...r.meta.scope, ...path], put(r.store, valueContent(r.store, cid)), this.evaluationBranches(path)) }
    finally { await this.syncNow('evaluation results') }
  }
  /** Requirements in the viewed subtree assigned to the user `name` ("-@name …"), with the task they belong to. */
  assignmentsTo(name: string): Array<{ at: Scope; row: TaskView; task: TaskView | null }> {
    const out: Array<{ at: Scope; row: TaskView; task: TaskView | null }> = []
    const walk = (at: Scope, parent: TaskView | null) => {
      const node = view(this.state.replica, [...this.state.view, ...at])
      if (!node) return
      for (const row of node.tasks) {
        if (!!row.requirement && row.requirement?.capability === 'peer' && row.user?.username.toLowerCase() === name.toLowerCase()) out.push({ at, row, task: parent })
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
    const pattern = libAt(r.store, path.slice(0, -1)).capabilities.peer!
    const next = updateAtScope(r.store, headCid(r), path, identity => {
      const cid = put(r.store, identity), value = valueContent(r.store, cid)
      const { name: _name, ...data } = identity.data
      const typed = content(r.store, valueOfPattern(r.store, pattern, value.data))
      return refNodeContent(r.store, { ...data, ...(handler !== undefined ? { name: { content: handler || 'peer' } } : {}) },
        put(r.store, handler === undefined ? value : { ...typed, children: [...typed.children, ...value.children.filter(edge => !typed.children.some(row => row[0] === edge[0] && row[1] === edge[1]))] }), [...bookkeepingOf(r.store, identity), [primitive(r.store, 'previous'), cid]])
    }, 'node')
    const root = handler !== undefined && path.length ? updateAtScope(r.store, next, path.slice(0, -1), node => ({ ...node, children: node.children.map(edge => content(r.store, edge[1]).data.alias?.id === path.at(-1) ? [pattern, edge[1]] : edge) })) : next
    commitRoot(r.store, root, this.now()); return { ...r }
  }
  attachNamedPeer(name: string): void {
    const peer = this.knownPeers().find(p => p.name === name || p.id === name)
    if (!peer) { this.notify('info', `No available peer handler named “${name}”. Edit the constructor to choose one.`); return }
    this.edit(addMemberAt(this.state.replica, this.peerContextPath(), peer.id, peer.name, ['read', 'edit'], this.now()))
  }
  setPeerRow(path: Scope, handler: string | undefined): void { this.edit(this.peerRowReplica(this.state.replica, path, handler)) }
  /** The device root's Peer constructor row: choosing a handler on it makes a new peer row instead of changing it. */
  /** The id of this device's declared Peer constructor row on the device root: a content address. */
  peerConstructorId(): string { return hashContent({ data: { peerId: { content: this.state.replica.meta.peerId }, name: { content: 'Peer constructor' } }, children: [] }) }
  newBranchAt(path: Scope): void {
    const row = view(this.state.replica, path.slice(0, -1))?.tasks.find(r => r.id === path.at(-1))
    if (!row) return
    let n = 1; while (row.branches?.names.includes(`branch ${n}`)) n++
    void this.createNodeBranch(path.slice(0, -1), row.id, `branch ${n}`, true).then(() => {
      if (JSON.stringify(path.slice(0, this.state.view.length)) === JSON.stringify(this.state.view)) this.select(path.slice(this.state.view.length))
    })
  }
  /** Ask for `name` to be merged into the branch on screen (the default branch when that is `name`), or withdraw the request. */
  toggleBranchMergeRequest(path: Scope, name: string): void {
    if (this.state.voice || this.state.work?.busy || this.evaluating) return
    const row = view(this.state.replica, path.slice(0, -1))?.tasks.find(r => r.id === path.at(-1))
    if (!row?.branches) return
    const requested = !row.branches.mergeRequests?.includes(name)
    const target = requested && row.branches.selected !== name ? row.branches.selected : undefined
    try { this.edit(setBranchMergeRequest(this.state.replica, path, name, requested, this.now(), target)) } catch (error) { this.notify('error', String(error)); return }
    // a branch of a row a peer holds goes to that peer as a pull request
    if (requested && this.pullRequestTarget(path)) void this.sendPullRequest(path, name)
  }
  /** Where a pull request of a row at `path` goes: the peer that holds it, when this device proposes to it there. */
  pullRequestTarget(path: Scope): { context: NodeSyncContext; send: (request: NodeRequest) => Promise<ProvidedNode> } | null {
    const session = this.state.session, r = this.state.replica, shared = this.sharedNodeAt(path)
    if (shared && session?.kind === 'user') {
      const peer = `user:${shared.owner}`, connection = this.transportTo(shared.root, peer)
      return connection && { context: { peer, scope: shared.scope, remoteRoot: shared.scope, localRoot: shared.root, branches: [], push: true }, send: request => connection.request(request) }
    }
    const transport = this.transport()
    if (!(transport === 'virtual' || transport === 'direct' || (transport === 'account' && session?.kind === 'peer'))) return null
    const localRoot = r.meta.localScope ?? []
    const peer = transport === 'direct' ? this.link!.remotePeerId! : r.meta.serverPeerId ?? null, connection = this.transportTo(localRoot, peer)
    if (!connection) return null
    const scope = connection.attachment([...r.meta.scope, ...localRoot])
    return { context: { peer, scope, remoteRoot: scope, localRoot, branches: [], push: true }, send: request => connection.request(request) }
  }
  /** Send the branch `name` of the row at `path` to the peer holding it as a pull request (its `branch:<name>` submission). */
  async sendPullRequest(path: Scope, name: string): Promise<void> {
    const target = this.pullRequestTarget(path), store = this.state.replica.store
    if (!target) { this.notify('error', 'No peer holds this row to send a pull request to.'); return }
    try {
      const done = await sendPullRequest(this.state.replica, target.context, path, name, target.send, () => this.now())
      if (this.state.replica.store !== store) return
      this.set({ replica: done.replica })
      this.notify('info', `Pull request “${name}” sent.`)
    } catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)) }
  }
  /**
   * Approve the pull request `branch` on the node at `path`: accepting it like any submission (this account's approval,
   * attested by its server for the others; the group's merge rule then merges it).
   */
  async approvePullRequest(path: Scope, branch: string): Promise<void> {
    if (JSON.stringify(path) !== JSON.stringify(this.state.view)) this.goTo(path)
    const proposal = this.currentView()?.proposals.find(p => p.name === branch && p.status === 'open')
    if (!proposal) { this.notify('error', 'That pull request is no longer open.'); return }
    await this.decideProposal(proposal.id, 'approve')
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
  /** Merge `source` (the selected branch when omitted) into `target`; a merge request of `source` is settled by it. */
  mergeNodeBranch(at: Scope, id: string, target: string, absolute = false, source?: string): void {
    if (this.evaluating || this.state.voice || this.state.work?.busy) return
    const path = absolute ? [...at, id] : [...this.state.view, ...at, id]
    const row = view(this.state.replica, path.slice(0, -1))?.tasks.find(row => row.id === id)
    if (repositoryAt(this.state.replica, path)) {
      if (source && source !== row?.branches?.selected) { this.notify('info', `Switch to ${source} to merge its repository branch.`); return }
      void this.proposeRepoMerge(path, target); return
    }
    if (!row?.branches) return
    const from = source ?? row.branches.selected
    try {
      let next = mergeBranch(this.state.replica, path, from, target, this.now())
      if (row.branches.mergeRequests?.includes(from)) next = setBranchMergeRequest(next, path, from, false, this.now())
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
        const snapshot = await readRepository(session, repo, previous?.pulls.filter(p => p.state === 'open').map(p => p.number) ?? [])
        if (generation !== this.authGeneration || session !== this.state.session) return
        if (repositoryAt(this.state.replica, path) !== repo || !this.hasRepositoryPeer(path)) continue
        snapshot.pulls.push(...(previous?.pulls ?? []).filter(p => p.state !== 'open' && !snapshot.pulls.some(current => current.number === p.number)).slice(-100))
        this.repositories.set(repo, snapshot)
        this.set({ replica: this.state.replica })
        this.savePrefs()
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
    try {
      await decideRepositoryPull(session, info.repo, pull.number, decision, pull.sha)
      if (generation !== this.authGeneration || session !== this.state.session || repositoryAt(this.state.replica, path) !== info.repo || !this.canPushRepository(path)) return
      if (info.snapshot) this.repositories.set(info.repo, { ...info.snapshot, pulls: info.snapshot.pulls.map(p => p.number === pull.number ? { ...p, state: decision === 'merge' ? 'merged' : 'closed' } : p) })
      this.savePrefs()
      this.notify('info', `GitHub PR #${pull.number} ${decision === 'merge' ? 'merged' : 'closed'}.`)
      await this.syncNow('repository decision', true)
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
    const key = settingKeyOf(row); if (row && key) row.title = SETTING_LABELS[key] ?? key
    return row
  }
  /** The full text editor uses the same three-way merge as cells, preserving remote edits. */
  editCurrentText(text: string, draft: { store: Replica['store']; head: string; path: Scope }): void {
    if (draft.store !== this.state.replica.store || !draft.path.length || this.isHome(draft.path)) return
    const parent = draft.path.slice(0, -1), id = draft.path.at(-1)!
    if (headCid(this.state.replica) === draft.head) { this.edit(renameTask(this.state.replica, parent, id, text, this.now())); if (text.includes('\n')) this.titleFromText(draft.path); return }
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
  /**
   * The title area's editor: the current node's own row re-parsed from its marker text, as `rewriteRowAt` does for a
   * row in the view (same type: only its text, and its done state for a task; another marker: the row in place).
   */
  rewriteCurrentRow(parsed: import('./rows').ParsedInput, draft: { store: Replica['store']; head: string; path: Scope }): void {
    if (draft.store !== this.state.replica.store || !draft.path.length || this.isHome(draft.path)) return
    const before = this.currentRow(), parent = draft.path.slice(0, -1), id = draft.path.at(-1)!
    if (!before) return
    this.together(() => {
      if (parsed.type === before.type && !parsed.extras && !parsed.children?.length && parsed.peer === undefined) {
        if (parsed.text !== before.title) this.editCurrentText(parsed.text, draft)
        if (before.checkable && parsed.done !== before.done) this.edit(setTaskDone(this.state.replica, parent, id, parsed.done, this.now()))
        return
      }
      const extras: RowInputExtras = { ...(parsed.extras ?? {}), done: parsed.done }
      this.resolveUser(parsed.extras?.user)
      let next = isArgumentInput(parsed) ? this.argumentRowReplica(this.state.replica, parent, id, parsed.text, extras) : setRowContentAt(this.state.replica, parent, id, parsed.type, parsed.text, extras, this.now())
      if (parsed.type === RESOURCE_TYPE) next = this.bankReplica(next, [...parent, id])
      this.edit(next)
      if (parsed.peer !== undefined || before.construction?.handler) this.setPeerRow(draft.path, parsed.peer)
      if (parsed.children?.length) this.addParsedChildren([], parsed.children)
    })
  }
  /** Mark the current node's own row (a task) done or open. */
  setCurrentDone(done: boolean): void {
    const path = this.state.view
    if (!path.length || !this.currentRow()?.checkable) return
    this.edit(setTaskDone(this.state.replica, path.slice(0, -1), path.at(-1)!, done, this.now()))
  }
  bindOutputArgument(at: Scope, id: string, cid: string): void {
    const r = this.state.replica, parent = resolveScope(r.store, headCid(r), [...this.state.view, ...at])
    const arg = parent && argumentRefs(r.store, parent).find(a => content(r.store, a.cid).data.alias?.id === id)
    if (!arg || !r.store.table.has(cid) || !matchesGraph(r.store, arg.type, cid)) { this.notify('error', 'The placeholder has an incompatible type.'); return }
    this.setArgumentValue(at, id, cid)
  }
  /** A template's icon is its presentation; a row made from one shows its template's. */
  templateIcon(path: Scope): string {
    const own = templateIconAt(this.state.replica, path)
    if (own) return own
    const row = view(this.state.replica, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1))
    return row?.typeCid ? content(this.state.replica.store, row.typeCid).data.presentation?.icon ?? '' : ''
  }
  openTemplatePicker(path: Scope): void {
    document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
    this.set({ templatePicker: { path: [...path] }, modal: 'template', contextMenu: null })
  }
  changeTemplate(type: string, templateId?: string, extras: Omit<RowExtras, 'store'> = {}): void {
    const path = this.state.templatePicker?.path
    if (!path?.length || this.isHome(path)) return
    this.together(() => {
      let r = this.state.replica
      if (templateId) r = instantiateTemplate(r, path.slice(0, -1), path.at(-1)!, templateId, this.now())
      else r = setRowType(r, path.slice(0, -1), path.at(-1)!, type, this.now(), extras)
      this.edit(r); this.closeModal()
    })
  }
  createLinkedTemplate(name: string, icon: string, inHome: boolean): void {
    const path = this.state.templatePicker?.path
    if (!path?.length || this.isHome(path)) return
    const parent = inHome ? homePath(this.state.replica) : path.slice(0, -1), id = newId(), title = name.trim() || 'Untitled template'
    this.together(() => {
      let r = addRow(this.state.replica, parent, TEMPLATE_TYPE, title, this.now(), { id })
      if (icon.trim()) r = setTemplateIcon(r, [...parent, id], icon.trim(), this.now())
      r = instantiateTemplate(r, path.slice(0, -1), path.at(-1)!, id, this.now())
      this.edit(r); this.closeModal(); this.goTo([...parent, id])
    })
  }
  parseRowInput(text: string, path = this.constructorContext()) {
    const declarations = visibleBindings(this.state.replica, path).flatMap(binding => bindingTree(binding)).filter(ref => !!ref.name).map(ref => ({
      name: capabilityOfTarget(ref.store, ref.pattern) ?? ref.pattern, syntax: [ref.name!]
    }))
    const offers = this.handlerOffers(path).map(offer => ({ name: offer.capability ?? offer.type, syntax: [offer.label] }))
    return parseRowInput(text, [...declarations, ...offers, ...capabilityDeclarations(this.state.replica.store, path)])
  }
  handlerOffers(path = this.constructorContext()) {
    return discoverHandlers(this.state.replica, path, { isPeerActive: id => id === this.state.replica.meta.peerId || this.isOnline(id) })
  }
  /** Menus must use the same pinned namespace as construction and execution. */
  libraryConstructors(path = this.constructorContext()) {
    const r = this.state.replica, binding = libraryBindingAt(r.store, path)
    if (!binding) return []
    const manual = namesInLibrary(r.store, binding.library).byName.get(MANUAL_HANDLERS)
    return childRows(r.store, binding.library)
      .filter(row => row.type === TEMPLATE_TYPE && (!manual || valueCidOf(r.store, row.cid) !== valueCidOf(r.store, manual)) && isTemplateType(r.store, row.cid))
      .map(row => ({ id: rowView(r.store, row.cid, row.edge).id, cid: row.cid, label: rowTitle(r.store, row.cid, null).trim(), icon: capabilityPresentation(r.store, row.cid).icon || 'template', description: capabilityPresentation(r.store, row.cid).description }))
      .filter(row => row.label)
  }
  /**
   * The nearest library's fields a row is made from (its types and the capabilities it declares; its templates are
   * `libraryConstructors`), each the node a row made from it has on its left.
   */
  libraryNames(path = this.constructorContext()): Array<{ name: string; node: string; label: string; icon?: string; description?: string }> {
    const r = this.state.replica, binding = libraryBindingAt(r.store, path)
    if (!binding) return []
    return [...namesInLibrary(r.store, binding.library).byName].filter(([, node]) => !isTemplateType(r.store, node)).map(([name, node]) => {
      const value = valueContent(r.store, node)
      return { name, node, label: name, ...capabilityPresentation(r.store, node) }
    })
  }
  /** A row made from the node the library names `name` where the row goes (the name resolves in that scope). */
  insertNamed(name: string, path = this.constructorContext(), inverted = false): Scope {
    const label = this.libraryNames(path).find(n => n.name === name)?.label ?? ''
    return this.applyConstructor(path, { type: name, text: label, done: false }, false, undefined, undefined, undefined, inverted)
  }
  insertLibraryConstructor(id: string, path = this.constructorContext(), replace = false, inverted = false): Scope {
    const template = this.libraryConstructors(path).find(item => item.id === id)
    if (!template) throw new Error('This standard library constructor is unavailable.')
    const queue = [template.cid], seen = new Set<string>()
    while (queue.length) {
      const cid = queue.pop()!
      if (!this.state.replica.store.table.has(cid) || isPeerReference(content(this.state.replica.store, cid))) throw new Error('This library template is still downloading. Try again once it has loaded.')
      if (seen.has(cid)) continue
      seen.add(cid)
      for (const edge of content(this.state.replica.store, cid).children) queue.push(...edge)
    }
    const current = replace && path.length ? view(this.state.replica, path.slice(0, -1))?.tasks.find(row => row.id === path.at(-1)) : undefined
    const title = current && !current.requirement && current.type !== HOME_TYPE ? current.title || template.label : template.label
    return this.applyConstructor(path, { type: TASK_TYPE, text: title, done: false }, replace, undefined, undefined, template.cid, inverted)
  }
  publishCurrentTemplate(market = false): void {
    if (!this.canApprove() || this.currentRow()?.type !== TEMPLATE_TYPE) return
    if (market && (!this.state.session || !this.isOnline('fos'))) { this.notify('error', 'Connect to Fos before publishing to the marketplace.'); return }
    try { this.edit(publishTemplate(this.state.replica, this.state.view.slice(0, -1), this.state.view, this.currentRow()!.title, this.now(), market)); this.notify('info', market ? 'This template version is published to the Fos marketplace after sync.' : 'This template version is advertised by this device in its parent context.') }
    catch (error) { this.notify('error', String(error)) }
  }
  constructorEnabled(peerId: string, id: string): boolean {
    const cid = contextMemberRefs(this.state.replica, this.peerContextPath()).get(peerId)
    return !cid || !(content(this.state.replica.store, cid).data.disabledConstructors?.content ?? []).includes(id)
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
    if (!offer) throw new Error('This handler is unavailable.')
    if (!isLibraryType(this.state.replica.store, offer.type, TEMPLATE_TYPE)) {
      const r = this.state.replica, cid = resolveScope(r.store, headCid(r), path)
      if (cid && matchesGraph(r.store, offer.type, cid)) {
        this.edit(setRefValueAt(r, path, offer.cid, this.now()))
      } else if (refSubmissions(r.store, offer.cid).some(value => primitiveValue(r.store, value))) this.edit(addRefCall(r, path, offer.cid, this.now()))
      else this.edit(addRefAt(r, path, newId(), offer.type, this.now(), offer.cid, offer.label))
      return
    }
    const source = refValueCid(this.state.replica.store, content(this.state.replica.store, offer.cid))
    if (!source) throw new Error('Template is unbound.')
    this.together(() => {
      const id = newId()
      let r = addRow(this.state.replica, path, TASK_TYPE, offer.label, this.now(), { id })
      r = instantiateTemplateValue(r, path, id, source, this.now())
      this.edit(r)
    })
  }
  constructorContext(): Scope { return this.state.selected ? [...this.state.view, ...this.state.selected] : [...this.state.view] }
  constructorNeeds(path = this.constructorContext()): string[] {
    const row = path.length ? view(this.state.replica, path.slice(0, -1))?.tasks.find(r => r.id === path.at(-1)) : undefined
    const needs: string[] = []
    if (row?.requirement && !row.requirement.satisfied) needs.push(row.requirement.capability === 'allocation' ? row.requirement.resource ?? 'allocation' : row.requirement.capability ?? 'requirement')
    const cid = resolveScope(this.state.replica.store, headCid(this.state.replica), path)
    if (cid) for (const arg of argumentRefs(this.state.replica.store, cid)) {
      if (settingOf(this.state.replica.store, content(this.state.replica.store, arg.cid)) || refValueCid(this.state.replica.store, content(this.state.replica.store, arg.cid))) continue
      needs.push(capabilityOfTarget(this.state.replica.store, arg.type) ?? content(this.state.replica.store, arg.type).data.name?.content?.replace('fos:type:', '') ?? '')
    }
    return needs
  }
  addPullConstructor(path = this.constructorContext()): Scope {
    const peer = this.pullPeers()[0]
    if (!peer) throw new Error('Connect a document peer before adding Pull.')
    return this.applyConstructor(path, { type: argumentType('tool'), text: `Pull from ${peer.name}`, done: false, extras: { demand: { capability: 'tool', inputs: { tool: 'fos.pull', peer: peer.id } } } })
  }
  /** Palette input uses the same row documents as typed input; no separate palette model. */
  applyConstructor(path: Scope, parsed: import('./rows').ParsedInput, replace = false, repo?: string, localDirectory?: string, templateId?: string, inverted = false): Scope {
    if (!view(this.state.replica, path)) throw new Error('The destination no longer exists.')
    const template = templateId ? findRowByAlias(this.state.replica.store, headCid(this.state.replica), templateId) : null
    const templateCid = templateId && this.state.replica.store.table.has(templateId) && isTemplateType(this.state.replica.store, templateId) ? templateId : template?.row.type === TEMPLATE_TYPE ? resolveScope(this.state.replica.store, headCid(this.state.replica), [...template.path, template.row.id]) : null
    if (templateId && !templateCid) throw new Error('This template is unavailable.')
    const current = path.length ? view(this.state.replica, path.slice(0, -1))?.tasks.find(row => row.id === path.at(-1)) : undefined
    replace = replace && !!current && current.type !== HOME_TYPE && !current.requirement
    const parent = replace ? path.slice(0, -1) : path, id = replace ? path.at(-1)! : newId(), target = [...parent, id]
    if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Use owner/repository.')
    if (localDirectory) {
      const cid = resolveScope(this.state.replica.store, headCid(this.state.replica), target)
      if (cid && localRepositoryHere(this.state.replica, target)) throw new Error('This node already has a local repository; edit its argument to change the path.')
    }
    const parentCid = path.length && resolveScope(this.state.replica.store, headCid(this.state.replica), path.slice(0, -1))
    // a requirement is itself an open argument of its parent; a constructor applied to it adds a child, it does not fill it
    const argument = !current?.requirement && parentCid && argumentRefs(this.state.replica.store, parentCid).find(a => content(this.state.replica.store, a.cid).data.alias?.id === path.at(-1) && !refValueCid(this.state.replica.store, content(this.state.replica.store, a.cid)))
    if (repo && repositoryAt(this.state.replica, target) && repositoryAt(this.state.replica, target) !== repo) throw new Error('Edit the existing repository argument to change its repository.')
    this.together(() => {
      // Construct before checking compatibility, in an isolated draft so a
      // rejected value cannot change the live graph or leave an extra row.
      const live = this.state.replica
      const isolated = !!argument || !!templateCid || inverted
      let r = isolated ? loadReplica(serializeReplica(live)) : live
      if (isolated) copyOuterScope(live.store, r.store)
      if (replace && current?.construction?.handler) r = this.peerRowReplica(r, target, undefined)
      r = isArgumentInput(parsed) ? this.argumentRowReplica(r, parent, id, parsed.text, parsed.extras ?? {}) : replace ? setRowContentAt(r, parent, id, parsed.type, parsed.text, parsed.extras ?? {}, this.now()) : addRow(r, parent, parsed.type, parsed.text, this.now(), { id, done: parsed.done, ...parsed.extras })
      if (parsed.type === RESOURCE_TYPE) r = this.bankReplica(r, target)
      this.resolveUser(parsed.extras?.user)
      if (templateCid) r = instantiateTemplateValue(r, parent, id, templateCid, this.now())
      if (parsed.peer !== undefined) r = this.peerRowReplica(r, target, parsed.peer)
      if (parsed.construct) r = constructAt(r, target, libAt(r.store, target.slice(0, -1)).capabilities[parsed.construct.capability]!, parsed.construct.values, this.now())
      if (inverted) {
        // the inverse of supplying a capability is asking for it: the row's ref a hole
        r = askAt(r, target, this.now())
      }
      if (repo) { r = bindRepository(r, target, repo, this.now()); r = this.withIntegrationPeer(r, target, 'github') }
      if (localDirectory) {
        const peer = `git:${r.meta.peerId}:${encodeURIComponent(localDirectory)}`
        r = bindLocalRepository(r, target, { path: localDirectory, device: r.meta.peerId, peer }, this.now())
        r = addMemberAt(r, target, peer, 'Local Git', ['repo'], this.now())
        r = setMemberCapabilitiesAt(r, target, peer, ['repo'], [], this.now(), ['repo'])
      }
      if (argument) {
        let value = resolveScope(r.store, headCid(r), target)!
        if (parsed.extras?.demand) {
          // A callable value carries the invocation as a child, with its declaration intact.
          const constructor = libAt(r.store, target.slice(0, -1)).capabilities[parsed.extras.demand.capability]!
          const instruction = view(r, target.slice(0, -1))!.tasks.find(row => row.id === target.at(-1))!.typeCid!
          value = valueOfPattern(r.store, constructor, {}, [[instruction, value]])
        }
        if (!matchesGraph(r.store, argument.type, value)) throw new Error('Choose a constructor matching this input pattern.')
        r = setRefValueAt(r, path, value, this.now())
      }
      if (isolated) {
        for (const [cid, node] of r.store.table) if (!live.store.table.has(cid)) live.store.table.set(cid, node)
        live.store.rootNodeId = r.store.rootNodeId
        r = { ...r, store: live.store }
      }
      this.edit(r)
    })
    if (repo) { this.repositoryPollAt = 0; void this.refreshRepositories() }
    return target
  }
  changeCurrentType(type: string): void {
    const path = this.state.view
    if (path.length && !this.isHome(path)) this.edit(setRowType(this.state.replica, path.slice(0, -1), path.at(-1)!, type, this.now()))
  }
  /** Rows whose title matches `query` (of the row type `type`, when given). */
  searchLocalNodes(query: string, type?: string): Array<{ row: TaskView; path: Scope }> {
    const found: Array<{ row: TaskView; path: Scope }> = [], visited = new Set<string>()
    const walk = (path: Scope) => {
      if (path.length > 64 || visited.size > 5000) return
      for (const row of view(this.state.replica, path)?.tasks ?? []) {
        if (visited.has(row.id)) continue
        visited.add(row.id)
        const full = [...path, row.id]
        if ((!type || row.type === type) && row.title.toLowerCase().includes(query.toLowerCase()) && row.refId === undefined && !this.state.view.includes(row.id)) found.push({ row, path: full })
        if (row.childCount) walk(full)
      }
    }
    walk([]); return found.slice(0, 50)
  }
  canLinkNode(id: string, destination = this.state.view): boolean {
    const r = this.state.replica, target = findRowByAlias(r.store, headCid(r), id)
    if (!target || destination.includes(id)) return false
    const row = destination.length ? view(r, destination.slice(0, -1))?.tasks.find(row => row.id === destination.at(-1)) : null
    if (!row?.requirement) return true
    if (row.requirement.satisfied) return false
    const cid = resolveScope(r.store, headCid(r), [...target.path, id])
    return !!cid && !!row.typeCid && resolveBinding(r.store, row.typeCid, cid, contextBindings(r, destination), undefined, { scope: { replica: r, path: destination } }).status === 'ready'
  }
  linkNode(id: string, destination = this.state.view): void {
    if (!this.canLinkNode(id, destination)) { this.notify('error', 'This value does not match the destination requirement.'); return }
    const req = destination.length ? view(this.state.replica, destination.slice(0, -1))?.tasks.find(row => row.id === destination.at(-1))?.requirement : null
    try {
      this.edit(req ? supplyRequirement(this.state.replica, destination.slice(0, -1), destination.at(-1)!, { by: this.actorName(), ref: id }, this.now()) : addRef(this.state.replica, destination, id, this.now()))
    } catch (error) { this.notify('error', String(error)) }
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
    const data = localRepositoryHere(this.state.replica, root)
    if (!data?.peer || data.device !== this.state.replica.meta.peerId || data.path !== directory || view(this.state.replica, root)?.members.some(m => m.peerId === data.peer)) return
    const peer = data.peer
    let r = addMemberAt(this.state.replica, root, peer, 'Local Git', ['repo'], this.now())
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
    if (!sameValue(current, report.specifications)) throw new Error('Specifications changed during verification. Run again.')
    const valid = new Set(current.map(spec => spec.id))
    if (report.results.length !== valid.size || new Set(report.results.map(result => result.id)).size !== valid.size || report.results.some(result => !valid.has(result.id) || !['pass', 'fail', 'blocked'].includes(result.status) || typeof result.evidence !== 'string' || !result.evidence.trim() || result.evidence.length > 16000)) throw new Error('Provide one pass, fail, or blocked result with evidence for every specification.')
    const task = verificationTask(this.state.replica, root, report.commit)
    if (task && verificationReport(this.state.replica, task)) throw new Error('Results for this commit have already been recorded.')
    let r = this.state.replica
    if (task) r = recordVerificationReport(r, task, report, this.now())
    for (const result of report.results.filter(item => item.status !== 'pass')) {
      const id = newId(); r = addTask(r, root, `${result.status === 'fail' ? 'Issue' : 'Blocked verification'}: ${current.find(spec => spec.id === result.id)!.text.split('\n')[0]}`, this.now(), id)
      r = recordVerificationIssue(r, [...root, id], { commit: report.commit, specification: result.id, evidence: result.evidence }, this.now())
      r = addRow(r, [...root,id], NOTE_TYPE, result.evidence, this.now())
    }
    this.edit(r)
  }
  async startExecution(path: Scope): Promise<void> {
    const row = path.length ? view(this.state.replica, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1)) : null
    if (row?.type === TEMPLATE_TYPE) {
      const id = newId(), parent = path.slice(0, -1)
      let r = addTask(this.state.replica, parent, row.title, this.now(), id)
      r = instantiateTemplate(r, parent, id, row.id, this.now())
      this.edit(r); path = [...parent, id]
    }
    // an open requirement is executed to be filled: its own hole is the execution's output, not an instruction to fill first
    const compiled = row?.requirement && !row.requirement.satisfied ? null : this.executionInstructions(path)
    if (compiled && !compiled.canRun) { this.notify('error', `Fill instruction refs before running: ${compiled.blocking.map(hole => hole.id).join(', ')}`); return }
    this.goTo(path)
    this.execution = { path: [...this.state.view], store: this.state.replica.store }
    this.refresh()
  }
  executionInstructions(path = this.state.view) { return compileInstructions(this.state.replica, path) }
  executionRefFields(path = this.state.view) { return executionInputs(this.state.replica, path).filter(field => field.kind === 'text' || field.kind === 'ref') }
  submitExecutionField(key: string, value: string): void {
    const path = this.executionPath()
    if (!path || this.evaluating) return
    try { this.edit(executionInput(this.state.replica, path, { revision: headCid(this.state.replica), key, value }, this.state.replica.meta.peerId, this.now())) }
    catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)) }
  }
  /**
   * One event of the grammar against this device's replica (the desktop loopback endpoints and local agents). The
   * principal comes from the transport; owners' evaluations run through this app's own evaluator.
   */
  private localEventQueue: Promise<unknown> = Promise.resolve()
  dispatchLocalEvent(principal: Principal, event: FosEvent, branch?: string): Promise<unknown> {
    const pending = this.localEventQueue.catch(() => undefined).then(() => this.dispatchLocalEventNow(principal, event, branch))
    this.localEventQueue = pending
    return pending
  }
  private async dispatchLocalEventNow(principal: Principal, event: FosEvent, branch?: string): Promise<unknown> {
    const r = this.state.replica, before = r.store.rootNodeId, beforeClaims = workClaims(r, this.now())
    const dispatched = withBranches(r.store, branch && principal.scope.length ? { [principal.scope.at(-1)!]: branch } : {}, () => dispatchEvent(r, event, principal, this.now()))
    if (dispatched.changed) {
      const after = r.store.rootNodeId, afterClaims = workClaims(dispatched.replica, this.now())
      try { this.edit(dispatched.replica); await this.config.storage.flush?.() }
      catch (error) {
        if (this.state.replica.store === r.store) {
          if (r.store.rootNodeId === after) r.store.rootNodeId = before
          else {
            // Preserve UI edits made during the flush, but never release or acquire a lease on a failed save.
            const changedIds = new Set([...beforeClaims, ...afterClaims].filter(c => JSON.stringify(beforeClaims.find(b => b.id === c.id)) !== JSON.stringify(afterClaims.find(a => a.id === c.id))).map(c => c.id))
            if (changedIds.size) saveWorkClaims(this.state.replica, [...workClaims(this.state.replica, this.now()).filter(c => !changedIds.has(c.id)), ...beforeClaims.filter(c => changedIds.has(c.id))], this.now())
          }
          this.set({ replica: { ...this.state.replica } })
        }
        throw error
      }
    }
    if (dispatched.evaluate) {
      if (this.evaluating) throw new Error('Evaluation is running.')
      const path = dispatched.evaluate.path
      if (JSON.stringify(path) === JSON.stringify(this.executionPath())) {
        const snapshot = executionSnapshot(this.state.replica, path)
        if (!snapshot.canRun || snapshot.inputs.some(input => input.role !== 'output') || !['idle', 'rolled-back', 'awaiting-review'].includes(snapshot.status)) throw new Error('Satisfy the evaluation\'s current inputs before completing it.')
        await this.finishExecution()
      } else await this.evaluateAt(path, true)
      await this.config.storage.flush?.()
      return executionSnapshot(this.state.replica, path)
    }
    return dispatched.result
  }
  executionTimeEntries(): Array<{ start: number; end?: number; notes: string }> {
    const path = this.executionPath()
    return path ? executionTime(this.state.replica, path) : []
  }
  setExecutionTimeNotes(notes: string): void {
    const path = this.executionPath(), entries = this.executionTimeEntries()
    const active = entries.find(entry => entry.end === undefined)
    if (!path || !active || this.evaluating) return
    active.notes = notes
    this.edit(writeExecutionTime(this.state.replica, path, entries, this.now()))
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
    this.edit(writeExecutionTime(this.state.replica, path, entries, this.now()))
  }
  async finishExecution(abort = false): Promise<void> {
    const path = this.executionPath()
    if (!path || this.evaluating) return
    const active = this.executionTimeEntries().find(entry => entry.end === undefined)
    if (active) this.toggleExecutionTimer(active.notes)
    if (abort) {
      const record = this.evaluationStatus(path)
      if (record && record.status !== 'committed') this.edit(writeEvaluationRecord(this.state.replica, path, { ...record, status: 'rolled-back', error: 'Aborted by user' }, this.now()))
      this.exitExecution()
    } else await this.evaluateAt(path)
  }
  /** Issue more authority to the bank at `at` (positive) or retire some of it (negative): a grant row the allocate handler in scope checks. */
  changeBankHolding(at: Scope, amount: number): void {
    if (!Number.isFinite(amount) || amount === 0) return
    const path = [...this.state.view, ...at], row = view(this.state.replica, path.slice(0, -1))?.tasks.find(t => t.id === path.at(-1))
    if (!row?.resource) return
    const id = newId()
    try { this.edit((amount > 0 ? issueGrant : debitGrant)(this.state.replica, path, { type: row.resource.type, unit: row.resource.unit, amount: Math.abs(amount) }, this.now(), undefined, id)) }
    catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)); return }
    // the invocation is authored at the bank's parent; the bank holds the grant once it is evaluated
    void this.queueEvaluation([...path.slice(0, -1), id])
  }
  /**
   * Use part of an allocation during an execution: an allocate invocation under the execution's root, evaluated at
   * once. `handle` is a row holding a grant (an invocation's output), or a grant a bank holds (`ownerGrants`); `to`
   * binds the used amount to a requirement row.
   */
  consumeExecutionAllocation(handle: Scope | { owner: Scope; grant: string }, amount: number, to?: Scope): void {
    const root = this.executionPath(), within = Array.isArray(handle) ? handle : handle.owner
    if (!root || !root.every((id, i) => within[i] === id) || !Number.isFinite(amount) || amount <= 0) return
    const status = this.evaluationStatus(root)?.status
    if (this.evaluating || status && status !== 'idle' && status !== 'rolled-back' && status !== 'awaiting-review' && status !== 'committed') return
    if (Array.isArray(handle) && !handleAt(this.state.replica, handle)) { this.notify('error', 'This row holds no allocation to use.'); return }
    const id = newId()
    try { this.edit(consumeAllocation(this.state.replica, root, handle, amount, this.now(), { id, ...(to ? { to } : {}) })) }
    catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)); return }
    void this.evaluateAt([...root, id])
  }
  exitExecution(): void { this.execution = null; this.refresh() }
  evaluating = false
  /** Workflow claims must reach durable storage before a desktop process can start. */
  async saveWorkflowReplica(replica: Replica): Promise<void> {
    this.set({ replica }); await this.config.storage.flush?.(); this.scheduleSync()
  }
  /** A second window must not launch a request already claimed in shared durable storage. */
  workflowClaimAvailable(path: Scope): boolean {
    const saved = loadReplica(this.config.storage.loadReplica())
    const job = workflowJob(saved, path)
    return job?.status === 'queued'
  }
  evaluationStatus(path = this.state.view) { return evaluationRecord(this.state.replica, path) }
  addEvaluationConstructor(path: Scope): void {
    if (evaluationRecord(this.state.replica, path)) return
    this.edit(writeEvaluationRecord(this.state.replica, path, { id: crypto.randomUUID(), status: 'idle', started: this.now(), effects: [] }, this.now()))
  }
  async evaluateCurrent(): Promise<void> { await this.evaluateAt(this.currentRow()?.construction?.evaluation ? this.state.view.slice(0, -1) : [...this.state.view]) }
  /** Requirements the account server executes through scoped ref declarations: its search, market and model, the integration peers' repositories and calendar, attached MCP tools. */
  private serverHandles(step: import('../../shared/sync/evaluation').EvaluationStep): boolean {
    if (step.row?.requirement?.satisfied) return false
    const replica = this.state.replica
    if (this.deviceHandlers.executors(replica, step, replica.meta.peerId).length) return false
    // the row's left is the capability; the server handles it when it offers a handler of that capability here
    return this.handlerOffers(step.path).some(offer => offer.enabled &&
      (offer.peerId === 'fos' || offer.peerId.startsWith('integration:') || offer.peerId.startsWith('mcp:')) &&
      matchesInstructionRef(replica, step, offer))
  }
  async evaluateAt(path: Scope, triggered = false): Promise<void> {
    if (!triggered) document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
    if (this.evaluating) { if (triggered) throw new Error('Another evaluation is running.'); return }
    this.evaluating = true; this.refresh()
    const store = this.state.replica.store, generation = this.authGeneration
    const valid = () => { if (this.state.replica.store !== store || generation !== this.authGeneration) throw new Error('The data session changed during evaluation.') }
    try {
      const localPull = (step: import('../../shared/sync/evaluation').EvaluationStep) => step.row?.requirement?.tool === 'fos.pull'
      const workflowEffect = (step: import('../../shared/sync/evaluation').EvaluationStep) => [AGENT_TOOL].includes(step.row?.requirement?.tool ?? '')
      const shared = this.sharedNodeAt(path)
      if (shared) {
        // another account's node: their host evaluates it for us (with the `execute` grant), then we pull the result
        const session = this.state.session
        if (!session || session.kind !== 'user' || !this.isOnline('fos')) throw new Error('Connect to your account to run a node shared with you.')
        if (!this.sharedGrants(path)?.includes('execute')) throw new Error(`@${shared.owner} has not granted you “run evaluations” on this node.`)
        const serverPath = [...shared.scope, ...path.slice(shared.root.length)]
        await this.syncNow('before evaluation'); valid()
        const current = await sendEvent<{ valueRevision: string }>(session, { kind: 'read', path: [] }, serverPath, shared.owner)
        const answer = await evaluateOnServer(session, serverPath, current.valueRevision, {}, undefined, shared.owner)
        if (answer.status === 'requested') this.notify('info', 'Evaluation requested from the node\'s owner.')
        if (generation === this.authGeneration) await this.syncNow('evaluation results')
        return
      }
      const needsServer = evaluationSteps(this.state.replica, path).some(step => this.serverHandles(step))
      if (needsServer && evaluationSteps(this.state.replica, path).some(workflowEffect)) throw new Error('Run the coding-agent request separately from server integration effects.')
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
        now: () => this.now(), isPeerActive: id => this.isOnline(id),
        check: step => localPull(step) && !this.pullPeers().some(p => p.id === step.row?.requirement?.peer) ? ['The Pull peer is not connected.'] : [],
        // every device primitive answers values; the evaluator writes them. A primitive that reads this app does so through its closure, never the tree.
        executors: step => this.deviceHandlers.executors(this.state.replica, step, this.state.replica.meta.peerId)
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
    this.edit(writeTriggerState(this.state.replica, this.state.view, { ...state, occurrence: '', status: 'finished', error: undefined }, this.now()))
  }
  currentTrigger() { return nodeTrigger(this.state.replica, this.state.view) }
  currentTriggerState() { return triggerState(this.state.replica, this.state.view) }
  triggerOffers(path = this.state.view) {
    return discoverTriggerOffers(this.state.replica, path).map((offer) => ({
      ...offer,
      active: offer.peerId === this.state.replica.meta.peerId ? !!navigator.locks : this.isOnline(offer.peerId)
    }))
  }
  triggerKinds(path = this.state.view): TriggerKind[] {
    return this.triggerOffers(path)
      .filter((o) => o.enabled && o.active)
      .map((o) => o.capability ?? o.id)
  }
  configureTrigger(selector: string, value?: string, newTemplate = false, destination = this.state.view, enabled = true): void {
    try {
      const offers = this.triggerOffers(destination).filter(
        (o) => o.enabled && o.active && (o.cid === selector || (o.capability ?? o.id) === selector)
      )
      if (offers.length !== 1) throw new Error('Choose one available observer ref in this scope.')
      const offer = offers[0]!,
        source = this.state.replica
      this.deviceHandlers.restore(source, source.meta.peerId)
      const parentCid = destination.length && resolveScope(source.store, headCid(source), destination.slice(0, -1))
      const arg =
        newTemplate &&
        parentCid &&
        argumentRefs(source.store, parentCid).find((a) => content(source.store, a.cid).data.alias?.id === destination.at(-1))
      if (arg && !sameCapabilityType(source.store, arg.type, offer.type)) throw new Error('Choose an observer matching this input type.')
      let r = source,
        path = [...destination]
      const id =
        newTemplate && view(r, destination.slice(0, -1))?.tasks.find((row) => row.id === destination.at(-1))?.type !== TEMPLATE_TYPE
          ? newId()
          : null
      if (id) path = [...destination, id]
      const prior = !newTemplate ? nodeTrigger(r, path) : null,
        schedule = offer.definition.schedule
      const trigger: import('../../shared/sync/triggers').NodeTrigger = {
        ...prior,
        kind: offer.capability ?? offer.id,
        handler: offer.cid,
        peer: offer.peerId,
        enabled,
        created: this.now()
      }
      if (schedule && value !== undefined)
        trigger[schedule.field] = schedule.input === 'datetime-local' ? (value ? Date.parse(value) : undefined) : value
      if (missingSchedule({ ...trigger, definition: offer.definition })) trigger.enabled = false
      primitiveValues(source, destination, offer.peerId)
        .find((v) => v.ref === offer.cid)
        ?.implementation.trigger?.validate?.({ replica: source, path, config: trigger, now: this.now(), previous: null })
      if (id) r = addRow(r, destination, TEMPLATE_TYPE, offer.definition.label, this.now(), { id })
      r = setNodeTrigger(r, path, trigger, this.now())
      if (arg) {
        r = setRefValueAt(r, destination, resolveScope(r.store, headCid(r), path)!, this.now())
      }
      this.edit(r)
      this.notify('info', trigger.enabled ? 'Observer configured.' : 'Observer created paused. Fill its inputs, then enable it.')
    } catch (error) {
      this.notify('error', String(error))
    }
  }
  toggleTrigger(): void {
    const trigger = this.currentTrigger()
    if (!trigger) return
    const missing = missingSchedule(trigger)
    if (missing && !trigger.enabled) { this.notify('error', `Set its schedule (${missing}) before enabling the trigger.`); return }
    this.edit(setNodeTrigger(this.state.replica, this.state.view, { ...trigger, enabled: !trigger.enabled }, this.now()))
  }
  async runTriggers(): Promise<void> {
    if (this.runningTriggers || this.evaluating || this.projectSwitching || !navigator.locks) return
    this.deviceHandlers.restore(this.state.replica,this.state.replica.meta.peerId)
    const scanKey = headCid(this.state.replica) + JSON.stringify(this.branchSelections)
    if (scanKey !== this.triggerScanKey) { this.triggerScanKey = scanKey; this.triggerCandidates = configuredTriggers(this.state.replica) }
    const due = this.triggerCandidates.some(({ path, trigger }) => {
      if (!trigger.enabled || trigger.peer !== this.state.replica.meta.peerId) return false
      const prior = triggerState(this.state.replica, path)
      if (prior && prior.status !== 'finished') return false
      try {
        const observed = triggerObservation(this.state.replica,path,trigger,this.now())
        return !!observed && (observed.reset || observed.id !== prior?.occurrence)
      } catch { return true } // The runner records the observer error for review.
    })
    if (!due) return
    this.runningTriggers = true
    const store = this.state.replica.store
    try {
      await navigator.locks.request(`fos:triggers:${this.state.replica.meta.peerId}`, { ifAvailable: true }, async lock => {
        if (!lock) return
        const persisted = loadReplica(this.config.storage.loadReplica())
        this.deviceHandlers.restore(persisted,persisted.meta.peerId)
        for (const [id, name] of Object.entries(this.branchSelections)) selectBranch(persisted.store, id, name)
        await runNodeTriggers({
        get: () => { if (this.state.replica.store !== store) throw new Error('Data session changed'); return this.state.replica },
        save: async replica => { if (this.state.replica.store !== store) throw new Error('Data session changed'); this.set({ replica }); await this.config.storage.flush?.(); this.scheduleSync() },
        now: () => this.now(),
        available: (peer, kind, path) => {
          if (peer !== this.state.replica.meta.peerId) return false
          const saved = triggerState(persisted, path), current = nodeTrigger(this.state.replica, path)
          const own = triggerState(this.state.replica, path)
          if (saved && current && triggerOccurrence(persisted, path, current, this.now()) !== triggerOccurrence(this.state.replica, path, current, this.now())) return false
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
    return argumentRefs(r.store, cid).filter(arg => arg.type === primitive(r.store, 'string') && !content(r.store, arg.cid).data.ref && content(r.store, arg.cid).data.name?.content && !settingOf(r.store, content(r.store, arg.cid))).map(arg => {
      const result = resolveText(r, path, `{{${arg.name}}}`)
      return { id: content(r.store, arg.cid).data.alias!.id, name: arg.name!, text: result.bindings[0]?.status === 'ready' ? result.text : '', problems: result.bindings.flatMap(b => b.problems) }
    })
  }
  private setArgumentValue(at: Scope, id: string, value: string): void {
    const r = this.state.replica, path = [...this.state.view, ...at, id]
    const next = setRefValueAt(r, path, value, this.now())
    const cid = resolveScope(next.store, headCid(next), path)
    const branches = cid && refBranches(next.store, content(next.store, cid))
    if (branches) this.branchSelections[branches.id] = branches.selected
    this.edit(next); this.savePrefs()
  }
  setTextArgument(at: Scope, id: string, text: string): void {
    this.setArgumentValue(at, id, textValue(this.state.replica.store, text))
  }
  addTextArgument(at: Scope, name: string, text: string): void {
    if (!/^[A-Za-z_][\w.-]*$/.test(name)) { this.notify('error', 'Use letters, digits, underscores, dots or hyphens for the argument name.'); return }
    const store = this.state.replica.store
    const value = text ? textValue(store, text) : null
    this.edit(addRefAt(this.state.replica, [...this.state.view, ...at], newId(), primitive(store, 'string'), this.now(), value, name))
    this.notify('info', `Text argument ${name} added. Use {{${name}}} in notes in this context.`)
  }
  addPlaceholder(name: string, typeName: string, destination = this.state.view): void {
    if (!/^[A-Za-z_][\w.-]*$/.test(name) || !typeName.trim()) { this.notify('error', 'Give the placeholder a name and type.'); return }
    const r = this.state.replica
    let type: string
    if (r.store.table.has(typeName)) type = typeName
    else if (typeName.startsWith('template:')) {
      const id = typeName.slice(9), library = this.libraryConstructors(destination).find(item => item.id === id)
      const local = library ? null : resolveRef(r, id, destination)
      const cid = library?.cid ?? (local && resolveScope(r.store, headCid(r), [...local.path, local.row.id]))
      if (!cid) throw new Error('This template is unavailable in the enclosing scope.')
      type = templateValuePattern(r.store, cid)
    } else if (typeName === 'text') type = primitive(r.store, 'string')
    else {
      // A declaration's pattern is available even when its value is still an unfilled parameter.
      const found = selectBinding(bindingLayers(r, destination), typeName.trim(), false, true)
      if (found.status !== 'ready' && found.status !== 'missing') throw new Error('Choose an available, unambiguous placeholder type.')
      if (found.status === 'ready') {
        const binding = found.locations[0]!
        if (new Set(binding.assignments.map(assignment => assignment.pattern)).size !== 1) throw new Error('The placeholder declarations have incompatible patterns.')
        type = binding.pattern
      } else type = libAt(r.store, destination).capabilities[typeName.trim()]!
    }
    this.edit(addRefAt(r, destination, newId(), type, this.now(), null, name))
  }
  /**
   * A capability by name, declared here as a named ref with nothing behind it yet (an open hole): rows of it can be
   * required in this scope, and a handler or a peer can fill it later.
   */
  declareCapability(name: string, at: Scope = this.state.view): void {
    const label = name.trim()
    if (!label || label.length > 200) { this.notify('error', 'Give the capability a name (at most 200 characters).'); return }
    if (this.scopeCapabilities(at).some(c => c.name === label)) { this.notify('info', `“${label}” is already declared here.`); return }
    const type = put(this.state.replica.store, { data: {}, children: [[tagNode(this.state.replica.store, label), put(this.state.replica.store, { data: {}, children: [] })]] })
    this.edit(addRefAt(this.state.replica, at, newId(), type, this.now(), null, label))
  }
  /** Capabilities declared by name in the scope of `at` (not the library's): what `declareCapability` made, here or above. */
  scopeCapabilities(at: Scope = this.state.view): Array<{ name: string; type: string }> {
    const store = this.state.replica.store
    // the library's capabilities have their own constructors: only names declared beside them are new here
    const seen = new Set<string>([...this.libraryNames(at).map(n => n.node), ...capabilityDeclarations(store, at).map(d => d.cid)])
    // declarations, filled or not: a capability nothing provides yet is still one rows can ask for
    return bindingLayers(this.state.replica, at).flatMap(layer => layer.bindings).flatMap(binding => {
      if (capabilityName(binding.store, binding.pattern) === null || !binding.name || seen.has(binding.pattern)) return []
      seen.add(binding.pattern)
      return [{ name: binding.name, type: binding.pattern }]
    })
  }
  placeholders(at: Scope = []) {
    const path = [...this.state.view, ...at]
    const r = this.state.replica, cid = resolveScope(r.store, headCid(r), path)
    if (!cid) return []
    const candidates = contextBindings(r, path, { isPeerActive: id => this.isOnline(id) })
    // Form fields already have editors from their left constructors. This picker
    // offers explicitly declared ref inputs, including those that now appear as rows.
    return argumentRefs(r.store, cid).filter(a => !settingOf(r.store, content(r.store, a.cid)) && isRefNode(r.store, content(r.store, a.cid))).map(a => ({
      id: content(r.store, a.cid).data.alias!.id, name: a.name ?? 'Value',
      branches: refBranches(r.store, content(r.store, a.cid)),
      child: (() => { const target = refValueCid(r.store, content(r.store, a.cid)); return target && isRefNode(r.store, content(r.store, target)) ? content(r.store, target).data.name?.content ?? 'Value' : null })(),
      type: a.type === primitive(r.store, 'string') ? 'text' : capabilityOfTarget(r.store, a.type) ?? content(r.store, a.type).data.name?.content ?? 'Named type',
      status: resolveBinding(r.store, a.type, content(r.store, a.cid).data.refExpression ? a.cid : refValueCid(r.store, content(r.store, a.cid)), candidates, a.name, { isPeerActive: id => this.isOnline(id), scope: { replica: r, path } }).status,
      candidates: candidates.filter(c => c.cid !== a.cid && matchesGraph(r.store, a.type, c.cid)).map(c => ({ cid: c.cid, label: c.name ?? fieldTextOf(r.store, c.cid) ?? 'Matching handler' }))
    }))
  }
  selectArgumentBranch(at: Scope, id: string, name: string): void {
    const branches = this.placeholders(at).find(p => p.id === id)?.branches
    if (!branches?.names.includes(name)) return
    document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
    selectBranch(this.state.replica.store, branches.id, name)
    this.branchSelections[branches.id] = name; this.savePrefs(); this.refresh()
  }
  /** The pattern the node at `path` is used with (its row's left): each ref with its value and its submitted options. */
  patternBindingsAt(path: Scope = this.state.view): PatternBinding[] {
    if (!path.length) return []
    const r = this.state.replica, parent = resolveScope(r.store, headCid(r), path.slice(0, -1))
    const edge = parent ? findEdge(r.store, valueContent(r.store, parent), `a:${path.at(-1)}`) : undefined
    return edge ? patternBindings(r.store, edge[0]).filter(binding => binding.value || binding.options.length) : []
  }
  valueLabel(cid: string): string {
    const node = valueContent(this.state.replica.store, cid)
    return fieldTextOf(this.state.replica.store, cid) ?? node.data.name?.content ?? (node.data.scalar ? String(node.data.scalar.value) : cid.slice(-8))
  }
  choosePatternBinding(alias: string, proposal: string, path: Scope = this.state.view): void {
    this.edit(choosePatternBindingAt(this.state.replica, path.slice(0, -1), path.at(-1)!, alias, proposal, this.now()))
  }
  /** Use the template `templateId` as this row's pattern: the row's values are submitted to its refs by position. */
  usePattern(templateId: string): void {
    const path = this.state.templatePicker?.path
    if (!path?.length) return
    const r = this.state.replica, template = findRowByAlias(r.store, headCid(r), templateId)
    const cid = template && resolveScope(r.store, headCid(r), [...template.path, templateId])
    if (!cid) { this.notify('error', 'That pattern is unavailable.'); return }
    const copied = transferRefGraph(r, cid, [...template!.path, templateId], path, true)
    const used = usePatternAt(r, path.slice(0, -1), path.at(-1)!, valueCidOf(r.store, copied), r.meta.peerId, this.now())
    this.edit(used.replica); this.closeModal()
    this.notify('info', `${used.submitted} value${used.submitted === 1 ? '' : 's'} submitted to the pattern${used.skipped ? `; ${used.skipped} did not fit` : ''}.`)
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
    const child = put(r.store, refNodeContent(r.store, { alias: { id: newId() }, name: { content: `${arg.name ?? 'Value'} child` } }, null, []))
    this.setArgumentValue([], id, child)
  }
  dropArgument(at: Scope, id: string, sourceId: string): void {
    const arg = this.placeholders(at).find(p => p.id === id)
    if (!arg || sourceId === id) return
    const store = this.state.replica.store
    const candidate = arg.candidates.find(c => c.cid === sourceId || content(store, c.cid).data.alias?.id === sourceId)
    if (candidate) { this.bindPlaceholder(id, candidate.cid, at); return }
    const source = findRowByAlias(store, headCid(this.state.replica), sourceId)
    if (source) {
      const cid = resolveScope(store, headCid(this.state.replica), [...source.path, source.row.id])
      const parent = resolveScope(store, headCid(this.state.replica), [...this.state.view, ...at])
      const declaration = parent && argumentRefs(store, parent).find(a => content(store, a.cid).data.alias?.id === id)
      if (cid && declaration && matchesGraph(store, declaration.type, cid)) {
        try {
          const destination = [...this.state.view, ...at]
          this.together(() => {
            const shared = shareRefAt(this.state.replica, [...source.path, source.row.id], destination, this.now())
            const visible = resolveRef(shared, sourceId, destination)
            if (!visible) throw new Error('Declare this ref in a shared scope first.')
            const value = resolveScope(store, headCid(shared), [...visible.path, visible.row.id])!
            this.edit(setRefValueAt(shared, [...destination, id], value, this.now()))
          })
        } catch (error) { this.notify('error', String(error)) }
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
   * Hand a requirement to the peer that registered its capability: the account server runs it as an evaluation
   * effect of that requirement (search: hits as ref rows under it; market: the task listed), recording the supply.
   */
  /** The handler this device runs `row` with (a device primitive such as fetch or solve), if any. */
  deviceHandlerFor(path: Scope, row: TaskView): string | null {
    const step = { path, row: row.requirement ? { ...row, requirement: { ...row.requirement, satisfied: false } } : row }
    if (!this.deviceHandlers.executors(this.state.replica, step, this.state.replica.meta.peerId).length) return null
    const me = this.state.replica.meta.peerId, store = this.state.replica.store
    const capability = row.requirement?.capability ?? (row.typeCid ? capabilityName(store, row.typeCid) : null)
    return this.handlerOffers(path).find(offer => offer.peerId === me && offer.capability === capability)?.label ?? 'Run'
  }
  /** A row made by a constructor node: each ref it declares, with the row's value for it and what was submitted. */
  rowInputs(path: Scope): Array<OpenRef & { text: string | null; options: Array<{ proposal: string; text: string }> }> | null {
    const r = this.state.replica, constructor = path.length ? rowConstructor(r, path) : null
    const refs = constructor ? openRefs(r.store, constructor) : []
    if (!refs.length) return null
    const node = resolveScope(r.store, headCid(r), path)
    return refs.map(ref => {
      const assignment = node && findEdge(r.store, valueContent(r.store, node), `a:${ref.alias}`)
      const options = assignment ? readProposals(r.store, content(r.store, identityCid(r.store, assignment))).filter(p => p.status === 'open').map(p => ({ proposal: p.cid, text: fieldTextOf(r.store, p.contentCid) ?? '' })) : []
      return { ...ref, text: (() => { const held = assignedValue(r, path, ref.alias); return held ? fieldTextOf(r.store, held) : null })(), options }
    })
  }
  assignRowInput(path: Scope, alias: string, text: string): void {
    const r = this.state.replica
    this.edit(assignRefAt(r, path, alias, text ? textValue(r.store, text) : null, this.now()))
  }
  chooseRowInput(path: Scope, alias: string, proposal: string): void {
    this.acceptHere([...path, alias], proposal)
  }
  async askPeerAt(at: Scope, req: TaskView): Promise<void> {
    const r = req.requirement
    if (!r) return
    // what this device runs itself needs no account
    if (this.deviceHandlerFor([...this.state.view, ...at, req.id], req)) { await this.evaluateAt([...this.state.view, ...at, req.id]); return }
    if (r.capability === 'tool' && r.tool === 'fos.pull') { await this.evaluateAt([...this.state.view, ...at, req.id]); return }
    const session = this.state.session
    if (!session || session.kind !== 'user') { this.notify('error', 'Sign in to your account: its peers handle this.'); this.openModal('connect'); return }
    const task = this.rowAt(at)
    try {
      if (r.capability === 'llm') { this.openWork(at, req.id); return }
      if (this.serverHandles({ path: [...this.state.view, ...at, req.id], row: { ...req, requirement: { ...r, satisfied: false } } })) {
        // the peer that registered the capability runs it as an evaluation effect of this requirement (the account server's scoped refs)
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
        if (row.allocation && !row.requirement) out.push({ row, path })
        if (row.childCount) walk([...path, row.id])
      }
    }
    walk([])
    return out
  }
  /** Supply a requirement: a confirmation by this user, a choice, or a reference to an allocation/query row. */
  supplyRequirementAt(at: Scope, requirementId: string, supply: { capability?: string; ref?: string; choice?: number }, absolute = false): void {
    const requirement = this.rowAt(absolute ? [] : [...at, requirementId]) ?? view(this.state.replica, absolute ? at : [...this.state.view, ...at])?.tasks.find(t => t.id === requirementId)
    const capability = supply.capability ?? requirement?.requirement?.capability
    if ((capability === 'confirmation' || capability === 'peer') && !this.state.session) { this.notify('error', 'Sign in to confirm: confirmation is a capability of a logged-in person.'); this.openModal('connect'); return }
    const by = this.state.session?.username ?? this.state.deviceName
    const parent = absolute ? at : [...this.state.view, ...at]
    try { this.edit(supplyRequirement(this.state.replica, parent, requirementId, { by, ...(supply.ref !== undefined ? { ref: supply.ref } : {}), ...(supply.choice !== undefined ? { choice: supply.choice } : {}) }, this.now())) }
    catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)); return }
    this.set({ collapsed: this.state.collapsed.filter((c) => c !== requirementId) })
  }
  /**
   * A manual fallback from the standard library on an unsatisfied requirement: the person records that they did it
   * by hand. Allocations get a receipt row inside the requirement (its resource is the requirement itself) plus the
   * supply that points at it; a place comes from `input` or, for the device handler, from this device's position;
   * every other requirement gets a supply by the person; a request for money gets a payment (a positive money row).
   * Works offline, with no peer.
   */
  async applyManualHandler(at: Scope, requirement: TaskView, handler: ManualHandler, input?: string, absolute = false): Promise<void> {
    const req = requirement.requirement
    if (!req || req.satisfied) return
    const by = this.actorName(), parent = absolute ? at : [...this.state.view, ...at]
    if (req.capability !== 'allocation' && !req.linear) { this.supplyRequirementAt(at, requirement.id, {}, absolute); return }
    // a demand for a resource pins the allocate contract: only a grant a bank issued fills it, through an evaluated allocate invocation
    void handler; void input; void by; void parent
    this.notify('error', 'A resource requirement is filled by using a grant from a bank in the execution view, not by hand.')
  }
  /**
   * Run a query row. Search is the account server's `search` effect, which fills `-?` requirements: a query inside one
   * runs that requirement; a query on its own is put inside a new `-?` requirement first (where its hits will go).
   */
  async runQueryAt(at: Scope, query: TaskView): Promise<void> {
    const parent = at.length ? view(this.state.replica, [...this.state.view, ...at.slice(0, -1)])?.tasks.find(t => t.id === at.at(-1)) : undefined
    if (parent?.requirement?.capability === 'search') { await this.askPeerAt(at.slice(0, -1), parent); return }
    await this.searchAt(at, query.title, !!query.query?.market, query.id)
  }
  /** A `-?` requirement at `at` holding the query (its text and `market` option), run by the account server. */
  async searchAt(at: Scope, text: string, market: boolean, replacing?: string): Promise<void> {
    if (!text.trim()) return
    const id = this.addRowAt(at, argumentType('search'), text, { extras: { demand: { capability: 'search' } }, ...(replacing ? { position: { relativeTo: replacing, position: 'below' as const } } : {}) })
    this.addRowAt([...at, id], QUERY_TYPE, text, { extras: { query: market ? { market } : {} } })
    if (replacing) this.edit(deleteTask(this.state.replica, [...this.state.view, ...at], replacing, this.now()))
    const req = view(this.state.replica, [...this.state.view, ...at])?.tasks.find(t => t.id === id)
    if (req) await this.askPeerAt(at, req)
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
    // the bid is built here, as rows of this account's own: the allocations travel with it (the owner cannot see our
    // banks) and each supply goes under the requirement it fills, referencing its copy
    const me = session.username, t = this.now(), under = new Map<string, string>()
    const bid = draftBid(this.state.replica, [], t, draft => {
      if (comment.trim()) draft = addRow(draft, [], COMMENT_TYPE, comment.trim(), t, { author: { id: `user:${me}`, name: me } })
      for (const s of supplies) {
        const found = this.allocations().find(({ row }) => row.id === s.allocationId)
        if (!found?.row.allocation) continue
        const copyId = `${s.allocationId}-${me}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64), supplyId = `${copyId}-supply`
        // the bidder's allocation goes under the requirement; binding it as the requirement's result is the owner's acceptance
        draft = addAllocation(draft, [], found.row.title, t, { ...found.row.allocation, by: me }, { id: copyId })
        void supplyId
        under.set(copyId, s.requirementId)
      }
      return draft
    }, id => under.has(id) ? [under.get(id)!] : [])
    if (!bid.rows.length) { this.notify('error', 'Write a comment or supply an allocation first.'); return }
    this.set({ market: { ...market, phase: 'submitting', error: undefined } })
    try {
      await submitMarketProposal(session, market.owner, market.aliasId, bid)
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
    const created = this.addRowAt(at, PLAIN_TYPE, '', { position: { relativeTo: id, position: 'below' } })
    this.set({ selected: [...at, created] })
  }
  /**
   * Ctrl+Shift+Enter: a blank row inside `id` (plain, or a comment from the menu), selected for typing. `seed` starts
   * the row's text with a marker ("-", "$ ", "@money ") so the menu can open a requirement, allocation or bank row.
   */
  addRowInside(at: Scope, id: string, type: string = PLAIN_TYPE, seed = ''): void {
    const created = this.addRowAt([...at, id], type, type === COMMENT_TYPE ? ' ' : seed)
    this.set({ selected: [...at, id, created], collapsed: this.state.collapsed.filter((c) => c !== id) })
  }
  /** A row below `id` whose text starts with `seed` (a marker), selected for typing. */
  addRowBelowWith(at: Scope, id: string, seed: string): void {
    const created = this.addRowAt(at, PLAIN_TYPE, seed, { position: { relativeTo: id, position: 'below' } })
    this.set({ selected: [...at, created] })
  }
  /** The blank row at the top of the view was typed into: a row of the parsed type becomes the first row here. */
  private addParsedChildren(at: Scope, children: import('./rows').ParsedInput[], replica?: Replica, preserveUnbound = false): void {
    for (const child of children) {
      const id = this.addRowAt(at, child.type, child.text, { done: child.done, extras: child.extras, templateName: child.templateName, replica, preserveUnbound })
      if (child.peer !== undefined) { if (replica) this.peerRowReplica(replica, [...this.state.view, ...at, id], child.peer); else this.setPeerRow([...this.state.view, ...at, id], child.peer) }
      if (view(replica ?? this.state.replica, [...this.state.view, ...at])?.tasks.some(row => row.id === id) && child.children?.length) this.addParsedChildren([...at, id], child.children, replica, preserveUnbound)
    }
  }
  addRowAtTop(parsed: import('./rows').ParsedInput): string | null {
    if ((parsed.children?.length || parsed.peer !== undefined) && !this.groupedEdit) return this.together(() => this.addRowAtTop(parsed))
    const created = this.addRowAt([], parsed.type, parsed.text, { done: parsed.done, extras: parsed.extras, templateName: parsed.templateName })
    if (parsed.peer !== undefined) this.setPeerRow([...this.state.view, created], parsed.peer)
    if (this.currentView()?.tasks.some((t) => t.id === created) && parsed.children?.length) this.addParsedChildren([created], parsed.children)
    return this.currentView()?.tasks.some((t) => t.id === created) ? created : null
  }
  setDoneAt(at: Scope, id: string, done: boolean): void {
    this.edit(setTaskDone(this.state.replica, [...this.state.view, ...at], id, done, this.now()))
  }
  setRowTypeAt(at: Scope, id: string, type: string): void {
    this.edit(setRowType(this.state.replica, [...this.state.view, ...at], id, type, this.now()))
  }
  /** Alt+drag: a reference to `targetId` placed at `position` under `toAt`. */
  addRefAt(toAt: Scope, targetId: string, position?: MovePosition): void {
    try { this.edit(addRef(this.state.replica, [...this.state.view, ...toAt], targetId, this.now(), position)) }
    catch (error) { this.notify('error', String(error)) }
  }
  /** Ctrl+drag: a copy of the row `id` (with its subtree) at `position` under `toAt`. */
  copyRowAt(fromAt: Scope, id: string, toAt: Scope, position: MovePosition): void {
    const base = this.state.view
    try { this.edit(copyNode(this.state.replica, [...base, ...fromAt], id, [...base, ...toAt], position, this.now())) }
    catch (error) { this.notify('error', String(error)) }
  }
  // -------------------------------------------------------------------------
  // Voice notes: record in the browser, let the account transcribe and organize

  private recorder: MediaRecorder | null = null
  private recorded: Blob[] = []

  /** The account can organize captures here (a signed-in account whose fos peer offers `organize`). */
  canOrganize(): boolean {
    return this.capabilityAvailable('organize') && this.state.session?.kind === 'user'
  }
  canRecordVoice(): boolean {
    return this.canOrganize() && !recordingUnsupported()
  }

  async toggleVoice(): Promise<void> {
    if (this.state.voice?.phase === 'recording') { this.recorder?.stop(); return }
    if (this.state.voice) return
    if (!this.state.session) { this.notify('error', 'Connect to your account to transcribe voice notes.'); this.openModal('connect'); return }
    const unsupported = recordingUnsupported()
    if (unsupported) { this.notify('error', unsupported); return }
    if (!this.canOrganize()) { this.notify('error', 'Recording needs an active Fos peer that organizes captures.'); return }
    const at = [...this.state.view]
    const generation = this.authGeneration
    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (generation !== this.authGeneration) { stream.getTracks().forEach((t) => t.stop()); return }
      // iOS (Safari and the app's WKWebView) records MP4/AAC only; a type it refuses falls back to its own default
      const mime = recordingMimeType()
      let recorder: MediaRecorder
      try { recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined) } catch { recorder = new MediaRecorder(stream) }
      const tracks = stream
      this.recorded = []
      recorder.addEventListener('dataavailable', (e) => { if (e.data.size) this.recorded.push(e.data) })
      recorder.addEventListener('error', (event) => {
        tracks.getTracks().forEach((t) => t.stop())
        this.recorder = null; this.recorded = []
        if (generation === this.authGeneration) { this.set({ voice: null }); this.notify('error', microphoneError((event as Event & { error?: unknown }).error ?? new Error('Recording failed.'))) }
      })
      recorder.addEventListener('stop', () => {
        tracks.getTracks().forEach((t) => t.stop())
        if (!this.recorder) return // stopped by an error
        const blob = new Blob(this.recorded, { type: recordedType(recorder.mimeType, mime, this.recorded) })
        this.recorder = null
        if (generation === this.authGeneration) void this.submitVoice(blob, at)
      })
      recorder.start(1000)
      this.recorder = recorder
      this.set({ voice: { phase: 'recording', startedAt: this.now() } })
    } catch (error) {
      stream?.getTracks().forEach((t) => t.stop())
      this.notify('error', microphoneError(error))
    }
  }

  /** A recording: transcribed by the account, then organized into the node it was recorded at (the transcript kept as a note). */
  private async submitVoice(blob: Blob, at: Scope): Promise<void> {
    const session = this.state.session
    if (!session || blob.size < 1000) { this.set({ voice: null }); if (blob.size < 1000) this.notify('error', 'The recording was empty.'); return }
    const generation = this.authGeneration, store = this.state.replica.store
    this.set({ voice: { phase: 'uploading' } })
    try {
      const { transcript } = await transcribeAudio(session, blob)
      if (generation !== this.authGeneration || this.state.session !== session || this.state.replica.store !== store) return
      await this.organizeInto(transcript, at, 'Voice note')
    } catch (error) {
      if (generation !== this.authGeneration) return
      this.notify('error', error instanceof Error ? error.message : String(error))
    } finally {
      if (generation === this.authGeneration) this.set({ voice: null })
    }
  }

  /** Long pasted or typed text, organized into the node at `at` (default: the current node). True when it was filed. */
  async organizeText(text: string, at: Scope = [...this.state.view]): Promise<boolean> {
    if (this.state.voice) { this.notify('info', 'Finish the current recording or capture first.'); return false }
    if (!text.trim()) return false
    if (!this.state.session) { this.notify('error', 'Connect to your account to organize text.'); this.openModal('connect'); return false }
    if (!this.canOrganize()) { this.notify('error', 'Organizing needs an active Fos peer that organizes captures.'); return false }
    const generation = this.authGeneration
    try {
      return await this.organizeInto(text, at, 'Pasted text')
    } catch (error) {
      if (generation === this.authGeneration) this.notify('error', error instanceof Error ? error.message : String(error))
      return false
    } finally {
      if (generation === this.authGeneration) this.set({ voice: null })
    }
  }

  /**
   * Organize a capture into the subtree of `at` (shared/sync/organize.ts): an `organize` requirement placed there
   * holding the capture (`requestOrganize`), run on the account server (`runOnServer`), whose `organize` handler asks
   * its model and answers the request with the plan's rows inside it; the filled request stays as the row holding
   * them. When the server cannot organize it the request is removed and the capture kept here, unorganized. (The plan
   * as one fos submission on `at` awaits its replacement: web/CLAUDE.md.)
   */
  private async organizeInto(text: string, at: Scope, label: string): Promise<boolean> {
    const session = this.state.session, generation = this.authGeneration, store = this.state.replica.store
    if (!session) throw new Error('Connect to your account to organize captures.')
    if (!view(this.state.replica, at)) throw new Error('The capture location was removed.')
    this.set({ voice: { phase: 'organizing' } })
    const asked = requestOrganize(this.state.replica, at, text, label, this.now())
    this.edit(asked.replica)
    let failure: string | null = null
    try { await this.runOnServer(asked.path) } catch (error) { failure = error instanceof Error ? error.message : String(error) }
    if (generation !== this.authGeneration || this.state.session !== session || this.state.replica.store !== store) return false
    const answered = failure ? null : requirementAnswer(this.state.replica, asked.path)
    if (answered !== null) {
      const count = organizedRowCount(this.state.replica, asked.path)
      this.notify('info', `${label} organized: ${count} row${count === 1 ? '' : 's'} in “${label}”${answered ? ` (${answered})` : ''}.`)
      return true
    }
    let next = this.state.replica
    if (resolveScope(next.store, headCid(next), asked.path)) next = deleteTask(next, at, asked.path.at(-1)!, this.now())
    if (!view(next, at)) throw new Error('The capture location was removed while organizing.')
    next = addTypedRow(next, at, typeAt(next, NOTE_TYPE, at), captureNoteText(label, new Date(this.now()).toLocaleString(), text), this.now())
    this.edit(next)
    this.notify('error', `Kept the ${label.toLowerCase()} unorganized: ${failure ?? 'the server did not organize it'}`)
    return true
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
    this.edit(addAttachment(this.state.replica, at, { name: file.name, type: file.type, data, size: file.size }, this.now()))
  }
  /** A plain row referencing a file in a linked directory (path relative to it, checksum from the desktop; web/src/filesystem.ts). */
  addFileReference(at: Scope, file: FileReference): string {
    const id = newId()
    this.edit(addFileReference(this.state.replica, at, file, this.now(), id))
    return id
  }
  /** Re-pin a reference to the checksum its file has now. */
  /** Fill row `rowId`'s named fields (at the absolute path `at`). */
  setRowFields(at: Scope, rowId: string, input: Record<string, string | number>): void { this.edit(setRowFieldsAt(this.state.replica, at, rowId, input, this.now())) }
  setFileReference(at: Scope, rowId: string, file: FileReference): void { this.edit(setFileReferenceAt(this.state.replica, at, rowId, file, this.now())) }
  fileReference(path: Scope): FileReference | null { return fileReferenceAt(this.state.replica, path) }
  attachment(at: Scope) { return attachmentAt(this.state.replica, at) }
  insertVoiceNote(note: VoiceNote, at: Scope = this.state.view, sourceLabel = 'Transcript'): void {
    if (!view(this.state.replica, at)) throw new Error('The recording location was removed. Voice note could not be added.')
    const stamp = new Date(this.now()).toLocaleString()
    const parentId = crypto.randomUUID()
    let replica = addRow(this.state.replica, at, NOTE_TYPE, `# ${note.title || 'Voice note'}\n\n_${stamp}_\n\n${note.summary}`, this.now(), { id: parentId })
    for (const cluster of note.clusters) {
      const clusterId = crypto.randomUUID()
      replica = addRow(replica, [...at, parentId], NOTE_TYPE, `## ${cluster.title}\n\n**${cluster.sentiment}** — ${cluster.summary}`, this.now(), { id: clusterId })
      for (const point of cluster.points) replica = addRow(replica, [...at, parentId, clusterId], PLAIN_TYPE, point, this.now())
    }
    replica = addRow(replica, [...at, parentId], NOTE_TYPE, `## ${sourceLabel}\n\n${note.transcript}`, this.now())
    this.edit(replica)
  }

  /** Where a reference points, relative to the replica root (null when the target is gone). */
  refTarget(refId: string): { path: Scope; row: TaskView } | null {
    return resolveRef(this.state.replica, refId, this.state.view)
  }
  /** The shared address of the row `id` as seen from `at` (refs resolve by nearest ancestor; default: the current view). */
  sharedLink(id: string, at: Scope = this.state.view): SharedAddress | null {
    const found = findRowByAlias(this.state.replica.store, headCid(this.state.replica), id)
    return found ? sharedAddressAt(this.state.replica, [...found.path, found.row.id]) : null
  }
  receiveSharedLink(address: SharedAddress, title: string): Scope {
    const result = ensureSharedLink(this.state.replica, address, title, this.now(), this.state.session?.kind !== 'user')
    this.edit(result.replica)
    return result.path
  }
  rememberSharedSources(path: Scope, sources: Record<string, string>): void {
    // which of this context's rows answered the shared node's inputs: what taking part in it left on the link row
    this.edit(writeHandlerResult(this.state.replica, path, { sources }, this.now()))
  }
  openSharedLink(id: string, at: Scope = this.state.view): void {
    const address = this.sharedLink(id, at), found = findRowByAlias(this.state.replica.store, headCid(this.state.replica), id)
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
    if (this.isHome([...this.state.view, taskId])) return
    this.edit(renameTask(this.state.replica, [...this.state.view, ...at], taskId, title, this.now()))
  }
  deleteTaskAt(at: Scope, taskId: string): void {
    this.edit(deleteTask(this.state.replica, [...this.state.view, ...at], taskId, this.now()))
  }
  /** A blank/plain row typed with a data prefix (`-` requirement, `?` query, `@calendar` bank, `$ 50` allocation, `` ` `` template) becomes a row of that type in its place. */
  convertPlainRowAt(at: Scope, id: string, parsed: { type: string; text: string; done: boolean; extras?: RowInputExtras; templateName?: string }): void {
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

  /** A row dragged from `fromAt` (under the view) dropped on the node at the absolute path `target` (a breadcrumb): moved, referenced or copied to its end. */
  dropRowInto(fromAt: Scope, id: string, target: Scope, mode: 'move' | 'ref' | 'copy'): void {
    const from = [...this.state.view, ...fromAt], own = [...from, id]
    if (!target.length) return
    if (mode === 'move' && target.length >= own.length && own.every((step, i) => target[i] === step)) { this.notify('error', 'A row cannot move into itself.'); return }
    const into: MovePosition = { into: target.at(-1)! }, parent = target.slice(0, -1), now = this.now()
    try {
      if (mode === 'ref') this.edit(addRef(this.state.replica, parent, id, now, into))
      else if (mode === 'copy') this.edit(copyNode(this.state.replica, from, id, parent, into, now))
      else this.edit(moveNode(this.state.replica, from, id, parent, into, now), this.state.atRoot, [...target, id])
    } catch (error) { this.notify('error', String(error)) }
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
  /** One node of a pending submission on the node at `path` (`relative` to it), as its peer serves it: shallow, its rows as addresses. */
  private async fetchProposalNode(path: Scope, id: string, relative: Scope = []): Promise<{ request: NodeRequest; node: ProvidedNode }> {
    const transport = this.transport(), peer = this.attachmentPeer(), connection = transport && this.transportTo(path, peer)
    if (!connection || !peer) throw new Error('Connect to the peer that holds this submission.')
    const scope = connection.attachment([...this.state.replica.meta.scope, ...path])
    const address = transport === 'account' ? [...this.state.replica.meta.scope, ...path] : [...scope, ...path]
    const request: NodeRequest = { ...nodeSyncRequest(this.state.replica, path, peer, scope, [...address.slice(scope.length), ...relative]), proposal: { scope: address, id } }
    if (relative.length) request.linkId = nodeRequestLinkId(this.state.replica.meta.peerId, { peerId: peer, scope: [...address, ...relative] })
    const node = await connection.request(request)
    validateNodeShape(node)
    return { request, node }
  }
  async loadProposalPreview(path: Scope, id: string, relative: Scope = []): Promise<void> {
    const store = this.state.replica.store, generation = this.authGeneration, session = this.state.session
    if (!this.transport() || !this.readsRequests()) return
    const cached = this.proposalPreviews.get(id)
    if (relative.length && (!cached || cached.store !== store || cached.generation !== generation)) return
    try {
      const { request, node } = await this.fetchProposalNode(path, id, relative)
      if (store !== this.state.replica.store || generation !== this.authGeneration || session !== this.state.session) return
      let replica = relative.length ? cached!.replica : createReplica(this.state.replica.meta.peerId)
      replica = acceptProvidedNode(replica, relative, request, node, this.now())
      this.proposalPreviews.set(id, { replica, path, request, store, generation })
      this.refresh()
    } catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)) }
  }

  /** The submissions pending on the node at `path`, as its peer last served them. */
  private remoteProposalsAt(path: Scope): ProposalView[] {
    const peer = this.state.replica.meta.serverPeerId
    return (peer && this.state.replica.meta.nodeSync?.[nodeSyncKey(peer, path, nodeBranches(this.state.replica, path))]?.remote.proposals) || []
  }
  /** A submission this device accepts itself: by the account's own fos peer (an organized capture), only adding rows. */
  private locallyAcceptable(path: Scope, proposalId: string): ProposalView | null {
    const p = this.remoteProposalsAt(path).find(p => p.id === proposalId)
    return p && p.peerId === ORGANIZE_PEER && p.status === 'open' && p.additions?.length && this.state.session?.kind === 'user' ? p : null
  }
  /**
   * Accept a submission of the account's fos peer here, as ONE local edit (one undo takes the whole capture back):
   * the submission's shallow node at each node it adds rows to is fetched (never the rows themselves), the added rows
   * go in as unloaded rows addressed to the account (node-sync.ts `acceptSubmissionRows`) and the sync pushes those
   * nodes; the account fills the rows from the submission and closes it. The rows load when they are opened.
   */
  async acceptSubmission(path: Scope, proposalId: string, additions: Array<{ path: Scope; ids: string[] }>): Promise<boolean> {
    const store = this.state.replica.store, session = this.state.session
    try {
      const nodes = await Promise.all(additions.map(async a => ({ path: a.path, children: (await this.fetchProposalNode(path, proposalId, a.path)).node.children })))
      if (store !== this.state.replica.store || session !== this.state.session) return false
      // the rows reach the account's main with the next sync; until then they are not requested from it
      for (const a of additions) for (const id of a.ids) this.acceptedRows.set(JSON.stringify([...path, ...a.path, id]), { at: [...path], id: proposalId })
      this.edit(acceptSubmissionRows(this.state.replica, path, additions, nodes, this.now()))
      await this.syncNow('submission accepted')
      return true
    } catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)); return false }
  }
  /** Rows this device accepted from a submission its account still lists (not synced yet), by path. */
  private acceptedRows = new Map<string, { at: Scope; id: string }>()

  /** Can the current identity approve proposals on the node being viewed? */
  canApprove(node: NodeView | null = this.currentView()): boolean {
    const session = this.state.session
    if (this.virtualIdentity) return this.virtualCapabilities.includes('edit')
    if (!session) return true
    if (session.kind === 'user') return true
    const remote = this.state.replica.meta.serverPeerId && this.state.replica.meta.nodeSync?.[nodeSyncKey(this.state.replica.meta.serverPeerId, this.state.view, nodeBranches(this.state.replica, this.state.view))]?.remote
    return remote ? !!remote.grants?.includes('edit') : !!node?.members.some((m) => m.peerId === this.state.replica.meta.peerId && m.capabilities.includes('edit'))
  }

  async decideProposal(proposalId: string, decision: 'approve' | 'reject'): Promise<void> {
    if (this.virtualPeers?.guest) {
      if (!this.canApprove()) { this.notify('error', 'This role cannot approve proposals.'); return }
      try { await this.virtualPeers.decide(this.state.view, proposalId, decision); await this.syncNow('virtual decision') }
      catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)) }
      return
    }
    const session = this.state.session
    // the account's own organizer submitted it: accepting is this device's edit, not the server's
    const own = decision === 'approve' ? this.locallyAcceptable(this.state.view, proposalId) : null
    if (own) {
      if (await this.acceptSubmission([...this.state.view], proposalId, own.additions!)) { this.notify('info', 'Accepted: added here as one edit (undo takes it back).') }
      return
    }
    if (session) {
      try {
        const result = await decideProposal(session, this.currentScope(), proposalId, decision) as { merged?: boolean; missing?: string[] } | undefined
        this.notify('info', decision === 'reject' ? 'Proposal rejected.' : result?.merged === false ? `Approved. Waiting for approval by: ${(result.missing ?? []).join(', ')}.` : 'Proposal merged.')
        await this.syncNow('proposal decided')
      } catch (error) {
        this.notify('error', error instanceof Error ? error.message : String(error))
      }
      return
    }
    // No account: decide locally (e.g. a direct-connect host owning the node).
    const at = this.state.view
    if (decision === 'approve') this.acceptHere(at, proposalId)
    else this.edit(rejectProposalAt(this.state.replica, at, proposalId, this.now()))
  }
  /** Accept a submission held here: this device's approval, applied once the node's merge rule holds. */
  private acceptHere(at: Scope, proposalId: string, approver = this.state.replica.meta.peerId): void {
    try {
      const accepted = acceptSubmission(this.state.replica, at, proposalId, approver, this.now())
      this.edit(accepted.replica)
      if (!accepted.merged) this.notify('info', `Approved. Waiting for approval by: ${accepted.missing.join(', ')}.`)
    } catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)) }
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
    // a row accepted from a submission is on the account's main once a sync carried the accept (the submission closed)
    const accepted = this.acceptedRows.get(JSON.stringify(path))
    if (accepted && this.remoteProposalsAt(accepted.at).some(p => p.id === accepted.id)) return
    if (accepted) this.acceptedRows.delete(JSON.stringify(path))
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
  loadPeerNode(path: Scope, background = false): Promise<void> {
    const key = JSON.stringify(path), existing = this.nodeLoads.get(key)
    if (existing) return existing
    const pending = this.loadPeerNodeOnce(path, background).finally(() => this.nodeLoads.delete(key))
    this.nodeLoads.set(key, pending)
    return pending
  }
  private async loadPeerNodeOnce(path: Scope, background = false): Promise<void> {
    const replica = this.state.replica, cid = resolveScope(replica.store, headCid(replica), path)
    if (!cid || !isPeerReference(content(replica.store, cid))) return
    // a member entry is no projection of its own: it loads with its node's sync
    if (memberEntryPeerAt(replica.store, headCid(replica), path) !== null) { await this.syncNow('member entry'); return }
    const ref = content(replica.store, cid).data.ref!, session = this.state.session, generation = this.authGeneration
    const dataSession = this.activeDataSession()?.id, branch = this.currentBranch(), selection = JSON.stringify(this.branchSelections)
    // the peer that holds it is reached like any capability: its transport, found in scope
    let address = ref.scope ?? [...replica.meta.scope, ...path], provider = ref.peer ? this.transportTo(path, ref.peer) : null
    // a peer not reachable from here is reached through the peer that gave this device the node (its attachment's)
    if (!provider && this.state.policy.from.includes('read') && this.state.policy.from.includes('relay')) {
      const via = this.attachmentPeer()
      provider = via ? this.transportTo(path, via) : null
      address = [...replica.meta.scope, ...path]
    }
    const scope = provider?.attachment(address) ?? []
    if (!provider || !scope.every((id, i) => address[i] === id)) { this.notify('error', 'The peer that holds this node is unavailable or does not offer provideNode.'); return }
    const request: NodeRequest = { peerId: replica.meta.peerId, scope, path: address.slice(scope.length), ...(ref.branches ? { branches: ref.branches } : {}), linkId: nodeLinkEndpoint(replica, path, provider.id)?.id ?? nodeRequestLinkId(replica.meta.peerId, { peerId: provider.id, scope: address }) }
    try {
      const node = await pullNode(request, [provider])
      if (generation !== this.authGeneration || session !== this.state.session || this.state.replica.store !== replica.store || dataSession !== this.activeDataSession()?.id || branch !== this.currentBranch() || selection !== JSON.stringify(this.branchSelections) || this.state.replica.meta.peerId !== replica.meta.peerId || resolveScope(this.state.replica.store, headCid(this.state.replica), path) !== cid) return
      let next = rememberNodeSync(acceptProvidedNode(this.state.replica, path, request, node, this.now()), path, node)
      // a node opened from another store on this machine: edits below it go back there (`syncLocalStores`)
      const holder = provider.id
      if (this.config.localStores && localStores(next).some(s => s.peerId === holder) && !path.some(id => next.meta.heldNodes?.[id]))
        next = { ...next, meta: { ...next.meta, heldNodes: { ...next.meta.heldNodes, [path.at(-1)!]: { peer: holder, scope: address } } } }
      this.set({ replica: next }, !background)
    } catch (error) { this.notify('error', error instanceof Error ? error.message : String(error)) }
  }
  goTo(path: Scope): void {
    document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
    const home = homePath(this.state.replica), seen = new Set<string>()
    if (!path.length) path = home
    const requested = resolveScope(this.state.replica.store, headCid(this.state.replica), path)
    if (requested && isPeerReference(content(this.state.replica.store, requested))) {
      this.set({ view: path, selected: null, contextMenu: null, atRoot: false })
      this.rememberView()
      void this.loadPeerNode(path)
      return
    }
    while (path.length && seen.size < 64) {
      const row = view(this.state.replica, path.slice(0, -1), true)?.tasks.find(row => row.id === path.at(-1))
      if (!row?.refId || row.refOwner || seen.has(row.refId)) break
      seen.add(row.refId)
      const target = resolveRef(this.state.replica, row.refId, path.slice(0, -1))
      if (!target) break
      path = [...target.path, target.row.id]
    }
    this.set({ view: view(this.state.replica, path) ? path : home, selected: null, contextMenu: null, atRoot: false })
    this.rememberView()
  }
  /** The Home descendant this device last viewed, kept as a setting row inside Home so every visit resumes there. */
  savedHomeView(replica: Replica): Scope {
    const home = homePath(replica)
    if (!home.length) return home
    const saved = readNodeValue<unknown>(replica, home, 'view', replica.meta.peerId)
    const path = Array.isArray(saved) && saved.every((id): id is string => typeof id === 'string') ? [...home, ...saved] : null
    return path && path.length > home.length && view(replica, path) ? path : home
  }
  private rememberView(): void {
    const { view: current, replica, atRoot } = this.state
    const home = homePath(replica)
    if (atRoot || !home.length || current[0] !== home[0] || current.length < 2) return
    const relative = current.slice(1), peer = replica.meta.peerId
    if (JSON.stringify(readNodeValue(replica, home, 'view', peer)) === JSON.stringify(relative)) return
    // Navigation is not an edit: no undo entry, but the row syncs like any other.
    this.set({ replica: writeNodeValue(replica, home, 'view', relative, this.now(), { peer }) })
    this.scheduleSync()
  }

  /** Zoom out within Home; device settings are reached through the menu. */
  zoomOut(): void { if (this.state.view.length > homePath(this.state.replica).length) this.goTo(this.state.view.slice(0, -1)) }
  goToAccountPeer(): void {
    this.goToRoot()
    const row = view(this.state.replica, [], true)?.tasks.find(row => row.construction?.peerId === 'fos')
    if (row) this.goTo([row.id])
    else this.notify('error', 'The Fos peer is unavailable in this context.')
  }
  /** Whether the row at `path` is a store root's Home (by its type). */
  isHome(path: Scope): boolean {
    return !!path.length && view(this.state.replica, path.slice(0, -1))?.tasks.find(row => row.id === path.at(-1))?.type === HOME_TYPE
  }
  /** Whether the row at `path` is a library ref (the device root's, or one referenced here once its content is here). */
  isLibrary(path: Scope): boolean {
    const cid = path.length ? resolveScope(this.state.replica.store, headCid(this.state.replica), path) : null
    return !!cid && isLibraryRef(this.state.replica.store, content(this.state.replica.store, cid))
  }
  goToRoot(): void { document.activeElement?.dispatchEvent(new window.Event('commit-edit')); this.ensureSettings(); this.set({ atRoot: true, view: [], selected: null, collapsed: [...new Set([...this.state.collapsed, HOME_ID])], contextMenu: null }) }
  /** Browser back/forward: return to the node, Settings or execution view a history entry recorded. */
  restoreNavigation(target: { view?: unknown; atRoot?: unknown; execution?: unknown }): void {
    document.activeElement?.dispatchEvent(new window.Event('commit-edit'))
    const path = Array.isArray(target.view) && target.view.every((id): id is string => typeof id === 'string') ? target.view : null
    const execution = Array.isArray(target.execution) && target.execution.every((id): id is string => typeof id === 'string') ? target.execution : null
    if (this.executionPath() && !execution) this.execution = null
    if (target.atRoot === true) { this.goToRoot(); return }
    if (!path || !view(this.state.replica, path)) { this.goTo([]); return }
    this.set({ view: path, selected: null, contextMenu: null, atRoot: false })
    this.rememberView()
    if (execution && JSON.stringify(execution) === JSON.stringify(path)) void this.startExecution(path)
  }
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

  /** This device's setting `key`: a value it holds on the device root under that name. */
  settingValue<T>(key: string): T | null { return readNodeValue<T>(this.state.replica, [], key, this.state.replica.meta.peerId) }
  setSetting(key: string, value: unknown): void { this.edit(writeNodeValue(this.state.replica, [], key, value, this.now(), { peer: this.state.replica.meta.peerId })) }
  ensureSettings(): void {
    let r = this.state.replica
    const defaults: Record<string, unknown> = { history: { handler: 'history' }, name: this.state.deviceName, theme: document.documentElement.dataset.theme || 'system', microphone: 'Not checked', camera: 'Not checked', geolocation: 'Not checked', server: { handler: 'connect' }, direct: { handler: 'direct' }, invite: { handler: 'invite' }, virtual: { handler: 'virtual' }, phone: { handler: 'phone' }, share: { handler: 'share' }, resetHome: { handler: 'reset-home' }, resetAccount: { handler: 'reset-account' }, sessions: { handler: 'sessions' }, export: { handler: 'export-yaml' }, import: { handler: 'import-yaml' } }
    // the defaults this device already made (a device preference): a setting row it deleted is not made again
    const installed = this.installedSettings, peer = r.meta.peerId
    for (const [key, value] of Object.entries(defaults)) {
      if (installed.includes(key) || readNodeValue(r, [], key, peer) !== null) continue
      const type = libAt(r.store).capabilities[['server', 'direct', 'invite', 'virtual', 'phone', 'share'].includes(key) ? 'peer' : 'tool']!
      r = writeNodeValue(r, [], key, value, this.now(), typeof value === 'object' ? { type, peer } : { peer })
    }
    if (Object.keys(defaults).some(key => !installed.includes(key))) { this.installedSettings = [...new Set([...installed, ...Object.keys(defaults)])]; this.savePrefs() }
    const declared = this.peerConstructorId()
    if (!resolveScope(r.store, headCid(r), [declared])) r = this.peerRowReplica(addRow(r, [], PLAIN_TYPE, '', this.now(), { id: declared }), [declared], 'peer')
    if (r !== this.state.replica) { this.set({ replica: r }); this.scheduleSync() }
  }
  exportYaml(): string { return exportNodeYaml(this.state.replica, this.state.view) }
  importText(text: string, format: string, at: Scope): void {
    if (!view(this.state.replica, at)) throw new Error('The import destination was removed.')
    if (format === 'yaml' && /^\s*["']?v\d+-[a-f0-9]+["']?:/i.test(text)) { this.importYaml(text, at); return }
    const rows = parsePastedRows(format === 'yaml' ? '```yaml\n' + text + '\n```' : text)
    this.together(() => {
      const append = (parent: Scope, rows: import('./rows').ParsedInput[]) => {
        for (const row of rows) {
          const id = newId(); this.edit(addRow(this.state.replica, parent, row.type, row.text, this.now(), { id, done: row.done, ...row.extras }))
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
    commitRoot(r.store, updateAtScope(r.store, headCid(r), destination, value => ({ ...value, children: [...value.children, rowEdgeAt(r.store, PLAIN_TYPE, node, destination)] })), this.now())
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
    const target = replica.meta.localScope?.length && !scope.length ? homePath(replica) : scope
    const same = attached.length === target.length && attached.every((s, i) => target[i] === s)
    return (connection === 'online' || connection === 'syncing') && !isDirty(replica) && hasSynced(replica) && !same
  }

  attachAt(scope: Scope): void {
    if (!this.canAttach(scope)) {
      this.notify('error', 'Sync first: this device can only move while online with no unsynced changes.')
      return
    }
    try {
      const next = reattach(this.state.replica, scope)
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
      this.notify('info', decision === 'approve' ? 'Device approved. It will attach on its next check.' : 'Request denied.')
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

  // Virtual browser peers sync by node exchange, as normal peers do.
  enableVirtualPeers(guest: VirtualPeer | null): void {
    this.virtualIdentity = guest
    if (!('BroadcastChannel' in window)) return
    try {
      this.virtualPeers = new VirtualPeers(guest, {
        provide: (peer, request) => {
          const served = exchangeNode(this.state.replica, request, { peerId: peer.id, scope: peer.scope, proposeOnly: !this.virtualGrants(peer)?.includes('autopush'), capabilities: this.deviceCapabilities() }, this.now())
          this.set({ replica: served.replica })
          if (request.update) this.scheduleSync()
          return served.node
        },
        presence: () => this.set({}),
        dataSessionId: () => this.activeDataSession()?.id,
        decide: async (peer, scope, proposalId, decision) => {
          if (!this.virtualGrants(peer)?.includes('edit') || !Array.isArray(scope) || scope.some((id) => typeof id !== 'string') || !['approve', 'reject'].includes(decision)) throw new Error('This role cannot decide this proposal.')
          const at = [...peer.scope, ...scope]
          if (!withBranches(this.state.replica.store, peer.branches ?? {}, () => view(this.state.replica, at)?.proposals.some((p) => p.id === proposalId && p.status === 'open'))) throw new Error('Proposal no longer available.')
          if (this.virtualPeers?.guest) { await this.virtualPeers.decide(at, proposalId, decision); await this.syncNow('nested virtual decision'); return }
          this.edit(withBranches(this.state.replica.store, peer.branches ?? {}, () => decision === 'approve' ? acceptSubmission(this.state.replica, at, proposalId, peer.id, this.now()).replica : rejectProposalAt(this.state.replica, at, proposalId, this.now())))
        },
        grants: (peer) => this.virtualGrants(peer),
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
  spawnVirtualPeer(name: string, role: 'editor' | 'proposer' | 'viewer', shareAccount: boolean): void {
    if (!this.canSpawnVirtualPeer() || !name.trim()) return
    const token = crypto.randomUUID()
    const peer: VirtualPeer = { id: crypto.randomUUID(), token, hostTab: this.virtualPeers!.hostTab, scope: [...this.peerContextPath()], branches: scopeBranches(this.state.replica.store, headCid(this.state.replica), this.peerContextPath()), dataSessionId: this.activeDataSession()?.id, name: name.trim().slice(0, 80), shareAccount }
    const capabilities: Capability[] = role === 'viewer' ? ['read'] : role === 'proposer' ? ['read', 'edit'] : ['read', 'edit', 'autopush']
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
      opened.send({ t: 'hello', peerId: this.state.replica.meta.peerId, name: this.state.deviceName, capabilities: this.deviceCapabilities(), scope: [] })
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
        const served = exchangeNode(this.state.replica, message.request, { peerId: this.approvedNodePeer, scope: role === 'host' ? this.hostScope : [], capabilities: this.deviceCapabilities() }, this.now())
        this.set({ replica: served.replica })
        if (message.request.update) this.scheduleSync()
        link.send({ t: 'node-result', id: message.id, node: served.node })
      } catch (error) { link.send({ t: 'node-result', id: message.id, error: error instanceof Error ? error.message : String(error) }) }
      return
    }
    if (role === 'host') {
      if (message.t === 'hello') {
        this.set({ direct: { role: 'host', phase: 'connected', remoteName: message.name, pendingPeer: { peerId: message.peerId, name: message.name } } })
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
        replica: { store: replica.store, meta: { ...replica.meta, scope: [], localScope: undefined, scopeNames: [`${message.name}`], serverPeerId: message.peerId } },
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
      this.link.send({ t: 'welcome', peerId: this.state.replica.meta.peerId, name: this.state.deviceName, capabilities: this.deviceCapabilities(), scope: this.hostScope })
      this.set({ direct: { role: 'host', phase: 'connected', remoteName: d.pendingPeer.name }, modal: null })
      this.notify('info', `${d.pendingPeer.name} is now syncing with this device.`)
    } else {
      this.link.send({ t: 'denied' })
      this.link.close()
      this.set({ direct: null })
    }
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

  /**
   * Guest side: one node request per node this device syncs with the other one, local edits included as updates
   * (based on what the other device last accepted), so a single round trip by hand carries both directions.
   */
  manualMakeRequest(): void {
    const r = this.state.replica, localRoot = r.meta.localScope ?? []
    this.manualPlans = materializedNodePaths(r, localRoot, this.manualPeer).map(path => planNodeSync(r, path, { peer: this.manualPeer, scope: [], remoteRoot: [], localRoot, branches: [], push: true }))
    const requests = this.manualPlans.map(plan => plan.dirty ? { ...plan.request, update: { base: plan.previousRemote ?? { data: {}, children: [] }, value: plan.local } } : plan.request)
    this.set({ manual: { requestCode: ManualRelay.encodeRequest(requests) } })
  }

  /** Host side: answer each node request as this device provides its nodes (the other device is trusted, as when paired). */
  manualServe(code: string): void {
    try {
      const requests = ManualRelay.decodeRequest(code)
      let replica = this.state.replica
      const results = requests.map(request => {
        try {
          const served = exchangeNode(replica, request, { peerId: request.peerId, scope: this.hostScope, owner: true, capabilities: this.deviceCapabilities() }, this.now())
          replica = served.replica
          return { node: served.node }
        } catch (error) { return { error: error instanceof Error ? error.message : String(error) } }
      })
      if (replica !== this.state.replica) { this.edit(replica); this.scheduleSync() }
      this.set({ manual: { resultCode: ManualRelay.encodeResult(results) } })
    } catch (error) {
      this.set({ manual: { error: error instanceof Error ? error.message : String(error) } })
    }
  }

  /** Guest side: install what the other device answered, node by node. */
  manualApplyResult(code: string): void {
    if (!this.manualPlans.length) { this.set({ manual: { error: 'Create a request code first.' } }); return }
    try {
      const results = ManualRelay.decodeResult(code)
      let replica = this.state.replica
      this.manualPlans.forEach((plan, i) => {
        const node = results[i]?.node
        if (!node) throw new Error(results[i]?.error ?? 'The other device did not answer every node.')
        replica = finishNodeSync(nodeSyncPush(replica, plan, node, this.now()).replica, plan, node, this.now())
        this.manualPeer = node.peerId
      })
      this.manualPlans = []
      this.set({ replica, manual: {}, modal: null })
      this.notify('info', 'Synced with the other device.')
    } catch (error) {
      this.set({ manual: { ...this.state.manual, error: error instanceof Error ? error.message : String(error) } })
    }
  }

  webRtcAvailable(): boolean {
    return isWebRtcAvailable()
  }
}
