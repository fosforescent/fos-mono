import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { posix, win32 } from 'node:path'

// The SDKs spawn an agent binary: Codex's and Claude Code's. Each SDK ships it as an optional platform package
// (hundreds of megabytes each), which the desktop bundle leaves out (`prepare:agents` installs without optional
// dependencies) in favour of the CLIs the user already has on PATH. When a platform package is present anyway
// (a developer's `npm install`), the SDK finds it on its own.

const require = createRequire(import.meta.url)
const TARGET_TRIPLE = {
  'win32-x64': 'x86_64-pc-windows-msvc', 'win32-arm64': 'aarch64-pc-windows-msvc',
  'darwin-x64': 'x86_64-apple-darwin', 'darwin-arm64': 'aarch64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-musl', 'linux-arm64': 'aarch64-unknown-linux-musl'
}
const INSTALL = {
  codex: 'Install the Codex CLI (npm install -g @openai/codex) so codex is on PATH, then restart Fos.',
  claude: 'Install Claude Code so claude is on PATH, then restart Fos.'
}

/** The SDK's own native binary package for this platform, when it is installed. */
export function bundledBinary(provider, { platform = process.platform, arch = process.arch, resolve = require.resolve } = {}) {
  const name = provider === 'codex' ? `@openai/codex-${platform}-${arch}` : `@anthropic-ai/claude-agent-sdk-${platform}-${arch}`
  try { return resolve(`${name}/package.json`) } catch { return null }
}

/** The first executable called `name` on PATH (Windows: with each PATHEXT extension), or null. */
export function findOnPath(name, { env = process.env, platform = process.platform, exists = existsSync } = {}) {
  const path = platform === 'win32' ? win32 : posix
  const dirs = (env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean)
  const extensions = platform === 'win32' ? (env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean).map(ext => ext.toLowerCase()) : ['']
  for (const dir of dirs) for (const ext of extensions) { const candidate = path.join(dir, name + ext); if (exists(candidate)) return candidate }
  return null
}

/**
 * An npm-installed CLI on Windows is a `.cmd` shim, which the SDKs cannot spawn directly: hand them what the shim
 * runs instead, the package entry beside it (Claude Code) or the native binary of its platform package (Codex).
 */
function unwrapShim(provider, found, { platform = process.platform, arch = process.arch, exists = existsSync } = {}) {
  if (!/\.(cmd|bat)$/i.test(found)) return found
  const path = platform === 'win32' ? win32 : posix, modules = path.join(path.dirname(found), 'node_modules')
  const target = provider === 'claude'
    ? path.join(modules, '@anthropic-ai', 'claude-code', 'cli.js')
    : path.join(modules, '@openai', `codex-${platform}-${arch}`, 'vendor', TARGET_TRIPLE[`${platform}-${arch}`] ?? '', 'bin', platform === 'win32' ? 'codex.exe' : 'codex')
  return exists(target) ? target : null
}

/** Where a provider's agent runs from: the SDK's bundled binary, else the CLI on PATH, else a diagnostic. */
export function locateExecutable(provider, deps = {}) {
  if (bundledBinary(provider, deps)) return { bundled: true, path: null, diagnostic: null }
  const found = findOnPath(provider, deps)
  const path = found ? unwrapShim(provider, found, deps) : null
  return { bundled: false, path, diagnostic: path ? null : INSTALL[provider] }
}

/** SDK options naming the executable to run: none when the SDK bundles its binary, the CLI on PATH otherwise. */
export function executableOptions(provider, deps = {}) {
  const located = locateExecutable(provider, deps)
  if (located.bundled) return {}
  if (!located.path) throw new Error(located.diagnostic)
  return provider === 'codex' ? { codexPathOverride: located.path } : { pathToClaudeCodeExecutable: located.path }
}
