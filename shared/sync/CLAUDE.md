# Shared graph and sync constraints

Record intended behavior and restrictions here. Keep implementation details in code and tests rather than maintaining a catalog of current functions.

## The kernel

- The kernel must answer each of the language's five semantic questions exactly once: what a reference denotes here, what a row's operands are as values, whether a value satisfies a pattern, when effects run and what commits, and how a value becomes live. Before adding a function elsewhere, name the kernel call that performs its semantics. If none does, the change belongs in the kernel or in the library, and the pull request says which.
- Files outside the kernel must not reach for the resolver's internals, the matcher, editor identities (`.data.alias?.id`, `.data.ref?.id`), or rows by alias or capability names. Boundary allowlists may only shrink; an entry that is no longer needed must be removed.
- A native must be one shape: compiled operands in (CIDs: no alias, ref or scope), values out (bindings for the step's outputs, proposals for refs it was passed). It must never write the tree; the evaluator submits its answers as the evaluation's pending writes, each to the declaration the compiler named, checked against that declaration's pattern, and publishes them together at commit.
- Only CIDs may cross into execution. Identity is the declaration the resolver returns. A contract is a pattern node in the graph. Dependencies come from resolution.

## Scope and library resolution

- Resolve both sides of a row from its parent scope. Declarations inside the row are available to its children, not to the row itself. Do not introduce recursive bindings implicitly.
- An explicitly supplied argument or structural ancestor path must retain its selected declaration. A different nearer declaration with the same name must not redirect it. Only an unqualified name lookup selects by nearest name; overriding a passed ref requires addressing that ref.
- Resources, supplies, ordinary arguments, and handler discovery must consume the same scoped declaration records, including source store, declaring scope, assignments, accepted submissions, and availability. Keep presentation adapters free of independent scope walks or identity-to-name fallback.
- Search direct declarations in each enclosing scope, nearest first. Siblings and descendants must not contribute ambient bindings.
- Identity links obey the same boundary as named refs. UUIDs are local editor conveniences; typechecking/compilation must resolve graph references to CIDs through scope. Evaluation must not search for a UUID or consult an editor identity map.
- Keep compiler diagnostics and mappings back to editable rows outside the executable graph. Unfilled parameters must have content-addressed binders too. Renaming editor UUIDs alone must not change compiled meaning; changing a bound value requires recompilation. Mutable access must be mediated by explicit graph refs and handlers.
- A group must be the shared lexical frame for its participants' live refs. Sharing across subtrees must declare the ref in their lowest common enclosing scope and leave explicit references at the source and destination. Do not silently capture a source's private dependencies when changing its scope.
- Passing an outside ref must create an ordinary typed declaration. Its recipient supplies a handler, including a node-message transport when needed. Local overrides must not rewrite the group's accepted value or a sibling's handler.
- An independent copy must close external refs into values or reject unresolved dependencies. Preserve internal reference remapping and the copied constructor; a snapshot must not retain a hidden live UUID link.
- Scope lookup must use the shared declaration resolver, for library selection too. An unusable nearer provider blocks lookup. Equal-name assignments in the same frame address one ref; preserve all of them for conflict checking, never choose the first.
- A nearer name hides an outer one of any type. An unfilled declaration is a hole bound from further out. Only declarations bind; text conventions such as `key: value` titles or frontmatter never do.
- Handler alternatives must be explicit graph relationships to one shared capability node. Peer advertisements and local alternatives must use the same representation, never infer choices from peer namespaces or repeated names. Name lookup respects nearer names; capability lookup may enumerate explicit alternatives, with the same declaration identity shadowing outer submissions.
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
- Discovery must validate declaration availability and assignment agreement without invoking a callable's body. Invocation must also check its dependencies. Keep both operations on the shared binding resolver; a template with unfilled inputs remains discoverable.
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
- Hosts list a step's available executors; the evaluator must select exactly one. Several are a choice for the owner, never resolved by ordering on any host.
- Native graph operations must consume compiled operands. Apply their results to editable rows through the compiler's source mapping; do not resolve node UUIDs inside unification or native argument interpretation.
- Requirements and allocations are one kind of row, inverses of each other: an argument row is `[pattern, ref]`, a declaration whose pattern is a capability refined with what is demanded. A pattern with a `negative` row asks (a requirement: the ref is a hole until a value satisfying the pattern is bound); one without supplies (an allocation: the ref holds the value). There must be no separate requirement record, result ref, or supply record; supplying a requirement is binding its ref the way every ref is bound, and it is satisfied when the resolver finds the value satisfies the pattern. Nothing may switch on a capability's name to decide a shape.
- A pattern's rows other than its polarity rows are what a value of it carries: the constructor's name row, its argument slots and its declared inputs. Capabilities of equal shape are told apart by their name row, which is graph structure. A refinement (an amount, an option, a row the value must contain, a contract pin) is a constraint on the value's content and is not carried.
- A row's instruction is not its value's predicate: a library row type (a bank, a reference) constrains the row's placement, never what its ref holds. A pattern with no structure of its own (a bare capability) selects candidates by their declared type, never by value.
- Preserve the declaring scope of peer-offered handlers. Resolve their names through the same nearest-scope rule as direct declarations; a caller's location must not create a new resource identity.
- Authority is linear. A grant is a value that pins a checking contract (a row `[allocate capability, contract marker]`); a value without the pin is data, however it is labelled. A grant is bound to a requirement only by an invocation of the contract's handler, never by hand: the invocation's inputs name the grants consumed, its outputs declare the grants issued in their place (including the remainder, rebinding the handle it came from), and the native checks conservation over compiled operands and proposes the owner's next value. A bank is a ref row whose value declares the contract and holds its grants as elements (`[pattern, grant]`); a handle is an argument row in the tree holding a grant. Credit and debit are invocations with no inputs. Nothing is live before the evaluation commits.
- Do not add frame markers, a second resolver, or an authority-only branch in compilation or evaluation. Do not infer authority by scanning the tree. A grant a host mints outside the graph (a confirmed payment) is the one named exception, until that host is a native whose bank is a row.
- Resolving a value must check the selected value's dependencies, not require completion of its containing task. Detect cycles in value dependencies; lexical containment alone is not a cycle. A requirement's named inputs (a recipient, a repository) are filled refs on its pattern, read by its handler, and part of the contract a value of it carries.
- Persist an effect's journal before dispatch. Interrupted or uncertain effects must not be retried automatically; expose recovery work.
- Do not retain compatibility branches merely to satisfy old tests. Replace shortcut fixtures with explicit graph declarations and test the desired behavior.

## Resource authority and transactions

- Authority checking is a capability fulfilled by scoped handlers, selected through the same parent-scope rule as every other argument. A bank issues a grant only through an evaluated invocation its scope resolves a handler for; a capacity number, an amount row or a satisfied requirement is never authority.
- A grant keeps the contract it was issued under. An invocation whose bank declares a different contract must not move it; a permissive handler must not bypass a provider's restrictions.
- Identifying a grant is not allocating its authority. A grant is a content-addressed value (its nonce tells equal amounts apart); a handle holds it, and every copy of the value is the same grant, consumed once. Independent uses require explicit invocations whose inputs reference the grants consumed and whose outputs declare the grants issued, including the remainder (using 6 of 10 issues 6 and 4).
- An invocation is checked whole: inputs consumed exactly once from one bank, outputs conserving the amount, no contract change. Nothing it issues is live before its evaluation commits; an aborted evaluation publishes none of it.
- Effects propose their writes through the evaluator (natives answer values, the evaluator submits them as the evaluation's pending submissions); the evaluator must publish every pending write in one local commit, reject a destination whose accepted value changed, and discard the writes on failure. Consumed state stays in history, never as a selectable live alternative. Unrelated owners require their own handlers; a local commit is not atomic across peers.
- A quantity-conservation check may be native, but the graph selects it: the invocation's left is the handler ref its scope resolves. Nothing dispatches on a resource's name.
- Time bounds on banks, grants and allocations are data only. Nothing may claim they are enforced until time has a graph representation; a calendar service needs a concrete event interval before dispatch and must not guess dates.
- For restricted resources, negative requirements demand authority and positive grants supply it. Connections must retain the particular grant and its checking contract; matching amounts or opposite signs alone must not cancel obligations. Reversal is a requirement for the inverse operation linked to the original effect, and its fulfillment records that inverse. Repeated reversal must not recreate authority.
- Compose checks locally over explicit inputs, outputs, uses, and child evidence. Follow declared parent authority relationships; do not discover funding by scanning task contents. Explicit allocation/subref paths are required. A requirement declares demand, not credit; its children can consume only authority actually supplied to it.
- Graph rewriting should accumulate intended effects and their dependencies into a transaction graph. Checking validates proposed transitions together without spending or reserving live authority. Proposed grants are not evidence of committed external resources.
- Defer effects until their results are needed or the transaction is ready to commit. A result-dependent effect may execute within the same transaction; do not invent its result or silently create a separate committed transaction. Record the effect before dispatch. Failure aborts the transaction and requests reversal of its executed effect subtree.
- Transaction invocations must form an acyclic dependency graph within the enclosing subtree. Do not introduce recursive transaction invocation. Reverse dependent effects before their prerequisites, retaining explicit reversal obligations where work remains uncertain or incomplete.
- At commit, validate the expected authority state and reject conflicting or repeated consumption. Local atomic commit must not be represented as distributed atomicity across unrelated peers or external services. Completed native effects remain subject to compensation if the enclosing transaction aborts.
- Local delegation checks must validate authority, restrictions, and nonduplication; do not install a pass-through verification handler. Future authenticated delegation should add evidence to these same relationships. Relay authentication alone must not authorize delegation.
- Native effects must have a reversal handler, with a manual-intervention handler as the default. Compensation is a separate effect linked to the original effect, not deletion of history. The manual handler creates a human task; the reversal recipient's confirmation records the completed reversal and fulfills compensation. Task creation alone does not establish reversal. Derive inverses for graph operations from their recorded transitions, preserving intervening edits and surfacing conflicts rather than overwriting them. Do not infer an inverse for an opaque external effect.
- Market/workflow fulfillment must carry an independent result or receipt. A circular reference back to the requesting task must not count as fulfillment.
- Resource demands are refinements of the `allocation` capability. Payment, points and calendar handlers should be offered under refined patterns (a negative allocation of an account) so the graph selects them, and should be natives whose bank is a row.
- Grant signing and verification should be natives of that shape: a signing step inside the allocate invocation.
- Host and device effects must use the native boundary and return outputs committed by evaluation. Do not add a legacy effect adapter.

## Validation

Changes must compile under the shared, web, and backend TypeScript configurations. Keep extensionless imports and avoid enums and parameter properties.

Run the shared suite with npm test --workspace shared -- --runInBand, and the affected backend and browser integration suites. Cover nested overrides, missing and ambiguous bindings, pinned versions after reload, and withdrawal of native offers.

When shared runtime code changes, rebuild the embedded core from desktop:

    ../node_modules/.bin/esbuild ../shared/sync/embed.ts --bundle --format=iife --platform=browser --target=es2020 --outfile=src-tauri/js/fos-core.js --inject:src-tauri/js/prelude.js

The checked-in library source is .fos/library.json; regenerate its compiled artifact with node scripts/compile-library.cjs. Keep device/session/replica data out of source control.
