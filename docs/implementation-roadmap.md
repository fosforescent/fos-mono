# Fosforescent Implementation Roadmap

This document outlines the implementation steps to realize the language design described in [language-design.md](./language-design.md).

---

## Overview

The implementation is divided into phases, each building on the previous:

| Phase | Focus | Dependencies |
|-------|-------|--------------|
| 1 | Core Type Primitives | None |
| 2 | Pattern-Based Type Checking | Phase 1 |
| 3 | Scopes and Binding | Phase 2 |
| 4 | Holes and Partial Evaluation | Phase 3 |
| 5 | Modal Types | Phase 4 |
| 6 | Actor Registry and Effects | Phase 5 |
| 7 | Service Layer | Phase 6 |
| 8 | Backend Integration | Phase 7 |
| 9 | Frontend Integration | Phase 8 |

---

## Phase 1: Core Type Primitives

### Goal
Add fundamental type-related primitive nodes to the graph system.

- TYPE, PI, SIGMA, EQ, REFL, SYMBOL primitives
- HOLE, CONTINUATION primitives
- SCOPE, BINDING, RULE primitives
- BOX, DIAMOND, MODALITY primitives
- ACTOR, CAPABILITY, EFFECT primitives
- Each primitive has a unique CID
- Node data can carry type annotations, hole, scope, binding, modal, actor, effect and continuation data

---

## Phase 2: Pattern-Based Type Checking

### Goal
Extend pattern matching to serve as type checking.

- Check whether a value matches a type (pattern)
- Infer the most specific type pattern that matches an expression
- A task's type is parameterized by its description (dependent type); a task without a name has the general `Task<_>` type
- Validate a node's type annotation; no annotation means no constraint

---

## Phase 3: Scopes and Binding

### Goal
Implement lexical scopes with HoTT-style variable binding.

- Binding a symbol to a value creates an equality type and a refl proof
- Binding is immutable: it yields a new scope with the binding added
- Lookup searches the scope and then its ancestors
- Scopes nest (child scopes) and carry available modalities

---

## Phase 4: Holes and Partial Evaluation

### Goal
Implement hole creation when expressions can't be satisfied.

- Create a hole for a missing value
- Create a hole for a missing modality
- A hole records its expected type, required modalities, path, endpoint id and continuation
- Filling a hole validates the value against the expected type, applies the continuation, and removes the hole
- List unfilled holes, and the holes requiring a given modality
- Partial evaluation returns either a result or the holes it produced

---

## Phase 5: Modal Types

### Goal
Implement modal types with actor-provided modalities.

- `@local` is always available locally
- A modality becomes available when an actor providing it connects, and unavailable when no connected actor provides it
- Boxing content under a modality: `□_m A`
- Unboxing requires the modality to be available

---

## Phase 6: Actor Registry and Effects

### Goal
Implement actor registration and effect routing.

- Register and unregister actors, with their capabilities and modalities; registering makes the actor's modalities available, unregistering withdraws them
- Find the best actor to handle an effect (by priority)
- Emitting an effect checks required modalities, finds a handler, and awaits the result
- Actors connect locally (callback), over HTTP, or over WebSocket

---

## Phase 7-9: Service Layer, Backend, and Frontend Integration

These phases involve wiring everything together.

### Phase 7: Service
- Evaluate the root expression; evaluation is complete when no holes remain
- Generate endpoints from holes (`POST /api/fulfill/:holeId`, with the expected type and required modalities)
- Fulfill holes through endpoints
- Register actors, emit effects, list available modalities

### Phase 8: Backend
- REST endpoints for holes
- WebSocket handlers
- Backend registers as an actor

### Phase 9: Frontend
- Connect to backend via WebSocket
- Handle hole endpoints
- Handle modality changes
- UI for partial evaluation
