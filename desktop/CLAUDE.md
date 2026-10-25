# Desktop CLAUDE.md

## Directory Summary
The Tauri desktop and mobile application for Fosforescent. It wraps the `web/` frontend and adds native capabilities (file system access, directory navigation, browser-based sign-in). Mobile release: `docs/mobile-release.md`.

## One binary, two modes
`fos` is the Tauri GUI *and* a Rust CLI/REPL over the same context directory and `.fos/` state (design: `docs/sync.md`, "The `fos` binary"):

```
fos                 GUI for your account      (context ~, state ~/.fos)
fos <dir>           GUI for a project         (nearest fos.config.toml, else a new store there; state <dir>/.fos)
fos [dir] run       sync, print the tree, serve local agents (MCP) and change events
fos [dir] repl      interactive shell
fos [dir] ls | add "…" | done <id> | open <id> | status | sync | approve <id> | reject <id> | attach <token> | detach | init | reset
fos login           home context: browser sign-in (SSO-capable device flow) | --token <connect token> | --password
fos . library export --out .fos/library.json  export the library this store sees, for builds
fos . ls <id> | node <id> --out node.json | node <id> --write node.json  navigate and edit graph rows
fos [dir] peers     the .fos stores on this machine this one is linked with; `peers ls <name>` reads one's tree
```

### Files (`src-tauri/src/`)
- `main.rs` - entry: resolves the context and dispatches to the GUI or the CLI
- `core.rs` - host for the embedded sync core; Rust never reimplements merge/sync semantics
- `project.rs` - context resolution and `.fos/` files; `[server]` and `[peers.<name>]` policy tables pass through to the web app untouched
- `workspace.rs` - an open replica for the current branch and session. Every store is a device root that ships the standard library; only the home context's has Home.
- `stores.rs` - the `.fos` stores on this machine a store links with
- `client.rs` - account HTTP client
- `local_server.rs` - local MCP, status and events server
- `commands.rs` - CLI commands and the REPL
- `lib.rs` - Tauri commands for the GUI: exactly the set the web app invokes. The home context must not list `~`.
- `files.rs` - files addressed relative to a linked root; must refuse `..`, paths outside the root, symbolic links, `.fos` and `.git`
- `node_agent.rs` - authenticated loopback MCP relay for agents (desktop targets only)
- `agents.rs` - local agent launches; may open only `vscode://anthropic.claude-code/open?` and `claude://claude.ai/new?` links
- `claude_desktop.rs` - edits one `fos-…` entry in Claude Desktop's `claude_desktop_config.json`, the only file it may touch, keeping other entries and a `.bak` of the old file

### Rules
- The web app talks to the shell only through `tauriInvoke`.
- No shell/fs/dialog/deep-link plugins: file access goes through the app's own commands. Capabilities stay limited to `core:default` and `opener:default`.
- OAuth integration sign-ins open in the system browser (Google refuses embedded webviews, and navigating the app's own webview away would lose the app); the app re-reads the connection when it regains focus.
- The CLI signs in with the device flow (`fos login`), approved from the signed-in web app.
- The installed app and the dev app must run side by side without sharing WebView storage, device identity or replicas.
- iOS icons must have no alpha channel (App Store Connect rejects RGBA icons).

## Requirements

- **Rust 1.80+**: Stable Rust toolchain
- **Node.js 22+**: For the web app and the agent runtime
- **System Dependencies (Linux)**:
  ```bash
  sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev
  ```

## Development Commands

```bash
# From desktop directory:
npm run dev          # Start Tauri in development mode
npm run build        # Build production release

# Build the embedded sync core (gitignored; `tauri dev`/`tauri build` run this first, `cargo` alone does not):
npm run build:core

# Update Rust if needed:
rustup update stable
```

- `cargo build` (binary at `target/debug/fos`), `cargo test --bin fos`.
- After changing `shared/sync`, rebuild the core bundle with `cd desktop && npm run build:core` (`web/node_modules/.bin/esbuild` also works when the root workspace is not installed).
- `make desktop-install` builds the release bundle and installs it on this computer; `make tauri-dev` runs the separate dev app (state in `~/.fos-dev/.fos`).
- `fos run` takes `--port` when two CLIs serve at once.
- Browser sign-in for the CLI needs the backend's `WEB_URL` to point at the web app.
- Release builds for macOS/Windows/Linux: `.github/workflows/desktop-release.yml` (tag `v*`). Mobile: `.github/workflows/mobile-android.yml` and `mobile-ios.yml`; procedure and secrets in `docs/mobile-release.md`.
- `node scripts/desktop-install.cjs --path-only` repairs PATH for an existing Windows installation; new terminals inherit the change.

## Environment Variables

- `FOS_TARGET_DIR` - The directory to open (set by CLI launcher)
- `FOS_SERVER`, `FOS_HOME_CONTEXT` - account server and home mode (set by main.rs)
- `FOS_API_URL` - overrides the account server

## TODOs
- [ ] File-backed `ReplicaStorage` adapter writing the replica into `.fos/`
- [ ] File watching for .fos changes
- [ ] Proper CSP for production builds
- [ ] Replace upscaled `src-tauri/app-icon.png` with real 1024×1024 artwork
- [ ] Auto-update functionality
- [ ] Window state persistence
- [ ] Tray icon support
