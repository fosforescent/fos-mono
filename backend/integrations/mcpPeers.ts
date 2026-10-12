/**
 * MCP peers: an MCP server the account has access to attaches to a node as a member (`mcp:<server id>`),
 * advertises `tool` (and read/edit) there, and runs its tools for "-tool <name> …" requirements under that
 * node: the result lands as a note inside the requirement with a supply by the peer.
 *
 *   GET  /user/data/mcp-peers                   the account's MCP servers as peers (id, name, tools)
 *   POST /user/data/mcp-peers/attach            { scope, serverId }   → the server becomes a member of that node
 *   POST /user/data/mcp-peers/run               { scope, requirementId } → run the requirement now
 *
 * With MCP_LISTEN=true the peers also listen: after every save of the tree, open tool requirements under nodes
 * they are attached to are run (`runOpenToolRequests`, debounced per user).
 */

import type { Request, Response } from 'express'
import { addMemberAt, addRow, addSupply, MCP_PEER_PREFIX, resolveScope, headCid, view, type Replica, type Scope, type TaskView } from '@fosforescent/shared/sync/index'
import type { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { editTree, replicaOf, walkRows, type StoreDeps } from './store'
import type { PeerSyncUser } from '../sync/peerSync'

export type McpServerInfo = { id: number; name: string; endpoint: string; credentials: Record<string, unknown>; tools: Array<{ name: string; description: string | null }> }

export type McpPeerDeps = StoreDeps & {
  userId(req: Request): Promise<number>
  servers(userId: number): Promise<McpServerInfo[]>
  /** Run one tool on one server; returns the text of the result. */
  callTool(server: McpServerInfo, tool: string, input: string): Promise<string>
}

/** The MCP members on the path to `at` (nearest first), as peer ids and server ids. */
export function mcpMembersAbove(replica: Replica, at: Scope): Array<{ serverId: number; peerId: string }> {
  const out: Array<{ serverId: number; peerId: string }> = []
  for (let i = at.length; i >= 0; i--) {
    const node = view(replica, at.slice(0, i))
    for (const m of node?.members ?? []) {
      if (!m.peerId.startsWith(MCP_PEER_PREFIX) || !m.capabilities.includes('tool') || (m.disabled ?? []).includes('tool')) continue
      const serverId = Number(m.peerId.slice(MCP_PEER_PREFIX.length))
      if (Number.isFinite(serverId) && !out.some((o) => o.serverId === serverId)) out.push({ serverId, peerId: m.peerId })
    }
  }
  return out
}

/** Run one open tool requirement: pick the nearest attached server that has the tool, call it, record the answer. */
async function runRequirement(deps: McpPeerDeps, replica: Replica, user: PeerSyncUser, at: Scope, req: TaskView, servers: McpServerInfo[], now: number): Promise<{ replica: Replica; text: string } | { error: string }> {
  const r = req.requirement
  if (!r || r.capability !== 'tool' || r.satisfied) return { error: 'not an open tool requirement' }
  const attached = mcpMembersAbove(replica, at)
  const candidates = attached.map((a) => servers.find((s) => s.id === a.serverId)).filter((s): s is McpServerInfo => !!s)
  const server = candidates.find((s) => !r.tool || s.tools.some((t) => t.name === r.tool))
  if (!server) return { error: attached.length ? `no attached MCP peer has a tool called “${r.tool ?? '(any)'}”` : 'no MCP peer is attached to this node or above it' }
  const tool = r.tool ?? server.tools[0]?.name
  if (!tool) return { error: `${server.name} advertises no tools` }
  let text: string
  try { text = await deps.callTool(server, tool, req.title) } catch (error) { return { error: `${server.name}/${tool}: ${error instanceof Error ? error.message : String(error)}` } }
  let next = addRow(replica, [...at, req.id], 'note', text.slice(0, 20_000) || '(empty result)', now)
  next = addSupply(next, at, req.id, { capability: 'tool', by: `${MCP_PEER_PREFIX}${server.id}` }, now)
  return { replica: next, text }
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
        return { replica: addMemberAt(replica, scope, `${MCP_PEER_PREFIX}${server.id}`, server.name, ['tool', 'read', 'edit'], now()), result: true }
      })
      if (!done) return fail(res, 404, 'node not found')
      return res.json({ ok: true, peerId: `${MCP_PEER_PREFIX}${server.id}`, tools: server.tools.map((t) => t.name) })
    },

    /** Run one tool requirement now (the "Run" button); the answer is a note inside it. */
    async run(req: Request, res: Response): Promise<Response> {
      const userId = await deps.userId(req)
      const scope = scopeOf(req.body)
      const requirementId = String((req.body as { requirementId?: unknown } | undefined)?.requirementId ?? '')
      if (!scope || !requirementId) return fail(res, 400, 'scope and requirementId required')
      const servers = await deps.servers(userId)
      const outcome = await editTree(deps, userId, async (replica, user) => {
        const row = view(replica, scope)?.tasks.find((t) => t.id === requirementId)
        if (!row) return { replica: null, result: { error: 'requirement not found' } as { error: string } | { text: string } }
        const ran = await runRequirement(deps, replica, user, scope, row, servers, now())
        return 'error' in ran ? { replica: null, result: ran } : { replica: ran.replica, result: { text: ran.text } }
      })
      if (!outcome) return fail(res, 404, 'user not found')
      if ('error' in outcome) return fail(res, 409, outcome.error)
      return res.json(outcome)
    },

    /** Listener: every open tool requirement under an attached node, run in turn. Returns how many ran. */
    async runOpenToolRequests(user: PeerSyncUser, store: FosStore): Promise<number> {
      const servers = await deps.servers(user.id)
      if (!servers.length) return 0
      let replica = replicaOf(store, user.username)
      let ran = 0
      for (const { at, row } of walkRows(replica)) {
        if (row.kind !== 'requirement' || row.requirement?.capability !== 'tool' || row.requirement.satisfied) continue
        if (!mcpMembersAbove(replica, at).length) continue
        const result = await runRequirement(deps, replica, user, at, row, servers, now())
        if ('error' in result) { console.warn(`[mcp] ${user.username}: ${result.error}`); continue }
        replica = result.replica
        ran++
      }
      if (ran) await deps.saveStore(user, replica.store)
      return ran
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
