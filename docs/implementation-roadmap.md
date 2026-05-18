# Fosforescent Implementation Roadmap

This document outlines the concrete implementation steps to realize the language design described in [language-design.md](./language-design.md).

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

### Files to Modify

#### `shared/dag-implementation/primitive-node.ts`

Add new primitive constructors:

```typescript
// Type universe
export const getTypeNode = (store: FosStore) =>
  generateConstructor(store, "TYPE", { description: { content: 'Type Constructor' } }, [])

// Dependent function type: Pi(x:A).B(x)
export const getPiNode = (store: FosStore) =>
  generateConstructor(store, "PI", { description: { content: 'Pi Type Constructor' } }, [])

// Dependent pair type: Sigma(x:A).B(x)
export const getSigmaNode = (store: FosStore) =>
  generateConstructor(store, "SIGMA", { description: { content: 'Sigma Type Constructor' } }, [])

// Equality type: x =_A y
export const getEqNode = (store: FosStore) =>
  generateConstructor(store, "EQ", { description: { content: 'Equality Type Constructor' } }, [])

// Reflexivity proof: refl(x) : x = x
export const getReflNode = (store: FosStore) =>
  generateConstructor(store, "REFL", { description: { content: 'Reflexivity Constructor' } }, [])

// Symbol/identifier
export const getSymbolNode = (store: FosStore) =>
  generateConstructor(store, "SYMBOL", { description: { content: 'Symbol Constructor' } }, [])

// Hole (unsatisfied expression)
export const getHoleNode = (store: FosStore) =>
  generateConstructor(store, "HOLE", { description: { content: 'Hole Constructor' } }, [])

// Continuation
export const getContinuationNode = (store: FosStore) =>
  generateConstructor(store, "CONTINUATION", { description: { content: 'Continuation Constructor' } }, [])

// Scope
export const getScopeNode = (store: FosStore) =>
  generateConstructor(store, "SCOPE", { description: { content: 'Scope Constructor' } }, [])

// Binding (in scope)
export const getBindingNode = (store: FosStore) =>
  generateConstructor(store, "BINDING", { description: { content: 'Binding Constructor' } }, [])

// Rule (datalog-style rule in scope)
export const getRuleNode = (store: FosStore) =>
  generateConstructor(store, "RULE", { description: { content: 'Rule Constructor' } }, [])

// Modal box: □_m A
export const getBoxNode = (store: FosStore) =>
  generateConstructor(store, "BOX", { description: { content: 'Modal Box Constructor' } }, [])

// Modal diamond: ◇_m A
export const getDiamondNode = (store: FosStore) =>
  generateConstructor(store, "DIAMOND", { description: { content: 'Modal Diamond Constructor' } }, [])

// Modality
export const getModalityNode = (store: FosStore) =>
  generateConstructor(store, "MODALITY", { description: { content: 'Modality Constructor' } }, [])

// Actor
export const getActorNode = (store: FosStore) =>
  generateConstructor(store, "ACTOR", { description: { content: 'Actor Constructor' } }, [])

// Capability (effect type an actor can handle)
export const getCapabilityNode = (store: FosStore) =>
  generateConstructor(store, "CAPABILITY", { description: { content: 'Capability Constructor' } }, [])

// Effect
export const getEffectNode = (store: FosStore) =>
  generateConstructor(store, "EFFECT", { description: { content: 'Effect Constructor' } }, [])
```

#### `shared/types.ts`

Extend `FosDataContent`:

```typescript
export type FosDataContent = {
  // Existing fields...

  // Type annotations
  typeAnnotation?: {
    typeCid: string           // CID of the type node
    checked: boolean          // Whether type has been verified
    checkedAt?: number
  }

  // Hole data
  hole?: {
    expectedTypeCid: string   // CID of expected type pattern
    requiredModalities: string[]  // CIDs of required modality nodes
    endpointId: string        // Unique endpoint ID
    path: FosPath             // Path to this hole
    continuationCid: string   // CID of continuation node
    createdAt: number
  }

  // Scope data
  scope?: {
    scopeId: string           // Unique scope ID
    parentScopeCid?: string   // CID of parent scope
  }

  // Binding data
  binding?: {
    symbolName: string        // The variable name
    symbolCid: string         // CID of symbol node
    valueCid: string          // CID of bound value
    eqTypeCid: string         // CID of equality type
    proofCid: string          // CID of refl proof
  }

  // Modal data
  modal?: {
    modalityName: string      // Name of the modality (e.g., "@backend")
    modalityCid: string       // CID of modality node
  }

  // Actor registration data
  actor?: {
    actorId: string
    capabilities: string[]    // Effect types this actor handles
    modalities: string[]      // Modality names this actor provides
    priority: number          // For handler selection
    connectionType: 'local' | 'http' | 'ws' | 'webrtc'
    connectionEndpoint?: string
  }

  // Effect data
  effect?: {
    effectType: string        // e.g., 'persist', 'ai:inference'
    params: Record<string, unknown>
    requiredModalities: string[]
    requestId: string
  }

  // Continuation data
  continuation?: {
    contextCid: string        // CID of evaluation context
    resumePointCid: string    // Where to resume
  }
}
```

