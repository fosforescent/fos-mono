# Handoff: one native boundary (2026-10-24)

Branch `feature/consistent-scope-resolution`. Work is committed as "WIP: one native boundary"; tests are **not green**.

## Goal of the change

1. Requirements and allocations are one kind of row — argument rows `[pattern, ref]` — inverses of each other (`shared/sync/arguments.ts`). A requirement is a negative pattern whose ref is a hole; an allocation is the same pattern, positive, holding the value. Satisfaction is pattern matching (`argumentSatisfied`). Authority (grants) moves only through `allocateNative` invocations.
2. Every trace of the old requirement/allocation mechanics removed (no `data.requirement`, no `${id}:result`, no `requirementResultPattern`, no `addSupply`, no payment records).
3. One native boundary (`shared/sync/native.ts`): `Native = (operands: Compiled, context) => Promise<NativeResult>`; a requirement step's own hole is the operand `self`. The evaluator submits answers as proposals, pattern-checked, published at commit. Every host effect — github, calendar, llm, title, market, search, points, payment, mail, verify, organize, MCP tool, web pull/agent/fetch/allocate, desktop provideNode/sync — is a native registered through the one mechanism in `shared/sync/natives.ts` (`defineNative`/`registerNatives`/`restoreNatives`/`nativeExecutors`, and `registerNative`/`restoreNative`/`nativeOffer`/`nativeValues`/`nativeExecutorsOf` for hosts whose meaning is a richer object). No `legacy`, `prepare`, `outputs`, `rollback`, `opensRefs` paths remain. `solve` was removed: it needs the scope, which a native does not see.

Rules the user set: no half migrations (finish or stop and explain); no string parsing in semantics (property paths like `capabilities.allocation` are input-time only; tag rows `[capability, unit]` carry identity structurally); tests sit at an interface and test behavior from outside it — rip inner-mechanism tests on re-implementation.

## Design correction from the user (2026-10-24, after handoff)

