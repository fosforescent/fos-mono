import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'

async function run(request) {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./runner.mjs', import.meta.url))], { stdio: ['pipe','pipe','pipe'] })
  let stdout = ''; child.stdout.on('data', data => stdout += data)
  child.stdin.write(JSON.stringify(request) + '\n')
  const [code] = await once(child, 'close')
  return { code, stdout, events: stdout.trim().split('\n').map(line => JSON.parse(line)) }
}

test('runtime rejects an invalid provider without opening a terminal', async () => {
  const { code, events } = await run({ provider: 'invalid', cwd: '/tmp', prompt: 'test' })
  assert.equal(code, 0)
  assert.equal(events.at(-1).type, 'error')
  assert.match(events.at(-1).message, /Provider, directory, and task prompt are required/)
})

test('the node MCP server must be loopback and authenticated', async () => {
  const { stdout } = await run({ provider: 'claude', cwd: '/tmp', prompt: 'test', mcp: { url: 'http://evil.example/mcp', token: 'do-not-log' } })
  assert.match(stdout, /authenticated loopback endpoint/)
  assert(!stdout.includes('do-not-log'))
})
