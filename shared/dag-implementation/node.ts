import { Duration, NodeData, Probability, Cost, CostAllocation } from './node-data'


import { FosDataContent, FosNodeContent, FosPath, FosPathElem } from '../types'
import { FosStore } from './store'
import { FosExpression } from './expression'
import { Key } from 'lucide-react'





export class FosNode {

  primitiveTag: string | undefined = undefined
  cid: string
  store: FosStore
  value: FosNodeContent
  alias: string | undefined = undefined
  
  constructor(value: FosNodeContent, store: FosStore) {
    const address = store.insert(value)
    this.cid = address
    this.store = store
    this.value = value
  }

  getId(): string  {
    return this.cid
  }


  mapTarget(instruction: FosNode, mapTarget: (currentTarget: FosNode) => FosNode): FosNode | null {

    const newEdges: FosPathElem[] = this.getEdges().map(([edgeType, target]) => {
      if (edgeType === instruction.getId()) {
        const targetNode = this.store.getNodeByAddress(target)
        if (!targetNode) {
          throw new Error("Target Node not found")
        }
        const newTarget = mapTarget(targetNode)
        return [edgeType, newTarget.getId()]
      }
      return [edgeType, target]
    })
    const newContent: FosNodeContent = {
      data: {
        ...this.value.data,
        updated: {
          time: Date.now()
        },
      },
      children: newEdges
    }
    return this.mutate(newContent)

  }

  mapInstruction(mapInstruction: (currentInstrucion: FosNode) => FosNode, target: FosNode): FosNode | null {
      
      const newEdges: FosPathElem[] = this.getEdges().map(([edgeType, targetId]) => {
        if (targetId === target.getId()) {
          const instructionNode = this.store.getNodeByAddress(edgeType)
          if (!instructionNode) {
            throw new Error("Instruction Node not found")
          }
          const newInstruction = mapInstruction(instructionNode)
          return [newInstruction.getId(), targetId]
        }
        return [edgeType, targetId]
      })
      const newContent: FosNodeContent = {
        data: {
          ...this.value.data,
          updated: {
            time: Date.now()
          },
        },
        children: newEdges
      }
      return this.mutate(newContent)

  }


