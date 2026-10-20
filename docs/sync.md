# Offline/online sync

## On-demand node providers

`shared/sync/node-provider.ts` separates `provideNode` from the optional `sync`
capability. Fos and web peers advertise both. `provideNode` returns one logical
node's permitted data and child addresses; it never sends descendant values,
history, proposal contents, or reference targets. `pullNode` only tries the supplied
associated peers that advertise the capability. `pullNodeTree` is an explicit,
bounded eager handler that uses the same checked request for every node.

HTTP uses `POST /user/data/peer-sync/provide-node`; WebRTC uses `node` and
`node-result` messages; virtual tabs use their existing per-invitation channel.
The transport supplies the authenticated peer and attachment scope. Requests
cannot widen that scope, traverse a reference, or bypass a revoked child grant.
Authorization is checked against current main-branch policy on every request.

Each linked node has two distinct mutable endpoint refs. Their `ref` values name
the opposite endpoint's alias and peer; their TARGETPOINTER values hold their
own masks. The endpoints are stored on each peer's private root alias, outside
the shared root target, and survive commits and serialization. They are never
merged into each other's policy. `setNodeLinkMask` sets field/child allowlists:
omitted means all, and an empty list means none. Ancestor field masks also apply
to direct descendant requests. A changed request ID cannot bypass a mask.
The Permissions constructor is available on a node and beneath individual peers.
Node-wide defaults and per-peer field/child allowlists are private local policies;
new links inherit parent grants and masks. Explicit masks intersect with inherited
ones, so a descendant cannot widen a parent boundary. They filter both incoming
projections/changes and outgoing data. Policies can be configured before pairing;
the first handshake preserves them and fixes the opposite endpoint identity.
Connected endpoint rows also expose field and child-reference switches under
Connection and capabilities. These edit only this device's endpoint.

Visible peer-held rows request their content automatically, with at most four
viewport requests active at a time. Offscreen rows wait until visible. Opening a
peer-held row also requests it immediately; descendants stay unloaded until needed.
The web controller checks the connection and current replica before accepting
an asynchronous result. Requests for the same row share one in-flight promise.

All synchronization (web/account, direct, virtual, the manual relay and the
`fos` CLI) uses `shared/sync/node-sync.ts` through the node-provider transport;
see "Node sync" below. Each exchange
contains only shallow field/child-reference deltas. Polls refresh the attachment
and displayed path; edited materialized nodes are sent independently. Unopened
remote descendants stay unloaded. Per-peer shallow baselines survive reloads.
Existing child bodies, grants, and hidden children survive shallow updates.
Concurrent edits to different fields merge; overlapping edits fail without
replacing either value. In-flight local edits are rebased before installation.

Invited account peers and virtual proposers write into their own pending values;
main stays unchanged until the existing approval operation applies the proposal.
Reviewers receive proposal identifiers/status, without descendant contents.
Current main grants are checked even when serving a pending value. The
proposer is served its submission rebased onto main as it is now, so it sees
main's changes and keeps its own rows. A rejected submission stays in the list,
marked rejected and below the open ones (`readProposals`); only a re-submission
with different content opens it again for review.

Branch selections travel as explicit scoped contexts. Shallow baselines are keyed
by branch, and updates restore only the selected alternatives, preserving main.
Every branch request is authorized against current main grants and link masks.

Reviewers open **Branches**, select a pending proposal, then choose **Approve and
merge** or **Reject**. Approval requires owner access or `edit` (deciding submissions is how edit is exercised on a node with several peers; there is no separate approve grant);
it merges the pending value against its saved base. Proposal previews fetch one
node at a time into a separate read-only replica. Rejecting leaves main unchanged.

Browser providers register their attachment scope and `provideNode` capability on
the authenticated account WebSocket. HTTP can pull a browser-held node through
that socket, using a reference already stored by the server. Requests are bounded,
time out after eight seconds, and recheck grants and reference identity before
saving the answer. Offline providers remain unavailable; there is no bulk fallback.
Relayed children must belong to the same provider at the expected child address;
foreign reference targets require a separately authorized attachment.

