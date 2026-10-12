# Equality and Binding

## Overview

In FOS, equality follows HoTT (Homotopy Type Theory) style, using reflexivity proofs. The key insight is that **binding, equality proofs, unification results, and cache entries are all the same thing**.

## Equality Types

### The Equality Type

```
Eq(a, b) : Type
```

This is a **type** — the type of proofs that `a` equals `b`.

### The Reflexivity Constructor

```
refl(a) : Eq(a, a)
```

This is the **only** constructor for equality. It can only be constructed when both sides are definitionally equal (same CID).

## Graph Representation

### Equality Type `Eq(a, b)`

```
{
  (EQ_LEFT, a),
  (EQ_RIGHT, b)
}
```

### Equality Proof `refl(a)`

```
{
  (REFL, a)
}
```

## The Unified View

**Binding = Equality proof = Unification result = Cached substitution**

These are not separate concepts — they are **identical**:

| Perspective | What it means |
|-------------|---------------|
| **As binding** | "what is x?" → look up the value |
| **As proof** | "why is x this value?" → the refl witness |
| **As unification** | "can we make these equal?" → check/extend the context |
| **As cache** | "have we already proven this?" → avoid re-derivation |

## The Substitution Context

During evaluation, we accumulate a context of equality proofs:

```typescript
type SubstitutionContext = Map<VariableId, {
  value: FosNode,
  proof: FosNode  // refl(value) : Eq variable value
}>
```

This context serves ALL purposes simultaneously:
- **Lookup**: `ctx.get(x).value` → the bound value
- **Witness**: `ctx.get(x).proof` → the equality proof
- **Unification cache**: check if we already have `Eq a b` before re-deriving

## Example: Pattern Matching Produces Proofs

```
1. Pattern match: pair(a, b) = pair(3, 5)
   → ctx.set(a, { value: 3, proof: refl(3) })
   → ctx.set(b, { value: 5, proof: refl(5) })

2. Later, unify: f(a, c) with f(3, c)
   → Need to prove: Eq a 3
   → Check ctx: ctx.get(a).proof exists!
   → Unification succeeds (cached)

3. Even later, need: Eq a 3 again
   → Same lookup, no re-derivation
```

## Composing Proofs (Transitivity)

If we have:
- `proof₁ : Eq a b`
- `proof₂ : Eq b c`

We can derive `proof₃ : Eq a c` by composition:

```typescript
composeProofs(p1: FosNode, p2: FosNode): FosNode {
  // p1 : Eq a b, p2 : Eq b c  →  Eq a c
  return store.create({
    data: {},
    children: [
      [TRANS, p1.getId()],
      [TRANS, p2.getId()]
    ]
  })
}
```

Cached proofs become building blocks for new equalities.

## Connection to Variables-as-Effects

```
UNBOUND VARIABLE         BOUND VARIABLE
      ↓                        ↓
{ (VARIABLE, x) }   →   { (BINDING, x), (REFL, v), (EQ_RIGHT, v) }
      ↓                        ↓
   Effect needed            Effect handled
      ↓                        ↓
   "Need value for x"      "x = v, proof: refl(v)"
```

The effect handler produces the equality proof, which IS:
- The binding (x now has value v)
- The proof (refl(v) witnesses the equality)
- A cache entry (future lookups use this)

## Implementation Sketch

### store.ts additions

```typescript
// Create a refl proof for a node
createReflProof(node: FosNode): FosNode {
  return this.create({
    data: {},
    children: [[this.primitive.reflNode.getId(), node.getId()]]
  })
}

// Check if we can prove a = b
proveEquality(a: FosNode, b: FosNode): FosNode | null {
  // Definitional equality: same CID
  if (a.getId() === b.getId()) {
    return this.createReflProof(a)
  }

  // Structural equality via pattern matching
  try {
    const matches = this.matchPattern(a, b)
    if (matches.length > 0) {
      return this.createReflProof(a)
    }
  } catch (e) {
    // Pattern didn't match
  }

  return null
}
```

### Pattern Matching with Proofs

```typescript
// Current: returns matched nodes
matchPattern(pattern: FosNode, entry: FosNode): FosNode[]

// New: returns substitution context with proofs
matchPatternWithProofs(
  pattern: FosNode,
  entry: FosNode,
  ctx?: SubstitutionContext
): SubstitutionContext | null {
  // Returns extended context on success, null on failure
  // Each variable binding includes its refl proof
}
```

## Task Completion as Equality

Completing a task = constructing an equality proof:

```
Task<"make lasagna"> : Type
// Has hole: { (TASK, "make lasagna"), (HOLE, ?) }

// Completing = producing term:
{ (REFL, unit) } : Task<"make lasagna">

// The refl proves: "I produced what was asked for"
```

## Implementation Phases

### Phase 1: Add Primitives
1. Add `getEqNode`, `getReflNode`, `getTransNode` to `primitive-node.ts`
2. Add to `constructPrimitiveAliases()`
3. Add `createReflProof()`, `proveEquality()` to `store.ts`

### Phase 2: Proof-Returning Pattern Matching
- Modify `matchPattern()` to return `SubstitutionContext`
- Each binding includes its refl proof

### Phase 3: Proof Composition and Transport
- `composeProofs(p1, p2)` for transitivity
- `transport(proof, predicate, value)` for substitution

## Related Documents

- `core-graph-semantics.md` - Graph structure and primitives
- `categorical-foundations.md` - Variables as projections
- `carrot-dinner-example.md` - Concrete worked example