  getEdges(): FosPathElem[] {
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
    const previousVersionNodeId = this.store.primitive.previousVersion.getId()
    const prevNodes: FosNode[] = this.value.children.reduce((acc: FosNode[], [edgeType, target]: FosPathElem) => {
      if (edgeType === previousVersionNodeId) {
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




  getExprOfType(instructionType: FosNode, targetType: FosNode, route: FosPath): FosExpression[] | null {
    const exprs = this.getEdges().filter(([edgeType, target]) => {
      const instructionNode = this.store.getNodeByAddress(edgeType)
      if (!instructionNode) {
        throw new Error("Instructinon Node not found")
      }
      const targetNode = this.store.getNodeByAddress(target)
      if (!targetNode) {
        throw new Error("Target Node not found")
      }
      const instructionMatch = this.store.matchPattern( instructionType, instructionNode )
      const targetMatch = this.store.matchPattern( targetType, targetNode )
      return instructionMatch.length > 0 && targetMatch.length > 0
    })
    if (exprs.length === 0) {
      return null
    }
    const expressions = exprs.map(([edgeType, targetType]) => {

      return new FosExpression(this.store, [...route, [edgeType, targetType]])
    })

    return expressions
  }
  

  // isGroupInstructionNode(): boolean {
  //   const peerEdges = this.value.children.filter(([edgeType, target]) => edgeType === this.store.primitive.peerNode.getId())

  //   const hasPeerEdges = peerEdges.length > 0
  //   return hasPeerEdges

  // }



  isPrimitive(): [string, FosNode] | null {
    const result: [string, FosNode] | null = Object.entries(this.store.primitive).find(([key, primitive], number) => {
      if (primitive.getId() === this.getId()) {
        return true 
      }
    }) || null

    return result
  }

  getData(): FosDataContent {
    return this.value.data
  }




  followAllLinks(): FosNode {
    throw new Error("Method not implemented.")
  }



  mutate(content: FosNodeContent): FosNode {
    const newNode = new FosNode(content, this.store)
    return newNode
  }



  addUuidAlias(): string {
    throw new Error("Method not implemented.")
  }



  clone(): FosNode {
    throw new Error("Method not implemented.")
  }
  
  merge(nodeContent: FosNodeContent): FosNode {
    throw new Error("Method not implemented.")
  }


  delete(): void {
    this.store.remove(this)
  }

  addEdge(edgeType: string, target: string, index: number = -1): FosNode {
    if ( index < -1 || index > this.getEdges().length - 1) {
      throw new Error("Index out of bounds")
    }
    if (index === -1) {
      return this.mutate({...this.value, children: [...this.getEdges(), [edgeType, target]] })
    } else {
      const newEdges = [...this.getEdges()]
      newEdges.splice(index, 0, [edgeType, target])
      return this.mutate({...this.value, children: newEdges })
    }
  }

  removeEdge(edgeType: string, target: string): FosNode {
    return this.mutate({...this.value, children: this.getEdges().filter(item => item[0] == edgeType && item[1] === target) })
  }

  removeEdgeByIndex(index: number): FosNode {
    if (index < 0 || index > this.getEdges().length - 1) {
      throw new Error("Index out of bounds")
    }
    const newEdges = [...this.getEdges()]
    newEdges.splice(index, 1)
    return this.mutate({...this.value, children: newEdges })
  }

  updateEdge(oldEdgeType: string, oldTarget: string, newEdgeType: string, newTarget: string): FosNode {
    const updated =  this.mutate({...this.value, children: this.getEdges().map(item => item[0] === oldEdgeType && item[1] === oldTarget ? [newEdgeType, newTarget] : item) })
    return updated
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
    return this.mutate({...this.value, children: orderedEdges })
  }
  addExpression(expression: FosExpression): FosNode {
    return this.addEdge(expression.instructionNode.getId(), expression.targetNode.getId())
  }

  removeExpression(expression: FosExpression): FosNode {
    return this.removeEdge(expression.instructionNode.getId(), expression.targetNode.getId())
  }

  updateExpression(oldExpression: FosExpression, newExpression: FosExpression): FosNode {
    return this.updateEdge(oldExpression.instructionNode.getId(), oldExpression.targetNode.getId(), newExpression.instructionNode.getId(), newExpression.targetNode.getId())
  }

  updateData(data: FosDataContent): FosNode {
    return this.mutate({...this.value, data: { ...this.value.data, ...data }  })
  }

  equals(node: FosNode): boolean {
    return this.getId() === node.getId()
  }

  getEdgeNodes(edge?: FosPathElem): [FosNode, FosNode] {
    if (!edge) {
      
      throw new Error("Edge is not defined")
    }
    const [edgeType, target] = edge
    const instructionNode = this.store.getNodeByAddress(edgeType)
    if (!instructionNode) {
      throw new Error("Instruction Node not found")
    }
    const targetNode = this.store.getNodeByAddress(target)
    if (!targetNode) {
      throw new Error("Target Node not found")
    }
    return [instructionNode, targetNode]
  }

  getAliasTargetNodes(): { instruction: FosNode, target: FosNode, prev: FosNode } {
    const target = this.getEdges().find(([edgeType, target]) => edgeType === this.store.primitive.targetConstructor.getId())
    if (!target) {
      throw new Error("Target not found")
    }
    const targetNode = this.store.getNodeByAddress(target[1])
    if (!targetNode) {
      throw new Error("Target Node not found")
    }

    const instruction = this.getEdges().find(([edgeType, target]) => edgeType === this.store.primitive.aliasInstructionConstructor.getId())
    if (!instruction) {
      throw new Error("Instruction not found")
    }
    const instructionNode = this.store.getNodeByAddress(instruction[1])
    if (!instructionNode) {
      throw new Error("Instruction Node not found")
    }

    const prev = this.getEdges().find(([edgeType, target]) => edgeType === this.store.primitive.previousVersion.getId())
    if (!prev) {
      throw new Error("Previous not found")
    }
    const prevNode = this.store.getNodeByAddress(prev[1])
    if (!prevNode) {
      throw new Error("Previous Node not found")
    }

    return {instruction: instructionNode, target: targetNode, prev: prevNode}
  }

  getUpdateNodes(): { instruction: FosNode, target: FosNode, prevInstruction: FosNode, prevTarget: FosNode } {

    const target = this.getEdges().find(([edgeType, target]) => edgeType === this.store.primitive.targetConstructor.getId())
    if (!target) {
      throw new Error("Target not found")
    }
    const targetNode = this.store.getNodeByAddress(target[1])    
    if (!targetNode) {
      throw new Error("Target Node not found")
    }

    const instruction = this.getEdges().find(([edgeType, target]) => edgeType === this.store.primitive.aliasInstructionConstructor.getId())
    if (!instruction) {
      throw new Error("Instruction not found")
    }

    const instructionNode = this.store.getNodeByAddress(instruction[1])
    if (!instructionNode) {
      throw new Error("Instruction Node not found")
    }

    const prevInstruction = this.getEdges().find(([edgeType, target]) => edgeType === this.store.primitive.previousVersion.getId())
    if (!prevInstruction) {
      throw new Error("Previous Instruction not found")
    }

    const prevInstructionNode = this.store.getNodeByAddress(prevInstruction[1])    
    if (!prevInstructionNode) {
      throw new Error("Target Node not found")
    }


    const prevTarget = this.getEdges().find(([edgeType, target]) => edgeType === this.store.primitive.previousVersion.getId())
    if (!prevTarget) {
      throw new Error("Previous Target not found")
    }

    const prevTargetNode = this.store.getNodeByAddress(prevTarget[1])    
    if (!prevTargetNode) {
      throw new Error("Target Node not found")
    }


    return {instruction: instructionNode, target: targetNode, prevInstruction: prevInstructionNode, prevTarget: prevTargetNode}
  }


  setAliasInfo(info: {
    target: FosNode,
    instruction: FosNode,
    prev: FosNode
  }): FosNode {

    let hadTarget = false
    let hadInstruction = false
    let hadPrev = false
    

    const newEdges: FosPathElem[] = this.getEdges().map(([edgeType, target]) => {
      if (edgeType === this.store.primitive.targetConstructor.getId()) {
        hadTarget = true
        const newEdge: FosPathElem = [edgeType, info.target.getId()]
        console.log("newEdge - target", newEdge)
        return newEdge
      }
      if (edgeType === this.store.primitive.aliasInstructionConstructor.getId()) {
        hadInstruction = true
        const newEdge: FosPathElem = [edgeType, info.instruction.getId()]
        console.log("newEdge - aliasInstruction", newEdge)
        return newEdge
      }
      if (edgeType === this.store.primitive.previousVersion.getId()) {
        const newEdge: FosPathElem = [edgeType, info.prev.getId()]
        console.log("newEdge - prev", newEdge)
        return newEdge
      }

      return [edgeType, target]
    })

    if (!hadTarget) {
      throw new Error("Trying to set alias info on node without target")
    }
    if (!hadInstruction) {
      throw new Error("Trying to set alias info on node without instruction")
    }

    const newContent: FosNodeContent = {
      data: {
        ...this.value.data,
        updated: {
          time: Date.now()
        },
      },
      children: newEdges
    }
    return this.mutate(newContent)

  }

  getCommitNode(): FosNode {

    let hadPrev = false
    const newEdges: FosPathElem[] = this.getEdges().map((edge) => {

      if (edge[0] === this.store.primitive.previousVersion.getId()) {
        hadPrev = true
        return [this.store.primitive.previousVersion.getId(), this.getId()]
      }
      return edge
  
    })
    if (!hadPrev) {
      throw new Error("Trying to create commit on node without history")
    }

    const newContent: FosNodeContent = {
      data: {
        ...this.value.data,
        updated: {
          time: Date.now()
        },
      },
      children: newEdges
    }

    return this.mutate(newContent)

  }

  // revertToPreviousVersion(n: number): FosNode {
  //   const prevNodes = this.prevList()
  //   if (prevNodes.length < n) {
  //     throw new Error("Not enough previous versions")
  //   }
  //   const prevNode = prevNodes[n]
  //   if (!prevNode) {
  //     throw new Error("Previous node not found")
  //   }
  //   const newContent: FosNodeContent = {
  //     data: {
  //       ...prevNode.value.data,
  //       updated: {
  //         time: Date.now()
  //       },
  //       reversion: {
  //         reversionedToAddress: prevNode.getId(),
  //         nStepsBack: n
  //       }
  //     },
  //     children: prevNode.getEdges()
  //   }
  //   const newNode = new FosNode(newContent, this.store, this.alias)
  //   return newNode
  // }


  // getPeers(): FosNode[] {
  //   const peers = this.getEdges().filter(([edgeType, target]) => edgeType === this.store.primitive.peerNode.getId())
  //   return peers.map(([edgeType, target]) => {
  //     const node = this.store.getNodeByAddress(target)
  //     if (!node) {
  //       throw new Error("Node not found")
  //     }
  //     return node
  //   })

  // }

  // addComment(comment: string): [FosNode, FosNode] {
  //   const newCommentData: FosNodeContent = {
  //     data: {
  //       ...this.value.data,
  //       comment: {
  //         content: comment,
  //         authorID: this.store.rootTarget.getId(),
  //         authorName: "Profile Not Created",
  //         time: Date.now(),
  //         votes: {}
  //       },
  //       updated: {
  //         time: Date.now()
  //       },
  //     },
  //     children: []
  //   }
  //   const newNode = new FosNode(newCommentData, this.store)
  //   const thisNewNode = this.addEdge(this.store.primitive.commentConstructor.getId(), newNode.getId())
  //   return [thisNewNode, newNode]
  // }


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
    const thisNewNode = this.addEdge(newNode.getId(), this.store.primitive.completeField.getId())
    return [thisNewNode, newNode]
  }

  // getComments(): FosNode[] {
  //   const comments = this.getEdges().filter(([edgeType, target]) => edgeType === this.store.primitive.commentConstructor.getId())
  //   return comments.map(([edgeType, target]) => {
  //     const node = this.store.getNodeByAddress(target)
  //     if (!node) {
  //       throw new Error("Node not found")
  //     }
  //     return node
  //   })
  // }


}


