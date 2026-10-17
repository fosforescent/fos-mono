import { test } from 'node:test'
import assert from 'node:assert/strict'
import { probeAgents } from './availability.mjs'
const load = async () => ({ Codex: class {} })
const locate = () => ({ bundled: true, path: null, diagnostic: null })

test('reports absent credentials per provider without failing other SDKs', async () => {
  const result = await probeAgents({ env: {}, exists: () => false, load, locate })
  assert.equal(result.codex, false)
  assert.equal(result.claude, false)
  assert.match(result.diagnostics.codex, /codex login/)
  assert.match(result.diagnostics.claude, /ANTHROPIC_API_KEY/)
})
test('recognizes native Codex auth and explicit Claude cloud configuration', async () => {
  const result = await probeAgents({ env: { CODEX_HOME: '/custom', CLAUDE_CODE_USE_VERTEX: 'true' }, exists: path => path.replaceAll('\\', '/') === '/custom/auth.json', load, locate })
  assert.equal(result.codex, true)
  assert.equal(result.claude, true)
  const disabled = await probeAgents({ env: { CLAUDE_CODE_USE_BEDROCK: '0', CLAUDE_CODE_USE_VERTEX: 'false' }, exists: () => false, load, locate })
  assert.equal(disabled.claude, false)
})
test('API keys enable installed SDKs and never appear in results', async () => {
  const result = await probeAgents({ env: { CODEX_API_KEY: 'secret-openai', ANTHROPIC_API_KEY: 'secret-anthropic' }, exists: () => false, load, locate })
  assert.equal(result.codex, true)
  assert.equal(result.claude, true)
  assert(!JSON.stringify(result).includes('secret'))
})
test('missing SDK is actionable and isolated from a working provider', async () => {
  const result = await probeAgents({ env: { ANTHROPIC_API_KEY: 'secret' }, exists: () => false, load: async name => { if (name.includes('openai')) throw new Error('private environment details'); return {} }, locate })
  assert.equal(result.codex, false)
  assert.equal(result.claude, true)
  assert.match(result.diagnostics.codex, /prepare:agents/)
  assert(!JSON.stringify(result).includes('private environment'))
})
test('a provider whose agent binary is neither bundled nor on PATH says how to install it', async () => {
  const result = await probeAgents({ env: { ANTHROPIC_API_KEY: 'secret', CODEX_API_KEY: 'secret' }, exists: () => false, load, locate: provider => provider === 'codex' ? { bundled: false, path: null, diagnostic: 'Install the Codex CLI (npm install -g @openai/codex) so codex is on PATH, then restart Fos.' } : { bundled: false, path: '/usr/local/bin/claude', diagnostic: null } })
  assert.equal(result.codex, false); assert.match(result.diagnostics.codex, /npm install -g @openai\/codex/)
  assert.equal(result.claude, true)
})
