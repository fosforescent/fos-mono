import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { loadConnection, forward, serverURL } from './fos-project/scripts/bridge.mjs';
import { connect } from './fos-project/scripts/connect.mjs';
const token = `header.${Buffer.from(JSON.stringify({ kind: 'peer', scope: ['project'] })).toString('base64url')}.signature`;

test('connection only accepts scoped peer credentials and safe destinations', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'fos-agent-test-')); t.after(() => rm(dir, { recursive: true }));
  const file = join(dir, 'agent.json');
  await writeFile(file, JSON.stringify({ server: 'https://api.example.test', jwt: token }));
  assert.equal((await loadConnection(file)).url, 'https://api.example.test/user/data/peer-sync/mcp');
  await writeFile(file, JSON.stringify({ server: 'https://api.example.test', jwt: 'header.e30.signature' }));
  await assert.rejects(loadConnection(file), /scoped/);
  for (const url of ['http://remote.test', 'https://user:pass@remote.test', 'https://remote.test?token=x', 'file:///tmp/secret']) assert.throws(() => serverURL(url));
  assert.equal(serverURL('http://127.0.0.1:3456'), 'http://127.0.0.1:3456');
});

test('bridge preserves IDs, notifications and errors without retrying writes or following redirects', async () => {
  let calls = 0;
  const config = { url: 'https://api.example.test/user/data/peer-sync/mcp', jwt: token };
  const message = { jsonrpc: '2.0', id: 0, method: 'tools/list' };
  const response = await forward(config, message, async (url, options) => {
    calls++; assert.equal(url, config.url); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.deepEqual(JSON.parse(options.body), message);
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 0, result: { tools: [] } }));
  });
  assert.equal(response.id, 0);
  assert.equal(await forward(config, { method: 'notifications/initialized' }, async () => new Response(null, { status: 202 })), null);
  await assert.rejects(forward(config, message, async () => { calls++; return new Response('private error data', { status: 409 }); }), /HTTP 409/);
  assert.equal(calls, 2);
});

test('invitation setup waits for owner approval, saves private file and refuses overwrite', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'fos-agent-test-')); t.after(() => rm(dir, { recursive: true }));
  const file = join(dir, 'agent.json'); let polls = 0;
  const fetcher = async (_url, options) => options.body
    ? new Response(JSON.stringify({ requestId: 'request' }))
    : new Response(JSON.stringify(++polls === 1 ? { status: 'pending' } : { status: 'approved', jwt: token, scope: ['project'] }));
  await connect({ server: 'https://api.example.test', token: 'fosinv_test', file, fetcher, wait: async () => {}, log: () => {} });
  assert.equal((JSON.parse(await readFile(file))).jwt, token);
  if (process.platform !== 'win32') assert.equal((await stat(file)).mode & 0o777, 0o600);
  await assert.rejects(connect({ server: 'https://api.example.test', token: 'fosinv_test', file, fetcher }), /EEXIST/);
});

test('real stdio subprocess forwards sequential MCP messages to HTTP', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'fos-agent-test-')); t.after(() => rm(dir, { recursive: true }));
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const message = JSON.parse(body); requests.push(message);
    if (!Object.hasOwn(message, 'id')) { res.writeHead(202); res.end(); return; }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { ok: true } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const file = join(dir, 'agent.json');
  await writeFile(file, JSON.stringify({ server: `http://127.0.0.1:${server.address().port}`, jwt: token }));
  const child = spawn(process.execPath, ['plugins/fos-project/scripts/bridge.mjs'], { env: { ...process.env, FOS_AGENT_CONNECTION: file }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => stdout += chunk); child.stderr.on('data', chunk => stderr += chunk);
  const messages = [{ jsonrpc: '2.0', id: 0, method: 'initialize' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 'read', method: 'tools/list' }];
  child.stdin.end(messages.map(m => JSON.stringify(m)).join('\n') + '\n');
  assert.equal(await new Promise(resolve => child.on('exit', resolve)), 0, stderr);
  assert.deepEqual(stdout.trim().split('\n').map(line => JSON.parse(line).id), [0, 'read']);
  assert.deepEqual(requests, messages);
  assert.equal(stderr, '');
});

test('denied invitations leave no unusable connection file behind', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'fos-agent-test-')); t.after(() => rm(dir, { recursive: true }));
  const file = join(dir, 'agent.json');
  await assert.rejects(connect({ server: 'https://api.example.test', token: 'fosinv_test', file, log: () => {}, wait: async () => {}, fetcher: async (_url, options) => new Response(JSON.stringify(options.body ? { requestId: 'request' } : { status: 'denied' })) }), /denied/);
  await assert.rejects(stat(file), /ENOENT/);
});
