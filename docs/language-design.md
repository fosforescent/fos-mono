# Fosforescent Language Design

## Overview

Fosforescent is a **dependently-typed, modal, datalog-like language** for distributed collaborative workflows. It combines:

- **Dependent Types**: Types that depend on values (e.g., `Task<"description">`)
- **Patterns as Types**: Types are sets of graph patterns, enabling query-based type checking
- **Modal Types**: Modalities provided by actors gate permissions and capabilities
- **Algebraic Effects**: Side effects handled by registered actors
- **Partial Evaluation**: Expressions that can't be satisfied become service endpoints
- **HoTT Foundations**: Variable binding uses equality types with reflexivity proofs

The language runs as a **persistent service** that exposes endpoints for unsatisfied expressions and accepts events to fulfill them.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Type System](#2-type-system)
3. [Modal Types and Permissions](#3-modal-types-and-permissions)
4. [Expressions and Evaluation](#4-expressions-and-evaluation)
5. [Partial Evaluation and Holes](#5-partial-evaluation-and-holes)
6. [Scopes and Binding](#6-scopes-and-binding)
7. [Actors and Effects](#7-actors-and-effects)
8. [Service Model](#8-service-model)
9. [Graph Representation](#9-graph-representation)
10. [Implementation Notes](#10-implementation-notes)

---

## 1. Core Concepts

### 1.1 Everything is a Graph Node

All data in Fosforescent is stored as **content-addressed graph nodes**:

```
Node = {
  data: NodeData,           // Metadata (description, timestamps, etc.)
  children: [Edge, ...]     // List of edges to other nodes
}

Edge = [InstructionCID, TargetCID]   // Instruction-target pairs

CID = SHA3-256(Node)        // Content identifier (hash of content)
```

This provides:
- **Immutability**: Nodes never change; mutations create new nodes
- **Deduplication**: Identical content has identical CID
- **Integrity**: Content tampering is detectable
- **Distribution**: Nodes can be shared by CID

### 1.2 Expressions = Instruction + Target

An expression is a pair of nodes:

```
Expression = (Instruction, Target)

- Instruction: "what to do" / the type/operation
- Target: "what to do it to" / the data
```

This is analogous to function application in lambda calculus, but reified as data.

### 1.3 Tasks as Typed Expressions

A task is an expression of type `Task<description>`:

```
Task<"make lasagna"> = AllOf [
  Task<"make white sauce">,
  Task<"make red sauce">,
  Task<"precook pasta">,
  Task<"assemble layers">
]
```

Tasks are **dependent types** - the type includes the task description as a parameter.

---

## 2. Type System

### 2.1 Types as Patterns

A type is defined by a **set of graph patterns**. A value has a type if it matches all patterns in the set.

```
Type = { Pattern, Pattern, ... }

Pattern = Node structure with wildcards (Unit nodes)
```

Type checking = Pattern matching = Query execution

This unifies:
- Type checking (does this value match the pattern?)
- Querying (find all values matching the pattern)
- Constraint satisfaction (find values satisfying multiple patterns)

### 2.2 Dependent Types

Types can depend on values:

```
Task<D: String> = {
  instruction: AllOf,
  target: {
    has_edge: [Name, D]
  }
}
```

The type `Task<"make lasagna">` is different from `Task<"wash dishes">` - they are distinct types parameterized by the description string.

### 2.3 Type Constructors

#### Primitive Types

```
Terminal    - The empty/void type (no values)
Unit        - The universal type (all values) / wildcard in patterns
String      - External string data
Number      - External numeric data
Boolean     - True | False
```

#### Compound Types

```
AllOf<T...>     - Product type / conjunction / "all of these"
OneOf<T...>     - Sum type / disjunction / "one of these"
List<T>         - Sequence of T
```

#### Dependent Types

```
Task<D: String>           - Task with description D
Pi<A, B(x)>               - Dependent function: (x: A) -> B(x)
Sigma<A, B(x)>            - Dependent pair: (x: A, B(x))
Eq<A, x, y>               - Equality type: x =_A y
```

### 2.4 Type Universes

Types themselves have types (universes):

```
Type₀ : Type₁ : Type₂ : ...

Values : Type₀
Types  : Type₁
Kinds  : Type₂
```

---

## 3. Modal Types and Permissions

### 3.1 Modalities

A **modality** is a context that gates what operations are available. Modalities form a preorder (reflexive, transitive).

```
□_m A    - "A is available in modality m"
◇_m A    - "A is possible in modality m"
```

### 3.2 Actor-Provided Modalities

Actors **provide modalities** when they register:

```
ActorRegistration = {
  actorId: String,
  capabilities: [EffectType, ...],
  modalities: [Modality, ...],     // Modalities this actor provides
  connectionInfo: ConnectionInfo
}
```

When an actor is connected, its modalities become available. When disconnected, those modalities are unavailable.

### 3.3 Modality Examples

```
@backend       - Backend server is connected
@authenticated - User is authenticated
@admin         - User has admin role
@paid          - User has paid subscription
@offline       - Operating in offline mode
@local         - Local execution only (no network)
```

### 3.4 Permission Gating

Operations require certain modalities:

```
persist : □_@backend (Graph -> IO Unit)
aiInfer : □_@backend □_@paid (Prompt -> IO Response)
localCache : □_@local (Graph -> IO Unit)
```

- `persist` requires the `@backend` modality
- `aiInfer` requires both `@backend` AND `@paid`
- `localCache` works with just `@local`

### 3.5 Modality Composition

Modalities can be composed:

```
@backend ∧ @authenticated    - Both required
@backend ∨ @local            - Either sufficient
@admin ⊃ @authenticated      - Admin implies authenticated
```

### 3.6 Modal Type Rules

```
Introduction:
  Γ, m ⊢ e : A
  ─────────────────
  Γ ⊢ box_m e : □_m A

Elimination:
  Γ ⊢ e : □_m A    m available
  ────────────────────────────
  Γ ⊢ unbox_m e : A
```

When a required modality is unavailable, the expression becomes a **hole** waiting for that modality.

---

## 4. Expressions and Evaluation

### 4.1 Expression Structure

```typescript
Expression = {
  instruction: Node,      // The operation/type
  target: Node,           // The operand/data
  route: Path,            // Path from root to this expression
  scope: Scope            // Lexical scope with bindings
}
```

### 4.2 Evaluation Semantics

Evaluation proceeds by **term graph rewriting**:

1. Pattern match the instruction against known rewrite rules
2. If a rule matches, apply the rewrite to produce a new expression
3. If no rule matches and the expression is well-typed, it's in normal form
4. If no rule matches and the expression is ill-typed, create a **hole**

### 4.3 Evaluation Order

Evaluation is **lazy** by default:
- Expressions are only evaluated when their value is needed
- This enables infinite structures and demand-driven computation

For tasks, evaluation can be **eager** when explicitly triggered:
- User clicks "Run" on a task
- Scheduled trigger fires
- Dependency resolution requires the value

### 4.4 Effects During Evaluation

When evaluation encounters an effect:

1. Create an **Effect node** describing the side effect
2. Find an actor that can handle the effect type
3. Check that required modalities are available
4. If modalities unavailable, create a hole
5. If available, send effect to actor and await result
6. Continue evaluation with result

---

## 5. Partial Evaluation and Holes

### 5.1 What is a Hole?

A **hole** is an expression that cannot proceed because:
- A required value is missing
- A required type cannot be satisfied
- A required modality is unavailable
- An effect has no registered handler

```typescript
Hole = {
  expectedType: Type,       // What type can fill this hole
  requiredModalities: [Modality, ...],  // What modalities are needed
  path: Path,               // Location in the expression tree
  endpointId: String,       // Unique ID for the service endpoint
  continuation: Continuation // What to do when filled
}
```

### 5.2 Hole Creation

Holes are created during evaluation:

```
evaluate(expr) =
  if wellTyped(expr) and canReduce(expr):
    evaluate(reduce(expr))
  elif wellTyped(expr) and inNormalForm(expr):
    expr  // Done
  elif missingValue(expr):
    Hole { expectedType: inferType(expr), ... }
  elif missingModality(expr, m):
    Hole { requiredModalities: [m], ... }
  else:
    TypeError
```

### 5.3 Holes Become Endpoints

Each hole becomes a service endpoint:

```
Hole { endpointId: "abc123", expectedType: Task<String>, ... }

  ↓ generates

POST /api/fulfill/abc123
  Body: { value: <task data> }
  Validates: value matches Task<String>
  Effect: fills hole, continues evaluation
```

### 5.4 Filling Holes

When a hole is filled:

1. Validate the provided value against `expectedType`
2. Substitute the value for the hole in the expression
3. Resume evaluation from that point
4. This may produce new holes or complete evaluation

```typescript
fill(hole: Hole, value: Node): Expression {
  if (!matchesType(value, hole.expectedType)) {
    throw TypeError
  }
  return hole.continuation.apply(value)
}
```

---

## 6. Scopes and Binding

### 6.1 Lexical Scopes

Scopes are nested contexts that hold bindings:

```
Scope = {
  bindings: Map<Symbol, Binding>,
  parent: Scope | null,
  modalities: Set<Modality>    // Available modalities in this scope
}
```

### 6.2 Bindings via HoTT Equality

Variable binding uses **equality types** from Homotopy Type Theory:

```
"x = v" in scope S

  ↓ desugars to

Binding {
  symbol: Symbol("x"),
  value: v,
  proof: Refl(v)    // Proof that v = v
}
```

The `Refl` constructor is the canonical proof of reflexivity: any value equals itself.

### 6.3 Why HoTT Equality?

Using equality types for binding provides:

1. **Principled semantics**: Binding is a logical statement, not an imperative operation
2. **Substitution**: If `x = v`, then `x` and `v` are interchangeable (transport)
3. **Proof relevance**: The equality proof can carry computational content
4. **Unification**: Pattern matching unifies terms via equality

### 6.4 Scope Resolution

Looking up a variable:

```
lookup(scope, symbol) =
  if symbol in scope.bindings:
    return scope.bindings[symbol]
  elif scope.parent != null:
    return lookup(scope.parent, symbol)
  else:
    return Hole { expectedType: Any, ... }  // Unbound variable = hole
```

### 6.5 Scoped Rules (Datalog-style)

Beyond simple bindings, scopes can contain **rules**:

```
Rule = {
  head: Pattern,      // What this rule produces
  body: [Pattern, ...], // What this rule requires
  action: Expression  // How to produce the head from the body
}
```

Rules enable datalog-style inference within a scope.

---

## 7. Actors and Effects

### 7.1 What is an Actor?

An **actor** is an external entity that:
- Registers with the system
- Advertises capabilities (effect types it can handle)
- Advertises modalities it provides
- Processes effect requests and returns results

```typescript
Actor = {
  id: String,
  capabilities: Set<EffectType>,
  modalities: Set<Modality>,
  connection: Connection
}
```

### 7.2 Effect Types

Effects are **typed descriptions of side effects**:

```typescript
EffectType =
  | 'persist'           // Save to storage
  | 'fetch'             // HTTP request
  | 'ai:inference'      // AI model call
  | 'ai:embedding'      // Generate embedding
  | 'temporal:submit'   // Submit workflow
  | 'notify'            // Send notification
  | 'prompt'            // Request user input
  | 'log'               // Logging
  | CustomEffectType    // Extensible
```

### 7.3 Effect Emission

When evaluation needs a side effect:

```typescript
emit(effect: Effect): Promise<Result> {
  // Find actor that can handle this effect
  const actor = findHandler(effect.type)

  // Check modalities
  for (const m of effect.requiredModalities) {
    if (!actor.modalities.has(m)) {
      return Hole { requiredModalities: [m], ... }
    }
  }

  // Send to actor and await result
  return actor.handle(effect)
}
```

### 7.4 Actor Registration

Actors register when they connect:

```typescript
// Backend registering with frontend
registerActor({
  id: 'backend-primary',
  capabilities: ['persist', 'ai:inference', 'ai:embedding', 'temporal:submit'],
  modalities: ['@backend', '@authenticated', '@paid'],
  connection: { type: 'websocket', url: 'wss://...' }
})
```

### 7.5 Effect Routing

When multiple actors can handle an effect:

```typescript
findHandler(effectType: EffectType): Actor {
  const handlers = actors.filter(a => a.capabilities.has(effectType))

  if (handlers.length === 0) {
    throw NoHandlerError
  }

  // Priority: local > authenticated > any
  return handlers.sort(byPriority)[0]
}
```

---

## 8. Service Model

### 8.1 Program as Service

A Fosforescent program runs as a **persistent service**:

```
┌─────────────────────────────────────────────────────────────┐
│                    FOS SERVICE                               │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Expression  │───▶│  Evaluator   │───▶│    Holes     │  │
│  │    Graph     │    │              │    │  (Endpoints) │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         ▲                   │                   │           │
│         │                   ▼                   ▼           │
│         │            ┌──────────────┐    ┌──────────────┐  │
│         └────────────│   Effects    │    │  REST/WS     │  │
│                      │   (Actors)   │    │  Endpoints   │  │
│                      └──────────────┘    └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Service Lifecycle

1. **Initialize**: Load expression graph, create scope
2. **Evaluate**: Reduce expressions until holes or normal form
3. **Expose**: Generate endpoints for each hole
4. **Listen**: Accept fulfillment events via REST/WebSocket
5. **Continue**: Fill holes, resume evaluation
6. **Repeat**: Steps 3-5 until fully evaluated or terminated

### 8.3 Endpoint Generation

Each hole generates an endpoint:

```typescript
generateEndpoints(holes: Hole[]): Endpoint[] {
  return holes.map(hole => ({
    method: 'POST',
    path: `/api/fulfill/${hole.endpointId}`,
    expectedType: hole.expectedType,
    requiredModalities: hole.requiredModalities,
    handler: (value) => fill(hole, value)
  }))
}
```

### 8.4 Event Handling

Events fulfill holes or provide actor connections:

```typescript
// Fulfillment event
{
  type: 'fulfill',
  endpointId: 'abc123',
  value: { ... },
  proof?: CID  // Optional type proof
}

// Actor registration event
{
  type: 'actor:register',
  actor: ActorRegistration
}

// Actor disconnection event
{
  type: 'actor:disconnect',
  actorId: 'backend-primary'
}
```

### 8.5 Backend as Actor

The backend server registers as an actor with the frontend:

```typescript
// On WebSocket connection
backend.send({
  type: 'actor:register',
  actor: {
    id: 'backend',
    capabilities: ['persist', 'ai:inference', 'fetch', 'temporal:submit'],
    modalities: ['@backend', '@authenticated'],
    connection: { type: 'local' }  // Already connected
  }
})
```

### 8.6 Frontend Service

The frontend also runs as a service:

```typescript
// Frontend actors (capabilities)
const uiActor: Actor = {
  id: 'ui',
  capabilities: ['prompt', 'notify', 'render'],
  modalities: ['@local', '@ui'],
  connection: { type: 'local' }
}

// UI events become fulfillment events
onClick(taskId) {
  service.fulfill(taskId, { completed: true })
}
```

---

## 9. Graph Representation

### 9.1 Type Nodes

```
TYPE node:
├── [PATTERN, pattern1_cid]     // Defining patterns
├── [PATTERN, pattern2_cid]
└── [PARAM, param_type_cid]     // For dependent types
```

### 9.2 Expression Nodes

```
EXPRESSION node:
├── [INSTRUCTION, instruction_cid]
├── [TARGET, target_cid]
└── [SCOPE, scope_cid]
```

### 9.3 Hole Nodes

```
HOLE node:
├── [TYPE, expected_type_cid]
├── [MODALITY, required_modality_cid]  // Multiple allowed
├── [CONTINUATION, continuation_cid]
└── data: { endpointId, path, createdAt }
```

### 9.4 Scope Nodes

```
SCOPE node:
├── [BINDING, binding1_cid]
├── [BINDING, binding2_cid]
├── [RULE, rule1_cid]
├── [PARENT, parent_scope_cid]
├── [MODALITY, available_modality_cid]
└── data: { scopeId }
```

### 9.5 Binding Nodes (HoTT Equality)

```
BINDING node:
├── [SYMBOL, symbol_cid]
├── [VALUE, value_cid]
├── [EQ_TYPE, equality_type_cid]    // x =_A v
└── [PROOF, refl_cid]               // refl(v)
```

### 9.6 Modal Nodes

```
BOX node (□_m A):
├── [MODALITY, m_cid]
├── [CONTENT, a_cid]
└── data: { modalityName }

DIAMOND node (◇_m A):
├── [MODALITY, m_cid]
├── [CONTENT, a_cid]
└── data: { modalityName }
```

### 9.7 Actor Registration Nodes

```
ACTOR node:
├── [CAPABILITY, effect_type1_cid]
├── [CAPABILITY, effect_type2_cid]
├── [PROVIDES_MODALITY, modality1_cid]
├── [PROVIDES_MODALITY, modality2_cid]
├── [CONNECTION, connection_info_cid]
└── data: { actorId, priority }
```

### 9.8 Mutable Scopes (Aliases)

```
ALIAS node (mutable reference):
├── [TARGET_PTR, current_value_cid]
├── [INSTRUCTION_PTR, current_type_cid]
├── [PREVIOUS, previous_alias_cid]    // Version history
└── data: { aliasId, version }
```

---

## 10. Implementation Notes

### 10.1 New Primitives Required

```typescript
// Type system
TYPE, PI, SIGMA, EQ, REFL, SYMBOL

// Holes
HOLE, CONTINUATION

// Modalities
BOX, DIAMOND, MODALITY

// Scopes
SCOPE, BINDING, RULE

// Actors
ACTOR, CAPABILITY, PROVIDES_MODALITY, CONNECTION
```

### 10.2 Store Extensions

```typescript
class FosStore {
  // Existing...

  // Type checking via pattern matching
  checkType(value: Node, type: Node): boolean
  inferType(expr: Expression): Node

  // Scope management
  createScope(parent?: Scope): Scope
  lookup(scope: Scope, symbol: Symbol): Node | Hole
  bind(scope: Scope, symbol: Symbol, value: Node): Scope

  // Modal logic
  availableModalities(): Set<Modality>
  requireModality(m: Modality): void | Hole

  // Actor registry
  registerActor(actor: Actor): void
  findHandler(effectType: EffectType): Actor | null
  emitEffect(effect: Effect): Promise<Node | Hole>

  // Service model
  evaluate(): { result: Node, holes: Hole[] }
  generateEndpoints(holes: Hole[]): Endpoint[]
  fill(endpointId: string, value: Node): void
}
```

### 10.3 Interpreter Extensions

```typescript
class FosInterpreter {
  // Existing...

  // Partial evaluation
  evaluatePartial(): { expr: Expression, holes: Hole[] }

  // Hole management
  createHole(type: Type, modalities: Modality[]): Hole
  fillHole(hole: Hole, value: Node): Expression

  // Effect handling
  handleEffect(effect: Effect): Promise<Node | Hole>

  // Modal checking
  checkModality(required: Modality): boolean
  withModality<T>(m: Modality, f: () => T): T | Hole
}
```

### 10.4 Service Layer

```typescript
class FosService {
  store: FosStore
  interpreter: FosInterpreter
  holes: Map<string, Hole>
  endpoints: Map<string, Endpoint>
  actors: Map<string, Actor>

  // Lifecycle
  initialize(graph: Node): void
  evaluate(): void

  // Endpoints
  exposeEndpoints(): Endpoint[]
  handleRequest(endpointId: string, value: Node): void

  // Actors
  registerActor(actor: Actor): void
  disconnectActor(actorId: string): void

  // Events
  handleEvent(event: Event): void
}
```

### 10.5 REST API

```
POST   /api/fulfill/:endpointId    - Fill a hole
GET    /api/holes                  - List all holes
GET    /api/holes/:id              - Get hole details
GET    /api/state                  - Get current evaluation state
POST   /api/actors                 - Register actor
DELETE /api/actors/:id             - Disconnect actor
GET    /api/modalities             - List available modalities
```

### 10.6 WebSocket Events

```typescript
// Client -> Server
{ type: 'fulfill', endpointId, value }
{ type: 'actor:register', actor }
{ type: 'actor:disconnect', actorId }
{ type: 'subscribe', path }

// Server -> Client
{ type: 'state:update', state }
{ type: 'hole:created', hole }
{ type: 'hole:filled', endpointId }
{ type: 'modality:available', modality }
{ type: 'modality:unavailable', modality }
{ type: 'evaluation:complete', result }
```

---

## Appendix A: Example - Task Workflow

```
// Define a task
let makeBreakfast = Task<"make breakfast"> {
  AllOf [
    Task<"make coffee"> { ... },
    Task<"make toast"> {
      requires: @kitchen,  // Modal requirement
      AllOf [
        Task<"get bread">,
        Task<"toast bread"> { effect: Toast }
      ]
    }
  ]
}

// Evaluate
evaluate(makeBreakfast)
  // If @kitchen modality unavailable:
  → Hole {
      expectedType: Task<"make toast">,
      requiredModalities: [@kitchen],
      endpointId: "xyz789"
    }

// Later, @kitchen becomes available (actor connects)
registerActor({ modalities: [@kitchen], ... })
  → Evaluation resumes
  → Task<"toast bread"> emits Toast effect
  → Actor handles effect
  → Task completes
```

## Appendix B: Example - Modal Permissions

```
// Define permission-gated operations
adminDelete : □_@admin (User -> IO Unit)
userRead : □_@authenticated (UserId -> IO User)
publicView : (ItemId -> IO Item)  // No modality required

// Usage
let deleteUser = \u -> unbox_@admin (adminDelete u)

// If @admin not available:
evaluate(deleteUser someUser)
  → Hole { requiredModalities: [@admin] }

// With @admin available:
evaluate(deleteUser someUser)
  → IO Unit (deletion succeeds)
```

## Appendix C: Related Work

- **Datalog**: Pattern-based queries, rule-based inference
- **Dependent Types**: Coq, Agda, Idris - types depending on values
- **Modal Type Theory**: Pfenning-Davies, spatial/temporal logics
- **Algebraic Effects**: Eff, Koka, OCaml 5 - typed effect handling
- **HoTT**: Homotopy Type Theory - equality types, univalence
- **Actor Model**: Erlang, Akka - distributed message passing
- **Content Addressing**: IPFS, Git - hash-based data identification
