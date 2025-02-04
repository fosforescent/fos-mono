import { FosExpression } from "./expression";
import { FosNode } from "./node";
import { FosStore } from "./store";




export const runAvailableFunctions = async (expr: FosExpression): Promise<boolean> => {
  /**
   * what does it mean to run "addTask" on something?
   * - add edge to target and run "update"
   * - this is a fine and normal operation
   * - same wiht "setdescription" etc.
   * 
   * - however, as an arg they take a string etc. 
   * - must be passed in as nodeData somehow
   * 
   * - add context node back?
   * - or just use the target edges as context?
   * - add "input" edge with description node?
   * - add "addTask" edge with description node?
   * 
   * 
   * 
   * 
   */

  if (expr.isUpdate()){
    const {

    } = {}
    if (false){
      const { parent }  = expr.getParentInfo()
      if (parent.isAlias()){
        /// parent.add next to alias, update target, then update parent
      } else if (parent.isVarBinding()){
        // keep left the same, then update parent
      }

    }



  }

  if (expr.isEval()){

  }



  if (expr.isTodo()){
    if (false){

    }

  }

  const providedBindings = getTargetBindings(expr)
  const awaitedBindings = getInstructionBindingSites(expr)
  



}


export const getVars = (expr: FosExpression): [FosNode, FosNode][] => {
  /**
   * e.g. "addTask" -> "description, optional subtasks"
   * e.g. "createBranch" -> "description" 
   * e.g. "pure" -> "monadType, expression"
   * e.g. "apply" -> "function, bindings"
   * e.g. "function" -> (should match anything)
   * e.g. "bindings" -> ("n")
   * 
   */
  expr.getInstructionChildren()
}

export const applyVars = (expr: FosExpression): [FosNode, FosNode][] => {



}


const addTask = async (expression: FosExpression) => {
  if (!expression.isTodo()){
      throw new Error('Not a todo')
  }

  
}




const addChoice = async (expression: FosExpression) => {
  const currentInstructionNode = expression.instructionNode
  const targetDescription = expression.targetNode.getContent().data.description?.content

  if (!targetDescription){
    throw new Error('Target node must have description')
  }

  const newAlternative = expression.store.create({
    data: {
      description: {
        content: targetDescription
      }
    },
    children: []
  })




}

//   if (!this.isChoice()){
//     const newEdge: FosPathElem = [newAlternative.getId(), this.store.primitive.optionSelectedConstructor.getId()]

//     const newInstructionNode = this.store.create({
//       data: currentInstructionNode.getData(),
//       children: [
//         newEdge,
//       ]
//     })
//     const [newExpr, ...rest] = this.update(newInstructionNode, this.targetNode)
//     const newChoiceExpr = new FosExpression(newExpr.store, [...newExpr.route, newEdge])
//     return [newChoiceExpr, newExpr]

//   } else {
//     const newEdge: FosPathElem = [newAlternative.getId(), this.store.primitive.optionSelectedConstructor.getId()]

//     const currentSelectedChild = this.targetNode.getEdges().findIndex((edge) => {
//       return edge[1] === this.store.primitive.optionSelectedConstructor.getId()
//     })      

//     const newChildren: FosPathElem[] = currentInstructionNode.getEdges().map((edge) => {
//       return [edge[0], this.store.primitive.optionNotSelectedConstructor.getId()]
//     })

//     newChildren.splice(currentSelectedChild, 0, newEdge)

//     const newInstructionNode = this.store.create({
//       data: currentInstructionNode.getData(),
//       children: newChildren
//     })
//     const [newExpression, ...rest] = this.update(newInstructionNode, this.targetNode)

//     const newChoiceExpr = new FosExpression(this.store, [...newExpression.route, [newAlternative.getId(), this.store.primitive.optionSelectedConstructor.getId()]])
//     return [newChoiceExpr, newExpression, ...rest]

//   }
// }







//   const update = async (newInstruction: FosNode, newTarget: FosNode): Promise<void> => {
//     if (!this.isAlias()){
//       throw new Error('Root expression is not alias')
//     }

//     if (!this.hasParent()) {

//       const currentRootNode = this.store.getRootNode()

//       const rootNodeWithNewTarget = currentRootNode.setAliasInfo({
//         target: newTarget,
//         instruction: newInstruction,
//         prev: currentRootNode
//       })

