
import { AppState, FosContextData, FosDataContent, FosNodeContent, FosNodeId, FosNodesData, FosPathElem, FosPath } from "./types"
import { getAncestorLeastUpSibling, getDownSibling,  getUpNode, getUpSibling } from "./utils"

import { v4 as uuidv4 } from 'uuid';
import { getExpressionInfo } from "./dag-implementation/expression";

export const updateFosData = (currentAppData: AppState['data'], newFosData: FosContextData): AppState["data"] => {
    return {
        ...currentAppData,
        fosData: newFosData
    }
}

export  const updateNodeContent = (currentAppData: AppState['data'], newNodeContent: FosNodeContent, route: FosPath): AppState["data"] => {
    const { nodeId, nodeData, nodeContent } = getExpressionInfo(route, currentAppData)

    newNodeContent.children.forEach(([childType, childId]: FosPathElem) => {
        if (childId === nodeId){
            throw new Error('Cannot add node as child of itself')
        }
    })


    const newNodesData: FosNodesData = {
        ...currentAppData.fosData.nodes,
        [nodeId]: {
            ...newNodeContent,
            data: {
                ...newNodeContent.data,
                updated: {
                    time: Date.now(),
                },
            },
        }
    }

    const newAppState: AppState["data"] = {
        ...currentAppData,
        fosData: {
            ...currentAppData.fosData,
            nodes: newNodesData
        },
    }
    return newAppState
}

export  const updateFocus = (currentAppData: AppState['data'], focusChar: number, route: FosPath): AppState["data"] => {
     const newTrellisData = {
         ...currentAppData.trellisData,
         focusChar,
         focusRoute: route
     }
     return {
        ...currentAppData,
        trellisData: newTrellisData
     }

}

export const updateNodeData = (currentAppData: AppState['data'], newNodeData: Partial<FosDataContent>, route: FosPath): AppState["data"] => {

    const { nodeId, nodeData, nodeContent } = getExpressionInfo(route, currentAppData)
    const updatedNodeData: FosDataContent = {
        ...nodeData,
        ...newNodeData,
        updated: {
            time: new Date().getTime(),
        }
    }

    const newNodeContent: FosNodeContent = {
        ...nodeContent,
        data: updatedNodeData
    }

    return updateNodeContent(currentAppData, newNodeContent, route)
}

export const updateZoom = (currentAppData: AppState['data'], route: FosPath): AppState["data"] => {
    return updateFosData(currentAppData, {
        ...currentAppData.fosData,
        route: route
    })
}

export const addChild = (currentAppData: AppState['data'], route: FosPath, newType: FosNodeId, newNodeContent: FosNodeContent, index: number = -1): { childRoute: FosPath, newState: AppState["data"] }  => {
    const { nodeId, nodeData, nodeContent } = getExpressionInfo(route, currentAppData)
    const { newId, newState: newState1 }  = insertNewNode(currentAppData, newNodeContent)
    const newPathElem: FosPathElem = [newType, newId]
    if (index < -1 || index > nodeContent.children.length){
        throw new Error('Index out of range')
    }
    // console.log("index", index)
    const newRows = index < 0
        ? [...nodeContent.children, newPathElem]
        : [...nodeContent.children.slice(0, index), newPathElem, ...nodeContent.children.slice(index)]
    const newContent = {
        ...nodeContent,
        children: newRows,
        data: {
            ...nodeData,

        }
    }
    const newState = updateNodeContent(newState1, newContent, route)
    const childRoute: FosPath = [...route, [newType, newId]]
    return { childRoute, newState }
}

export const attachChild = (currentAppData: AppState['data'], route: FosPath, newRowType: FosNodeId, newRowId: FosNodeId, index: number): { childRoute: FosPath, newState: AppState["data"] } => {
    const { nodeId, nodeData, nodeContent } = getExpressionInfo(route, currentAppData)
    const newPathElem: FosPathElem = [newRowType, newRowId]
    const newContent = {
        ...nodeContent,
        children: [...nodeContent.children.slice(0, index), newPathElem, ...nodeContent.children.slice(index)]
    }
    const newState = updateNodeContent(currentAppData, newContent, route)
    const childRoute: FosPath = [...route, [newRowType, newRowId]]
    return { childRoute, newState }
}