Natives must be able to read the tree, lazily, the same way the MCP server, CLI and API do: `NativeContext` gets a read handle (resolve a scope, read a node's rows, follow refs) under the evaluating principal's access checks, and natives pull what they need on demand. Compiled operands remain what a step hands over up front, not a wall. Writes still happen only through returned answers (transaction/rollback unchanged). Restore with this: organize's outline (`captureOutline` through the handle), paying whoever answered the task, mail body from the task's rows, search filtering against existing rows, MCP provider choice by scope membership.

## Instructions for the next agent (priority order; the user's requirements, not suggestions)

Rules: no half migrations — delete the old path in the same change. No string parsing in semantics. Tests sit at an interface; rip tests of inner mechanics. One failing test file at a time, filtered output, commit at every green boundary. Do not write to `current_tasks.md`.

### A. Answers are typed values of the pattern, not description text

Today natives answer with `valueOfPattern(self.pattern, { description: text })` and readers use `requirementAnswer` → `value.data.description`. The pattern never declares what the answer is, so the answer is untyped and reading it is convention.

1. A requirement's pattern declares its result the way it declares inputs: a declared ref (positive argument row) on the pattern, e.g. `title` declares a text result, `search` declares a container of reference rows, `organize` declares a container of rows, `tool` declares a text result, `verify` declares a `user` field, `allocation` demands declare a grant (already typed). Add these declarations in `.fos/library.json` for each capability (then `node scripts/compile-library.cjs`, bump `FOS_DATA_VERSION`), with `withInputs`/`patternInputs`-style helpers for results (`patternResults`, `resultOf`).
2. The native fills the declared result refs: `NativeResult.outputs` keyed by result name, `self` becoming the value whose declared refs are filled (`valueOfPattern` fills them; `patternIsValuePredicate` already checks the value against the pattern, so a wrong-typed answer is refused by the evaluator, not by the reader).
3. Replace `requirementAnswer` with reading the declared result (`resultOf(store, pattern, value, 'title')`); delete `requirementAnswer`. Callers: `web/src/app.ts` (title, organize), `backend/voice/organize.ts`, `backend/integrations/mcpPeers.ts`, `backend/sync/hostHandlers.test.ts`, `mcpPeers.test.ts`, `organize.test.ts`.
4. `description` on an answer is then presentation only (a label); nothing reads it for meaning.

### B. Handler selection by pattern, never by name (`handles` is deleted)

`handles: step => step.row?.requirement?.resource === 'points'` (points, payment, calendar in `backend/sync/hostHandlers.ts`), `requirement.tool === 'fos.pull'` / `AGENT_TOOL` (`web/src/device-handlers.ts`), `capability === 'tool'` (`backend/integrations/mcpPeers.ts`) are name dispatch.

1. Each handler's `ref` is a `PrimitiveDefinition` whose `type` is the refined pattern it serves: points = `allocationPattern(store, at, { type: 'points', unit: 'ff' }, true)` negative; payment = negative allocation of `account`; calendar = negative allocation of `calendar`/`person`; pull = `tool` refined with its `tool` input filled with the text value `fos.pull` (`withInputs`); agent likewise with `AGENT_TOOL`; MCP tool = `tool` with the `tool` input declared (unfilled) so any named tool matches.
2. Executor selection (`nativeExecutorsOf` / `primitiveExecutors` → `matchesInstructionRef`) matches the step's declaration pattern against the offer's type structurally (`matchesGraph`), already how capability patterns are compared. Several matching offers = a choice for the owner (existing rule).
3. Delete `handles` from `HostHandler`, `PrimitiveDefinition`, `NativeImplementation`, `nativeExecutorsOf`, and every definition. Delete the `'points'`/`'account'`/`'calendar'` string checks.
4. Tests at the interface: a points demand runs the points native and not the payment one; a `-tool fos.pull` runs pull; an unrefined `-tool weather` runs the MCP native; a demand nobody's pattern matches is blocked with "no handler".

### C. Natives read the tree lazily

Natives must be able to read the tree the same way the MCP server, CLI and API do: `NativeContext` gets a read handle (resolve a scope, read a node's rows, follow refs) under the evaluating principal's access checks, pulled on demand. Compiled operands remain what a step hands over up front, not a wall. Writes still happen only through returned answers (transaction/rollback unchanged). Then restore: organize's outline (`captureOutline` through the handle; the model sees the target's subtree again), paying whoever answered the task when no `@user` is named, mail body from the task's rows, search filtering against existing rows, MCP provider choice by scope membership (`mcpMembersAbove`).

### D. Then finish the port

Run the suites one file at a time (state in "State at handoff" below), regenerate the kernel-boundary allowlists, residue grep, re-author `.fos/library.json`, update `shared/sync/CLAUDE.md` and `web/CLAUDE.md`.

## Kernel fixes made while porting (keep)

- `structural.ts` matchesGraph: a sum's alternatives are its option rows only; its tag/kind rows are not options (a choice hole was satisfied by any container).
- `graph.ts` `withMemberHolder`: when memberships move into the held value, the ref's own member edges are stripped (unpublish/removeMemberAt left a copy behind).
- `graph.ts` rowView: a requirement's `user` is the answer's user when it has one, else the declaration's.
- `ref-compiler.ts`: constructors (edge lefts) are kept by identity unless they contain a `ref`/`refExpression` (`containsRef`); `assertCompiledGraph` no longer descends into lefts. Before, compiling renamed a form's nested `verification` type and attested users lost their signature.
- Payments are record-less: Stripe metadata carries `amount`/`unit`/`payee`; `settlePayment` (`shared/sync/payments.ts`) mints the grant via `bindIssuedAuthority`; `PaymentRecord`/`paymentRecord`/`writePaymentRecord` are gone; web `paymentControls` shows only Pay.
- `requirementAnswer(r, path)` (`arguments.ts`): the answer text of a filled requirement; replaces `handlerResult` for title/organize/MCP answers (`handlerResult` stays for sharing/project-workflow/specifications named values).

## State at handoff (last runs)

- shared `npx jest sync/`: 339/352. Failing: `bindings`, `library`, `project-workflow` (library data: `.fos/library.json` still carries `data.requirement` on manual-fallback rows and the Generate-subtasks/coding-request templates — re-author, `node scripts/compile-library.cjs`, bump `FOS_DATA_VERSION`); `organize`, `ref-compiler` — new after the last two edits (organize helpers `applyOrganizePlan`/`proposeOrganizePlan`/`organizePlanChanges` were deleted; the compiler now keeps constructors by identity), unexamined.
- backend `npx jest --runInBand`: 132/137 (tsc clean). Failing: verify `row.user` expectation; MCP primitive-ref call (tool name read from `operands.left` — check what `rowLeft` gives for an `addRefCall` row); organize ×2 and `channels/textCommands` organize test — these were just rewritten to the new semantics and never run green.
- web: tsc clean; suites not re-run after the organize/title port in `web/src/app.ts`. Expect `web/tests/capture.cjs` (writeHandlerResult-based organize flow) to need porting; earlier 8 failures were attributed to library data / unrelated ui.ts changes.

## Next steps, in order

1. Run the three suites; fix at the interface (rip tests of removed inner mechanics rather than reviving them).
2. Regenerate the `shared/sync/kernel-boundary.test.ts` allowlists from its output; residue grep: `legacy`, `prepare(`, `paymentRecord`, `handlerResult` used for requirement answers, `nativeRef`/`publishNativeRef` outside `natives.ts`.
3. Re-author `.fos/library.json` to argument rows and bump the data version.
4. Update `shared/sync/CLAUDE.md` "awaiting replacement" list (still mentions legacy effects) and `web/CLAUDE.md` with the list below.

## Gutted in this change (functionality to re-implement, not abstractions)

- organize: the plan is no longer one fos submission on the target (accepted from Branches / `autoAcceptCaptures`); it lands as rows inside the filled request, which stays. The model no longer sees the target's outline (natives see no tree). Texted messages: the filled request waits in Home.
- payments/points: the payee must be named `@user` on the row; paying whoever answered the task is gone. The pending payment page link and failure reason are gone from the UI. Re-running an open payment asks the provider again under the same idempotency key.
- mail: body is the request text only (no task rows). market: the market peer no longer joins the task; listed = satisfied market requirement. search: hits are not filtered against existing rows.
- MCP: provider pinning on failure, needs-recovery journal, explicit handler ref, per-tool disabling and scope-based provider choice are gone; the tool is chosen among the account's servers (several offering it = refuse).
- Evaluator: a thrown native rolls the run back (effects `reverted`) instead of needs-recovery + a manual rollback task.
- `solve` native; the device-side verify half (node exchange carrying the requirement's @user); allocation pickers / drag-to-supply / Pick time / manual money & location fallbacks in the web UI.


## Usability checkpoint (2026-10-24)

The usability port is now green. The original failure counts above describe the starting point, not the current checkout. The user asked to finish this port before addressing A-C; typed results, pattern-selected handlers and scoped lazy native reads remain deferred.

- The checked-in library now uses argument rows, with its generated artifact rebuilt in data version `0.0.6`. Existing stores were not reset; older formats are still rejected under the repository's version policy.
- Instruction compilation preserves constructor identity and source locations, opens output holes, and carries access checks. Calls materialize default input and output refs. Native writes follow forwarded references to their actual declarations, rejecting cycles and unavailable targets.
- Organize keeps the original capture and nested generated rows inside the filled request, counts only generated rows, and falls back to a note on failure. Removed proposal-plan helpers and the obsolete auto-accept capture setting stay removed.
- Browser workflows now cover typed peer placeholders, deferred Pull composition, real device identity on Pull answers, requirement controls alongside declared inputs, verified-user reuse, title editing and read-only proposal previews. Hosted forms distinguish visitor inputs from empty native outputs while keeping issued grants available for use.
- Browser fixtures use the actual drag/drop interface. Library loading is verified through the controller before the separate palette UI scenario, avoiding repeated JSDOM rendering during remote materialization.

Validation: 358 shared tests across 55 suites; 137 backend tests across 28 suites; the 21 affected backend sharing/event tests rerun after the final input-filtering correction; all 42 browser test files completed (the suite was resumed after fixing its allocation case). Web, embedded web, backend and desktop embedded-core builds pass. Kernel-boundary allowlists were not expanded. No payment-record implementation or `prepare()` effect path remains in the checked runtime directories; low-level native registration wrappers remain part of the deferred cleanup. `current_tasks.md` was not changed.

Core/backend checkpoint: `7f5d970`. The subsequent browser checkpoint also contains the final correction that keeps filled native-output grants available to the execution UI.
