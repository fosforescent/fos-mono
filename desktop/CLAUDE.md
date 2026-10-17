# Desktop CLAUDE.md

## Directory Summary
The desktop directory contains the Tauri-based desktop and mobile application for Fosforescent. It wraps the `web/` vanilla-TS frontend and adds native capabilities including file system access, directory navigation, and browser-based authentication. Mobile (iOS/Android) builds run in CI — see `docs/mobile-release.md`.

## Key Components

### Tauri Configuration
- `src-tauri/tauri.conf.json` - Main Tauri configuration
- `src-tauri/Cargo.toml` - Rust dependencies
- `src-tauri/capabilities/default.json` - Permission capabilities

### One binary, two modes (`src-tauri/src/`)
`fos` is the Tauri GUI *and* a Rust CLI/REPL over the same context directory and `.fos/` state (design: `docs/sync.md`, "The `fos` binary"):

```
fos                 GUI for your account      (context ~, state ~/.fos)
fos <dir>           GUI for a project         (nearest fos.config.toml, state <dir>/.fos)
fos [dir] run       sync, print the tree, serve local devices/agents (peer-sync, MCP, WebRTC relay, events)
fos [dir] repl      interactive shell
fos [dir] ls | add "…" | done <id> | open <id> | status | sync | approve <id> | reject <id> | attach <token> | detach | init | reset
fos login           home context: browser sign-in (SSO-capable device flow) | --token <connect token> | --password
```

