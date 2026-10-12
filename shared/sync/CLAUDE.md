# shared/sync - CLAUDE.md

## Directory Summary
Offline/online sync on top of the hash-consed FosStore: identity-keyed
three-way merge that turns divergences into CHOICE nodes, the peer-link
protocol, and the device replica. Shared by the web client (and through it the
Tauri desktop/mobile shell) and the backend. Design: `docs/sync.md`.

## Files
- `embed.ts` - the replica API as JSON-string functions on `globalThis.fosCore` (+ `tree`, `findTask` for the shell); bundled by esbuild into `desktop/src-tauri/js/fos-core.js` and run in QuickJS by the `fos` binary. Rebuild after changing anything here: `cd desktop && ../node_modules/.bin/esbuild ../shared/sync/embed.ts --bundle --format=iife --platform=browser --target=es2020 --outfile=src-tauri/js/fos-core.js --inject:src-tauri/js/prelude.js`
- `graph.ts` - conventions and helpers. **Mutable references** are one shape (ALIAS/ref node: TARGETPOINTER value, optional INSTRUCTIONPOINTER type, PREV history, MEMBER/PROPOSAL/PEER bookkeeping) used by the root alias, link rows (`[refNode, KIND]`, read through `valueContent`, advanced by `relinkContent`) and reference rows (`data.ref.id` + a TARGETPOINTER snapshot). `updateAtScope(..., 'value'|'node')` edits content (refs advance with PREV) or bookkeeping (no version). `normalizeRefs` rewrites legacy inline links (`data.link`). row edges `[rowNode, KIND]` for task/plain/note/comment/ref (`rowKindOf`, `rowContent`, `convertRowContent`, `copyRowContent`, `findRowByAlias`), peer/choice edges, and legacy `[LIST, node]` plain rows from older data built from existing primitives, identity keys (`data.alias.id`), `resolveScope`/`updateAtScope` path copying (steps through tasks too; links get PREV on content change), `moveChild` (above/below/into), link nodes (`makeLink`, members with capabilities, proposals, `linkHistory`), `commitRoot`, `reachableNodes`/`importNodes`, and the UI view model (`viewNode`)
- `merge.ts` - `mergeNodes(store, base, ours, theirs, labels)` and `resolveChoiceIn`
- `protocol.ts` - `SyncRequest`/`SyncResponse`, `parseSyncRequest`, `serveSync` (server side; `proposeOnly` runs branch mode at link nodes), `applySyncResponse` (device side)
- `replica.ts` - `Replica = { store, meta }`, edit operations, `buildSyncRequest`/`completeSync`, `reattach`, `serializeReplica`/`loadReplica`
- `sync.test.ts` - merge, protocol and two-devices-plus-user-group simulations

## Constraints
- Must compile under the `shared/`, `web/` and `backend/` tsconfigs (no enums, no parameter properties, extensionless imports).
- Replica operations mutate the store and return a new replica object; never keep using an older replica object after an edit.
- Only existing primitives (`completeField`, `listField`, `choiceTarget`, `optionNotSelectedConstructor`, `conflictBaseNode`, pointer constructors, `previousVersion`, `mergeSourceNode`, `peerField`) are used; do not add primitives for sync.

## Invariants
- Requests and responses carry `cidVersion`; peers in a different cid format are refused (`version-mismatch`, HTTP 409) and `importNodes` only accepts current-format nodes that verify.
- Equal content ⇒ equal cid on every peer (`hashContent` sorts edges).
- A thing is either a task (or legacy plain node) edge or inside a CHOICE edge under the same alias id, never both.
- After `completeSync`, the replica's root target equals `meta.baseCid` equals what the server holds at the scope.

## Testing
```bash
cd shared && npx jest sync/
```

## TODOs
- [x] User-controlled task ordering (cid v2 + order-preserving merge)
- [ ] Prune root-alias history in the stored replica
- [ ] Unify with `FosExpression.merge`/`resolveConflict` and `FosNode.addTodo`
