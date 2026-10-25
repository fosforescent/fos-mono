/**
 * The kernel surface: one function per semantic question, and the one shape of a primitive. Every other module answers
 * its question by calling one of these; new semantics show up as a change to this file.
 *
 *   What does this reference denote here?     resolveBinding (over the binding layers)
 *   What are this row's operands as values?   compileRefGraph / compileInstructions / compileOperands
 *   Does this value satisfy this pattern?      matchesGraph
 *   When do effects run, and what commits?     evaluateNode (selectExecutor picks the one executor)
 *   How does a value become live?               proposeRefAt → acceptSubmission
 *
 * Before adding a function elsewhere, name the kernel call that performs its semantics. If none does, the change
 * belongs here or in the library, and the pull request says which.
 */
export { resolveBinding } from './bindings'
export { compileRefGraph, compileInstructions } from './ref-compiler'
export { compileOperands, type PrimitiveFunction, type Compiled, type PrimitiveContext, type PrimitiveResult } from './operands'
export { matchesGraph } from './structural'
export { evaluateNode, selectExecutor } from './evaluation'
export { registerPrimitives, restorePrimitives, stepExecutors } from './primitives'
export { proposeRefAt } from './replica'
export { acceptSubmission } from './approvals'
