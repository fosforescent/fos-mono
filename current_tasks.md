Fixes: 
- should have "connect" in node-by-node context menu along with in root
- Why does "bank" get added below current row?  We should transform current row into bank, or allocate it to 




Primary usecases for now: 
- manage a far-reaching vibecoded project by allowing specification at progressively fine-grained levels and integrating with agents which can carry out tasks
  - Create goals & subgoals
    - Access status of them across many devices
    - Allow users to bid on tasks in marketplace
    - setup payouts integration (probably with stripe)
    - view tasks from desktop and submit branches/prs as "proposals"
      - chat within task, share notes etc
    - triggers
      - cron-type workflwos that automatically get kicked off and can go to market
- collaborate to plan a group trip
  - create nested choices/branches that others can see and sort
  - allow multiple users to allocate from calendar and inventory
    - or vs and logic in person-calendar allocations
  - splitting charges
  - in-the-moment group choices about dinner etc
- research group share, collaboratively edit, and publish notes
- analyze messages within group
- 


Misc: 
- Let's also have the ability to create a group by creating a row and dragging and dropping peers onto that row.  Then those peers are the group members... Let's have hte fos server be a member by default but it can be removed
- Let's have root (client specific) be distinct from "home", which is a "group" of all the user's devices.  The fos server should show up in the "root", as well as other peers that attach to the users home node
 


- Points
  - Let's create fos points that are 


- Mailbox / relay will this way: 
  - each peer has a UUID and/or keypair
  - If peer B wants to relay a message through peer A, it submits a route requirement/request to Peer A including the timestamp.  Peer A submits them to its peers, starting with the fos server if it's available or peer C. If peer C has established routes to the recipient, it queries them 3 at a time in sequence to determine if any are online.  Then it sorts them based on the speed of response, if so it sends a message + signature requirement back to the original sender in response, otherwise it sends a route request to the next peer after an artificial delay of (now time - original route request times).  If it receives any route requests in the meantime to the same recipient, it ignores them.  Once a route is established, it's cached. 

  When the original sender receives the message + signature requirement, it then sends the message as well as an appropriate signature based on the signature requirement if available. 


Peer<id>: 
- transport



Group: 




Mailbox/Relay: 
- sender
- recipient
- signature
+ route




- Please remove the green "Add" button... it is redundant with the new row

- Let's make the text box in the "edit" button have a similar caret menu that allows switching between options.  
- We don't need so much info in the "status" badge in the top right
- As far as the "lazy node loading" -- the requests should be automatic.  Visually it should just look like you're on that node locally, but perhaps with a slightly different shade in the background.  By default when a user shares a linked node, it inherits the permissions of its parent.  However on the local mutable ref which is connected to the mutable ref on the peer side, the user shoudl be able to specify permission constructors under the node itself, and/or under a given peer which would then mask that data.  So the peer on the other side only receives a portion of the node, and possibly visa versa when they potentially modify the node


- The Connect GitHub repository button should be in the menu with all the other actions


- There's also the distinction of publishing for other people edit vs publishing something that people interact with... 
  - the first one the people are added as peers
  - the second they're 


- If we start fos from the cli with fos ., 
- It should automatically do a filesystem link at that directory and add the store
- we 



- The "Find fos users" search menu shoudl go under the "add peers" tab/section
- 



Notes 10/17:
---
- kanban - part of execution view
- edit/tree view can be part of execution view if executor needs to provide a workflow/function


Invoice flow: 
---
- create constructor for default/override/mask/merge thing..
- is about executing a function
  - requires list of time entries with descriptions etc... each masked
  - requires list of billing
  - requires contact
  - 



Use cases that can be helpful immediately: 
- email list/contact form
- quick server-required tasks that people don't want a server for
- comments section? 
- Blog-style CMS
- Payment splitting & polling (a la splitwise?)
- Invoicing
- simple inventorying


- there should be a std lib of derived handlers and standard capabilities that run off of the device-specific handlers and most basic capability definitions
- How do we discover new capabilities on current machine?
  - link them to local registry as mutable refs of certain type?  
    - nodes have their own registries -- just a mapping from alias + icon to uuid/cid? So that's how subhandlers can automatially be registered when a capability is registered? 
    - nodes can override previous scopes by linking to the registry? 
      - If a node and its parents/ancestors are both adding submissions to the same mutable ref, the child's override the parents' automatically

- peers are ultimately just handlers with bundled sub-handlers.  A capability can pattern match over the peer to determine if it has handlers for the required sub-capabilities


