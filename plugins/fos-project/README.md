# Work on a Fos project with an agent

Keep the desktop app open, attached and synced to your project node. Write feature
specifications, UI behavior and acceptance criteria in its nested rows. Use Fos
branches for alternative specifications. The agent reads the **server's latest
synced tree**; local unsynced edits and a git checkout do not automatically change
what a remote agent sees.

This package shares one navigation skill and one dependency-free Node 22 stdio
bridge across ChatGPT desktop/Codex, Gemini CLI, Claude Desktop and Claude Code.
The bridge calls the authenticated Fos backend at
`POST /user/data/peer-sync/mcp`. It does not start a second task store or take
control of the desktop application's current selection.

## Attach an agent

1. On the intended node in Fos, use its existing peer invitation action to create
   a connection token. This node becomes the agent's `[]` root.
2. With Node 22 installed, run from this package:

   ```sh
   node scripts/connect.mjs https://api.fosforescent.com
   ```

   Paste the short-lived invitation when prompted. Approve “Project coding agent”
   in Fos. The script stores a scoped peer token in
   `~/.config/fos/agent.json` (mode 0600 on Unix). It refuses to overwrite an
   existing connection. To attach another project, supply a different absolute
   filename as the second argument, and set `FOS_AGENT_CONNECTION` to that file
   for the agent client. Reconnect with a fresh invitation when the token expires.
3. Install the appropriate client package and invoke `work-on-fos-project`:
   “Read my attached task tree and implement the UI task under this branch.”

Use the setup helper, not the desktop's `.fos/session.json`: that session may
have full account access. Keep connection files out of source control and plugin
archives. Removing the agent member from the attachment revokes MCP reads and
proposals immediately. Disable `edit` to leave it read-only.

## Install by client

After the release workflow has published the `agent-plugins` branch:

- **ChatGPT desktop / Codex:** register the repository marketplace:
  `codex plugin marketplace add fosforescent/fos-mono --ref agent-plugins`.
  Install `fos-project` from the resulting `fosforescent` marketplace in your
  client's plugin UI. Alternatively load the released portable plugin ZIP in a
  supported local plugin workflow. Its `mcp.json` launches the shared bridge.
- **Claude Code:** `/plugin marketplace add fosforescent/fos-mono#agent-plugins`,
  then `/plugin install fos-project@fosforescent`. The package's `.mcp.json` and
  `skills/` are discovered together. Enable automatic updates for this marketplace
  if desired. For development, `claude --plugin-dir /absolute/path/to/plugins/fos-project`.
- **Gemini CLI:**
  `gemini extensions install https://github.com/fosforescent/fos-mono --ref agent-plugins --auto-update`.
  Enter the absolute connection JSON path when prompted. Gemini loads the same
  skill from `skills/`. This targets Gemini CLI, not a Gemini web app marketplace.
- **Claude Desktop:** install the release's `.mcpb` extension, selecting the
  connection JSON file. The bundle supplies MCP tools; upload the included
  `skills/work-on-fos-project` as a skill separately if your Claude surface supports
  skills, or ask it to start with `fos_read` at `[]`.

Each client may namespace the tool names. Refresh/restart it after installing.
The desktop clients need the backend version containing this endpoint deployed
before connecting. These packages do not provide OAuth for ChatGPT/Claude web.

## Tools and branch behavior

- `fos_read`: text, ancestors inside the attachment, children, branch names,
  conflict markers, own proposals and available actions. Page children using
  `nextOffset`. Paths are arrays of stable row IDs, never titles or global CIDs.
- `fos_search`: text search through active descendants, cycle detection and a
  5,000-node budget. Follow `nextOffset`; `truncated` indicates remaining work.
- `fos_propose`: `add_task`, `add_note`, `rename`, `complete` changes submitted as
  **one ordinary proposal on the attached mutable reference**. Requires `edit`.
  Existing selected content remains unchanged until the proposal is approved by
  the owner. Requests carry the root `revision` as `expected`. A duplicate proposal
  name is refused rather than overwriting an earlier/rejected proposal.

Every call can carry branch selections such as
`{"branches":[{"path":["feature-id"],"name":"alternative"}]}`. Selections are
request-local and must address nodes inside the attachment. Pass them again on
later calls. They do not switch the desktop or repository checkout. Proposal
contents can be reviewed/copied in Fos; this version does not expose a proposed
branch as an editable agent workspace.

The server also supports `fos_create_branch`, `fos_decide` and `fos_invite` for an
owner credential with an explicit URL `scope` JSON array; these are deliberately
absent from the scoped peer packages. `fos_evaluate` is available to every
credential: an owner's host runs its handler registry (version checks, active
integration checks, the effect journal); anyone else leaves an evaluation request
the owner's rules decide on. An agent's `edit` grant never implies permission to spend money,
run arbitrary handlers, or execute owner integrations. Uncertain effects require
review; the bridge never retries writes automatically.

## Releases and public directories

`.github/workflows/agent-plugins.yml` tests transport, scopes and proposals on PRs.
Changes to `plugins/**` on `main` produce a versioned ZIP, MCPB, tarball and
SHA256SUMS, then update the `agent-plugins` distribution branch. Every client
manifest receives the same `0.1.<workflow-run-number>` version. The generated
branch is an installable Gemini extension and a Claude/Codex repository
marketplace. It contains only allowlisted package files, not the monorepo or
credentials. GitHub release tags use `agent-plugins-v*`, separate from native
application releases. No external publishing secret is required for this path.

Public directory placement is a separate owner-operated submission:

- [OpenAI packaging](https://developers.openai.com/plugins/build/plugins) supports
  a shared ChatGPT/Codex plugin package. [Submission](https://developers.openai.com/plugins/deploy/submission)
  requires identity/domain verification and review; its portal currently does
  not offer a bearer-token input. [Local MCP submissions](https://developers.openai.com/plugins/deploy/desktop-only)
  require approved-partner eligibility. For a broadly installable web plugin,
  add a durable OAuth authorization-code/PKCE flow that grants a chosen subtree,
  register the remote MCP connection and submit it. Do not publish an unauthenticated
  endpoint or put credentials into the manifest to bypass this step.
- [Claude marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) support
  repository distribution. Submit to Anthropic's official directory separately;
  the generated repository marketplace does not imply that approval. Claude
  Desktop uses the [MCPB bundle format](https://github.com/modelcontextprotocol/mcpb).
- [Gemini extension releases](https://geminicli.com/docs/extensions/releasing/)
  support repository/release distribution. Gallery inclusion and user opt-in to
  automatic updates are separate from producing releases.

No workflow pretends to automate a private/unavailable app-store submission API.
After a provider registers a listing, its documented update process can be added
without duplicating the task model or skill.

## Development checks

From the monorepo root:

```sh
npm test --prefix backend -- --runInBand sync/events.test.ts sync/provideNode.test.ts sync/evaluation.test.ts
node --test plugins/bridge.test.mjs
python3 plugins/build_test.py
python3 plugins/build.py --output /tmp/fos-agent-release
```

Use a fresh output directory for each build. Test with a disposable project node:
read nested specifications, inspect an alternate branch, submit a rename and note,
approve the proposal in Fos, then remove the peer and verify access is refused.
The endpoint uses stateless Streamable HTTP JSON responses: POST only,
notifications return 202, and unsupported GET/SSE sessions return 405. It uses
explicit bearer auth and rejects browser-origin requests. The legacy `/mcp`
workflow API is separate and does not supply this task-tree projection.
