# Ref/template consolidation

## Scoped capability declarations

Capability discovery should read typed ref declarations in the current scope and
its ancestors, including the enclosing device root of a shared document. An
accepted assignment contributes a value; declarations inside that value
contribute nested refs and peers. Pending/rejected proposals and historical
versions must not become executable values. Accepted alternatives remain separate
candidates. A named local argument retains its selected binding; a type-only
lookup must resolve ambiguity.

Patterns are ordinary graph rows: required rows are products and alternatives are
sums. A match must not combine children from different submitted alternatives.
Bindings are checked against the pattern on the enclosing row's left side. Nodes
have no independent type annotation or JSON pattern definition.

The standard-library list is a suggestion list, not an admission check.

Ref rows are the registration mechanism on devices and servers. A primitive ref is
an opaque execute-only value whose host-language meaning is attached to the local
runtime graph node; it creates no declaration in scope by itself. Execution uses
the primitive values found among scoped declarations and accepted submissions;
there is no separate handler-name map. A handler ref can have any structural type.
Serialized refs contain identities and enclosing row patterns, never native code
or credentials. Initial defaults are seeded once, so reopening a store does not
recreate removed declarations. Device declarations stay in the device root when a
document is shared. Menus, typed input, binding candidates, and provider selection
use scoped discovery. Local ref identities shadow the same outer identities; peer
permissions use the nearest policy. Disable settings apply to nested offers as
well.

An arbitrary graph value must not execute as native code: the executing host must
supply that primitive's local meaning, and a compatible ref declaration must
expose it in the execution scope.

## Property paths, types and compilation

Refs expose their nested declarations as properties. `.ref1.ref2` starts at the
current scope; `....ref1.ref2` climbs three scopes first. Unqualified names use
lexical lookup. `(ref2 (ref1 (.. (.. .))))` is the same expression as
`...ref1.ref2`. A whole-row path stores a ref expression. Single-brace row
parameters embed expressions as ordinary typed refs; text substitution and
execution use the same resolver.

Multiple required rows form a product; choices for a row form a sum. Capability
patterns and handler refs use the same structural assignment check. Incompatible
submissions cannot be accepted against the enclosing row's pattern.

Missing refs, unavailable peer content, denied access, ambiguous bindings and
cycles remain explicit holes in compilation; possession of a cached node must not
bypass the access check. Bound mutable refs compile to immutable values without
their history.

Compiling a row separates the instruction (left) from the value (right). Running
requires the instruction to be closed. The value can retain holes for
user/process inputs. Output refs may remain open when execution begins; a native
handler's explicit return contract can still require them to be filled at commit.

- Template instantiation copies nested rows and typed argument refs, assigns fresh
  identities, remaps internal references (including references to the template
  root), resets completion and omits supply rows. External ref targets stay
  pinned as defaults.
- An unbound argument's pattern comes from the enclosing row's left node. Binding
  goes through the ordinary proposal and acceptance operation. A value can itself
  be a ref; acceptance preserves that indirection.
- Binding proposals name the version they were offered against. Rejected,
  detached, replayed and stale proposals must not advance the ref. Concurrent
  different bindings produce a choice in the owning node, rather than merging
  two handler bodies. Structural checks validate the resulting values without
  adding independent type pointers to refs.
- MCP requests first use their explicit local handler argument, otherwise bind a
  nearest attached provider. The binding is saved before calling the tool and
  remains on failure. An unavailable explicit binding must not silently select
  another provider.
- Successful MCP calls propose their result note to a local return ref and record
  the supply row. Unresolved child requirements or choices block calls.

## Execution limits

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
Session types should constrain these persisted transitions.

Tasks claim a particular resource state/version and determine its outcome:
returned, consumed, transformed, broken or lost. A drill need not have a fixed
"reusable" property. Document spans can require exclusive claims too. Owner-side
version validation and conflict handling must precede shared resource reservation;
offline intentions are not global locks.

Type constructors should use template instantiation and return their constructed
object. Constructor alternatives and argument constraints can describe types.
Do not introduce a separate constructor evaluator or document property binder.

The older proposal manager, calendar/budget allocation implementations,
string-only document expansion and other native handler dispatch paths should be
consolidated onto refs and templates.