export const attachSibling = (currentAppData: AppState['data'], route: FosPath, newRowType: FosNodeId, newRowId: FosNodeId, position: number | string ): { childRoute: FosPath, newState: AppState["data"] }  => {
    // add option node to parent, put current node under it, and add new option
    const { getParentInfo, nodeData } = getExpressionInfo(route, currentAppData)
    const { nodeData: parentData, nodeContent: parentContent, nodeChildren: parentChildren, indexInParent, nodeRoute: parentRoute } = getParentInfo()
    let index = 0
    if (typeof position === 'number'){
        index = position
    } else if (position === 'after'){
        index = indexInParent + 1
    } else if (position === 'before'){
        index = indexInParent
    } else if (position === 'first'){
        index = 0
    } else if (position === 'last'){
        index = parentChildren.length
    }

    const returnVal = attachChild(currentAppData, parentRoute, newRowType, newRowId, index)
    return returnVal
}

export const addSibling = (currentAppData: AppState['data'], route: FosPath, newRowType: FosNodeId, newNodeContent: FosNodeContent, position: number | string ): { childRoute: FosPath, newState: AppState["data"] }  => {
    // add option node to parent, put current node under it, and add new option
    const { getParentInfo, nodeData } = getExpressionInfo(route, currentAppData)
    const { nodeData: parentData, nodeContent: parentContent, nodeChildren: parentChildren, indexInParent, nodeRoute: parentRoute } = getParentInfo()
    let index = 0
    if (typeof position === 'number'){
        index = position
    } else if (position === 'after'){
        index = indexInParent + 1
    } else if (position === 'before'){
        index = indexInParent
    } else if (position === 'first'){
        index = 0
    } else if (position === 'last'){
        index = parentChildren.length
    }

    const stateWithSibling = addChild(currentAppData, parentRoute, newRowType, newNodeContent, index)
    return stateWithSibling
}


export const removeNode = (currentAppData: AppState['data'], route: FosPath, indexHint?: number): AppState["data"] => {
    const { nodeType, nodeId, hasParent, getParentInfo } = getExpressionInfo(route, currentAppData)
    if (!hasParent) {
        throw new Error('Cannot remove root node')
    }
    const { nodeId: parentId, nodeContent: parentContent, nodeRoute: parentRoute, indexInParent } = getParentInfo()


    console.log('removeNode', route, parentContent.children, indexHint, indexInParent, parentContent.children[indexInParent], parentContent.children[indexHint || 0])
    const newParentContent = {
        ...parentContent,
        children: parentContent.children.filter(([childType, childId], i) =>  childType !== nodeType || childId !== nodeId)
    }
    return updateNodeContent(currentAppData, newParentContent, parentRoute)
}




export const generateId = (currentAppData: AppState['data'], newNodeContent: FosNodeContent ): FosNodeId => {
  let newIdResult: FosNodeId = uuidv4();
  console.log('generateId', currentAppData, newNodeContent, newIdResult)
  while (currentAppData.fosData.nodes[newIdResult]){
      newIdResult = generateId(currentAppData, newNodeContent)
  }
  return newIdResult;
}

export const insertNewNode = (currentAppData: AppState['data'], newNodeContent: FosNodeContent): {newId: FosNodeId, newState: AppState["data"]} => {
    const newId = generateId(currentAppData, newNodeContent)
    const newNodesData: FosNodesData = {
        ...currentAppData.fosData.nodes,
        [newId]: {
            ...newNodeContent,
            data: {
                ...newNodeContent.data,
                updated: {
                    time: new Date().getTime(),
                },
            }
        }
    }

    return {
        newId, 
        newState: {
            ...currentAppData,
            fosData: {
                ...currentAppData.fosData,
                nodes: newNodesData
            }
        }
    }
}


