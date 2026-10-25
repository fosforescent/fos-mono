# web - CLAUDE.md

## Directory Summary
Vanilla-TS task client for the browser and the Tauri desktop/mobile app (`desktop/`). Offline-first: the replica merges with the account or another device when connected. Design: `docs/sync.md`.

## Files
- `src/main.ts` - entry; the dev-only auto sign-in from `VITE_API_USERNAME/PASSWORD` must never reach production bundles
- `src/app.ts` - controller
- `src/ui.ts` - DOM rendering from app state
- `src/api.ts` - backend calls
- `src/p2p.ts` - WebRTC direct connections
- `src/storage.ts` - local persistence of the replica, prefs and session
- `src/rows.ts` - row marker parsing and formatting
- `src/timeblocks.ts` - the time-block picker
- `src/style.css` - styling; keep class names stable, the tests query them
- `src/markdown.ts` - Markdown rendering
- `src/project.ts` - project mode inside Tauri
- `src/filesystem.ts` - desktop-only directory rows and file references
- `src/sharing.ts` - share URLs and publishing controls
- `src/site.ts` - the one renderer of the share page and the embed; no app imports
- `src/embed.ts` - the standalone embed
- `src/combobox.ts`, `src/alternatives.ts` - row branching and child navigation popovers
- `src/branch-compare.ts` - branch comparison and reviewed merges

## Conventions
- Replica operations return a new replica object; always use the returned value.
- `tsconfig.json` deliberately omits `erasableSyntaxOnly`/`noUnused*`/`verbatimModuleSyntax` so the graph code in `shared/` compiles; do not add them.
- The UI never sees content addresses.
- A row's type is its edge's left node; rows render by type, never by a kind (see `docs/sync.md`, "Row types"). Any row can be zoomed into, invited to, or attached to by a device; there is no "partition" concept.
- Resource banks and allocations preserve the time bounds the user typed while parsing, editing, copying and rendering; an absent bound stays absent, never now or a duration inferred from the amount. Bank marker syntax may carry the window immediately after the marker, such as `@money ..2026-12-31 Travel 500`. Bounds are data: nothing may present them as enforced, and only a concrete scheduling action may choose event dates.
- A typed `$ 50` is data, not authority: it fills no resource demand. Only an allocate invocation consuming a grant fills a resource demand.
- Banks resolve as scoped handlers: several visible banks of a type are a choice, never the first one found. Allocations must resolve resource handlers through enclosing scoped declarations. Private sibling banks must stay unavailable, and multiple eligible handlers must require a choice.
- A local edit that would make a type error must be refused.
- Safe-area padding applies only in the native shells; ordinary browsers get none. The phone breakpoint must not override native top padding. Longer content must scroll normally.
- Child text/capability filters must not mutate data. Named custom types are nominal identities.
- Node history controls select the latest change confined to that subtree and refuse changes that also affect siblings.
- What integrations and the fos server provide must come from the server's handler registry, never from a built-in list, so the palette only shows constructors with a handler behind them.
- Inside Tauri, OAuth sign-ins open in the system browser: Google refuses embedded webviews.
- Peer-run requirement actions go through evaluation of the requirement; the handler registry executes the effect. LLM results require human review before they are accepted.
- The constructor panel holds constructors only: no text, fields or buttons beside them. Clicking a constructor makes a row, and whatever it needs is entered in that row.
- Triggers are handlers of whoever runs them, not a peer of their own.
- MCP servers expose exactly the tools their grants allow and accept nothing when all are off.
- Peer policies are enforced on sync: no round without `from: read`; without `to: autopush` nothing local leaves; `to: edit` gates proposals; `from: read-requests` gates the proposals list.
- Search runs only as the server's `search` effect through evaluation; there is no search route.
- The market is a peer (`fos:market`); a node is listed iff it is a member there. Listing runs the server's `market` effect; unlisting is removing that member.
- Generate icons (`public/favicon*.png|ico`, `apple-touch-icon.png`, `icon-192/512.png`, `site.webmanifest`) from the tree logo (`web/assets/logo3-bare.ico`).

## Interaction
- The tree is Workflowy-style: no add bar; a blank row at the bottom of the view is where the cursor defaults, and Enter there makes a row and stays ready for the next. The selected row is an inline editor; editing shows a row's raw marker text and re-parses it on commit, keeping the row's id and children.
- Drag moves a row, Alt+drag places a reference, Ctrl/⌘+drag places a deep copy; a row dropped on a breadcrumb goes to the end of that node the same way.
- Tree, grid, chat and queue views share the same row editor and graph.
- Long prose pastes become a capture to organize; structured pastes keep their row behavior. A failed organize request keeps the capture as a note.
## Running
```bash
cd web && VITE_API_URL=http://localhost:4000 npx vite --port 5199
```

