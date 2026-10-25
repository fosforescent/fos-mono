# Desktop coding agents

Coding agents on this computer (Claude Code, Codex, Claude Desktop) should appear as *local peers* of the device; their Read / Write / Execute toggles and the node's child and field masks apply like any peer's.

## Launching on a node

The CLI must use its own login and approval prompts; no model SDK is loaded and no account credentials are copied into Fos. Install the CLI separately, sign in with its normal flow, and make sure it is on the desktop app's PATH.

The agent should act with the grants toggled on its panel *at each request*. Switching every grant off, changing the data session, or **Stop sessions** ends the connection.

After **Connect to Claude Desktop…**, restart Claude Desktop to load the entry; **Remove from Claude Desktop** deletes the entry and revokes the credential.

Requirements: Node.js **20 or later** on the desktop process's PATH, and Git for repository features.

Validation:

```
cd desktop/agent-runtime
npm test
```

No model API calls should be made by these tests.

## Feature verification and local Git peers

Commit or stash changes before branch operations. Local peers should not manufacture hosted pull requests; those remain a hosted repository capability.

Specification files under `.fos/specifications/` must be committed with the implementation. Other `.fos` state, including credentials and local replicas, must remain ignored. Concurrent graph/disk changes require an explicit choice; no copy is silently overwritten. Removing a specification with non-specification child rows requires moving those children first.

A detected merge should create one **Verify specifications after merge** task per commit, never an automatic agent run. The checkout must be committed and clean before verification. Configured browser/MCP tools stay under that agent's control; unavailable tools should produce `blocked` results.

Paste the agent's JSON report into the verification dialog to record results. Reports must cover every specification and still match the commit and specification snapshot. Failed and blocked checks should create issue task rows with evidence. These are recorded agent reports, not an independent certification that the application is correct.
