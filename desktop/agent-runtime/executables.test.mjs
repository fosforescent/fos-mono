import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundledBinary, executableOptions, findOnPath, locateExecutable } from './executables.mjs'

const missing = () => { throw new Error('Cannot find module') }
const files = (...paths) => candidate => paths.map(p => p.replaceAll('\\', '/')).includes(candidate.replaceAll('\\', '/'))

test('bundled platform packages are used when installed, without naming an executable', () => {
  assert.equal(bundledBinary('codex', { platform: 'linux', arch: 'x64', resolve: name => { assert.equal(name, '@openai/codex-linux-x64/package.json'); return '/sdk/package.json' } }), '/sdk/package.json')
  assert.deepEqual(executableOptions('claude', { platform: 'darwin', arch: 'arm64', resolve: name => { assert.match(name, /claude-agent-sdk-darwin-arm64/); return '/pkg.json' } }), {})
})
test('finds CLIs on PATH, honouring PATHEXT on Windows', () => {
  assert.equal(findOnPath('codex', { platform: 'linux', env: { PATH: '/usr/bin:/home/me/.local/bin' }, exists: files('/home/me/.local/bin/codex') }), '/home/me/.local/bin/codex')
  assert.equal(findOnPath('claude', { platform: 'win32', env: { PATH: 'C:\\tools;C:\\Users\\me\\.local\\bin', PATHEXT: '.EXE;.CMD' }, exists: files('C:/Users/me/.local/bin/claude.exe') }), 'C:\\Users\\me\\.local\\bin\\claude.exe')
  assert.equal(findOnPath('claude', { platform: 'linux', env: { PATH: '/usr/bin' }, exists: () => false }), null)
})
test('npm .cmd shims resolve to what they run, since the SDKs spawn the path directly', () => {
  const npm = 'C:\\Users\\me\\AppData\\Roaming\\npm'
  const claude = locateExecutable('claude', { platform: 'win32', arch: 'x64', resolve: missing, env: { PATH: npm, PATHEXT: '.EXE;.CMD' }, exists: files(`${npm}\\claude.cmd`, `${npm}\\node_modules\\@anthropic-ai\\claude-code\\cli.js`) })
  assert.equal(claude.path, `${npm}\\node_modules\\@anthropic-ai\\claude-code\\cli.js`)
  const codex = locateExecutable('codex', { platform: 'win32', arch: 'x64', resolve: missing, env: { PATH: npm, PATHEXT: '.EXE;.CMD' }, exists: files(`${npm}\\codex.cmd`, `${npm}\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe`) })
  assert.equal(codex.path, `${npm}\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe`)
  assert.deepEqual(executableOptions('codex', { platform: 'linux', arch: 'x64', resolve: missing, env: { PATH: '/usr/local/bin' }, exists: files('/usr/local/bin/codex') }), { codexPathOverride: '/usr/local/bin/codex' })
  assert.deepEqual(executableOptions('claude', { platform: 'linux', arch: 'x64', resolve: missing, env: { PATH: '/usr/local/bin' }, exists: files('/usr/local/bin/claude') }), { pathToClaudeCodeExecutable: '/usr/local/bin/claude' })
})
test('neither bundled nor on PATH is an actionable install message', () => {
  const located = locateExecutable('codex', { platform: 'linux', arch: 'x64', resolve: missing, env: { PATH: '/usr/bin' }, exists: () => false })
  assert.equal(located.path, null); assert.match(located.diagnostic, /npm install -g @openai\/codex/)
  assert.throws(() => executableOptions('claude', { platform: 'linux', arch: 'x64', resolve: missing, env: { PATH: '/usr/bin' }, exists: () => false }), /Install Claude Code/)
})
