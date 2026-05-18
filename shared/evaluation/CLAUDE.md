# Evaluation Module - CLAUDE.md

## Directory Summary

Provides the **expression evaluation system** for Fosforescent, including interpreters, partial evaluation with holes, and the service model that exposes unsatisfied expressions as endpoints.

**Key Design Documents:**
- `../../docs/language-design.md` - Full language specification
- `../../docs/implementation-roadmap.md` - Implementation phases (especially Phase 4)

## Evaluation Model Overview

The evaluation system implements **partial evaluation with algebraic effects**:

1. **Evaluate** an expression by term graph rewriting
2. If a subexpression can't be satisfied, create a **Hole**
3. Holes become **service endpoints** that accept fulfillment events
4. When a hole is filled, **continue evaluation** from that point

```
evaluate(expr) →
  | can reduce       → evaluate(reduce(expr))
  | in normal form   → expr (done)
  | missing value    → Hole { expectedType, endpointId, continuation }
  | missing modality → Hole { requiredModalities, endpointId, continuation }
```

## What Needs to Be Implemented

### Partial Evaluation (`evaluatePartial`)
```typescript
evaluatePartial(): { result: IFosInterpreter | null, holes: Hole[] }
```
- Evaluate as far as possible
- Collect holes for unsatisfied subexpressions
- Return partial result with holes

### Hole Creation
```typescript
createHole(expectedType, path, scope, resumeNode): Hole
createModalHole(requiredModality, expectedType, path, scope, resumeNode): Hole
```

### Hole Filling
```typescript
fill(holeId, value): { success: boolean, result?: FosNode, error?: string }
```
- Validate value against expected type
- Substitute into continuation
- Resume evaluation

### Dependencies
- **../dag-implementation/\***: Core graph components (FosNode, Store, primitive-node)
- **../dag-types**: Type definitions for interpreters and nodes
- **../utils**: Utility functions (assert)
- **xstate**: State machine library for workflow management (commented out/legacy)

### Data Inputs

#### Graph Structures
- **INode**: Graph nodes with addresses and edge relationships
- **IStore**: Graph store containing node collections
- **Instruction-Target Pairs**: Computational relationships between nodes
- **Edge Lists**: [instruction_address, target_address] tuples

#### Evaluation Context
- **Task Descriptions**: String descriptions for created tasks
- **Dependencies**: Arrays of dependent nodes for task creation
- **State Mutations**: Graph mutations during evaluation
- **Path Navigation**: Interpreter stack traversal

### Data Outputs

#### Interpreter Instances
- **BaseFosInterpreter**: Core interpreter for instruction-target evaluation
- **RootFosInterpreter**: Root-level interpreter for graph traversal
- **Interpreter Stacks**: Hierarchical evaluation contexts
- **Child Interpreters**: Spawned interpreters for subtask evaluation

#### Task Management
- **Created Tasks**: New task nodes with descriptions and dependencies
- **Task Hierarchies**: Parent-child task relationships
- **Dependency Resolution**: Ordered task execution based on dependencies
- **Task Reordering**: Dynamic task sequence modification

#### Evaluation Results
- **Computed Values**: Results from expression evaluation
- **State Changes**: Graph mutations from interpreter operations
- **Navigation Paths**: Traversal routes through interpreter hierarchy

### Events Handled
- **Task Creation**: Creating new tasks with dependencies
- **Edge Spawning**: Creating new instruction-target relationships
- **State Mutation**: Updating graph state during evaluation
- **Stack Navigation**: Moving through interpreter hierarchy
- **Edge Reordering**: Rearranging task execution order

### Data Transformations
- **Nodes → Interpreters**: Graph nodes converted to executable interpreters
- **Descriptions → Named Tasks**: String descriptions attached to task nodes
- **Dependencies → Edge Relationships**: Dependency arrays converted to graph edges
- **Evaluation Context → Results**: Interpreter execution producing computed values
- **Stack Operations → Graph Mutations**: Interpreter operations updating graph state

### Core Components

#### BaseFosInterpreter
- **Instruction-Target Pairing**: Links computational instructions with target nodes
- **Edge Management**: Adding and following graph edges
- **Spawning**: Creating child interpreters for subtasks
- **Stack Operations**: Managing interpreter hierarchy
- **Task Creation**: Generating new tasks with dependencies

#### FosClient
- **Client Interface**: High-level API for graph evaluation
- **Root Management**: Managing root interpreter instances
- **Navigation**: Path tracking through interpreter hierarchy
- **View Generation**: Converting interpreter state to client views

#### State Machines
- **Task State Management**: Workflow state transitions
- **OneOf State Logic**: Exclusive choice state handling
- **State Persistence**: Maintaining evaluation state across operations

#### String Client
- **String-based Operations**: Text-based interpreter interface
- **Serialization**: Converting interpreter state to/from strings
- **Debug Support**: Human-readable interpreter representation

### Evaluation Patterns
- **Lazy Evaluation**: Computing values only when needed
- **Hierarchical Execution**: Parent-child interpreter relationships
- **Dependency Resolution**: Ensuring dependencies execute before dependents
- **State Immutability**: Creating new states rather than mutating existing ones
- **Stack-based Navigation**: Using interpreter stacks for context management

### Task Management Features
- **Task Spawning**: Creating new tasks as child interpreters
- **Dependency Tracking**: Managing task prerequisites
- **Name Assignment**: Attaching descriptions to tasks
- **Edge Reordering**: Dynamic task sequence modification
- **Completion Tracking**: Monitoring task completion status

### Error Handling
- **Assertion Checking**: Runtime validation of interpreter state
- **Stack Validation**: Ensuring interpreter hierarchy consistency
- **Edge Validation**: Verifying graph edge integrity
- **Method Implementation**: Ensuring required methods are implemented

## TODOs

### High Priority (Phase 4 of Implementation Roadmap)
- [ ] Add `evaluatePartial()` method to interpreter
- [ ] Implement HoleManager class (new file: `../dag-implementation/hole.ts`)
- [ ] Implement Continuation tracking
- [ ] Add TypeMismatchError and MissingModalityError exceptions
- [ ] Add hole filling with type validation

### Medium Priority
- [ ] Add scope tracking to interpreter
- [ ] Implement effect emission during evaluation
- [ ] Connect to actor registry for effect handling

### Lower Priority
- [ ] Remove legacy XState code
- [ ] Optimize evaluation for large expression trees
- [ ] Add evaluation tracing/debugging support