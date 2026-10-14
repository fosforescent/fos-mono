/** A repository constructor is a named typed ref, not a separate row kind. */
import { argumentRefs } from './bindings'
import { addRefAt, headCid, type Replica } from './replica'
import { capabilityTarget, content, put, refValueCid, resolveScope, type Scope } from './graph'
export type RepositoryPull = { number: number; title: string; url: string; head: string; sha: string; base: string; headRepo: string; state: 'open' | 'closed' | 'merged' }
export type RepositorySnapshot = { repo: string; defaultBranch: string; canPush: boolean; branches: Array<{ name: string; sha: string }>; pulls: RepositoryPull[] }
export function repositoryAt(r: Replica, at: Scope): string | null {
  const cid = resolveScope(r.store, headCid(r), at)
  if (!cid) return null
  const type = capabilityTarget(r.store, 'repo')
  const values = argumentRefs(r.store, cid).filter(arg => arg.name === 'repo' && arg.type === type).map(arg => refValueCid(r.store, content(r.store, arg.cid))).filter((value): value is string => !!value)
  const names = [...new Set(values.map(value => content(r.store, value).data.description?.content ?? ''))]
  return names.length === 1 && /^[\w.-]+\/[\w.-]+$/.test(names[0]!) ? names[0]! : null
}
export function bindRepository(r: Replica, at: Scope, repo: string, now: number): Replica {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Repository must be owner/name')
  const existing = repositoryAt(r, at)
  if (existing && existing !== repo) throw new Error('This node already has a repository; edit its repo argument to change it')
  return addRefAt(r, at, 'fos:repo', capabilityTarget(r.store, 'repo'), now, put(r.store, { data: { description: { content: repo } }, children: [] }), 'repo')
}
