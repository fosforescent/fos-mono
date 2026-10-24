# Shared graph and sync constraints

Record intended behavior and restrictions here. Keep implementation details in code and tests rather than maintaining a catalog of current functions.

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
- Scope lookup must use the shared declaration resolver (and `lookupInScope`/`nearestInScope` for library selection). An unusable nearer provider blocks lookup. Equal-name assignments in the same frame address one ref; preserve all of them for conflict checking, never choose the first.
- A nearer name hides an outer one of any type. An unfilled declaration is a hole bound from further out. Only declarations bind (`declares`); text conventions such as `key: value` titles or frontmatter never do.
- Handler alternatives must be explicit graph relationships to one shared capability node. Peer advertisements and local alternatives must use the same representation (`refAlternatives`), never infer choices from peer namespaces or repeated names. Name lookup respects nearer names; capability lookup may enumerate explicit alternatives, with the same declaration identity shadowing outer submissions.
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
- Hosts list a step's available executors; the evaluator selects exactly one (`selectExecutor`). Several are a choice for the owner, never resolved by ordering on any host.
- Native graph operations must consume compiled operands. Apply their results to editable rows through the compiler's source mapping; do not resolve node UUIDs inside unification or native argument interpretation.
- Resource requirements are capabilities and banks supply handlers. Resolve them through the same scoped bindings as other capabilities; never pick the first bank from a tree-wide inventory. Distinct declarations may bind equal values. Same-name submissions in one scope address the same ref, and contradictory submissions require resolution.
- Preserve the declaring scope of peer-offered handlers. Resolve their names through the same nearest-scope rule as direct declarations; a caller's location must not create a new resource identity.
- Compile authority operations into closed binding frames before checking them. Declaration CIDs identify owner and grant slots; domain checks must not consult editor paths or UUIDs. Recompile to observe changed resource values. Do not infer authority by scanning the tree for competing allocation rows.
- Compile requirement evidence and output projections before interpreting them. Supply locators must resolve through accessible enclosing declarations; cached siblings and unaccepted proposal rows must not supply values. Repeated references to one allocation count once, while distinct declarations retain distinct accounting identities.
- Keep source locations for requirement outputs outside their executable graph. A compiled output must retain its pinned evidence and use content-addressed local bindings; editing or revoking the source requires recompilation.
- External receipts are opaque service data, not graph locators. Do not overload a graph-reference field with an issue number, account identifier or fake bank name.
- Resolving supply evidence must check the selected value's dependencies, not require completion of its containing task. An explicit allocation argument may be forwarded into descendants while its outer parameter awaits fulfillment. Detect cycles in value dependencies; lexical containment alone is not a cycle. A row's instruction must not automatically be treated as its result's value predicate; requested constraints belong to the consuming operation.
- Persist an effect's journal before dispatch. Interrupted or uncertain effects must not be retried automatically; expose recovery work.
- Do not retain compatibility branches merely to satisfy old tests. Replace shortcut fixtures with explicit graph declarations and test the desired behavior.

## Authority checking and transactions: intended contracts

