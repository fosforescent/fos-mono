# Desktop CLAUDE.md

## Directory Summary
The desktop directory contains the Tauri-based desktop and mobile application for Fosforescent. It wraps the `web/` vanilla-TS frontend and adds native capabilities including file system access, directory navigation, and browser-based authentication. Mobile (iOS/Android) builds run in CI — see `docs/mobile-release.md`.

## Key Components

### Tauri Configuration
- `src-tauri/tauri.conf.json` - Main Tauri configuration
- `src-tauri/Cargo.toml` - Rust dependencies
- `src-tauri/capabilities/default.json` - Permission capabilities

### Rust Backend (`src-tauri/src/`)
- `lib.rs` - Main Tauri application with commands:
  - **Directory Navigation:**
    - `get_current_directory` - Get current working directory
    - `set_directory` - Change to a directory
    - `get_directory_contents` - List directory entries with .fos detection
    - `navigate_up` - Navigate to parent directory
    - `get_home_directory` - Get user's home directory
  - **.fos Directory Operations:**
    - `check_fos_directory` - Check for .fos directory (with ~/.fos fallback)
    - `read_fos_config` - Read .fos/config.json if present
    - `list_fos_files` - List files in .fos directory
    - `get_target_directory` - Get the directory passed via FOS_TARGET_DIR
    - `get_fos_directory` - Get the active .fos directory path
    - `set_fos_directory` - Set the active .fos directory path
    - `init_fos_directory` - Create a new .fos directory with config
  - **FosStore Operations:**
    - `read_fos_store` - Read main.yml/context file from .fos
    - `write_fos_store` - Write FosStore data to .fos
    - `get_app_init_info` - Get full init info (target dir, fos dir, store content)
  - **Auth:**
    - `open_auth_url` - Open URL in system browser for auth
- `main.rs` - Application entry point

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

### 🚧 In Progress
- **Peer data sync**: WebRTC connection established but data transfer not implemented
- **Online/offline transition**: No merge logic when going from offline to online

### ❌ Not Started
- File watching for .fos changes
- Proper CSP for production builds
- Custom app icons for all platforms
- Auto-update functionality
- Window state persistence
- Tray icon support

## TODOs
- [ ] Implement data sync over WebRTC peer connection
- [ ] Add merge conflict resolution when transitioning offline→online
- [ ] Add file watching for .fos changes
- [ ] Add proper CSP for production builds
- [ ] Replace upscaled `src-tauri/app-icon.png` with real 1024×1024 artwork
- [ ] Add auto-update functionality
- [ ] Implement window state persistence
- [ ] Add tray icon support
