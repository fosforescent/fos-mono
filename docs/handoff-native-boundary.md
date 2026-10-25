# Handoff: one native boundary (2026-10-24)

Branch `feature/consistent-scope-resolution`. Work is committed as "WIP: one native boundary"; tests are **not green**.

## Goal of the change

1. Requirements and allocations are one kind of row — argument rows `[pattern, ref]` — inverses of each other (`shared/sync/arguments.ts`). A requirement is a negative pattern whose ref is a hole; an allocation is the same pattern, positive, holding the value. Satisfaction is pattern matching (`argumentSatisfied`). Authority (grants) moves only through `allocateNative` invocations.
2. Every trace of the old requirement/allocation mechanics removed (no `data.requirement`, no `${id}:result`, no `requirementResultPattern`, no `addSupply`, no payment records).
3. One native boundary (`shared/sync/native.ts`): `Native = (operands: Compiled, context) => Promise<NativeResult>`; a requirement step's own hole is the operand `self`. The evaluator submits answers as proposals, pattern-checked, published at commit. Every host effect — github, calendar, llm, title, market, search, points, payment, mail, verify, organize, MCP tool, web pull/agent/fetch/allocate, desktop provideNode/sync — is a native registered through the one mechanism in `shared/sync/natives.ts` (`defineNative`/`registerNatives`/`restoreNatives`/`nativeExecutors`, and `registerNative`/`restoreNative`/`nativeOffer`/`nativeValues`/`nativeExecutorsOf` for hosts whose meaning is a richer object). No `legacy`, `prepare`, `outputs`, `rollback`, `opensRefs` paths remain. `solve` was removed: it needs the scope, which a native does not see.

Rules the user set: no half migrations (finish or stop and explain); no string parsing in semantics (property paths like `capabilities.allocation` are input-time only; tag rows `[capability, unit]` carry identity structurally); tests sit at an interface and test behavior from outside it — rip inner-mechanism tests on re-implementation.

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
