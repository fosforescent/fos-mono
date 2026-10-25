# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fosforescent is a distributed, collaborative workflow system that combines human and AI inputs through a visual graph-based interface, built on a **dependently typed, modal, datalog-like language** using term graph rewriting.

### Language Design Summary

The core language combines several advanced concepts:

- **Dependent Types**: Types that depend on values (e.g., `Task<"description">`)
- **Patterns as Types**: Types are sets of graph patterns, enabling query-based type checking (datalog-like)
- **Modal Types**: Modalities provided by actors gate permissions and capabilities
- **Algebraic Effects**: Side effects handled by registered actors
- **Partial Evaluation**: Expressions that can't be satisfied become service endpoints (holes)
- **HoTT Foundations**: Variable binding uses equality types with reflexivity proofs

See `docs/language-design.md` for the full language specification, `docs/implementation-roadmap.md` for the implementation plan, and `docs/sync.md` for the sync core design.

## Design Principles

- The account server is one peer among others.
- The web UI is offline-first.
- Nodes are immutable - mutations create new nodes.
- Cids must carry the data version (`FOS_DATA_VERSION` in `shared/version.ts`). Data in another version is refused and reset, never migrated; see `docs/cid-versioning.md`.

## Development Commands

### Setup
```bash
npm install
npx prisma generate
```

### Database Management
```bash
# Reset database (drops all data)
make reset

# Run with clean database
make run-clean-backend
```

### Development
```bash
# Run backend and the web dev server together
npm run dev

# Web only / backend only / desktop (Tauri) only
npm run dev:web
npm run dev:backend
npm run dev:desktop
```

### Building
```bash
npm run build:web
npm run build:backend
npm run build:desktop
```

### Testing and Quality
```bash
# Web regressions (plain node scripts) and backend Jest
npm run test

# Shared graph/sync tests
cd shared && npx jest sync/

# Desktop agent runtime
cd desktop/agent-runtime && node --test

# Rust
cd desktop/src-tauri && cargo check
```

## Build Configuration

- `desktop/`: run `npm run build:core` by hand before a bare `cargo` build or test, so the embedded core (`src-tauri/js/fos-core.js`, gitignored) is current.

## Working on the Code

- Read `docs/sync.md`, `docs/language-design.md` and `docs/implementation-roadmap.md` before making significant changes to the core system.
- Docs state what we want, never what the code does. To learn what the code does, read the code; do not trust a doc's description of it and never write one.
- Always check the directory `CLAUDE.md` file when working in a specific area. When a design decision changes, update the intent there; do not add descriptions of the implementation.
- Use the TODOs sections in directory `CLAUDE.md` files to track planned work, phrased as intent without status.

## Dev Tips

- Use the makefile commands to run docker compose so the env vars are loaded.
- When working with Docker Compose and project builds, prefer using Makefile commands to standardize environment setup and ensure consistent configuration
- Create Docker Compose commands in the Makefile to abstract away complex docker and environment configurations
- Ensure environment variables are properly loaded and managed through the Makefile for docker compose commands
- Consider adding docker compose commands to the Makefile for:
  - Starting services
  - Stopping services
  - Rebuilding services
  - Cleaning up containers and volumes
  - Running specific service builds
- Use environment-specific docker compose files or override files to manage different deployment scenarios
- Add error handling and logging to docker compose commands in the Makefile
- Create commands that combine multiple steps like build+start or stop+clean