#### `shared/dag-implementation/primitive-node.ts` - `constructPrimitiveAliases`

Add to the returned object:

```typescript
export const constructPrimitiveAliases = (store: FosStore) => {
  // Existing...

  // New type system primitives
  const typeNode = getTypeNode(store)
  const piNode = getPiNode(store)
  const sigmaNode = getSigmaNode(store)
  const eqNode = getEqNode(store)
  const reflNode = getReflNode(store)
  const symbolNode = getSymbolNode(store)
  const holeNode = getHoleNode(store)
  const continuationNode = getContinuationNode(store)
  const scopeNode = getScopeNode(store)
  const bindingNode = getBindingNode(store)
  const ruleNode = getRuleNode(store)
  const boxNode = getBoxNode(store)
  const diamondNode = getDiamondNode(store)
  const modalityNode = getModalityNode(store)
  const actorNode = getActorNode(store)
  const capabilityNode = getCapabilityNode(store)
  const effectNode = getEffectNode(store)

  return {
    // Existing...

    // Type system
    typeNode,
    piNode,
    sigmaNode,
    eqNode,
    reflNode,
    symbolNode,
    holeNode,
    continuationNode,
    scopeNode,
    bindingNode,
    ruleNode,
    boxNode,
    diamondNode,
    modalityNode,
    actorNode,
    capabilityNode,
    effectNode,
  }
}
```

### Tests

Create `shared/dag-implementation/__tests__/type-primitives.test.ts`:

```typescript
describe('Type Primitives', () => {
  it('creates type nodes with correct structure', () => {
    const store = new FosStore()
    expect(store.primitive.typeNode).toBeDefined()
    expect(store.primitive.piNode).toBeDefined()
    // ...
  })

  it('type nodes have unique CIDs', () => {
    const store = new FosStore()
    const cids = new Set([
      store.primitive.typeNode.getId(),
      store.primitive.piNode.getId(),
      store.primitive.sigmaNode.getId(),
    ])
    expect(cids.size).toBe(3)
  })
})
```

---

## Phase 2: Pattern-Based Type Checking

### Goal
Extend pattern matching to serve as type checking.

### Files to Modify

#### `shared/dag-implementation/store.ts`

Add type checking methods:

```typescript
class FosStore {
  // Existing...

  /**
   * Check if a value matches a type (pattern)
   */
  checkType(value: FosNode, type: FosNode): boolean {
    try {
      this.matchPattern(type, value)
      return true
    } catch (e) {
      return false
    }
  }

  /**
   * Infer the type of an expression
   * Returns the most specific type pattern that matches
   */
  inferType(expr: FosExpression): FosNode {
    const instruction = this.getNodeByAddress(expr.instructionNode.getId())
    const target = this.getNodeByAddress(expr.targetNode.getId())

    // Check against known type constructors
    if (instruction.getId() === this.primitive.allOfNode.getId()) {
      return this.createTaskType(target)
    }

    if (instruction.getId() === this.primitive.piNode.getId()) {
      return this.createFunctionType(target)
    }

    // Default: return Unit (matches anything)
    return this.primitive.unit
  }

  /**
   * Create a Task type parameterized by description
   */
  createTaskType(target: FosNode): FosNode {
    const nameEdge = target.getEdges().find(
      ([inst, _]) => inst === this.primitive.nameField.getId()
    )

    if (!nameEdge) {
      // Task without name - general Task type
      return this.create({
        data: { description: { content: 'Task<_>' } },
        children: [
          [this.primitive.typeNode.getId(), this.primitive.allOfNode.getId()]
        ]
      })
    }

    // Task with specific name - dependent type
    const [_, nameCid] = nameEdge
    return this.create({
      data: { description: { content: `Task<${nameCid.slice(-8)}>` } },
      children: [
        [this.primitive.typeNode.getId(), this.primitive.allOfNode.getId()],
        [this.primitive.nameField.getId(), nameCid]
      ]
    })
  }

  /**
   * Check type annotation and return whether valid
   */
  validateTypeAnnotation(node: FosNode): { valid: boolean, error?: string } {
    const annotation = node.getData().typeAnnotation
    if (!annotation) {
      return { valid: true }  // No annotation = no constraint
    }

    const typeNode = this.getNodeByAddress(annotation.typeCid)
    if (!typeNode) {
      return { valid: false, error: `Type ${annotation.typeCid} not found` }
    }

    if (this.checkType(node, typeNode)) {
      return { valid: true }
    } else {
      return { valid: false, error: `Value does not match type ${annotation.typeCid}` }
    }
  }
}
```

