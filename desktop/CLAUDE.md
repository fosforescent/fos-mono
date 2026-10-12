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
- `project.rs` - context resolution: `fos.config.toml` discovery (walk up), `[attach]`/`[serve]` config (`toml`), git branch from `.git/HEAD`, `.fos/` files (`device.json`, `session.json`, `replicas/<branch>.json`, `.gitignore`), home mode = `~/.fos` (optional `~/.fos/config.toml` for the server; `FOS_API_URL` overrides)
- `workspace.rs` - an open replica for the current branch + session; edits, `sync()` (first sync asks the account where the device attaches), branch switching, `status()`
- `client.rs` - account HTTP (`ureq`): login, connect-token attach with approval polling, device login (`/auth/device/start|poll`), attachment, peer-sync, proposal decisions, detach
- `local_server.rs` - `tiny_http` server: `/peer-sync` (served from the directory's replica), `/mcp` (JSON-RPC tools: list/add/done/rename/delete/sync_now/status), `/p2p/offer|answer` relay, `/status`, `/events?since=` long-poll
- `commands.rs` - CLI commands and the `rustyline` REPL (`ls add done open rm mv cd sync status approve reject attach login branches`)
- `lib.rs` - Tauri commands for the GUI. `find_project` gives the web app the context (`web/src/project.ts`): the nearest config, or in home mode a synthesized `[attach] server/name` so the GUI also stores state in `~/.fos`; `read_project_file`/`write_project_file` for `.fos/` files; plus the older directory navigation, `.fos` directory, FosStore, auth and WebRTC peer commands (`peer.rs`)

Build/test: `cargo build` (binary at `target/debug/fos`), `cargo test --bin fos`. Release builds for macOS/Windows/Linux: `.github/workflows/desktop-release.yml` (tag `v*` → GitHub Release, unsigned; see `docs/mobile-release.md`, Desktop). After changing `shared/sync`, rebuild the core bundle: `cd desktop && ../node_modules/.bin/esbuild ../shared/sync/embed.ts --bundle --format=iife --platform=browser --target=es2020 --outfile=src-tauri/js/fos-core.js --inject:src-tauri/js/prelude.js`. Browser sign-in for the CLI needs the backend's `WEB_URL` to point at the web app.

### Frontend Integration (`frontend/tauri/`)
- `api.ts` - TypeScript bindings for Tauri commands
- `useTauri.ts` - React hook for Tauri functionality
- `auth.ts` - Browser-based authentication utilities
- `index.ts` - Re-exports all Tauri modules

## Dependencies

### Rust Dependencies
- **tauri 2.9.5** - Core Tauri framework
- **tauri-plugin-shell** - Shell/browser opening
- **tauri-plugin-fs** - File system operations
- **tauri-plugin-dialog** - File dialogs
- **tauri-plugin-log** - Logging (dev only)
- **tauri-plugin-deep-link** - URL scheme handling for auth callbacks
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
- **Node.js 18+**: For frontend development
- **System Dependencies (Linux)**:
  ```bash
  sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev
  ```

## CLI Commands

The `fos` CLI is the primary way to launch the desktop app:

```bash
fos .             # Launch GUI in current directory
fos ~/project     # Launch GUI in specific directory
fos init          # Initialize .fos directory in current folder
fos repl          # Start interactive REPL for graph navigation
fos help          # Show help
```

**Options:**
- `-d, --dir <path>` - Specify .fos directory location explicitly

## Development Commands

```bash
# From desktop directory:
npm run dev          # Start Tauri in development mode
npm run build        # Build production release

# From monorepo root:
cd desktop && npm run dev

# Build CLI:
cd cli && npm run build

# Update Rust if needed:
rustup update stable
```

## Environment Variables

The Tauri app reads these environment variables on startup:

- `FOS_TARGET_DIR` - The directory to open (set by CLI launcher)
- `FOS_DIR` - Path to the .fos directory (set by CLI launcher)

## Data Inputs/Outputs

### Input Sources
- Local file system (directory contents)
- .fos directory configuration
- Deep link URLs for authentication callbacks
- User interactions via Tauri commands

### Output Destinations
- Frontend via IPC (invoke results)
- System browser (authentication URLs)
- Local .fos directory (future: write operations)

## .fos Directory Detection

The desktop app automatically detects and loads .fos directories:

1. **Local Detection**: First checks current working directory for `.fos/`
2. **Fallback**: If not found locally, checks `~/.fos/`
3. **Returns Info**: `FosDirectoryInfo` includes path, existence, and fallback status

## Authentication Flow

1. Frontend calls `openAuthUrl(url)` via Tauri command
2. System browser opens to authentication URL
3. After auth, browser redirects to `fosforescent://auth/callback?code=...`
4. Deep link plugin catches URL and emits event
5. Frontend receives code via event listener
6. Frontend exchanges code for session token

## Build Configuration

### Development
- Uses `npm run dev:web` (runs the `web/` Vite dev server)
- Connects to Vite dev server at `http://localhost:5173`

### Production
- Builds the web frontend via `npm run build:web`
- Bundles frontend from `../../web/dist`
- Creates native installers for all desktop platforms

### Mobile (iOS/Android)
- Built in GitHub Actions (`.github/workflows/mobile-android.yml` and `mobile-ios.yml`); `gen/android` and `gen/apple` are initialized fresh in CI
- Android release signing is injected post-init by `.github/scripts/patch-android-signing.sh`
- iOS uses Xcode automatic cloud signing via App Store Connect API key
- App icon source: `src-tauri/app-icon.png` (1024px) — CI runs `npx tauri icon` after init
- Full release procedure and required secrets: `docs/mobile-release.md`

## Security

- CSP is currently disabled (`null`) for development
- File system access is restricted via capabilities
- Deep link scheme is registered as `fosforescent://`
- Shell plugin only allows opening URLs

## Current Implementation Status

### ✅ Completed
- **Local graph storage**: FosStore read/write to .fos/main.yml via Tauri commands
- **Offline mode**: AuthLanding "Continue Offline" button loads local data without authentication
- **Directory navigation**: Full file browser with .fos detection
- **CLI launcher**: `fos .` launches GUI, `fos init` creates .fos directory, `fos repl` for terminal
- **Tauri integration**: TypeScript bindings and React hook (`useTauri`)
- **Peer connection dialog**: WebRTC setup with QR code exchange

### ✅ Completed (continued)
- **Online/offline transition**: the `web/` UI keeps a replica in webview localStorage, works offline, and merges with the account on login via `shared/sync` (three-way merge on the FosStore graph, CHOICE nodes for divergences, optional attachment to a single partition). See `docs/sync.md`.

### 🚧 In Progress
- **Peer data sync**: WebRTC connection established but data transfer not implemented (can reuse `serveSync`/`completeSync` from `shared/sync`)

### ❌ Not Started
- File watching for .fos changes
- Proper CSP for production builds
- Custom app icons for all platforms
- Auto-update functionality
- Window state persistence
- Tray icon support

## TODOs
- [ ] Implement data sync over WebRTC peer connection
- [x] Add merge conflict resolution when transitioning offline→online (`shared/sync`, Choice nodes)
- [ ] File-backed `ReplicaStorage` adapter writing the replica into `.fos/` (currently localStorage on all platforms)
- [ ] Add file watching for .fos changes
- [ ] Add proper CSP for production builds
- [ ] Replace upscaled `src-tauri/app-icon.png` with real 1024×1024 artwork
- [ ] Add auto-update functionality
- [ ] Implement window state persistence
- [ ] Add tray icon support
