// Build the desktop app (unless --no-build) and install this computer's bundle:
//   Windows  the NSIS installer, silently (per-user; "Fosforescent" in Programs)
//   macOS    the .app into /Applications (replacing the previous copy)
//   Linux    the AppImage into ~/.local/bin/fosforescent (or `sudo dpkg -i` the .deb with --deb)
// The installed app is com.fosforescent.app with state in ~/.fos; `make tauri-dev` runs the separate dev app
// (com.fosforescent.app.dev, ~/.fos-dev), so both can be open at the same time.
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const bundles = path.join(root, 'desktop', 'src-tauri', 'target', 'release', 'bundle')
const build = !process.argv.includes('--no-build')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with ${result.status}`)
}
function newest(dir, matches) {
  if (!fs.existsSync(dir)) return null
  const files = fs.readdirSync(dir).filter(matches).map(name => ({ name, time: fs.statSync(path.join(dir, name)).mtimeMs }))
  files.sort((a, b) => b.time - a.time)
  return files[0] ? path.join(dir, files[0].name) : null
}

function main() {
  if (build) {
    console.log(`Building the desktop app (API ${process.env.VITE_API_URL || 'default'})…`)
    run('npm', ['run', 'build'], { cwd: path.join(root, 'desktop') })
  }
  if (process.platform === 'win32') {
    const installer = newest(path.join(bundles, 'nsis'), name => /-setup\.exe$/i.test(name))
    if (!installer) throw new Error(`No NSIS installer under ${bundles}; run without --no-build`)
    console.log(`Installing ${path.basename(installer)} silently…`)
    run(installer, ['/S'], { shell: false })
    const cli = path.join(root, 'desktop', 'src-tauri', 'target', 'release', 'fos.exe')
    console.log('Installed. Launch "Fosforescent" from the Start menu.')
    if (fs.existsSync(cli)) console.log(`The same binary is the fos CLI: ${cli}`)
    return
  }
  if (process.platform === 'darwin') {
    const app = newest(path.join(bundles, 'macos'), name => name.endsWith('.app'))
    if (!app) throw new Error(`No .app under ${bundles}`)
    const target = path.join('/Applications', path.basename(app))
    fs.rmSync(target, { recursive: true, force: true })
    run('cp', ['-R', app, target])
    console.log(`Installed ${target}`)
    return
  }
  if (process.argv.includes('--deb')) {
    const deb = newest(path.join(bundles, 'deb'), name => name.endsWith('.deb'))
    if (!deb) throw new Error(`No .deb under ${bundles}`)
    run('sudo', ['dpkg', '-i', deb]); return
  }
  const image = newest(path.join(bundles, 'appimage'), name => name.endsWith('.AppImage'))
  if (!image) throw new Error(`No AppImage under ${bundles}`)
  const bin = path.join(os.homedir(), '.local', 'bin'), target = path.join(bin, 'fosforescent')
  fs.mkdirSync(bin, { recursive: true }); fs.copyFileSync(image, target); fs.chmodSync(target, 0o755)
  console.log(`Installed ${target} (make sure ~/.local/bin is on PATH)`)
}
try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