export const cloneNode = (currentAppData: AppState['data'], route: FosPath): { newId: FosNodeId, newState: AppState["data"] } => {
    const { nodeId, nodeData, nodeContent } = getExpressionInfo(route, currentAppData)

    type CloneReturnVal = { newRows: [FosNodeId, FosNodeId][], newContext: AppState["data"] }
    const { newRows, newContext }: CloneReturnVal  = nodeContent.children.reduce((acc: CloneReturnVal, childPathElem: FosPathElem) => {
        const {
            newId: newChildId,
            newState: stateWithChild
        } = cloneNode(acc.newContext, [...route, childPathElem])
        const returnVal: CloneReturnVal = {
            newRows: [...acc.newRows, [childPathElem[0], newChildId]],
            newContext: stateWithChild
        }
        return returnVal
    }, { newRows: [], newContext: currentAppData })


    const newNodeContent: FosNodeContent = {
        children: newRows,
        data: {
            ...nodeData,
            description: {
                content: `${nodeData.description?.content} (copy - ${new Date().toLocaleString()})`
            },
            updated: {
                time: new Date().getTime(),
            },
        }
    }
    const { newId, newState: stateWithNewNode } = insertNewNode(newContext, newNodeContent)
    return {
        newId,
        newState: stateWithNewNode
    }
}

export const changeInstruction = (currentAppData: AppState['data'], route: FosPath, newInstruction: FosNodeId): {newRoute: FosPath, newState: AppState["data"]} => {
    const { getParentInfo, nodeData, nodeId } = getExpressionInfo(route, currentAppData)
    const { nodeData: parentData, nodeContent: parentContent, nodeChildren: parentChildren, indexInParent, nodeRoute: parentRoute } = getParentInfo()
    const newElem: FosPathElem = [newInstruction, nodeId]
    const newParentContent = {
        ...parentContent,
        children: parentContent.children.map((_, i) => i === indexInParent ? newElem : _)
    }
    return {
        newRoute: [...parentRoute, newElem],
        newState: updateNodeContent(currentAppData, newParentContent, parentRoute)
    }

}


