import { RootFosInterpreter } from "./interpreter"
import { INode, IStore } from "../dag-types"
import { Store } from "../dag-implementation/store"
import { IFosInterpreter } from '../dag-types'
// import { interpret } from "xstate"
import { assert } from '../utils'



/**
 * TODO: remove class & simplify
 */

export class FosClient<S, T>  {

  path: IFosInterpreter[] = []
  interpreter: IFosInterpreter
  
  constructor(public store: IStore, public target: string, public instruction: string) {
    const instructionNode = store.getNodeByAddress(instruction)
    const targetNode = store.getNodeByAddress(target)
    this.interpreter = new RootFosInterpreter(store, instructionNode, targetNode)
    // console.log('SETTING CALLBACK', this.setInterpreter)
    assert(this.interpreter !== undefined, `Could not find interpreter for ${instruction} ${target}`)
    // this.composeView = options.composeView
    
  }

  getView(opts?: S): T {
    throw new Error("Method not implemented.")
    // return this.interpreter.reduceTree<S, T>(this.distributor, this.accumulator)(opts)
  }

  setRoot(interpreter: IFosInterpreter): void {
    this.interpreter = interpreter
  }


  // distributor(originalDistribution: S):  ({interpreter}: {interpreter: IFosInterpreter}) => [S, S] {
  //   throw new Error("Method not implemented.")
  // }

  // accumulator (distribution: S): ({interpreter, children}: {interpreter: IFosInterpreter, children: [S, IFosInterpreter][]}) =>  T {
  //   throw new Error("Method not implemented.")
  // }



  getCurrentName (): string {
    return this.interpreter.getName() || ''
  }

  getCurrentAddress (): string {
    return this.interpreter.getTarget()
  }

  

  isDone(): boolean {
    return this.interpreter.isDone()
  }


}