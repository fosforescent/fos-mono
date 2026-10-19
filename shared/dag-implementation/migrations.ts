/**
 * Ordered migrations between cid format versions.
 *
 * Like database migrations, each step upgrades content from one version to the
 * next. Because cids are content hashes, a graph is migrated bottom-up: a
 * node's children are migrated first, its edges are rewritten to their new
 * cids, any schema change is applied to its data, and only then is the node
 * rehashed in the target format. `migrateContext` does this for a serialized
 * graph and returns the old→new mapping so roots, routes and bases can follow.
 *
 * Adding a migration:
 *   1. add the new format to CID_FORMATS in cid.ts and bump CURRENT_CID_VERSION
 *   2. append { from: N, to: N+1, upgrade } here; `upgrade` only transforms
 *      a node's own data (edges are remapped for you). A schema change that
 *      needs the rest of the graph uses `plan` instead.
 *   3. add a case to cid.test.ts proving a legacy context migrates
 */

import type { FosContextData, FosNodeContent, FosNodesData, FosPath, FosPathElem } from '../types'
import { CURRENT_CID_VERSION, cidVersion, hashContentAt, type CidVersion } from './cid'
import { planTemplateInstructionRows } from './migration-v3'
import { planTypePatterns } from './migration-v4'

/** The store a context is loaded into: its primitives already exist there in the current format. */
export type MigrationEnvironment = {
  table: Map<string, FosNodeContent>
  primitive: Record<string, { getId(): string }>
}

export type MigrationTools = {
  /** Add a node that is already in the target format (its edges must point at target-format nodes); returns its cid. */
  emit(content: FosNodeContent): string
  /** Is `cid` an ancestor of the node being upgraded (so an edge to it would make a cycle)? */
  pending(cid: string): boolean
  /** A node emitted earlier in this run (already in the target format). */
  read(cid: string): FosNodeContent | undefined
}

/** A node upgrade with the whole input graph in view; returned edges may point at input cids or emitted nodes. */
export type NodeUpgrade = (content: FosNodeContent, cid: string) => FosNodeContent

export type Migration = {
  from: CidVersion
  to: CidVersion
  description: string
  /** Transform a node's content (data and/or edge instruction ids) for the new format. Edges' cids are remapped afterwards. */
  upgrade?: (content: FosNodeContent) => FosNodeContent
  /** Like `upgrade`, for changes that read other nodes: called once per run with the input context. */
  plan?: (input: FosContextData, environment: MigrationEnvironment, tools: MigrationTools) => NodeUpgrade
}

export const MIGRATIONS: Migration[] = [
  {
    from: 0,
    to: 1,
    description: 'Prefix cids with their format version ("v1-"). Node data is unchanged; every node is rehashed because its edges now carry prefixed cids.'
  },
  {
    from: 1,
    to: 2,
    description: 'Hash edges in order and direction so child order replicates. Node data is unchanged; stored edge order is kept as the canonical order.'
  },
  {
    from: 2,
    to: 3,
    description: 'Rows become [template, rowNode] edges: the row kind primitive on the target side is replaced by a template on the instruction side, a task made from a template is pinned to that template, and legacy [LIST, node] rows become plain rows.',
    plan: planTemplateInstructionRows
  },
  {
    from: 3,
    to: 4,
    description: 'Types say which rows they accept (pattern edges; the seed’s ordinary types: anything but Home and the store roots), Home is made from the Home type, and every store root is typed (device root or document root) by its root alias’s instruction.',
    plan: planTypePatterns
  }
]

export class MigrationError extends Error {
  cid: string
  constructor(message: string, cid: string) {
    super(message)
    this.name = 'MigrationError'
    this.cid = cid
  }
}

export type MigrationReport = {
  context: FosContextData
  /** old cid → new cid for every node that changed address */
  mapping: Record<string, string>
  /** cid versions found in the input */
  fromVersions: CidVersion[]
  target: CidVersion
}