export const snipNode = (nodeRoute: FosPath, appData: AppState["data"]): AppState["data"] => {
    const { nodeData, nodeContent, nodeChildren, getParentInfo } = getExpressionInfo(nodeRoute, appData)
  
    const { indexInParent, nodeContent: parentContent, nodeRoute: parentRoute } = getParentInfo()
  
    const newParentRows: FosPathElem[] = parentContent.children.reduce((acc: FosPathElem[], child: FosPathElem, i: number) => {
      if (i !== indexInParent){
        return [...acc, ...nodeChildren]
      }
      return [...acc, child]
    }, [])
  
    const newParentContent = {
      ...parentContent,
      children: newParentRows,
    }
  
    const newState = updateNodeContent(appData, newParentContent, parentRoute)
    return newState
  
  }

  
 
  export const moveNodeAboveRoute = (appData: AppState["data"], subjectRoute: FosPath, targetRoute: FosPath): { newRoute: FosPath, newState: AppState["data"] } => {
    const { nodeId: subjectId, nodeType: subjectType } = getExpressionInfo(subjectRoute, appData)

    const stateWithOriginalRemoved = removeNode(appData, subjectRoute) 

    
    const  { nodeData, nodeContent, nodeChildren, getParentInfo } = getExpressionInfo(targetRoute, stateWithOriginalRemoved)
    const { indexInParent, nodeContent: parentContent, nodeRoute: parentRoute } = getParentInfo()

    const newParentRows: FosPathElem[] = parentContent.children.reduce((acc: FosPathElem[], child: FosPathElem, i: number) => {
      if (i === indexInParent){
        const newElem: FosPathElem = [subjectType, subjectId]
        return [...acc, newElem, child]
      }
      return [...acc, child]
    }, [])
  
    const newParentContent = {
      ...parentContent,
      children: newParentRows,
    }
  
    const newState = updateNodeContent(stateWithOriginalRemoved, newParentContent, parentRoute)
    console.log('newState', appData, newState, stateWithOriginalRemoved, newParentContent, parentRoute)
    return { newState: newState, newRoute: [...parentRoute, [subjectType, subjectId]] }
  
  }
  
  export const moveNodeBelowRoute = (appData: AppState["data"], subjectRoute: FosPath, targetRoute: FosPath): { newRoute: FosPath, newState: AppState["data"] } => {

    const { nodeId: subjectId, nodeType: subjectType } = getExpressionInfo(subjectRoute, appData)
  
    const stateWithOriginalRemoved = removeNode(appData, subjectRoute)


    const  { nodeData, nodeContent, nodeChildren, getParentInfo } = getExpressionInfo(targetRoute, stateWithOriginalRemoved)
    const { indexInParent, nodeContent: parentContent, nodeRoute: parentRoute } = getParentInfo()


    const newParentRows: FosPathElem[] = parentContent.children.reduce((acc: FosPathElem[], child: FosPathElem, i: number) => {
      if (i === indexInParent){
        const newElem: FosPathElem = [subjectType, subjectId]
        return [...acc, child, newElem]
      }
      return [...acc, child]
    }, [])
  
    const newParentContent = {
      ...parentContent,
      children: newParentRows,
    }
  
    const newState = updateNodeContent(stateWithOriginalRemoved, newParentContent, parentRoute)
    return { newState, newRoute: [...parentRoute, [subjectType, subjectId]] }
  
  }
  
  export const moveNodeIntoRoute = (appData: AppState["data"], subjectRoute: FosPath, targetRoute: FosPath, index: number = 0): { newRoute: FosPath, newState: AppState["data"] } => {
    const { nodeData, nodeContent, nodeChildren } = getExpressionInfo(targetRoute, appData)
    const { nodeId: subjectId, nodeType: subjectType } = getExpressionInfo(subjectRoute, appData)
  
    const newElem: FosPathElem = [subjectType, subjectId]
    const newParentRows: FosPathElem[] = index < 0 
        ? [...nodeContent.children, newElem]
        : index === 0
            ? [ newElem ] 
            : nodeContent.children.reduce((acc: FosPathElem[], child: FosPathElem, i: number) => {
        if (i === index){
            return [...acc, newElem, child]
        }
        return [...acc, child]
        }, [])

    console.log('newParentRows', newParentRows, targetRoute, newElem, index, nodeContent.children)
    const newParentContent = {
      ...nodeContent,
      children: newParentRows,
    }
  
    const newState = updateNodeContent(appData, newParentContent, targetRoute)
    const stateWithOriginalRemoved = removeNode(newState, subjectRoute)

    console.log('stateWithOriginalRemoved', stateWithOriginalRemoved, appData)
    return { newState: stateWithOriginalRemoved, newRoute: [...targetRoute, [subjectType, subjectId]] }
  }
  
  export const reorderNodeChildren = (appData: AppState["data"], subjectRoute: FosPath, newOrder: number[]): AppState["data"] => {
    const { nodeData, nodeContent, nodeChildren } = getExpressionInfo(subjectRoute, appData)

    if (newOrder.length !== nodeContent.children.length){
      throw new Error('New order does not match number of children')
    }

    for (let i = 0; i < newOrder.length; i++){
      if (newOrder.indexOf(i) === -1){
        throw new Error('New order does not contain all children')
      }

    }

    const newContent = {
      ...nodeContent,
      children: newOrder.map(i => nodeContent.children[i]!)
    }
    return updateNodeContent(appData, newContent, subjectRoute)


  }

