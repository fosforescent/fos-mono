# Desktop coding agents

In the desktop node constructor menu, select **Repository → Filesystem Git repository**, and supply an existing checkout path. The native bridge validates it with Git and records the canonical working-tree root as an ordinary named `repo` argument on a filesystem peer row. The binding applies to descendants on the same device. A GitHub repository node also offers **Attach local checkout**; it retains its GitHub arguments.

Open a task under that repository, select **Actions**, and choose **Run Claude** or **Run Codex**. Enter the task prompt and press Start. Each run uses the current Git checkout; choosing a Fos branch does not check out a Git branch. Review and commit the resulting files using Git.

Requirements:

- Node.js **20 or later** and Git on the desktop process's PATH.
- Codex: native Codex sign-in (`codex login`) or `OPENAI_API_KEY` in the native environment.
- Claude: `ANTHROPIC_API_KEY`, or the SDK's Bedrock/Vertex environment configuration. This integration does not offer consumer Claude sign-in.
- Run **Check agent integrations** after changing configuration. The check reports missing SDK installations and credentials separately; it does not make a model request or validate credentials with the provider. Relaunch the desktop app if its environment changed. Keys are never stored in Fos nodes or sent to the webview.

`npm run prepare:agents` in `desktop` installs the pinned SDK dependencies. Desktop dev/build hooks run it automatically; release resources include the runtime and dependencies. Native SDK binaries are platform-specific: build on the target OS/architecture. A universal Tauri wrapper does not make the bundled SDK binaries universal. Mobile and browser clients cannot run these local processes.

The integration picker also exposes Claude and Codex as ordinary peer constructors. Native SDK availability, plus an inherited local repository argument, determines which launch controls appear.

Each launch creates a private loopback HTTP MCP endpoint with a random bearer token. It exposes `fos_read` and `fos_search` over a **read-only snapshot** of the spawning node's active subtree, with paths relative to that node. Linked values, peer constructors, sibling tasks, and inactive alternatives are excluded. It does not expose the account or the filesystem through MCP. Built-in SDK tools separately operate on the checkout. The snapshot is limited to 5,000 nodes / 64 levels / 2 MB; launch from a narrower task if needed.

Claude tool approval requests appear in the launch dialog with Allow/Deny controls. Project permission settings are not loaded. Codex runs with workspace-write sandboxing, network disabled, and approval policy `never`: actions that require escalation fail instead of bypassing sandboxing. Neither provider is configured to bypass permissions. Cancel aborts the SDK; changing the active data session also cancels the run. Output stays in the dialog, not in synced nodes. This version does not mutate Fos tasks over MCP or automatically mark tasks complete.

Validation:

```
cd desktop/agent-runtime
npm test
```

The HTTP MCP test binds an ephemeral localhost port. Web `tests/agents.cjs` checks inherited repository bindings, device isolation, and subtree snapshots. No model API calls are made by these tests.

SDK references: [Codex](https://developers.openai.com/codex/sdk/), [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk).