//       this.targetNode = newTarget
//       this.instructionNode = newInstruction
//       this.store.setRootNode(rootNodeWithNewTarget)
//       return [new FosExpression(this.store, [])]

//     } else {
//       const { parent } = this.getParentInfo() 

//       let newParentExpression: FosExpression
//       let newAncestors: FosExpression[] = []
//       const parentIsAlias = parent.isAlias();

//       if (parentIsAlias) {

//         const newParentTarget = parent.targetNode.setAliasInfo({
//           target: newTarget,
//           instruction: newInstruction,
//           prev: parent.targetNode
//         })


//         const [thisNewParentExpression, ...ancestors] = parent.update(parent.instructionNode, newParentTarget)
//         newParentExpression = thisNewParentExpression
//         newAncestors = ancestors
//       } else {

        
//         const parentContent = parent.targetNode.getContent()
//         const newChildren: FosPathElem[]  = parent.targetNode.getEdges().map((edge, i) => {
//           if (edge[0] === this.instructionNode.getId() && edge[1] === this.targetNode.getId()) {
//             return [newInstruction.getId(), newTarget.getId()]
//           }
//           return edge
//         })
//         const newParentTarget = parent.store.create({
//           data: parentContent.data,
//           children: newChildren
//         })
    
//         const parentInstruction = parent.instructionNode.getContent()
//         const newInstructionChildren: FosPathElem[] = parent.instructionNode.getEdges().map((edge, i) => {
//           if (edge[0] === this.instructionNode.getId() && edge[1] === this.targetNode.getId()) {
//             return [newInstruction.getId(), newTarget.getId()]
//           }
//           return edge
//         })
//         const newParentInstruction = parent.store.create({
//           data: parentInstruction.data,
//           children: newInstructionChildren
//         })

//         const [thisNewParentExpression, ...ancestors] = parent.update(newParentInstruction, newParentTarget)
//         newParentExpression = thisNewParentExpression
//         newAncestors = ancestors 
//       }

      

//       const isAlias = newParentExpression.isAlias()
//       let exists = false

//       if (isAlias) {
//         const {
//           instruction: aliasInstruction,
//           target: aliasTarget
//         } = newParentExpression.targetNode.getAliasTargetNodes()
//         exists = aliasInstruction.getId() === newInstruction.getId() && aliasTarget.getId() === newTarget.getId()
//       } else{
//         exists = newParentExpression.getTargetChildren().some((child) => {
//           const sameInstruction = child.targetNode.getId() === newTarget.getId()
//           const sameTarget = child.instructionNode.getId() === this.instructionNode.getId()
//           return sameInstruction && sameTarget
//         })
//       }
//       if (!exists){
//         throw new Error('Parent node does not contain this new child')
//       }
//       this.instructionNode = newInstruction
//       this.targetNode = newTarget
//       this.route = [...newParentExpression.route, [newInstruction.getId(), this.targetNode.getId()]]

//       if (newParentExpression.store !== this.store) {
//         throw new Error('Store not updated correctly')
//       }

//       this.store = newParentExpression.store
//       const newExpression = new FosExpression(newParentExpression.store, [...newParentExpression.route, [newInstruction.getId(), this.targetNode.getId()]])
//       if (newExpression.instructionNode.getEdges().length !== newInstruction.getEdges().length) {
//         throw new Error('Instruction node not updated correctly')
//       }

//       return [newExpression, newParentExpression, ...newAncestors]
//     }

//   }




//   update() {



//       const currentRootNode = this.store.getRootNode()

//       const rootNodeWithNewTarget = currentRootNode.setAliasInfo({
//         target: newTarget,
//         instruction: newInstruction,
//         prev: currentRootNode
//       })

//       this.targetNode = newTarget
//       this.instructionNode = newInstruction
//       this.store.setRootNode(rootNodeWithNewTarget)
//       return [new FosExpression(this.store, [])]
//   }

// export class BaseFosActionPack {


//   getInstructionNode(){



//     const instructionNode = store.getNodeByAddress(lastElem[0])
//     if (!instructionNode) {
//       throw new Error('Instruction node not found')
//     }
//     this.instructionNode = instructionNode

//   }

