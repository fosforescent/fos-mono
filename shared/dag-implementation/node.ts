import { Duration, NodeData, Probability, Cost, CostAllocation } from './node-data'


import { FosNodeContent, FosPath } from '../types'
import { FosStore } from './store'




export class FosNode {

  primitiveTag: string | undefined = undefined
  address: string
  store: FosStore
  value: FosNodeContent
  
  constructor(value: FosNodeContent, store: FosStore, alias?: string) {
    const address = store.insert(value, alias)
    this.address = address
    this.store = store
    this.value = value
  }

  getId(): string  {
    return this.address

  }

  getEdges(): FosPath {
    return this.value.children
  }
 
  getContent(): FosNodeContent {
    /**
     * make sure we never accidentally mutate the value
     */
    const nodeContent = this.value
    return nodeContent

  }
 

  printTree(): void {
    throw new Error("Method not implemented.")
  }



  toString(): string {
    return JSON.stringify(this.value)
  }


 
  isDone(): boolean {
    throw new Error("Method not implemented.")
  }


  isLeaf(): boolean {
    return this.value.children.length == 0
  }

  addEdge(edgeType: string, target: string): FosNode {
    return new FosNode({...this.value, children: [...this.getEdges(), [edgeType, target]] }, this.store)
  }

  removeEdge(edgeType: string, target: string): FosNode {
    return new FosNode({...this.value, children: this.getEdges().filter(item => item[0] == edgeType && item[1] === target) }, this.store)
  }

  updateEdge(oldEdgeType: string, oldTarget: string, newEdgeType: string, newTarget: string): FosNode {
    const updated =  new FosNode({...this.value, children: this.getEdges().map(item => item[0] === oldEdgeType && item[1] === oldTarget ? [newEdgeType, newTarget] : item) }, this.store)
    return updated
  }

  delete(): void {
    this.store.remove(this)
  }



}


