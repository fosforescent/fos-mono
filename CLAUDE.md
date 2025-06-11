# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fosforescent is a distributed, collaborative workflow system that combines human and AI inputs through a visual graph-based interface. It's built on a dependently typed functional dataflow language using term graph rewriting. The project is in early development stages.

## Architecture

### Monorepo Structure
- **backend/**: Node.js/Express API server with Prisma ORM and PostgreSQL
- **frontend/**: React/Vite SPA with TypeScript and Tailwind CSS
- **shared/**: Core graph implementation and type definitions shared between frontend and backend
- **prisma/**: Database schema and migrations
- **infra/**: Infrastructure configuration including Terraform, Docker Compose, and E2E tests
- **cli/**: Command-line interface tools
- **docs/**: Documentation and architecture guides

### Core Graph System
The heart of Fosforescent is a content-addressable graph implementation in `shared/dag-implementation/`:
- **FosNode**: Primary node implementation with cryptographic content addressing
- **FosStore**: Graph storage and querying system
- **FosExpression**: Expression evaluation system
- **Channels**: Communication mechanism between nodes

### Key Technologies
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Radix UI components
- **Backend**: Node.js, Express, Prisma, PostgreSQL
- **Vector Database**: Qdrant for semantic search and vector embeddings
- **Database**: PostgreSQL for relational data, Qdrant for vector operations
- **Build**: Vite with separate frontend/backend builds, Docker multi-stage builds
- **Testing**: Jest with React Testing Library, Playwright for E2E testing
- **Infrastructure**: Docker Compose, Terraform for cloud deployment

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
# Run both frontend and backend in development
npm run dev
# or
make run-dev

# Frontend only
npm run dev:frontend

# Backend only  
npm run dev:backend
```

### Building
```bash
# Build both frontend and backend
npm run build:frontend
npm run build:backend

# Using Makefile
make build-frontend
make build-backend
```

### Testing and Quality
```bash
# Run unit tests
npm run test
# or
make test

# Run E2E tests (requires services to be running)
cd infra && npm test

# Linting
npm run lint
make format

# Fix linting issues
npm run lint:fix
make format-fix

# Full check (format + test + build)
make check
```

### Storybook
```bash
npm run storybook
npm run build-storybook
npm run test-storybook
```

## Build Configuration

The project uses multiple build systems:

### Vite Configuration
- `--mode frontend`: Builds React SPA
- `--mode backend`: Builds Node.js server as CommonJS library
- Backend externals are automatically excluded from frontend builds
- Frontend files are excluded from backend builds

### Docker Configuration
- Multi-stage Dockerfiles for both frontend and backend
- Frontend Dockerfile: Builds React app and serves via Node.js
- Backend Dockerfile: Builds TypeScript and runs production server
- Docker Compose: Orchestrates services with PostgreSQL and Qdrant databases

## Database Schema

Uses multiple database systems:
- **PostgreSQL** (via Prisma): Relational data including user accounts, graph nodes, and metadata
  - **UserModel**: User accounts with Stripe integration
  - **FosNodeModel**: Content-addressable graph nodes
  - Email and authentication event tracking
- **Qdrant**: Vector database for semantic search and embeddings
  - 3072-dimensional vectors using OpenAI text-embedding-3-large
  - Automatic collection initialization and content indexing

## Testing Strategy

- **Unit Tests**: Jest with React Testing Library for component and logic testing
- **Integration Tests**: Storybook for component development and testing
- **E2E Tests**: Playwright tests located in `infra/e2e-tests/` covering:
  - Authentication flows
  - Dashboard functionality
  - Console agent interactions
  - Subscription and billing workflows
  - Graph workflow operations
- **Visual Regression**: Storybook test runner for UI consistency

## Development Notes

- The graph system uses cryptographic hashing (CID) for content addressing
- Nodes are immutable - mutations create new nodes
- The system supports both local and planned distributed operation via DHT
- Vector embeddings are stored in Qdrant for high-performance semantic search
- Authentication uses JWT with Stripe for payments/subscriptions

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
- `backend/data/CLAUDE.md` - Data management and search
- `backend/email/CLAUDE.md` - Email system
- `backend/subscription/CLAUDE.md` - Payment and subscriptions
- `docs/CLAUDE.md` - Documentation and architecture
- `infra/helpers/CLAUDE.md` - End-to-end test helpers (moved from e2e/)
- `infra/terraform/CLAUDE.md` - Terraform infrastructure configuration
- `frontend/components/*/CLAUDE.md` - UI component directories
- `frontend/hooks/CLAUDE.md` - Custom React hooks
- `frontend/jest/CLAUDE.md` - Test configuration
- `frontend/lib/CLAUDE.md` - Frontend utilities
- `prisma/CLAUDE.md` - Database schema and management
- `shared/dag-implementation/CLAUDE.md` - Core graph system
- `shared/evaluation/CLAUDE.md` - Expression evaluation
- `shared/mock/CLAUDE.md` - Example workflows and test data
- `infra/CLAUDE.md` - Infrastructure, Docker, and E2E testing