//   getTargetNode() {
//     const targetNode = store.getNodeByAddress(lastElem[1])
//     if (!targetNode) {
//       throw new Error('Target node not found')
//     }
//     this.targetNode = targetNode

//   }

//   update() {

//   }

  

// }

// export class TreeFosActionPack {


//   getParentInfo() {
//     if (!this.hasParent()) {
//       throw new Error('Cannot get parent of root node')
//     }
    
//     let thisParent: FosExpression = this.getParent()

//     if (thisParent.instructionNode.getId() === this.store.primitive.targetConstructor.getId()) {
//       const {
//         instruction: aliasInstruction,
//         target: aliasTarget
//       } = thisParent.targetNode.getAliasTargetNodes()
//       thisParent = new FosExpression(this.store, [...thisParent.route.slice(-1), [aliasInstruction.getId(), aliasTarget.getId()]])
      
//     }
    

//     let oneWasFound = false
//     const targetIndexInParent = thisParent.getTargetChildren().findIndex((childExpr) => {
//       if (thisParent.isAlias()) {
//         const {
//           instruction: aliasInstruction,
//           target: aliasTarget
//         } = thisParent.targetNode.getAliasTargetNodes()
//         if (childExpr.instructionNode.getId() === this.store.primitive.aliasInstructionConstructor.getId()) {
//           const isMatch = aliasInstruction.getId() === childExpr.targetNode.getId()
//           if (!isMatch) {
//             throw new Error('Alias parent does not contain alias instruction')
//           }
//           return isMatch && (oneWasFound = true)
//         }
//         if (childExpr.instructionNode.getId() === this.store.primitive.targetConstructor.getId()) {
//           const isMatch = aliasTarget.getId() === childExpr.targetNode.getId()
//           if (!isMatch) {
//             throw new Error('Alias parent does not contain target node')
//           }
//           return isMatch && (oneWasFound = true)
//         }
//       }
//       return this.equals(childExpr)
//   })

//     const instructionIndexInParent = thisParent.getInstructionChildren().findIndex((childExpr) => 

//       this.equals(childExpr)
//     )

//     if (targetIndexInParent === -1 && instructionIndexInParent === -1) {
//       throw new Error('Parent does not contain this child')
//     }

//     if (targetIndexInParent !== -1 && instructionIndexInParent !== -1) {
//       throw new Error('Edge duplicated in instruction and target')
//     }



//     return {
//       parent: thisParent,
//       targetIndexInParent,
//       instructionIndexInParent,
//       siblingRoutes: thisParent.childRoutes
//     }
//   }


//   update( newInstruction: FosNode, newTarget: FosNode): [FosExpression, FosExpression, ...FosExpression[]] {
 
//     if (!this.hasParent()) {

//       const currentRootNode = this.store.getRootNode()

//       const rootNodeWithNewTarget = currentRootNode.setAliasInfo({
//         target: newTarget,
//         instruction: newInstruction,
//         prev: currentRootNode
//       })

//       this.targetNode = newTarget
//       this.instructionNode = newInstruction
//       this.store.setRootNode(rootNodeWithNewTarget)
//       return [new FosExpression(this.store, [])]

//     } else {
//       const { parent } = this.getParentInfo() 

//       let newParentExpression: FosExpression
//       let newAncestors: FosExpression[] = []
      


        
//         const parentContent = parent.targetNode.getContent()
//         const newChildren: FosPathElem[]  = parent.targetNode.getEdges().map((edge, i) => {
//           if (edge[0] === this.instructionNode.getId() && edge[1] === this.targetNode.getId()) {
//             return [newInstruction.getId(), newTarget.getId()]
//           }
//           return edge
//         })
//         const newParentTarget = parent.store.create({
//           data: parentContent.data,
//           children: newChildren
//         })
    
//         const parentInstruction = parent.instructionNode.getContent()
//         const newInstructionChildren: FosPathElem[] = parent.instructionNode.getEdges().map((edge, i) => {
//           if (edge[0] === this.instructionNode.getId() && edge[1] === this.targetNode.getId()) {
//             return [newInstruction.getId(), newTarget.getId()]
//           }
//           return edge
//         })
//         const newParentInstruction = parent.store.create({
//           data: parentInstruction.data,
//           children: newInstructionChildren
//         })

