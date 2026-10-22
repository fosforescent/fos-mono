// One-time, staged conversion. The source is never modified by this script.
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const esbuild = require('../web/node_modules/esbuild')
function load(entry) {
  const filename = path.resolve('scripts/.structural-converter.cjs')
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = module.paths
  loaded._compile(esbuild.buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text, filename)
  return loaded.exports
}
const { hashContent } = load('shared/dag-implementation/cid.ts')
const { compileLibrary } = load('shared/library-compiler.ts')
const original = fs.readFileSync('.fos/library.json', 'utf8')
const source = JSON.parse(original), old = source.nodes, nodes = {}, memo = new Map()
const put = node => { const cid = hashContent(node); nodes[cid] = node; return cid }
const empty = put({ data: {}, children: [] })
const alias = put({ data: { description: { content: 'Alias Constructor Node' } }, children: [] })
const title = put({ data: { description: { content: 'title' } }, children: [] })
const ip = Object.keys(old).find(cid => old[cid].data.description?.content === 'Alias Instruction Constructor Node')
function visit(cid) {
  if (memo.has(cid)) return memo.get(cid)
  const node = old[cid], data = { ...node.data }
  delete data.refPattern
  const declaration = data.alias && data.name && node.children.some(([key]) => key === ip)
  let children = node.children.filter(([key]) => !(declaration && key === ip)).map(([left, right]) => [visit(left), visit(right)])
  if (declaration) children.push([alias, empty])
  if (data.capabilityDefinition) {
    const text = put({ data: { scalar: { type: 'text', value: data.capabilityDefinition.name } }, children: [] })
    const key = put({ data: {}, children: [[alias, empty], [title, text]] })
    children = [[key, empty]]
  }
  const result = put({ data, children })
  memo.set(cid, result)
  return result
}
const converted = { ...source, rootNodeId: visit(source.rootNodeId), nodes }
const before = compileLibrary(source), after = compileLibrary(converted)
if (JSON.stringify(before.rows.map(row => row.id)) !== JSON.stringify(after.rows.map(row => row.id))) throw new Error('Conversion changed the library rows')
fs.writeFileSync('.fos/library.before-structural.json', original, { flag: 'wx' })
fs.writeFileSync('.fos/library.structural.json', JSON.stringify(converted, null, 2) + '\n')
fs.writeFileSync('.fos/library.structural.generated.json', JSON.stringify(after, null, 2) + '\n')
console.log(`Validated ${Object.keys(after.nodes).length} reachable nodes; backup and staged library written. Source unchanged.`)