- we should seed new accounts with std lib.  
  - "unify" capability shoudl come in std lib? for calculations and logic programming
  - unmasked links correspond to equality constructors?  masked correspond to gte/lte?


- read/write/execute all blend in with each other.  The execute view needs to be able to read to show what's happening, and write to be able to change state.  Read view needs to be able to execute queries, which requires writes.  Write view needs to be able to read and execute queries
  
Execute view: 
  - kanban
    - mapping a list of items over a composed sequence of functions/templates
  - invoice
  - chat



Still open from the approved step-1 shape: declaring peer rows once in scope, and folding the old peer edges into memberships. I'll do those with step 2, where sharing will use them, rather than add them on their own now.

	

Step 2: sharing by linking nodes into a peer's membership, with truncation where the links stop.
	•	Step 3: what a peer shares appears under its membership as refs you bind from a higher scope.
	•	Step 4: cut-off refs replace the masks and endpoint records.
	•	Step 5: reads and writes on a cut-off ref go through the nearest peer row.

The desktop only needs to special-case above, while the web app selects transports in roughly eight places.
Still id-based, for the peer-id step (P5)
The account peer is still written as user:<username>.
The peer list's nameOf still parses ids.
accountContextAbove still picks the server's entry by the fos id.
The last one goes away with step 3, once the account shares that entry under its membership instead.
Next is step 2: sharing by linking nodes into a peer's membership. I'll also declare peer rows once in scope there, so a connection's offer sits on the peer's declared row rather than a membership created to hold it.

I'll take an inventory of what still uses hardcoded or parsed ids before writing this up.

A few of these need a closer look to classify: the `lib:` hits, the grant child ids, and the `user:` parsing sites.

Here's where things stand: the design we've been converging on, what's left to finish, and every place that still uses a hardcoded or parsed id.

## How it fits together

The design comes down to one idea: **everything is a row, and nothing is found by its name.**

- **Rows.** A row is `[left, right]`, and its type is its left node. Code finds things by structure: the left node, a ref registered in scope, or a pattern.
- **Mutable refs carry state.** A submission to a ref is accepted one way only: approval rows, checked against the node's merge rule.
- **Capabilities resolve by scope.** A row that needs a capability declares a requirement, and the handler is found by searching the enclosing scopes for an enabled offer. Native code reaches the graph only as such an offer.
- **The standard library is an ordinary ref.** It's a definition plus a pinned instance, which code reaches as `lib.<field>`. The device passes its natives in as arguments.
- **Peers and links are one mechanism.**
  - A **link** is two refs pointing at each other.
  - A **peer** is the same thing with the far end remote.
  - A **membership** is a row whose left is the peer's node.
  - A **peer is a capability**: you reach it by resolving its `provideNode` handler in scope (this round).

In the language design's terms:
- A ref a peer shares but hasn't filled is a **hole** you bind from a higher scope.
- Grants become **structure** (patterns) instead of capability lists.
- **Partial views** fall out naturally: a tree stops where the linked sub-refs stop.

## What's left

**Links and peers (P6)**
1. **Declare peer rows once in scope.** Each peer gets one row: root for fos, audiences and local stores; Home for accounts, visitors, MCP and integrations. Connections would then be offered on that declared row instead of a membership created to hold them. The old `[PEER]` attachment edges fold into this.
2. **Share by linking.** Linking a node into a peer's membership shares it, and its sub-refs travel only as far as you link them. Other peers' memberships are visible only if linked in.
3. **What a peer shares appears under its membership** as refs you bind from a higher scope, and a peer's own writes there are relayed back. This replaces offer advertisements, and it removes `accountContextAbove`: the account just shares its server entry.
4. **Cut-off refs replace the special cases.** A ref with no child rows, reached through its peer, replaces:
   - masks;
   - the stub variants;
   - node-link endpoint records;
   - `meta.sharedNodes` and `meta.heldNodes`.

   Grants become structure here, so the `to:`/`from:` grant ids go too. The stashed permission-rows attempt (`stash@{0}`) can then be dropped.
5. **Finish access through the nearest peer.** Most of this landed this round. What's left:
   - The relay fallback still finds "the peer that gave you the node" through the attachment's `serverPeerId`; it should be the peer row of the nearest ancestor.
   - Local links still need the no-transport case.

**Peer ids (P5).** A peer's kind (account, visitor, MCP, integration, market, audience) should come from its row's structure, so ids become pure opaque labels. Most of the list below lands here.

