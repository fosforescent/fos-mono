import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function cliArguments(provider, context, { chrome = false, verify = false } = {}) {
  if (provider === 'codex') return ['--sandbox', verify ? 'read-only' : 'workspace-write', '--ask-for-approval', 'on-request', '-c', `mcp_servers.fos.url='${context.url}'`, '-c', "mcp_servers.fos.bearer_token_env_var='FOS_CONTEXT_TOKEN'"]
  if (provider === 'claude') return ['--permission-mode', 'default', '--mcp-config', context.config, ...(chrome ? ['--chrome'] : [])]
  throw new Error('Unsupported CLI provider')
}
/** User-visible CLI, using its own login and approvals. No model SDK is loaded. */
export async function launchCli(request, context, signal, emit) {
  const dir = await mkdtemp(join(tmpdir(), 'fos-cli-')), result = join(dir, 'exit.txt')
  let child
  try {
    const config = join(dir, 'mcp.json')
    await writeFile(config, JSON.stringify({ mcpServers: { fos: { type: 'http', url: context.url, headers: { Authorization: `Bearer ${context.token}` } } } }), { mode: 0o600 })
    const args = cliArguments(request.provider, { ...context, config }, request)
    const prompt = request.mcp
      ? `The fos MCP server is the selected node on the user's device, exposing only the tools the user granted (read, propose changes, decide, evaluate). Start with fos_read at []. Carry out the task and record the outcome on the node through those tools.\n\n${request.prompt}`
      : `The fos MCP server is a read-only snapshot of the selected node. Start with fos_read at []. Do not modify .fos graph or specification files. ${request.verify ? 'Verify only; do not change implementation files. Report failed and blocked checks with evidence.' : 'Implement the task in this working directory.'}\n\n${request.prompt}`
    const launch = join(dir, 'launch.json')
    await writeFile(launch, JSON.stringify({ command: request.provider, args, prompt, result, pid: join(dir, 'pid.txt') }), { mode: 0o600 })
    const env = { ...process.env, FOS_CONTEXT_TOKEN: context.token }
    if (process.platform === 'win32') {
      const script = join(dir, 'launch.ps1')
      // Arguments are data loaded from JSON, never interpolated into shell source.
      await writeFile(script, `$ErrorActionPreference = 'Stop'\n$config = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'launch.json') | ConvertFrom-Json\ntry { $cliArgs = @($config.args) + @($config.prompt); & $config.command @cliArgs; $code = $LASTEXITCODE } catch { Write-Error $_; $code = 1 } finally { if ($null -eq $code) { $code = 1 }; [IO.File]::WriteAllText($config.result, [string]$code) }\n`)
      child = spawn('powershell.exe', ['-NoProfile', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', script], { cwd: request.cwd, env, detached: true, windowsHide: false, stdio: 'ignore' })
    } else {
      // A fixed Node wrapper preserves argv exactly, including prompts and paths.
      const wrapper = join(dir, 'launch.mjs')
      await writeFile(wrapper, `import {readFileSync,writeFileSync} from 'node:fs'; import {spawn} from 'node:child_process'; const c=JSON.parse(readFileSync(new URL('./launch.json',import.meta.url))); writeFileSync(c.pid,String(process.pid)); const p=spawn(c.command,[...c.args,c.prompt],{stdio:'inherit',detached:true}); process.on('SIGTERM',()=>{try{process.kill(-p.pid,'SIGTERM')}catch{};process.exit(1)}); p.on('error',e=>{console.error(e.message);writeFileSync(c.result,'1')}); p.on('exit',code=>writeFileSync(c.result,String(code??1)));`)
      if (process.platform === 'darwin') {
        const quote = value => "'" + value.replaceAll("'", "'\\''") + "'"
        const script = join(dir, 'launch.command')
        await writeFile(script, `#!/bin/sh\ncd ${quote(request.cwd)}\nexport FOS_CONTEXT_TOKEN=${quote(context.token)}\nexec ${quote(process.execPath)} ${quote(wrapper)}\n`, { mode: 0o700 })
        child = spawn('open', ['-a', 'Terminal', script], { env, stdio: 'ignore' })
      } else child = spawn('x-terminal-emulator', ['-e', process.execPath, wrapper], { cwd: request.cwd, env, detached: true, stdio: 'ignore' })
    }
    let failure, terminalClosed = false
    child.on('exit', () => { if (process.platform !== 'darwin') terminalClosed = true })
    child.on('error', error => { failure = error })
    let cancellation
    const cancel = () => { cancellation ??= (async () => {
      if (!child?.pid) return
      if (process.platform === 'win32') {
        await new Promise(resolve => { const kill=spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}); kill.on('close',resolve); kill.on('error',resolve) })
      } else {
        for (let attempt=0; attempt<10; attempt++) {
          const value=Number(await readFile(join(dir,'pid.txt'),'utf8').catch(()=>''))
          if (Number.isInteger(value) && value>0) { try { process.kill(value,'SIGTERM') } catch {} break }
          await new Promise(resolve=>setTimeout(resolve,100))
        }
        child.kill()
      }
    })() }
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) cancel()
    emit({ type: 'text', text: 'Agent opened in a terminal. Approve tools there; close the session when finished.' })
    try {
      while (!signal.aborted) {
        if (failure) throw failure
        const code = await readFile(result, 'utf8').catch(() => null)
        if (code !== null) { if (code.trim() !== '0') throw new Error('CLI exited unsuccessfully. See its terminal output.'); return }
        if (terminalClosed) throw new Error('Agent terminal was closed.')
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    } finally { signal.removeEventListener('abort', cancel); await cancellation }
  } finally { await rm(dir, { recursive: true, force: true }) }
}
