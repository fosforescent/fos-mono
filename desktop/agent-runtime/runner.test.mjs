import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

test('runtime rejects invalid provider without starting an SDK', async () => {
  const child = spawn(process.execPath, [new URL('./runner.mjs', import.meta.url).pathname], { stdio: ['pipe','pipe','pipe'] })
  let stdout = ''; child.stdout.on('data', data => stdout += data)
  child.stdin.write(JSON.stringify({ provider: 'invalid', cwd: '/tmp', prompt: 'test' }) + '\n')
  const [code] = await once(child, 'close')
  assert.equal(code, 0)
  const events = stdout.trim().split('\n').map(line => JSON.parse(line))
  assert.equal(events.at(-1).type, 'error')
  assert.match(events.at(-1).message, /Provider, repository, and task prompt are required/)
})
