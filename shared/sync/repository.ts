import { sameCapabilityType } from './capabilities'
/** A repository constructor is a named typed ref, not a separate row kind. */
import { contextMembers } from './handlers'
import { argumentRefs } from './bindings'
import { addRefAt, addMemberAt, setMemberCapabilitiesAt, headCid, type Replica } from './replica'
import { libAt, content, newId, put, refValueCid, resolveScope, type Scope } from './graph'
import { constructNodeValue, readGraphValue } from './node-values'
export type RepositoryPull = { number: number; title: string; url: string; head: string; sha: string; base: string; headRepo: string; state: 'open' | 'closed' | 'merged' }
export type RepositorySnapshot = { repo: string; defaultBranch: string; canPush: boolean; branches: Array<{ name: string; sha: string }>; pulls: RepositoryPull[] }
/** Repository identity is independent of the account used to authenticate GitHub. */
export function repositoryPeerId(repo: string): string { return `github:${repo.toLowerCase()}` }
export function repositoryPeerAllows(r: Replica, at: Scope, repo: string, direction: 'pull' | 'push'): boolean {
  const member = contextMembers(r, at).find(m => m.peerId === repositoryPeerId(repo))
  return !!member && !member.disabled?.includes('repo') && (direction === 'pull' ? member.accepts ?? [] : member.capabilities).includes('repo')
}
export function repositoryAt(r: Replica, at: Scope): string | null {
  const cid = resolveScope(r.store, headCid(r), at)
  if (!cid) return null
  // the node's repo bindings: arguments of the repo capability; a GitHub repository's value is its owner/name
  const names = [...new Set(repoValues(r, cid, at).map(value => content(r.store, value).data.description?.content ?? '').filter(name => /^[\w.-]+\/[\w.-]+$/.test(name)))]
  return names.length === 1 ? names[0]! : null
}
/** The values of the node's repo arguments (rows of the repo capability). */
function repoValues(r: Replica, cid: string, at: Scope): string[] {
  const type = libAt(r.store, at).capabilities.repo!
  return argumentRefs(r.store, cid).filter(arg => sameCapabilityType(r.store, arg.type, type)).map(arg => refValueCid(r.store, content(r.store, arg.cid))).filter((value): value is string => !!value)
}
export type LocalRepository = { path: string; device: string; peer: string }
/** A local checkout bound at the node: a repo argument whose value says which device's directory it is. */
export function localRepositoryHere(r: Replica, at: Scope): LocalRepository | null {
  const cid = resolveScope(r.store, headCid(r), at)
  for (const value of cid ? repoValues(r, cid, at) : []) {
    const data = readGraphValue(r.store, value) as Partial<LocalRepository> | undefined
    if (data && typeof data === 'object' && typeof data.path === 'string' && typeof data.device === 'string') return { path: data.path, device: data.device, peer: typeof data.peer === 'string' ? data.peer : '' }
  }
  return null
}
/** Bind a local checkout at the node: a repo argument whose value is the directory, the device and its Git peer. */
export function bindLocalRepository(r: Replica, at: Scope, local: LocalRepository, now: number): Replica {
  if (localRepositoryHere(r, at)) throw new Error('This node already has a local repository; edit its argument to change the path.')
  const built = constructNodeValue(r.store, local, newId())
  const value = put(r.store, { ...content(r.store, built.cid), data: { ...content(r.store, built.cid).data, peerId: { content: local.peer } } })
  return addRefAt(r, at, newId(), libAt(r.store, at).capabilities.repo!, now, value)
}
export function bindRepository(r: Replica, at: Scope, repo: string, now: number): Replica {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Repository must be owner/name')
  const existing = repositoryAt(r, at)
  if (existing && existing !== repo) throw new Error('This node already has a repository; edit its repo argument to change it')
  r = addRefAt(r, at, newId(), libAt(r.store, at).capabilities.repo!, now, put(r.store, { data: { description: { content: repo } }, children: [] }), 'repo')
  const peer = repositoryPeerId(repo)
  if (contextMembers(r, at).some(m => m.peerId === peer)) return r
  r = addMemberAt(r, at, peer, `GitHub: ${repo}`, ['repo'], now)
  return setMemberCapabilitiesAt(r, at, peer, ['repo'], [], now, ['repo'])
}
