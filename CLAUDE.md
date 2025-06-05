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
- **infra/**: Terraform infrastructure configuration

### Core Graph System
The heart of Fosforescent is a content-addressable graph implementation in `shared/dag-implementation/`:
- **FosNode**: Primary node implementation with cryptographic content addressing
- **FosStore**: Graph storage and querying system
- **FosExpression**: Expression evaluation system
- **Channels**: Communication mechanism between nodes

### Key Technologies
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Radix UI components
- **Backend**: Node.js, Express, Prisma, PostgreSQL with vector extension
- **Database**: PostgreSQL with pgvector for embeddings
- **Build**: Vite with separate frontend/backend builds
- **Testing**: Jest with React Testing Library

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
# Run tests
npm run test
# or
make test

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

The project uses Vite with mode-based configuration:
- `--mode frontend`: Builds React SPA
- `--mode backend`: Builds Node.js server as CommonJS library
- Backend externals are automatically excluded from frontend builds
- Frontend files are excluded from backend builds

## Database Schema

Uses Prisma with PostgreSQL and pgvector extension:
- **UserModel**: User accounts with Stripe integration
- **FosNodeModel**: Content-addressable graph nodes
- **NodeVectorModel**: Vector embeddings for semantic search
- Email and authentication event tracking

## Testing Strategy

- Unit tests with Jest
- React component tests with Testing Library
- Storybook for component development and testing
- Visual regression testing via Storybook test runner

## Development Notes

- The graph system uses cryptographic hashing (CID) for content addressing
- Nodes are immutable - mutations create new nodes
- The system supports both local and planned distributed operation via DHT
- Vector embeddings are used for semantic search and AI integration
- Authentication uses JWT with Stripe for payments/subscriptions