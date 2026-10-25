/**
 * The kernel answers each semantic question once. This test keeps other code from answering one again in a local
 * form: it reads the source tree and fails when a file outside the kernel reaches for the resolver's internals, the
 * matcher, or an editor identity, unless the file is on the allowlist. The allowlist is a ratchet: an entry that is
 * no longer needed fails the test too, so the list only shrinks.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(__dirname, '..', '..')
const KERNEL = new Set(['shared/sync/bindings.ts', 'shared/sync/scope-bindings.ts', 'shared/sync/ref-paths.ts', 'shared/sync/ref-compiler.ts', 'shared/sync/structural.ts',
  'shared/sync/operands.ts', 'shared/sync/evaluation.ts', 'shared/sync/transactions.ts', 'shared/sync/replica.ts', 'shared/sync/approvals.ts', 'shared/sync/kernel.ts', 'shared/sync/graph.ts'])

/** What only the kernel may do, and the files still doing it (to be shortened, never lengthened). */
const RULES: Array<{ name: string; pattern: RegExp; allow: string[] }> = [
  { name: 'resolver internals', pattern: /\b(bindingLayers|selectBinding|resolveRefIdentity|resolveRefExpression)\(/, allow: [
    'shared/sync/arguments.ts', 'shared/sync/execution-access.ts', 'shared/sync/ref-transfer.ts', 'web/src/app.ts'] },
  { name: 'the matcher', pattern: /\bmatchesGraph\(/, allow: [
    'shared/sync/capabilities.ts', 'shared/sync/primitives.ts', 'shared/sync/scoped-refs.ts', 'web/src/app.ts'] },
  { name: 'editor identities as semantics', pattern: /\.data\.(alias|ref)\?\.id\b/, allow: [
    'backend/search/rowIndex.ts', 'shared/sync/arguments.ts', 'shared/sync/constructor-rows.ts', 'shared/sync/events.ts', 'shared/sync/fields.ts', 'shared/sync/handlers.ts', 'shared/sync/library.ts', 'shared/sync/market.ts', 'shared/sync/node-context.ts', 'shared/sync/node-provider.ts', 'shared/sync/node-sync.ts', 'shared/sync/node-values.ts', 'shared/sync/pattern-bindings.ts', 'shared/sync/refs.ts', 'shared/sync/relay.ts', 'shared/sync/resource-bindings.ts', 'shared/sync/row-values.ts', 'shared/sync/scoped-refs.ts', 'shared/sync/sharing.ts', 'shared/sync/unify.ts', 'shared/sync/users.ts', 'shared/sync/work.ts', 'web/src/app.ts'] },
  { name: 'rows found by alias', pattern: /\bfindRowByAlias\(/, allow: [
    'backend/search/routes.ts', 'backend/sync/provideNode.ts', 'backend/sync/sharing.ts', 'shared/sync/market.ts', 'web/src/app.ts', 'web/src/sharing.ts'] },
  { name: 'capability names as semantics', pattern: /\bcapabilityNameOf\(/, allow: [
    ] }
]

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue
    if (statSync(path).isDirectory()) sources(path, out)
    else if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry) && !/\.d\.ts$/.test(entry)) out.push(relative(root, path).split('\\').join('/'))
  }
  return out
}

test('semantics are answered by the kernel; the allowlists only shrink', () => {
  const files = [...sources(join(root, 'shared')), ...sources(join(root, 'web', 'src')), ...sources(join(root, 'backend'))]
  const problems: string[] = []
  for (const rule of RULES) {
    const hits = files.filter(file => !KERNEL.has(file) && rule.pattern.test(readFileSync(join(root, file), 'utf8')))
    for (const file of hits) if (!rule.allow.includes(file)) problems.push(`${file} reaches for ${rule.name}: route it through the kernel (shared/sync/kernel.ts) or name why in the allowlist.`)
    for (const file of rule.allow) if (!hits.includes(file)) problems.push(`${file} no longer reaches for ${rule.name}: remove it from the allowlist.`)
  }
  expect(problems).toEqual([])
})
