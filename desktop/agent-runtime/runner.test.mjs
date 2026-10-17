import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'

test('runtime rejects invalid provider without starting an SDK', async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./runner.mjs', import.meta.url))], { stdio: ['pipe','pipe','pipe'] })
  let stdout = ''; child.stdout.on('data', data => stdout += data)
  child.stdin.write(JSON.stringify({ provider: 'invalid', cwd: '/tmp', prompt: 'test' }) + '\n')
  const [code] = await once(child, 'close')
  assert.equal(code, 0)
  const events = stdout.trim().split('\n').map(line => JSON.parse(line))
  assert.equal(events.at(-1).type, 'error')
  assert.match(events.at(-1).message, /Provider, repository, and task prompt are required/)
})

test('installed SDK probe returns configuration diagnostics without model calls', async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./runner.mjs', import.meta.url))], { stdio: ['pipe', 'pipe', 'pipe'] })
  let stdout = ''; child.stdout.on('data', data => stdout += data)
  child.stdin.write(JSON.stringify({ probe: true }) + '\n')
  const [code] = await once(child, 'close')
  assert.equal(code, 0)
  const event = JSON.parse(stdout.trim())
  assert.equal(event.type, 'availability')
  assert.equal(typeof event.codex, 'boolean')
  assert.equal(typeof event.claude, 'boolean')
  for (const provider of ['codex', 'claude']) if (!event[provider]) assert.equal(typeof event.diagnostics[provider], 'string')
})

test('evaluation delegation rejects non-loopback MCP before loading an SDK', async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./runner.mjs', import.meta.url))], { stdio: ['pipe','pipe','pipe'] })
  let stdout = ''; child.stdout.on('data', data => stdout += data)
  child.stdin.write(JSON.stringify({ provider: 'codex', cwd: '/tmp', prompt: 'test', evaluation: { url: 'https://example.com/mcp', token: 'do-not-log' } }) + '\n')
  await once(child, 'close')
  assert.match(stdout, /authenticated loopback endpoint/)
  assert(!stdout.includes('do-not-log'))
})

test('the node MCP server must be loopback and authenticated', async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./runner.mjs', import.meta.url))], { stdio: ['pipe','pipe','pipe'] })
  let stdout = ''; child.stdout.on('data', data => stdout += data)
  child.stdin.write(JSON.stringify({ provider: 'claude', cli: true, cwd: '/tmp', prompt: 'test', mcp: { url: 'http://evil.example/mcp', token: 'do-not-log' } }) + '\n')
  await once(child, 'close')
  assert.match(stdout, /authenticated loopback endpoint/)
  assert(!stdout.includes('do-not-log'))
})

test('CLI cannot be handed a writable evaluation endpoint', async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./runner.mjs', import.meta.url))], { stdio: ['pipe','pipe','pipe'] })
  let stdout = ''; child.stdout.on('data', data => stdout += data)
  child.stdin.write(JSON.stringify({ provider: 'codex', cli:true, cwd: '/tmp', prompt: 'test', evaluation: { url: 'http://127.0.0.1:123/mcp', token: 'do-not-log' } }) + '\n')
  await once(child, 'close')
  assert.match(stdout, /read-only node context/)
  assert(!stdout.includes('do-not-log'))
})
