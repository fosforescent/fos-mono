/** MCP is a view of an existing peer attachment, not another task store. */
import type { Request, Response } from 'express'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import {
  addRow, branchSelection, commitRoot, content, contextScope, createBranch, createReplica,
  findChild, hasCapability, headCid, importNodes, isBranchChoice, makeLink,
  proposalContent, put, reachableNodes, readChoice, readMembers, readProposals, refBranches,
  renameTask, resolveScope, rootTargetCid, selectedBranchValue, setTaskDone,
  updateAtScope, valueContent, viewNode, withBranches, withProposal, type Scope,
} from '@fosforescent/shared/sync/index'
import { withUserLock, type PeerSyncDeps } from '../sync/peerSync'
import { MCPServerInstance } from './mcpServer'

const pathSchema = { type: 'array', items: { type: 'string', minLength: 1, maxLength: 128 }, maxItems: 32 }
const common = {
  path: { ...pathSchema, description: 'Stable child IDs relative to the attachment. [] is its root; never titles or filesystem paths.' },
  branches: { type: 'array', maxItems: 32, items: { type: 'object', properties: { path: pathSchema, name: { type: 'string' } }, required: ['path', 'name'], additionalProperties: false }, description: 'Branch selections, outermost first. Paths are relative to the attachment.' },
}
const tool = (name: string, description: string, properties: Record<string, unknown>, required: string[], readOnlyHint = true) => ({
  name, description, inputSchema: { type: 'object' as const, properties: { ...common, ...properties }, required, additionalProperties: false },
  annotations: { readOnlyHint, destructiveHint: !readOnlyHint, idempotentHint: readOnlyHint, openWorldHint: name === 'fos_evaluate' },
})
const tools = [
  tool('fos_read', 'Read a task, its instructions, immediate children, branch choices and available actions. Start at []. Read ancestors within the attachment for context. Paginate children with offset.', { offset: { type: 'integer', minimum: 0 } }, []),
  tool('fos_search', 'Search task text inside the attachment (bounded depth-first scan, active branches only). Returns paths for fos_read.', { query: { type: 'string', minLength: 1, maxLength: 200 }, offset: { type: 'integer', minimum: 0, maximum: 5000 } }, ['query']),
  tool('fos_propose', 'Submit ordinary Fos proposal children for owner review. Does not merge or execute effects. Read [] first; expected must equal its revision. A fresh proposal name is required; batch related edits.', {
    expected: { type: 'string' }, name: { type: 'string', minLength: 1, maxLength: 100 },
    changes: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'object', properties: { path: pathSchema, operation: { enum: ['add_task', 'add_note', 'rename', 'complete'] }, text: { type: 'string', maxLength: 16000 }, done: { type: 'boolean' } }, required: ['path', 'operation'], additionalProperties: false } },
  }, ['expected', 'name', 'changes'], false),
]
const ownerTools = [
  tool('fos_create_branch', 'Create a content-addressed alternative at a node. Account owner only. expected is the revision from fos_read([]). Does not change other clients’ selection.', { expected: { type: 'string' }, name: { type: 'string', minLength: 1, maxLength: 200 } }, ['path', 'expected', 'name'], false),
  tool('fos_evaluate', 'Run the existing transaction evaluator, including checks, effect journal and recovery. Account owner only. Can create external effects. expected is valueRevision from fos_read(path). Never retry an uncertain effect automatically.', { expected: { type: 'string' } }, ['path', 'expected'], false),
]
type Claims = { username?: string; kind?: string; peerId?: string; scope?: string[]; name?: string }
type Selection = { path: Scope; name: string }
function pathOf(value: unknown, fallback: Scope = []): Scope {
  if (value === undefined) return fallback
  if (!Array.isArray(value) || value.length > 32 || value.some(id => typeof id !== 'string' || !id || id.length > 128 || id === '.' || id === '..')) throw new Error('Use an array of child IDs within the attachment.')
  return value
}
function selectionsOf(value: unknown): Selection[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 32) throw new Error('Invalid branch selections.')
  return value.map(s => {
    if (!s || typeof s.name !== 'string' || !s.name || s.name.length > 200) throw new Error('Invalid branch name.')
    return { path: pathOf(s.path), name: s.name }
  }).sort((a, b) => a.path.length - b.path.length)
}
function textOf(value: unknown, max = 16000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Text is required (at most ${max} characters).`)
  return value.trim()
}
function selectedIdentity(store: FosStore, cid: string): string {
  return isBranchChoice(store, content(store, cid)) ? selectedBranchValue(store, cid) ?? cid : cid
}
function branchInfo(store: FosStore, cid: string) {
  if (isBranchChoice(store, content(store, cid))) return { selected: branchSelection(store, cid), names: readChoice(store, cid).options.map(o => o.peerId) }
  return refBranches(store, content(store, cid)) ?? null
}
function descend(store: FosStore, cid: string, path: Scope): string {
  for (const id of path) {
    // No global alias lookup, legacy Home fallback, bookkeeping, or external handle traversal.
    if (!viewNode(store, cid).tasks.some(row => row.id === id)) throw new Error('Node is not a visible child in this branch.')
    const next = findChild(store, cid, id)
    if (!next) throw new Error('Node not found in this branch.')
    cid = next
  }
  return cid
}

export function createTaskTreeMcp(deps: PeerSyncDeps, evaluate?: (username: string, request: { path: Scope; branches: Record<string, string>; expected: string }) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store')
    const claims = (req as Request & { claims?: Claims }).claims ?? {}
    if (!claims.username) return res.status(401).json({ error: 'Authentication required.' })
    // No ambient-cookie auth or browser origins: clients send explicit bearer credentials.
    if (req.headers.origin) return res.status(403).json({ error: 'Browser-origin MCP requests are not supported.' })
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end() }
    const message = req.body
    if (!message || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || ('id' in message && typeof message.id !== 'number' && typeof message.id !== 'string')) return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid JSON-RPC request' } })
    const protocol = req.headers['mcp-protocol-version']
    if (protocol && !['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'].includes(String(protocol))) return res.status(400).json({ error: 'Unsupported MCP protocol version.' })
    const owner = claims.kind !== 'peer'
    let scope: Scope
    try {
      if (!owner && (!claims.peerId || !Array.isArray(claims.scope))) throw new Error('Invalid peer attachment.')
      // A peer cannot widen its signed grant with a URL parameter. Owners explicitly choose a scope.
      scope = owner ? pathOf(JSON.parse(String(req.query.scope ?? 'null'))) : pathOf(claims.scope)
    } catch { return res.status(400).json({ error: 'Owner connections require ?scope=["node-id",…]; peer connections use their signed attachment.' }) }

    const run = async (name: string, args: any = {}) => {
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Tool arguments must be an object.')
      const path = pathOf(args.path), selections = selectionsOf(args.branches)
      if (name === 'fos_propose' && path.length) throw new Error('Proposals attach at []. Put relative paths in changes[].path.')
      if (![...tools, ...(owner ? ownerTools : [])].some(t => t.name === name)) throw new Error('Tool unavailable for this credential.')
      // Loading and saving share the sync lock/CAS. Branch selections live only for a synchronous operation.
      const outcome = await withUserLock(`user:${claims.username}`, async () => {
        const loaded = await deps.loadStore(claims.username!)
        if (!loaded) throw new Error('Account unavailable.')
        const { store, user } = loaded, root = rootTargetCid(store)
        const canonical = contextScope(store, root, scope)
        let attached = resolveScope(store, root, canonical)
        if (!attached) throw new Error('Attachment no longer exists.')
        const permission = (cid: string, capability: 'read' | 'edit') => {
          if (owner) return true
          const identity = content(store, selectedIdentity(store, cid))
          return hasCapability(store, identity, claims.peerId!, capability) || (capability === 'read' && hasCapability(store, identity, claims.peerId!, 'edit'))
        }
        if (!permission(attached, 'read')) throw new Error('Peer no longer has read access to this attachment.')
        const branches: Record<string, string> = Object.create(null)
        for (const s of selections) withBranches(store, branches, () => {
          const target = descend(store, attached!, s.path), info = branchInfo(store, target)
          if (!info?.names.includes(s.name)) throw new Error('Branch not found.')
          branches[content(store, target).data.alias!.id] = s.name
        })
        const result = withBranches(store, branches, () => {
          attached = resolveScope(store, root, canonical)!
          if (!permission(attached, 'read')) throw new Error('Peer has no access to this branch.')
          const resolve = (relative: Scope) => {
            let cid = attached!
            for (const id of relative) {
              cid = descend(store, cid, [id])
              const member = readMembers(store, content(store, selectedIdentity(store, cid))).some(m => m.peerId === claims.peerId)
              if (member && !permission(cid, 'read')) throw new Error('Peer has no access to this child.')
            }
            return cid
          }
          const cid = resolve(path), node = viewNode(store, cid), now = deps.now?.() ?? Date.now()
          const editable = permission(attached, 'edit')
          const describe = (at: Scope) => {
            const current = resolve(at), v = viewNode(store, current)
            return { path: at, title: v.name, done: v.done, revision: current, valueRevision: put(store, valueContent(store, current)), branches: branchInfo(store, current) }
          }
          if (name === 'fos_read') {
            const offset = args.offset ?? 0
            if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid offset.')
            const visible = node.tasks.filter(row => { try { resolve([...path, row.id]); return true } catch { return false } })
            return { ...describe(path), ancestors: path.map((_id, i) => describe(path.slice(0, i))), children: visible.slice(offset, offset + 100).map(row => ({ ...row, path: [...path, row.id] })), nextOffset: offset + 100 < visible.length ? offset + 100 : null, conflicts: node.choices.map(c => ({ id: c.id, subject: c.subject })), proposals: node.proposals.filter(p => owner || p.peerId === claims.peerId), actions: [...(editable ? ['fos_propose'] : []), ...(owner ? ['fos_create_branch', ...(evaluate ? ['fos_evaluate'] : [])] : [])] }
          }
          if (name === 'fos_search') {
            const query = textOf(args.query, 200).toLowerCase(), offset = args.offset ?? 0
            if (!Number.isSafeInteger(offset) || offset < 0 || offset > 5000) throw new Error('Invalid search offset.')
            const stack: Scope[] = [path], seen = new Set<string>(), matches: unknown[] = []
            let visited = 0
            while (stack.length && visited < 5000 && matches.length < 50) {
              const at = stack.pop()!
              let current: string
              try { current = resolve(at) } catch { continue }
              if (seen.has(current)) continue
              seen.add(current)
              const v = viewNode(store, current)
              if (visited++ >= offset && (v.name ?? '').toLowerCase().includes(query)) matches.push(describe(at))
              if (at.length < 32) for (const row of [...v.tasks].reverse()) stack.push([...at, row.id])
            }
            return { matches, nextOffset: stack.length && visited < 5000 ? visited : null, truncated: stack.length > 0, scanned: visited }
          }
          if (name === 'fos_evaluate') {
            if (!owner || !evaluate) throw new Error('Evaluation requires the owning account.')
            if (typeof args.expected !== 'string') throw new Error('Read and review the node before evaluation.')
            return { evaluationRequest: { path: [...canonical, ...path], branches, expected: args.expected } }
          }
          if (args.expected !== attached) throw new Error('The attachment changed. Read [] and review before retrying.')
          if (name === 'fos_create_branch') {
            if (!owner) throw new Error('Only the account owner can create branches directly.')
            createBranch(createReplica(`user:${claims.username}`, store), [...canonical, ...path], textOf(args.name, 200), now)
            return { created: args.name, path }
          }
          if (!editable) throw new Error('Peer cannot propose edits on this attachment.')
          const proposalName = textOf(args.name, 100), identity = content(store, selectedIdentity(store, attached!))
          const actor = claims.peerId ?? `user:${claims.username}`
          if (readProposals(store, identity).some(p => p.peerId === actor && p.name === proposalName)) throw new Error('That proposal name already exists. Review it or choose a new name.')
          if (!Array.isArray(args.changes) || !args.changes.length || args.changes.length > 50) throw new Error('Supply 1–50 changes.')
          const base = put(store, valueContent(store, attached!)), draftStore = new FosStore()
          importNodes(draftStore, reachableNodes(store, [base]))
          commitRoot(draftStore, base, now)
          let draft = createReplica(actor, draftStore)
          withBranches(draftStore, branches, () => {
            for (const change of args.changes) {
              if (!change || typeof change !== 'object') throw new Error('Invalid change.')
              const at = pathOf(change.path)
              const source = resolve(at)
              // Explicit child restrictions override the attachment's grant.
              for (let i = 1; i <= at.length; i++) {
                const child = resolve(at.slice(0, i)), value = content(store, selectedIdentity(store, child))
                if (readMembers(store, value).some(m => m.peerId === actor) && !permission(child, 'edit')) throw new Error('Peer cannot edit this child.')
              }
              if (change.operation === 'add_task' || change.operation === 'add_note') draft = addRow(draft, at, change.operation === 'add_task' ? 'task' : 'note', textOf(change.text), now)
              else {
                if (!at.length) throw new Error('Rename/complete require a child path.')
                if (change.operation === 'rename') draft = renameTask(draft, at.slice(0, -1), at.at(-1)!, textOf(change.text), now)
                else if (change.operation === 'complete' && typeof change.done === 'boolean') {
                  if (!valueContent(store, source).data.todo) throw new Error('Only tasks have a completion state.')
                  const before = headCid(draft)
                  draft = setTaskDone(draft, at.slice(0, -1), at.at(-1)!, change.done, now)
                  if (before === headCid(draft) && viewNode(draftStore, descend(draftStore, headCid(draft), at)).done !== change.done) throw new Error('Task has unmet requirements.')
                } else throw new Error('Unknown change operation.')
              }
            }
          })
          if (headCid(draft) === base) throw new Error('No changes to propose.')
          importNodes(store, reachableNodes(draftStore, [headCid(draft)]))
          const proposal = put(store, proposalContent(store, actor, proposalName, headCid(draft), base, now))
          const next = updateAtScope(store, root, canonical, current => withProposal(store, makeLink(store, current, now), actor, proposal, proposalName), 'node')
          commitRoot(store, next, now)
          return { proposalId: proposal, name: proposalName, status: 'awaiting-review' }
        })
        if (rootTargetCid(store) !== root) {
          await deps.saveStore(user, store)
          deps.notify?.(user.id, { type: 'sync_changed', scope: canonical, byPeerId: claims.peerId ?? 'fos:mcp' })
        }
        return result
      })
      // Evaluator acquires the same lock itself and rechecks version before dispatching effects.
      if ('evaluationRequest' in outcome) return { evaluation: await evaluate!(claims.username!, outcome.evaluationRequest!) }
      return outcome
    }
    const server = new MCPServerInstance({ name: 'Fos project tree', version: '0.1.0', protocolVersion: '2025-03-26', capabilities: { tools: {} } })
    server.addToolProvider({
      listTools: async () => [...tools, ...(owner ? ownerTools.filter(t => t.name !== 'fos_evaluate' || evaluate) : [])],
      async callTool(name, args) {
        try { const result = await run(name, args); return { content: [{ type: 'text', text: JSON.stringify(result) }] } }
        catch (error) { return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : 'Task operation failed.' }] } }
      },
    })
    const response = await server.handleMessage(JSON.stringify(message))
    return response ? res.json(JSON.parse(response)) : res.status(202).end()
  }
}