**Nodes shared across accounts.** An owner shares a node with another Fos user by
granting their peer `user:<name>` capabilities on it (the `to @name` chips on the
peer row: `read`, `edit` = submit and decide proposals, and `execute` = run
evaluations). The recipient opens the node from the ref in their Home
(`App.openSharedNode`): `GET /user/data/peer-sync/locate?owner=&id=` answers
where it lives in the owner's account and what they may do, then the same
`provide-node` route with `owner` in the body serves it as that account's peer
`user:<me>` (`proposeOnly`, so every edit is their `node-sync` proposal on the
owner's node), and the row becomes a live projection: the tree view edits it,
children load the same way, `Analyze` reads what is loaded, and `Run` sends a
`complete` event with `owner` (`POST /user/data/events {event, scope, owner}`),
which the owner's host runs through its registry when `execute` was granted.
Without any grant (a bare market listing) the read-only market view opens
instead. The device remembers these projections in `meta.sharedNodes`.

Run the provider, HTTP authorization and bidirectional transport regressions with
`npm --prefix web run test:nodes`.

## The replica

How a device keeps working without a server and merges back when it signs in.
Code: `shared/sync/` (core, shared by every peer), `backend/sync/provideNode.ts`
and `backend/sync/accountStore.ts` (the account's side), `web/src/app.ts` (the
device's side). The same `web/` build runs in the browser and inside the Tauri
shell on desktop, iOS and Android, and the `fos` binary embeds the same core.

Everything is expressed in the existing hash-consed graph (`shared/dag-implementation`):
there is no separate sync data model. The account's document is a FosStore; a
device's replica is a FosStore too, plus what node sync agreed on with its peer
for every synced node (`meta.nodeSync`).

## Representation in the graph

All structures use existing primitives. Identity across versions is
`data.alias.id`, the same mechanism the root alias uses; a node's cid changes
on every edit, its alias id does not.

```
row         [template, rowNode]          rowNode.data: alias{id}, description{content}, updated{time}. The template (the instruction)
                                     says what the row is: a node with data.instanceKind, either a row type (see "Row types" below) or a
                                     template row the row was made from, pinned by the cid of that version's content. Row types by kind:
              Task        task      + todo{completed,time}                         (checkbox; "[ ]"/"[x]" prefix in the add bar)
              Row         plain     the default row: text with links/embeds
              Note        note      description.content is a markdown body (">" prefix); child rows are variables (key: value,
                                     or a row's title → its body / sub-rows as a list; ref children link other blocks); {{key}} / {key}
                                     expand; "Export note" downloads merged frontmatter + expanded body; KaTeX and Mermaid render
              Comment     comment   + comment{authorID,authorName,time}  ("//" prefix or the menu; replies are child comments)
              Reference   ref       + ref{id, owner?}: stands for the row whose alias id is `id` (Alt+drag); Ctrl+drag places a deep
                                     copy; `owner` marks a market result (the row lives in another account; click opens the listing)
              Allocation  requirement  an allocation row with a negative amount: what a task needs ("-" prefix, under a task;
                                     capability = task | allocation | search | confirmation | choice | market | mail | peer)
              Allocation  supply    an allocation row with a positive amount and a capability: satisfies a requirement (`ref` names an
                                     allocation/query row)
              Query       query     + query{market?}   ("?" prefix; inside a `-?` requirement, which the fos search effect fills)
              Resource    resource  + resource{type: calendar|account|inventory|person, unit, capacity?}   ("@calendar|@money|@inventory|@person name [capacity]")
              Allocation  allocation + allocation{resource, type, amount, unit, start?, end?, by?, person?}
                                     ("$ 50" money, ": 1h" time, "# 2 widgets" things, "@bob 2h" a person; optional window
                                     "2026-10-13..2026-10-20" after the amount, start = now / end = forever when absent; drawn from the parent
                                     context: the bank above, the bank the requirement names, or the type's default pool = first top-level bank)
              Template    template  + instanceKind{kind: task}: its requirement rows are copied under every task made from it
                                     ("`name" prefix; "[ ] `name` …" makes the task [Trip's content, taskNode])
reference error  [missing, rowNode]      the row is pinned to a template this peer has not received; `missing` is a stand-in template
                                     (data.missingTemplate{cid, kind}). Node sync reports it as the row it stands for, asks the peer
                                     for the template (NodeRequest.templates / ProvidedNode.wanted) and pins the row once it arrives
peer        [PEER, peerRefNode]          peerRefNode.data: peerId{content}          (membership.ts reads the same shape)
choice      [CHOICE, choiceNode]         an unresolved divergence, replacing the task/node edge it concerns
              choiceNode.data: alias{id of the thing}, conflict{path}, option{defaultResolutionStrategy:'choice'}
              children: [CONFLICTBASE, ptr] [NOTSELECTED, ptr] [NOTSELECTED, ptr]
              ptr.data: peerId{content}; children: [INSTRUCTIONPOINTER, instr] [TARGETPOINTER, target]  (no pointers = deleted)
root        the store's root alias: [TARGETPOINTER, content] [INSTRUCTIONPOINTER, ROOT] [PREV, previous root] [MERGESOURCE, merged root]?
```

A choice is a OneOf node whose resolution strategy is "choice": the thing's
value is one of the listed versions until a user picks. Because it is ordinary
graph data it replicates like everything else and any device can resolve it.

## Merge (`shared/sync/merge.ts`)

`mergeNodes(store, base, ours, theirs)` is a three-way merge of content nodes,
where `base` is the node both peers last agreed on. Children are matched by
identity key (alias id of the target, else of the instruction, else the edge
itself as an immutable set member). Per child:

| base → ours / theirs                        | result                                               |
|---------------------------------------------|------------------------------------------------------|
| only one side changed                       | take that side (add, edit or delete)                 |
| both changed identically                    | take it                                              |
| both changed, same shape (task/task, node/node) | recurse: data merged field by field, children merged |
| same data field edited to different values  | leaf (task): **choice** with both versions; container: theirs wins for that field |
| one deleted, the other edited               | **choice** (one option is "deleted")                 |
| a choice resolved on one side only          | resolution wins (the other side still holds the base) |
| the same choice resolved differently twice  | a new choice                                         |

`updated.time` merges as the maximum; `versionControl` is dropped. Edge order
never affects a cid (`hashContent` sorts edges), so the merge is deterministic
and, apart from container data conflicts, symmetric.

`resolveChoiceIn` replaces a `[CHOICE, …]` edge with the picked option's edge
(or removes it) and stamps `updated.time` so the resolution counts as an edit.

## Node sync (`shared/sync/node-sync.ts`)

A device syncs with a peer one node at a time. For each node it holds a record
of what both sides last agreed (`meta.nodeSync`, keyed by peer, path and branch
selections): the node's shallow shape (its data and its children's ids, kinds,
addresses and pinned templates) and what the peer last provided.

```
device → peer   NodeRequest  { peerId, scope, path, linkId, branches?, update?: { base, value }, templates?, templateNodes? }
peer → device   ProvidedNode { data, children, mask?, proposals?, grants?, capabilities?, wanted?, templates? }
```

One node's round (`planNodeSync` → `nodeSyncPush` → `finishNodeSync`):

```
plan    local shape vs the agreed one → dirty?   (a writer asks with an empty update so the answer says what it may write)
push    if this side changed it: update { base: what the peer provided, value: three-way merge of the change onto it }
finish  install the answer, merged with whatever changed here while the request was in flight; remember both shapes
```

Concurrent changes to different fields or children merge; the same field
changed on both sides is refused (`Concurrent change to node field …`) and the
local value is kept. A child the device adds is sent as a reference to the
device in its parent's update, and its content in its own round. Afterwards
`nodeTemplateRequests` asks the peer for templates this replica lacks
(reference errors) and answers the ones the peer asked for (`wanted`).

Switching Fos storage off on a node (`persist`): the next sync sends the node
blank (`blankNodeRequest`). A holder sending a node blank means it is no longer
available there, so the account keeps it as a node that device holds, like any
peer-held node (the peer marker), with what it had before as its previous
version, and nothing below it is sent again. When storage is switched back on,
the device's content is the next version after that blank one.

A receive-only round (`push: false`) sends no update: what the peer has
becomes the agreed shape, and local changes stay unsent (`isDirty`).

The web app syncs the attachment, the path on screen and every node edited
here (`App.syncNodes`). The `fos` CLI syncs the whole tree (`nodeTreeSync`, a
generator the binary drives through `nodeSyncBegin` / `nodeSyncStep` in
`embed.ts`): the attachment first, then every child the peer's answer lists that
is here or held by that peer. A child the peer holds only as a reference to this
device is pushed, whatever was agreed before. `syncNodeTree` drives the same
walk over an async transport. Nodes Fos may not store (`persist` switched off)
are never visited.

A device that worked offline and then signs in for the first time has no
agreed shapes, so the first round is a **union**.

## Scopes (attaching at a child node)

A device's own rows live in Home, the node it syncs with its account
(`localScope = [fos:home]`); the rest of its root stays private to it. An
invited peer attaches at the node it was invited to (`meta.scope`, its replica's
root is a copy of that node). Nothing outside the attachment reaches the device.

Changing which node a device syncs (`reattach`) requires a fully synced
replica. The agreed shapes stay, so moving back onto a node synced before
resumes it.

## Tree, order and moves

Tasks contain tasks: a task edge's node carries its own task edges, so the
view is a tree and a scope path is a path of node ids
("zoom" shows one node with its subtree). Child **order is part of a node's
identity** (cid v2 hashes edges in order), so drag-and-drop reorders replicate
like any other change. The merge keeps order: ours' order is the backbone and
children added by the other side are placed next to the neighbour they follow
there; when both sides reorder the same children, ours wins and no choice is
raised. Moves use the same above/below/into semantics as
`FosExpression.moveNodeAboveRoute/BelowRoute/IntoRoute` (`moveChild` in
`graph.ts`); the drop position comes from where the pointer is on the row
(top quarter above, bottom quarter below, middle into), as in the old tree.

## Mutable references: the root, link nodes and reference rows (the git-like part)

There is one mutable-reference construct, the language design's ALIAS node,
and it is used in three places:

```
ref node   data: alias{id} (+ ref{id} for a reference row)
           [TARGETPOINTER, valueCid]       the current value (content node: description, todo, rows…)
           [INSTRUCTIONPOINTER, typeCid]   optional type (the root points at ROOT)
           [PREV, previousRefCid]*         history: one per parent version, two after a merge that changed the value
           [MEMBER, ref]* [PROPOSAL, p]* [PEER, ref]*   who is attached to the reference
```

- **The root** of every replica and of the user group is a ref node; `commitRoot`
  advances it (new ref node, PREV → the old one, MERGESOURCE → a merged root).
- **A link row** (what devices are invited to and propose against) is a row
  whose identity node is a ref node: `[template, refNode]`. Its text and rows are
  read through TARGETPOINTER (`valueContent`); an edit inside it advances the
  ref (`relinkContent`: new ref node pointing at the new content, PREV → the
  old ref node, bookkeeping carried over). Members, proposals and attached
  peers live on the ref node and never create versions. `makeLinkAt` turns a
  plain row into one; `linkHistory` walks PREV; `NodeView.versions` counts it.
- **A reference row** (Alt+drag) is a ref node too: `data.ref.id` names the row
  it stands for and TARGETPOINTER holds a snapshot of that row's ref node
  (referencing a plain row makes it a ref node first). It is resolved live by
  id (`resolveRef`) and its own value is never followed as content.

Merging two versions of a ref merges their values (recursively, like any
node), unions members/peers/proposals, and records both parents in PREV only
when the value actually changed; a bookkeeping-only merge is not a version.
Branch mode (`serveProposal`) hands an invited peer a ref node with the same
identity whose value is the peer's branch plus the node's bookkeeping, so the
peer keeps building on it; a rejection or another device attaching is served
as `pull` (bookkeeping changed) and the next sync is a `noop`.

Older data kept link nodes inline (`data.link` with the bookkeeping edges on
the content node). `normalizeRefs` rewrites those into ref nodes when a replica
is loaded and when the server loads a store; it is deterministic, so every
side converges on the same nodes, and the old PREV edges are kept as history.

### Proposals

Invited peers never change a link's main value: in branch mode the server
records each peer's head as a `[PROPOSAL, p]` on the ref node (proposal.ts
shape: PROPOSALNAME, PROPOSEDCONTENT, SENDER, TIMESTAMP, PREV = the main
value it was based on; `data.proposal.status` open|rejected), one per
(peer, git branch), rebased onto main when main moved. A member with `edit`
(`[CAPABILITY, PROPOSE]` on its MEMBER reference) merges
it (`applyProposalAt`: three-way merge onto main, new version, proposal
removed) or rejects it (kept, marked rejected; a further edit by the peer
reopens it). The link panel shows members, version count and proposals with
an added/changed/removed summary against the proposal's base.

## Requirements, resource banks, queries and the market

**Requirements** (`-` prefix, under a task) are what the task needs before it
can be completed. `-` is a modifier: what follows it names the kind of child
row that fills the requirement. `-[ ] text` needs a task inside it to be done;
`-$ 50 text` (or `-@account 50`, `-@calendar 1h`, `-@inventory 2 widgets`)
needs an allocation of that resource and amount inside it; `-? text` needs a
query inside it to have been run; `- text` needs a confirmation (a signed-in
person presses Confirm) and `-choice: a | b` a decision; `-market text` and
`-mail text` are handled by a peer that registered that capability; `-@name
text` assigns the task to the peer `name`, who confirms it. `taskBlockers`
lists the unsatisfied ones; `setTaskDone` refuses while any remain and the UI
disables the checkbox (`needs n` badge). `requirementSatisfied` first looks for
a child row of the required kind (a done task, an allocation whose type and
amount fit, an executed query), then for a **supply** row (`addSupply`): who
supplied it, when, and for allocations/search optionally a reference
(`supply.ref`) to an allocation or query row elsewhere by alias id; a `peer`
supply counts only when `by` is the named peer. A reference it cannot resolve
is trusted (it came through a proposal from another account).

**Resource banks** (`@calendar`, `@money`, `@inventory`, `@person <name>`,
`@points`, optional capacity) hold **allocations** and sub-banks as
children. Each resource type has a marker: `$` money, `:` time, `#` things,
`@name` a person, `ff` fos points, `at` a place (`-$`, `-:`, `-#`, `-@name`,
`-ff`, `-at` for the matching requirements; `-at Eiffel Tower` needs a
location allocation at that place, by name or by a device's position). A
place at a time is not its own kind: it is the product of a location row and
a time row in one node (the library's "Meet up" template). Fos points are the account's token balance
(`GET /tokens/balance`, shown on the fos row); an `ff` allocation with no
`@points` bank above draws from that balance (`resource: 'fos:points'`). A
`-ff N` requirement under a task is a **payout**: when the task runs, the fos
`points` handler moves N points on the server's ledger from the owner to the
respondent (the signed-in user whose supplies filled the task's other
requirements, or the user named with `@` on the row) and records the
allocation and supply as `fos` (`backend/sync/hostHandlers.ts`). A `-$ N`
requirement is likewise a **payment**: the fos `send-payment` handler opens one
with the account's payment provider (Stripe Checkout, paying the respondent's
connected account; `backend/payments/stripe.ts`), records it on the requirement
as a `fos:payment` value and leaves the evaluation `awaiting-review`; the
provider's webhook confirms it later, even with every device offline, and the
server then writes the allocation and supply as `fos` and resumes the
evaluation (`backend/sync/payments.ts`, `shared/sync/payments.ts`). Running
the task again while a payment is open does not open a second one; an expired
page marks the record failed and the next run opens a new payment. Payees set
up payouts from the Stripe peer (Connect onboarding). An allocation is
*taken from the parent context* (`App.bankFor`): the nearest bank of its type
above it, or, under an allocation requirement, a bank of the resource the
requirement names, or the type's **default pool**, the first bank of that type
at the top level. It may carry a **window** after the amount
(`$ 50 2026-10-13..2026-10-20`; start is now and end is forever when absent),
so every resource has its own calendar; a person allocation without a window
needs no bank, with one it needs that person's bank (`@person bob 40h`).
`allocatedIn` sums allocations in the subtree, the view shows
`available = capacity − allocated` (windows are recorded, not yet checked for
overlap). `requirementProgress` reports how much of an amount is covered by
the allocations inside a requirement and the ones its supplies reference;
several smaller allocations add up, and `-@name` is filled when that person
allocates themself inside it. An allocation row is a normal row: type it
inside the requirement, drop one onto the requirement (a supply referencing
it; the allocation stays in its bank), Alt+drag a reference, or pick an
existing one in the requirement's picker. Dropping a template on a
requirement executes it inside, so the template's requirements show as rows
under the original. Allocations under a row show on it as small tags; unmet
requirements and executions with unmet requirements are marked red, with a
green bar for the covered part of an amount.

Editing a row shows its raw marker form (`rawRowText`: `-$ 50 lunch`,
`[x] done`, `> note`) and re-parses it on commit; `setRowContentAt` rewrites
the row in place, keeping its id and children.

**Terms.** A *store root* is the top node of one store; every replica has one
(the device's own replica, a project opened with `fos <dir>`, a virtual peer's
document, the server's copy of an account, a scratch draft). The *device root*
is the store root of a device's own replica (Home, attached devices, ...).
A *mutable node* (ref) is any node with a stable alias whose content changes
by version; rows are mutable nodes.

**Nearest ancestor.** Mutable refs resolve by nearest ancestor
(`findNearestRow`): from where the ref is used, the first match in the
closest ancestor's subtree (shallowest first), widening to the store root.
`resolveRef`, `findTemplate` (`` [ ] `Trip` ``) and the row types all resolve
this way. A store root that ships no library of its own is a *nested scope*
(`nestScope`): a browser virtual-peer document is nested in the browser's
device root, a server account store in the server's own device root, a draft
in the node it drafts, so what it does not resolve itself continues there.

**Stores on one machine (desktop).** Every `.fos` store is a device root of its
own: Home's (`~/.fos`, the home context, the only one with Home) and each
project's (`<dir>/.fos`). Each ships the client's read-only standard library;
only Home links the shared one to contribute and vote. A store is a peer of the
others on the machine by its own `device.json` id: opening it (`fos <dir>`, or
its GUI window) links it with Home's store and every project store in a
directory above it, both ways, as members of each other's root granted
everything (`linkLocalStore`, transport `local`). On the first link the other
store appears like any peer: under its entry in Settings, a row held by it,
standing for what it shares (Home in Home's store, else its root); it can be
moved or linked anywhere, and so can its nodes. What crosses a link is still
only what those grants allow, through node exchange on the store's files: the
reader loads the other store's replica and exchanges nodes with it (the app's
peer provider for `local` peers, `App.localStoreProvider` with the `local_store`
command; `browseStore`, `fos peers ls <name>`), never reading its graph
directly. Edits to a node opened from another store go back to it like edits to
any peer's node (`meta.heldNodes`, keyed by the row's alias so moves keep them;
`App.syncLocalStores`), and that store's file is saved. Only one fos process runs
at a time, so linking writes both stores and an exchange writes the other
store's file directly, with no locking; the other store remembers where this one
is (`.fos/stores.json`, never in the graph; `desktop/src-tauri/src/stores.rs`).
`fos peers` lists the links.

**Row types.** What every row is made from lives in the standard library's
"Row types" group (`lib:types`): one template row per kind (`lib:type:task`,
`lib:type:note`, ...) whose content is the row type a row edge pins. New rows
are made from the nearest library row (`fos:library`) above them that has the
type (`rowTemplate`); with none, making a row is an error. The library is a
row in two places. The **device root ships one**, filled from the client's
build (`ensureLibraryRow`, `ensureDeviceLibrary`); it is local to that device:
node exchange of a root leaves it out on both sides (`isShippedLibrary`).
**People who contribute link the
shared library into Home** (`ensureLibraryLink`, "Contribute to the standard
library" on the shipped library row) with the fos server as its peer, and
under Home it overrides the shipped one. A changed row type is a new version:
new rows are made from it, rows made before keep the version they pin. The
seed (`dag-implementation/row-templates.ts`) is the library's first version,
what a new device root ships and what cid migration v4 pins existing rows to.
A version is its types' contents, which rows pin by cid, so the build's bundle
holds those contents exactly (with the pattern rows they hold, `SeedRow.nodes`).
Every row on the wire names its template; a peer missing one shows the row as a
reference error and asks for it.

**What a type accepts** (`shared/sync/patterns.ts`). Every type says which rows
it accepts as children with **pattern rows** of its own, made from the Pattern
type (patterns as types, `docs/language-design.md` §2.1). A pattern names a row
type (`pattern.type`, e.g. `lib:type:home`) and optionally the versions of it
that match (`pattern.versions`, pinned cids; none = any version); `pattern.any`
is the wildcard. Without the wildcard a type accepts what its patterns match;
with it, everything except what they match. A child is matched by its row type
(the library type of its kind) and its version (the template its edge pins).
The seed's ordinary types accept anything but Home and the store roots. A
template row is the type of the tasks made from it, so a new template gets the
Task type's pattern rows as its own (`withInstancePatterns`); an instance does
not copy them. Being rows, patterns sync, copy and change by vote like the rest.

**Store roots and Home are types.** A store root's type is its root alias's
instruction (`rootTypeOf`): a **Device root** (a device's own root, and each
account's store on the server, the server's device root for that account) or a
**Document** root (a fresh store: a project, a virtual-peer document, a draft).
Only a Device root accepts **Home**, a row of its own Home type; nothing accepts
a store root. So Home lives only directly under a device root.

**Type errors.** A local edit that would put a row where its parent's type does
not accept it is refused (`assertNoNewTypeErrors`, the store left as it was). A
received row in such a place (sync, a paste, an older replica) makes its parent
a **type error**: the parent's edge becomes `[TYPE_ERROR, error]`, the error
node keeping the parent's edge exactly and naming the rejected children
(`data.typeError.rejected`); a store root in error keeps its content behind an
error node as the root alias's target. Reading through it sees the row as it was
(`identityCid`, `rowKindOf`, …), so the UI shows the same rows, the parent and
the rejected children marked red (`TaskView.typeError`, `rejected`). Type errors
are derived, never edited: every commit re-derives them (`canonicalTypeErrors`,
memoized per cid), merges compare the rows without them (`withoutTypeErrors`),
and the parent turns back into its plain edge once nothing rejected is left.

**Templates** (`` `name `` row) hold requirement rows. A task written as
`[ ] `name` text` executes the template: `instantiateTemplate` copies the
template's requirements under the task (fresh ids, unfilled) and makes the
template the instruction of the task's row edge, `[templateContent, task]`, so
each execution shows the rows that still need filling. The edge pins the
template version it was made from; editing the template later does not change
existing executions (upgrading one is explicit). Copying a subtree that holds
both a template and its executions pins the copies to the copied template. `-[ ] `name`` is a task requirement whose child task is
created as an execution at once.

**Peers and capabilities.** A peer's capabilities are the `[CAPABILITY, x]`
edges on its member reference (`Capability` in `graph.ts`): what it may do on
the node (`edit`: change it, through submissions and their decisions where it has several peers), how it can be reached (`direct` over WebRTC,
`http` / `ws` through a server that exposes it, `relay` for peers that cannot
reach each other) and the services it handles (`search`, `market`, `mail`).
The fos account server registers what it can actually do with every device in
each node-provider response (`ProvidedNode.capabilities`): the transport facts
(`SERVER_TRANSPORT_CAPABILITIES`: http, ws, relay, peer, persist, provideNode,
sync) plus the services its handler registry has (`backend/sync/registry.ts`,
today search, market, poll, points, llm and cron when enabled). Devices record the
reported list on their own fos member (`App.recordServerOffers`), so a
capability no handler backs is never offered in the palette. The context panel under the tree lists the banks in scope
and the peers of the viewed node: `fos` with what it registered, the node's
members, and attached devices (a direct-connected one shows `direct`). Within
the owner's row for a member, the capability rows are what the owner exposes
to that peer: the owner adds, removes (`setMemberCapabilitiesAt`,
`removeMemberAt`) or switches them off (`data.disabledCapabilities` on the
member reference; the edge stays, `hasCapability` ignores it). Bookkeeping,
so no version. On the member's side the same rows arrive with the node and
show as offline while the owner is not online; a row the owner removed before
the member ever synced is never seen. Services act as resource banks for the
matching requirement kinds: a `-?` requirement's "Ask fos to search" is a
`complete` of that requirement, run by the fos `search` effect (below); a
`-market` requirement's "List on the market" is likewise run by the fos
`market` effect;
mail is registered but has no handler yet. Under each peer the panel also lists the `-@name` requirements
in the viewed subtree assigned to it (computed from the viewer's own rows;
delivering an assignment into the assignee's replica is not wired yet).

**Peer policies: nothing moves in a direction that is not listed.** A
peer never adds rows to another peer's context; it can only be queried for
them, and a device's sync round is that query. Every peer relationship has
two directions, each a list of capabilities (`PeerPolicy` in `graph.ts`):
`to` is what this side lets the peer have or do (`read` its content,
`autopush` its changes on every sync, `edit` = submit and decide proposals,
the connection kinds, the services it handles), `from` is what this side
takes in from the peer (`read` pulls the peer's node, `read-requests` shows
the proposals addressed to it, `autopush` lets the peer's changes merge in,
`relay`/`search`/`market`/`mail` use the peer's services). On a member row the
`to` list is the CAPABILITY edges and the `from` list the ACCEPTS edges of
the member reference (`setMemberCapabilitiesAt(…, accepts)`, `acceptsFrom`);
the context panel shows both lines under each peer and the owner edits them.
Towards the account server a device keeps its own policy: `[server] to /
from` in `fos.config.toml` for a project directory (fixed there, shown locked
in the app) or the app's saved preference otherwise, `DEFAULT_DEVICE_POLICY`
(everything both ways) when neither says. The web client enforces it where
data leaves or enters the device: without `to: autopush`
node sync runs receive-only (`push: false`): no round carries local content,
and local edits stay unsent; without `to: edit` explicit sends (market proposals, allocation
bins) are refused; without `from: read` no sync round runs at all; without
`from: read-requests` proposals that arrived with the node are not shown.
`RECEIVE_ONLY_POLICY` (`to = ["http", "ws"]`, `from = ["read",
"read-requests", "relay"]`) is the work-machine setting: the desktop app
attached at a task node receives the tasks assigned there, completes them in
that scope, and sends nothing but the connection; its completions leave only
when the policy allows a push or an explicit proposal. The server does not
yet enforce policies on its side (it serves what the credential allows).

**Groups, root and home.** Any row becomes a group through its menu ("Add
@name as a member", `App.addPeerToRow`): the peer becomes a member of that
node (`read`, `edit`) and the fos account server is added as a member the
first time (removable like any member). The app starts in **Home**, the
replica (the account's tree, the group of all the user's devices, or the
node this device attaches to). Zooming out of Home shows the device's
**root** (`state.atRoot`, not a node): a Home row and one row per peer the
device reaches: the fos server (sign-in happens on its row when not
connected; its policy lines below it) and Home's members and attached
devices with their `to`/`from` capability rows, and the **integration
peers** (`INTEGRATION_PEERS`: GitHub, Google, Anthropic, OpenAI) with what
each would provide (`repo`, `calendar`, `mail`, `search`, `llm`) and consume
(`read`, `edit`) once signed in with. SSO with those providers is not wired
on the server yet, so they show as not connected. There is no separate
context panel; banks are ordinary rows in the tree. A home node distinct
from the account root is not modelled yet. While typing, a badge after the
editor says what the line is recognized as (`describeParsed`).

**Integration peers (`backend/integrations/`).** Outside services as peers
at the device's root. *OAuth sign-ins*: GitHub (`repo`, `search`), Google
(`calendar`, `mail`, `search`), Discord (`mail`, `relay`). `GET
/user/integrations/:provider/start` returns the authorize URL (the state is
the user id, signed); the public `GET /integrations/:provider/callback`
exchanges the code, stores the tokens encrypted (`IntegrationConnectionModel`,
AES-256-GCM under `INTEGRATION_SECRET`), and sends the browser back to
`WEB_URL/?integration=<id>&ok=1`. Env per provider: `GITHUB_CLIENT_ID/SECRET`,
`GOOGLE_OAUTH_CLIENT_ID/SECRET`, `DISCORD_CLIENT_ID/SECRET`, plus `API_URL`
for the redirect URIs; unconfigured providers show as such. *Platform*:
Stripe is "connected" when the account has a customer or an enabled
connected account. *The phone channel*: the user links a number (`POST
/user/integrations/phone` texts a code, `/phone/verify` confirms); fos then
texts about proposals from other accounts, and texts sent to the platform's
number (`backend/channels/sms.ts`, Twilio: `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_FROM`; webhook `POST /channels/sms/webhook`,
signature verified) become rows: "done <words>" checks a task off, "list"
answers with open tasks, anything else is added at the root. Language
models are the fos server's own capability (`llm` in its handler registry,
the voice notes' `complete` on `OPENAI_API_KEY`/Vertex), not a user key.

Handlers, as requirement kinds, all run as *effects of the account server's
handler registry* (`backend/sync/hostHandlers.ts`) when the requirement is
completed (the row's Run button sends a `complete` event for that
requirement; there are no routes per handler): `-llm question` → the fos
model; the attempt (prompt, system, sources) is pinned under the request and
the answer becomes a proposal on its return ref, so the evaluation pauses as
`awaiting-review` until the owner accepts it in **Context & results**
(acceptance supplies the requirement; completing again commits).
`-repo owner/name title` → GitHub opens the issue and a row with its URL plus
the supply are added. A time or person requirement with a window
(`-: 1h 2026-10-13T09:00..` or `-@bob …`) → Google Calendar creates the
event and the allocation row that fills the requirement.

**MCP peers (`backend/integrations/mcpPeers.ts`).** The account's MCP
servers (`MCPServerModel`, their tools) are peers too. "Attach here" (or
the row menu) makes a server a member of a node (`mcp:<server id>`, name
from the registry, `tool` + `read` + `edit`), so it advertises its tools
there. A `-tool <name> input` requirement under that node (or below) is run
by the nearest attached server that has the tool: the registry's `tool`
effect (`mcpToolHandler`) binds the handler ref before the evaluator pins the
step and calls `MCPClient.callTool` with `{ input }` when the requirement is
completed ("Run" on the row); the result is a note inside the requirement,
the return ref and a supply by the peer. With `MCP_LISTEN=true` the server also listens: after every save
of a tree (`afterSaveHooks` in `accountStore.ts`), open tool requirements under
attached nodes are run (debounced per user).

**Allocation bins (sending rows to another account).** A row whose children
are requirement and allocation rows is a proposed transaction: what the
receiver must fill, and what they get. "Send to @owner" copies the row with
everything inside it as a bid (`copyBidRow`) to the market proposal route
(`POST /user/data/market/proposals`), which takes it on any node where the
sender is a member with `edit` as well as where the market takes proposals;
the receiver sees the proposal in that node's link panel, named
after the sender, and approves it to take the rows in, after which the
requirements block the bin's task until filled.

**Inviting a Fos user.** "Add sub-peer" under the fos server in the context
panel autocompletes `@name` from the account directory and sends an `invite`
event (`fos_invite` over MCP). The account server records the member grant
(`user:<name>`, `edit`) on the node and, through its `relay` capability,
delivers a *request* to that user: the inviter becomes a sub-peer of their fos
server (a member of Home and of a row for them, with nothing granted) and the
node arrives as a proposal by the inviter on that row (`ensureInviteRequest`,
`shared/sync/sharing.ts`). Accepting the proposal places the foreign ref
there; the invitee opens it like a market result and proposes through the
market routes, which honour the member grant. A member edge written locally
would never reach them; the server is the peer that hosts both stores.

**Search is a handler, not a route.** A `-? text` requirement is filled by
the fos `search` effect (`searchHandler`, `backend/sync/hostHandlers.ts`) when
it is completed: a semantic search (pgvector + Vertex `text-embedding-005`,
index kept by `backend/search/rowIndex.ts` a few seconds after every save)
over the account's own rows, plus the rows the market lists when the query row
inside the requirement has `market: true`. The query is that query row's text
(else the requirement's); the hits replace the earlier reference rows under the
requirement (another account's as a ref row with `ref.owner`), then the supply
is recorded as `fos`. The client never searches itself: a query row's Search
runs the requirement around it (a query on its own is put inside a new `-?`
requirement first, `App.searchAt`); searching again deletes fos's supply and
completes the requirement once more. Which rows inside are the query and the old
hits is decided by their row types (`rowsOfType(…, 'query' | 'ref')`).

**The market is a peer.** A node is listed iff the market peer `fos:market`
(`MARKET_PEER`, served by the fos server) is a member of it with `read`; with
`edit` it also takes proposals. The grant reaches the node's subtree like any
member grant (`marketGrantsAt`; a member entry lower down overrides it), and
both the index (`market` column) and the market routes read it. Unlisting is
removing the member (or switching its `read` off); there is no other flag.
Handlers published to the marketplace ("Publish capability to marketplace",
`publishTemplate(…, market)`) are typed refs on the market member's `to` side
(`marketplaceOffers`); switching one off (`setHandlerEnabledAt(…, MARKET_PEER,
id, false)`) withdraws it, and publishing does not list the context it is
published in. Policy is per peer and does not travel by node exchange, so the
listing lives on the server's copy of the node (what indexing and the market
routes read); a device shows the 🛒 badge only where its own copy has the member.

"List on the market" on a `-market` requirement completes it on the account
server: the fos `market` effect makes the market a member of the task
(`setMarketAt`), indexes the account so the listing is searchable at once,
then records the `market` supply as `fos`. The client writes neither the
member nor the supply. A hit from another account is a ref row with
`ref.owner`, which opens the listing (`GET /user/data/market/node`): the
node's rows and requirements, and the requester's own proposal only (no
peers, members or other bidders). "Send proposal" sends a **bid**
(`POST /user/data/market/proposals {owner, aliasId, bid}`): rows the bidder
built in a draft of its own tree (`draftBid`, shared/sync/market.ts) as
verified nodes, each with the path it goes under (a comment; for each
allocation requirement an allocation copied from the bidder's bank and a
supply under the requirement referencing it). The server knows nothing about
what the rows are: `applyBid` imports the nodes that verify, refuses rows that
carry members or proposals, flow records (the allocation row type) attributed
to anyone but the bidder, reused ids and unknown paths, and appends the rows to
a branch of the node's value, recorded as a proposal keyed `user:<bidder>` on
the owner's ref node, exactly like a device's branch-mode proposal; a
resubmission replaces it. The owner sees every proposal in the link panel
named after the bidder and approves one (`applyProposalAt`), which merges the
comment, allocation and supply into the task and unblocks it. Bidders never
see each other's proposals.

## The `fos` binary: GUI and CLI over one context (`desktop/src-tauri/src/`)

The Tauri app is also the command line. Both modes act on a *context
directory* and keep that directory's state in `.fos/`, so the GUI, the shell
and local agents are one device:

```
fos                      GUI for your account   (context ~, state in ~/.fos)
fos <dir>                GUI for a project      (nearest fos.config.toml, state in <dir>/.fos)
fos [dir] run            sync, print the tree, then serve local devices/agents
fos [dir] repl           interactive shell (ls, add, done, cd, mv, sync, approve, …)
fos [dir] ls | add "…" | done <id> | open <id> | status | sync | approve <id> | reject <id>
fos [dir] attach <token> attach the directory with a connect token (owner approves)
fos login                home context: browser sign-in (SSO-capable) or --token / --password
fos [dir] init           write fos.config.toml;  fos [dir] detach;  fos [dir] reset
```

The sync core is not reimplemented in Rust: `shared/sync/embed.ts` exposes the
replica API as JSON-string functions, is bundled to
`desktop/src-tauri/js/fos-core.js` (esbuild, with `js/prelude.js` shims; a
build product the Tauri hooks and release workflows produce, never committed)
and runs in-process with QuickJS (`core.rs`). `workspace.rs` holds the open
replica, `project.rs` resolves the context, config, git branch and `.fos/`
files, `client.rs` talks to the account, `local_server.rs` is the local
server and `commands.rs` the CLI/REPL. The GUI gets the same context through
the `find_project` command (web/src/project.ts): in home mode it synthesizes a
config with the server and this computer's name so the web app stores its
state in `~/.fos` too.

**Home context.** `fos` with no directory is your account: the context is `~`
and the device attaches to the account root. Signing in never types a password
into the terminal by default: `fos login` asks the server for a code
(`POST /auth/device/start`), opens `<web>/?device=CODE` in the browser, and
polls `GET /auth/device/poll`; the web app, once signed in by whatever means
it supports (password today, SSO/SAML when added), shows *Approve a sign-in*
and calls `POST /user/data/device-login/:code/approve`, which mints a normal
user JWT for the device (`backend/auth/deviceLogin.ts`). A connect token
(`fos login --token`) attaches the home context as an invited peer instead.

**Project context.** A directory becomes a peer with a committed
`fos.config.toml`:

```toml
[attach]
server = "https://api.fosforescent.com"
token  = "fosinv_…"     # optional: used once to attach, then the credential in .fos/ is used
name   = "laptop checkout"

[serve]
port = 4777
host = "127.0.0.1"      # 0.0.0.0 to let devices on the LAN attach

# What this directory sends to and takes from the account server (capability ids; see "Peer policies").
# Absent: everything flows both ways. This example is a work machine that only takes work in:
[server]
to   = ["http", "ws"]                       # nothing but the connection leaves
from = ["read", "read-requests", "relay"]   # pulls its node and the requests addressed to it

[peers.bob]                                 # the same, towards a named peer
to   = ["read"]
from = ["edit"]
```

`fos <dir>` (or any subdirectory) finds the config by walking up and keeps
local state in `<dir>/.fos/` (ignored): `device.json` (this directory as one
device), `session.json` (the credential) and `replicas/<branch>.json`.

**Git branches are proposed values.** The current branch is read from
`.git/HEAD`; each branch has its own replica and is reported with the sync, so
the node holds one proposal per (device, branch): a task can be done on `main`
and open on `feature`, and switching branches shows that branch's tasks at once
(the CLI/`run` watches HEAD; the GUI polls it). A proposal's summary diffs
against the main content it was based on, so work landing on main later never
shows as "removed".

**Local server.** While `fos run` / `fos serve` is up (default port 4777,
`[serve]` in the config), the directory exposes on localhost (or the LAN):
`/mcp`, the shared MCP vocabulary (`fos_read`, `fos_search`, `fos_propose`,
`fos_input`, `fos_evaluate`, `fos_create_branch`, `fos_decide`; see "The event
grammar") as the directory's owner, for local agents;
`/p2p/offer|answer`, a relay for WebRTC offer/answer codes so two devices can
bootstrap a direct connection without internet signalling; `/status`; and
`/events?since=N`, a long-poll for change notifications.

## Attachment and presence

A device's `[PEER, ref]` edge (and its `[MEMBER, ref]` entry) persists until
someone removes it deliberately: the owner through the device's menu on the
node, or the device itself (*Detach this device* in the ☰ menu, which calls
`DELETE /user/data/peer-sync/attachment`). Signing out keeps the attachment.
Whether a device is currently connected is separate: each device announces
its peer id over the WebSocket, the server tracks the user's online peer ids,
and the UI shows attached devices and members with an online/offline dot.

## Connecting a device (`web/src/app.ts`, `web/src/ui.ts`)

A device never signs in on its own with built-in credentials. On start it
reconnects with the session it stored (a token, never a password), asks the
account where it attaches (`GET /user/data/peer-sync/attachment`: root by
default, or the node it was invited to, found through the `[PEER, ref]` edges)
and syncs. Without a session it shows a red **local** badge next to the ☰ menu
and a dismissable **Connect** modal with three ways in:

1. **Sign in** with username and password → a user session; the device attaches
   where the account says.
2. **Connection token / QR code** (`backend/sync/peerInvites.ts`). The inviting
   user picks a node (root or any task) and chooses *Invite a device here*:
   the server creates a token (stored hashed, 15 min) tied to that scope and
   the app shows it as text and QR. The connecting device claims it
   (`POST /peer/connect`), the inviting user is notified over the WebSocket
   and approves or denies (*Connection requests*), and the device polls
   (`GET /peer/connect/:requestId`) until it receives a **peer credential**: a
   JWT with `kind: 'peer'`, the peer id and the scope. The JWT middleware
   confines it to the `/user/data/peer-sync/*` routes and the node provider to
   that node.
3. **Direct, device to device** (`web/src/p2p.ts`), no account needed. The
   inviting device (host) provides the node it is showing through node
   exchange, as the account server does; the guest's replica attaches to it
   exactly as it would to an account, and if the host is signed in, the guest's changes reach the account
   through it. Bootstrapping exchanges one offer and one answer code over any
   transport the devices share: text (copy/paste), video (QR shown and scanned),
   audio (not implemented; the slot is the `Transport` idea in `p2p.ts`). Once
   the WebRTC data channel is open, sync runs over it and the host pushes
   `changed` nudges. If no channel can be established, the **manual relay**
   carries the node requests (one per node the guest syncs, its edits included)
   and the provided nodes back as codes by hand over the same transport.

Dev builds may still auto sign in when `VITE_API_USERNAME`/`VITE_API_PASSWORD`
are set; production bundles contain no credentials.

## Device lifecycle (`web/src/app.ts`)

1. Load the replica from localStorage (`fos.replica.v1`: link metadata, the
   agreed node shapes, and the nodes reachable from the root alias). Edits work
   immediately; each one creates new nodes and advances the root alias.
2. Auto-login with build-time credentials (`VITE_API_USERNAME/PASSWORD`) or
   via the sign-in form in the offline banner.
3. On login: open the per-user WebSocket, sync, then poll every 30 s.
4. Edits trigger a debounced sync; `sync_changed` from another device and the
   browser `online` event trigger a sync.
5. Login or sync failure → offline mode with exponential retry (5 s … 5 min).
   A 401 drops the session; a 404 means the attached node is gone.

The UI never sees cids: `viewNode` turns a node into tasks, choices,
nodes and peers keyed by alias ids.

## Server (`backend/sync/provideNode.ts`, `backend/sync/accountStore.ts`)

* `POST /user/data/peer-sync/provide-node` (JWT): loads the account's store
  (`dbToStore`, one request at a time per account, `withUserLock`), makes sure
  of Home (`ensureAccountContext`), answers with `exchangeNode`, saves with
  `storeToDb` when changed (which repoints the user's `fosNodeId` at the new
  root alias), and sends `sync_changed` over the user's WebSocket connections
  after an update.
* `GET /user/data/peer-sync/attachment?peerId=` says where a device attaches;
  `DELETE` detaches it.
* Invites: `POST /user/data/peer-invite`, `GET /user/data/peer-invite/requests`,
  `POST /user/data/peer-invite/:id/approve|deny`; public `POST /peer/connect`
  and `GET /peer/connect/:requestId`. Table `PeerInviteModel` (apply with
  `npx prisma db push --schema=infra/prisma/schema.prisma`).
* The server's peer id is `user:<username>`.

Sync itself needs no schema change; nodes land in `FosNodeModel` like any other. Invites use the `PeerInviteModel` table.

## The standard library (`shared/sync/library.ts`, `backend/sync/library.ts`)

One node every account reads and can propose changes to, owned by a system
account on the server (`FOS_LIBRARY_OWNER`, default `fos-library`; created at
startup by `backend/library.ts`). At startup `ensureStandardLibrary` makes sure
the account's Home holds the `fos:library` row "Standard library", shares it
with the `users` audience granting read, edit and rank, gives it a
**merge policy** (`fos:merge-policy`, default two approvals) and seeds the
standard templates (`STANDARD_LIBRARY`: Plan a trip, Invoice, Group decision,
Paid task, Contact form, Research note; `fos:library` records the seed version so
later versions add only what is missing and rows the group removed stay removed).
The registry then carries the address. Accounts do not get the library
linked: devices ship it, and people who contribute link this node into their
Home (a reference row `fos:library` with the shared address as
`fos:shared-link`).

**Audiences are groups.** `memberFor` (graph.ts) resolves a peer's member entry
to its own, else to `audience:users` for any `user:*` peer, else to
`audience:public`; every grant check (`hasCapability`, `inheritedNodeGrants`,
`nodeAuthorityAt`, `allowedToEdit`, the provider) goes through it. Sharing a
node with an audience therefore makes it a group nobody has to join one by one;
an explicit member entry still wins, so a single account can be restricted.
`participants` lists participation records found on the node, not only
explicit members.

**Offline.** The web app opens the reference as a live projection
(`openSharedNode`) on the first online sync and pulls the whole tree
(`materializeSharedTree`), so `findTemplateByName` finds the library's templates
in the local replica and `` [ ] `Plan a trip` `` instantiates them offline;
`syncSharedNodes` keeps the copy current and pushes local edits as the member's
proposal on the owner's node.

**Governance.** Members approve proposals in the shared view (the row's
"Updates" link); after each submission the server applies the node's merge
policy (`applyMergePolicy`): a proposal with at least that many approvals at the
current revision is merged as the owner. Votes are tied to the revision, so the
remaining proposals wait for fresh approvals after a merge. Without a policy the
owner decides by hand, as on any shared node; the policy value is itself part
of the node, so the group can propose changing it.

**In the build.** Clients carry the library in their bundle so a device that
never goes online still has its templates: `fos library export [--out file]`
(the `fos` CLI, signed in as you) pulls the shared node through the account
node by node and the embedded core turns it into rows
(`exportProvidedLibrary`); `web/scripts/pull-library.mjs` runs it before `npm
run build` when the CLI is on PATH (`FOS_BIN` overrides, `FOS_LIBRARY_PULL=0`
skips) and otherwise keeps the committed `web/src/library.json`. The device
root ships that copy as its library row (`ensureDeviceLibrary`, falling back to
the in-code `STANDARD_LIBRARY` when the file is empty). The export also
records the library's address (owner, path and share id, from
`peer-sync/locate`), which the "Contribute" action links into Home. Without a
library linked in Home, `fos library export` finds it by the library account
(`--owner`, default `fos-library`).

**Manual fallbacks.** The library's "Manual handlers" group (`lib:manual`)
carries one requirement row per kind of requirement, each a fallback the app
offers on any unsatisfied requirement of that kind (`manualHandlersFor`,
`App.applyManualHandler`): "Paid outside Fos", "Sent it myself", "Opened the
issue by hand", "Enter the location", "Use this device's location"
(`lib:device:*` rows are device handlers), and so on. Clicking one records
that the person did it by hand: allocations get a receipt row inside the
requirement (its resource is the requirement itself) plus the supply pointing
at it, places come from the typed name or the device's position, every other
kind is a supply by the person. No peer is involved, so the fallbacks work
offline from the shipped library, and the group edits them like any other rows.
Combinations of capabilities are never new primitives: product = several rows
in a node, coproduct = submissions on a mutable ref decided by a choice
handler, exponential = composition through templates.

## Limitations / next steps

* Task order is `todo.time` then id; no user-controlled ordering yet.
* The stored replica keeps the whole root-alias history (PREV chain); it is
  bounded to what is reachable but not pruned.
* The replica lives in localStorage on every platform. A Tauri file adapter
  (`.fos/`) can implement `ReplicaStorage` in `web/src/storage.ts`.
* Expression-level helpers (`FosExpression.merge`, `addTodo`) predate this and
  use the same primitives; folding them together is a cleanup for later.
* The `fos` CLI's `add` only knows the task (`[ ]`), note (`>`) and comment
  (`//`) prefixes; requirement (`-`), query, bank, allocation (`$`) and
  template prefixes are parsed in `web/src/rows.ts` only.
* Assignments (`-@name`) only show in the assigner's own context panel; the
  assignee's replica does not receive them yet (needs the proposal path).
* Browser node relay requires a live authenticated WebSocket; offline devices
  cannot answer requests. Relay does not traverse foreign reference targets.
* Discord provides `mail`/`relay` on paper; its OAuth sign-in only identifies
  the user (no handler sends through it yet; the channels bot does).
* OAuth tokens are refreshed on use (Google); GitHub tokens do not expire.
  A revoked token surfaces as a 502 from the handler, not as "disconnected".
* Fos-point allocations are recorded in the tree but not debited from the
  token balance when a task completes.
* Choice requirements have no handler registry yet: any signed-in viewer can
  pick an option. Calendar allocations carry start/end but nothing checks
  overlaps.


### Non-replicated provider rows

A provider can return view-only rows with `replicated: false`. These rows are not
`TaskView` graph tasks: they never enter the replica, undo history, exports, peer
sync, or agent graph context. The filesystem provider is the first implementation.
Desktop **Add peer > Link with directory** prepares the directory's `.fos` namespace
and stores the node-to-directory binding only on this device, scoped by account and
node. Existing local repository constructors also provide filesystem listings.
Filesystem entries use the normal outline and node workspace. Opening a folder
navigates into its filesystem children; breadcrumbs and parent navigation return
to its ancestors and the hosting graph node. Templates are derived from file
extensions (for example Markdown, TypeScript, and JSON), not stored graph rows.
The view queries directory entries again on render/refresh. Files have read-only
UTF-8 previews up to 1 MB; Markdown uses the existing sanitized Markdown renderer.
File contents remain outside the replica. Binary previews and file editing are not
implemented.
`.fos`, `.git`, and symbolic links are excluded. Native folder queries are confined
to the linked root. Errors remain in the local view and stale responses are discarded.

Binding a CLI replica to the node and launching a terminal remain follow-up work.

### Node-scoped agent connections

**This device > Connect to agent** starts an authenticated loopback MCP endpoint
in the desktop app. **Fos server > Connect to agent** creates a scoped peer
credential for `/user/data/peer-sync/mcp`. Each dialog provides configuration
to copy into an agent and a disconnect action. The hosted endpoint supports main
branches only; desktop connections use the selected branch.

Both endpoints speak the shared MCP vocabulary (see "The event grammar"): the
agent is an invited peer at the selected node, so it reads what its grants and
field masks allow, and its `fos_propose` changes become pending proposals for the
owner's existing approval workflow; agents cannot merge them. Proposals require
the revision returned by a read. The protocol is stateless MCP over HTTP with
JSON responses.

Desktop connections require the window to remain open and stop on account changes.
Hosted connections use a scoped peer credential, never the owner's login token.
Credentials are kept in memory, outside the graph. Disconnecting removes the peer;
removing its grants also prevents further node access.

### Template triggers and execution

Play opens an execution view using the existing constructor rows. Graph editing
is hidden; only requested text, confirmations, choices, and allocations are
interactive. The evaluation journal persists while execution runs.

The Triggers constructor tab includes public, Fos user, cron, and child evaluation
triggers. New triggers require templates. Public and Fos template entry links stay
reusable. Each visitor gets an independent private instance; returning visitors
resume that instance. Public access uses a signed browser credential, while Fos
access uses the logged-in account. Copying a private URL does not grant access.
Revoking membership or disabling/reconfiguring the entry revokes instance access.

Hosted execution accepts only declared, visible inputs and checks allocation
bounds. Consuming an allocation records a graph receipt, not an external payment
or resource transfer. Graph-only evaluations run after all inputs are supplied;
external integration effects still require their host-side handler. Hosted
endpoints require deployment of the updated backend.

### The event grammar: one vocabulary for every transport

Every input surface is an adapter of one grammar (`shared/sync/events.ts`): HTTP,
MCP, the WebSocket, the desktop loopback endpoints, the `fos` binary's local
server and texted commands all translate what they receive into a `FosEvent` and
hand it to `dispatchEvent`. Handlers never change per transport, and a new
transport is only a new adapter. The transport supplies the principal (who acts,
at which attachment); an event can never widen it.

| kind | what it does | MCP tool |
|---|---|---|
| `read` | one node: text, children, branches, pending submissions, declared inputs of a running evaluation, available actions | `fos_read` |
| `search` | bounded text search below a node | `fos_search` |
| `submit` | changes against the attachment (`add_task`, `add_note`, `add_plain`, `rename`, `complete`): the owner applies them, anyone else leaves a named proposal | `fos_propose` |
| `input` | fill one declared hole of an execution: text, confirmation, choice or allocation | `fos_input` |
| `complete` | evaluate a node: the owner's host runs its handler registry; anyone else leaves an *evaluation request* (below) | `fos_evaluate` |
| `branch` | an alternative of a node (owner) | `fos_create_branch` |
| `decide` | approve or reject a submission (edit) | `fos_decide` |
| `invite` | make a Fos user a member of a node (owner); the host delivers the node into their Home | `fos_invite` |

Adapters on the account server (`backend/sync/events.ts`): `POST /user/data/events`
with `{event, scope?}` (owners may name a scope; peers use their signed attachment),
`POST /user/data/peer-sync/mcp` for JSON-RPC (owners pass `?scope=["id",…]`), and the
account WebSocket's `{type:"event", id, event, scope?}` →
`{type:"event_result", id, result|error}`. Paths are relative to the attachment;
`expected` is the revision returned by a read (`revision` for the attachment,
`valueRevision` of a node for `fos_evaluate`). Stale or undeclared submissions are
rejected. Allocations record graph receipts; external effects run only through the
host's handler registry. Public visitors keep using `/public/node/visit|input`.
When the last declared input of a template execution arrives, the host evaluates
the execution through its registry (`backend/sync/sharing.ts` → `runNode`), so a
survey answer can pay out fos points or run any other effect the owner configured.

**Polls resolve choices.** A `choice` requirement published with a poll
(`fos:poll`, approval or rank) is resolved by the fos `poll` handler when the node
runs ("Apply poll result" on the row): rank polls take the top Borda score,
approval polls the most approvals; a tie or no responses blocks. Approvals and
rankings on pending proposals are input the owner decides with; the tally never
merges a proposal by itself.

**Evaluation requests.** A peer that may edit but does not own the node cannot run
effects. Its `complete` becomes a proposal on the node named `evaluate <path>`,
carrying `fos:evaluation-request`, and is accepted only where some peer in that
context offers the `request` capability (a device does when it has configured an
"on request" trigger). The owner's `request` trigger evaluates it automatically, or
the owner reviews it by hand. On the requesting side, `requestContinuation` sets up a
`response` trigger on the requesting node automatically, so that node's own
evaluation runs when the answer arrives: the requested node's committed evaluation,
or the rejected request.

The desktop evaluation toolbar shows an agent icon when a configured Claude or
Codex SDK is available. Clicking it starts an evaluation-only loopback MCP server
and launches that SDK. The connection ends when the run finishes, is cancelled,
or the user leaves the evaluation or changes accounts. Credentials stay out of
the graph. Without a linked repository, the desktop uses a scratch Git workspace.
Hosted SDK spawning is not wired to this toolbar; hosted evaluation MCP clients
can connect using the endpoints above. Updated hosted routes require deployment.

### Editor, interaction, and analysis

The main editor is always a tree. Play opens a node's interaction view without
adding a constructor or changing graph content; it is available on tasks, notes,
requirements, allocations, and other nodes. Play on a template first instantiates
it. Completing an action creates the aggregate effects transaction and persists
its journal for recovery. Child tasks and linked peer work appear in that same
interaction view and remain visible in the tree.

The analysis icon opens a read-only grid/graph workspace. Filter by text patterns
(`*` matches arbitrary text), object type, or task status. Results include counts
by kind and sums, averages, minima, and maxima for allocations, grouped by resource
type and unit. Analysis reads at most 2,000 descendants to depth 32, reports when
the row limit is reached, and does not traverse peer references. Refresh rereads
the graph; query controls never edit it.

Attached peers use the same event endpoints with their scoped peer JWT. Paths are
relative to the signed attachment. Endpoint access does not require an evaluation
constructor or template instance. Reads respect node and field masks; inputs and
submissions require edit permission on their target; completion by a peer is an
evaluation request. Revoking the peer removes access.
Ordinary published nodes also expose interactions through their configured peers;
unlike a visitor's private template instance, executing effects on the shared
original requires explicit edit permissions.