#### `shared/dag-types.ts`

Add type-related interfaces:

```typescript
export interface ITypeChecker {
  checkType(value: INode, type: INode): boolean
  inferType(expr: IFosInterpreter): INode
  validateTypeAnnotation(node: INode): { valid: boolean, error?: string }
}

export interface ITypedExpression extends IFosInterpreter {
  getType(): INode
  hasTypeAnnotation(): boolean
  getTypeAnnotation(): INode | null
  setTypeAnnotation(type: INode): ITypedExpression
}
```

---

## Phase 3: Scopes and Binding

### Goal
Implement lexical scopes with HoTT-style variable binding.

### New File: `shared/dag-implementation/scope.ts`

```typescript
import { FosNode } from './node'
import { FosStore } from './store'
import { FosPath } from '../types'

export interface Binding {
  symbol: FosNode       // The symbol node
  symbolName: string    // The name as string
  value: FosNode        // The bound value
  eqType: FosNode       // The equality type node
  proof: FosNode        // The refl proof node
}

export class FosScope {
  readonly id: string
  readonly node: FosNode

  constructor(
    private store: FosStore,
    private bindings: Map<string, Binding> = new Map(),
    private rules: FosNode[] = [],
    private parent: FosScope | null = null,
    private modalities: Set<string> = new Set()
  ) {
    this.id = crypto.randomUUID()
    this.node = this.createScopeNode()
  }

  private createScopeNode(): FosNode {
    const bindingEdges = [...this.bindings.values()].map(b =>
      [this.store.primitive.bindingNode.getId(), this.createBindingNode(b).getId()] as [string, string]
    )

    const ruleEdges = this.rules.map(r =>
      [this.store.primitive.ruleNode.getId(), r.getId()] as [string, string]
    )

    const modalityEdges = [...this.modalities].map(m =>
      [this.store.primitive.modalityNode.getId(), this.store.create({ data: { modal: { modalityName: m, modalityCid: '' } }, children: [] }).getId()] as [string, string]
    )

    const parentEdge = this.parent
      ? [[this.store.primitive.scopeNode.getId(), this.parent.node.getId()] as [string, string]]
      : []

    return this.store.create({
      data: { scope: { scopeId: this.id, parentScopeCid: this.parent?.node.getId() } },
      children: [...bindingEdges, ...ruleEdges, ...modalityEdges, ...parentEdge]
    })
  }

  private createBindingNode(binding: Binding): FosNode {
    return this.store.create({
      data: {
        binding: {
          symbolName: binding.symbolName,
          symbolCid: binding.symbol.getId(),
          valueCid: binding.value.getId(),
          eqTypeCid: binding.eqType.getId(),
          proofCid: binding.proof.getId()
        }
      },
      children: [
        [this.store.primitive.symbolNode.getId(), binding.symbol.getId()],
        [this.store.primitive.terminal.getId(), binding.value.getId()],
        [this.store.primitive.eqNode.getId(), binding.eqType.getId()],
        [this.store.primitive.reflNode.getId(), binding.proof.getId()]
      ]
    })
  }

  /**
   * Bind a symbol to a value in this scope
   * Creates equality type and refl proof
   */
  bind(name: string, value: FosNode): FosScope {
    // Create symbol node
    const symbol = this.store.create({
      data: { description: { content: name } },
      children: []
    })

    // Create equality type: symbol =_Type value
    const valueType = this.store.inferType(new FosExpression(this.store, []))  // Simplified
    const eqType = this.store.create({
      data: { description: { content: `${name} = ${value.getId().slice(-8)}` } },
      children: [
        [this.store.primitive.eqNode.getId(), valueType.getId()],
        [this.store.primitive.terminal.getId(), symbol.getId()],
        [this.store.primitive.terminal.getId(), value.getId()]
      ]
    })

    // Create refl proof
    const proof = this.store.create({
      data: {},
      children: [
        [this.store.primitive.reflNode.getId(), value.getId()]
      ]
    })

    const binding: Binding = { symbol, symbolName: name, value, eqType, proof }

    // Create new scope with this binding added (immutable)
    const newBindings = new Map(this.bindings)
    newBindings.set(name, binding)

    return new FosScope(
      this.store,
      newBindings,
      this.rules,
      this.parent,
      this.modalities
    )
  }

  /**
   * Look up a symbol in this scope and ancestors
   */
  lookup(name: string): FosNode | null {
    const binding = this.bindings.get(name)
    if (binding) {
      return binding.value
    }

    if (this.parent) {
      return this.parent.lookup(name)
    }

    return null
  }

  /**
   * Check if a modality is available in this scope
   */
  hasModality(name: string): boolean {
    if (this.modalities.has(name)) {
      return true
    }

    if (this.parent) {
      return this.parent.hasModality(name)
    }

    return false
  }

  /**
   * Create a child scope
   */
  child(): FosScope {
    return new FosScope(
      this.store,
      new Map(),
      [],
      this,
      new Set()
    )
  }

  /**
   * Add a modality to this scope
   */
  withModality(name: string): FosScope {
    const newModalities = new Set(this.modalities)
    newModalities.add(name)

    return new FosScope(
      this.store,
      this.bindings,
      this.rules,
      this.parent,
      newModalities
    )
  }
}
```

