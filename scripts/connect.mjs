#!/usr/bin/env node
/** Claim an existing node invitation; the owner approves through the ordinary Fos UI. */
import { randomUUID } from 'node:crypto';
import { mkdir, open, lstat, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stderr } from 'node:process';
import { pathToFileURL } from 'node:url';
import { defaultConnection, serverURL } from './bridge.mjs';
export async function connect({ server, token, name = 'Project coding agent', file = defaultConnection(), fetcher = fetch, wait = ms => new Promise(r => setTimeout(r, ms)), log = message => stderr.write(message + '\n') }) {
  server = serverURL(server);
  const peerId = `agent:${randomUUID()}`;
  const request = async (path, body) => {
    const response = await fetcher(server + path, { redirect: 'error', signal: AbortSignal.timeout(30000), ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error(`Connection returned HTTP ${response.status}.`);
    return response.json();
  };
  // Reserve the destination before claiming an invite; never overwrite another attachment or follow a symlink.
  file = resolve(file); await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const handle = await open(file, 'wx', 0o600);
  let saved = false;
  const created = await handle.stat();
  try {
    const pending = await request('/peer/connect', { token, peerId, name });
    if (typeof pending.requestId !== 'string') throw new Error('Server did not return a connection request.');
    log(`Approve “${name}” in Fos on the invited node. Waiting up to 10 minutes.`);
    for (let attempt = 0; attempt < 200; attempt++) {
      await wait(3000);
      const result = await request(`/peer/connect/${encodeURIComponent(pending.requestId)}?peerId=${encodeURIComponent(peerId)}`);
      if (result.status === 'approved' && typeof result.jwt === 'string') {
        await handle.writeFile(JSON.stringify({ server, jwt: result.jwt, peerId, scope: result.scope }, null, 2) + '\n');
        saved = true;
        log(`Saved scoped connection to ${file}. Set FOS_AGENT_CONNECTION to this path for the client. Tokens are never stored in the plugin package.`);
        return file;
      }
      if (result.status !== 'pending') throw new Error(`Connection ${result.status}. Create a new invite and retry.`);
    }
    throw new Error('Approval timed out. Create a new invite and retry.');
  } finally {
    await handle.close();
    if (!saved) {
      const current = await lstat(file).catch(() => null);
      if (current?.ino === created.ino && current?.dev === created.dev) await unlink(file);
    }
  }
}
async function main() {
  const server = process.argv[2] || 'https://api.fosforescent.com', file = process.argv[3] || defaultConnection();
  const rl = createInterface({ input: stdin, output: stderr });
  try { const token = await rl.question('Paste the short-lived node invite token: '); await connect({ server, file, token: token.trim() }); }
  finally { rl.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { stderr.write(error.message + '\n'); process.exitCode = 1; });