Use `/dev-harness.html` (served by vite, not part of the build) for layout checks; `?open` opens the nested sample node. Phone widths render in an iframe (headless Chrome enforces a minimum window width). Browser layout smoke checks should include 390px and 260px widths with the accordions expanded.

## TODOs
- [ ] Audio transport for direct connect bootstrapping
- [ ] Tauri file-backed `ReplicaStorage`
- [ ] Deliver `-@name` assignments into the assignee's replica
- [ ] A mail handler for the `mail` capability
- [ ] Devices register capabilities too

## Zoomed nodes and evaluation
Template placeholders are neutral until instantiated. Peer-backed actions use live availability as well as the node's inherited offers.

An executor that cannot run must block, never mark a requirement fulfilled. Evaluation journals are not ordinary undo entries. Review recovery creates/checks manual compensation tasks before unlocking a failed transaction.

Triggers do not replay failed/uncertain occurrences automatically. Trigger settings and execution records are typed document refs, not additional row kinds. Duplicate tabs must not run the same trigger concurrently. Invalid schedules must not create partial rows.

## Sharing and published sites
- A visit must preserve the visitor's own session and context. Local search/drop supplies only the declared text/allocation projection. Anonymous source links stay in the local context; signed-in source links stay in that user's account.
- Published rows render by their type, never by a row kind.

## Peer and branch editing
- Peers are reached like any capability: each connection is the transport of its peer, resolved in scope. No code picks a transport from a peer id.
- `@name` is a person allocation; `@{handler}` creates an ordinary row backed by a peer-typed mutable ref.
- Proposal previews and incoming branches are read-only until copied.
- An approved branch merges only once the node's merge rule holds.
- Late responses from a previous data session are ignored.
- A merge request asks to merge its branch into the branch on screen when it was made. Merging a reviewed comparison must first check that the reviewed graph and selection have not changed.
- A deleted setting row must not be made again.

## Row workspace and clipboard

Cross-subtree drag/link and clipboard operations must create a declaration in the
lowest shared scope, retaining references from both locations. Show a failure if
the source depends on private bindings that cannot follow it. Independent copies
must close external refs rather than retain hidden live links. UI search can find
editor selections globally; evaluating those selections must use lexical scope.

Notes are a title line plus a Markdown body row. A note's Markdown resolves `{name}` from the bindings in scope, as any text does; a note executes as its body. Choose rendering and editing from the pinned definition, never from the row's native kind.

Structured paste must bound depth/count and disable YAML aliases. Missing allocation banks retain unbound values for later resolution.

### Node input workspace
- Received fields remain read-only except for selecting an existing submission.
- Uploads capture their destination and data session first and never follow navigation into another data session.

### Constructor palette
Placeholder type selection must use the shared declaration resolver and preserve ambiguity and access failures. Reading a declaration's pattern may include an unfilled parameter; it must not pretend that parameter has a value.

Library menus and constructor suggestions must use the library instance in the destination scope. Missing or incomplete definitions must remain unavailable; the UI must not substitute the build bundle. Existing rows must retain their pinned definitions.

Capability signs: neutral = a row of it (data); + = a supply of it; − = a requirement of it (a hole). A capability pattern is AND over its groups and OR within a branch; a row matches when it or a row inside it is one of each group's terms. Typed argument targets validate the constructor capability.

Capability definitions can contain ordinary named `icon` and `description` rows. Generic inversion uses the graph's negative parameter, without an inverse registry.

Banks and allocations remain ordinary editable rows.

Built-in placeholder selections pin type CIDs, so they never collide with same-named scoped refs. Composing a requirement into a typed placeholder preserves the invocation as a child; the placeholder remains unresolved until that child completes. Pull answers name the actual device peer.

### Constructor discovery and effects
- The constructor picker does not dispatch effects.
- Local Pull and server integration effects must be evaluated separately.
- Menu-created triggers start paused; schedule errors and incompatible input types leave the graph unchanged.
- Editor operations (undo, text/media input) are controls; they do not become workflow effects.

## Standard library

Bootstrap the device library explicitly from the checked-in graph. Shared library edits must not change an instance until it is upgraded. Browser documents nested in a device must inherit that graph scope, and CLI exports must preserve the authored graph. Manual and device handlers must come from the bound library and its explicit arguments.
