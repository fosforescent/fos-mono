import { settingOf } from '@fosforescent/shared/sync/index'
import { standardHostRef } from '../sync/host-runtime'
import { sameCapabilityType, handlerRef, instructionPrimitives, setRefValueAt, acceptSubmission } from '@fosforescent/shared/sync/index'
/**
 * MCP peers: an MCP server the account has access to attaches to a node as a member (`mcp:<server id>`),
 * advertises `tool` (and read/edit) there, and runs its tools for "-tool <name> …" requirements under that
 * node: the result lands as a note inside the requirement with a supply by the peer.
 *
 *   GET  /user/data/mcp-peers                   the account's MCP servers as peers (id, name, tools)
 *   POST /user/data/mcp-peers/attach            { scope, serverId }   → the server becomes a member of that node
 *   (running a `-tool` requirement is a `complete` event: `mcpToolHandler` is the runtime effect, see sync/hostHandlers.ts)
 *
 * With MCP_LISTEN=true the peers also listen: after every save of the tree, open tool requirements under nodes
 * they are attached to are run (`runOpenToolRequests`, debounced per user).
 */

import type { Request, Response } from 'express'
import {
  evaluateNode, evaluationRecord, resolveBinding, contextBindings, addMemberAt, addRefAt, addRow, supplyRequirement, applyProposalAt, libAt,
  content, handlerOfferId, headCid, discoverHandlers, MCP_PEER_PREFIX, newId, proposeRefAt, put,
  refArguments, refNodeContent, matchesGraph, refValueCid, resolveScope,
  setHandlerOffersAt, valueContent, view, type Replica, type Scope, type TaskView
} from '@fosforescent/shared/sync/index'
import type { FosStore } from '@fosforescent/shared/dag-implementation/store'

/** The handler every attached MCP server's tools run on; a tool's primitive names it as its implementation. */
const MCP_TOOL_REF = standardHostRef('mcp:*', 'tool')
import { editTree, walkRows, type StoreDeps } from './store'
import type { AccountUser } from '../sync/accountStore'
import type { HostHandler } from '../sync/host-runtime'
import type { PrimitiveFunction } from '@fosforescent/shared/sync/index'
import { patternInputs } from '@fosforescent/shared/sync/index'
import { valueOfPattern } from '@fosforescent/shared/sync/structural'
import { NOTE_TYPE } from '@fosforescent/shared/sync/library-types'

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
  return discoverHandlers(replica, at).filter(o => o.peerId === peerId && o.enabled && o.capability === 'tool').map(o => o.cid)
}

/** The tool's handler, a value behind the same ref that can hold a template: the server's tool runner, offered as the tool. */
function toolHandler(replica: Replica, server: McpServerInfo, tool: string, at: Scope): string {
  return handlerRef(replica.store, `${MCP_PEER_PREFIX}${server.id}`, { ...MCP_TOOL_REF, label: tool }, at, tool)
}

/** The server among the account's attached ones that offers `tool`; several is a choice for the owner. */
async function serverFor(deps: McpPeerDeps, userId: number, tool: string): Promise<McpServerInfo> {
  const servers = (await deps.servers(userId)).filter(s => s.tools.some(t => t.name === tool))
  if (!servers.length) throw new Error(`No attached MCP server offers the tool ${tool}.`)
  if (servers.length > 1) throw new Error(`Several MCP servers offer ${tool}; attach one here.`)
  return servers[0]!
}
/**
 * The primitive every attached MCP server's tools run through. A `-tool name input` requirement names the tool as its
 * `tool` input and is answered with the result; a call of a tool's own primitive (no hole to fill) runs the tool the
 * primitive names, with its name as the input.
 */
function toolPrimitive(deps: McpPeerDeps, userId: number): PrimitiveFunction {
  return async (operands, ctx) => {
    const self = operands.outputs.self
    const tool = self ? patternInputs(ctx.store, self.pattern).tool : content(ctx.store, operands.left).data.description?.content
    if (!tool) throw new Error('Name the tool: "-tool name input".')
    const server = await serverFor(deps, userId, tool)
    const text = await deps.callTool(server, tool, self?.data.description?.content ?? tool)
    if (!self) return { outputs: {} as Record<string, string> }
    return { outputs: { self: valueOfPattern(ctx.store, self.pattern, { description: { content: text.slice(0, 20_000) || '(empty result)' }, peerId: { content: `${MCP_PEER_PREFIX}${server.id}` } }) } }
  }
}

export function mcpToolHandler(deps: McpPeerDeps): HostHandler {
  return {
    peerId: 'mcp:*', ref: MCP_TOOL_REF,
    matches: id => id.startsWith(MCP_PEER_PREFIX),
    handles: step => step.row?.requirement?.capability === 'tool' && step.row.requirement.tool !== 'fos.pull',
    available: async (userId, peerId) => (await deps.servers(userId)).some(s => `${MCP_PEER_PREFIX}${s.id}` === peerId),
    run: user => toolPrimitive(deps, user.id)
  }
}

/** The listener's runner (`runOpenToolRequests`): the same binding and call, under the requirement's own evaluation journal. */
async function runRequirement(deps: McpPeerDeps, replica: Replica, user: AccountUser, at: Scope, req: TaskView, servers: McpServerInfo[], now: number): Promise<{ replica: Replica; text: string } | { error: string }> {
  const scope = [...at, req.id]
  const prior = evaluationRecord(replica, scope)
  if (prior && !['committed', 'rolled-back'].includes(prior.status)) return { error: 'This evaluation needs recovery. Review its effects before running again.' }
  const tool = req.requirement?.inputs.tool
  if (!req.requirement || req.requirement.satisfied || !tool) return { error: 'not an open tool instruction' }
  if (!servers.some(s => s.tools.some(t => t.name === tool))) return { error: 'no attached MCP server offers this tool' }
  try {
    const run = toolPrimitive(deps, user.id)
    const record = await evaluateNode(scope, {
      get: () => replica,
      save: async next => { replica = next; await deps.saveStore(user, next.store) },
      now: () => deps.now?.() ?? Date.now(),
      executors: step => JSON.stringify(step.path) === JSON.stringify(scope) ? [{ run }] : [],
      check: () => []
    })
    const answer = view(replica, at)?.tasks.find(t => t.id === req.id)
    return record.status === 'committed' ? { replica, text: answer?.requirement?.satisfied ? valueContent(replica.store, resolveScope(replica.store, headCid(replica), scope)!).data.description?.content ?? '' : '' } : { error: record.error ?? 'Tool evaluation needs recovery.' }
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
        next = setHandlerOffersAt(next, scope, peerId, libAt(next.store, scope).capabilities.tool!, server.tools.map((tool) => toolHandler(next, server, tool.name, scope)), now())
        return { replica: next, result: true }
      })
      if (!done) return fail(res, 404, 'node not found')
      return res.json({ ok: true, peerId: `${MCP_PEER_PREFIX}${server.id}`, tools: server.tools.map((t) => t.name) })
    },

    /** Run one tool requirement now (the "Run" button); the answer is a note inside it. */
    /** Listener: every open tool requirement under an attached node, run in turn. Returns how many ran. */
    async runOpenToolRequests(user: AccountUser, _store: FosStore): Promise<number> {
      const servers = await deps.servers(user.id)
      if (!servers.length) return 0
      return await editTree(deps, user.id, async (replica, currentUser) => {
        let ran = 0
        for (const { at, row } of walkRows(replica)) {
          if (!row.requirement || row.requirement?.capability !== 'tool' || row.requirement.satisfied) continue
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
