// The local graph is the source of truth. Builds never fetch or synthesize a library.
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const root = path.resolve(__dirname, '..')

function compile(source = path.join(root, '.fos/library.json'), target = path.join(root, 'shared/sync/library.generated.json')) {
  let esbuild
  for (const candidate of ['esbuild', path.join(root, 'web/node_modules/esbuild')]) {
    try { esbuild = require(candidate); break } catch { /* try the installed workspace */ }
  }
  if (!esbuild) throw new Error('Install dependencies before compiling the library.')
  const output = esbuild.buildSync({ entryPoints: [path.join(root, 'shared/library-compiler.ts')], bundle: true, platform: 'node', format: 'cjs', write: false })
  const filename = path.join(root, 'scripts/.library-compiler.cjs')
  const compiler = new Module(filename, module)
  compiler.filename = filename
  compiler.paths = module.paths
  compiler._compile(output.outputFiles[0].text, filename)
  const bundle = compiler.exports.compileLibrary(JSON.parse(fs.readFileSync(source, 'utf8')))
  const json = JSON.stringify(bundle, null, 2) + '\n'
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== json) fs.writeFileSync(target, json)
  console.log(`[library] compiled ${Object.keys(bundle.nodes).length} nodes from ${path.relative(root, source)}`)
  return bundle
}
module.exports = { compile }
if (require.main === module) compile()
