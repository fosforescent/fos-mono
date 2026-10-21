/** GitHub mediates repository state into ordinary Fos branches and merge requests.
 * No template, agent, deployment or continuation is selected here. */
import {
  branchSelection, content, createBranch, headCid, isBranchChoice, mergeBranch,
  readChoice, readNodeValue, repositoryAt, repositoryPeerAllows, resolveScope,
  selectBranch, setBranchMergeRequest, withBranches, writeNodeValue,
  loadReplica, serializeReplica, type RepositorySnapshot
} from '@fosforescent/shared/sync/index'
import type { HostHandler } from './registry'

type State = { repo: string; checked: number; branch?: string; snapshot: RepositorySnapshot; merged: string[] }
export type RepositoryLoadDeps = {
  connected(userId: number): Promise<boolean>
  snapshot(userId: number, repo: string, tracked: number[], branch?: string): Promise<RepositorySnapshot>
}

export function repositoryLoadHandler(deps: RepositoryLoadDeps): HostHandler {
  const checked = new Map<string, number>()
  return {
    peerId: 'integration:github', capability: 'repo', available: user => deps.connected(user),
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
      // Adapter state lives outside the project value: checking a PR must not change its main reference.
      const ancestorBranches = ctx.branches.filter(b => b.scope.length < path.length)
      const key = `fos:repository:${JSON.stringify([path, ancestorBranches])}`
      const stored = readNodeValue<State>(ctx.replica, [], key)
      const previous = stored?.repo === binding ? stored : null
      const selected = ctx.branches.find(b => JSON.stringify(b.scope) === JSON.stringify(path))?.name
      const cacheKey = JSON.stringify([userId, key, binding, selected])
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
        return writeNodeValue(r, [], key, { repo: binding, checked: now, branch: selected, snapshot: nextSnapshot, merged: [...merged] } satisfies State, now)
      })
    }
  }
}
