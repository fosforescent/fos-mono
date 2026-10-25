import { textOf, textValue } from './fields'
import { sameCapabilityType } from './capabilities'
/** A repository constructor is a named typed ref, not a separate row kind. */
import { contextMembers } from './handlers'
import { argumentRefs } from './bindings'
import { addRefAt, addMemberAt, setMemberCapabilitiesAt, headCid, type Replica } from './replica'
import { libAt, content, newId, put, refValueCid, resolveScope, enclosingScopes, nearestInScope, type Scope } from './graph'
import type { FosStore } from '../dag-implementation/store'
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
  const names = [...new Set(repoValues(r, cid, at).map(value => textOf(r.store, value) ?? '').filter(name => /^[\w.-]+\/[\w.-]+$/.test(name)))]
  return names.length === 1 ? names[0]! : null
}
/** The values of the node's repo arguments (rows of the repo capability). */
function repoValues(r: Replica, cid: string, at: Scope): string[] {
  return repoValuesIn(r.store, cid, libAt(r.store, at).capabilities.repo!)
}
function repoValuesIn(store: FosStore, cid: string, type: string): string[] {
  return argumentRefs(store, cid).filter(arg => sameCapabilityType(store, arg.type, type)).map(arg => refValueCid(store, content(store, arg.cid))).filter((value): value is string => !!value)
}
export type LocalRepository = { path: string; device: string; peer: string }
/** The local checkouts bound at the node `cid`: repo arguments whose value says which device's directory it is. */
function localRepositoriesIn(store: FosStore, cid: string, type: string): LocalRepository[] {
  return repoValuesIn(store, cid, type).flatMap(value => {
    const data = readGraphValue(store, value) as Partial<LocalRepository> | undefined
    return data && typeof data === 'object' && typeof data.path === 'string' && typeof data.device === 'string' ? [{ path: data.path, device: data.device, peer: typeof data.peer === 'string' ? data.peer : '' }] : []
  })
}
/** The local checkout bound at the node itself; two there are ambiguous. */
export function localRepositoryHere(r: Replica, at: Scope): LocalRepository | null {
  const cid = resolveScope(r.store, headCid(r), at)
  const found = cid ? localRepositoriesIn(r.store, cid, libAt(r.store, at).capabilities.repo!) : []
  if (found.length > 1) throw new Error('Ambiguous local repository in this scope.')
  return found[0] ?? null
}
/**
 * The local checkout bound nearest `at` (`nearestInScope`) and the node that binds it. A nearer binding for another
 * device hides an outer one for this device: whose checkout a subtree uses is the nearest binding's to say.
 */
export function localRepositoryAt(r: Replica, at: Scope): { repository: LocalRepository; scope: Scope } | null {
  const found = nearestInScope(enclosingScopes(r.store, headCid(r), at), scope => localRepositoriesIn(scope.store, scope.cid, libAt(scope.store, scope.path).capabilities.repo!), 'local repository')
  return found && found.store === r.store ? { repository: found.value, scope: found.path } : null
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
  r = addRefAt(r, at, newId(), libAt(r.store, at).capabilities.repo!, now, textValue(r.store, repo), 'repo')
  const peer = repositoryPeerId(repo)
  if (contextMembers(r, at).some(m => m.peerId === peer)) return r
  r = addMemberAt(r, at, peer, `GitHub: ${repo}`, ['repo'], now)
  return setMemberCapabilitiesAt(r, at, peer, ['repo'], [], now, ['repo'])
}