---

## Phase 4: Holes and Partial Evaluation

### Goal
Implement hole creation when expressions can't be satisfied.

### New File: `shared/dag-implementation/hole.ts`

```typescript
import { FosNode } from './node'
import { FosStore } from './store'
import { FosPath } from '../types'
import { FosScope } from './scope'

export interface Hole {
  id: string
  node: FosNode
  expectedType: FosNode
  requiredModalities: string[]
  path: FosPath
  continuation: Continuation
  createdAt: number
}

export interface Continuation {
  scope: FosScope
  resumeNode: FosNode
  apply: (value: FosNode) => FosNode
}

export class HoleManager {
  private holes: Map<string, Hole> = new Map()

  constructor(private store: FosStore) {}

  /**
   * Create a hole for a missing value
   */
  createHole(
    expectedType: FosNode,
    path: FosPath,
    scope: FosScope,
    resumeNode: FosNode
  ): Hole {
    const id = crypto.randomUUID()

    const continuation: Continuation = {
      scope,
      resumeNode,
      apply: (value: FosNode) => {
        // Substitute value into the expression at resumeNode
        return this.substitute(resumeNode, value)
      }
    }

    const continuationNode = this.store.create({
      data: {
        continuation: {
          contextCid: scope.node.getId(),
          resumePointCid: resumeNode.getId()
        }
      },
      children: [
        [this.store.primitive.scopeNode.getId(), scope.node.getId()],
        [this.store.primitive.terminal.getId(), resumeNode.getId()]
      ]
    })

    const holeNode = this.store.create({
      data: {
        hole: {
          expectedTypeCid: expectedType.getId(),
          requiredModalities: [],
          endpointId: id,
          path,
          continuationCid: continuationNode.getId(),
          createdAt: Date.now()
        }
      },
      children: [
        [this.store.primitive.holeNode.getId(), this.store.primitive.terminal.getId()],
        [this.store.primitive.typeNode.getId(), expectedType.getId()],
        [this.store.primitive.continuationNode.getId(), continuationNode.getId()]
      ]
    })

    const hole: Hole = {
      id,
      node: holeNode,
      expectedType,
      requiredModalities: [],
      path,
      continuation,
      createdAt: Date.now()
    }

    this.holes.set(id, hole)
    return hole
  }

  /**
   * Create a hole for a missing modality
   */
  createModalHole(
    requiredModality: string,
    expectedType: FosNode,
    path: FosPath,
    scope: FosScope,
    resumeNode: FosNode
  ): Hole {
    const hole = this.createHole(expectedType, path, scope, resumeNode)
    hole.requiredModalities.push(requiredModality)

    // Update node with modality requirement
    const modalityNode = this.store.create({
      data: { modal: { modalityName: requiredModality, modalityCid: '' } },
      children: []
    })

    const updatedHoleNode = this.store.create({
      data: {
        ...hole.node.getData(),
        hole: {
          ...hole.node.getData().hole!,
          requiredModalities: [requiredModality]
        }
      },
      children: [
        ...hole.node.getEdges(),
        [this.store.primitive.modalityNode.getId(), modalityNode.getId()]
      ]
    })

    hole.node = updatedHoleNode
    return hole
  }

  /**
   * Fill a hole with a value
   */
  fill(holeId: string, value: FosNode): { success: boolean, result?: FosNode, error?: string } {
    const hole = this.holes.get(holeId)
    if (!hole) {
      return { success: false, error: `Hole ${holeId} not found` }
    }

    // Validate value against expected type
    if (!this.store.checkType(value, hole.expectedType)) {
      return {
        success: false,
        error: `Value does not match expected type ${hole.expectedType.getId()}`
      }
    }

    // Apply continuation
    const result = hole.continuation.apply(value)

    // Remove hole
    this.holes.delete(holeId)

    return { success: true, result }
  }

  /**
   * Get all unfilled holes
   */
  getHoles(): Hole[] {
    return [...this.holes.values()]
  }

  /**
   * Get holes requiring a specific modality
   */
  getHolesRequiringModality(modality: string): Hole[] {
    return this.getHoles().filter(h => h.requiredModalities.includes(modality))
  }

  private substitute(node: FosNode, value: FosNode): FosNode {
    // Simple substitution - replace hole reference with value
    // More sophisticated implementation would handle nested holes
    return value
  }
}
```

