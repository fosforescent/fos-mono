# Functions and Abstraction

## Status: Working Ideas (Not Settled)

These are ideas being explored. They need to be fitted together with the other pieces.

## Core Insight: Constructor vs Function

The only difference between a constructor and a function is **whether they get rewritten on evaluation**:

| Kind | Evaluation Behavior |
|------|---------------------|
| Constructor | Stays as data (no rewriting) |
| Function | Gets reduced/rewritten |

Types are also created via constructors.

## Node as Set of Implications

A node is a set of implications. Each edge `(left, right)` says:

```
left ⊢ right
"Given left's context, right is derivable"
```

So:
```
Node = { (l₁, r₁), (l₂, r₂), ... }
     = { l₁ ⊢ r₁, l₂ ⊢ r₂, ... }
```

## Product and Sum as Logic

| Structure | Logic | Meaning |
|-----------|-------|---------|
| **Product/Pullback** | Conjunction (∧) | Same inputs → multiple outputs |
| **Sum/Pushout** | Disjunction (∨) | Multiple inputs → same output |

- Product: multiple implications from same premise
- Sum: different premises leading to same conclusion

## Functions as Nodes (Not Expressions)

A function is a **node** that declares its abstracted variables:

```
functionNode = {
  (ABSTRACT, x),        // Declares: "x is abstracted"
  (ABSTRACT, y),        // Declares: "y is abstracted"
  (BODY, bodyExpr),     // The body uses x and y
}
```

The abstracted variables must be listed WITHIN the function node. Other expressions within that node can use those variables.

## Context Provision

To provide variables to expressions that use them, there must be a left node providing that context:

```
Parent composition provides values
        ↓
Left nodes get holes filled
        ↓
Right nodes can use those filled values
        ↓
Evaluation proceeds
```

Left nodes within a function node have handlers for the variable:

| Handler Mode | Meaning |
|--------------|---------|
| **UNIFY** | Variable needs to be solved (pattern matching, inference) |
| **ABSTRACT** | Variable stays as parameter, filled on parent composition |

## Functions as Vectors/Tuples

Mathematical view: a function IS a tuple indexed by its domain.

### Finite Case

For `f: A → B` where A = {a₁, a₂, ..., aₙ}:

```
f ≅ (f(a₁), f(a₂), ..., f(aₙ))
f ≅ B × B × ... × B  (n times)
f ≅ Bⁿ
f ≅ Bᴬ
```

### Dependent Case

For `f: (x: A) → B(x)`:

```
f ≅ (f(a₁): B(a₁), f(a₂): B(a₂), ...)
f ≅ Π_{x:A} B(x)
```

### As Node

```
f = {
  (input₁, output₁),
  (input₂, output₂),
  (input₃, output₃),
}
```

Each edge is "what this function does for this input case."

The function represented extensionally as its graph (set of input-output pairs).

## Linear Algebra Analogy

| Concept | Linear Algebra |
|---------|----------------|
| Function | Vector |
| Composition | Matrix multiplication |
| Linear map | Matrix (columns = what happens to each basis vector) |

## Connection to Curry-Howard

Since we're viewing nodes as implications:

| Type Theory | Logic | FOS |
|-------------|-------|-----|
| Type | Proposition | Node (as pattern/constraint) |
| Term | Proof | Node (fully specified) |
| Function | Implication | Node with edges (input ⊢ output) |
| Application | Modus ponens | Composition |

## Open Questions

1. **Exact syntax for ABSTRACT vs UNIFY**: How do we mark which variables are abstracted vs need solving?

2. **Scope rules**: How exactly do right sides access variables from left sides?

3. **Evaluation order**: When does reduction happen? How do we distinguish "evaluate" from "keep as data"?

4. **Composition mechanics**: When node A is composed with node B, how exactly do A's holes get filled by B?

## Example Sketch

```
// A function: λx. x + 1
addOne = {
  (ABSTRACT, x),           // x is a parameter (hole to be filled)
  (BODY, plusExpr)
}

plusExpr = {
  (PLUS_LEFT, x),          // References x from parent scope
  (PLUS_RIGHT, 1)
}

// Application: addOne(5)
// Compose addOne with a node providing x=5
// Result: body evaluates with x=5, produces 6
```

## Related Documents

- `core-graph-semantics.md` - Node structure, primitives
- `categorical-foundations.md` - Variables as projections
- `equality-and-binding.md` - How binding works
