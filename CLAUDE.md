# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fosforescent is a distributed, collaborative workflow system that combines human and AI inputs through a visual graph-based interface. It's built on a **dependently typed, modal, datalog-like language** using term graph rewriting. The project is in early development stages.

### Language Design Summary

The core language combines several advanced concepts:

- **Dependent Types**: Types that depend on values (e.g., `Task<"description">`)
- **Patterns as Types**: Types are sets of graph patterns, enabling query-based type checking (datalog-like)
- **Modal Types**: Modalities provided by actors gate permissions and capabilities
- **Algebraic Effects**: Side effects handled by registered actors
- **Partial Evaluation**: Expressions that can't be satisfied become service endpoints (holes)
- **HoTT Foundations**: Variable binding uses equality types with reflexivity proofs

See `docs/language-design.md` for the full language specification and `docs/implementation-roadmap.md` for the implementation plan.

### Current Development Priority

The primary goal is to implement the evaluation mechanism that allows:
1. Creating tasks as typed expressions (`Task<"description">`)
2. Partial evaluation that creates "holes" for unsatisfied subexpressions
3. Running the system as a service that exposes endpoints for holes
4. Actors registering to handle effects and provide modalities
5. Events fulfilling holes and continuing evaluation

## Architecture

### Monorepo Structure
- **backend/**: Node.js/Express API server with Prisma ORM and PostgreSQL (pgvector for row search); the account server is one peer among others
- **shared/**: Core graph implementation and type definitions shared between web, desktop and backend
- **shared/sync/**: Offline/online sync on the FosStore graph (identity-keyed three-way merge, CHOICE nodes for divergences, peer-link protocol); see `docs/sync.md`
- **web/**: Vanilla-TS task UI used by the browser and wrapped by the Tauri desktop/mobile app; offline-first via localStorage replica
- **prisma/**: Database schema and migrations
- **infra/**: Infrastructure configuration including Terraform, Docker Compose, Prisma schema and API smoke tests
- **desktop/**: Tauri shell = the `fos` binary: GUI mode and a Rust CLI/REPL mode over the same `.fos/` state (`fos <dir>` = project context, `fos` = home/account context); see `desktop/CLAUDE.md` and `docs/sync.md`
- **docs/**: Documentation and architecture guides

### Core Graph System
The heart of Fosforescent is a content-addressable graph implementation in `shared/dag-implementation/`:
- **FosNode**: Primary node implementation with cryptographic content addressing
- **FosStore**: Graph storage and querying system
- **shared/sync/**: everything above the store: mutable refs, rows, requirements, merge, protocol, evaluation, triggers (`docs/sync.md`)

### Key Technologies
- **Web UI**: vanilla TypeScript, Vite (`web/`), wrapped by Tauri for desktop and mobile
- **Backend**: Node.js, Express, Prisma, PostgreSQL with pgvector (Vertex embeddings for row search)
- **Desktop/CLI**: Tauri 2 + Rust, with the TypeScript sync core embedded in QuickJS
- **Build**: Vite for web, tsc for backend, cargo/tauri for desktop, Docker for the backend image
- **Testing**: node scripts in `web/tests`, Jest in `backend/` and `shared/`, `node --test` in `desktop/agent-runtime` and `plugins/`
- **Infrastructure**: Docker Compose, Terraform on GCP, Cloudflare Pages for the web app

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

# Desktop agent runtime and plugin packaging
cd desktop/agent-runtime && node --test
node --test plugins/bridge.test.mjs && python3 plugins/build_test.py

# Rust
cd desktop/src-tauri && cargo check
```

## Build Configuration

- `web/`: Vite SPA; `tsc && vite build`. The same build runs in the browser and inside the Tauri webview.
- `backend/`: `tsc`; `Dockerfile` builds the image deployed to Cloud Run (`.github/workflows/deploy-backend.yml`).
- `desktop/`: `tauri build`; its hooks run `npm run build:core` first, bundling `shared/sync/embed.ts` into the gitignored `src-tauri/js/fos-core.js` the binary embeds (run it by hand before a bare `cargo` build or test).
- Docker Compose (`infra/`): PostgreSQL (pgvector), Temporal and the backend.

## Database Schema

PostgreSQL via Prisma (`infra/prisma/schema.prisma`):
- **UserModel**: User accounts with Stripe integration
- **FosNodeModel**: Content-addressable graph nodes
- **RowEmbeddingModel**: pgvector row embeddings (768-dimensional Vertex `text-embedding-005`) for semantic and market search
- **IntegrationConnectionModel**, **PeerInviteModel**: OAuth connections and peer invite tokens
- Email and authentication event tracking

## Testing Strategy

- **Web**: `web/tests/*.cjs` drive the real UI controller against an in-memory DOM and fake transports (`npm test` in `web/`)
- **Shared**: Jest over merge, protocol, refs, evaluation, triggers and CID migration (`shared/sync/*.test.ts`)
- **Backend**: Jest with injected dependencies, no network (`backend/**/*.test.ts`); `infra/apiTests` holds manual API smoke scripts
- **Desktop**: `cargo test --bin fos`, `node --test` in `desktop/agent-runtime`

## Development Notes

- The graph system uses cryptographic hashing (CID) for content addressing; cids carry a format version (`v1-…`) and older formats are migrated on load, see `docs/cid-versioning.md`
- Nodes are immutable - mutations create new nodes
- The system supports both local and planned distributed operation via DHT
- Row embeddings live in PostgreSQL (pgvector) and are reindexed after each save (`backend/search/rowIndex.ts`)
- Authentication uses JWT with Stripe for payments/subscriptions

### Key Design Documents

**Read these before making significant changes to the core system:**

- `docs/language-design.md` - Complete language specification including:
  - Type system (dependent types, patterns as types, modal types)
  - Evaluation model (partial evaluation, holes, continuations)
  - Actor/effect system
  - Service model (how programs become services)
  - Graph representation of all constructs

- `docs/implementation-roadmap.md` - Phased implementation plan with:
  - Phase-by-phase breakdown
  - File changes required for each phase
  - Code examples and interfaces
  - Testing checklist

- `shared/design.md` - Original design notes on messaging and events
- `shared/runtime.md` - Runtime design notes

## Directory CLAUDE.md Files

Each major directory in this monorepo contains its own `CLAUDE.md` file with detailed documentation about that specific area. These files provide:

- **Directory Summary**: Purpose and functionality of the directory
- **Dependencies**: External and internal dependencies
- **Data Inputs/Outputs**: What data flows in and out
- **Events Handled**: What events the system responds to
- **Data Transformations**: How data is processed
- **Component Details**: Specific components and their responsibilities
- **TODOs**: Current and future tasks for that directory

### Important Reminders for Claude Code:

1. **Always check directory CLAUDE.md files** when working in a specific area - they contain crucial context about that part of the system
2. **Keep directory CLAUDE.md files up to date** when making changes to a directory's functionality
3. **Use the TODOs sections** in directory CLAUDE.md files to track ongoing work and future improvements
4. **Reference these files** when explaining code or making architectural decisions

### Directory CLAUDE.md Locations:

- `backend/auth/CLAUDE.md` - Authentication system
- `backend/email/CLAUDE.md` - Email system
- `backend/subscription/CLAUDE.md` - Payment and subscriptions
- `docs/CLAUDE.md` - Documentation and architecture
- `infra/terraform/CLAUDE.md` - Terraform infrastructure configuration
- `web/CLAUDE.md` - Web UI (browser and Tauri webview)
- `desktop/CLAUDE.md` - Tauri shell, `fos` CLI/REPL, agent runtime
- `infra/prisma/CLAUDE.md` - Database schema and management
- `shared/dag-implementation/CLAUDE.md` - Core graph system
- `shared/evaluation/CLAUDE.md` - Expression evaluation
- `shared/sync/CLAUDE.md` - Offline/online sync core
- `shared/mock/CLAUDE.md` - Example workflows and test data
- `infra/CLAUDE.md` - Infrastructure, Docker, deployment

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