**Other**
- **The non-recursive scope rule** you proposed (a ref can't be defined and used in the same scope): agreed, not built.
- **Housekeeping:** docs as each step lands, and your `current_tasks.md` notes, still uncommitted.

## Hardcoded or parsed ids still in the code

Counts are non-test source in `shared`, `backend`, `web` and `desktop`.

**Peer ids parsed or matched (P5)**

| Id | Uses | Where / what |
|---|---|---|
| `user:` parsed | ~9 | `memberFor` falls back to `audience:users` when the id starts with `user:` (graph.ts:2291). `hostHandlers.ts:203` and `:354` slice usernames out of peer ids. The web app's `nameOf` (app.ts:1769) and the account labels and icons in ui.ts (724, 805, 3655) do the same. |
| `user:` built | several | `` `user:${username}` `` for the account peer and for accounts that shared nodes (app.ts). It's built, not parsed. |
| `fos` / `SERVER_MEMBER` | 42 | `accountContextAbove` and `serverOffers()` read the `fos` membership. `discoverHandlers` turns grants into offers only when `peerId === 'fos' \|\| startsWith('mcp:')`. work.ts accepts a language-model handler only if its peer is `'fos'`. Approvals, and the library's build submission, also key on it. |
| `integration:` | 27 | `INTEGRATION_PEERS` ids built as `integration:<id>`; the legacy move into Home in `homeContextCid` matches the prefix. |
| `audience:` | 24 | `audience:users` / `audience:public` grant audiences, in graph.ts, sharing and ui. |
| `fos:market` (`MARKET_PEER`) | 18 | Market listing and offers. |
| `mcp:` | 6 | Legacy offers (above), evaluation, ui. |
| `agent-cli:` | 6 | Agent CLI peers (agents.ts, app, ui). |
| `visitor:` | 4 | Visitor participation (sharing, hostHandlers). |
| `NODE_PERMISSION_DEFAULT` | 6 | Default node permission, keyed by id. |

**Names used as lookups in graph data**
- **Capability names:** `capabilityName` falls back to parsing `fos:capability:<name>` (capabilities.ts:44). Triggers look up their definitions by matching a capability's name against the standard patterns (triggers.ts).
- **Grant child ids:** built as `` `to:${…}` `` / `` `from:${…}` `` on the wire (`grantChildId`). They go away when grants become structure (step 4).
- **Fixed names in code-built nodes:** `fos:value:<shape>` (node-values.ts:13) and `fos:constructor:primitive` (primitives.ts:13). These aren't looked up, but they're hardcoded name strings.
- **Offer ids from capability names:** `handlerOfferId(peer, 'provideNode')` and similar are content addresses, but derived from a capability's name rather than its node.

**UI-only dispatch keys.** The constructor palette encodes menu actions as `name:`, `seed:` and `peer:` strings and slices them back apart (ui.ts:850–1016). These aren't graph ids, but they're parsed strings.

**Already gone:** `lib:` ids (only a comment remains), `memberEntryId`, the MEMBER primitive, the `relay:job:` prefix, `fos:setting:` names, and the parsed-peer transport chain.

I'd do the remaining P6 steps first, in order. Steps 3 and 4 also remove `accountContextAbove` and the grant ids, and declaring peer rows (step 1) gives P5 the structure it needs to stop reading peer ids.


I'll check the earlier transcript for what I actually said about this.

No, it isn't fixed. Going back through the transcript, I don't find a place where I said it was: it was on the leftovers list from the start, and it was point #1 of my first audit ("Capabilities are still a fixed list of names that drives everything"). But I can see how it reads as fixed, and part of that is my fault.

**Where I overstated it**
- **The PR description:** it says the blanket `startsWith('fos:')` checks are replaced by structural checks. `capabilityName` still does exactly that kind of prefix parse on `fos:capability:<name>`, so that line overclaims.
- **The library-fields work:** I described the library as "named fields with opaque aliases". That's true for types, but the capability patterns inside it are still named `fos:capability:*`, 92 times in the library data.

**It's bigger than the two lines I listed**
- **About 121 places** reach a capability by its name: `capabilityTarget(store, 'provideNode')`, `capabilityOf(...) === 'local'`, `handlerOfferId(peer, 'llm')`, the standard-pattern lookups in triggers.ts, and `capabilityName` everywhere it's used.
- **This round added more.** The connection code I just wrote calls `capabilityTarget(store, 'provideNode')` in 9 places. That breaks the no-name-lookup rule I'd been holding everything else to.

**What fixing it would mean** (same approach as the types got)
1. **Capabilities become library fields.** Code reaches them as `lib.capabilities.<x>` through the library instance, not `capabilityTarget(store, '<name>')`.
2. **The `fos:capability:*` names come out of the library data**, and so does the `capabilityName` fallback that parses them.
3. **Triggers read their definition only from the capability node's own data.** That's the `triggerDefinition` that's already there, with no match against the standard patterns by name.
4. **Offer ids are addressed by the capability's node, not its name.** For example, `handlerOfferId(peer, 'provideNode')` would use the provideNode node.
5. **The ~121 call sites change**, including this round's connection code.

How should I handle it?
- **Now, in PR #94, before more P6 work.** I'd lean this way, since every P6 step adds more capability lookups, and fixing it first means not writing more of them.
- **Its own step after P6.**

Either way, I'll correct the PR description so it doesn't


 claim name lookups are gone.




Yes. There are substantial inconsistencies beyond the capability hardcodes. I also need to correct my earlier assessment: the row-type migration itself is incomplete.
I traced the shared graph runtime, backend execution, web controller, and desktop bootstrap. Three findings below were reproduced with isolated, in-memory runtime probes; the others are supported by the active code paths.
Nested library types resolve correctly but aren’t consistently recognized. — Reproduced
rowTypeAt searches enclosing scopes, but typeIdOf uses a store-wide index assembled from the root and Home libraries. It doesn’t enumerate libraries attached farther down the graph.
I installed a changed task definition beneath a nested node: scoped lookup returned that definition, but type recognition returned null. Creation and subsequent interpretation therefore disagree about the same type.
[graph.ts (line 340)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/graph.ts:340)
Library access still has several different sources of truth.
Parameter interpretation reads primitive, negative, and string directly from the compiled library. libraryTypeAt can silently fall back to the shipped definition. Meanwhile, manual handlers are read through the mutable library definition, whereas row types use the version pinned by the library instance.
Consequently, changing or pinning a library does not consistently control all functionality that ostensibly belongs to it.
[parameters.ts (line 20)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/parameters.ts:20), [graph.ts (line 510)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/graph.ts:510), [library.ts (line 148)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/library.ts:148)
Unification and structural matching implement different choice semantics. — Reproduced
Structural matching requires every actual alternative to satisfy an allowed pattern. Unification can select one matching alternative and return a substitution.
In the probe, a value offered alternatives a and b, while the pattern required a. Structural matching rejected it; unification produced a binding from a. These algorithms need an explicit, shared relationship between “possible solution” and “valid value”; currently callers can receive different answers.
[unify.ts (line 22)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/unify.ts:22), [structural.ts](C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/structural.ts)
Submission acceptance is not actually one mechanism.
The main path records approvals and checks the merge rule. But selecting a pattern binding directly installs the submitted value. The organizer’s acceptance path copies submitted rows into main as an owner edit, then sync removes the proposal once its additions are present.
Those alternative paths do not pass through the common approval mechanism. Owner editing may be intentional, but treating it as submission acceptance gives different semantics. Also, the stored merge “pattern” is interpreted as a list of required approvers, rather than evaluated by the general pattern matcher.
[pattern-bindings.ts (line 112)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/pattern-bindings.ts:112), [node-sync.ts (line 233)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/node-sync.ts:233), [approvals.ts (line 143)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/approvals.ts:143)
Requirements still have a separate, capability-specific interpreter. — Inconsistency reproduced
Satisfaction is dispatched through hardcoded rules for task, allocation, search, peer, choice, and verification. The old requirement/supply records also coexist with the newer signed allocation representation.
More concretely, a supply pointing to a nonexistent allocation made requirementSatisfied return true. Evaluation separately detects that missing reference and rejects it. Displayed satisfaction and execution readiness therefore disagree.
[standard-requirements.ts (line 25)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/standard-requirements.ts:25), [graph.ts (line 1518)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/graph.ts:1518), [evaluation.ts (line 196)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/evaluation.ts:196)
Backend and browser execution resolve ambiguity differently.
The backend chooses the first active executor using .find(...). The browser requires exactly one executor and otherwise throws.
Even though both use the shared evaluator and handler discovery, executor ordering can decide backend behavior where the browser demands an explicit choice.
[backend evaluation.ts:28 (line 28)](/C:/Users/dmn32/main/code/fos/fos-mono/backend/sync/evaluation.ts:28), [app.ts (line 2948)](/C:/Users/dmn32/main/code/fos/fos-mono/web/src/app.ts:2948)
Reference resolution is spread across several engines with different scope rules.
Property expressions search enclosing scopes by name; scoped declarations shadow by declaration identity; contextBindings constructs another environment keyed by type and name; UUID references search the accessible tree; requirement outputs perform their own root-wide alias lookup.
Some distinctions are legitimate—an explicit UUID link need not behave like a lexical variable—but they aren’t governed by one shared scope contract. The proposed rule against defining and consuming a ref in the same scope is not enforced centrally.
[ref-paths.ts (line 42)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/ref-paths.ts:42), [scoped-refs.ts (line 87)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/scoped-refs.ts:87), [bindings.ts (line 43)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/bindings.ts:43), [destructure.ts](C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/destructure.ts)
Constructor fields have two declaration and assignment models.
Forms declare fields through data.parameter and construct/read them by field name and type. Callable constructors declare mutable refs and assign them by alias, with defaults on the left.
Both represent structured inputs, but discovery, defaults, and validation follow separate implementations. For example, assignRefAt does not perform the compatibility check used by setRefValueAt.
[forms.ts](C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/forms.ts), [constructor-rows.ts (line 46)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/constructor-rows.ts:46), [replica.ts (line 1000)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/replica.ts:1000)
Generic evaluation knows about one particular application’s bookkeeping.
The evaluator imports isAttempt from the planning-agent implementation and skips matching nodes. That predicate recognizes an attempt by the presence of language-model and text slots.
This makes an application-specific shape affect generic traversal. An otherwise ordinary node with that shape can be classified as bookkeeping. The graph should explicitly establish that relationship.
[work.ts (line 34)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/work.ts:34), [evaluation.ts (line 164)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/evaluation.ts:164)
Peer discovery and sharing still maintain parallel representations.
Handler discovery combines ordinary scoped declarations, membership advertisements, and synthesized legacy offers specifically for fos/mcp: peers. Sharing combines membership rows with private root-level endpoint records, masks, remote-reference flags, and replica metadata.
These remain active mechanisms, not merely unused migration helpers. Moving a relationship into graph structure does not yet remove the older representation or its special handling.
[handlers.ts (line 68)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/handlers.ts:68), [node-provider.ts (line 108)](/C:/Users/dmn32/main/code/fos/fos-mono/shared/sync/node-provider.ts:108)
There are additional hardcoded bootstrap lists, tool-name dispatches, and workflow-specific records. Those deserve cleanup, but native implementations, protocol names, scalar validation, and local runtime caches are not inherently architectural violations. The issue is when they independently decide graph meaning, scope, authorization, or handler selection.
I would prioritize consistent library resolution, matching semantics, acceptance, and executor selection before broad string removal. Those determine whether the generalized structure actually behaves consistently.
No repository files were changed. I ran the three runtime probes described above, not the full test suite; this is a substantial audit of the main paths, not a claim that every exception has been found.



Argument rows (2026-10-24): requirements and allocations are one kind of row, inverses; authority moves only through the allocate native; one native boundary. Left to do:
- Re-author `.fos/library.json` to argument rows: the `manual` fallback rows and the coding-request / Generate-subtasks template rows still carry `data.requirement`; fetch's `url`/`method` parameters keep the library's "negative = sent" reading (`isOutputPattern`). Then `node scripts/compile-library.cjs` and bump `FOS_DATA_VERSION`. Unblocks shared library/bindings/project-workflow tests and web primitives/project-workflow/regressions tests.
- Payment, points and calendar handlers still select rows by `requirement.resource` (`handles`); offer them under refined patterns (a negative allocation of an account) so the graph selects them, then make them natives whose bank is a row.
- Grant signing / verify-signature: back as natives, a signing step inside the allocate invocation.
- UI: a control to aim a bank grant at a requirement (`consumeAllocation(..., { to })`); allocation pickers, drag-to-supply, Pick time…, manual money/location fallbacks were removed. Editing an argument row's text re-creates it (children not kept).
- Organize/verify/capture flows: supplying no longer removes the request row or leaves a pending submission; the device-side verify half (node exchange carrying the requirement's @user) is gone.
- Several grants adding up to one requirement; consuming within one evaluation what an earlier step issued; a bank whose child requirement is open is refused as an operand.
- Legacy effects → natives one at a time (kernel-boundary.test.ts allowlists only shrink).
