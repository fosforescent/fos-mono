
import { addExamples } from "../mock/example-workflows";
import { Store } from "../dag-implementation/store";
import { INode, IStore, IFosInterpreter } from "../dag-types";
import { RootFosInterpreter } from "./interpreter";

/**
 * This is meant to provide an interface that doesn't require explicit declaration of options & parameters. 
 * When serialization is a thing, it should take care of that.  Currently it uses the "addExamples" function
 * 
 * @returns An initialized FosInterpreter with sensible defaults
 */

export type FosOptions = {
  demo?: boolean
  key?: string
}


export interface IFosInstance {
  getRootAddress(): string
  getRoot(): IFosInterpreter
  getChildren(): IFosInterpreter[]
  getAncestors(): IFosInterpreter[]
  mine(): boolean
  // runMine(): void
  createTransaction(): IFosInterpreter
}



class FosInstance implements IFosInstance{

  store: IStore
  currentTransaction: number = 0
  transactions: IFosInterpreter[] = []

  constructor (options: FosOptions = {
    demo: true,
    // key: null
  }){

    this.store = new Store()
    
    const initialRootInterpreter = this.store.getRoot()
    this.transactions.push(initialRootInterpreter)

  }

  getRoot(){
    const currentTransaction = this.transactions[this.currentTransaction]
    if (!currentTransaction){
      throw new Error('no current root')
    }
    if (currentTransaction.committed){
      throw new Error('current root is committed')
    }
    return currentTransaction
  }

  getRootOptions(){

  }


  // addPeer(options: PeerOptions){

  //   throw new Error('not implemented')
  // }

  getPaths(){
    throw new Error('not implemented')
  }

  followPath(index: number){
    throw new Error('not implemented')
  }

  proposeUpdate(index: number, instruction: INode, target: INode){
    throw new Error('not implemented')
  }

  parse(input: string): INode{
    throw new Error('not implemented')
  }

  // startTransaction(){
  //   return this.store.getNodeByAddress(this.root)
  // }

  getChildren(){
    return this.getRoot().getChildren()
  }

  getAncestors(){
    const copiedStack = this.getRoot().getStack()
    copiedStack.reverse()
    return copiedStack
  }

  getRootAddress(){
    return this.getRoot().getTarget()
  }

  registerRootInstruction(pattern: INode){
    this.store.create
  }

  // run(){
  //   this.getRoot().run()
  // }

  mine(){
    console.log('test')
    return false
  }

  

  createTransaction(): RootFosInterpreter {
    const currentTransaction = this.getRoot()
    const currentInstruction = this.store.getNodeByAddress(currentTransaction.getInstruction())
    const currentTarget = this.store.getNodeByAddress(currentTransaction.getTarget())
    const newTransaction = new RootFosInterpreter(this.store, currentInstruction, currentTarget)
    this.transactions.push(newTransaction)
    return newTransaction
  }

}

export const Fos = (options?: FosOptions) => new FosInstance(options)

export type {
    IStore,
    INode,
    IFosInterpreter
}