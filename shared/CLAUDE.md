# Shared Module - CLAUDE.md

## Directory Summary

The `shared/` directory contains the **core language implementation** for Fosforescent. This is the heart of the system - a dependently typed, modal, datalog-like language built on content-addressable graphs.

**Key Design Documents:**
- `../docs/language-design.md` - Full language specification
- `../docs/implementation-roadmap.md` - Implementation phases and checklist
- `./design.md` - Original design notes
- `./runtime.md` - Runtime architecture notes

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
│   ├── expression.ts      # FosExpression - expression representation
│   ├── primitive-node.ts  # Built-in primitive types and constructors
│   ├── channel.ts         # Communication channels (stub)
│   └── context.ts         # Evaluation context (partial)
│
├── evaluation/            # Evaluation and interpretation
│   ├── interpreter.ts     # FosInterpreter - expression evaluation
│   ├── string-client.ts   # String-based client interface
│   └── state-machines.ts  # XState machines (legacy)
│
├── mock/                  # Example workflows and test data
│   └── example-workflows.ts
│
├── types.ts              # Core type definitions
├── dag-types.ts          # Interface definitions
├── utils.ts              # Utility functions
├── defaults.ts           # Default values
├── design.md             # Design notes
└── runtime.md            # Runtime notes
```

## Current Implementation Status

### Implemented ✅
- Content-addressable nodes (FosNode)
- Graph storage and querying (FosStore)
- Pattern matching (matchPattern, query, queryTriple)
- Basic interpreter (createTask, spawn, setName)
- Primitive node types (~100+ types)
- Mutable aliases with version history

### Partially Implemented ⚠️
- Expression evaluation (expression.ts has many stubs)
- Channel communication (skeleton only)
- Context/effect handling (mostly commented out)

### Not Yet Implemented ❌
- Type checking as pattern matching
- Hole creation and management
- Modal type system
- Actor registry
- Effect emission and handling
- Service layer (endpoint generation)
- Scope management with HoTT binding

## Implementation Priorities

Based on `docs/implementation-roadmap.md`:

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

### IFosInterpreter (dag-types.ts)
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
npm run test -- shared/

# Run specific test file
npm run test -- shared/dag-implementation/__tests__/store.test.ts
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
- [ ] Add evaluatePartial to interpreter
- [ ] Connect holes to REST endpoints

### Lower Priority
- [ ] Implement channel communication
- [ ] Add WebSocket event handling
- [ ] Performance optimization for large graphs
