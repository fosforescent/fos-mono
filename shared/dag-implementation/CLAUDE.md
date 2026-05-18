# DAG Implementation - CLAUDE.md

## Directory Summary

Core graph implementation providing content-addressable storage, immutable nodes, and expression evaluation for the Fosforescent distributed workflow system.

**Key Design Documents:**
- `../../docs/language-design.md` - Full language specification
- `../../docs/implementation-roadmap.md` - Implementation phases (especially Phases 1-3, 5-6)

## Implementation Priorities

This directory requires significant additions to implement the full language design:

### Phase 1: New Primitives (primitive-node.ts)
Add to `constructPrimitiveAliases()`:
- TYPE, PI, SIGMA (type constructors)
- EQ, REFL (equality types for HoTT binding)
- SYMBOL (identifiers)
- HOLE, CONTINUATION (partial evaluation)
- SCOPE, BINDING, RULE (scoping)
- BOX, DIAMOND, MODALITY (modal types)
- ACTOR, CAPABILITY, EFFECT (actor system)

### Phase 2: Type Checking (store.ts)
Add methods:
- `checkType(value, type): boolean`
- `inferType(expr): FosNode`
- `validateTypeAnnotation(node): { valid, error? }`

### Phase 3: New Files
- `scope.ts` - FosScope class with HoTT binding
- `hole.ts` - HoleManager class
- `modality.ts` - ModalityManager class
- `actor.ts` - ActorRegistry class

### Dependencies
- **js-sha3**: SHA3-256 cryptographic hashing for content addressing
- **@n1ru4l/json-patch-plus**: JSON diff/patch operations for incremental updates
- **../types**: Shared type definitions (FosNodeContent, FosPath, etc.)
- **../utils**: Utility functions (assert, aggMap)

### Data Inputs

#### Graph Construction
- **FosContextData**: Serialized graph state with nodes, routes, and metadata
- **TrellisSerializedData**: UI state (focus, collapsed nodes, view mode)
- **FosNodeContent**: Individual node data with children relationships
- **FosPath**: Navigation routes through the graph

#### Node Operations
- **NodeData**: Structured data (descriptions, todos, costs, etc.)
- **Edge Relationships**: [instruction_node_id, target_node_id] tuples
- **Mutation Operations**: Content updates with automatic versioning

### Data Outputs

#### Graph State
- **Content-Addressable IDs**: SHA3-256 hashes as unique node identifiers
- **Immutable Nodes**: New node instances for each modification
- **Serialized Context**: JSON-exportable graph state for persistence
- **Expression Trees**: Traversable computation graphs

#### Node Relationships
- **Parent-Child Links**: Hierarchical graph structure
- **Instruction-Target Pairs**: Computational relationships
- **Route Navigation**: Path-based node access

### Events Handled
- **Node Creation**: Automatic hashing and storage in content table
- **Node Mutation**: Version updates with timestamp tracking
- **Graph Updates**: Context synchronization and callback triggers
- **Expression Evaluation**: Recursive node computation
- **Cache Management**: Automatic node instance caching

### Data Transformations
- **Content Hashing**: Node content → SHA3-256 content identifiers (CIDs)
- **Immutable Updates**: Content changes → New node instances with updated timestamps
- **Graph Serialization**: FosStore instance → JSON context data
- **Graph Deserialization**: JSON context → Reconstructed FosStore with node relationships
- **Route Resolution**: FosPath arrays → Target node instances
- **Expression Building**: Node relationships → Executable expression trees
- **Diff Generation**: Store states → JSON patch operations for incremental sync

### Core Components

#### FosStore
- **Content Table**: Map<CID, FosNodeContent> for content-addressable storage
- **Node Cache**: WeakMap for FosNode instance caching
- **Primitive Aliases**: Built-in node types and operations
- **Trellis State**: UI state management (focus, collapsed, view mode)
- **Workers**: Active expression evaluations
- **Peer Connections**: Distributed store synchronization

#### FosNode
- **Immutable Content**: Read-only node data with computed CID
- **Edge Management**: Child relationship manipulation
- **Mutation Operations**: Content updates creating new instances
- **Tree Traversal**: Parent/child navigation methods

#### FosExpression
- **Lazy Evaluation**: On-demand computation of node expressions
- **Dependency Resolution**: Recursive evaluation of node dependencies
- **Context Access**: Store-wide data access during evaluation
- **Result Caching**: Memoization of computed values

#### Content Addressing
- **Deterministic Hashing**: Identical content produces identical CIDs
- **Integrity Verification**: Content tampering detection
- **Deduplication**: Automatic elimination of duplicate nodes
- **Distributed Sync**: CID-based content sharing across peers

### Performance Features
- **Lazy Loading**: Nodes created on-demand during traversal
- **Weak References**: Automatic garbage collection of unused nodes
- **Hash Caching**: WeakMap for expensive hash computation
- **Incremental Updates**: JSON patches for minimal data transfer
- **Content Deduplication**: Single storage of identical content

## TODOs

### High Priority (Phase 1-2)
- [ ] Add TYPE, PI, SIGMA, EQ, REFL, SYMBOL primitives to primitive-node.ts
- [ ] Add HOLE, CONTINUATION primitives
- [ ] Add SCOPE, BINDING, RULE primitives
- [ ] Add BOX, DIAMOND, MODALITY primitives
- [ ] Add ACTOR, CAPABILITY, EFFECT primitives
- [ ] Implement `checkType()` in store.ts
- [ ] Implement `inferType()` in store.ts
- [ ] Update PrimitiveAliases type with new primitives

### Medium Priority (Phase 3, 5-6)
- [ ] Create scope.ts with FosScope class
- [ ] Create hole.ts with HoleManager class
- [ ] Create modality.ts with ModalityManager class
- [ ] Create actor.ts with ActorRegistry class

### Lower Priority
- [ ] Implement full channel.ts communication
- [ ] Add distributed peer synchronization
- [ ] Performance optimization for large graphs