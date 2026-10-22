# Ref/template consolidation

## Scoped capability declarations

Capability discovery now reads typed ref declarations in the current scope and its
ancestors, including the enclosing device root of a shared document. An accepted
assignment contributes a value; declarations inside that value contribute nested
refs and peers. Pending/rejected proposals and historical versions do not become
executable values. Accepted alternatives remain separate candidates. A named local
argument retains its selected binding; a type-only lookup must resolve ambiguity.

`scopedRefs` and `inspectRef` expose this tree. `matchesRefPattern` uses ordinary
graph rows: required rows are products and alternatives are sums. A match cannot
combine children from different submitted alternatives. `resolveBinding` checks
actual properties against the pattern on the enclosing row's left side. Nodes
have no independent type annotation or JSON pattern definition.

The built-in names and syntax aliases live in `.fos/library.json` as pattern/ref
declarations. `CapabilityKind` is removed; `Capability` remains an open compatibility
wire label. The compiled
standard-library list is a suggestion list, not an admission check. Old primitive
capability pointers remain readable through the compatibility adapter.

Ref rows are the registration mechanism on devices and servers. `primitiveRef`
constructs an opaque execute-only value and attaches its host-language meaning to
the local runtime graph node. It creates no declaration in scope by itself.
`nativeRefValues` walks scoped declarations and accepted submissions; execution
uses the primitive values it finds there. There is no separate handler-name map.
`HostHandler.ref` is required and can have any structural type. Native bootstrap
definitions reconstruct runtime meanings after loading; serialized refs contain
identities and enclosing row patterns, never native code or credentials. Initial defaults are seeded once,
so reopening a store does not recreate removed declarations.
Device declarations stay in the device root when a document is shared.
Menus, typed input, binding candidates, and provider selection use scoped discovery.
Local ref identities shadow the same outer identities; peer permissions continue
to use the nearest policy. Disable settings apply to nested offers as well.

Existing task, allocation, user-verification, and integration operations retain
their native syntax and value adapters. An arbitrary graph value does not execute
as native code: the executing host must supply that primitive's local meaning,
and a compatible ref declaration must expose it in the execution scope.

## Implemented in this slice

### Property paths, types and compilation

Refs expose their nested declarations as properties. `.ref1.ref2` starts at the
current scope; `....ref1.ref2` climbs three scopes first. Unqualified names retain
lexical lookup. `(ref2 (ref1 (.. (.. .))))` is the same expression as
`...ref1.ref2`. A whole-row path stores a ref expression. Single-brace row
parameters embed expressions as ordinary typed refs; text substitution and
execution use the same resolver.

Multiple required rows form a product; choices for a row form a sum. Capability
patterns and handler refs use the same structural assignment check. Incompatible
submissions cannot be accepted against the enclosing row's pattern.

`compileRefGraph` returns `{ cid, holes, complete, sources }`. Missing UUID refs,
unavailable peer content, denied access, ambiguous bindings and cycles remain
explicit holes; possession of a cached node does not bypass the access callback.
`saveRefCompilation` persists the CID, hole records and reachable compiled nodes
together. Bound mutable refs compile to immutable values without their history.

`compileRow` separates the instruction (left) from the value (right). Run and the
evaluator require the instruction to be closed. The value can retain holes for
user/process inputs, including nested product fields shown by the execute form.
`refRole: 'output'` marks refs that may remain open when execution begins; a native
handler's explicit return contract can still require them to be filled at commit.

- Backend provider declarations derive their shared names, kinds and capability
  lists from `INTEGRATION_PEERS`. The backend retains only OAuth configuration.
- Copying and template instantiation use `copyRowContent`. Instantiation copies
  nested rows and typed argument refs, assigns fresh identities, remaps internal
  references (including references to the template root), resets completion and
  omits supply rows. External ref targets stay pinned as defaults.
- An unbound argument has an ALIAS constructor and no TARGETPOINTER. Its pattern
  comes from the enclosing row's left node.
  Binding adds TARGETPOINTER through the existing proposal format and acceptance
  operation. A value can itself be a ref; acceptance preserves that indirection.
- Binding proposals name the version they were offered against. Rejected,
  detached, replayed and stale proposals do not advance the ref. Concurrent
  different bindings produce a choice in the owning node, rather than merging
  two handler bodies. Structural checks validate the resulting values without
  adding independent type pointers to refs.
- MCP attachments advertise typed handler refs on existing CAPABILITY edges.
  Existing capability lists remain a compatibility projection. Native MCP values
  identify the peer and tool; templates can be stored behind the same ref shape,
  but executing template-backed handlers is not implemented here.
- MCP requests first use their explicit local handler argument, otherwise bind a
  nearest attached provider. The binding is saved before calling the tool and
  remains on failure. An unavailable explicit binding cannot silently select
  another provider. Existing primitive-only MCP memberships still work.
- Successful MCP calls propose their result note to a local return ref and record
  the existing supply row. Unresolved child requirements or choices block calls.
  Manual execution and the listener both reload under the existing user lock.

The existing MCP UI and endpoints remain usable. The web UI exposes ref inputs,
structural binding candidates, and property paths. Legacy capability-name and
editor-placement adapters remain; not every older interpreter API is migrated.

## Execution limits

The return ref is local to the account's MCP request. It is not yet the full
A-accepts-B cross-peer continuation protocol. The user lock prevents overlapping
calls in one server process; it is not a distributed lock. A crash after a remote
side effect but before saving its result can still repeat that effect on retry.
Durable delivery, adapter idempotency and session transitions must precede
payment execution. Binding a provider is not evidence of payment or approval.

## Direction for subsequent slices

Prefer the same refs and templates until a concrete use case requires separation.
Capabilities, document properties, resource arguments and continuations describe
roles of refs; they do not need separate binding tables. Handler dependencies
should be further argument refs with optional defaults. A handler may require
confirmation without the caller's provider binding granting that confirmation.

When A accepts B's proposal, create a request/return ref at B linking to A's
continuation. Record pending delivery in the graph, deliver idempotently, and
accept returned values through the same proposal mechanism. Multiple alternatives
must not duplicate permission to commit an exclusive update or external effect.
Session types should constrain these persisted transitions. The current in-memory
session helper is not a durable implementation of that protocol.

Tasks claim a particular resource state/version and determine its outcome:
returned, consumed, transformed, broken or lost. A drill need not have a fixed
"reusable" property. Document spans can require exclusive claims too. Owner-side
version validation and conflict handling must precede shared resource reservation;
offline intentions are not global locks.

Type constructors should use template instantiation and return their constructed
object. Constructor alternatives and argument constraints can describe types.
Do not introduce a separate constructor evaluator or document property binder.

Still to consolidate after their callers migrate: the older proposal manager,
calendar/budget allocation implementations, string-only document expansion and
other native handler dispatch paths. This slice removes duplicated provider
metadata and shallow template-copying logic; it does not delete these older
systems or claim to have unified their semantics.
