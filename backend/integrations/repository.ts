/** GitHub's branch/PR adapter. Credentials stay in the existing OAuth store. */
import type { IntegrationDeps } from './routes'
import type { RepositorySnapshot, RepositoryPull } from '../../shared/sync/repository'

type Pull = { number: number; title: string; html_url: string; state: string; merged_at: string | null; head: { ref: string; sha: string; repo: { full_name: string } | null }; base: { ref: string } }
export function githubRepository(fetch: IntegrationDeps['fetch'], token: string, repo: string) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Repository must be owner/name')
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'fosforescent' }
  async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(`https://api.github.com/repos/${repo}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) })
    const data = await response.json()
    if (!response.ok) throw new Error(`GitHub: ${(data as { message?: string }).message ?? response.status}`)
    return data as T
  }
  async function pages<T>(path: string): Promise<T[]> {
    const out: T[] = []
    for (let page = 1; page <= 50; page++) {
      const batch = await request<T[]>(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`)
      if (!Array.isArray(batch)) throw new Error('GitHub returned an invalid list')
      out.push(...batch)
      if (batch.length < 100) return out
    }
    throw new Error('Repository listing exceeds 5,000 entries; narrow the repository')
  }
  const pull = (p: Pull): RepositoryPull => ({ number: p.number, title: p.title, url: p.html_url, head: p.head.ref, sha: p.head.sha, base: p.base.ref, headRepo: p.head.repo?.full_name ?? '', state: p.merged_at ? 'merged' : p.state === 'open' ? 'open' : 'closed' })
  return {
    async deployment(branch: string, environment: string): Promise<{ sha: string; ready: boolean }> {
      if (!branch || !environment || branch.length > 200 || environment.length > 200) throw new Error('Branch and deployment environment are required')
      const ref = await request<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(branch)}`)
      const sha = ref.object.sha
      if (!/^[a-f0-9]{40,64}$/.test(sha)) throw new Error('GitHub returned an invalid commit')
      const deployments = await request<Array<{ id: number; sha: string; environment: string }>>(`/deployments?sha=${sha}&environment=${encodeURIComponent(environment)}&per_page=100`)
      const deployment = deployments.filter(d => d.sha === sha && d.environment === environment).sort((a, b) => b.id - a.id)[0]
      if (!deployment) return { sha, ready: false }
      const statuses = await request<Array<{ state: string }>>(`/deployments/${deployment.id}/statuses?per_page=1`)
      return { sha, ready: statuses[0]?.state === 'success' }
    },
    async createBranch(name: string, from: string): Promise<void> {
      if (!name || !from || name.length > 200 || from.length > 200) throw new Error('Branch names are required')
      const source = await request<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(from)}`)
      await request('/git/refs', 'POST', { ref: `refs/heads/${name}`, sha: source.object.sha })
    },
    async snapshot(tracked: number[] = [], branch?: string): Promise<RepositorySnapshot> {
      const [info, branches, open] = await Promise.all([
        request<{ default_branch: string; permissions?: { push?: boolean } }>(''),
        pages<{ name: string; commit: { sha: string } }>('/branches'),
        pages<Pull>('/pulls?state=open')
      ])
      // Keep all open approvals visible while also discovering a PR that was merged
      // before the selected Fos branch was loaded for the first time.
      if (branch) {
        for (const p of await pages<Pull>(`/pulls?state=all&head=${encodeURIComponent(repo.split('/')[0] + ':' + branch)}`)) {
          if (!open.some(existing => existing.number === p.number)) open.push(p)
        }
      }
      const missing = [...new Set(tracked)].filter(number => !open.some(p => p.number === number))
      const closed: Pull[] = []
      for (const number of missing) closed.push(await request<Pull>(`/pulls/${number}`))
      return { repo, defaultBranch: info.default_branch, canPush: info.permissions?.push === true, branches: branches.map(b => ({ name: b.name, sha: b.commit.sha })), pulls: [...open, ...closed].map(pull) }
    },
    async propose(head: string, base: string, title: string): Promise<RepositoryPull> {
      if (!head || !base || head === base || head.length > 200 || base.length > 200) throw new Error('Select different source and target branches')
      // Reuse an existing PR after a retry or a lost response.
      const existing = await pages<Pull>(`/pulls?state=open&head=${encodeURIComponent(repo.split('/')[0] + ':' + head)}&base=${encodeURIComponent(base)}`)
      if (existing.length) return pull(existing[0]!)
      return pull(await request<Pull>('/pulls', 'POST', { head, base, title: title.trim().slice(0, 256) || `Merge ${head} into ${base}`, body: 'Proposed from Fos.' }))
    },
    async decide(number: number, decision: 'merge' | 'close', sha: string): Promise<void> {
      if (!Number.isSafeInteger(number) || number <= 0) throw new Error('Invalid pull request number')
      if (decision === 'close') { await request(`/pulls/${number}`, 'PATCH', { state: 'closed' }); return }
      if (!/^[a-f0-9]{40,64}$/.test(sha)) throw new Error('Pull request head SHA required')
      const result = await request<{ merged: boolean; message?: string }>(`/pulls/${number}/merge`, 'PUT', { sha })
      if (!result.merged) throw new Error(result.message ?? 'GitHub did not merge the pull request')
    }
  }
}
