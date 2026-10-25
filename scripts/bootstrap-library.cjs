// Runs scripts/bootstrap-library.ts once (see its header). Bundled with the workspace's esbuild like compile-library.cjs.
const path = require('node:path')
const Module = require('node:module')
const root = path.resolve(__dirname, '..')
let esbuild
for (const candidate of ['esbuild', path.join(root, 'web/node_modules/esbuild')]) {
  try { esbuild = require(candidate); break } catch { /* try the installed workspace */ }
}
const output = esbuild.buildSync({ entryPoints: [path.join(root, 'scripts/bootstrap-library.ts')], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['mermaid', 'katex'] })
const filename = path.join(root, 'scripts/.bootstrap-library.cjs')
const script = new Module(filename, module)
script.filename = filename
script.paths = module.paths
script._compile(output.outputFiles[0].text, filename)
