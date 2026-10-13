# Ref/template consolidation

## Implemented in this slice

- Backend provider declarations derive their shared names, kinds and capability
  lists from `INTEGRATION_PEERS`. The backend retains only OAuth configuration.
- Copying and template instantiation use `copyRowContent`. Instantiation copies
  nested rows and typed argument refs, assigns fresh identities, remaps internal
  references (including references to the template root), resets completion and
  omits supply rows. External ref targets stay pinned as defaults.
- An unbound argument is an alias with INSTRUCTIONPOINTER and no TARGETPOINTER.
  Binding adds TARGETPOINTER through the existing proposal format and acceptance
  operation. A value can itself be a ref; acceptance preserves that indirection.
- Binding proposals name the version they were offered against. Rejected,
  detached, replayed and stale proposals do not advance the ref. Concurrent
  different bindings produce a choice in the owning node, rather than merging
  two handler bodies. Type pointers label slots; they are not yet a general
  runtime type checker.
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

The existing MCP UI and endpoints remain usable. The new argument refs currently
have a shared code API, not a new binding editor in the web UI. This slice does
not migrate every capability provider or every older interpreter API.

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