//         const [thisNewParentExpression, ...ancestors] = parent.update(newParentInstruction, newParentTarget)
//         newParentExpression = thisNewParentExpression
//         newAncestors = ancestors 

      

//       let exists = false

//       exists = newParentExpression.getTargetChildren().some((child) => {
//         const sameInstruction = child.targetNode.getId() === newTarget.getId()
//         const sameTarget = child.instructionNode.getId() === this.instructionNode.getId()
//         return sameInstruction && sameTarget
//       })
//       if (!exists){
//         throw new Error('Parent node does not contain this new child')
//       }
//       this.instructionNode = newInstruction
//       this.targetNode = newTarget
//       this.route = [...newParentExpression.route, [newInstruction.getId(), this.targetNode.getId()]]

//       if (newParentExpression.store !== this.store) {
//         throw new Error('Store not updated correctly')
//       }

//       this.store = newParentExpression.store
//       const newExpression = new FosExpression(newParentExpression.store, [...newParentExpression.route, [newInstruction.getId(), this.targetNode.getId()]])
//       if (newExpression.instructionNode.getEdges().length !== newInstruction.getEdges().length) {
//         throw new Error('Instruction node not updated correctly')
//       }

//       return [newExpression, newParentExpression, ...newAncestors]
//     }
//   }

// }


//   proposeChange() {
//     if (this.instructionNode.getId() !== this.store.primitive.brachConstructorNode.getId()) {
//       throw new Error('Method only implemented for branch expressions')
//     }

//     this.update(this.store.primitive.proposalField, this.targetNode)

//   }

 

//   attachUserToGroup(groupStore: FosStore, userStore: FosStore) {
    
//     const groupExpr = new FosExpression(groupStore, [])

//     const userExpr = new FosExpression(userStore, [])


//     const groupAliasNode = groupExpr.getOrMakeAlias()

//     const clonedGroupTargetNode = userStore.cloneNodeFromOtherStore(groupExpr.targetNode)

//     const userGroupShadowNode = userStore.cloneNodeFromOtherStore(groupAliasNode)

//     const userGroupTargetNode = userStore.create({
//       data: {

//       },
//       children: [
//         [userStore.primitive.groupShadowNode.getId(), userGroupShadowNode.getId()],
//       ]
//     })

//     const userGroupEntryExpr =  userExpr.attachChild(userStore.primitive.groupField, groupExpr.targetNode )

//     const groupPeerEntryExpr = groupExpr.attachChild(groupStore.primitive.peerNode, userGroupTargetNode)

//   }



// //  // Type Check Methods
// //  isRoot(): boolean {
// //   return this.route.length === 0
// // }

// // hasParent(): boolean {
// //   return this.route.length > 0
// // }

// // isWorkflow(): boolean {
// //   return this.store.primitive.workflowField.getId() === this.instructionNode.getId()
// // }

// // isOption(): boolean {
// //   return this.store.primitive.optionConstructor.getId() === this.targetNode.getId()
// // }

// // isChoice(): boolean {
// //   return this.store.primitive.choiceTarget.getId() === this.targetNode.getId()
// // }

// // isDocument(): boolean {
// //   return this.store.primitive.documentField.getId() === this.instructionNode.getId()
// // }

// // isComment(): boolean {
// //   return this.expressionType() === this.store.primitive.commentConstructor.getId()
// // }

// // isGroup(): boolean {
// //   return this.expressionType() === this.store.primitive.groupField.getId()
// // }

// // isMarketRequest(): boolean {
// //   return this.expressionType() === this.store.primitive.marketRequestNode.getId()
// // }

// // isMarketService(): boolean {
// //   return this.expressionType() === this.store.primitive.marketServiceNode.getId()
// // }

// // isSearch(): boolean {
// //   return this.expressionType() === this.store.primitive.searchQueryNode.getId()
// // }

// // isSearchResults(): boolean {
// //   return this.expressionType() === this.store.primitive.searchResultsNode.getId()
// // }

// // isLastNameField(): boolean {
// //   return this.expressionType() === this.store.primitive.lastNameField.getId()
// // }

// // isFirstNameField(): boolean {
// //   return this.expressionType() === this.store.primitive.firstNameField.getId()
// // }