/** True when any node in the context is not in the target format. */
export function needsMigration(nodes: FosNodesData, target: CidVersion = CURRENT_CID_VERSION): boolean {
  return Object.keys(nodes).some((cid) => cidVersion(cid) !== target)
}

function stepsBetween(from: CidVersion, to: CidVersion): Migration[] {
  const steps: Migration[] = []
  let at = from
  while (at < to) {
    const step = MIGRATIONS.find((m) => m.from === at)
    if (!step) throw new Error(`no migration from cid version ${at}`)
    steps.push(step)
    at = step.to
  }
  if (at !== to) throw new Error(`cannot migrate from cid version ${from} to ${to}`)
  return steps
}

/**
 * Rehash every node of `context` into the target format (bottom-up), applying
 * each intermediate migration's `upgrade`. Nodes already in the target format
 * whose edges are all current keep their cid.
 */
export function migrateContext(context: FosContextData, target: CidVersion = CURRENT_CID_VERSION, environment?: MigrationEnvironment): MigrationReport {
  const input = context.nodes
  const mapping: Record<string, string> = {}
  const output: FosNodesData = {}
  const fromVersions = new Set<CidVersion>()
  const inProgress = new Set<string>()
  const emitted = new Set<string>()
  const tools: MigrationTools = {
    emit(content) {
      const cid = hashContentAt(content, target)
      emitted.add(cid)
      output[cid] = content
      return cid
    },
    pending: (cid) => inProgress.has(cid),
    read: (cid) => (emitted.has(cid) ? output[cid] : undefined)
  }
  const plans = new Map<Migration, NodeUpgrade>()
  const planned = (step: Migration): NodeUpgrade => {
    let upgrade = plans.get(step)
    if (!upgrade) {
      if (!environment) throw new Error(`cid migration v${step.from}→v${step.to} needs the loading store (pass a MigrationEnvironment)`)
      upgrade = step.plan!(context, environment, tools)
      plans.set(step, upgrade)
    }
    return upgrade
  }

  const migrate = (cid: string): string => {
    const done = mapping[cid]
    if (done !== undefined) return done
    if (emitted.has(cid)) return cid
    const content = input[cid]
    if (!content) throw new MigrationError(`node ${cid} referenced but not present in the context`, cid)
    if (inProgress.has(cid)) throw new MigrationError(`cycle through node ${cid}`, cid)
    inProgress.add(cid)

    const version = cidVersion(cid)
    if (version === null) throw new MigrationError(`node ${cid} is not a recognised cid`, cid)
    if (version > target) throw new MigrationError(`node ${cid} is newer (v${version}) than the target format v${target}`, cid)
    fromVersions.add(version)

    let upgraded: FosNodeContent = content
    for (const step of stepsBetween(version, target)) {
      if (step.upgrade) upgraded = step.upgrade(upgraded)
      if (step.plan) upgraded = planned(step)(upgraded, cid)
    }
    const children: FosPathElem[] = upgraded.children.map(([instr, targetCid]) => [migrate(instr), migrate(targetCid)])
    const next: FosNodeContent = { ...upgraded, children }
    const unchanged = version === target && children.every((edge, i) => edge[0] === upgraded.children[i]?.[0] && edge[1] === upgraded.children[i]?.[1])
    const newCid = unchanged ? cid : hashContentAt(next, target)

    inProgress.delete(cid)
    mapping[cid] = newCid
    output[newCid] = unchanged ? content : next
    return newCid
  }

  for (const cid of Object.keys(input)) migrate(cid)

  const remapPath = (path: FosPath): FosPath => path.map(([a, b]) => [mapping[a] ?? a, mapping[b] ?? b])
  const changed: Record<string, string> = {}
  for (const [oldCid, newCid] of Object.entries(mapping)) if (oldCid !== newCid) changed[oldCid] = newCid

  return {
    context: {
      nodes: output,
      route: remapPath(context.route ?? []),
      rootNodeId: mapping[context.rootNodeId] ?? context.rootNodeId
    },
    mapping: changed,
    fromVersions: [...fromVersions].sort(),
    target
  }
}
