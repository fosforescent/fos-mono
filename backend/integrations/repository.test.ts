import { githubRepository } from './repository'
import type { IntegrationDeps } from './routes'

const pr = { number: 7, title: 'Feature', html_url: 'https://github.com/acme/project/pull/7', state: 'open', merged_at: null, head: { ref: 'feature', sha: 'a'.repeat(40), repo: { full_name: 'acme/project' } }, base: { ref: 'main' } }
function fixture(answer: (path: string, init: Parameters<IntegrationDeps['fetch']>[1]) => unknown) {
  const calls: Array<{ path: string; method: string; body?: string }> = []
  const fetch: IntegrationDeps['fetch'] = async (url, init) => {
    expect(init?.headers?.Authorization).toBe('Bearer secret')
    const path = url.replace('https://api.github.com/repos/acme/project', '')
    calls.push({ path, method: init?.method ?? 'GET', body: init?.body })
    const json = answer(path, init)
    return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) }
  }
  return { api: githubRepository(fetch, 'secret', 'acme/project'), calls }
}

test('paginates branches, projects PRs and detects a tracked PR merged externally', async () => {
  const { api, calls } = fixture(path => {
    if (!path) return { default_branch: 'main', permissions: { push: false } }
    if (path.startsWith('/branches')) return path.endsWith('page=1') ? Array.from({ length: 100 }, (_, i) => ({ name: `b${i}`, commit: { sha: String(i) } })) : [{ name: 'last', commit: { sha: 'last' } }]
    if (path.startsWith('/pulls?')) return []
    if (path === '/pulls/7') return { ...pr, state: 'closed', merged_at: '2026-01-01' }
    throw new Error(`Unexpected ${path}`)
  })
  const result = await api.snapshot([7])
  expect(result.branches).toHaveLength(101)
  expect(result.canPush).toBe(false)
  expect(result.pulls).toEqual([expect.objectContaining({ number: 7, head: 'feature', base: 'main', state: 'merged' })])
  expect(calls.some(c => c.path.includes('page=2'))).toBe(true)
})

test('propose is idempotent and merge pins the reviewed head SHA', async () => {
  const { api, calls } = fixture(path => path.endsWith('/merge') ? { merged: true } : [pr])
  expect((await api.propose('feature', 'main', 'Feature')).number).toBe(7)
  expect(calls).toHaveLength(1)
  expect(calls[0]!.method).toBe('GET')
  await api.decide(7, 'merge', pr.head.sha)
  expect(JSON.parse(calls.at(-1)!.body!)).toEqual({ sha: pr.head.sha })
  await expect(api.decide(7, 'merge', '')).rejects.toThrow('SHA')
})

test('creates a branch from the chosen source and refuses a failed merge', async () => {
  const { api, calls } = fixture(path => path.startsWith('/git/ref/') ? { object: { sha: pr.head.sha } } : path.endsWith('/merge') ? { merged: false, message: 'Required checks pending' } : {})
  await api.createBranch('next', 'feature/nested')
  expect(calls[0]!.path).toBe('/git/ref/heads/feature%2Fnested')
  expect(JSON.parse(calls[1]!.body!)).toEqual({ ref: 'refs/heads/next', sha: pr.head.sha })
  await expect(api.decide(7, 'merge', pr.head.sha)).rejects.toThrow('Required checks pending')
})
