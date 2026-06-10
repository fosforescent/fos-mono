# Core Graph Semantics

## Overview

This document defines the foundational semantics for the FOS graph language. Everything in FOS is represented as content-addressed graph nodes.

## Node Structure

A node is a **set of (left, right) pairs** (edges):

```
Node = { (l₁, r₁), (l₂, r₂), ... }
```

- Empty set `{}` = VOID (the zero node)
- Content address (CID) = hash of the edge set
- Edges are unordered (set semantics)

## Edge Semantics

An edge `(left, right)` represents **context extension**:

- `left` provides context (structure, bindings, constraints)
- `right` lives in that extended context
- `right` can use/reference what `left` provides

This is how terms are composed: the node on the left contains the context, and the right side is composed into that context.

## Types and Terms

**Types and terms live in the same world** (dependent types):

- A **type** is just a term with holes
- Holes enforce constraints on what can fill them
- No fundamental distinction between types and terms in the graph structure
- The difference is in how we USE the graph (see Operations below)

```
Term (fully specified):  (3, 5)
Type (has holes):        (3, _)     -- second component is hole
                         (_, _)     -- any pair
```

## Primitives

### Truly Primitive (6 total)

| Primitive | Category Theory | Description |
|-----------|-----------------|-------------|
| **VOID** | Initial object (0) | Empty set, no terms, `{}` with no edges |
| **UNIT** | Terminal object (1) | Singleton, wildcard in patterns, also = HOLE |
| **EQ** | Equality type | `Eq(a,b)` - propositional equality |
| **REFL** | Equality constructor | `refl(a) : Eq a a` - reflexivity proof |
| **SUM** | Coproduct / Pushout | Disjoint union, "or", Either, choice |
| **PRODUCT** | Product / Pullback | Pairs, "and", tuples, dependencies |

### Derived (not primitive)

| Concept | Derivation |
|---------|------------|
| `Task<D>` | Unit indexed by description D |
| `ONEOF` | = SUM (choice between alternatives) |
| `ALLOF` | = PRODUCT (all must be satisfied) |
| `HOLE` | = UNIT in patterns (wildcard) |

## Operations on Graphs

The "kind" of thing (type, term, pattern, function) is determined by the **operation**, not the graph structure itself:

| Operation | Description |
|-----------|-------------|
| **Compose** | Combine graphs (function application) |
| **Overlay + compare** | Check if shapes match (type checking) |
| **Attach** | Fill holes (instantiation / binding) |
| **Overlay + compare + extract** | Match, extract pieces at holes (pattern matching) |

## Variables as Effects

A key insight: **variables are modeled as effects**, not primitive structure.

- Function type lists all variables it needs as effects
- Handling an effect = binding a variable = passing an argument
- Partial application: handle some effects, residual still needs the rest
- **Functions = expressions with unhandled variable effects**
- **Values = expressions with no unhandled effects**

No special lambda construct needed.

## Eliminators = Inverse of Constructors

Pattern matching runs constructors backwards:

```
x = f(3)     -- construction
3 = f⁻¹(x)   -- destruction (pattern match)
```

- Holes in pattern → extract values
- Values in pattern → assert equality
- Example: `pair(a, b) = p` means `a = left(p)`, `b = right(p)`

Minimal interface:
```
node(left, right)  -- constructor
left(n)            -- destructor (inverse)
right(n)           -- destructor (inverse)
```

## Tasks as Types

A task is just `Unit` indexed by a description:

```
Task<"make dinner"> = Unit parameterized by "make dinner"
```

- The type has one constructor: `unit`
- Completing a task = producing `unit : Task<D>`
- Until completed, the task is a "hole" waiting for a term

## Equality (HoTT-style)

Equality is propositional, using reflexivity:

- `Eq a b` is a TYPE (the equality/identity type)
- `refl(a) : Eq a a` is a TERM (proof of equality)
- Only constructor is `refl` - works only when both sides are same
- **Binding = Equality proof = Unification result = Cache** (all identical)

See `equality-and-binding.md` for implementation details.

## Arithmetic of Recursive Types

Recursive types have **formal cardinalities** that can be negative, fractional, or complex. These arise from fixpoint equations and enable arithmetic operations for pattern matching.

### List Fixpoint Equation

For `List(A)` where `|A| = a`:

```
List(A) = 1 + A × List(A)
x = 1 + a·x
x = 1/(1-a)
```

| Element Type | a | List CID |
|--------------|---|----------|
| Bit | 2 | -1 |
| Ternary | 3 | -1/2 |
| Unit | 1 | ∞ (undefined) |
| List(Bit) | -1 | 1/2 |

### Constructor and Destructor

**Constructor:** `f(x) = 1 + a·x`

**Destructor (pattern matching):** `f⁻¹(y) = (y - 1) / a`

At the value level:
- **head** = `y mod a` (extract element)
- **tail** = `y div a` (rest of list)

At the type level:
- Destruction **multiplies** by `a` (going from List → Cons cell)
- Construction **divides** by `a` (going from Cons cell → List)

### The 3-Cycle Property

The List operation `f(x) = 1/(1-x)` has **order 3**:

```
f(2) = -1
f(-1) = 1/2
f(1/2) = 2
f(2) = -1  ← cycles back
```

So `f³(x) = x` for all x. This means:

```
List³(Bit) ≅ Bit  (in cardinality)
```

Three levels of "quoting" cycle back to the original.

**Fixed points** (where List(x) = x) are the primitive 6th roots of unity:
```
x = (1 ± i√3)/2 = e^(±iπ/3)
```

### Nested Lists Example

For `List(List(Bit))`:
```
x = 1 + (-1)·x = 1 - x
x = 1/2
```

Constructor: `f(x) = 1 - x`
Destructor: `f⁻¹(y) = 1 - y` (self-inverse!)

The destructor is an **involution** because (-1)² = 1.

### Variables in Lists

When a variable appears at depth d in a list:

```
list_with_var = constant + a^d · $var
```

The coefficient `a^d` is the variable's **positional weight** (like place value).

Multiple variables form **linear polynomials**:
```
constant + a^d₁·$x + a^d₂·$y + ...
```

This connects to polynomial rings: values with variables live in ℤ[x,y,...].

### Polynomial Degree and Function Types

Variable duplication increases polynomial degree:

| Expression | Degree | Type interpretation |
|------------|--------|---------------------|
| $x | 1 | X (the variable's type) |
| $x² | 2 | Bit → X (function from bit) |
| $xⁿ | n | n → X (function from n-element type) |

Polynomial degree = number of arguments being passed.

## Open Questions

1. **How exactly does "right uses left's edges"?**
   - Through holes that match edge labels?
   - Through explicit references?
   - Through unification?

2. **Structural numbering**: Can simple nodes get hierarchical numbers instead of hashes?

3. **Rename instruction/target → left/right**: More neutral terminology.

4. **Variable CIDs**: Should variables be De Bruijn indices (positions in context)?

5. **Complex CIDs**: What do complex-valued cardinalities mean operationally?

## Related Documents

- `equality-and-binding.md` - Detailed equality semantics
- `categorical-foundations.md` - Variables as projections, holes
- `carrot-dinner-example.md` - Concrete worked example
- `docs/language-design.md` - Full language specification
