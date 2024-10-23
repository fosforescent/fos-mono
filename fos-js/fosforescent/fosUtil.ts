// utils/fosUtils.ts

export {}

// import {  FosNodeContent, FosRoute, FosTrail, FosNodesData } from './temp-types';
// import { FosNodeBase, IFosNode } from './fosNodeBase';
// import { diffChars, diffArrays, ArrayChange, Change } from 'diff';


// export function getChildren(context: FosContext, route: FosRoute, index?: number): IFosNode[] {
//   const node = context.getNode(route);
//   const data: FosNodeContent = node.getNodeContent()

//   return data.content.map(([type, id]) => {
//     const newRoute = node.getRoute().concat([[type, id]]) as FosRoute;
//     return context.getNode(newRoute);
//   });
// }


// export const nodeReduce = <T, S>(
//   thisNode: IFosNode, 
//   aggOr: <T>(acc: T, item: FosNodeContent, index: number) => T, 
//   aggAnd: <T>(acc: T, item: IFosNode, index: number) => T, 
//   acc: T, 
//   index?: number 
// ): T => {

//   const children = thisNode.getChildren();

//   if (children.length === 0) {
//     return acc;
//   } else {
//     // Aggregate through each child node
//     return children.reduce((andAgg: T, andChild: IFosNode, i: number) => {
//       const childData = andChild.getNodeContent().data;

//       // Recursive call to nodeReduce for the current child
//       const childAgged: T = nodeReduce(andChild, aggOr, aggAnd, andAgg, index);

//       // Apply the aggOr reducer to each option of the child
//       const orAgged: T = childOptions.reduce((orAgg: T, orChild: FosNodeContent, j: number) => {
//         return aggOr<T>(orAgg, orChild, j);
//       }, childAgged);


//       // Apply the aggAnd reducer to the aggregated result and the current child
//       return aggAnd(orAgged, andChild, i);
//     }, acc);
//   }
// };


// moveNodeRight(route: FosRoute) {
//   const thisNode = this.getNode(route)
//   const [parentNode, childIndex, optionIndex] = thisNode.getParent(1)
//   if (childIndex > 0){
//     const olderSibling = parentNode.getChildren(optionIndex)[childIndex - 1]!
//     const olderSiblingRow = olderSibling.getOptionContent()
//     const newContent = olderSiblingRow.content.concat([[thisNode.getNodeType(), thisNode.getNodeId()]])
//     const newOlderSiblingRowData: FosNodeContent = {
//       ...olderSiblingRow,
//       content: newContent
//     }

//     const parentContent = parentNode.getOptionContent(optionIndex)

//     const newParentContent = parentContent.content.slice(0, childIndex).concat(parentContent.content.slice(childIndex + 1))
//     const newParentRowData = {
//       ...parentContent,
//       content: newParentContent
//     }

//     console.log("MoveNodeRight", newParentContent, newContent, newOlderSiblingRowData, newParentRowData)

//     const contextWithNewOlderSibling = this.setOptionOnNode(olderSibling.getRoute(), newOlderSiblingRowData)
//     const contextWithNewParent = contextWithNewOlderSibling.setOptionOnNode(parentNode.getRoute(), newParentRowData, optionIndex)
//     this.setNodes(contextWithNewParent.data.nodes)

//   } else {
//     throw new Error('cannot move right')
//   }
// }




// moveNodeToTopChild(subjectNode: FosNode, targetNode: FosNode, index?: number){
//   const indexToInsert = targetNode.parseIndex(index)
//   const newEdge = [subjectNode.getNodeType(), subjectNode.getNodeId()] as [string, string]
//   const currentTargetData = targetNode.getOptionContent(indexToInsert)
//   const newTargetData = {
//     ...currentTargetData,
//     content: [newEdge, ...currentTargetData.content]
//   }
//   const newContext = targetNode.setNodeOptionData(indexToInsert, newTargetData)
//   const newContextSubject = newContext.getNode(subjectNode.getRoute())
//   const newContextWithDeleted = newContextSubject.deleteNode()
//   return this.setNodes(newContextWithDeleted.data.nodes)
// }