export const moveLeft = (appData: AppState["data"], route: FosPath): { newRoute: FosPath, newState: AppState["data"] }  => {
    const { nodeData, nodeContent, nodeChildren, getParentInfo } = getExpressionInfo(route, appData)
    const { 
        nodeData: parentData, 
        nodeContent: parentContent, 
        nodeChildren: parentChildren, 
        indexInParent, 
        nodeRoute: parentRoute,
        getParentInfo: getGrandParentInfo,
        siblingRoutes
    } = getParentInfo()

    if (parentRoute.length === 1){
        return { newRoute: route, newState: appData }
    }

    // const { 
    //     nodeData: grandParentData, 
    //     nodeContent: grandParentContent, 
    //     nodeChildren: grandParentChildren, 
    //     indexInParent: indexInGrandParent, 
    //     nodeRoute: grandParentRoute 
    // } = getGrandParentInfo()

    const addLowerSiblingsToNodeState = siblingRoutes.reduce((acc: AppState["data"], siblingRoute: FosPath, i: number) => {
        if (i < indexInParent + 1){
            return acc
        } else {
            console.log('siblingRoute', siblingRoute, route, i, indexInParent)
            throw new Error('Not implemented')
            const { newState } = moveNodeIntoRoute(acc, siblingRoute, route, i - indexInParent + 1)
            return newState
        }
    }, appData)

    const result = moveNodeBelowRoute(addLowerSiblingsToNodeState, route, parentRoute)

    return result
}

export const moveRight = (appData: AppState["data"], route: FosPath): { newRoute: FosPath, newState: AppState["data"] }  => {
    const { nodeData, nodeContent, nodeChildren, getParentInfo } = getExpressionInfo(route, appData)

    /** TODO
     *  this should use getUpSibling and be put inside that node if it's a sibling
     *  if it's an uncle, then it should be put inside the uncle node
     *  if it's an ancestor of an older sibling, then it should be moved under
     *  this node, and then this node should be moved to a down sibling of whatever
     *  it's nested under
     */

    const upSiblingRoute = getUpNode(route, appData)
    const actualUpSibling = getUpSibling(route, appData)

    console.log('upSiblingRoute', upSiblingRoute)
    if (upSiblingRoute) {
        const { nodeChildren: upSiblingChildren } = getExpressionInfo(upSiblingRoute, appData)
        const {
            newState: newState1,
            newRoute: newRoute1
        } = moveNodeIntoRoute(appData, route, upSiblingRoute, upSiblingChildren.length)
        if (actualUpSibling){
            console.warn('this is a case that needs to be caught for better useability')
        }        
        return { newRoute: newRoute1, newState: newState1 }      
    } 
    return { newRoute: route, newState: appData }   
}

export const moveUp = (appData: AppState["data"], route: FosPath): { newRoute: FosPath, newState: AppState["data"] }  => {
    const { nodeData, nodeContent, nodeChildren, getParentInfo } = getExpressionInfo(route, appData)
    const { nodeRoute: parentRoute, indexInParent } = getParentInfo()
    const upSibling = getUpSibling(route, appData)


    console.log('upSibling', upSibling)
    if (upSibling){
        return moveNodeAboveRoute(appData, route, upSibling)
    } else {
        const leastUpSibling = getAncestorLeastUpSibling(route, appData)
        console.log('leastUpSibling', leastUpSibling)
        if (leastUpSibling){
            return moveNodeIntoRoute(appData, route, leastUpSibling, -1)
        } else {
            return moveNodeAboveRoute(appData, route, parentRoute)
        }
    }

}

export const moveDown = (appData: AppState["data"], route: FosPath): { newRoute: FosPath, newState: AppState["data"] }  => {
    const { nodeData, nodeContent, nodeChildren, getParentInfo } = getExpressionInfo(route, appData)
    const { nodeRoute: parentRoute, indexInParent } = getParentInfo()
    const downSibling = getDownSibling(route, appData)
    if (downSibling){
        return moveNodeBelowRoute(appData, route, downSibling)
    } else {
        // move above parent
        throw new Error('Not implemented')
        // return moveNodeIntoRoute(appData, route, parentRoute, 0)
    }
}


