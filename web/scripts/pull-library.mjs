// Refresh the standard library the build carries (`src/library.json`) through the fos CLI: `fos library export`
// signs in as you, pulls the shared library node through your account and writes it as rows, so every client has
// the live templates even if it never goes online. Without the CLI (CI, a machine without `fos`) or without a
// session, the committed file is kept; the app falls back to its in-code seed list when the file is empty.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const target = resolve(here, '../src/library.json')
const fos = process.env.FOS_BIN || 'fos'

const current = () => { try { const bundle = JSON.parse(readFileSync(target, 'utf8')); return `${bundle.rows?.length ?? 0} rows${bundle.address ? ` from @${bundle.address.owner}` : ''}` } catch { return 'no file' } }
const keep = (reason) => console.log(`[library] ${reason}; keeping src/library.json (${current()})`)

if (process.env.FOS_LIBRARY_PULL === '0') { keep('FOS_LIBRARY_PULL=0'); process.exit(0) }
const result = spawnSync(fos, ['library', 'export', '--out', target], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' })
if (result.error) { keep(`${fos} is not available (${result.error.code ?? result.error.message})`); process.exit(0) }
if (result.status !== 0) { keep(`${fos} library export failed: ${(result.stderr || result.stdout || '').trim().split('\n').pop()}`); process.exit(0) }
if (!existsSync(target)) { keep('the CLI wrote nothing'); process.exit(0) }
console.log(`[library] ${(result.stdout || '').trim() || `refreshed src/library.json (${current()})`}`)
