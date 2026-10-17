/**
 * MCP peers: an MCP server the account has access to attaches to a node as a member (`mcp:<server id>`),
 * advertises `tool` (and read/edit) there, and runs its tools for "-tool <name> …" requirements under that
 * node: the result lands as a note inside the requirement with a supply by the peer.
 *
 *   GET  /user/data/mcp-peers                   the account's MCP servers as peers (id, name, tools)
 *   POST /user/data/mcp-peers/attach            { scope, serverId }   → the server becomes a member of that node
 *   (running a `-tool` requirement is a `complete` event: `mcpToolHandler` is the registry effect, see sync/hostHandlers.ts)
 *
 * With MCP_LISTEN=true the peers also listen: after every save of the tree, open tool requirements under nodes
 * they are attached to are run (`runOpenToolRequests`, debounced per user).
 */

import type { Request, Response } from 'express'
import {
  evaluateNode, evaluationRecord, resolveBinding, contextBindings, addMemberAt, addRefAt, addRow, addSupply, applyProposalAt, capabilityTarget,
  content, headCid, discoverHandlers, MCP_PEER_PREFIX, newId, proposeRefAt, put,
  refArguments, refNodeContent, refTypeCid, refValueCid, resolveScope,
  setHandlerOffersAt, valueContent, view, type Replica, type Scope, type TaskView
} from '@fosforescent/shared/sync/index'
import type { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { editTree, walkRows, type StoreDeps } from './store'
import type { PeerSyncUser } from '../sync/peerSync'
import type { HostHandler } from '../sync/registry'

export type McpServerInfo = { id: number; name: string; endpoint: string; credentials: Record<string, unknown>; tools: Array<{ name: string; description: string | null }> }

export type McpPeerDeps = StoreDeps & {
  userId(req: Request): Promise<number>
  servers(userId: number): Promise<McpServerInfo[]>
  /** Run one tool on one server; returns the text of the result. */
  callTool(server: McpServerInfo, tool: string, input: string): Promise<string>
}

/** The MCP members on the path to `at` (nearest first), as peer ids and server ids. */
export function mcpMembersAbove(replica: Replica, at: Scope): Array<{ serverId: number; peerId: string }> {
  const ids = [...new Set(discoverHandlers(replica, at).filter(o => o.enabled && o.capability === 'tool' && o.peerId.startsWith(MCP_PEER_PREFIX)).map(o => o.peerId))]
  return ids.map(peerId => ({ peerId, serverId: Number(peerId.slice(MCP_PEER_PREFIX.length)) })).filter(p => Number.isFinite(p.serverId))
}

function handlersAbove(replica: Replica, at: Scope, peerId: string): string[] {
  return discoverHandlers(replica, at).filter(o => o.peerId === peerId && o.enabled && !o.legacy && o.capability === 'tool').map(o => o.cid)
}

/** Create the native handler as a value behind the same ref that can hold a template. */
function toolHandler(replica: Replica, server: McpServerInfo, tool: string): string {
  const store = replica.store
  const value = put(store, { data: { peerId: { content: `${MCP_PEER_PREFIX}${server.id}` }, description: { content: tool } }, children: [] })
  return put(store, refNodeContent(store, { alias: { id: `${MCP_PEER_PREFIX}${server.id}/${tool}` } }, value, [], capabilityTarget(store, 'tool')))
}

type BoundTool = { replica: Replica; server: McpServerInfo; tool: string; peerId: string; returnId: string }

/** Resolve the pinned handler; unavailable explicit bindings never fall back to a different peer. Writes the binding and the return ref, never calls anything. */
function bindTool(replica: Replica, at: Scope, req: TaskView, servers: McpServerInfo[], now: number): BoundTool | { error: string } {
  const r = req.requirement
  if (!r || r.capability !== 'tool' || r.satisfied) return { error: 'not an open tool requirement' }
  const store = replica.store
  const scope = [...at, req.id]
  const requestView = view(replica, scope)
  if (requestView?.choices.length) return { error: 'tool requirement has unresolved choices' }
  if (requestView?.tasks.some((row) => row.kind === 'requirement' && !row.requirement?.satisfied)) return { error: 'tool requirement has unresolved dependencies' }
  const request = valueContent(store, resolveScope(store, headCid(replica), scope)!)
  const argumentsOfType = refArguments(store, request, capabilityTarget(store, 'tool'))
  if (argumentsOfType.length > 1) return { error: 'tool requirement has ambiguous handler arguments' }
  const bindingId = argumentsOfType[0]?.id ?? newId()
  const bindingPath = [...scope, bindingId]
  const bindingCid = resolveScope(store, headCid(replica), bindingPath)
  let handlerCid = bindingCid ? refValueCid(store, content(store, bindingCid)) : null
  const attached = mcpMembersAbove(replica, scope)
  if (!handlerCid) {
    const candidates: Array<{ cid: string; type: string }> = []
    for (const { serverId, peerId } of attached) {
      const server = servers.find(s => s.id === serverId)
      if (!server) continue
      const advertised = handlersAbove(replica, scope, peerId)
      for (const tool of server.tools.filter(t => !r.tool || t.name === r.tool)) {
        const matches = advertised.filter(h => valueContent(store, h).data.description?.content === tool.name)
        const ids = advertised.length ? matches : [toolHandler(replica, server, tool.name)]
        for (const cid of ids) candidates.push({ cid, type: capabilityTarget(store, 'tool') })
      }
    }
    const selected = resolveBinding(store, capabilityTarget(store, 'tool'), candidates.length === 1 ? candidates[0]!.cid : null, candidates.length === 1 ? contextBindings(replica, scope) : candidates)
    if (selected.status !== 'ready') return { error: selected.problems.join('; ') }
    // Pin the advertised ref, not only its terminal value.
    handlerCid = candidates[0]!.cid
    replica = addRefAt(replica, scope, bindingId, capabilityTarget(store, 'tool'), now)
    const proposed = proposeRefAt(replica, bindingPath, handlerCid, replica.meta.peerId, now)
    replica = applyProposalAt(proposed.replica, bindingPath, proposed.proposalCid, replica.meta.peerId, now)
  }
  if (refTypeCid(store, content(store, handlerCid)) !== capabilityTarget(store, 'tool')) return { error: 'bound handler is not a tool handler' }
  const resolved = resolveBinding(store, capabilityTarget(store, 'tool'), handlerCid, contextBindings(replica, scope))
  if (resolved.status !== 'ready') return { error: resolved.problems.join('; ') }
  const handler = content(store, resolved.cid!)
  const peerId = handler.data.peerId?.content
  const tool = handler.data.description?.content
  const server = servers.find((s) => `${MCP_PEER_PREFIX}${s.id}` === peerId)
  if (!server || !peerId || !attached.some((a) => a.peerId === peerId) || !tool || !server.tools.some((t) => t.name === tool) || (r.tool && tool !== r.tool)) return { error: 'bound MCP handler is unavailable or does not match the requirement' }
  if (!stillAdvertised(replica, scope, peerId, tool)) return { error: 'bound MCP handler is disabled or no longer advertised' }
  const returns = refArguments(store, request, store.primitive.documentField.getId()).filter(a => !content(store, a.cid).data.name?.content.startsWith('fos:'))
  if (returns.length > 1) return { error: 'tool requirement has ambiguous return arguments' }
  const returnId = returns[0]?.id ?? newId()
  if (!returns.length) replica = addRefAt(replica, scope, returnId, store.primitive.documentField.getId(), now)
  return { replica, server, tool, peerId, returnId }
}

function stillAdvertised(replica: Replica, scope: Scope, peerId: string, tool: string): boolean {
  return discoverHandlers(replica, scope).some(o => o.peerId === peerId && o.enabled && o.capability === 'tool' && (o.legacy || valueContent(replica.store, o.cid).data.description?.content === tool))
}

/** Call the bound tool and record its answer: a note, the return ref and the supply that fills the requirement. */
async function executeTool(deps: McpPeerDeps, replica: Replica, bound: BoundTool, userId: number, at: Scope, req: TaskView, now: number): Promise<{ replica: Replica; text: string }> {
  const liveServer = (await deps.servers(userId)).find(s => s.id === bound.server.id && s.tools.some(t => t.name === bound.tool))
  if (!liveServer) throw new Error('The bound MCP server disconnected.')
  const text = await deps.callTool(liveServer, bound.tool, req.title)
  const store = replica.store, scope = [...at, req.id], resultId = newId()
  replica = addRow(replica, scope, 'note', text.slice(0, 20_000) || '(empty result)', now, { id: resultId })
  const resultCid = resolveScope(store, headCid(replica), [...scope, resultId])!
  const returned = proposeRefAt(replica, [...scope, bound.returnId], resultCid, bound.peerId, now)
  replica = applyProposalAt(returned.replica, [...scope, bound.returnId], returned.proposalCid, replica.meta.peerId, now)
  replica = addSupply(replica, at, req.id, { capability: 'tool', by: bound.peerId, ref: resultId }, now)
  return { replica, text }
}

/** `-tool` requirements as a registry effect: the attached MCP server (`mcp:<id>`) that is bound, or the single candidate, runs the tool. */
export function mcpToolHandler(deps: McpPeerDeps): HostHandler {
  return {
    peerId: 'mcp:*', capability: 'tool',
    matches: id => id.startsWith(MCP_PEER_PREFIX),
    handles: step => step.row?.requirement?.capability === 'tool' && step.row.requirement.tool !== 'fos.pull',
    available: async (userId, peerId) => (await deps.servers(userId)).some(s => `${MCP_PEER_PREFIX}${s.id}` === peerId),
    // The binding and the return ref are written before the evaluator pins the step, and persist on failure.
    async prepare(ctx) {
      const at = ctx.step.path.slice(0, -1), req = ctx.step.row!
      const bound = bindTool(ctx.replica(), at, req, await deps.servers(ctx.userId), ctx.now())
      if ('error' in bound) throw new Error(bound.error)
      if (headCid(bound.replica) !== headCid(ctx.replica())) await ctx.update(bound.replica)
      return { outputs: [bound.returnId] }
    },
    async effect(ctx) {
      const at = ctx.step.path.slice(0, -1), req = ctx.step.row!
      const bound = bindTool(ctx.replica(), at, req, await deps.servers(ctx.userId), ctx.now()) // already bound: resolves the pinned ref, writes nothing
      if ('error' in bound) throw new Error(bound.error)
      const done = await executeTool(deps, ctx.replica(), bound, ctx.userId, at, req, ctx.now())
      await ctx.update(done.replica)
    }
  }
}

/** The listener's runner (`runOpenToolRequests`): the same binding and call, under the requirement's own evaluation journal. */
async function runRequirement(deps: McpPeerDeps, replica: Replica, user: PeerSyncUser, at: Scope, req: TaskView, servers: McpServerInfo[], now: number): Promise<{ replica: Replica; text: string } | { error: string }> {
  const scope = [...at, req.id]
  const prior = evaluationRecord(replica, scope)
  if (prior && !['committed', 'rolled-back'].includes(prior.status)) return { error: 'This evaluation needs recovery. Review its effects before running again.' }
  const before = headCid(replica)
  const bound = bindTool(replica, at, req, servers, now)
  if ('error' in bound) return bound
  replica = bound.replica
  // Persist the binding before calling an external handler, including on failure.
  if (headCid(replica) !== before) await deps.saveStore(user, replica.store)
  let text = ''
  try {
    const record = await evaluateNode(scope, {
      get: () => replica,
      save: async next => { replica = next; await deps.saveStore(user, next.store) },
      now: () => deps.now?.() ?? Date.now(),
      handles: step => JSON.stringify(step.path) === JSON.stringify(scope),
      outputs: () => [bound.returnId],
      check: () => stillAdvertised(replica, scope, bound.peerId, bound.tool) ? [] : ['The bound MCP handler is no longer available.'],
      effect: async () => {
        const done = await executeTool(deps, replica, bound, user.id, at, req, deps.now?.() ?? Date.now())
        replica = done.replica; text = done.text
      }
    })
    return record.status === 'committed' ? { replica, text } : { error: record.error ?? 'Tool evaluation needs recovery.' }
  } catch (error) { return { error: error instanceof Error ? error.message : String(error) } }
}

export function createMcpPeerHandlers(deps: McpPeerDeps) {
  const now = () => (deps.now ? deps.now() : Date.now())
  const fail = (res: Response, status: number, error: string) => res.status(status).json({ error })
  const scopeOf = (body: unknown): Scope | null => { const s = (body as { scope?: unknown } | undefined)?.scope; return Array.isArray(s) && s.every((x) => typeof x === 'string') ? (s as string[]) : null }

  return {
    async list(req: Request, res: Response): Promise<Response> {
      const servers = await deps.servers(await deps.userId(req))
      return res.json({ peers: servers.map((s) => ({ id: `${MCP_PEER_PREFIX}${s.id}`, serverId: s.id, name: s.name, tools: s.tools.map((t) => t.name) })) })
    },

    async attach(req: Request, res: Response): Promise<Response> {
      const userId = await deps.userId(req)
      const scope = scopeOf(req.body)
      const serverId = Number((req.body as { serverId?: unknown } | undefined)?.serverId)
      if (!scope || !Number.isFinite(serverId)) return fail(res, 400, 'scope (path of ids) and serverId required')
      const server = (await deps.servers(userId)).find((s) => s.id === serverId)
      if (!server) return fail(res, 404, 'no such MCP server on this account')
      const done = await editTree(deps, userId, async (replica) => {
        if (!resolveScope(replica.store, headCid(replica), scope)) return { replica: null, result: false }
        const peerId = `${MCP_PEER_PREFIX}${server.id}`
        let next = addMemberAt(replica, scope, peerId, server.name, ['tool', 'read', 'edit'], now())
        next = setHandlerOffersAt(next, scope, peerId, capabilityTarget(next.store, 'tool'), server.tools.map((tool) => toolHandler(next, server, tool.name)), now())
        return { replica: next, result: true }
      })
      if (!done) return fail(res, 404, 'node not found')
      return res.json({ ok: true, peerId: `${MCP_PEER_PREFIX}${server.id}`, tools: server.tools.map((t) => t.name) })
    },

    /** Run one tool requirement now (the "Run" button); the answer is a note inside it. */
    /** Listener: every open tool requirement under an attached node, run in turn. Returns how many ran. */
    async runOpenToolRequests(user: PeerSyncUser, _store: FosStore): Promise<number> {
      const servers = await deps.servers(user.id)
      if (!servers.length) return 0
      return await editTree(deps, user.id, async (replica, currentUser) => {
        let ran = 0
        for (const { at, row } of walkRows(replica)) {
          if (row.kind !== 'requirement' || row.requirement?.capability !== 'tool' || row.requirement.satisfied) continue
          if (!mcpMembersAbove(replica, [...at, row.id]).length) continue
          const result = await runRequirement(deps, replica, currentUser, at, row, servers, now())
          if ('error' in result) { console.warn(`[mcp] ${user.username}: ${result.error}`); continue }
          replica = result.replica
          ran++
        }
        return { replica, result: ran }
      }) ?? 0
    }
  }
}

/** Prisma + MCP client deps for the real server. */
export function prismaMcpPeerDeps(prisma: { userModel: any; userMCPServerAccessModel: any }, store: StoreDeps, userId: (req: Request) => Promise<number>, callTool: McpPeerDeps['callTool']): McpPeerDeps {
  return {
    ...store,
    userId,
    callTool,
    async servers(id) {
      const access = await prisma.userMCPServerAccessModel.findMany({ where: { userId: id }, include: { server: { include: { Tools: true } } } })
      return access.map((a: any) => ({ id: a.server.id, name: a.server.name, endpoint: a.server.endpoint, credentials: { ...(a.server.credentials ?? {}), ...(a.credentials ?? {}) }, tools: (a.server.Tools ?? []).map((t: any) => ({ name: t.name, description: t.description ?? null })) }))
    }
  }
}
