# Desktop coding agents

Claude Code and Codex appear as *local peers* of the device when their CLI is on this computer's PATH (`agent_clis`, checked at startup; a filesystem query, never a graph row), and Claude Desktop does when it is set up (its config directory exists). They nest under the **This device** tab of the constructor panel; their Read / Write / Execute toggles and the node's child and field masks apply like any peer's.

## Launching on a node

The launch is a button on the agent's own panel. **Launch Claude Code on this task** (or Codex) opens the installed CLI in a new, visible terminal (PowerShell on Windows, Terminal on macOS, `x-terminal-emulator` elsewhere) with the node's text as its prompt. The CLI uses its own login and approval prompts; no model SDK is loaded and no account credentials are copied into Fos. Install the CLI separately, sign in with its normal flow, and make sure it is on the desktop app's PATH.

The terminal is connected to an authenticated loopback MCP endpoint for that node (`startPeerMcp` in `web/src/node-agent.ts`, relayed by `node_agent.rs`). It acts as the agent peer (`agent-cli:<provider>`) with the grants toggled on its panel *at each request*: read for notes and rows (`fos_read`, `fos_search`), write to propose results (`fos_propose`, reviewed like any proposal), execute to see the outstanding work (`fos_outstanding`: open tasks and unmet requirements in the node, its own first) and evaluate. Switching every grant off, changing the data session, or **Stop sessions** ends the connection. The terminal opens in the node's local checkout when one is attached, otherwise in a scratch directory under the app cache.

**Open in VS Code** (Claude Code, when `code` is on PATH and VS Code has the `anthropic.claude-code` extension) opens a Claude Code tab with the prompt prefilled, not sent (`vscode://anthropic.claude-code/open?prompt=`, see [the extension docs](https://code.claude.com/docs/en/vs-code)). That tab cannot be handed an MCP connection, so the prompt inlines an outline of the node's rows. The Codex extension has no documented prompt link, so Codex launches in a terminal only.

**Open in Claude Desktop** starts a new chat with the prompt prefilled, not sent (`claude://claude.ai/new?q=`, [Claude Desktop deep links](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link)); if the link fails the prompt goes to the clipboard. **Connect to Claude Desktop…** (signed in, a grant on) creates a hosted credential for the Claude Desktop peer, previews the change and on confirmation adds one entry to `claude_desktop_config.json` (`claude_desktop.rs`). Claude Desktop's config file only starts local (stdio) servers, so the entry runs `npx -y mcp-remote <hosted url> --header Authorization:${FOS_AUTH_HEADER}` with the bearer credential in its `env`; other entries are kept and the previous file is saved as `.bak`. Restart Claude Desktop to load it; **Remove from Claude Desktop** deletes the entry and revokes the credential.

Requirements: Node.js **20 or later** on the desktop process's PATH (the runtime and `mcp-remote` run on it), and Git for repository features.

Validation:

```
cd desktop/agent-runtime
npm test
```

The HTTP MCP test binds an ephemeral localhost port. Web `tests/agent-peers.cjs` checks discovery, the panel launch, the grants the endpoint dispatches with and the app links. No model API calls are made by these tests.

## Feature verification and local Git peers

Feature verification launches the CLI the same way but with a temporary, authenticated, read-only MCP snapshot of the selected subtree (`context.mjs`, limited to 5,000 nodes / 64 levels / 2 MB) instead of the node's MCP. The optional Claude Chrome checkbox uses the installed CLI's Chrome integration; it does not install or authorize the browser extension.

Attaching a checkout (or its `.git` path) adds a device-local **Local Git** peer with the `repo` capability. Its controls list, create, switch, and merge local branches. Commit or stash changes before branch operations. Local peers do not manufacture hosted pull requests; those remain a hosted repository capability.

Add **Feature specification** from the existing constructor icon menu. Specifications are ordinary nested note rows with stable IDs. The local Git peer projects their text and parent IDs into `.fos/specifications/<id>.json`, which must be committed with the implementation. Other `.fos` state, including credentials and local replicas, remains ignored. Git merges specification files alongside code and reports normal conflicts when the same file diverges. Concurrent graph/disk changes require an explicit choice; no copy is silently overwritten. Removing a specification with non-specification child rows requires moving those children first.

While the linked repository is open, the peer watches for merges; it also remembers the last observed commit locally to detect intervening merges on reopening. A detected merge creates one **Verify specifications after merge** task per commit, never an automatic agent run. The existing constructor menu includes **Verify specifications**. Selecting **Verify with Claude Code** or **Verify with Codex** immediately launches the verification CLI; there is no second Start step. The repository controls offer the same action, which prepares a prompt for Claude Code, Codex, or an external agent such as Claude Desktop. The checkout must be committed and clean. Configured browser/MCP tools stay under that agent's control; unavailable tools should produce `blocked` results.

Paste the agent's JSON report into the verification dialog to record results. Reports must cover every specification and still match the commit and specification snapshot. Failed and blocked checks create issue task rows with evidence. These are recorded agent reports, not an independent certification that the application is correct. Fos does not automate the Claude Desktop UI beyond opening a prefilled chat.
