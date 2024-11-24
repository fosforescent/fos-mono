import { Duration, NodeData, Probability, Cost, CostAllocation } from './node-data'


import { FosNodeContent, FosPath, FosPathElem } from '../types'
import { FosStore } from './store'




export class FosNode {

  primitiveTag: string | undefined = undefined
  cid: string
  store: FosStore
  value: FosNodeContent
  alias: string | undefined = undefined
  
  constructor(value: FosNodeContent, store: FosStore, alias?: string) {
    const address = store.insert(value, alias)
    this.cid = address
    this.store = store
    this.value = value
    this.alias = alias
  }

  getId(): string  {
    return this.cid
  }

  getAlias(): string | undefined {
    return this.alias
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

  prevList(): FosNode[] {
    const previousVersionNode = this.store.previousVersionNode
    const prevNodes: FosNode[] = this.value.children.reduce((acc: FosNode[], [edgeType, target]: FosPathElem) => {
      if (edgeType === "prev") {
        const node: FosNode | null = this.store.getNodeByAddress(target)
        if (!node){
          throw new Error("Node not found")
        }
        return [...acc, node]
      }
      return acc
    }, [])

    return prevNodes
  }

  addEdge(edgeType: string, target: string): FosNode {
    return new FosNode({...this.value, children: [...this.getEdges(), [edgeType, target]] }, this.store, this.alias)
  }

  removeEdge(edgeType: string, target: string): FosNode {
    return new FosNode({...this.value, children: this.getEdges().filter(item => item[0] == edgeType && item[1] === target) }, this.store, this.alias)
  }

  updateEdge(oldEdgeType: string, oldTarget: string, newEdgeType: string, newTarget: string): FosNode {
    const updated =  new FosNode({...this.value, children: this.getEdges().map(item => item[0] === oldEdgeType && item[1] === oldTarget ? [newEdgeType, newTarget] : item) }, this.store, this.alias)
    return updated
  }


  revertToPreviousVersion(n: number): FosNode {
    const prevNodes = this.prevList()
    if (prevNodes.length < n) {
      throw new Error("Not enough previous versions")
    }
    const prevNode = prevNodes[n]
    if (!prevNode) {
      throw new Error("Previous node not found")
    }
    const newContent: FosNodeContent = {
      data: {
        ...prevNode.value.data,
        updated: {
          time: Date.now()
        },
        reversion: {
          reversionedToAddress: prevNode.getId(),
          nStepsBack: n
        }
      },
      children: prevNode.getEdges()
    }
    const newNode = new FosNode(newContent, this.store, this.alias)
    return newNode
  }

  orderEdges(orderArray: number[]): FosNode {
    if (orderArray.length != this.getEdges().length) {
      throw new Error("Order array length must match the number of edges")
    }
    const orderedEdges: FosPath = orderArray.map(i => this.getEdges()[i]).map((edge) =>{
      if (edge === undefined) {
        throw new Error("Edge not found")
      }
      return edge
    })
    return new FosNode({...this.value, children: orderedEdges }, this.store, this.alias)
  }

  getPeers(): FosNode[] {
    const peers = this.getEdges().filter(([edgeType, target]) => edgeType === this.store.peerNode.getId())
    return peers.map(([edgeType, target]) => {
      const node = this.store.getNodeByAddress(target)
      if (!node) {
        throw new Error("Node not found")
      }
      return node
    })

  }

  addComment(comment: string): [FosNode, FosNode] {
    const newCommentData: FosNodeContent = {
      data: {
        ...this.value.data,
        comment: {
          content: comment,
          authorID: this.store.rootTarget.getId(),
          authorName: "Profile Not Created",
          time: Date.now(),
          votes: {}
        },
        updated: {
          time: Date.now()
        },
      },
      children: []
    }
    const newNode = new FosNode(newCommentData, this.store)
    const thisNewNode = this.addEdge(this.store.commentConstructorNode.getId(), newNode.getId())
    return [thisNewNode, newNode]
  }


  addTodo(description: string): [FosNode, FosNode] {
    const newTodoData: FosNodeContent = {
      data: {
        ...this.value.data,
        updated: {
          time: Date.now()
        },
        description: {
          content: description
        },
      },
      children: []
    }
    const newNode = new FosNode(newTodoData, this.store)
    const thisNewNode = this.addEdge(newNode.getId(), this.store.completeFieldNode.getId())
    return [thisNewNode, newNode]
  }

  getComments(): FosNode[] {
    const comments = this.getEdges().filter(([edgeType, target]) => edgeType === this.store.commentConstructorNode.getId())
    return comments.map(([edgeType, target]) => {
      const node = this.store.getNodeByAddress(target)
      if (!node) {
        throw new Error("Node not found")
      }
      return node
    })
  }




  delete(): void {
    this.store.remove(this)
  }



}