// moveNodeToOlderSibling(subjectNode: FosNode, targetNode: FosNode, index?: number){
//   const indexToInsert = targetNode.parseIndex(index)
//   const newEdge = [subjectNode.getNodeType(), subjectNode.getNodeId()] as [string, string]
//   const [currentTargetParent, childIndex, parentSelectedIndex] = targetNode.getParent(1)
//   const targetParentData = currentTargetParent.getOptionContent(parentSelectedIndex)

//   const newSubjectIndex = childIndex

//   const beforeContent = targetParentData.content.slice(0, newSubjectIndex)
//   const afterContent = targetParentData.content.slice(newSubjectIndex)

//   const newContent = beforeContent.concat([newEdge]).concat(afterContent)
//   const newContentFiltered = newContent.filter((e, ix) => {
//     return ix === newSubjectIndex ? true : (e[0] !== subjectNode.getNodeType() || e[1] !== subjectNode.getNodeId())
//   })

//   console.log('moveNodeToOlderSibling', newContentFiltered, newSubjectIndex, newContent, beforeContent, afterContent)

//   const newTargetData = {
//     ...targetParentData,
//     content: newContentFiltered
//   }
//   const newContext = currentTargetParent.setNodeOptionData(parentSelectedIndex, newTargetData)
//   return this.setNodes(newContext.data.nodes)

// }

// moveNodeToYoungerSibling(subjectNode: FosNode, targetNode: FosNode, index?: number){
//   const indexToInsert = targetNode.parseIndex(index)
//   const newEdge = [subjectNode.getNodeType(), subjectNode.getNodeId()] as [string, string]
//   const [currentTargetParent, childIndex, parentSelectedIndex] = targetNode.getParent(1)
//   const targetParentData = currentTargetParent.getOptionContent(parentSelectedIndex)

//   const newSubjectIndex = childIndex + 1

//   const beforeContent = targetParentData.content.slice(0, newSubjectIndex)
//   const afterContent = targetParentData.content.slice(newSubjectIndex)
//   const newContent = beforeContent.concat([newEdge]).concat(afterContent)
//   const newContentFiltered = newContent.filter((e, ix) => {
//     return ix === newSubjectIndex ? true : (e[0] !== subjectNode.getNodeType() || e[1] !== subjectNode.getNodeId())
//   })

//   const newTargetData = {
//     ...targetParentData,
//     content: newContentFiltered
//   }
//   const newContext = currentTargetParent.setNodeOptionData(parentSelectedIndex, newTargetData)

//   return this.setNodes(newContext.data.nodes)

// }


// moveNodeUp(route: FosRoute) {
//   throw new Error('not implemented')
// }

// moveNodeDown(route: FosRoute) {
//   throw new Error('not implemented')
// }

// removeNodeFromParent(route: FosRoute) {
//   throw new Error('not implemented')
// }

// deleteOption(route: FosRoute, index?: number) {
//   // this.setOptionOnNode(route, null, index)
//   throw new Error('not implemented')
// }

// deleteNode(route: FosRoute): FosContext {
//   throw new Error('not implemented')
// }


// snipNode(route: FosRoute): FosContext {
//   throw new Error('not implemented')
// }


// moveNodeLeft(route: FosRoute) {
//   const thisNode = this.getNode(route)
//   const [parentNode, childIndex, parentOptionIndex] = thisNode.getParent(1)
//   const [grandParentNode, parentIndex, grandparentOptionIndex] = thisNode.getParent(2)    

//   const parentRowContent = parentNode.getOptionContent(parentOptionIndex)
//   const newParentRows = parentRowContent.content.slice(0, childIndex).concat(parentRowContent.content.slice(childIndex + 1))
//   const newParentContent = {
//     ...parentRowContent,
//     content: newParentRows
//   }

//   const grandParentRowContent = grandParentNode.getOptionContent(grandparentOptionIndex)
//   const grandparentRowsStart = grandParentRowContent.content.slice(0, parentIndex + 1)
//   const grandparentRowsEnd = grandParentRowContent.content.slice(parentIndex + 1)
//   const newGrandparentRows = grandparentRowsStart.concat([[thisNode.getNodeType(), thisNode.getNodeId()]]).concat(grandparentRowsEnd)


//   const newGrandparentContent = {
//     ...grandParentRowContent,
//     content: newGrandparentRows
//   }


//   console.log('moveNodeLeft', newGrandparentContent, newParentContent)