// // isEmailField(): boolean {
// //   return this.expressionType() === this.store.primitive.emailField.getId()
// // }

// // isConflict(): boolean {
// //   return this.expressionType() === this.store.primitive.conflictNode.getId()
// // }

// // isError(): boolean {
// //   return this.expressionType() === this.store.primitive.errorNode.getId()
// // }

// // isContact(): boolean {
// //   return this.expressionType() === this.store.primitive.contactField.getId()
// // }

// // isBase(): boolean {
// //   return pathEqual(this.route, this.store.fosRoute)
// // }



    
// // clone(): FosExpression {
// //   throw new Error('Method not implemented')

// //   type CloneReturnVal = { newRows: [FosNodeId, FosNodeId][], newContext: AppStateLoaded["data"] }
// //   const { newRows, newContext }: CloneReturnVal  = nodeContent.children.reduce((acc: CloneReturnVal, childPathElem: FosPathElem) => {
// //       const {
// //           newId: newChildId,
// //           newState: stateWithChild
// //       } = cloneNode(acc.newContext, [...route, childPathElem])
// //       const returnVal: CloneReturnVal = {
// //           newRows: [...acc.newRows, [childPathElem[0], newChildId]],
// //           newContext: stateWithChild
// //       }
// //       return returnVal
// //   }, { newRows: [], newContext: currentAppData })


// //   const newNodeContent: FosNodeContent = {
// //       children: newRows,
// //       data: {
// //           ...nodeData,
// //           description: {
// //               content: `${nodeData.description?.content} (copy - ${new Date().toLocaleString()})`
// //           },
// //           updated: {
// //               time: new Date().getTime(),
// //           },
// //       }
// //   }
// //   const { newId, newState: stateWithNewNode } = insertNewNode(newContext, newNodeContent)
// //   return {
// //       newId,
// //       newState: stateWithNewNode
// //   }
// // }

// // instantiateChildrenAndMapContent() {



// //   type InstReturnVal = { newRows: FosPathElem[], newContext: AppStateLoaded["data"] }




// //   const { newRows, newContext }  = this.targetNode.getContent().children.reduce((acc: InstReturnVal, childPathElem: FosPathElem) => {

// //     const [childType, childId] = childPathElem


// //     const {
// //         newId: newChildId,
// //         newState: stateWithChild,
// //         newType: newChildType
// //     } = this.evaluate(acc.newContext, [...route, childPathElem])
// //     const returnVal: InstReturnVal = {
// //         newRows: [...acc.newRows, [newChildType, newChildId]],
// //         newContext: stateWithChild
// //     }
// //     return returnVal


// //   }, { newRows: [], newContext: startAppData })


// //   const newNodeContent: FosNodeContent = {
// //     children: newRows,
// //     data: {
// //         ...nodeData,
// //         description: {
// //             content: `${nodeData.description?.content}`
// //         },
// //         updated: {
// //             time: new Date().getTime(),
// //         },
// //     }
// //   }
  
// //   const { newId, newState: stateWithNewNode } = insertNewNode(newContext, newNodeContent)
// //   // const { newId, newState: stateWithNewNode } = insertNewNode(newContext, newNodeContent)

// //   return { newId, newState: stateWithNewNode }
// // }



// // evaluate() {

// //   if (this.isOption()){

// //     const { resolutionStrategy, selectedIndex } = this.getOptionInfo()

// //       if (resolutionStrategy === "selected") {

        
// //         throw new Error('Not implemented')

// //         // return {
// //         //     newId: selectedElem[1],
// //         //     newType: selectedElem[0],
// //         //     newState: startAppData
// //         // }

// //       } else if (resolutionStrategy === "race"){
          
// //       const { newId, newState: stateWithNewNode } = this.instantiateChildrenAndMapContent()

// //           return {
// //               newId,
// //               newType: "race",
// //               newState: stateWithNewNode
// //           }
  
      
// //       } else if (resolutionStrategy === "choice"){

// //         const { newId, newState: stateWithNewNode } = this.instantiateChildrenAndMapContent()

// //           return {
// //               newId,
// //               newType: "choice",
// //               newState: stateWithNewNode
// //           }

// //       } else {
// //           throw new Error("Invalid resolution strategy")
// //       }


// //   } else if (this.isTodo()) {


