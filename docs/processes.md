# System Processes

This document describes the overarching processes that transfer state between sources of truth and the transformations applied during these transfers.

## Core Data Flow Processes

### 1. Graph Mutation Process
**Flow**: Frontend → Backend → FosStore → PostgreSQL

**Steps**:
1. User initiates graph change in Frontend UI
2. Frontend validates change locally and updates optimistic UI
3. Backend receives mutation request via API or WebSocket
4. Backend creates new FosNode with content-addressable hash
5. FosStore adds node to local/distributed graph
6. PostgreSQL persistence layer stores node metadata
7. Vector embeddings generated asynchronously for search
8. Change broadcast to connected clients via WebSocket

**Transformations**:
- UI interactions → Structured graph mutations
- Mutable UI state → Immutable graph nodes
- User input → Cryptographically verified content

### 2. Authentication & Authorization Process
**Flow**: Frontend → Backend → PostgreSQL → JWT

**Steps**:
1. User submits credentials via Frontend
2. Backend validates against PostgreSQL UserModel
3. JWT token generated with user permissions
4. Token returned to Frontend for session management
5. Subsequent requests validated via JWT middleware

**Transformations**:
- Plain credentials → Hashed passwords (bcrypt)
- User identity → JWT claims
- Database user record → Session state

### 3. Data Synchronization Process
**Flow**: FosStore ↔ PostgreSQL ↔ Vector Database

**Steps**:
1. FosStore maintains canonical graph state
2. Periodic sync writes graph changes to PostgreSQL
3. Vector embeddings generated from node content
4. Search indices updated with new embeddings
5. Consistency checks validate state alignment

**Transformations**:
- Graph structure → Relational database records
- Node content → Vector embeddings
- Hierarchical data → Flat database tables

## User Interaction Processes

### 4. Workflow Execution Process
**Flow**: UI Trigger → Expression Evaluation → State Updates

**Steps**:
1. User triggers workflow execution
2. FosExpression interpreter evaluates node dependencies
3. Async actions execute (API calls, AI inference, etc.)
4. Results create new nodes in the graph
5. UI updates reflect execution progress and results

**Transformations**:
- User intentions → Executable expressions
- Synchronous UI → Asynchronous computation
- Static graph → Dynamic execution state

### 5. Collaboration Process
**Flow**: Client A → WebSocket → Backend → Client B

**Steps**:
1. Client A makes graph modification
2. Change validated and persisted via mutation process
3. WebSocket service broadcasts change to active sessions
4. Client B receives update and merges with local state
5. Conflict resolution via content-addressable immutability

**Transformations**:
- Individual changes → Collaborative state
- Local modifications → Distributed updates
- Conflicting edits → Resolved graph state

## Data Management Processes

### 6. Search & Discovery Process
**Flow**: User Query → Vector Search → Graph Traversal → Results

**Steps**:
1. User enters search query in Frontend
2. Backend generates query embedding
3. Vector similarity search finds candidate nodes
4. Graph traversal expands results with related nodes
5. Ranked results returned to Frontend

**Transformations**:
- Natural language → Vector embeddings
- Semantic similarity → Ranked results
- Isolated nodes → Connected subgraphs

### 7. Import/Export Process
**Flow**: External Data → Validation → Graph Integration

**Steps**:
1. User imports external data (files, APIs, etc.)
2. Backend validates and normalizes format
3. Data transformed into FosNode structures
4. Nodes integrated into existing graph
5. Relationships established with existing content

**Transformations**:
- External formats → Standardized FosNode schema
- Unstructured data → Typed graph nodes
- Isolated imports → Connected graph components

## System Maintenance Processes

### 8. Backup & Recovery Process
**Flow**: FosStore → PostgreSQL → External Storage

**Steps**:
1. Continuous replication of FosStore to PostgreSQL
2. Scheduled database backups to external storage
3. Graph consistency validation
4. Recovery procedures for data restoration

**Transformations**:
- Live graph state → Persistent snapshots
- Distributed data → Centralized backups
- Current state → Historical versions

### 9. Performance Optimization Process
**Flow**: Metrics Collection → Analysis → Optimization

**Steps**:
1. System metrics collected from all components
2. Performance analysis identifies bottlenecks
3. Caching strategies implemented
4. Database queries optimized
5. Frontend bundle optimization

**Transformations**:
- Raw metrics → Performance insights
- Identified issues → Optimization strategies
- Slow operations → Cached results