- Authority checking must be a capability fulfilled by scoped handlers, not a separate modality resolver. Ordinary bindings default to unrestricted reuse. An explicit declaration may select a linear checking handler for its children, through the same parent-scope rule as other capabilities.
- An incoming grant retains its checking contract. A consumer's nearer handler must not weaken that contract. Resolve handler alternatives explicitly; a permissive handler must not bypass a provider's restrictions.
- Distinguish identifying a grant from allocating its authority. Repeated graph references do not create additional grants. Independent restricted uses require explicit transfer or split operations with graph edges to the input authority and resulting grants. Do not implement shared spending aliases as implicitly independent budgets.
- A split must consume the original grant and produce both the delegated grant and an explicit remainder. Rebind the parent's mutable ref to that remainder; do not leave the consumed grant available for another split. For example, delegating 6 from 10 must produce child 6 and remainder 4.
- Compose nested allocations in one invocation by selecting explicit outputs of preceding operations. Compile authoring coordinates into grant declaration edges; never find an intermediate grant by matching its value, name, or task contents. Check the entire transaction before exposing any resulting authority. Publish only final, unconsumed grants; an aborted invocation must publish none of its intermediate or final grants.
- Authoring must use the execution compiler and checking contracts to validate its proposed invocation. Live input refs, the owner and final destinations must be accessible from the invocation's parent scope. Access to an owner's state does not make a private grant ref in a sibling or child scope accessible.
- Each issuer must expose an explicit scoped authority-state ref. Grant references must address declarations inside that owner's state. Copying a reference retains its owner and declaration; identical payloads must never identify an owner or issue new authority. Rebind destinations to owner-bound references, not detached grant values.
- Publish the owner's next state and destination refs in one local commit through the existing evaluator. Reject stale source mappings and conflicting updates before publication. Retain consumed state in history, not as a selectable live alternative. Unrelated owners require their own handlers; do not claim a local commit is atomic across peers.
- Preserve declaration identity even when values have identical CIDs. UUIDs remain editor conveniences; compiled grant references and operation operands must use CIDs, with source mappings outside the executable graph.
- Generic authority checking must not assume numeric amounts or dispatch by resource names. Domain handlers validate allowable splits and combinations for amounts, inventory items, intervals, occupancy, and other constraints. Linear usage must account for authority exactly once; do not silently substitute affine omission. Remaining authority must be explicit where required by the checking contract.
- Independent operations within one owner's transaction may retain different checking contracts. Combining inputs governed by different contracts requires an explicit composite contract; neither traversal order nor a permissive co-input may choose the output contract.
- For restricted resources, negative requirements demand authority and positive grants supply it. Connections must retain the particular grant and its checking contract; matching amounts or opposite signs alone must not cancel obligations. Reversal is a requirement for the inverse operation linked to the original effect, and its fulfillment records that inverse. Repeated reversal must not recreate authority.
- Compose checks locally over explicit inputs, outputs, uses, and child evidence. Follow declared parent authority relationships; do not discover funding by scanning task contents. Explicit allocation/subref paths are required. A requirement declares demand, not credit; its children can consume only authority actually supplied to it.
- Graph rewriting should accumulate intended effects and their dependencies into a transaction graph. Checking validates proposed transitions together without spending or reserving live authority. Proposed grants are not evidence of committed external resources.
- Defer effects until their results are needed or the transaction is ready to commit. A result-dependent effect may execute within the same transaction; do not invent its result or silently create a separate committed transaction. Record the effect before dispatch. Failure aborts the transaction and requests reversal of its executed effect subtree.
- Transaction invocations must form an acyclic dependency graph within the enclosing subtree. Do not introduce recursive transaction invocation. Reverse dependent effects before their prerequisites, retaining explicit reversal obligations where work remains uncertain or incomplete.
- At commit, validate the expected authority state and reject conflicting or repeated consumption. Local atomic commit must not be represented as distributed atomicity across unrelated peers or external services. Completed native effects remain subject to compensation if the enclosing transaction aborts.
- Cryptographic verification is deferred. Local delegation checks must validate authority, restrictions, and nonduplication; do not install a pass-through verification handler. Future authenticated delegation should add evidence to these same relationships. Relay authentication alone must not authorize delegation.
- Native effects must have a reversal handler, with a manual-intervention handler as the default. Compensation is a separate effect linked to the original effect, not deletion of history. The manual handler creates a human task; the reversal recipient's confirmation records the completed reversal and fulfills compensation. Task creation alone does not establish reversal. Derive inverses for graph operations from their recorded transitions, preserving intervening edits and surfacing conflicts rather than overwriting them. Do not infer an inverse for an opaque external effect.

## Intended functionality awaiting replacement

- Replace the unfinished requirement-reservation draft with explicit authority transfer and split operations. Preserve backing through nested fulfillment and compiled projections, checking each grant and its parent transition. Do not finish the abandoned shared-budget-alias approach or retain it beside the new checker.
- Legacy scalar allocation spending and tree-wide capacity accounting are removed. Restore budget, inventory, and calendar authoring by producing explicit owner-bound grants and transition invocations, with domain checking handlers selected in the graph. Requirement amount projections remain data: scalar fulfillment evidence is not an owned grant and must not manufacture a bank. Preserve this limitation until those authoring flows are ported; do not retain the old checker beside authority checking.
- Market/workflow fulfillment must carry an independent result or receipt. The former shortcut accepting a circular reference back to the requesting task must remain blocked.
- Replace the remaining requirement-name fulfillment switch and specialized evidence/accounting frames with graph-selected operations and common compiled interactions. Declaration consolidation alone is not that migration. Compatible constraint refinement still needs graph semantics; do not claim exact-value agreement implements refinement.

## Validation

Changes must compile under the shared, web, and backend TypeScript configurations. Keep extensionless imports and avoid enums and parameter properties.

Run the shared suite with npm test --workspace shared -- --runInBand, and the affected backend and browser integration suites. Cover nested overrides, missing and ambiguous bindings, pinned versions after reload, and withdrawal of native offers.

When shared runtime code changes, rebuild the embedded core from desktop:

    ../node_modules/.bin/esbuild ../shared/sync/embed.ts --bundle --format=iife --platform=browser --target=es2020 --outfile=src-tauri/js/fos-core.js --inject:src-tauri/js/prelude.js

The checked-in library source is .fos/library.json; regenerate its compiled artifact with node scripts/compile-library.cjs. Keep device/session/replica data out of source control.
