# Shared DAG Implementation Directory Summary

## Purpose
Core graph implementation providing content-addressable storage, immutable nodes, and expression evaluation for the Fosforescent distributed workflow system.

## Dependencies
- **js-sha3**: SHA3-256 cryptographic hashing for content addressing
- **@n1ru4l/json-patch-plus**: JSON diff/patch operations for incremental updates
- **../types**: Shared type definitions (FosNodeContent, FosPath, etc.)
- **../utils**: Utility functions (assert, aggMap)

## Data Inputs

### Graph Construction
- **FosContextData**: Serialized graph state with nodes, routes, and metadata
- **TrellisSerializedData**: UI state (focus, collapsed nodes, view mode)
- **FosNodeContent**: Individual node data with children relationships
- **FosPath**: Navigation routes through the graph

### Node Operations
- **NodeData**: Structured data (descriptions, todos, costs, etc.)
- **Edge Relationships**: [instruction_node_id, target_node_id] tuples
- **Mutation Operations**: Content updates with automatic versioning

## Data Outputs

### Graph State
- **Content-Addressable IDs**: SHA3-256 hashes as unique node identifiers
- **Immutable Nodes**: New node instances for each modification
- **Serialized Context**: JSON-exportable graph state for persistence
- **Expression Trees**: Traversable computation graphs

### Node Relationships
- **Parent-Child Links**: Hierarchical graph structure
- **Instruction-Target Pairs**: Computational relationships
- **Route Navigation**: Path-based node access

## Events Handled
- **Node Creation**: Automatic hashing and storage in content table
- **Node Mutation**: Version updates with timestamp tracking
- **Graph Updates**: Context synchronization and callback triggers
- **Expression Evaluation**: Recursive node computation
- **Cache Management**: Automatic node instance caching

## Data Transformations
- **Content Hashing**: Node content → SHA3-256 content identifiers (CIDs)
- **Immutable Updates**: Content changes → New node instances with updated timestamps
- **Graph Serialization**: FosStore instance → JSON context data
- **Graph Deserialization**: JSON context → Reconstructed FosStore with node relationships
- **Route Resolution**: FosPath arrays → Target node instances
- **Expression Building**: Node relationships → Executable expression trees
- **Diff Generation**: Store states → JSON patch operations for incremental sync

## Core Components

### FosStore
- **Content Table**: Map<CID, FosNodeContent> for content-addressable storage
- **Node Cache**: WeakMap for FosNode instance caching
- **Primitive Aliases**: Built-in node types and operations
- **Trellis State**: UI state management (focus, collapsed, view mode)
- **Workers**: Active expression evaluations
- **Peer Connections**: Distributed store synchronization

### FosNode
- **Immutable Content**: Read-only node data with computed CID
- **Edge Management**: Child relationship manipulation
- **Mutation Operations**: Content updates creating new instances
- **Tree Traversal**: Parent/child navigation methods

### FosExpression
- **Lazy Evaluation**: On-demand computation of node expressions
- **Dependency Resolution**: Recursive evaluation of node dependencies
- **Context Access**: Store-wide data access during evaluation
- **Result Caching**: Memoization of computed values

### Content Addressing
- **Deterministic Hashing**: Identical content produces identical CIDs
- **Integrity Verification**: Content tampering detection
- **Deduplication**: Automatic elimination of duplicate nodes
- **Distributed Sync**: CID-based content sharing across peers

## Performance Features
- **Lazy Loading**: Nodes created on-demand during traversal
- **Weak References**: Automatic garbage collection of unused nodes
- **Hash Caching**: WeakMap for expensive hash computation
- **Incremental Updates**: JSON patches for minimal data transfer
- **Content Deduplication**: Single storage of identical content