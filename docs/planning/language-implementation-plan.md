# Language Implementation Plan

## Overview

This document outlines the plan for implementing the core FOS language semantics.

## Related Documents

| Document | Description |
|----------|-------------|
| `core-graph-semantics.md` | Foundational graph structure, primitives, edge meaning |
| `categorical-foundations.md` | Variables as projections, holes, eliminators |
| `equality-and-binding.md` | HoTT-style equality, unified binding/proof/cache |
| `carrot-dinner-example.md` | Concrete worked example |
| `functions-and-abstraction.md` | Functions as nodes, abstraction, vector view |

## Terminology Change: instruction/target → left/right

**Rationale:** More neutral terminology that doesn't imply specific interpretation.

| Current | New |
|---------|-----|
| `instruction` | `left` |
| `target` | `right` |
| `instructionNode` | `leftNode` |
| `targetNode` | `rightNode` |
| `instructionCid` | `leftCid` |
| `targetCid` | `rightCid` |

**Files affected:**
- `shared/dag-implementation/expression.ts`
- `shared/dag-implementation/store.ts`
- `shared/types.ts` (FosPathElem, etc.)
- `frontend/vanilla/expression-tree.ts`
- All other files referencing these terms

## Structural Numbering System (Future)

**Idea:** Simple nodes get hierarchical numbers instead of content hashes.

- Empty/0 node is the base: `{} → 0`
- Next node: `{(0,0)} → 1`
- Then: `{(0,0), (1,0)}`, `{(0,1), (1,1)}`, etc.

**Benefits:**
- Predictable addresses for structural nodes
- Smaller identifiers for common patterns
- Natural ordering

**Considerations:**
- How does this interact with content-addressed nodes?
- When to use structural vs content addressing?
- Depends on core semantics being finalized first

## Node Types & UI

**Question:** How should users change an expression's type in the UI?

### Options

1. **Right-click context menu** - Familiar pattern (Google Docs, VS Code)
2. **Slash command** (Notion-style) - `/task`, `/document`, etc.
3. **Type indicator button** - Click to open type picker
4. **Keyboard shortcut** - `Ctrl+Shift+T` → type menu
5. **Drag handle menu** - Click `⋮⋮` handle → options

### Questions to Resolve

- Type changeable after creation, or only at creation?
- What happens to content when changing types?
- Should children inherit parent's type suggestion?

## Implementation Phases

### Phase 1: Core Primitives

Add to `primitive-node.ts`:
- `getEqNode` - Equality type
- `getReflNode` - Reflexivity proof
- `getTransNode` - Transitivity/composition
- `getSumNode` - Coproduct (already exists as various primitives)
- `getProductNode` - Product (already exists)

### Phase 2: Proof-Returning Pattern Matching

Modify `store.ts`:

```typescript
type SubstitutionContext = Map<string, {
  value: FosNode,
  proof: FosNode
}>

matchPatternWithProofs(
  pattern: FosNode,
  entry: FosNode,
  ctx?: SubstitutionContext
): SubstitutionContext | null
```

### Phase 3: Evaluation Loop

Implement in `expression.ts` or new file:

```typescript
evaluate(node: FosNode, ctx: SubstitutionContext): {
  result: FosNode | null,
  holes: Hole[]
}

fillHole(hole: Hole, value: FosNode, ctx: SubstitutionContext): SubstitutionContext
```

### Phase 4: Proof Composition

```typescript
composeProofs(p1: FosNode, p2: FosNode): FosNode  // Transitivity
transport(proof: FosNode, predicate: FosNode, value: FosNode): FosNode
```

## Type-Driven UI Generation

**Goal:** Compose primitive types to create new types, set as node's type, generate UI from type structure.

### Flow

```
1. Compose type:   Choice<Task<"dried">, Task<"grilled">>
2. Attach to node: node has TYPE edge pointing to that type
3. Render UI:      dispatch on type structure
4. User interacts: applies constructor (e.g., SUM_INR)
5. Result:         term with that constructor
```

### Edge Semantics Clarification

- **Left = Constructor** (not type)
- Constructor checked against type (type checking - to be fleshed out)

### UI Dispatch

| Type Structure | UI Component |
|----------------|--------------|
| SUM(A, B) | Choice/dropdown/radio |
| PRODUCT(A, B) | Show all children |
| Task<D> | Checkbox/completion |
| Leaf with hole | Input field |

## Open Questions

1. **Edge semantics:** How exactly does "right uses left's edges"?
   - Through holes that match edge labels?
   - Explicit references?
   - Unification?

2. **Initial vs terminal for holes:** Is HOLE = UNIT correct, or is there something more subtle about holes being projections?

3. **Variables:** Should we use variables-as-effects or path induction for binding?

## Testing Strategy

1. Implement carrot dinner example end-to-end
2. Verify evaluation creates correct holes
3. Verify filling holes produces correct proofs
4. Verify re-evaluation with context works
5. Test proof caching/reuse

## Success Criteria

A minimal working system where:
1. Tasks can be defined as graph nodes
2. Evaluation identifies holes (choices, completions)
3. Filling holes produces equality proofs
4. Proofs are cached and reused
5. The carrot dinner example works end-to-end
