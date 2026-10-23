import { standardHostRef } from './host-runtime'
import { handlerOfferId } from '@fosforescent/shared/sync/index'
/** GitHub mediates repository state into ordinary Fos branches and merge requests.
 * No template, agent, deployment or continuation is selected here. */
import {
  branchSelection, content, createBranch, headCid, isBranchChoice, mergeBranch,
  readChoice, handlerResult, writeHandlerResult, membershipIdOf, repositoryPeerId, withMainBranchPolicy, repositoryAt, repositoryPeerAllows, resolveScope,
  selectBranch, setBranchMergeRequest, withBranches,
  loadReplica, serializeReplica, readMembers, type RepositorySnapshot, type Replica, type Scope
} from '@fosforescent/shared/sync/index'
import type { HostHandler } from './host-runtime'

type State = { repo: string; checked: number; branch?: string; snapshot: RepositorySnapshot; merged: string[] }
/** The repository peer's member entry nearest the node (it is a member there or above), read on main. */
function repositoryEntry(r: Replica, path: Scope, peer: string): Scope | null {
  return withMainBranchPolicy(r.store, () => {
    for (let i = path.length; i >= 0; i--) {
      const cid = resolveScope(r.store, headCid(r), path.slice(0, i))
      const id = cid && membershipIdOf(r.store, cid, peer)
      if (id) return [...path.slice(0, i), id]
    }
    return null
  })
}
export type RepositoryLoadDeps = {
  connected(userId: number): Promise<boolean>
  snapshot(userId: number, repo: string, tracked: number[], branch?: string): Promise<RepositorySnapshot>
}

export function repositoryLoadHandler(deps: RepositoryLoadDeps): HostHandler {
  const checked = new Map<string, number>()
  return {
    peerId: 'integration:github', ref: standardHostRef('integration:github', 'repo', handlerOfferId('integration:github', 'repo', 'load')), available: user => deps.connected(user),
    async load(ctx) {
      const { path, now, userId } = ctx
      if (!path.length) return ctx.replica
      // Resolve the node in its requested branch, not whichever branch was last displayed by the server.
      const selections = Object.fromEntries(ctx.branches.map(b => [b.scope.at(-1)!, b.name]))
      const binding = withBranches(ctx.replica.store, selections, () => {
        const repo = repositoryAt(ctx.replica, path)
        return repo && repositoryPeerAllows(ctx.replica, path, repo, 'pull') ? repo : null
      })
      if (!binding || !await deps.connected(userId)) return ctx.replica
      // Adapter state lives outside the project value (checking a PR must not change its main reference): it is
      // the GitHub peer's, on its member entry of the project, one record per branch context
      const ancestorBranches = ctx.branches.filter(b => b.scope.length < path.length)
      const key = JSON.stringify([path, ancestorBranches]), entry = repositoryEntry(ctx.replica, path, repositoryPeerId(binding))
      const states = (entry && withMainBranchPolicy(ctx.replica.store, () => handlerResult<Record<string, State>>(ctx.replica, entry))) || {}
      const stored = states[key] ?? null
      const previous = stored?.repo === binding ? stored : null
      const selected = ctx.branches.find(b => JSON.stringify(b.scope) === JSON.stringify(path))?.name
      const cacheKey = JSON.stringify([userId, path, key, binding, selected])
      const lastCheck = checked.get(cacheKey) ?? (previous && previous.branch === selected ? previous.checked : undefined)
      if (lastCheck !== undefined && now >= lastCheck && now - lastCheck < 30_000) return ctx.replica
      const snapshot = await deps.snapshot(userId, binding, previous?.snapshot.pulls.filter(p => p.state === 'open').map(p => p.number) ?? [], selected)
      if (snapshot.repo.toLowerCase() !== binding.toLowerCase()) throw new Error('Repository response does not match the bound node.')
      if (checked.size > 5000) checked.clear()
      checked.set(cacheKey, now)
      // Work on an isolated replica so a failed refresh cannot leave half a merge in the account.
      let r = loadReplica(serializeReplica(ctx.replica))
      const id = path.at(-1)!, ancestors = Object.fromEntries(ancestorBranches.map(b => [b.scope.at(-1)!, b.name]))
      return withBranches(r.store, ancestors, () => {
        const cid = resolveScope(r.store, headCid(r), path)
        if (!cid) return ctx.replica
        const priorSelection = branchSelection(r.store, cid)
        const names = () => {
          const node = resolveScope(r.store, headCid(r), path)!
          return isBranchChoice(r.store, content(r.store, node)) ? readChoice(r.store, node).options.map(o => o.peerId) : [snapshot.defaultBranch]
        }
        const existing = new Set(names())
        for (const branch of snapshot.branches) {
          if (names().includes(branch.name)) continue
          selectBranch(r.store, id, snapshot.defaultBranch)
          r = createBranch(r, path, branch.name, now, snapshot.defaultBranch)
        }
        const merged = new Set(previous?.merged ?? [])
        const pulls = [...snapshot.pulls, ...(previous?.snapshot.pulls ?? []).filter(p => p.state !== 'open' && !snapshot.pulls.some(n => n.number === p.number))]
        for (const pull of snapshot.pulls) {
          if (pull.headRepo.toLowerCase() !== binding.toLowerCase() || !names().includes(pull.head)) continue
          const node = resolveScope(r.store, headCid(r), path)!
          if (!isBranchChoice(r.store, content(r.store, node))) continue
          const record = readChoice(r.store, node), option = record.options.find(o => o.peerId === pull.head)!
          const receipt = `${pull.number}:${pull.sha}`
          // Only branches already present in Fos have graph work to merge. Never fabricate a source from main.
          if (pull.state === 'merged' && !merged.has(receipt) && existing.has(pull.head) && names().includes(pull.base)) {
            r = mergeBranch(r, path, pull.head, pull.base, now, option)
            merged.add(receipt)
          }
          if (!!option.requestMerge !== (pull.state === 'open')) r = setBranchMergeRequest(r, path, pull.head, pull.state === 'open', now)
        }
        selectBranch(r.store, id, priorSelection)
        const nextSnapshot = { ...snapshot, pulls }
        // Polling unchanged external data must not create endless graph history.
        if (previous && JSON.stringify(previous.snapshot) === JSON.stringify(nextSnapshot) && JSON.stringify(previous.merged) === JSON.stringify([...merged]) && headCid(r) === headCid(ctx.replica)) return ctx.replica
        if (!entry) return r
        return withMainBranchPolicy(r.store, () => writeHandlerResult(r, entry, { ...states, [key]: { repo: binding, checked: now, branch: selected, snapshot: nextSnapshot, merged: [...merged] } satisfies State }, now))
      })
    }
  }
}