### Modify: `shared/evaluation/interpreter.ts`

Add partial evaluation support:

```typescript
import { HoleManager, Hole } from '../dag-implementation/hole'
import { FosScope } from '../dag-implementation/scope'

class BaseFosInterpreter {
  protected holeManager: HoleManager
  protected scope: FosScope

  // Existing methods...

  /**
   * Evaluate this expression, potentially producing holes
   */
  evaluatePartial(): { result: IFosInterpreter | null, holes: Hole[] } {
    const holes: Hole[] = []

    try {
      // Attempt full evaluation
      const result = this.evaluate()
      return { result, holes: [] }
    } catch (e) {
      if (e instanceof TypeMismatchError) {
        // Create hole for missing value
        const hole = this.holeManager.createHole(
          e.expectedType,
          this.getPath(),
          this.scope,
          this.target
        )
        holes.push(hole)
        return { result: null, holes }
      }

      if (e instanceof MissingModalityError) {
        // Create hole for missing modality
        const hole = this.holeManager.createModalHole(
          e.requiredModality,
          e.expectedType,
          this.getPath(),
          this.scope,
          this.target
        )
        holes.push(hole)
        return { result: null, holes }
      }

      throw e
    }
  }

  private getPath(): FosPath {
    return this.getStack().map(i => [i.getInstruction(), i.getTarget()] as [string, string])
  }
}

class TypeMismatchError extends Error {
  constructor(
    public expectedType: FosNode,
    public actualValue: FosNode
  ) {
    super(`Type mismatch: expected ${expectedType.getId()}, got ${actualValue.getId()}`)
  }
}

class MissingModalityError extends Error {
  constructor(
    public requiredModality: string,
    public expectedType: FosNode
  ) {
    super(`Missing modality: ${requiredModality}`)
  }
}
```

---

## Phase 5: Modal Types

### Goal
Implement modal types with actor-provided modalities.

### New File: `shared/dag-implementation/modality.ts`

