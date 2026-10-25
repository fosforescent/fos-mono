/**
 * The kernel surface: one function per semantic question, and the one shape of a native. Every other module answers
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
export { compileOperands, type Native, type Compiled, type NativeContext, type NativeResult } from './native'
export { matchesGraph } from './structural'
export { evaluateNode, selectExecutor } from './evaluation'
export { defineNative, registerNatives, restoreNatives, nativeExecutors } from './natives'
export { proposeRefAt } from './replica'
export { acceptSubmission } from './approvals'
