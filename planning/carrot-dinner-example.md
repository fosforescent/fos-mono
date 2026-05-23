# Carrot Dinner Example

## Overview

A minimal worked example demonstrating the core FOS evaluation mechanics.

## Task Structure

```
carrot-dinner
└── clean-up
    └── make-dinner (SUM / choice)
        ├── make-dried-carrot
        └── make-grilled-carrot
```

## As Graph Nodes

**Note:** Tasks are `Unit` indexed by description. ONEOF = SUM, ALLOF = PRODUCT.

```typescript
// Leaf tasks - Unit types indexed by description
// Task<"make-dried-carrot"> has one constructor: unit
const driedCarrot = store.create({
  data: { description: { content: "make-dried-carrot" } },
  children: []  // No subtasks - leaf
})

const grilledCarrot = store.create({
  data: { description: { content: "make-grilled-carrot" } },
  children: []
})

// Choice: which carrot? (SUM type / coproduct)
const makeDinner = store.create({
  data: { description: { content: "make-dinner" } },
  children: [
    [SUM, driedCarrot.getId()],    // left injection
    [SUM, grilledCarrot.getId()]   // right injection
  ]
})

// Sequencing (PRODUCT type / dependency)
const cleanUp = store.create({
  data: { description: { content: "clean-up" } },
  children: [
    [PRODUCT, makeDinner.getId()]  // depends on dinner being made
  ]
})

// Root
const carrotDinner = store.create({
  data: { description: { content: "carrot-dinner" } },
  children: [
    [PRODUCT, cleanUp.getId()]
  ]
})
```

## Evaluation Trace

### Step 1: Evaluate `carrot-dinner`

```
carrot-dinner has child: (PRODUCT, clean-up)
  → Need to evaluate clean-up first

clean-up has child: (PRODUCT, make-dinner)
  → Need to evaluate make-dinner first

make-dinner has children: (SUM, dried), (SUM, grilled)
  → SUM type: need to CHOOSE which injection
  → Create UNIT/HOLE at choice point

Result: HOLE {
  type: SUM,
  options: [dried-carrot, grilled-carrot],
  description: "make-dinner"
}
```

### Step 2: User fills hole (chooses grilled)

```
fillHole(hole, grilledCarrot)

// Creates binding with proof:
ctx.set("make-dinner-choice", {
  value: grilledCarrot,
  proof: refl(grilledCarrot)  // Eq choice grilled-carrot
})
```

### Step 3: Re-evaluate with context

```
make-dinner: choice is bound → evaluates to grilled-carrot
  → grilled-carrot is a TASK with no subtasks
  → Create HOLE: "complete make-grilled-carrot?"

Result: HOLE {
  type: TASK,
  description: "make-grilled-carrot"
}
```

### Step 4: User completes task

```
fillHole(hole, unit)  // "I did it"

// Creates binding with proof:
ctx.set("make-grilled-carrot", {
  value: unit,
  proof: refl(unit)  // Eq task-result unit
})
```

### Step 5: Continue evaluation

```
make-dinner: DONE (grilled-carrot completed)
clean-up: dependency satisfied, but clean-up itself is a TASK
  → Create HOLE: "complete clean-up?"

... user completes ...

carrot-dinner: all dependencies satisfied
  → DONE
```

## The Core Loop

```
evaluate → HOLES → fill → evaluate → HOLES → fill → ... → DONE
```

Each step either:
1. **Reduces** (if we have all needed bindings)
2. **Creates a HOLE** (if we need input)

## Minimal Code Sketch

```typescript
function evaluate(
  node: FosNode,
  ctx: SubstitutionContext
): { result: FosNode | null, holes: Hole[] } {
  const holes: Hole[] = []

  // SUM type (coproduct / choice)
  const sumEdges = node.getEdges().filter(([l, r]) => l === SUM_CID)
  if (sumEdges.length > 0) {
    const choiceKey = `sum:${node.getId()}`
    if (ctx.has(choiceKey)) {
      // Choice made - evaluate chosen branch
      const chosen = ctx.get(choiceKey)!.value
      return evaluate(chosen, ctx)
    } else {
      // Need choice - create hole
      holes.push({
        type: 'sum',
        nodeId: node.getId(),
        options: sumEdges.map(([l, r]) => r)
      })
      return { result: null, holes }
    }
  }

  // PRODUCT type (all dependencies)
  const productEdges = node.getEdges().filter(([l, r]) => l === PRODUCT_CID)
  if (productEdges.length > 0) {
    for (const [_, childId] of productEdges) {
      const child = store.getNodeByAddress(childId)
      const childResult = evaluate(child, ctx)
      holes.push(...childResult.holes)
    }
    if (holes.length > 0) {
      return { result: null, holes }
    }
    // All components satisfied
  }

  // Leaf: Task<D> = Unit indexed by D
  const taskKey = `unit:${node.getId()}`
  if (!ctx.has(taskKey)) {
    holes.push({
      type: 'unit',
      nodeId: node.getId(),
      description: node.getData().description?.content
    })
    return { result: null, holes }
  }

  // Task completed
  return { result: ctx.get(taskKey)!.value, holes: [] }
}
```

## What This Demonstrates

| Concept | How It Appears |
|---------|----------------|
| **Task<D> = Unit indexed by D** | Leaf tasks are unit types parameterized by description |
| **SUM = choice** | Coproduct creates holes for injection selection |
| **PRODUCT = dependencies** | Product requires all components satisfied |
| **HOLE = UNIT (terminal)** | Holes accept any suitable value |
| **Binding = Proof** | `fillHole` creates refl proof + binding |
| **Evaluation loop** | Reduce until holes, fill holes, repeat |

## The 6 Primitives in Action

| Primitive | Where it appears |
|-----------|------------------|
| VOID | (not shown - would be unsatisfiable task) |
| UNIT | holes waiting for input, task completion values |
| EQ/REFL | bindings when holes are filled |
| SUM | choice between dried/grilled carrot |
| PRODUCT | sequencing (clean-up after dinner) |

## Related Documents

- `core-graph-semantics.md` - Graph structure and primitives
- `categorical-foundations.md` - Variables as projections
- `equality-and-binding.md` - How binding produces proofs
- `shared/mock/example-workflows.ts` - Original lasagna example
