# Desktop coding agents

In the desktop node constructor menu, select **Repository → Filesystem Git repository**, and supply an existing checkout path. The native bridge validates it with Git and records the canonical working-tree root as an ordinary named `repo` argument on a filesystem peer row. The binding applies to descendants on the same device. A GitHub repository node also offers **Attach local checkout**; it retains its GitHub arguments.

Open a task under that repository, select **Actions**, and choose **Run Claude** or **Run Codex**. Enter the task prompt and press Start. Each run uses the current Git checkout; choosing a Fos branch does not check out a Git branch. Review and commit the resulting files using Git.

Requirements:

- Node.js **20 or later** and Git on the desktop process's PATH.
- Codex: native Codex sign-in (`codex login`) or `OPENAI_API_KEY` in the native environment.
- Claude: `ANTHROPIC_API_KEY`, or the SDK's Bedrock/Vertex environment configuration. This integration does not offer consumer Claude sign-in.
- Run **Check agent integrations** after changing configuration. The check reports missing SDK installations and credentials separately; it does not make a model request or validate credentials with the provider. Relaunch the desktop app if its environment changed. Keys are never stored in Fos nodes or sent to the webview.

`npm run prepare:agents` in `desktop` installs the pinned SDK dependencies. Desktop dev/build hooks run it automatically; release resources include the runtime and dependencies. Native SDK binaries are platform-specific: build on the target OS/architecture. A universal Tauri wrapper does not make the bundled SDK binaries universal. Mobile and browser clients cannot run these local processes.

Claude Code and Codex appear as *local peers* of the device when their CLI is on this computer's PATH (`agent_clis`, checked at startup; a filesystem query, never a graph row). They nest under the **This device** tab of the constructor panel, read-only, and the node's child and field masks apply to them like any peer. Native SDK availability, plus an inherited local repository argument, decides whether a **Run …** action joins the **Open … CLI** action in that peer's constructors.

Each launch creates a private loopback HTTP MCP endpoint with a random bearer token. It exposes `fos_read` and `fos_search` over a **read-only snapshot** of the spawning node's active subtree, with paths relative to that node. Linked values, peer constructors, sibling tasks, and inactive alternatives are excluded. It does not expose the account or the filesystem through MCP. Built-in SDK tools separately operate on the checkout. The snapshot is limited to 5,000 nodes / 64 levels / 2 MB; launch from a narrower task if needed.

Claude tool approval requests appear in the launch dialog with Allow/Deny controls. Project permission settings are not loaded. Codex runs with workspace-write sandboxing, network disabled, and approval policy `never`: actions that require escalation fail instead of bypassing sandboxing. Neither provider is configured to bypass permissions. Cancel aborts the SDK; changing the active data session also cancels the run. Output stays in the dialog, not in synced nodes. This version does not mutate Fos tasks over MCP or automatically mark tasks complete.

Validation:

```
cd desktop/agent-runtime
npm test
```

The HTTP MCP test binds an ephemeral localhost port. Web `tests/agents.cjs` checks inherited repository bindings, device isolation, and subtree snapshots. No model API calls are made by these tests.

SDK references: [Codex](https://developers.openai.com/codex/sdk/), [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk).

## Interactive CLI agents and local Git peers

The **Open Claude Code CLI** and **Open Codex CLI** constructor actions (on the agent peer) launch the installed command in a visible terminal. These launch modes use the CLI's own login and approval prompts; they do not use either model SDK or copy account credentials into Fos. Install the CLI separately, sign in using its normal flow, and ensure it is on the desktop app's PATH. A directory can be chosen without attaching a Git repository. The terminal gets a temporary, authenticated, read-only Fos MCP snapshot of the selected subtree. CLI filesystem tools separately operate in the chosen directory. Close/cancel the run to revoke that MCP endpoint. The optional Claude Chrome checkbox uses the installed CLI's Chrome integration; it does not install or authorize the browser extension.

Attaching a checkout (or its `.git` path) adds a device-local **Local Git** peer with the `repo` capability. Its controls list, create, switch, and merge local branches. Commit or stash changes before branch operations. Local peers do not manufacture hosted pull requests; those remain a hosted repository capability.

Add **Feature specification** from the existing constructor icon menu. Specifications are ordinary nested note rows with stable IDs. The local Git peer projects their text and parent IDs into `.fos/specifications/<id>.json`, which must be committed with the implementation. Other `.fos` state, including credentials and local replicas, remains ignored. Git merges specification files alongside code and reports normal conflicts when the same file diverges. Concurrent graph/disk changes require an explicit choice; no copy is silently overwritten. Removing a specification with non-specification child rows requires moving those children first.

While the linked repository is open, the peer watches for merges; it also remembers the last observed commit locally to detect intervening merges on reopening. A detected merge creates one **Verify specifications after merge** task per commit, never an automatic agent run. The existing constructor menu includes **Verify specifications**. Selecting **Verify with Claude Code** or **Verify with Codex** immediately launches the verification CLI; there is no second Start step. The repository controls offer the same action, which prepares a prompt for Claude Code, Codex, or an external agent such as Claude Desktop. The checkout must be committed and clean. Configured browser/MCP tools stay under that agent's control; unavailable tools should produce `blocked` results.

Paste the agent's JSON report into the verification dialog to record results. Reports must cover every specification and still match the commit and specification snapshot. Failed and blocked checks create issue task rows with evidence. These are recorded agent reports, not an independent certification that the application is correct. An external agent must be launched manually; Fos does not automate the Claude Desktop UI.
