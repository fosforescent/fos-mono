// Bundle shared/sync/embed.ts into desktop/src-tauri/js/fos-core.js (the sync core the fos binary embeds).
// esbuild is resolved from the workspace root first, then from web/, so a checkout where only `web` has run
// `npm install` can still build the core (the Tauri hooks and the release workflows call this).
require('./compile-library.cjs').compile()
const path = require('node:path')
const root = path.resolve(__dirname, '..')
let esbuild
for (const candidate of ['esbuild', path.join(root, 'web', 'node_modules', 'esbuild')]) {
  try { esbuild = require(candidate); break } catch { /* try the next location */ }
}
if (!esbuild) { console.error('esbuild is not installed: run `npm install` at the repository root (or in web/)'); process.exit(1) }
esbuild.buildSync({
  entryPoints: [path.join(root, 'shared', 'sync', 'embed.ts')],
  bundle: true, format: 'iife', platform: 'browser', target: 'es2020',
  outfile: path.join(root, 'desktop', 'src-tauri', 'js', 'fos-core.js'),
  inject: [path.join(root, 'desktop', 'src-tauri', 'js', 'prelude.js')],
  logLevel: 'info',
})
