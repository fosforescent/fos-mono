# Offline/online sync

A device should keep working without a server and merge back when it signs in.

## On-demand node providers

Exports of templates and pinned grants must not contain private dependencies.
Requests cannot widen the attachment scope the transport supplies, traverse a
reference, or bypass a revoked child grant. Authorization must be checked
against current main-branch policy on every request.

Each linked node has two distinct mutable endpoint refs, one per side; they must
never be merged into each other's policy. Ancestor field masks also apply to
direct descendant requests. A changed request ID cannot bypass a mask. New links
inherit parent grants and masks. Explicit masks intersect with inherited ones,
so a descendant cannot widen a parent boundary. Masks filter both incoming
projections/changes and outgoing data.

**Member edges travel like other children.** A grant or offer is immutable.
Who receives what is the masked projection the grants define:

* any peer other than the owner's devices receives only its own member entry
  (its grants, and the rows left there for it), and of the node only the
  children it may read. It cannot step into another entry and never writes an
  entry;
* a member granted `local` (a store reached through this machine's files) is
  never listed: that link stays on the machine.

A peer must never be granted more than its member entry says, including while
the entry is in flight.

Concurrent edits to different fields merge; overlapping edits fail without
replacing either value.

Invited account peers and virtual proposers write into their own pending values;
main stays unchanged until an approval applies the proposal. Current main grants
are checked even when serving a pending value.

Every branch request is authorized against current main grants and link masks,
and updates to a branch must preserve main.

Approval requires owner access or `edit` (deciding submissions is how edit is
exercised on a node with several peers; there is no separate approve grant).
Rejecting leaves main unchanged.

Relayed children must belong to the same provider at the expected child address;
foreign reference targets require a separately authorized attachment.

## The replica

Everything is expressed in the existing hash-consed graph: there is no separate
sync data model.

## Representation in the graph

All structures use existing primitives. A row is `[type, rowNode]`: the type
(the left node, the instruction) is what the row is, and nothing else is.

A choice is a OneOf node whose resolution strategy is "choice": the thing's
value is one of the listed versions until a user picks. Because it is ordinary
graph data it replicates like everything else and any device can resolve it.

## Merge

A three-way merge of content nodes, against the node both peers last agreed on.
Per child:

| base → ours / theirs                        | result                                               |
|---------------------------------------------|------------------------------------------------------|
| only one side changed                       | take that side (add, edit or delete)                 |
| both changed identically                    | take it                                              |
| both changed, same shape (task/task, node/node) | recurse: data merged field by field, children merged |
| same data field edited to different values  | leaf (task): **choice** with both versions; container: theirs wins for that field |
| one deleted, the other edited               | **choice** (one option is "deleted")                 |
| a choice resolved on one side only          | resolution wins (the other side still holds the base) |
| the same choice resolved differently twice  | a new choice                                         |

Edge order must never affect a cid, so the merge is deterministic.

## Node sync

The same field changed on both sides is refused and the local value is kept.
A device that worked offline and then signs in for the first time has no
agreed shapes, so the first round is a **union**. Nodes Fos may not store
(storage switched off) are never visited.

## Scopes (attaching at a child node)

Nothing outside the attachment reaches the device. Changing which node a device
syncs requires a fully synced replica.

## Tree, order and moves

Child **order is part of a node's identity**, so reorders replicate like any
other change. The merge keeps order: ours' order is the backbone and children
added by the other side are placed next to the neighbour they follow there;
when both sides reorder the same children, ours wins and no choice is raised.

## Mutable references

There is one mutable-reference construct, the language design's ALIAS node.

### Proposals

Invited peers never change a link's main value.

### Pull requests, approvals and merge rules

A submission named for a branch is a proposal whoever sends it, owners included:
it never writes main. Names are labels and replacement keys only; no kind of
submission is told apart by its name.

**One acceptance.** Every submission to a mutable ref (a node's edits, a pull
request, a value for a ref, an evaluation request, a visitor's input, a library
update) is accepted the same way: whoever accepts it approves it, and it is
applied once the node's merge rule holds. The owner's own writes of a ref value
are not submissions.

- **The approval.** Approvals belong to the submission: a new content is a new
  submission. An attested approval should be checkable by anyone.
- **The merge rule.** A pattern of approval rows, one per required approver.
  Without one, the default: one approval by any peer that may change the node
  directly, the owner or a member that may edit there, other than the proposer.

Still to do: relaying a pull request to an offline holder.

## Requirements, resource banks, queries and the market

**Arguments: requirements and allocations are one kind of row.** An argument
row is `[pattern, ref]`: a declaration whose pattern is a capability refined
with what is demanded. Its polarity says which way the value goes. A pattern
carrying a `negative` row *asks*: the row is a **requirement**, and its ref is a
hole until a value satisfying the pattern is bound to it. A pattern without one
*supplies*: the row is an **allocation**, and its ref holds the value. Nothing
else exists: there is no requirement record, no separate result ref, no supply
record. Supplying a requirement is binding its ref the way any ref is bound,
and it is satisfied when the bound value satisfies the pattern. A task must not
be marked done while unsatisfied requirements remain under it.

Negative allocations are satisfied only by a **grant**. A positive allocation
holding plain data is not authority and does not fill a requirement for
authority.

**Values of a pattern.** A refinement (an amount, an option, a row the value
must contain, a contract pin) constrains the value's content and is not
carried. A library row type is a row's instruction, never its value's
predicate, and a pattern with no structure of its own (a bare capability)
selects candidates by their declared type, not by value.

**Resource banks.** A value without the bank's contract pin is data, whatever it
says. Negative grants retire authority, and there is no separate capacity.

**Resource authority is linear** and moves only through an **invocation** of
the `allocate` handler the scope resolves. The handler must check the
invocation whole (inputs consumed exactly once from one bank, outputs conserving
the amount, no contract change) and answer values; it writes nothing. A
destination whose accepted value changed in between must be rejected, and the
writes discarded when the run fails. Nothing is live before commit; binding a
grant by hand is refused. Using an offered allocation in an execution authors
the invocation and evaluates it; nothing else records consumption.

Planned: signing grants, combining several grants into one requirement, and
consuming within one evaluation what an earlier step issued.

**Terms.** A *store root* is the top node of one store; every replica has one.
The *device root* is the store root of a device's own replica. A *mutable node*
(ref) is any node with a stable alias whose content changes by version; rows
are mutable nodes.

**Scope constraints.** Both sides of a row must resolve from its parent scope.
Only direct declarations in enclosing scopes may contribute ambient bindings;
siblings' descendants must not leak into scope. Explicit identity links may
address nodes elsewhere through the shared ref resolver. They must not create
a second name-lookup mechanism. A nested store must retain its enclosing graph
scope, including when it is copied for evaluation or exchange.

Every lookup by name or by kind (a library instance, a named binding, a ref
path's first name, a template by name, a peer's nearest member entry, the market
grant, a local checkout) follows one rule: the nearest enclosing scope that
declares anything answers; several declarations there are ambiguous; a
declaration there that cannot be used (unavailable, denied, cyclic) blocks the
lookup. None of these fall through to an outer scope. A nearer name hides an
outer one whatever its type. An unfilled declaration is a hole, bound from
further out, and hides nothing. Collecting the alternatives of a type (handler
discovery) is not a lookup by name: it reads every visible declaration, only
the same declaration identity shadows, and more than one candidate is a choice
for the owner. Bindings are declarations; text such as `key: value` titles or
frontmatter is text, never a binding.

**Executor selection.** A step runs through exactly one executor. Every host
lists the executors it has for a step and the shared evaluator selects: one
runs, several are a problem the owner resolves in the graph, none leaves the
step to its requirement. No host may pick by ordering.

**Stores on one machine.** Every `.fos` store is a device root of its own. What
crosses a link between stores is only what the grants allow, through node
exchange, never by reading the other store's graph directly.

**Row types.** A row is told apart by its left node alone; there is no row kind
and no `builtin:` behavior marker. Data from before data version 0.0.1 is not
migrated. New rows must use the library instance declared in the nearest
enclosing scope. The instance shadows the whole namespace: missing fields must
fail rather than falling back to an ancestor or the build bundle. A library ref
is found by what it holds, not by a name. The device root's library is local to
that device. A library shared across accounts is an ordinary ref someone
publishes to its members; its members may explicitly bind a local instance to
that version. A changed row type is a new version: new rows are made from it,
rows made before keep the version they pin. Every row on the wire names its
template; a peer missing one shows the row as a reference error and asks for it.

**Placement constraints.** A placement policy must hold its predicates as graph
edges and match the child's pinned instruction. Use structural matching by
default and exact CID equality when the policy explicitly requests it. A
wildcard makes the other rules exclusions; without one, declared rules form an
allow list. No policy means no placement restriction, but a malformed policy
must fail rather than silently become unrestricted.

Constructor identity is its CID. Library field names are bindings for reaching
that node; renaming a binding must not change a pinned row's meaning. A
constructor may carry an ordinary name row containing a string, which a graph
predicate can constrain. Neither placement nor native classification may
recover meaning from a reverse index of library names, unrelated scopes, or
library history. These constraints must hold after upgrades, reload, and exchange.

**Store roots and Home are types.** Only a Device root accepts **Home**; nothing
accepts a store root. So Home lives only directly under a device root.

**Type errors.** A local edit that would put a row where its parent's type does
not accept it is refused. A received row in such a place makes its parent a
**type error**. Type errors are derived, never edited.

**Templates.** An execution of a template pins the template version it was made
from; editing the template later does not change existing executions (upgrading
one is explicit). Copying a subtree that holds both a template and its
executions pins the copies to the copied template.

**Peers and capabilities.** A capability no handler backs is never offered.

**Peer policies: nothing moves in a direction that is not listed.** A peer never
adds rows to another peer's context; it can only be queried for them. Every peer
relationship has two directions, each a list of capabilities: `to` is what this
side lets the peer have or do, `from` is what this side takes in from the peer.

Banks are ordinary rows in the tree.

Handlers run as effects when their requirement is completed; there are no routes
per handler.

**Organizing captures.** A capture is organized into one node as an effect, not
through a route of its own. Its result is one submission by the `fos` peer on
the target; main is not changed. Accepting it is a single local edit, so one
undo takes the whole capture back.

**Search is a handler, not a route.** The client never searches itself. Which
rows inside a search requirement are the query and the old hits is decided by
their row types.

**The market is a peer.** A node is listed iff the market peer is a member of it
with `read`; with `edit` it also takes proposals. Unlisting is removing the
member (or switching its `read` off); there is no other flag. A listing shows
the requester only its own proposal (no peers, members or other bidders).
Bidders never see each other's proposals.

## The `fos` binary: GUI and CLI over one context

Both modes act on a *context directory*, so the GUI, the shell and local agents
are one device. The sync core is not reimplemented in Rust.

Signing in never types a password into the terminal by default.

A directory inside no configured project becomes a store of its own on first
use; it never falls back to Home's state.

**Git branches are proposed values.** Each branch has its own replica, so the
node holds one proposal per (device, branch). A proposal's summary diffs against
the main content it was based on, so work landing on main later never shows as
"removed".

## Attachment and presence

A device's attachment persists until someone removes it deliberately: the owner,
or the device itself. Signing out keeps the attachment. Whether a device is
currently connected is separate.

## Connecting a device

A device never signs in on its own with built-in credentials; production bundles
contain no credentials. A peer credential is confined to its scope. Direct,
device-to-device connection needs no account.

The UI never sees cids.

## The standard library

### Shared frames and refs

A group should be the common lexical ancestor of its members' participation.
Peers may keep separate private roots and separate replicas of the group. Shared
refs should be declared in that group, so its graph exposes the relationships
between participants. Membership must not make a peer's private tree searchable.

Bindings, links, and peer services must use typed refs and handler assignments.
Identity lookup must obey the same parent-scope rule as name lookup. An editor may
locate a source anywhere it can read, but creating a live cross-subtree link must
put its declaration in the lowest common scope and reference it from both sides.
Moving that declaration must preserve its dependencies; otherwise require the
dependencies to be declared and passed explicitly, or offer an independent copy.

UUIDs should serve only local editing and UI identity. Typechecking and compilation
must turn graph references into CID references before evaluation. Compiler source
maps and diagnostics may identify editable rows; they must not enter executable
graph content or act as a runtime lookup service. Open parameters must have
content-addressed binders, and mutable access must go through graph capabilities
and their handlers. Changing only editor UUIDs must preserve compiled meaning.

A ref declared outside a group may be passed as an ordinary typed argument.
The receiving participant must supply its own handler when the value requires
remote execution or message passing. Cached remote content must not substitute
for that handler or for permission checks. A nearer handler of the same ref may
override it locally; it must not mutate the group's accepted value. Multiple
handlers at the same level remain alternatives requiring a choice.

Copies and published template values must not retain hidden links into a source's
private scope. External references must become closed values or remain explicit
inputs requiring a handler. Internal references must retain their relationships
under fresh copy identities. A missing source must never count as a fulfilled
requirement merely because its UUID was supplied.

Both instruction and argument lookup must start at the row's parent scope.
Declarations inside a row belong to its children. Search only direct declarations
in each ancestor; never siblings or descendants. Multiple library instances in
one scope must be reported as ambiguous. Library fields and capabilities must
resolve through the selected instance, including in nested stores and drafts.

An explicitly supplied argument must take precedence over ambient name lookup.
A structural path to an ancestor selects that ancestor's declaration; a nearer
declaration with the same name must not redirect the argument. Unqualified names
should use the nearest provided declaration. An unfilled parameter may request
fulfillment from outside, but an explicit reference to an unfilled declaration
must remain unfilled rather than borrow a different same-name provider.

Resources, supply evidence, ordinary arguments, and advertised handlers must
share declaration resolution, source scopes, submissions, and availability
checks. Member advertisements belong to their declaring group. Disabled or
inaccessible declarations must not expose an outer provider as a fallback.
Preserve every assignment to the same ref for conflict checking; never resolve
contradictions by traversal order.

Several peers providing Tools must submit explicit alternatives to one shared
capability node in the group. Local handlers must use that same graph
relationship. Repeated names alone denote assignments to one ref, not
alternatives. Withdrawing one explicit alternative may leave others available;
it must not expose an outer same-name assignment as fallback.

Amount and choice projections of a requirement may supply values; an amount
alone must not authorize spending, which is an allocate invocation over a
bank's grants ("Resource authority"). Workflow fulfillment must supply
independent evidence, not a circular reference to the task whose completion
depends on that requirement.

Pinned definitions must survive library upgrades and reloads. Native offers must
be addressed by their capability node. Restoring a native implementation must
not restore a withdrawn offer. Trigger behavior must come from the selected
instruction node's own definition, with no name-based default.

Library definitions should be editable and shareable through ordinary graph
operations. Merely editing, importing, or opening a definition must not change
which version consumers use. An explicit instance selects a version; an explicit
upgrade changes that selection. Menus, named constructors, manual handlers, and
execution must all use that same selection. Existing rows must keep the nodes
they were constructed from.

Clients carry the library in their bundle so a device that never goes online
still has its templates.

**Manual fallbacks.** The library carries a manual fallback for each kind of
requirement, so fallbacks work offline from the shipped library and are edited
like any other rows. Combinations of capabilities are never new primitives:
product = several rows in a node, coproduct = submissions on a mutable ref
decided by a choice handler, exponential = composition through templates.

## Relay: queues for offline peers

The durable queue for a device that is offline is a standard-library handler,
not a server feature: any peer can run it. Its rows are recognised only by the
row edge's left node; no flags or row kinds.

There is no delivery path of its own: member entries travel by node exchange.
An invited recipient never writes member entries. Other peers never see someone
else's entry.

## Users

`@name` in a row is never stored as text. It is shorthand for a **user
object**, recognised by the type of the edge's left node. Verifying is an effect
like any other (no user or key route). **The verifier's key is graph data.** The
server must re-check an attestation whenever it acts on an object read from a
graph, so a tampered, unverified or foreign object is refused regardless of the
client. A self signature alone proves possession of the key, not the account.

## Next steps

* Assignments (`-@name`) should reach the assignee's replica through the
  proposal path.
* Redeem a sub-grant against its issuer chain, and settle a negative grant with
  the issuer of its parent.
* Represent time in the graph so bounds on banks, grants and allocations can be
  checked for containment and overlap.
* Payments, payouts and calendar events are to become ordinary invocations of
  their capability with declared result contracts.

### Non-replicated provider rows

View-only provider rows never enter the replica, undo history, exports, peer
sync, or agent graph context. File contents remain outside the replica. `.fos`,
`.git`, and symbolic links are excluded. Native folder queries are confined to
the linked root.

**File references.** A row is a file reference because its type node is a version
of that type, never because of other data. The file itself is never stored. A
missing type must require an explicit library upgrade; runtime lookup must not
use a build fallback.

Binding a CLI replica to the node and launching a terminal remain follow-up work.

### Node-scoped agent connections

Agent connections expose exactly the tools their Read / Write / Execute grants
allow. Switching every grant off ends the connection.

An agent is an invited peer at the selected node: it reads what its grants and
field masks allow, and its proposals become pending proposals for the owner's
approval workflow; agents cannot merge them. Proposals require the revision
returned by a read.

Hosted connections use a scoped peer credential, never the owner's login token.
Credentials are kept outside the graph. Disconnecting removes the peer; removing
its grants also prevents further node access.

### Claiming work through MCP

Claiming requires both `execute` and `edit`. A stale, expired, or another
session's claim ID fails; it never falls back to a broader attachment. General
tools are rejected during a claim. Submission does not bypass approval: a
proposed completion still awaits review.

Leases need no new row type or task-specific workflow template. Independent
offline replicas/processes are not a distributed lock service; syncing their
lease records cannot guarantee exclusive acquisition during a partition.

### Template triggers and execution

Observers must not dispatch over a list of event names. Removing or disabling an
observer's ref stops its subscriptions. Restoring host implementations after
reload must not register absent declarations.

A row is `[left, right]`: its left can be a type, data constructor, capability
or function; its right can be an argument, handler or composed function. A typed
right ref remains a row, and its own type does not replace the left instruction.
JavaScript objects are an adapter at the host boundary, not stored JSON records.
Properties have independent identities and can be addressed, edited, merged and
permission-masked individually.

Public and Fos template entry links stay reusable. Each visitor gets an
independent private instance; returning visitors resume that instance. Copying a
private URL does not grant access. Revoking membership or disabling/reconfiguring
the entry revokes instance access.

Hosted execution accepts only declared, visible inputs. The owner's bank changes
only when the evaluation commits.

### Published nodes

**Publishing is membership.** A node is published to an audience when that
audience's peer is a member of it that may run it (or read it). There is no
publishing route and no share id. No permission reads as no node. A visitor's
input and votes need both the visitor and its audience to allow them. Each
visitor who starts a published template gets a private execution.

**Rows render by type**, and nothing else tells rows apart. Bindings are not
resolved, since arguments are never exported.

**Visitors' answers are submissions.** The owner accepts or rejects them like
any submission.

Planned: a payment form for visitors, and messages to online visitors.

### The event grammar: one vocabulary for every transport

Every input surface is an adapter of one grammar. Handlers never change per
transport, and a new transport is only a new adapter. The transport supplies the
principal (who acts, at which attachment); an event can never widen it. Stale or
undeclared submissions are rejected. External effects run only through the
host's handler registry.

**Choices are inputs.** Deciding a choice from the answers is a handler's job,
composed in the standard library, not a built-in poll. A visitor's approval of a
pending proposal is an approval like any member's; it merges the proposal only
when the node's merge rule holds, and visitors are not approvers under the
default rule.

**Evaluation requests.** A peer that may edit but does not own the node cannot
run effects. Its `complete` becomes its submission on the node, accepted only
where some peer in that context offers the `request` capability.

There is no separate evaluation endpoint or SDK run.

### Editor, interaction, and analysis

The main editor is always a tree. Play opens a node's interaction view without
adding a constructor or changing graph content. Analysis is read-only and does
not traverse peer references.

Reads by attached peers respect node and field masks; inputs and submissions
require edit permission on their target; completion by a peer is an evaluation
request. Revoking the peer removes access. Executing effects on a shared
original requires explicit edit permissions.

## Patterns, solve and fetch

Using a pattern submits values to the use site, so the shared pattern is
unchanged and each use is its own scope. A solve submits each solution as an
option; nothing is bound until one is chosen.

Next: the inverse of fetch, a positive (supplied) `fetch` that accepts requests
instead of sending them, as allocations are the inverse of requirements.

## Structural row patterns

A row is [left, right]. The left is its instruction/pattern (type, constructor,
capability, or function); the right is its argument, handler, or composed function.
A node has no independent type annotation. Ref construction adds an ALIAS row and
an optional TARGET; it never adds a type instruction pointer.

Patterns are graph nodes. Required rows are products; choices are sums. Both
sides match recursively. Empty pattern values are unconstrained. Alias
identities, history, and presentation do not establish a type. Each actual
alternative must satisfy a whole allowed pattern; alternatives cannot supply
separate parts of one product.

Values and their descendants load under their own permissions. Binding,
submission validation, and execution use structural matching. Partial
assignments may retain UUID holes; that does not make an input executable.
Compilation preserves sums as choice rows and retains outstanding hole identities
alongside the residual CID. Run requires a closed left side; right-side outputs may
remain open. Library names and editor placement policies are adapters, not
intrinsic node types or an alternative handler registration mechanism.

### Private graphs and permission constructors: required next boundary

A server-private graph must have a separate store and persistence boundary from
the account graph served to clients. It must not be a lexical parent of a client
graph, an imported subtree, or part of its template/grant exports. OAuth
credentials must stay isolated from the account graph, including when they are
converted to rows.

A permission application should be an ordinary row: a permissions constructor
on the left, the protected ref on the right. The left constructor's rows supply
read, write, and execute restrictions, with authenticated principal/scope context.
These operations are independent. Restrictions intersect along an authorized
path, missing private-graph grants deny access, and changing the governing policy
requires separate authority; editing a submitted value cannot grant that authority.

Expose a public callable ref whose signature can be read independently of its
implementation. Execution resolves the private handler and credential refs on the
server under server authority. The client can compile the public call without
reading the private dependency graph. Execution does not authorize exporting that
graph or returning its secrets. Enforce the same boundary for sync, templates,
history, search, logs, and effect results before claiming private-graph isolation.
