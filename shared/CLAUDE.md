# Shared Module - CLAUDE.md

## Directory Summary

The `shared/` directory contains the **core language implementation** for Fosforescent. This is the heart of the system - a dependently typed, modal, datalog-like language built on content-addressable graphs.

**Key Design Documents:**
- `../docs/language-design.md` - Full language specification
- `../docs/implementation-roadmap.md` - Implementation phases and checklist (largely unimplemented)
- `../docs/sync.md` - The system as built: refs, rows, merge, node exchange, evaluation, handlers

## Language Overview

Fosforescent implements a language with these core concepts:

### Types as Patterns
Types are **sets of graph patterns**. Type checking = pattern matching = query execution.

```
Type = { Pattern, Pattern, ... }
Value matches Type ⟺ Value matches all Patterns
```

### Dependent Types
Types can depend on values:
```
Task<"make lasagna"> : Type
Task<"wash dishes"> : Type
// These are different types!
```

### Modal Types
Modalities (provided by actors) gate permissions:
```
persist : □_@backend (Graph -> IO Unit)    // Requires @backend modality
aiInfer : □_@backend □_@paid (Prompt -> Response)
```

### Partial Evaluation with Holes
When an expression can't be satisfied, it creates a **hole**:
```
evaluate(expr) →
  if missing value: Hole { expectedType, endpointId }
  if missing modality: Hole { requiredModalities, endpointId }
```

Holes become service endpoints that accept fulfillment events.

### HoTT-style Binding
Variable binding uses equality types:
```
x = v  ⟺  Binding { symbol: x, value: v, proof: refl(v) }
```

## Directory Structure

```
shared/
├── dag-implementation/     # Core graph system
│   ├── node.ts            # FosNode - immutable content-addressed nodes
│   ├── store.ts           # FosStore - graph storage and queries
│   ├── primitive-node.ts  # Built-in primitive types and constructors
│   ├── node-data.ts       # Node data helpers
│   └── cid.ts             # content ids in the data version (../version.ts); no migrations
│
├── sync/                  # Everything above the store (docs/sync.md, sync/CLAUDE.md)
│   ├── graph.ts, refs.ts  # Mutable refs, rows, row types, commitRoot
│   ├── replica.ts         # Device replica and edit operations
│   ├── merge.ts, branches.ts       # Three-way merge, CHOICE nodes, branches
│   ├── node-provider.ts, node-sync.ts  # Node exchange protocol
│   ├── patterns.ts        # What a type accepts; type errors
│   ├── events.ts          # The event grammar every transport adapts to
│   ├── evaluation.ts, bindings.ts, handlers.ts, triggers.ts  # Evaluation, handler offers, triggers
│   ├── library.ts, forms.ts, sharing.ts, market.ts, …        # Standard library, constructors, publishing, market
│   └── embed.ts           # Replica API bundled into the fos binary (QuickJS)
│
├── library-compiler.ts   # Compiles the portable .fos library graph (library.generated.json)
├── version.ts            # FOS_DATA_VERSION (cid prefix and library version)
├── types.ts              # Core type definitions
├── dag-types.ts          # Interface definitions
├── utils.ts              # Utility functions
└── defaults.ts           # Default values
```

## Implementation Priorities

Based on `docs/implementation-roadmap.md` (roadmap items; none of the files below exist yet):

### Phase 1: Core Type Primitives
Add to `primitive-node.ts`:
- TYPE, PI, SIGMA (type constructors)
- EQ, REFL (equality types)
- SYMBOL (identifiers)
- HOLE, CONTINUATION
- SCOPE, BINDING, RULE
- BOX, DIAMOND, MODALITY
- ACTOR, CAPABILITY, EFFECT

### Phase 2: Pattern-Based Type Checking
Extend `store.ts`:
- `checkType(value, type)` - type checking via pattern matching
- `inferType(expr)` - type inference
- `validateTypeAnnotation(node)` - annotation checking

### Phase 3: Scopes and Binding
New file `scope.ts`:
- FosScope class with HoTT-style binding
- Lexical scope nesting
- Modality tracking per scope

### Phase 4: Holes and Partial Evaluation
New file `hole.ts`:
- HoleManager class
- createHole, createModalHole
- fill method with type validation

### Phase 5: Modal Types
New file `modality.ts`:
- ModalityManager class
- Box/unbox operations
- Actor-modality associations

### Phase 6: Actors and Effects
New file `actor.ts`:
- ActorRegistry class
- Effect routing
- Handler selection

## Key Interfaces

### INode (dag-types.ts)
```typescript
interface INode {
  getAddress(): string        // Content ID (CID)
  getValue(): unknown         // External data
  getEdges(): [string, string][]  // Child edges
  addEdge(type, target): INode
  removeEdge(type, target): INode
}
```

### IStore (dag-types.ts)
```typescript
interface IStore {
  create<T>(value: T): INode
  query(pattern: INode): INode[]
  queryTriple(s, p, o): [INode, INode, INode][]
  matchPattern(pattern, target): INode[]
  getNodeByAddress(addr): INode
}
```

### IFosInterpreter (dag-types.ts, not implemented)
```typescript
interface IFosInterpreter {
  createTask(desc, deps?): IFosInterpreter[]
  spawn(instr, target): IFosInterpreter[]
  getStack(): IFosInterpreter[]
  getChildren(): IFosInterpreter[]
  // ... more methods
}
```

## Graph Representation

### Node Structure
```typescript
FosNodeContent = {
  data: FosDataContent,      // Metadata
  children: FosPathElem[]    // Edges: [instr_cid, target_cid][]
}
```

### Expression = Instruction + Target
```
[Instruction CID, Target CID]
```

### Path Through Graph
```typescript
FosPath = FosPathElem[]  // Array of [instr, target] edges
```

## Testing

```bash
# Run shared module tests
cd shared && npx jest sync/

# Run specific test file
cd shared && npx jest dag-implementation/cid.test.ts
```

## TODOs

### High Priority
- [ ] Add type primitives (TYPE, PI, SIGMA, EQ, REFL, etc.)
- [ ] Implement `checkType` in store.ts
- [ ] Create FosScope class with HoTT binding
- [ ] Create HoleManager class
- [ ] Create ModalityManager class
- [ ] Create ActorRegistry class

### Medium Priority
- [ ] Implement FosService class
- [ ] Connect holes to REST endpoints

### Lower Priority
- [ ] Performance optimization for large graphs
