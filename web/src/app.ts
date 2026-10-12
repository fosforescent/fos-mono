/**
 * Application controller: owns the replica (a FosStore attached to the user
 * group's document or to another device's node), the connection state, the
 * sync schedule and the UI flows (connect, invite, direct). The UI only reads
 * `state`, calls `currentView()` and invokes the methods below.
 *
 * Startup
 *   stored session (token, never a password) → reconnect, ask the account where
 *   this device attaches, sync. Otherwise: local mode, red "local" badge and a
 *   dismissable Connect modal (sign in / invite token or QR / direct).
 *
 * Transports for sync, in order of preference
 *   account over HTTP (user session or peer credential from an invite)
 *   another device over a WebRTC data channel (direct connect)
 *   manual relay codes (when no channel could be established)
 */

import {
  addRef,
  addRow,
  addTask,
  copyNode,
  resolveRef,
  setRowKind,
  applyProposalAt,
  buildSyncRequest,
  completeSync,
  deleteTask,
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
  serveSync,
  setTaskDone,
  view,
  type Capability,
  type MovePosition,
  type NodeView,
  type Replica,
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
  login,
  peerSync,
  pollConnect,
  type InviteRequest,
  type Session,
  describeDeviceLogin,
  decideDeviceLogin,
  transcribeVoice,
  type VoiceNote
} from './api'
import { DirectGuest, DirectHost, DirectLink, ManualRelay, isWebRtcAvailable, type ChannelMessage } from './p2p'
import type { ReplicaStorage } from './storage'

export type Connection = 'offline' | 'connecting' | 'online' | 'syncing'

export type Notice = { kind: 'info' | 'error'; text: string; at: number }

export type Credentials = { username: string; password: string }

export type ModalKind = 'connect' | 'invite' | 'direct' | 'requests' | 'device'

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
  modal: ModalKind | null
  connectFlow: ConnectFlow
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
  /** Keyboard selection: path (relative to the view) of the selected task. */
  selected: Scope | null
  /** Open context menu, if any. */
  contextMenu: { kind: 'task'; at: Scope; task: TaskView } | { kind: 'peer'; peerId: string } | null
  /** A `fos` CLI waiting for this browser to approve its sign-in (from ?device=CODE). */
  device: { code: string; name: string | null; status: 'loading' | 'ready' | 'approved' | 'denied' | 'error'; error?: string } | null
  /** Microphone capture: recording (with start time), uploading, or idle. */
  voice: { phase: 'recording'; startedAt: number } | { phase: 'uploading' } | null
}

export type AppConfig = {
  baseUrl: string
  autoLogin: Credentials | null
  storage: ReplicaStorage
  pollIntervalMs?: number
  now?: () => number
  /** Project mode (desktop shell in a directory with fos.config.toml). */
  project?: { dir: string; branch: () => string | null; deviceName?: string }
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
  if (typeof s.jwt !== 'string' || typeof s.username !== 'string' || !s.jwt) return null
  return { baseUrl, jwt: s.jwt, username: s.username, kind: s.kind === 'peer' ? 'peer' : 'user' }
}

export class App {
  state: AppState
  private config: AppConfig
  private listeners = new Set<(state: AppState) => void>()
  private syncInFlight = false
  private syncRequested = false
  private debounceTimer: Timer | null = null
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
  private manualRequest: SyncRequest | null = null

  constructor(config: AppConfig) {
    this.config = config
    this.autoCredentials = config.autoLogin
    const replica = loadReplica(config.storage.loadReplica())
    const prefs = (config.storage.loadPrefs() ?? {}) as { view?: unknown; connectDismissed?: unknown; deviceName?: unknown; collapsed?: unknown }
    const savedView = Array.isArray(prefs.view) ? prefs.view.filter((s): s is string => typeof s === 'string') : []
    const session = loadSession(config.storage.loadSession(), config.baseUrl)
    this.state = {
      replica,
      view: view(replica, savedView) ? savedView : [],
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
      collapsed: Array.isArray(prefs.collapsed) ? prefs.collapsed.filter((s): s is string => typeof s === 'string') : [],
      onlinePeers: [],
      selected: null,
      contextMenu: null,
      device: null,
      voice: null
    }
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
    this.state = { ...previous, ...patch }
    if (patch.replica && patch.replica !== previous.replica) {
      this.config.storage.saveReplica(serializeReplica(this.state.replica))
    }
    if (patch.view && patch.view !== previous.view) this.savePrefs()
    if ('session' in patch && patch.session !== previous.session) {
      this.config.storage.saveSession(patch.session ? { jwt: patch.session.jwt, username: patch.session.username, kind: patch.session.kind } : null)
    }
    for (const listener of this.listeners) listener(this.state)
  }