// //     const { newId, newState: stateWithNewNode } = this.instantiateChildrenAndMapContent()


// //       return {
// //           newId: "void",
// //           newType: newId,
// //           newState: stateWithNewNode
// //       }
// //   } else if (this.isChoice()) {

// //       const { newId, newState: stateWithNewNode } = this.instantiateChildrenAndMapContent()
// //       return {
// //           newId: "void",
// //           newType: "newId",
// //           newState: stateWithNewNode
// //       }  

// //   } else {
// //       const { newId, newState: stateWithNewNode } = this.instantiateChildrenAndMapContent()

// //       return {
// //           newId,
// //           newType: this.nodeType(),
// //           newState: stateWithNewNode
// //       }
// //   }

  
// // }
  



// async update(newInstruction: FosNode, newTarget: FosNode): Promise<[FosExpression | null, Delta]> {
//   // async update(oldInstruction: FosNode, oldTarget: FosNode, newInstruction: FosNode, newTarget: FosNode): Promise<[FosExpression | null, Delta]> {

//   const thisOldInstruction = this.instructionNode
//   const thisOldTarget = this.targetNode

//   if (newInstruction.getId() !== this.store.primitive.voidNode.getId()){

//     let newInstructionContent: FosNodeContent = { 
//       data: newInstruction.getContent().data,
//       children: []
//     }
//     for (const instructionChildEdge of newInstruction.getEdges()){
//       const thisInstructionChildExpression = new FosExpression(this.store, [...this.route, instructionChildEdge])
//       const thisNewInstructionChildExpression = await thisInstructionChildExpression.update(
//         thisInstructionChildExpression.instructionNode, 
//         thisInstructionChildExpression.targetNode
//       )
//       if (thisNewInstructionChildExpression){
//         const resultExpr = thisNewInstructionChildExpression[0]
//         if (resultExpr !== null){
//           const newChild = resultExpr.pathElem()
//           newInstructionContent.children.push(newChild)
//         }
//         const newInstructionData: FosDataContent = patch({ left: newInstructionContent.data, delta: thisNewInstructionChildExpression[1] })
//         newInstructionContent.data = newInstructionData
//       }
//     }

//     const evaluatedInstructionNode = this.store.create(newInstructionContent)
  
//     this.instructionNode = evaluatedInstructionNode
//     this.route = [...this.route.slice(0, -1), [evaluatedInstructionNode.getId(), newTarget.getId()]]


//     this.targetNode = newTarget

    
//   } else {
//     this.instructionNode = newInstruction
//     this.route = [...this.route.slice(0, -1), [newInstruction.getId(), newTarget.getId()]]
//   }



//   const { parent, instructionIndexInParent, targetIndexInParent } = this.getParentInfo()

//   if (parent){
//     if (instructionIndexInParent !== -1 && targetIndexInParent !== -1){
//       throw new Error('Edge duplicated in instruction and target')
//     } else if (instructionIndexInParent !== -1 && targetIndexInParent === -1){
//       const newInstructionChildren: FosPathElem[] = parent.instructionNode.getEdges().map((edge, i) => {
//         if (edge[0] === thisOldInstruction.getId() && edge[1] === thisOldTarget.getId()) {
//           return [this.instructionNode.getId(), this.targetNode.getId()]
//         }
//         return edge
//       })
//       const newParentInstruction = parent.store.create({
//         data: parent.instructionNode.getContent().data,
//         children: newInstructionChildren
//       })
//       parent.update(newParentInstruction, parent.targetNode)
//     } else if (instructionIndexInParent === -1 && targetIndexInParent !== -1){
//       const newTargetChildren: FosPathElem[] = parent.targetNode.getEdges().map((edge, i) => {
//         if (edge[0] === thisOldInstruction.getId() && edge[1] === thisOldTarget.getId()) {
//           return [this.instructionNode.getId(), this.targetNode.getId()]
//         }
//         return edge
//       })
//       const newParentTarget = parent.store.create({
//         data: parent.targetNode.getContent().data,
//         children: newTargetChildren
//       })
//       parent.update(parent.instructionNode, newParentTarget)
//     } else {
//       throw new Error('Parent does not contain this child')
//     }