export const executeWorkflowAtRoute = (appData: AppState["data"], route: FosPath, attachToRoot: FosPath): { newState: AppState["data"], newRoute: FosPath } => {

    const { nodeId: workflowId } = getExpressionInfo(route, appData)

    const rootRoute: FosPath = route.slice(0, 1)

    const { newId: contextId, newState } = cloneNode( appData, rootRoute)

    const stateWithNewTodo =  attachChild(newState, attachToRoot, workflowId, contextId, -1)

    return { newState: stateWithNewTodo.newState, newRoute: [...attachToRoot, ["task", contextId]] }

}



const instantiateChildrenAndMapContent = (startAppData: AppState["data"], route: FosPath) => {


  const { nodeId, nodeType, nodeData, nodeContent, isOption, isChoice, getOptionInfo} = getExpressionInfo(route, startAppData)


  type InstReturnVal = { newRows: FosPathElem[], newContext: AppState["data"] }





  const { newRows, newContext }  = nodeContent.children.reduce((acc: InstReturnVal, childPathElem: FosPathElem) => {

    const [childType, childId] = childPathElem


    const {
        newId: newChildId,
        newState: stateWithChild,
        newType: newChildType
    } = evaluate(acc.newContext, [...route, childPathElem])
    const returnVal: InstReturnVal = {
        newRows: [...acc.newRows, [newChildType, newChildId]],
        newContext: stateWithChild
    }
    return returnVal


  }, { newRows: [], newContext: startAppData })


  const newNodeContent: FosNodeContent = {
    children: newRows,
    data: {
        ...nodeData,
        description: {
            content: `${nodeData.description?.content}`
        },
        updated: {
            time: new Date().getTime(),
        },
    }
  }
  
  const { newId, newState: stateWithNewNode } = insertNewNode(newContext, newNodeContent)
  // const { newId, newState: stateWithNewNode } = insertNewNode(newContext, newNodeContent)

  return { newId, newState: stateWithNewNode }
}



export const evaluate = (startAppData: AppState["data"], route: FosPath): { newId: FosNodeId, newState: AppState["data"], newType: FosNodeId } => {


  // todo: apply context to child of each node in p

const { nodeId, nodeType, nodeData, nodeContent, isOption, isTodo, isChoice, getOptionInfo} = getExpressionInfo(route, startAppData)


  if (isOption){




     const { resolutionStrategy, selectedIndex } = getOptionInfo()

      if (resolutionStrategy === "selected") {

         
        throw new Error('Not implemented')

        // return {
        //     newId: selectedElem[1],
        //     newType: selectedElem[0],
        //     newState: startAppData
        // }

      } else if (resolutionStrategy === "race"){
          
      const { newId, newState: stateWithNewNode } = instantiateChildrenAndMapContent(startAppData, route)

          return {
              newId,
              newType: "race",
              newState: stateWithNewNode
          }
  
      
      } else if (resolutionStrategy === "choice"){

        const { newId, newState: stateWithNewNode } = instantiateChildrenAndMapContent(startAppData, route)

          return {
              newId,
              newType: "choice",
              newState: stateWithNewNode
          }

      } else {
          throw new Error("Invalid resolution strategy")
      }


  } else if (isTodo) {


    const { newId, newState: stateWithNewNode } = instantiateChildrenAndMapContent(startAppData, route)


      return {
          newId: "void",
          newType: newId,
          newState: stateWithNewNode
      }
  } else if (isChoice) {



      const { newId, newState: stateWithNewNode } = instantiateChildrenAndMapContent(startAppData, route)


      return {
          newId: "void",
          newType: "newId",
          newState: stateWithNewNode
      }


  } else {


      const { newId, newState: stateWithNewNode } = instantiateChildrenAndMapContent(startAppData, route)

      return {
          newId,
          newType: nodeType,
          newState: stateWithNewNode
      }
  }

  
}


