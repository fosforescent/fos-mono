# Native boundary: intent

Rules: no half migrations — delete the old path in the same change. No string parsing in semantics (property paths are input-time only; tag rows `[capability, unit]` carry identity structurally). Tests sit at an interface and test behavior from outside it; rip tests of inner mechanics on re-implementation.

## One native boundary

- Requirements and allocations are one kind of row — argument rows `[pattern, ref]` — inverses of each other. A requirement is a negative pattern whose ref is a hole; an allocation is the same pattern, positive, holding the value. Satisfaction is pattern matching.
- Authority (grants) moves only through allocate invocations.
- Every host effect is a native registered through one mechanism. A native receives compiled operands; a requirement step's own hole is the operand `self`. The evaluator submits answers as proposals, pattern-checked, published at commit.

## Answers are typed values of the pattern

1. A requirement's pattern declares its result the way it declares inputs: a declared ref (positive argument row) on the pattern — e.g. `title` declares a text result, `search` a container of reference rows, `organize` a container of rows, `tool` a text result, `verify` a `user` field, allocation demands a grant.
2. The native fills the declared result refs; the evaluator checks the value against the pattern, so a wrong-typed answer is refused by the evaluator, not by the reader.
3. Readers read the declared result by name, never answer description text.
4. `description` on an answer is presentation only; nothing reads it for meaning.

## Handler selection by pattern, never by name

1. Each handler is typed by the refined pattern it serves (e.g. points = negative allocation of `points`/`ff`; payment = negative allocation of `account`; calendar = negative allocation of `calendar`/`person`; pull = `tool` with its `tool` input filled with `fos.pull`; MCP tool = `tool` with the `tool` input declared but unfilled, so any named tool matches).
2. Executor selection matches the step's declaration pattern against the offer's type structurally. Several matching offers = a choice for the owner.
3. No name dispatch: no `handles` predicates, no resource/tool/capability string checks.
4. Behavior to test at the interface: a points demand runs the points native and not the payment one; `-tool fos.pull` runs pull; an unrefined `-tool weather` runs the MCP native; a demand nobody's pattern matches is blocked with "no handler".

## Natives read the tree lazily

Natives must be able to read the tree the same way the MCP server, CLI and API do: the native context gets a read handle (resolve a scope, read a node's rows, follow refs) under the evaluating principal's access checks, pulled on demand. Compiled operands are what a step hands over up front, not a wall. Writes happen only through returned answers (transaction/rollback unchanged).

## Invariants

- A sum's alternatives are its option rows only; its tag/kind rows are not options.
- When memberships move into a held value, the ref's own member edges are stripped.
- A requirement's `user` is the answer's user when it has one, else the declaration's.
- Compiling keeps constructors (edge lefts) by identity unless they contain a ref.
- Payments are record-less: the payment provider's metadata carries amount, unit and payee, and settlement mints the grant.

## Functionality to re-implement

- organize: the model sees the target's outline (through the read handle).
- payments/points: pay whoever answered the task when no `@user` is named; show the pending payment page link and failure reason in the UI.
- mail: the body includes the task's rows.
- market: the market peer joins the task.
- search: hits are filtered against existing rows.
- MCP: provider pinning on failure, a needs-recovery journal, an explicit handler ref, per-tool disabling, and provider choice by scope membership.
- Evaluator: a thrown native leads to needs-recovery and a manual rollback task.
- The `solve` native; the device-side verify half (node exchange carrying the requirement's `@user`).
- Web UI: allocation pickers, drag-to-supply, Pick time, and manual money and location fallbacks.