//   } else {
//     /**
//      * 
//      * Figure out how to get alias root
//      * -- can I somehow use the avaialble functions to take care of this?
//      * 
//      * -- alias instruction eval function?
//      * 
//      * 
//      * 
//      * get current alias root and add new 
//      * one pointing to old one
//      */
//   }

//   const instrDelta = diff({ left: thisOldInstruction.getContent().data, right: this.instructionNode.getContent().data })
//   return [this, instrDelta]

// }
  
// fuasdf() {
//   if (!this.isAlias()){
//     throw new Error('Root expression is not alias')
//   }

//   if (!this.hasParent()) {

//     const currentRootNode = this.store.getRootNode()

//     const rootNodeWithNewTarget = currentRootNode.setAliasInfo({
//       target: newTarget,
//       instruction: newInstruction,
//       prev: currentRootNode
//     })

//     this.targetNode = newTarget
//     this.instructionNode = newInstruction
//     this.store.setRootNode(rootNodeWithNewTarget)
//     return [new FosExpression(this.store, [])]

//   } else {
//     const { parent } = this.getParentInfo() 

//     let newParentExpression: FosExpression
//     let newAncestors: FosExpression[] = []
//     const parentIsAlias = parent.isAlias();

//     if (parentIsAlias) {

//       const newParentTarget = parent.targetNode.setAliasInfo({
//         target: newTarget,
//         instruction: newInstruction,
//         prev: parent.targetNode
//       })


//       const [thisNewParentExpression, ...ancestors] = parent.update(parent.instructionNode, newParentTarget)
//       newParentExpression = thisNewParentExpression
//       newAncestors = ancestors
//     } else {

      
//       const parentContent = parent.targetNode.getContent()
//       const newChildren: FosPathElem[]  = parent.targetNode.getEdges().map((edge, i) => {
//         if (edge[0] === this.instructionNode.getId() && edge[1] === this.targetNode.getId()) {
//           return [newInstruction.getId(), newTarget.getId()]
//         }
//         return edge
//       })
//       const newParentTarget = parent.store.create({
//         data: parentContent.data,
//         children: newChildren
//       })
  
//       const parentInstruction = parent.instructionNode.getContent()
//       const newInstructionChildren: FosPathElem[] = parent.instructionNode.getEdges().map((edge, i) => {
//         if (edge[0] === this.instructionNode.getId() && edge[1] === this.targetNode.getId()) {
//           return [newInstruction.getId(), newTarget.getId()]
//         }
//         return edge
//       })
//       const newParentInstruction = parent.store.create({
//         data: parentInstruction.data,
//         children: newInstructionChildren
//       })

//       const [thisNewParentExpression, ...ancestors] = parent.update(newParentInstruction, newParentTarget)
//       newParentExpression = thisNewParentExpression
//       newAncestors = ancestors 
//     }

    

//     const isAlias = newParentExpression.isAlias()
//     let exists = false

//     if (isAlias) {
//       const {
//         instruction: aliasInstruction,
//         target: aliasTarget
//       } = newParentExpression.targetNode.getAliasTargetNodes()
//       exists = aliasInstruction.getId() === newInstruction.getId() && aliasTarget.getId() === newTarget.getId()
//     } else{
//       exists = newParentExpression.getTargetChildren().some((child) => {
//         const sameInstruction = child.targetNode.getId() === newTarget.getId()
//         const sameTarget = child.instructionNode.getId() === this.instructionNode.getId()
//         return sameInstruction && sameTarget
//       })
//     }
//     if (!exists){
//       throw new Error('Parent node does not contain this new child')
//     }
//     this.instructionNode = newInstruction
//     this.targetNode = newTarget
//     this.route = [...newParentExpression.route, [newInstruction.getId(), this.targetNode.getId()]]

//     if (newParentExpression.store !== this.store) {
//       throw new Error('Store not updated correctly')
//     }

//     this.store = newParentExpression.store
//     const newExpression = new FosExpression(newParentExpression.store, [...newParentExpression.route, [newInstruction.getId(), this.targetNode.getId()]])
//     if (newExpression.instructionNode.getEdges().length !== newInstruction.getEdges().length) {
//       throw new Error('Instruction node not updated correctly')
//     }

//     return [newExpression, newParentExpression, ...newAncestors]
//   }

// }

