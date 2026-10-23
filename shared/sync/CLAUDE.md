# Shared graph and sync constraints

Record intended behavior and restrictions here. Keep implementation details in code and tests rather than maintaining a catalog of current functions.

## Scope and library resolution

- Resolve both sides of a row from its parent scope. Declarations inside the row are available to its children, not to the row itself. Do not introduce recursive bindings implicitly.
- Search direct declarations in each enclosing scope, nearest first. Siblings and descendants must not contribute ambient bindings.
- Identity links obey the same boundary as named refs. UUIDs are local editor conveniences; typechecking/compilation must resolve graph references to CIDs through scope. Evaluation must not search for a UUID or consult an editor identity map.
- Keep compiler diagnostics and mappings back to editable rows outside the executable graph. Unfilled parameters must have content-addressed binders too. Renaming editor UUIDs alone must not change compiled meaning; changing a bound value requires recompilation. Mutable access must be mediated by explicit graph refs and handlers.
- A group must be the shared lexical frame for its participants' live refs. Sharing across subtrees must declare the ref in their lowest common enclosing scope and leave explicit references at the source and destination. Do not silently capture a source's private dependencies when changing its scope.
- Passing an outside ref must create an ordinary typed declaration. Its recipient supplies a handler, including a node-message transport when needed. Local overrides must not rewrite the group's accepted value or a sibling's handler.
- An independent copy must close external refs into values or reject unresolved dependencies. Preserve internal reference remapping and the copied constructor; a snapshot must not retain a hidden live UUID link.
- Every lookup by name or kind goes through `lookupInScope`/`nearestInScope`: the nearest scope that declares anything answers, several there are ambiguous, and an unusable declaration there blocks. Never walk paths by hand or fall through to an outer scope.
- A nearer name hides an outer one of any type. An unfilled declaration is a hole bound from further out. Only declarations bind (`declares`); text conventions such as `key: value` titles or frontmatter never do.
- Collecting a type's alternatives (handler discovery) reads every visible declaration; only the same declaration identity shadows, and more than one candidate is a choice.
- Apply that identity-shadowing rule across both direct refs and member advertisements. An empty nearer declaration must block an outer handler of the same identity. Competing transport handlers require a choice too.
- Bind the library instance before selecting a field. A nearer instance shadows the whole namespace; a missing field must not fall through to an outer library or the build bundle.
- Missing, unavailable, or ambiguous bindings must remain visible failures. Never manufacture a capability because code requested an unfamiliar name.
- Library definitions and instances have different roles: edits change definitions; explicit upgrades change an instance's pinned version.
- Existing rows must retain their pinned definitions across upgrades, reload, copying, and exchange. Recognizing a pinned node's provenance must not rebind it to the current library.
- Nested document stores and isolated working copies must retain their enclosing graph scope. They must not silently install a private default library.
- Bootstrap may import the bundled library explicitly. Runtime lookup must not consult that bundle as a fallback.
- Access capabilities as fields of the bound library. Offer identities must refer to capability nodes; do not encode or parse capability names in IDs.
- A trigger's definition must come from its own instruction node. A familiar name must not supply missing behavior or metadata.
- Parameter keys must carry their native interpretation in their own data, and primitive parameters must refer to the value predicate node. Library names, sibling declarations, and the shipped bundle must not assign meaning to an existing parameter graph.

## Structural semantics

- A row is an ordered pair: instruction/pattern on the left, argument/value on the right. Do not add an independent type annotation to a node.
- Patterns must express their distinctions in graph structure. A constructor may have a name row containing a string. Such a row is ordinary graph data, not a lookup into a separate behavior catalog.
- Library binding names must not classify constructors. Native adapters may read a constructor's own name row; aliases assigned by other libraries must not change its meaning.
- Placement rules must hold their predicates as graph edges and match the pinned instruction structurally, or compare its exact CID when explicitly requested. Do not reverse-index library fields or recover retired definitions through library history to interpret a rule.
- Required rows form products; choices form alternatives. An alternative must satisfy a whole pattern; do not assemble a match from pieces of different alternatives.
- Native scalar predicates may inspect leaf values. Aliases and presentation metadata must not establish structural compatibility.
- Ref declarations and accepted submissions are the registration mechanism for handlers. Permissions alone must not create executable offers.
- Native implementations provide local meaning to graph values. Restoring them after reload must not republish withdrawn declarations or change pinned capability versions.
- Discover handlers, observers, and node transports through scoped declarations. Do not add another dispatch path keyed by names or parsed IDs.
- Partial assignments may retain holes. A partial assignment is not proof that an instruction is executable.

## Mutation, exchange, and execution

- Equal graph content must have the same CID on every peer. Preserve row order and direction; validate imported content and data versions.
- Preserve literal graph constraints through construction, copying, reordering, and node exchange. Immutable payloads must respect child masks; mutable descendants must require their own authorized load.
- Preserve mutable-ref identity while recording content history. Do not keep using an older replica object after an edit.
- Preserve complete choice alternatives and keep branch preview content separate from authoritative policy.
- Exchange only authorized graph content. Do not traverse remote references using cached data as a substitute for access checks.
- Scope discovery must not bypass member grants or masks. Unavailable or disabled providers must not satisfy dependencies.
- Hosts list a step's available executors; the evaluator selects exactly one (`selectExecutor`). Several are a choice for the owner, never resolved by ordering on any host.
- Native graph operations must consume compiled operands. Apply their results to editable rows through the compiler's source mapping; do not resolve node UUIDs inside unification or native argument interpretation.
- Persist an effect's journal before dispatch. Interrupted or uncertain effects must not be retried automatically; expose recovery work.
- Do not retain compatibility branches merely to satisfy old tests. Replace shortcut fixtures with explicit graph declarations and test the desired behavior.

## Validation

Changes must compile under the shared, web, and backend TypeScript configurations. Keep extensionless imports and avoid enums and parameter properties.

Run the shared suite with npm test --workspace shared -- --runInBand, and the affected backend and browser integration suites. Cover nested overrides, missing and ambiguous bindings, pinned versions after reload, and withdrawal of native offers.

When shared runtime code changes, rebuild the embedded core from desktop:

    ../node_modules/.bin/esbuild ../shared/sync/embed.ts --bundle --format=iife --platform=browser --target=es2020 --outfile=src-tauri/js/fos-core.js --inject:src-tauri/js/prelude.js

The checked-in library source is .fos/library.json; regenerate its compiled artifact with node scripts/compile-library.cjs. Keep device/session/replica data out of source control.
