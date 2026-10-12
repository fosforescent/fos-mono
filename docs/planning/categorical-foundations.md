# Categorical Foundations

## Overview

This document explains the category-theoretic foundations of FOS, particularly how variables, holes, and pattern matching work.

## Variables are Projections

In categorical semantics of type theory:

```
Context Γ = {x₁:A₁, x₂:A₂, ...}  ↔  Object (product A₁ × A₂ × ...)

Term Γ ⊢ t : B                   ↔  Morphism Γ → B

Variable x : A in context Γ,x:A  ↔  Projection π₂ : Γ × A → A
```

**Key insight:** A variable is not an object (initial or terminal). It's a **morphism** — specifically, a projection.

## Context Extension and Its Dual

| Operation | Arrow | What it does |
|-----------|-------|--------------|
| **Extend context** | `Γ → Γ × A` | Make room for a variable |
| **Projection (hole)** | `Γ × A → A` | Query/request the variable |
| **Section (binding)** | `Γ → Γ × A` | Provide a specific value |
| **Substitution** | `section ; proj = value` | Composition gives the bound value |

## Holes = Projections = Queries

A **hole** is:
- The projection morphism `π : Γ × A → A`
- The **eliminator** for context extension
- A **query** on the context
- Waiting for a **section** to compose with

```
Hole     = Projection     = Eliminator  = Query     = Pattern match on context
Binding  = Section        = Constructor = Response  = Extend context with value
```

These are **dual operations**.

## Example: Pattern `[3, ...xs]`

For the pattern `[3, ...xs]` where `xs` is a hole:

### Setup

```
cons : A × List A → List A    (constructor)
```

### Step 1: Invert the Constructor

```
cons⁻¹ (partial): NonEmptyList A → A × List A

head = π₁ ∘ cons⁻¹ : NonEmptyList A → A
tail = π₂ ∘ cons⁻¹ : NonEmptyList A → List A
```

### Step 2: Restrict to head = 3 (Pullback)

```
{l : List A | head(l) = 3}  ↪  NonEmptyList A
```

This is a pullback:
```
{head = 3}  ────→  NonEmptyList A
    |                   |
    |                   | head
    v                   v
   {3}      ────→       A
```

### Step 3: The Hole xs

```
xs : {l | head(l) = 3} → List A
xs = tail restricted to this subset
xs = π₂ ∘ cons⁻¹ ∘ inclusion
```

The hole `xs` is:
1. **Invert** the constructor (pattern match)
2. **Check** the first component equals 3 (pullback/fiber)
3. **Project** the second component (the hole extracts this)

### Filling the Hole

When we provide `xs = [4, 5]`:

```
section : Γ → {l | head(l) = 3}
        γ ↦ cons(3, [4,5])
        γ ↦ [3, 4, 5]
```

Composing: `section ; xs = [4, 5]` ✓

## Summary

| Concept | Categorical View |
|---------|------------------|
| Variable | Projection morphism from extended context |
| Hole | Projection composed with partial inverse |
| Binding | Section into the context |
| Pattern match | Invert constructor + project at holes |
| Filling hole | Provide section that composes to give value |

## Initial vs Terminal

- **VOID** (initial): "nothing can satisfy me" — no morphisms out except identity
- **UNIT** (terminal): "I accept anything" — unique morphism from any object
- **HOLE/Variable**: Neither! It's a **morphism**, not an object.

## For Dependent Types (Slices)

In dependent type theory:

```
Type A dependent on Γ  ↔  Object in slice category C/Γ
                          (i.e., a morphism A → Γ)

Variable x : A(Γ)      ↔  The "generic element"
                          = identity in the slice
                          = the projection A → Γ itself
```

The variable is the **universal/generic element** — the identity morphism in the slice category.

## Connection to Effects

This connects to "variables as effects":

```
Unhandled effect  ↔  Projection we haven't provided a section for
Handler           ↔  The section (choosing a specific value)
Continuation      ↔  The rest of the morphism after the projection
```

## Related Documents

- `core-graph-semantics.md` - Graph structure and primitives
- `equality-and-binding.md` - How binding produces equality proofs
- `carrot-dinner-example.md` - Concrete worked example