//   const contextWithNewGrandparent = this.setOptionOnNode(grandParentNode.getRoute(), newGrandparentContent, grandparentOptionIndex)
//   const contextWithNewParent = contextWithNewGrandparent.setOptionOnNode(parentNode.getRoute(), newParentContent, parentOptionIndex)

//   this.setNodes(contextWithNewParent.data.nodes)

// }

// addYoungerSibling(route: FosRoute) {
//   console.log('addYoungerSibling', route)
//   const thisNode = this.getNode(route)
//   const [parentNode, childIndex, optionIndex] = thisNode.getParent(1)
//   const newContext = this.addNewTaskToOption(parentNode.getRoute(), childIndex, optionIndex)
//   this.setNodes(newContext.data.nodes, newContext.data.focus, newContext.data.trail)
// }



// getUpNode() {
//   // console.log('moveFocusUp', this.route)
//   try {
//     // console.log('moveFocusUp - parent', this.route)
//     const [parentNode, childIndex, optionIndex] = this.getParent(1)
//     const children = parentNode.getChildren(optionIndex)
//     // console.log('moveFocusUp - parent', childIndex)
//     if (childIndex === 0) {
//       const newRoute = parentNode.getRoute()
//       // console.log('moveFocusUp - parent act', this.route)
//       const parentDescription = parentNode.getNodeData().description
//       const charPosition = charpos ? (charpos < 0 ? parentDescription.length + charpos : charpos) : this.context.data.focus.char
//       const newContext = this.context.setFocus(newRoute, charPosition)
//       return newContext
      
//     } else {
//       // console.log('moveFocusUp - hasoldersib', this.route)
//       const nextChild = children[childIndex - 1] as FosNode
//       const nextChildData = nextChild.getNodeData()
//       const nextChildChildren = nextChild.getChildren()
//       if (nextChildData.collapsed || nextChildChildren.length === 0){
//         const newRoute = nextChild.getRoute()
//         const nextChildDescription = nextChild.getNodeData().description
//         const charPosition = charpos ? (charpos < 0 ? nextChildDescription.length + charpos : charpos) : this.context.data.focus.char
//         const newContext = this.context.setFocus(newRoute, charPosition)
//         return newContext  
//       }else{
//         const lastDescendent = nextChild.getLastDescendent()
//         const newRoute = lastDescendent.getRoute()
//         const lastDescendentDescription = lastDescendent.getNodeData().description
//         const charPosition = charpos ? (charpos < 0 ? lastDescendentDescription.length + charpos : charpos) : this.context.data.focus.char
//         const newContext = this.context.setFocus(newRoute, charPosition)
//         return newContext
//       }
//     }
//   } catch (e) {
//     console.log('moveFocusDown - no parent', e)
//     return 
//   }

// }

// getDownNode() {
// // console.log('moveFocusDown', this.route)
// if (!this.getNodeData().collapsed && !ignoreChildren){
//   // console.log('moveFocusDown - not collapsed', this.route)
//   const thisNodeChildren = this.getChildren()
//   if (thisNodeChildren.length > 0) {
//     // console.log('moveFocusDown - hasChildren', this.route)
//     const firstChild = thisNodeChildren[0] as FosNode
//     const newRoute = firstChild.getRoute()
//     const newContext = this.context.setFocus(newRoute, this.context.data.focus.char)
//     return newContext
//   }
// }
// try {
//   // console.log('moveFocusDown - parent', this.route)
//   const [parentNode, childIndex, optionIndex] = this.getParent(1)
//   const children = parentNode.getChildren(optionIndex)
//   if (childIndex === children.length - 1) {
//     // console.log('at last sib')
//     try {
//       // console.log('moveFocusDown - grandparent', this.route)
//       parentNode.moveFocusDown(true)
      
//     } catch (e) {
//       // console.log('moveFocusDown - no grandparent', e)
//       return 
//     }
//     // console.log('moveFocusDown - grandparent2', this.route)

//   } else {
//     // console.log('moveFocusDown - hasSib', this.route)
//     const nextChild = children[childIndex + 1] as FosNode
//     const newRoute = nextChild.getRoute()
//     const newContext = this.context.setFocus(newRoute, this.context.data.focus.char)
//     return newContext
//   }
// } catch (e) {
//   console.log('moveFocusDown - no parent', e)
//   return 
// }
// }

