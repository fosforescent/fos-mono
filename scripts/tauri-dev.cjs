const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const production = process.argv.includes('--prod')
const env = { ...process.env, RUST_LOG: 'debug', RUST_BACKTRACE: '1',
  FOS_TARGET_DIR: fs.realpathSync(process.env.DIR || os.homedir()),
  // the dev app keeps its home-mode state apart from the installed app's ~/.fos (see desktop/src-tauri/tauri.dev.conf.json for its identifier)
  FOS_STATE_HOME: process.env.FOS_STATE_HOME || path.join(os.homedir(), '.fos-dev') }
if (production) env.VITE_API_URL = process.env.PROD_API_URL || 'https://api.fosforescent.com'
const npm = [process.env.npm_execpath,
  path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')
].find(candidate => candidate && fs.existsSync(candidate))
if (!npm) throw new Error('Cannot locate npm-cli.js beside Node. Install Node with npm or run this script through npm.')
const logPath = path.join(root, 'logs', 'tauri-dev.log')

async function run(cwd, script, log) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npm, 'run', script], { cwd, env, stdio: ['inherit', 'pipe', 'pipe'] })
    for (const [stream, output] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      stream.on('data', chunk => { output.write(chunk); log?.write(chunk) })
    }
    child.on('error', reject)
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${script} exited with ${signal || code}`)))
  })
}

async function main() {
  if (production) console.log(`Using production API: ${env.VITE_API_URL}`)
  console.log('Cleaning Vite cache and rebuilding web...')
  for (const name of ['node_modules/.vite', 'dist']) fs.rmSync(path.join(root, 'web', name), { recursive: true, force: true })
  await run(path.join(root, 'web'), 'build')
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  const log = fs.createWriteStream(logPath)
  log.write(`=== Tauri Dev Started: ${new Date().toISOString()} ===\n`)
  console.log(`Starting Tauri dev; logging to ${logPath}`)
  try { await run(path.join(root, 'desktop'), 'dev', log) } finally { log.end() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
