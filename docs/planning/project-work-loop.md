# Trying the project planning loop

1. Create a project task and put its brief, constraints and agreed decisions in
   note rows underneath. Create a milestone and a narrowly scoped task below it.
2. In that task's row menu, choose **Use Implement and verify template**. Replace
   the specification and acceptance-example instructions with concrete content.
3. Add required inputs using the Alt-drag reference action.
4. Confirm the readiness requirement inside the LLM request after preparing its
   inputs. Open **Context & results** to inspect the exact system instructions
   and task context, then **Run with this context**.
5. Review the proposed answer and choose **Accept result** or **Reject**. Check
   off the parent task manually after its actual acceptance criteria have been
   met.
6. Reference the accepted request from the next task to make the accepted plan
   available there. Expand that task only as far as needed to make its next piece
   of work executable.

## Rules

- A reference to another LLM requirement should block delegation until that
  result is accepted; a reference to a task should block until the task is
  checked off.
- Context should include ancestor note/plain rows, local task rows and explicit
  inputs, and exclude unrelated sibling tasks.
- Each attempt should pin its prompt, system instructions and source versions
  using ordinary refs. Editing the visible snapshot note must not rewrite the
  pinned prompt.
- Changed previews must be refreshed before dispatch. A changed task-context text
  or unresolved input must prevent accepting an old result.
- Oversized context must be rejected, never silently truncated.
- Rejected proposals and attempts without a response should remain visible.
- Use typed mutable refs and the proposal mechanism; no separate job database or
  completion-state enum.
- Acceptance supplies the requirement; it must not equate a model answer with
  completed work.
