#!/usr/bin/env node
/** Thin stdio transport; all task semantics and authorization live on the Fos server. */
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const defaultConnection = () => process.env.FOS_AGENT_CONNECTION || join(homedir(), '.config', 'fos', 'agent.json');
export function serverURL(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Use an HTTPS Fos server URL (HTTP is allowed only on loopback).');
  return url.origin;
}
export async function loadConnection(file = defaultConnection()) {
  const config = JSON.parse(await readFile(file, 'utf8'));
  if (typeof config.jwt !== 'string' || !config.jwt) throw new Error('Connection has no peer token. Run connect.mjs.');
  // This is a usability guard, not authentication: the backend verifies the signature and live grant.
  let claims;
  try { claims = JSON.parse(Buffer.from(config.jwt.split('.')[1], 'base64url')); } catch { throw new Error('Invalid peer token.'); }
  if (claims.kind !== 'peer' || !Array.isArray(claims.scope)) throw new Error('Use a scoped agent connection, not the desktop account session.');
  return { url: `${serverURL(config.server)}/user/data/peer-sync/mcp`, jwt: config.jwt };
}
export async function forward(config, message, fetcher = fetch) {
  const response = await fetcher(config.url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(150000), headers: { Authorization: `Bearer ${config.jwt}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-03-26' }, body: JSON.stringify(message) });
  if (!response.ok) throw new Error(`Fos returned HTTP ${response.status}. For 401 reconnect; for 403 check the peer grant. A failed write may have completed: inspect the tree before retrying.`);
  if (response.status === 202 || response.status === 204) return null;
  return response.json();
}
export async function serve(input = process.stdin, output = process.stdout) {
  const config = await loadConnection();
  let buffer = '';
  input.setEncoding('utf8');
  for await (const chunk of input) {
    buffer += chunk;
    if (Buffer.byteLength(buffer) > 1024 * 1024) throw new Error('MCP input exceeds 1 MiB.');
    let boundary;
    while ((boundary = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 1);
      if (!line.trim()) continue;
      let message;
      try { message = JSON.parse(line); } catch { output.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } }) + '\n'); continue; }
      if (!message || Array.isArray(message) || typeof message !== 'object' || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
        output.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid JSON-RPC request' } }) + '\n'); continue;
      }
      try {
        const result = await forward(config, message);
        if (result && Object.hasOwn(message, 'id')) output.write(JSON.stringify(result) + '\n');
      } catch (error) {
        // Never print request bodies, credentials, or raw server error pages.
        if (Object.hasOwn(message, 'id')) output.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: error.message } }) + '\n');
      }
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) serve().catch(error => { process.stderr.write(`Fos MCP: ${error.message}\n`); process.exitCode = 1; });
