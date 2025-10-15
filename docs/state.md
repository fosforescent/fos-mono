# State Management

This document describes the sources of truth in the Fosforescent system and how they relate to each other.

## Primary Sources of Truth

### 1. FosStore (Graph Database)
- **Location**: `shared/dag-implementation/store.ts`
- **Purpose**: Content-addressable storage for the distributed graph
- **Key Characteristics**:
  - Immutable nodes identified by cryptographic hash (CID)
  - Contains the canonical representation of the workflow graph
  - Supports both local and distributed operation via DHT

### 2. PostgreSQL Database
- **Location**: Managed by Prisma (`prisma/schema.prisma`)
- **Purpose**: Persistent storage for user data, metadata, and system state
- **Key Models**:
  - `UserModel`: User accounts and authentication
  - `FosNodeModel`: Persistent graph node storage
  - `NodeVectorModel`: Vector embeddings for semantic search
  - Email and authentication event logs

### 3. Client-Side State
- **Location**: React components and hooks throughout `frontend/`
- **Purpose**: UI state, user interactions, and local caching
- **Key Characteristics**:
  - Ephemeral state for user interface
  - Local caching of graph data for performance
  - Real-time collaboration state via WebSocket

## State Relationships

### Graph Consistency
- **FosStore** serves as the authoritative source for graph structure
- **PostgreSQL** provides persistent backup and queryable metadata
- **Client State** maintains local views with eventual consistency

### User Data Flow
- User authentication state flows from PostgreSQL → Backend → Frontend
- User preferences and settings stored in PostgreSQL
- Session state maintained in JWT tokens and client memory

### Graph Data Flow
- Graph mutations originate in Frontend → Backend → FosStore
- FosStore updates propagate to PostgreSQL for persistence
- Vector embeddings generated asynchronously and stored separately

### Real-time Synchronization
- WebSocket connections maintain live state between clients
- Graph changes broadcast to all connected clients
- Conflict resolution handled through content-addressable immutability

## Data Consistency Guarantees

### Eventually Consistent
- Graph state across distributed nodes
- Vector embeddings and search indices
- Client-side caches

### Strongly Consistent
- User authentication and authorization
- Financial transactions (Stripe integration)
- Email verification and password resets

### Immutable
- FosNode content (identified by hash)
- Historical graph states
- Audit logs and event tracking