```typescript
import { FosNode } from './node'
import { FosStore } from './store'

export interface Modality {
  name: string
  node: FosNode
  providedBy: string[]  // Actor IDs that provide this modality
}

export class ModalityManager {
  private modalities: Map<string, Modality> = new Map()
  private available: Set<string> = new Set()

  constructor(private store: FosStore) {
    // Initialize built-in modalities
    this.registerModality('@local')  // Always available locally
  }

  /**
   * Register a modality (doesn't make it available)
   */
  registerModality(name: string): Modality {
    if (this.modalities.has(name)) {
      return this.modalities.get(name)!
    }

    const node = this.store.create({
      data: { modal: { modalityName: name, modalityCid: '' } },
      children: [[this.store.primitive.modalityNode.getId(), this.store.primitive.terminal.getId()]]
    })

    const modality: Modality = {
      name,
      node,
      providedBy: []
    }

    this.modalities.set(name, modality)
    return modality
  }

  /**
   * Make a modality available (e.g., when actor connects)
   */
  makeAvailable(name: string, actorId: string): void {
    const modality = this.registerModality(name)
    modality.providedBy.push(actorId)
    this.available.add(name)
  }

  /**
   * Make a modality unavailable (e.g., when actor disconnects)
   */
  makeUnavailable(name: string, actorId: string): void {
    const modality = this.modalities.get(name)
    if (!modality) return

    modality.providedBy = modality.providedBy.filter(id => id !== actorId)

    if (modality.providedBy.length === 0) {
      this.available.delete(name)
    }
  }

  /**
   * Check if a modality is currently available
   */
  isAvailable(name: string): boolean {
    return this.available.has(name)
  }

  /**
   * Get all available modalities
   */
  getAvailable(): string[] {
    return [...this.available]
  }

  /**
   * Create a Box type node: □_m A
   */
  createBox(modality: string, content: FosNode): FosNode {
    const modalityNode = this.registerModality(modality).node

    return this.store.create({
      data: { description: { content: `□_${modality}` } },
      children: [
        [this.store.primitive.boxNode.getId(), this.store.primitive.terminal.getId()],
        [this.store.primitive.modalityNode.getId(), modalityNode.getId()],
        [this.store.primitive.terminal.getId(), content.getId()]
      ]
    })
  }

  /**
   * Attempt to unbox: requires modality to be available
   */
  unbox(boxNode: FosNode): FosNode | null {
    const modalityEdge = boxNode.getEdges().find(
      ([inst, _]) => inst === this.store.primitive.modalityNode.getId()
    )

    if (!modalityEdge) {
      throw new Error('Not a box type')
    }

    const modalityNode = this.store.getNodeByAddress(modalityEdge[1])
    const modalityName = modalityNode.getData().modal?.modalityName

    if (!modalityName || !this.isAvailable(modalityName)) {
      return null  // Modality not available - cannot unbox
    }

    // Return the content
    const contentEdge = boxNode.getEdges().find(
      ([inst, _]) => inst === this.store.primitive.terminal.getId()
    )

    if (!contentEdge) {
      throw new Error('Box has no content')
    }

    return this.store.getNodeByAddress(contentEdge[1])
  }
}
```

---

## Phase 6: Actor Registry and Effects

### Goal
Implement actor registration and effect routing.

### New File: `shared/dag-implementation/actor.ts`