  private savePrefs(): void {
    this.config.storage.savePrefs({ view: this.state.view, connectDismissed: this.connectDismissed, deviceName: this.state.deviceName, collapsed: this.state.collapsed })
  }

  private notify(kind: Notice['kind'], text: string): void {
    this.set({ notice: { kind, text, at: this.now() } })
  }

  // -------------------------------------------------------------------------
  // Derived views for the UI

  currentView(): NodeView | null {
    return view(this.state.replica, this.state.view)
  }

  labels(): { scope: string[]; view: string[] } {
    const { replica, view: path } = this.state
    return { scope: replica.meta.scopeNames, view: scopeNames(replica.store, headCid(replica), path) }
  }

  currentScope(): Scope {
    return [...this.state.replica.meta.scope, ...this.state.view]
  }

  /** Git branch of the project directory, when running in project mode. */
  currentBranch(): string | null {
    return this.config.project?.branch() ?? null
  }

  /** Project mode: the directory switched git branch; show that branch's replica. */
  reloadReplica(): void {
    const replica = loadReplica(this.config.storage.loadReplica())
    this.set({ replica, view: [], selected: null, contextMenu: null })
    this.notify('info', `Now on branch ${this.currentBranch() ?? 'local'}.`)
    if (this.transport()) void this.syncNow('branch switch')
  }

  /** What this device is currently syncing with, if anything. */
  transport(): 'account' | 'direct' | null {
    if (this.state.session) return 'account'
    if (this.link?.open && this.state.direct?.role === 'guest' && this.state.direct.phase === 'connected') return 'direct'
    return null
  }

  isLocal(): boolean {
    return this.transport() === null
  }

  // -------------------------------------------------------------------------
  // Lifecycle

  start(): void {
    window.addEventListener('online', () => this.reconnect('network back'))
    window.addEventListener('offline', () => {
      if (this.state.connection !== 'offline') this.set({ connection: 'offline' })
    })
    if (this.pendingSession) {
      void this.resume(this.pendingSession)
      this.pendingSession = null
    } else if (this.autoCredentials) {
      void this.login(this.autoCredentials.username, this.autoCredentials.password, true)
    } else if (!this.connectDismissed) {
      this.set({ modal: 'connect' })
    }
  }

