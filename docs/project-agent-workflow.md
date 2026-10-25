# Phone to desktop project workflow

The workflow's graph definitions, defaults, prompts and verification requirement belong in the standard library; setup instantiates those definitions and must not synthesize their task structure in UI code.

1. Run `fos .` in the project directory to open the desktop app and sign in to your Fos account. Keep the app open while the workflow is enabled.
2. Connect GitHub using the account's integration controls, connect the project node to `owner/repository`, and refresh its branches and PRs.
3. On that node, choose **Configure agent workflow**. Set the local repository directory, coding agent, main branch, deployment URL, GitHub deployment environment, and verification agent, then **Save and enable on this computer**. Changing the configuration requires enabling it again on the target computer.
4. On the phone, sign in to the same Fos account, open the project node, create a project branch, edit its notes/tasks, and choose **Request coding agent**.
5. Review and merge with **Approve and merge on GitHub** on the project node, including from the phone.

Customize prompts by editing the instantiated workflow's `coding-instructions` and `verification-instructions` text bindings (text substitution such as `{{repository}}` and `{{deployment-url}}`). Edits to the library affect future instances; existing instances keep their pinned template version.

## Rules

- The desktop must claim requests durably and run each in an isolated worktree; the desktop checkout and displayed graph branch are preserved.
- The agent sees current notes/tasks through MCP bound to the requested branch.
- The agent tests, commits, pushes the project branch and opens a PR; it must not merge.
- Open PRs are ordinary Fos branch merge requests. A merged PR causes a Fos branch merge exactly once, even across refresh/restart.
- Verification is triggered only by a Fos branch merge into the destination branch (including a local merge without GitHub). Ordinary note edits, merges into other branches and dispatch bookkeeping must not trigger it.
- Verification waits until GitHub reports a successful deployment of the current main commit to the configured environment. An HTTP 200 response alone is insufficient.
- Dispatch status is not task completion. An interrupted dispatch is never relaunched automatically; **Retry after review** creates a new request and worktree. Worktrees are retained for recovery, not deleted automatically.
- **Pause workflow** stops new dispatches; it does not kill an already running agent.
- Opening a prefilled Claude Desktop chat is not an executed test or a passing verification.
- Configuration and requests use ordinary task/template/requirement rows and named mutable refs: no new domain row type, and no code/verify job-kind switch. The server's node-load hook knows nothing about coding or verification templates.

## Runtime setup

Install Node.js 20+, Git, and the selected agent CLI on the desktop PATH. Sign in to the agent separately from Fos. The local Git installation must be able to fetch and push the configured repository, and the coding agent needs a way to open PRs (for example an authenticated GitHub CLI). Fos's GitHub OAuth connection does not install Git credentials into the local Git client.

The deployment pipeline must publish GitHub Deployment records and successful Deployment Status records for the configured environment and exact main SHA. Publishing only Actions check results does not satisfy this gate.

For **Claude Code with Chrome**, install and sign in to the Claude in Chrome extension and authorize its site access. See [Anthropic's Chrome integration instructions](https://code.claude.com/docs/en/chrome).

For **Claude Desktop**, send the prefilled prompt and enable the Chrome connector in that conversation. See [Claude Desktop Chrome setup](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome).

Update the account backend and clients together.