```typescript
import { FosNode } from './node'
import { FosStore } from './store'
import { ModalityManager } from './modality'

export type EffectType =
  | 'persist'
  | 'fetch'
  | 'ai:inference'
  | 'ai:embedding'
  | 'temporal:submit'
  | 'temporal:status'
  | 'notify'
  | 'prompt'
  | 'log'
  | string  // Custom effect types

export interface Actor {
  id: string
  node: FosNode
  capabilities: Set<EffectType>
  modalities: Set<string>
  priority: number
  connection: ActorConnection
}

export type ActorConnection =
  | { type: 'local' }
  | { type: 'http', endpoint: string }
  | { type: 'ws', socket: WebSocket }
  | { type: 'callback', handler: (effect: Effect) => Promise<EffectResult> }

export interface Effect {
  type: EffectType
  params: Record<string, unknown>
  requiredModalities: string[]
  requestId: string
}

export interface EffectResult {
  requestId: string
  success: boolean
  result?: unknown
  error?: string
}

export class ActorRegistry {
  private actors: Map<string, Actor> = new Map()
  private handlers: Map<EffectType, Set<string>> = new Map()  // effectType -> actorIds
  private pendingEffects: Map<string, { effect: Effect, resolve: Function, reject: Function }> = new Map()

  constructor(
    private store: FosStore,
    private modalityManager: ModalityManager
  ) {}

  /**
   * Register an actor
   */
  registerActor(registration: {
    id: string,
    capabilities: EffectType[],
    modalities: string[],
    priority?: number,
    connection: ActorConnection
  }): Actor {
    const node = this.store.create({
      data: {
        actor: {
          actorId: registration.id,
          capabilities: registration.capabilities,
          modalities: registration.modalities,
          priority: registration.priority ?? 0,
          connectionType: registration.connection.type,
          connectionEndpoint: 'endpoint' in registration.connection
            ? registration.connection.endpoint
            : undefined
        }
      },
      children: [
        [this.store.primitive.actorNode.getId(), this.store.primitive.terminal.getId()],
        ...registration.capabilities.map(c =>
          [this.store.primitive.capabilityNode.getId(),
           this.store.create({ data: { description: { content: c } }, children: [] }).getId()] as [string, string]
        ),
        ...registration.modalities.map(m =>
          [this.store.primitive.modalityNode.getId(),
           this.modalityManager.registerModality(m).node.getId()] as [string, string]
        )
      ]
    })

    const actor: Actor = {
      id: registration.id,
      node,
      capabilities: new Set(registration.capabilities),
      modalities: new Set(registration.modalities),
      priority: registration.priority ?? 0,
      connection: registration.connection
    }

    // Register actor
    this.actors.set(actor.id, actor)

    // Register as handler for each capability
    for (const cap of actor.capabilities) {
      if (!this.handlers.has(cap)) {
        this.handlers.set(cap, new Set())
      }
      this.handlers.get(cap)!.add(actor.id)
    }

    // Make modalities available
    for (const mod of actor.modalities) {
      this.modalityManager.makeAvailable(mod, actor.id)
    }

    return actor
  }

  /**
   * Unregister an actor
   */
  unregisterActor(actorId: string): void {
    const actor = this.actors.get(actorId)
    if (!actor) return

    // Remove from handlers
    for (const cap of actor.capabilities) {
      this.handlers.get(cap)?.delete(actorId)
    }

    // Remove modalities
    for (const mod of actor.modalities) {
      this.modalityManager.makeUnavailable(mod, actorId)
    }

    this.actors.delete(actorId)
  }

  /**
   * Find the best actor to handle an effect
   */
  findHandler(effectType: EffectType): Actor | null {
    const handlerIds = this.handlers.get(effectType)
    if (!handlerIds || handlerIds.size === 0) {
      return null
    }

    // Get actors and sort by priority (highest first)
    const actors = [...handlerIds]
      .map(id => this.actors.get(id)!)
      .filter(a => a !== undefined)
      .sort((a, b) => b.priority - a.priority)

    return actors[0] ?? null
  }

  /**
   * Emit an effect and await result
   */
  async emit(effect: Effect): Promise<EffectResult> {
    // Check required modalities
    for (const mod of effect.requiredModalities) {
      if (!this.modalityManager.isAvailable(mod)) {
        return {
          requestId: effect.requestId,
          success: false,
          error: `Required modality ${mod} is not available`
        }
      }
    }

    // Find handler
    const handler = this.findHandler(effect.type)
    if (!handler) {
      return {
        requestId: effect.requestId,
        success: false,
        error: `No handler for effect type ${effect.type}`
      }
    }

    // Send to handler
    return this.sendToActor(handler, effect)
  }

  private async sendToActor(actor: Actor, effect: Effect): Promise<EffectResult> {
    switch (actor.connection.type) {
      case 'local':
        throw new Error('Local actors must use callback connection')

      case 'callback':
        return actor.connection.handler(effect)

      case 'http':
        return this.sendHttp(actor.connection.endpoint, effect)

      case 'ws':
        return this.sendWebSocket(actor.connection.socket, effect)

      default:
        throw new Error(`Unknown connection type`)
    }
  }

  private async sendHttp(endpoint: string, effect: Effect): Promise<EffectResult> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(effect)
    })

    return response.json()
  }

  private sendWebSocket(socket: WebSocket, effect: Effect): Promise<EffectResult> {
    return new Promise((resolve, reject) => {
      this.pendingEffects.set(effect.requestId, { effect, resolve, reject })
      socket.send(JSON.stringify(effect))

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingEffects.has(effect.requestId)) {
          this.pendingEffects.delete(effect.requestId)
          reject(new Error('Effect timeout'))
        }
      }, 30000)
    })
  }

  /**
   * Handle result from WebSocket
   */
  handleResult(result: EffectResult): void {
    const pending = this.pendingEffects.get(result.requestId)
    if (pending) {
      this.pendingEffects.delete(result.requestId)
      pending.resolve(result)
    }
  }
}
```

---

## Phase 7-9: Service Layer, Backend, and Frontend Integration

These phases involve wiring everything together. The key files are:

### New File: `shared/service/fos-service.ts`