  /** Reconnect with a session stored by a previous run. */
  private async resume(session: Session): Promise<void> {
    this.set({ connection: 'connecting' })
    try {
      await this.afterConnect(session)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.set({ session: null, connection: 'offline', loginError: 'Your session expired. Sign in again to sync.', modal: this.connectDismissed ? null : 'connect' })
      } else {
        // Server unreachable: keep the session and retry; the replica keeps working locally.
        this.set({ session, connection: 'offline' })
        this.notify('error', `Could not reach the server: ${error instanceof Error ? error.message : String(error)}`)
        this.scheduleRetry()
      }
    }
  }

  async login(username: string, password: string, automatic = false): Promise<void> {
    this.clearTimer('retry')
    this.set({ connection: 'connecting', loginError: null })
    try {
      const session = await login(this.config.baseUrl, username.trim(), password)
      if (!automatic) this.autoCredentials = null
      this.retryDelay = MIN_RETRY_MS
      await this.afterConnect(session)
      this.set({ modal: null, connectFlow: { phase: 'idle' } })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.set({ connection: 'offline', loginError: message, session: null })
      if (automatic) this.scheduleRetry()
    }
  }

  /**
   * Common path after obtaining a session: ask the account where this device
   * attaches (root by default, or the node it was invited to), then sync.
   */
  private async afterConnect(session: Session): Promise<void> {
    const attachment = await getAttachment(session, this.state.replica.meta.peerId)
    let replica = this.state.replica
    const same = replica.meta.scope.length === attachment.scope.length && replica.meta.scope.every((s, i) => attachment.scope[i] === s)
    if (!same && (!hasSynced(replica) || session.kind === 'peer')) {
      // A fresh link at the assigned node: local work merges into it on the first sync.
      replica = { store: replica.store, meta: { ...replica.meta, scope: attachment.scope, scopeNames: attachment.scopeNames, baseCid: null } }
    } else if (same && replica.meta.scopeNames.length !== attachment.scopeNames.length) {
      replica = { store: replica.store, meta: { ...replica.meta, scopeNames: attachment.scopeNames } }
    }
    this.set({ session, replica, connection: 'online', loginError: null, view: [] })
    this.openEvents()
    this.startPolling()
    if (session.kind === 'user') void this.refreshRequests()
    if (session.kind === 'user' && this.state.device && this.state.device.status === 'loading') void this.loadDevice()
    await this.syncNow('connect')
  }

  logout(): void {
    this.autoCredentials = null
    this.clearTimer('retry')
    this.clearTimer('poll')
    this.closeEvents?.()
    this.closeEvents = null
    this.set({ session: null, connection: 'offline', loginError: null, canAutoLogin: false, requests: [], invite: null, menuOpen: false })
  }

  reconnect(reason: string): void {
    this.clearTimer('retry')
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
    this.closeEvents = connectEvents(session, this.state.replica.meta.peerId, {
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

  async syncNow(_reason: string): Promise<void> {
    const transport = this.transport()
    if (!transport) return
    if (this.syncInFlight) { this.syncRequested = true; return }
    this.syncInFlight = true
    this.clearTimer('debounce')
    this.set({ connection: 'syncing' })

    const request: SyncRequest = buildSyncRequest(this.state.replica, this.currentBranch() ?? undefined)
    try {
      const response = transport === 'account'
        ? await peerSync(this.state.session as Session, request)
        : await (this.link as DirectLink).sync(request)
      const done = completeSync(this.state.replica, request, response, this.now())
      const patch: Partial<AppState> = { replica: done.replica, connection: 'online' }
      if (response.presence) patch.onlinePeers = response.presence
      const n = done.newChoiceIds.length
      if (n > 0) {
        patch.highlighted = done.newChoiceIds
        patch.notice = { kind: 'info', text: `Merged. ${n} conflict${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} your decision.`, at: this.now() }
      } else if (response.action === 'merge') {
        patch.notice = { kind: 'info', text: transport === 'account' ? 'Merged changes from your account.' : 'Merged changes from the other device.', at: this.now() }
      }
      this.set(patch)
      this.retryDelay = MIN_RETRY_MS
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.closeEvents?.()
        this.closeEvents = null
        this.clearTimer('poll')
        this.set({ session: null, connection: 'offline', loginError: 'Your session expired. Sign in again to sync.', modal: 'connect' })
      } else if (error instanceof ApiError && error.status === 409) {
        this.clearTimer('poll')
        this.set({ connection: 'offline', loginError: `This app cannot sync with the server: ${error.message}. Please update the app.` })
      } else if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
        this.set({ connection: 'online' })
        this.notify('error', `The account refused this device's node: ${error.message}`)
      } else {
        const message = error instanceof Error ? error.message : String(error)
        this.set({ connection: 'offline' })
        this.notify('error', `Sync failed: ${message}. Changes are saved on this device.`)
        this.scheduleRetry()
      }
    } finally {
      this.syncInFlight = false
      if (this.syncRequested) { this.syncRequested = false; void this.syncNow('queued') }
    }
  }

  // -------------------------------------------------------------------------
  // Local edits (always allowed)

  private edit(next: Replica): void {
    if (next === this.state.replica) return
    this.set({ replica: next })
    this.scheduleSync()
    if (this.link?.open && this.state.direct?.role === 'host') {
      try { this.link.send({ t: 'changed' }) } catch { /* ignore */ }
    }
  }

  addTask(title: string): void { this.edit(addTask(this.state.replica, this.state.view, title, this.now())) }

  /** Add a row of `kind` under `at` (relative to the view). Comments carry this device as the author. */
  addRowAt(at: Scope, kind: RowKind, text: string, options: { done?: boolean; refId?: string; position?: MovePosition } = {}): void {
    const author = kind === 'comment' ? { id: this.state.replica.meta.peerId, name: this.state.session?.username ?? this.state.deviceName } : undefined
    this.edit(addRow(this.state.replica, [...this.state.view, ...at], kind, text, this.now(), { ...options, author }))
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
    return !!this.state.session && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  }

  async toggleVoice(): Promise<void> {
    if (this.state.voice?.phase === 'recording') { this.recorder?.stop(); return }
    if (this.state.voice) return
    if (!this.state.session) { this.notify('error', 'Connect to your account to transcribe voice notes.'); this.openModal('connect'); return }
    if (!this.canRecordVoice()) { this.notify('error', 'This browser cannot record audio.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m))
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      this.recorded = []
      recorder.addEventListener('dataavailable', (e) => { if (e.data.size) this.recorded.push(e.data) })
      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(this.recorded, { type: recorder.mimeType || 'audio/webm' })
        this.recorder = null
        void this.submitVoice(blob)
      })
      recorder.start(1000)
      this.recorder = recorder
      this.set({ voice: { phase: 'recording', startedAt: this.now() } })
    } catch (error) {
      this.notify('error', `Microphone unavailable: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async submitVoice(blob: Blob): Promise<void> {
    const session = this.state.session
    if (!session || blob.size < 1000) { this.set({ voice: null }); if (blob.size < 1000) this.notify('error', 'The recording was empty.'); return }
    this.set({ voice: { phase: 'uploading' } })
    try {
      const note = await transcribeVoice(session, blob)
      this.insertVoiceNote(note)
      this.notify('info', `Voice note added: ${note.clusters.length} cluster${note.clusters.length === 1 ? '' : 's'}.`)
    } catch (error) {
      this.notify('error', error instanceof Error ? error.message : String(error))
    } finally {
      this.set({ voice: null })
    }
  }

  /** Note blocks from a transcription: one parent note (summary) with a note per cluster and its points as rows, plus the transcript. */
  insertVoiceNote(note: VoiceNote): void {
    const at = this.state.view
    const stamp = new Date(this.now()).toLocaleString()
    const parentId = crypto.randomUUID()
    let replica = addRow(this.state.replica, at, 'note', `# ${note.title || 'Voice note'}\n\n_${stamp}_\n\n${note.summary}`, this.now(), { id: parentId })
    for (const cluster of note.clusters) {
      const clusterId = crypto.randomUUID()
      replica = addRow(replica, [...at, parentId], 'note', `## ${cluster.title}\n\n**${cluster.sentiment}** — ${cluster.summary}`, this.now(), { id: clusterId })
      for (const point of cluster.points) replica = addRow(replica, [...at, parentId, clusterId], 'plain', point, this.now())
    }
    replica = addRow(replica, [...at, parentId], 'note', `## Transcript\n\n${note.transcript}`, this.now())
    this.edit(replica)
  }

  /** Where a reference points, relative to the replica root (null when the target is gone). */
  refTarget(refId: string): { path: Scope; row: TaskView } | null {
    return resolveRef(this.state.replica, refId)
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
    this.edit(renameTask(this.state.replica, [...this.state.view, ...at], taskId, title, this.now()))
  }
  deleteTaskAt(at: Scope, taskId: string): void {
    this.edit(deleteTask(this.state.replica, [...this.state.view, ...at], taskId, this.now()))
  }
  resolveChoiceAt(at: Scope, choiceId: string, pick: number | null): void {
    this.edit(resolve(this.state.replica, [...this.state.view, ...at], choiceId, pick, this.now()))
    this.set({ highlighted: this.state.highlighted.filter((id) => id !== choiceId) })
  }

  /** Drag and drop / indent: move the task `id` from `fromAt` to `toAt` (both relative to the view). */
  moveTask(fromAt: Scope, id: string, toAt: Scope, position: MovePosition): void {
    const base = this.state.view
    this.edit(moveNode(this.state.replica, [...base, ...fromAt], id, [...base, ...toAt], position, this.now()))
  }

  toggleCollapsed(id: string): void {
    const collapsed = this.state.collapsed.includes(id) ? this.state.collapsed.filter((c) => c !== id) : [...this.state.collapsed, id]
    this.set({ collapsed })
    this.savePrefs()
  }

  /** Can the current identity approve proposals on the node being viewed? */
  canApprove(node: NodeView | null = this.currentView()): boolean {
    const session = this.state.session
    if (!session) return false
    if (session.kind === 'user') return true
    return !!node?.members.some((m) => m.peerId === this.state.replica.meta.peerId && m.capabilities.includes('approve'))
  }

  async decideProposal(proposalId: string, decision: 'approve' | 'reject'): Promise<void> {
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
  goTo(path: Scope): void { this.set({ view: view(this.state.replica, path) ? path : [], selected: null, contextMenu: null }) }
  zoomOut(): void { if (this.state.view.length) this.goTo(this.state.view.slice(0, -1)) }
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
    if (peerId === this.state.replica.meta.peerId) return this.transport() !== null
    return this.state.onlinePeers.includes(peerId)
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

  setDeviceName(name: string): void {
    const clean = name.trim().slice(0, 80)
    if (!clean) return
    this.set({ deviceName: clean })
    this.savePrefs()
  }

  canAttach(scope: Scope): boolean {
    const { replica, connection, session } = this.state
    if (session?.kind === 'peer') return false // a peer credential is fixed to its node
    const same = replica.meta.scope.length === scope.length && replica.meta.scope.every((s, i) => scope[i] === s)
    return (connection === 'online' || connection === 'syncing') && !isDirty(replica) && replica.meta.baseCid !== null && !same
  }

  attachAt(scope: Scope): void {
    if (!this.canAttach(scope)) {
      this.notify('error', 'Sync first: this device can only move while online with no unsynced changes.')
      return
    }
    try {
      const next = reattach(this.state.replica, scope, this.now(), scope.length === 0 ? [] : undefined)
      this.set({ replica: next, view: [], menuOpen: false })
      this.notify('info', scope.length === 0 ? 'This device now syncs the whole account.' : 'This device now syncs only this node.')
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
    const scope = this.currentScope()
    const names = [...this.labels().scope, ...this.labels().view]
    // The invited node becomes a link node: it keeps its history and collects members and proposals.
    this.edit(makeLinkAt(this.state.replica, this.state.view, this.now()))
    this.set({ modal: 'invite', menuOpen: false, invite: null })
    try {
      const created = await createInvite(session, scope, names)
      this.set({ invite: { token: created.token, scope, scopeNames: names, expiresAt: created.expiresAt } })
    } catch (error) {
      this.notify('error', `Could not create an invite: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async refreshRequests(): Promise<void> {
    const session = this.state.session
    if (!session || session.kind !== 'user') return
    try {
      const { requests } = await listInviteRequests(session)
      this.set({ requests })
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

  // -------------------------------------------------------------------------
  // Direct connection (another device, no account needed)

  async startDirectHost(): Promise<void> {
    this.cancelDirect()
    this.hostScope = [...this.state.view]
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
      opened.send({ t: 'hello', peerId: this.state.replica.meta.peerId, name: this.state.deviceName })
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
    link.onMessage = (message) => this.onLinkMessage(message, role)
  }

  private onLinkMessage(message: ChannelMessage, role: 'host' | 'guest'): void {
    if (role === 'host') {
      if (message.t === 'hello') {
        this.set({ direct: { role: 'host', phase: 'connected', remoteName: message.name, pendingPeer: { peerId: message.peerId, name: message.name } } })
      } else if (message.t === 'sync') {
        this.serveDirect(message.id, message.request)
      }
      return
    }
    if (message.t === 'welcome') {
      // Attached to the host's node: a fresh link at scope [] relative to that node.
      const replica = this.state.replica
      this.set({
        direct: { role: 'guest', phase: 'connected', remoteName: message.name },
        replica: { store: replica.store, meta: { ...replica.meta, scope: [], scopeNames: [`${message.name}`], baseCid: null, serverPeerId: message.peerId } },
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
      this.link.send({ t: 'welcome', peerId: this.state.replica.meta.peerId, name: this.state.deviceName })
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

  private serveRequest(request: SyncRequest) {
    const scoped: SyncRequest = { ...request, scope: [...this.hostScope, ...request.scope] }
    const served = serveSync(this.state.replica.store, scoped, this.state.replica.meta.peerId, this.now())
    if (!('error' in served) && served.changed) {
      this.set({ replica: { ...this.state.replica } })
      this.scheduleSync() // pass the guest's changes on to the account if we have one
    }
    return served
  }

  cancelDirect(): void {
    this.host?.cancel()
    this.host = null
    if (this.link) { const l = this.link; this.link = null; l.close() }
    if (this.state.direct) this.set({ direct: null })
  }

  // -------------------------------------------------------------------------
  // Manual relay (fallback when no channel could be opened)

  manualMakeRequest(): void {
    this.manualRequest = buildSyncRequest(this.state.replica)
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