- `main.rs` - clap entry: resolves the context (`fos <dir>` or `~`), dispatches to the GUI (`app_lib::run()` with `FOS_TARGET_DIR`, `FOS_DIR`, `FOS_SERVER`, `FOS_HOME_CONTEXT`) or the CLI
- `core.rs` - QuickJS (`rquickjs`, `parallel` feature) host for the embedded sync core `js/fos-core.js` (built from `shared/sync/embed.ts` + `js/prelude.js` shims); Rust never reimplements merge/sync semantics, it passes JSON strings through `fosCore.*`
- `project.rs` - context resolution: `fos.config.toml` discovery (walk up), `[attach]`/`[serve]` config (`toml`; `[server] to/from` and `[peers.<name>]` policy tables pass through to the web app untouched, see `docs/sync.md` "Peer policies"), git branch from `.git/HEAD`, `.fos/` files (`device.json`, `session.json`, `replicas/<branch>.json`, `.gitignore`), home mode = `~/.fos` (optional `~/.fos/config.toml` for the server; `FOS_API_URL` overrides)
- `workspace.rs` - an open replica for the current branch + session; edits, `sync()` (first sync asks the account where the device attaches), branch switching, `status()`
- `client.rs` - account HTTP (`ureq`): login, connect-token attach with approval polling, device login (`/auth/device/start|poll`), attachment, peer-sync, proposal decisions, detach
- `local_server.rs` - `tiny_http` server: `/peer-sync` (served from the directory's replica), `/mcp` (the shared `fos_*` MCP vocabulary through the core's `mcp` entry point, as the directory's owner), `/p2p/offer|answer` relay, `/status`, `/events?since=` long-poll
- `commands.rs` - CLI commands and the `rustyline` REPL (`ls add done open rm mv cd sync status approve reject attach login branches`)
- `lib.rs` - Tauri commands for the GUI, exactly the set the web app invokes: `find_project` gives the web app the context (`web/src/project.ts`): the nearest config, or in home mode a synthesized `[attach] server/name` so the GUI also stores state in `~/.fos`; `read_project_file`/`write_project_file` for `.fos/` files; `link_node_directory`/`list_node_directory`/`read_node_file` for linked directory peers (`web/src/filesystem.ts`); plus the `node_agent::*` and `agents::*` commands
- `node_agent.rs` - authenticated loopback MCP relay for "Connect to agent" (`web/src/node-agent.ts`)
- `agents.rs` - spawns `../agent-runtime` (Claude Agent SDK / Codex SDK runs, CLI launches, local git) and validates repositories

Build/test: `cargo build` (binary at `target/debug/fos`), `cargo test --bin fos`. Release builds for macOS/Windows/Linux: `.github/workflows/desktop-release.yml` (tag `v*` → GitHub Release, unsigned; see `docs/mobile-release.md`, Desktop). After changing `shared/sync`, rebuild the core bundle with `cd desktop && npm run build:core` (esbuild; `web/node_modules/.bin/esbuild` also works when the root workspace is not installed). Browser sign-in for the CLI needs the backend's `WEB_URL` to point at the web app.

### Web integration
The web app talks to the shell only through `tauriInvoke` in `web/src/project.ts`, `filesystem.ts`, `node-agent.ts`, `agents.ts` and `local-git.ts`.

## Dependencies

### Rust Dependencies
- **tauri 2.9.5** - Core Tauri framework
- **tauri-plugin-log** - Logging (dev only)
- **tauri-plugin-opener** (`~2.4`, the newest that keeps tauri 2.9.5 locked; `opener:default` in `capabilities/default.json`) - opens URLs in the system browser. The web app calls it through `openExternal` (`web/src/project.ts`, `plugin:opener|open_url`) for the OAuth integration peers (GitHub/Google/Discord): Google refuses sign-ins from embedded webviews (`disallowed_useragent`), and navigating the app's own webview away would lose the app. The provider's callback lands on the web site; the app checks the connection when it regains focus (`App.checkPendingIntegration`).
- No shell/fs/dialog/deep-link plugins: file access goes through the app's own commands (`lib.rs`)
- **rquickjs** - embedded JS engine for the sync core
- **ureq / tiny_http / toml / clap / rustyline** - account client, local server, config, CLI, REPL
- **dirs** - Home directory detection
- **open** - Browser opening
- **tokio** - Async runtime

### npm Dependencies
- **@tauri-apps/api** - Tauri JavaScript API
- **@tauri-apps/cli** - Tauri CLI tools

## Requirements

- **Rust 1.80+**: Stable Rust toolchain
- **Node.js 22+**: For the web app and the agent runtime
- **System Dependencies (Linux)**:
  ```bash
  sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev
  ```

## CLI Commands

The `fos` CLI is the primary way to launch the desktop app:

```bash
fos .             # Launch GUI in current directory
fos ~/project     # Launch GUI in specific directory
fos init          # Write fos.config.toml in the current folder
fos repl          # Start interactive REPL
fos help          # Show help
```

## Development Commands

```bash
# From desktop directory:
npm run dev          # Start Tauri in development mode
npm run build        # Build production release

# Rebuild the embedded sync core after changing shared/sync:
npm run build:core

# Update Rust if needed:
rustup update stable
```

## Environment Variables

The Tauri app reads these environment variables on startup:

- `FOS_TARGET_DIR` - The directory to open (set by CLI launcher)
- `FOS_SERVER`, `FOS_HOME_CONTEXT` - account server and home mode (set by main.rs)

## Data Inputs/Outputs

### Input Sources
- `fos.config.toml` and `.fos/` project state
- Linked directories (read-only listings and previews)
- Agent runtime events (NDJSON from `agent-runtime`)

### Output Destinations
- Web app via IPC (invoke results)
- System browser (OAuth sign-ins through `tauri-plugin-opener`)
- `.fos/` project state files

## Sign-in

The web app signs in with the account directly; OAuth integration sign-ins open in the system browser and the app re-reads the connection when it regains focus. The CLI uses the device flow (`fos login`, `/auth/device/start|poll`), approved from the signed-in web app.

## Build Configuration

### Development
- Uses `npm run dev:web` (runs the `web/` Vite dev server)
- Connects to Vite dev server at `http://localhost:5173`

### Production
- Builds the web app via `npm run build:web`
- Bundles it from `../../web/dist`
- Creates native installers for all desktop platforms

### Mobile (iOS/Android)
- Built in GitHub Actions (`.github/workflows/mobile-android.yml` and `mobile-ios.yml`); `gen/android` and `gen/apple` are initialized fresh in CI
- Android release signing is injected post-init by `.github/scripts/patch-android-signing.sh`
- iOS uses Xcode automatic cloud signing via App Store Connect API key
- App icon source: `src-tauri/app-icon.png` (1024px) — CI runs `npx tauri icon` after init
- Full release procedure and required secrets: `docs/mobile-release.md`

## Security

- CSP is currently disabled (`null`) for development
- Only `core:default` and `opener:default` capabilities; no fs/shell/deep-link plugins

## Current Implementation Status

### ✅ Completed
- **Project state**: `.fos/` shared by the GUI, CLI and REPL (`device.json`, `session.json`, `replicas/<branch>.json`)
- **CLI launcher**: `fos .` launches the GUI, `fos init` writes `fos.config.toml`, `fos repl` for the terminal
- **Agents**: SDK runs and CLI launches through `agent-runtime`, node-scoped loopback MCP

### ✅ Completed (continued)
- **Online/offline transition**: the `web/` UI keeps a replica in webview localStorage, works offline, and merges with the account on login via `shared/sync` (three-way merge on the FosStore graph, CHOICE nodes for divergences, optional attachment to a single partition). See `docs/sync.md`.

### ❌ Not Started
- File watching for .fos changes
- Proper CSP for production builds
- Custom app icons for all platforms
- Auto-update functionality
- Window state persistence
- Tray icon support

## TODOs
- [x] Add merge conflict resolution when transitioning offline→online (`shared/sync`, Choice nodes)
- [ ] File-backed `ReplicaStorage` adapter writing the replica into `.fos/` (currently localStorage on all platforms)
- [ ] Add file watching for .fos changes
- [ ] Add proper CSP for production builds
- [ ] Replace upscaled `src-tauri/app-icon.png` with real 1024×1024 artwork
- [ ] Add auto-update functionality
- [ ] Implement window state persistence
- [ ] Add tray icon support