```typescript
import { FosStore } from '../dag-implementation/store'
import { HoleManager, Hole } from '../dag-implementation/hole'
import { ActorRegistry, Effect, EffectResult } from '../dag-implementation/actor'
import { ModalityManager } from '../dag-implementation/modality'
import { FosScope } from '../dag-implementation/scope'
import { FosExpression } from '../dag-implementation/expression'

export interface Endpoint {
  id: string
  method: 'POST'
  path: string
  expectedType: string  // CID
  requiredModalities: string[]
}

export class FosService {
  private holeManager: HoleManager
  private actorRegistry: ActorRegistry
  private modalityManager: ModalityManager
  private rootScope: FosScope

  constructor(private store: FosStore) {
    this.modalityManager = new ModalityManager(store)
    this.actorRegistry = new ActorRegistry(store, this.modalityManager)
    this.holeManager = new HoleManager(store)
    this.rootScope = new FosScope(store)
  }

  /**
   * Evaluate the root expression
   */
  evaluate(): { complete: boolean, holes: Hole[] } {
    const rootExpr = this.store.getRootExpression()
    // Evaluation logic that uses holeManager

    const holes = this.holeManager.getHoles()
    return {
      complete: holes.length === 0,
      holes
    }
  }

  /**
   * Generate REST endpoints from holes
   */
  getEndpoints(): Endpoint[] {
    return this.holeManager.getHoles().map(hole => ({
      id: hole.id,
      method: 'POST' as const,
      path: `/api/fulfill/${hole.id}`,
      expectedType: hole.expectedType.getId(),
      requiredModalities: hole.requiredModalities
    }))
  }

  /**
   * Fill a hole
   */
  fulfill(endpointId: string, value: any): { success: boolean, error?: string } {
    const valueNode = this.store.create({
      data: value.data ?? {},
      children: value.children ?? []
    })

    return this.holeManager.fill(endpointId, valueNode)
  }

  /**
   * Register an actor
   */
  registerActor(registration: Parameters<ActorRegistry['registerActor']>[0]) {
    return this.actorRegistry.registerActor(registration)
  }

  /**
   * Emit an effect
   */
  async emitEffect(effect: Effect): Promise<EffectResult> {
    return this.actorRegistry.emit(effect)
  }

  /**
   * Get available modalities
   */
  getModalities(): string[] {
    return this.modalityManager.getAvailable()
  }
}
```

---

## Summary Checklist

### Phase 1: Core Primitives
- [ ] Add TYPE, PI, SIGMA, EQ, REFL, SYMBOL primitives
- [ ] Add HOLE, CONTINUATION primitives
- [ ] Add SCOPE, BINDING, RULE primitives
- [ ] Add BOX, DIAMOND, MODALITY primitives
- [ ] Add ACTOR, CAPABILITY, EFFECT primitives
- [ ] Extend FosDataContent with new fields
- [ ] Update PrimitiveAliases type
- [ ] Write primitive tests

### Phase 2: Type Checking
- [ ] Implement checkType method
- [ ] Implement inferType method
- [ ] Implement validateTypeAnnotation
- [ ] Add ITypeChecker interface
- [ ] Write type checking tests

### Phase 3: Scopes
- [ ] Create FosScope class
- [ ] Implement bind method with HoTT equality
- [ ] Implement lookup method
- [ ] Implement scope nesting
- [ ] Write scope tests

### Phase 4: Holes
- [ ] Create HoleManager class
- [ ] Implement createHole method
- [ ] Implement createModalHole method
- [ ] Implement fill method
- [ ] Add evaluatePartial to interpreter
- [ ] Write hole tests

### Phase 5: Modalities
- [ ] Create ModalityManager class
- [ ] Implement makeAvailable/makeUnavailable
- [ ] Implement createBox/unbox
- [ ] Write modality tests

### Phase 6: Actors
- [ ] Create ActorRegistry class
- [ ] Implement registerActor/unregisterActor
- [ ] Implement findHandler
- [ ] Implement emit method
- [ ] Write actor tests

### Phase 7: Service
- [ ] Create FosService class
- [ ] Implement evaluate method
- [ ] Implement getEndpoints method
- [ ] Implement fulfill method
- [ ] Write service tests

### Phase 8: Backend
- [ ] Add REST endpoints for holes
- [ ] Add WebSocket handlers
- [ ] Register backend as actor
- [ ] Write integration tests

### Phase 9: Frontend
- [ ] Connect to backend via WebSocket
- [ ] Handle hole endpoints
- [ ] Handle modality changes
- [ ] Update UI for partial evaluation
- [ ] Write E2E tests
