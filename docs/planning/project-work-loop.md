# Trying the project planning loop

This slice uses the existing fos language-model endpoint to propose plans and
specifications. It does not run a coding agent, modify a repository, or open a PR
on behalf of a task.

1. Create a project task and put its brief, constraints and agreed decisions in
   note rows underneath. Create a milestone and a narrowly scoped task below it.
2. In that task's row menu, choose **Use Implement and verify template**. Replace
   the specification and acceptance-example instructions with concrete content.
   The template is an ordinary editable template at the replica root, installed
   on first use; subsequent tasks instantiate the same template.
3. Add required inputs using the existing Alt-drag reference action. A reference
   to another LLM requirement blocks delegation until that result is accepted;
   a reference to a task blocks until the task is checked off. References to
   missing or external-account rows are reported as unavailable in this slice.
4. Confirm the readiness requirement inside the LLM request after preparing its
   inputs. Open **Context & results** to inspect the exact system instructions
   and task context, then **Run with this context**.
5. Review the proposed answer. **Accept result** binds its return ref, adds the
   result note under the request and supplies the LLM requirement. **Reject**
   retains the proposal without fulfilling the request. The parent task is still
   checked off manually after its actual acceptance criteria have been met.
6. Reference the accepted request from the next task to make the accepted plan
   available there. Expand that task only as far as needed to make its next piece
   of work executable; the model's prose does not automatically create subtasks.

Existing `-llm` rows use the same preview/review flow without requiring the starter
template. Running needs an account and a configured fos model; preview is local.

## What the code records and enforces

Context includes ancestor note/plain rows, local task rows and explicit inputs.
Unrelated sibling tasks are excluded. Each attempt pins its prompt, system
instructions and source versions in the existing graph using ordinary refs.
Editing the visible snapshot note does not rewrite the pinned prompt.

Changed previews must be refreshed before dispatch. A changed task-context text
or unresolved input prevents accepting an old result. The 20,000-character input
limit rejects oversized context instead of silently truncating it. Rejected
proposals and attempts without a response remain visible after reload.

The handler and result use typed mutable refs and the existing proposal API.
There is no new job database or completion-state enum. Acceptance supplies the
existing requirement; it does not equate a model answer with completed work.

The browser initiates this synchronous model call. Closing the tab can lose an
in-flight response; there is no durable agent queue, automatic retry or
cross-peer continuation delivery. Session protocols and repository execution
remain later slices. Independent concurrent acceptances across devices still
rely on ordinary graph sync/conflict handling, not distributed execution locks.
