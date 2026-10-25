# Shared Module - CLAUDE.md

## Directory Summary

The `shared/` directory holds the **core language** for Fosforescent: a dependently typed, modal, datalog-like language built on content-addressable graphs.

**Key Design Documents:**
- `../docs/language-design.md` - Full language specification
- `../docs/implementation-roadmap.md` - Implementation phases and checklist
- `../docs/sync.md` - Sync core design: refs, rows, merge, node exchange, evaluation, handlers

## Language Overview

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

### Expression = Instruction + Target
```
[Instruction CID, Target CID]
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
