// import { Interpreter, StateMachine, StateValue } from 'xstate'
import { Cost, CostAllocation, NodeData } from './dag-implementation/node-data'

import { FosDataContent } from './types'

export enum NodeStatus {
  NotStarted = 'NotStarted',
  Rejected = 'Rejected',
  Done = 'Done',
}

export interface NodeStateSchema {
  states: {
    [NodeStatus.NotStarted]: object
    [NodeStatus.Done]: object
    [NodeStatus.Rejected]: object
  }
}

interface CompleteNode {
  type: 'CompleteNode'
  node: string
}

interface UncompleteNode {
  type: 'UncompleteNode'
  node: string
}

interface RejectNode {
  type: 'RejectNode'
  node: string
}

interface UnrejectNode {
  type: 'UnrejectNode'
  node: string
}

export interface ChildWasCompletedEvent {
  type: 'ChildWasCompleted'
  child: string
}

export interface ChildWasUncompletedEvent {
  type: 'ChildWasUncompleted'
  child: string
}


export type NodeEvents =
  | CompleteNode
  | UncompleteNode
  | RejectNode
  | UnrejectNode
  | ChildWasCompletedEvent
  | ChildWasUncompletedEvent

type IsChildType<T extends NodeEvents> = T extends { child: INode } ? T : never
type ChildEvents = IsChildType<NodeEvents>
// type ThisNodeEvents = Exclude<NodeEvents, ChildEvents>

export type ChildEventTypes = ChildEvents['type']

export interface INode {

  primitiveTag: string | undefined

  getValue(): unknown

  getAddress(): string

  getEdge(edgeType: string, child: string): [string, string] | undefined
  getEdges(): [string, string][]
  getData(): FosDataContent

  addEdge(edgeType: string, target: string): INode
  removeEdge(edgeType: string, target: string): INode
  updateEdge(oldEdgeType: string, oldTarget: string, newEdgeType: string, newTarget: string): INode

  asInstruction(): (input: INode) => Promise<INode>

  addTaskEdge(target: string): INode

  delete(): void

  toString(): string
  toJSON(): string // must not include store
}

export interface IStore {
  create<T>(value: T, opts?: {name?: string}): INode
  query(query: INode): INode[]
  queryTriple(subject: INode, predicate: INode, object: INode): [INode, INode, INode][] 
  // insertExternal(node: INode): string
  insert(node: [string, string][]): string
  remove(node: INode): void
  matchPattern(pattern: INode, target: INode, throwError: boolean): INode[]
  getNodeByAddress(address: string): INode
  // toJSON(): (string | number)[]
  // getRoot(node?: INode): IFosInterpreter
  checkAddress(address: string): boolean
  // getRootInterpreterByName(name: string): IFosInterpreter
  // getRootInterpreters(): IFosInterpreter[]
}




export interface IFosInterpreter  {

    isDone(): boolean
    // isRejected(): boolean
    // isLeaf(): boolean
    // complete(): void
    // uncomplete(): void
  
    // addNewAllOfWithDescription(description: string): [INode, INode]
    // addNewOneOfWithDescription(description: string): [INode, INode]
    store: IStore
    committed: boolean

    createTask(description: string, deps?: INode[]): [IFosInterpreter, IFosInterpreter, ...IFosInterpreter[]]
    getTasks(): IFosInterpreter[]
    getTask(name: string): IFosInterpreter | undefined
    getName(): string
    setName(name: string): [IFosInterpreter, IFosInterpreter, ...IFosInterpreter[]]
  
    getInstruction(): string
    // followTaskFromAddress(address: string): IFosInterpreter
    // getTarget(): INode | null
    getDisplayString(): string
  
    formatTree(formatOpts: { current?: IFosInterpreter; indent?: string }): string  
    getTarget(): string
    getAliases(): [string | null, string | null]
    getStubString(): string
    // getTargetEdges(): [string, string][]
    // listenChildren(cb: (newInstruction: string, newTarget: string) => IFosInterpreter[]): IFosInterpreter[]
    getChildren(): IFosInterpreter[]
    getNodeByName(name: string): INode | undefined
    followEdgeFromStubString(stubString: string, latest?: boolean): IFosInterpreter 
    followEdge(instruction: string, target: string): IFosInterpreter
    // processChildChange(oldChildInterpreter: IFosInterpreter, newChildInterpreter: IFosInterpreter): IFosInterpreter[] 
    // parentCallback: (oldInterpreter: IFosInterpreter, newInterpreter: IFosInterpreter) => IFosInterpreter[]
    spawn: (instruction: INode, target: INode) => [IFosInterpreter, IFosInterpreter, ...IFosInterpreter[]]
    mutate: (instruction: INode, target: INode) => [IFosInterpreter, ...IFosInterpreter[]]
    getStack(): IFosInterpreter[],
    isName(): boolean
    isTask(): boolean
    getValue(): string
    reorderTargetEdges(newEdges: (string | null)[]): IFosInterpreter[]
    setValue(value: string): [IFosInterpreter, ...IFosInterpreter[]]
    getAvailableInstructions(): INode[]
    getBlank(instruction: INode): IFosInterpreter[]
  }
  
  