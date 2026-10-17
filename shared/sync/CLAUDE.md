# shared/sync - CLAUDE.md

## Directory Summary
Offline/online sync on top of the hash-consed FosStore: identity-keyed
three-way merge that turns divergences into CHOICE nodes, the peer-link
protocol, and the device replica. Shared by the web client (and through it the
Tauri desktop/mobile shell) and the backend. Design: `docs/sync.md`.

## Files
- `embed.ts` - the replica API as JSON-string functions on `globalThis.fosCore` (+ `tree`, `findTask` for the shell); bundled by esbuild into `desktop/src-tauri/js/fos-core.js` and run in QuickJS by the `fos` binary. Rebuild after changing anything here (esbuild from the root or `web/node_modules/.bin`): `cd desktop && ../node_modules/.bin/esbuild ../shared/sync/embed.ts --bundle --format=iife --platform=browser --target=es2020 --outfile=src-tauri/js/fos-core.js --inject:src-tauri/js/prelude.js`
- `graph.ts` - conventions and helpers. **Mutable references** are one shape (ALIAS/ref node: TARGETPOINTER value, optional INSTRUCTIONPOINTER type, PREV history, MEMBER/PROPOSAL/PEER bookkeeping) used by the root alias, link rows (`[refNode, KIND]`, read through `valueContent`, advanced by `relinkContent`) and reference rows (`data.ref.id` + a TARGETPOINTER snapshot). `updateAtScope(..., 'value'|'node')` edits content (refs advance with PREV) or bookkeeping (no version). `normalizeRefs` rewrites legacy inline links (`data.link`). row edges `[rowNode, KIND]` for task/plain/note/comment/ref/requirement/supply/query/resource/allocation/template (`rowKindOf`, `rowContent` with `RowExtras`, `convertRowContent`, `copyRowContent`, `findRowByAlias`), requirements (`CapabilityKind` = task | allocation | search | confirmation | choice | market | mail | peer | llm | repo | tool; `requirementSatisfied` accepts a child row of the required kind, allocations adding up to the amount, a person allocating themself for `peer`, or a matching supply; `requirementProgress` = have/need for amounts, `taskBlockers`, `requirementSummary`), banks (`ResourceType` = calendar | account | inventory | person, `allocatedIn`), templates (`findTemplate`, `templateRequirements`) and `PEER_CAPABILITIES`, peer/choice edges, and legacy `[LIST, node]` plain rows from older data built from existing primitives, identity keys (`data.alias.id`), `resolveScope`/`updateAtScope` path copying (steps through tasks too; links get PREV on content change), `moveChild` (above/below/into), link nodes (`makeLink`, members with capabilities: `Capability` = read | read-requests | edit | approve | autopush | direct | http | ws | relay | search | market | mail as `[CAPABILITY, constructor]` edges (the `to` direction) and `[ACCEPTS, constructor]` edges (the `from` direction), `disabledCapabilities` data for switched-off ones, `PeerPolicy`/`parsePolicy`/`DEFAULT_DEVICE_POLICY`/`RECEIVE_ONLY_POLICY`, `SERVER_TRANSPORT_CAPABILITIES` (what is true of the account server without any handler; its services are derived by the backend registry and arrive as `capabilities` in responses, recorded on the fos member by `ensureHomeContext(replica, now, offers)`), `CAPABILITY_LABEL`, `withMember`/`withoutMember`/`hasCapability`/`acceptsFrom`; proposals, `linkHistory`), `commitRoot`, `reachableNodes`/`importNodes`, and the UI view model (`viewNode`)
- `merge.ts` - `mergeNodes(store, base, ours, theirs, labels)` and `resolveChoiceIn`
- `protocol.ts` - `SyncRequest`/`SyncResponse`, `parseSyncRequest`, `serveSync` (server side; `proposeOnly` runs branch mode at link nodes; `onlinePeers` → `presence`, `capabilities` → what the server registers with the peer), `applySyncResponse` (device side)
- `replica.ts` - `Replica = { store, meta }`, edit operations (`addRow` with `AddRowOptions`, `addSupply`, `setMarketAt`, `setQueryOptionsAt`, `findTemplateByName`/`instantiateTemplate`, `addMemberAt`/`setMemberCapabilitiesAt`/`removeMemberAt`, `setRowContentAt` (rewrite a row's kind/text/data in place from re-parsed text); `setTaskDone` refuses while `taskBlockers` is non-empty), `buildSyncRequest` (`{ push: false }` sends the base as head: a receive-only round, nothing local leaves) / `completeSync`, `reattach`, `serializeReplica`/`loadReplica`
- `project.ts` - `fos.config.toml` reader (`parseToml`, `FosProjectConfig` with `[attach]`, `[serve]`, `[server] to/from`, `[peers.<name>] to/from`; `serverPolicyOf`, `peerPolicyOf`)
- `sync.test.ts` - merge, protocol and two-devices-plus-user-group simulations

## Constraints
- Must compile under the `shared/`, `web/` and `backend/` tsconfigs (no enums, no parameter properties, extensionless imports).
- Replica operations mutate the store and return a new replica object; never keep using an older replica object after an edit.
- Row kinds map to primitives in `dag-implementation/primitive-node.ts` (COMMENT, REQUIREMENT, SUPPLY, QUERY, RESOURCE, ALLOCATION were added for rows); sync bookkeeping itself only uses existing primitives (`completeField`, `listField`, `choiceTarget`, `optionNotSelectedConstructor`, `conflictBaseNode`, pointer constructors, `previousVersion`, `mergeSourceNode`, `peerField`).

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

## Node evaluation and triggers
- `bindings.ts` accepts a runtime `isPeerActive` predicate. Recursive binding resolution checks explicit and inherited handlers; connectivity is not stored as a permanent grant. `capabilityPeers` distinguishes handler offers from permissions granted to peers.
- `evaluation.ts` checks bindings, conflicts, instructions, and overlapping resource allocations; opens parents first and commits children first. It stores its journal as a named document ref (`fos:evaluation`). Completion is staged until all commits succeed. Handler effects are journalled before dispatch; failed/uncertain effects without compensation produce ordinary recovery tasks. Interrupted evaluation cannot automatically repeat. Executor drivers must serialize evaluation and recovery, persist before dispatch, and revoke their own graph results when compensating.
- `triggers.ts` uses the same typed refs for configuration and occurrence state. Timers belong to one device; parent-completion and incoming-proposal triggers use that device's observed events. A template trigger instantiates the existing template and evaluates the instance. Failed/interrupted occurrences require review. Runtime journals are not cloned; instantiated templates do not inherit scheduling declarations.
- Cron supports five numeric UTC fields, lists/ranges/steps, and the day-of-month/day-of-week OR rule. The current scheduler checks the current minute (no missed-run replay) and the server's default branch selections.


Home normalization keeps `fos:home` as an ordinary plain container, not a workflow template. Legacy Home template edges are converted without changing the node identity or children. Editable Home choice wrappers must be preserved across normalization and reload; context tests cover branch isolation as well as idempotent legacy migration.

`view(..., true)` / `viewNode(..., true)` opt into constructor rows for Settings: named setting refs and existing member/device edges are projected with their stored aliases; default evaluation/content views remain unchanged. Peer constructors carry stable aliases. Settings deletion uses ordinary ref-child deletion, while member/device deletion removes the existing bookkeeping edge on the parent identity.

Branch choice pointers may carry a named `request merge` typed approval ref. `ChoiceOption.requestMerge` projects that child; branch edits, copying and serialization preserve it. Three-way merges retain a request toggled concurrently with branch content. Received branch constructors reuse the same approval child; existing proposal wire/authorization APIs remain compatible. Peer constructor syntax `@{handler}` is excluded from single-brace text parameter parsing and substitution.

Requirement destructuring (`destructure.ts`) uses named typed refs whose existing `ref` field identifies the source requirement. Amount outputs are bounded planned slices, unavailable until source fulfillment; choice outputs expose exactly one selected option. Bind outputs to ordinary record arguments or an allocation's `amount` argument. Resolution follows the current source and refuses removed outputs. Fulfilled amount requirements participate in allocation capacity checks as derived banks. Template instantiation remaps owned source identities and supports ordinary record rows; it copies the definition at application time, not live inheritance.
