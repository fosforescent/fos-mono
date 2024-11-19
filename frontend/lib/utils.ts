import e from "cors"
import { FosNodesData, FosPath, AppState, FosRoute, FosPathElem, FosNodeId } from "../types"
import { updateNodeContent } from "./mutations"
import { get } from "http"
import { is } from "date-fns/locale"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getNodeDescription = (nodeRoute: FosRoute, state: AppState["data"]) => {
    const nodeId = nodeRoute[nodeRoute.length - 1]?.[1]
  
    if (!nodeId){
      throw new Error('nodeType or nodeId is undefined')
    }
  
    const nodeContent =  state.fosData.nodes[nodeId]
  
    if (!nodeContent){
      throw new Error('nodeContent is undefined')
    }
  
    const description = nodeContent?.data.description?.content
  
    if (!nodeContent?.data.description || description === undefined){
      console.log( nodeContent)
      throw new Error('description is undefined')
    }
  
    return description
}



export const getNodeContent = (nodeRoute: FosRoute, state: AppState["data"]) => {
    const [nodeType, nodeId] = nodeRoute[nodeRoute.length - 1]!
    if (!nodeType || !nodeId){
        throw new Error('nodeType or nodeId is undefined')
    }
    
    const nodeContent = state.fosData.nodes[nodeId]

    if (!nodeContent){
        throw new Error('nodeContent is undefined')
    }

    return nodeContent
}

export const getNodeChildren = (nodeRoute: FosRoute, state: AppState["data"]) => {
    const nodeContent = getNodeContent(nodeRoute, state)
    if (!nodeContent){
      throw new Error('nodeContent is undefined')
    } 
    const nodeChildren = nodeContent.content
    return nodeChildren
}

export const getNodeData = (nodeRoute: FosRoute, state: AppState["data"]) => {
    const nodeContent = getNodeContent(nodeRoute, state)
    if (!nodeContent){
      throw new Error('nodeContent is undefined')
    } 
    const nodeData = nodeContent.data
    return nodeData
}


  
export const getOptions = (nodeRoute: FosRoute, state: AppState["data"]) => {
    const [nodeType, nodeId] = nodeRoute[nodeRoute.length - 1]!
    if (!nodeType || !nodeId){
        throw new Error('nodeType or nodeId is undefined')
    }
    const nodeChildren = getNodeChildren(nodeRoute, state)
    if (nodeType === 'option'){
      return nodeChildren.map((child, index) => {
        return ({value: index.toString(), label: getNodeDescription(nodeRoute, state)})
      })
    }else if (nodeType === 'workflow'){
      return [{value: '0', label: getNodeDescription(nodeRoute, state)}]
    }else{
      console.log('node', nodeRoute)
      throw new Error('getoptions must be used on a task or option node')
    }

    // const getOptions = (node: FosWrapper) => {
    //   if (node.getNodeType() === 'option'){
    //     // console.log('node', node)
    //     return node.getOptions().map((child, index) => {
    //       return ({value: index.toString(), label: getDescription(child)})
    //     })
    //   }else if (node.getNodeType() === 'workflow'){
    //     return [{value: '0', label: getDescription(node)}]
    //   }else{
    //     console.log('node', node)
    //     throw new Error('getoptions must be used on a task or option node')
    //   }
    // }
  
}

export const getDragItem = (nodeRoute: FosRoute, breadcrumb: boolean) => {
    const [nodeType, nodeId] = nodeRoute[nodeRoute.length - 1]!
    if (!nodeType || !nodeId){
        throw new Error('nodeType or nodeId is undefined')
    }
    
    const dragItem = {
        id: `${nodeType}-${nodeId}`,
        data: { nodeRoute, breadcrumb },
        breadcrumb
    }
    return dragItem
}

export const getNodeInfo = (nodeRoute: FosRoute, state: AppState) => getNodeInfoShared(nodeRoute, state.data)

export const getNodeInfoShared = (nodeRoute: FosRoute, state: AppState["data"]) => {

  if (!nodeRoute){
    console.log('nodeRoute undefined', state)
    
    throw new Error('nodeRoute is undefined')
  }

  const [nodeType, nodeId] = nodeRoute[nodeRoute.length - 1]!
  if (!nodeType || !nodeId){
    console.log('nodeRoute', nodeRoute, state)
    throw new Error('nodeType or nodeId is undefined')
  }
  
  const isCollapsed = state.trellisData.collapsedList.some((route) => pathEqual(route, nodeRoute))

  const nodeContent = getNodeContent(nodeRoute, state)
  const nodeChildren = getNodeChildren(nodeRoute, state)
  const childRoutes: FosRoute[] = nodeChildren.map((child) => [...nodeRoute, child])
  const nodeData = getNodeData(nodeRoute, state)
  const nodeDescription = getNodeDescription(nodeRoute, state)

  const isTask = ["workflow", "todo", "option"].includes(nodeType)
  const isRoot = nodeType === "root"
  const isComment = nodeType === "comment"
  const isDocument = nodeType === "document"
  const isOption = nodeType === "option"
  const isChoice = nodeType === "choice"
  const isMaxDepth = false
  const isBase = nodeRoute.length === state.fosData.route.length
  const isSmallWindow = window.innerWidth !== undefined && window.innerWidth < 500
  const locked = false


  const hasFocus = pathEqual(state.trellisData.focusRoute, nodeRoute)
  const focusChar = state.trellisData.focusChar



  const disabled = false

  const depth = nodeRoute.length - state.fosData.route.length

  const maxDepth = ( (window.innerWidth - 500) / 100)

  const isTooDeep = depth > maxDepth
  const hasChildren = childRoutes.length > 0
  
  const nodeLabel = `${nodeType}-${nodeId}`  

  const truncatedDescription = nodeDescription.length > 20 ? nodeDescription.slice(0, 17) + '...' : nodeDescription


  const hasParent = nodeRoute.length > 1
  
  const childrenVisible = !isCollapsed && !isTooDeep

  const isChildOf = (argNodeRoute: FosRoute) => {
    const matches = argNodeRoute.every((argNodeElem, index) => {
      return argNodeElem[0] === nodeRoute[index]?.[0] && argNodeElem[1] === nodeRoute[index]?.[1]
    })
    return matches
  }

     
  const {
    dragging, 
    dragOverInfo,
   } = state.trellisData.dragInfo


  
  const isDraggingParent = !!(dragging && dragging.nodeRoute && isChildOf(dragging.nodeRoute))

  const isDragging = pathEqual(dragging?.nodeRoute || [], nodeRoute)
  const somethingIsDragging = dragging !== null
  const draggingOver = pathEqual(dragOverInfo?.nodeRoute || [], nodeRoute)
  

  return {
      childRoutes,
      disabled,
      isCollapsed,
      locked,
      nodeType,
      nodeId,
      nodeContent,
      nodeChildren,
      nodeData,
      nodeDescription,
      truncatedDescription,
      isTask,
      isRoot,
      isComment,
      isDocument,
      isMaxDepth,
      isBase,
      isSmallWindow,
      childrenVisible,
      maxDepth,
      isTooDeep,
      depth,
      hasFocus,
      focusChar,
      isDragging,
      draggingOver,
      isDraggingParent,
      draggingItem: dragging,
      dragOverItem: dragOverInfo,
      hasChildren,
      isOption,
      somethingIsDragging,
      nodeLabel,
      nodeRoute,
      isChoice,
      hasParent,
      getDragItem: (breadcrumb: boolean) => getDragItem(nodeRoute, breadcrumb),
      getParentInfo: () => getParentInfo(nodeRoute, state),
      getOptionInfo: () => getOptionInfo(nodeRoute, state),
      getChildrenOfType: (type: FosNodeId) => getChildrenToShow(state, nodeRoute, type),
      getGroupInfo: () => getGroupInfo(nodeRoute, state),
  }
}

export const pathEqual = (path1: FosPath | null, path2: FosPath | null) => {
    if (!path1 || !path2){
        return path1 === path2
    }
    const sameLength = path1.length === path2.length
    const sameValues = path1.every(([p1type, p1id], index) => {
        const p2elem = path2[index]
        if (!p2elem){
            return false
        }
        const [p2type, p2id] = p2elem
        return p1type === p2type && p1id === p2id
    })
    return sameLength && sameValues
}

export const getGroupInfo = (nodeRoute: FosRoute, appData: AppState["data"]) => {


  const { nodeData, nodeContent, nodeChildren, nodeId } = getNodeInfoShared(nodeRoute, appData)

  const name = `${nodeId}`
  const userProfiles = nodeData.group?.userProfiles

  return {
    name,
    userProfiles
  }
}

export const getParentInfo = (nodeRoute: FosRoute, appData: AppState["data"]) => {
  const parentRoute = nodeRoute.slice(0, nodeRoute.length - 1)
  if (parentRoute.length === 0){
    throw new Error('Cannot get parent of root node') 
  } else {
      const parentInfo = getNodeInfoShared(parentRoute as FosRoute, appData)

      const nodeType = nodeRoute[nodeRoute.length - 1]?.[0]
      const nodeId = nodeRoute[nodeRoute.length - 1]?.[1]

      if (!nodeType || !nodeId){
        throw new Error('nodeType or nodeId is undefined')
      }

      // console.log('parentInfo', nodeType, nodeId, parentInfo.nodeChildren)
      const indexInParent = parentInfo.nodeChildren.findIndex(([childType, childId]) => {
        // console.log('childType', childType, nodeType, childType === nodeType, childType === nodeType && childId === nodeId)
        // console.log('childId', childId, nodeId, childId === nodeId, childType === nodeType && childId === nodeId)
        return childType === nodeType && childId === nodeId
      })

      const siblingRoutes = parentInfo.childRoutes //.filter((_, i) => i !== indexInParent)

      return {
        ...parentInfo,
        indexInParent,
        siblingRoutes,
      }
  }
}

export const getOptionInfo = (nodeRoute: FosRoute, appData: AppState["data"]) => {

  const { nodeData, nodeContent, nodeChildren } = getNodeInfoShared(nodeRoute, appData)

  if (nodeContent.content.length < 2){
    throw new Error('Should not have less than 2 options')
  }

  const selectedIndex = nodeData.option?.selectedIndex || 0

  const nodeOptions = getOptions(nodeRoute, appData)


  if (!nodeChildren[selectedIndex]){
    throw new Error('selectedChild not found')
  }
  const selectedChildRoute: FosRoute = [...nodeRoute , nodeChildren[selectedIndex]]

  
  const isCollapsedOption = appData.trellisData.collapsedList.some((route) => pathEqual(route, selectedChildRoute))

  const resolutionStrategy = nodeData.option?.defaultResolutionStrategy || 'selected'

  if (!selectedChildRoute){
    throw new Error('selectedChild not found')
  }
  return {
    selectedIndex,
    selectedChildRoute,
    nodeOptions,
    isCollapsedOption,
    resolutionStrategy,
  }
}

export const getCommentInfo = (nodeRoute: FosRoute, appData: AppState["data"]) => {

  const { nodeData, nodeContent, nodeChildren } = getNodeInfoShared(nodeRoute, appData)

  const comments = nodeChildren

  


  return {
    comments,
    
  }


}


export const getDownNode = (nodeRoute: FosRoute, appData: AppState["data"]): FosRoute | null => {
  const { nodeData, nodeContent, nodeChildren, getParentInfo, childRoutes, childrenVisible } = getNodeInfoShared(nodeRoute, appData)
  const { indexInParent, 
    nodeContent: parentContent, 
    nodeRoute: parentRoute, 
    siblingRoutes,
    childrenVisible: parentChildrenVisible 
  } = getParentInfo()

  if (!parentChildrenVisible){
    throw new Error('Parent is not visible')
  }

  if (childRoutes.length > 0 && childrenVisible){
    return childRoutes[0]!
  }
  const downSibling = getDownSibling(nodeRoute, appData)
  // console.log('downSibling', downSibling)
  if (downSibling){
    return downSibling
  }else{
    return getAncestorLeastDownSibling(nodeRoute, appData)
  }

}

export const getAncestorLeastDownSibling = (nodeRoute: FosRoute, appData: AppState["data"]): FosRoute | null => {
  const { getParentInfo } = getNodeInfoShared(nodeRoute, appData)
  const { 
    nodeRoute: parentRoute, 
    childrenVisible: parentChildrenVisible 
  } = getParentInfo()

  console.log('leastDownSibling', parentRoute,)
  if (parentRoute.length === 1){
    return null
  }
  const parentDownSibling = getDownSibling(parentRoute, appData)
  // console.log('parentDownSibling', parentDownSibling)
  if (parentDownSibling){
    return parentDownSibling
  } else {
    return getAncestorLeastDownSibling(parentRoute, appData)
  }
}

export const getAncestorLeastUpSibling = (nodeRoute: FosRoute, appData: AppState["data"]): FosRoute | null => {
  const { getParentInfo } = getNodeInfoShared(nodeRoute, appData)
  const { 
    nodeRoute: parentRoute, 
    childrenVisible: parentChildrenVisible 
  } = getParentInfo()

  if (parentRoute.length === 1){
    return null
  }
  const parentUpSibling = getUpSibling(parentRoute, appData)
  if (parentUpSibling){
    return parentUpSibling
  } else {
    return getAncestorLeastUpSibling(parentRoute, appData)
  }
}


export const getUpSibling = (nodeRoute: FosRoute, appData: AppState["data"]): FosRoute | null => {
  const { getParentInfo } = getNodeInfoShared(nodeRoute, appData)
  const { indexInParent, siblingRoutes } = getParentInfo()
  if (indexInParent === 0){
    return null
  }
  const newRoute = siblingRoutes[indexInParent - 1]
  if (!newRoute){
    return null
  }
  return newRoute
}

export const getDownSibling = (nodeRoute: FosRoute, appData: AppState["data"]): FosRoute | null => {
  const { getParentInfo } = getNodeInfoShared(nodeRoute, appData)
  const { indexInParent, siblingRoutes } = getParentInfo()

  // console.log('downSibling - sibling routes', siblingRoutes, indexInParent, nodeRoute)
  if (indexInParent === siblingRoutes.length - 1){
    return null
  }
  const newRoute = siblingRoutes[indexInParent + 1]
  if (!newRoute){
    return null
  }
  return newRoute
}



export const getDownmostDescendent = (nodeRoute: FosRoute, appData: AppState["data"], depthLimit: number = -1): FosRoute => {
  if (depthLimit === 0){
    return nodeRoute
  }
  const { hasChildren, childRoutes, childrenVisible } = getNodeInfoShared(nodeRoute, appData)
  if (childrenVisible && hasChildren ){
    return getDownmostDescendent(childRoutes[childRoutes.length - 1]!, appData, depthLimit - 1)
  } else {
    return nodeRoute
  }
}


export const getUpNode = (nodeRoute: FosRoute, appData: AppState["data"]): FosRoute | null => {
  const { nodeData, nodeContent, nodeChildren, getParentInfo } = getNodeInfoShared(nodeRoute, appData)
  const { indexInParent, nodeContent: parentContent, nodeRoute: parentRoute, siblingRoutes } = getParentInfo()

  if (indexInParent > 0 ){
    return getDownmostDescendent(siblingRoutes[indexInParent - 1]!, appData)
  }else{
    return parentRoute
  }
}


export const getNodesOfTypeForPath = (appData: AppState["data"], nodeRoute: FosRoute) => {


  const { childRoutes } = getNodeInfoShared(nodeRoute, appData)

  const workflows = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getNodeInfoShared(childRoute, appData)
    return nodeType === 'workflow' || nodeType === 'option'
  })

  const todos = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getNodeInfoShared(childRoute, appData)
    return nodeType === 'todo' || nodeType === 'race' || nodeType === 'choice'
  })

  const groups = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getNodeInfoShared(childRoute, appData)
    return nodeType === 'group'
  })

  const comments = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getNodeInfoShared(childRoute, appData)
    return nodeType === 'comment'
  })

  const documents = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getNodeInfoShared(childRoute, appData)
    return nodeType === 'document'
  })

  const marketRequest = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getNodeInfoShared(childRoute, appData)
    return nodeType === 'marketRequest'
  })

  const marketService = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getNodeInfoShared(childRoute, appData)
    return nodeType === 'marketService'
  })

  const field = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getNodeInfoShared(childRoute, appData)
    return nodeType === 'field'
  })

  return {
    workflows,
    todos,
    groups,
    comments,
    documents,
    marketRequest,
    marketService,
    field,

  }

}


export const getChildrenToShow = (appData: AppState["data"], parentRoute: FosRoute, parentType: FosNodeId) => {
  console.log('getChildrenToShow', parentRoute, parentType)
  const { childRoutes  } = getNodeInfoShared(parentRoute, appData)

  if (parentType === 'workflow'){
    const routes = childRoutes.filter((childRoute) => {
      const { nodeType } = getNodeInfoShared(childRoute, appData)
      return nodeType === 'workflow' || nodeType === 'option'
    })
    return routes
  } else if (parentType === 'todo'){
    const routes = childRoutes.filter((childRoute) => {
      const { nodeType } = getNodeInfoShared(childRoute, appData)
      return nodeType === 'todo' || nodeType === 'race' || nodeType === 'choice'
    })
    return routes
  } else {
    const routes = childRoutes.filter((childRoute) => {
      const { nodeType } = getNodeInfoShared(childRoute, appData)
      return nodeType === parentType
    })
    return routes
  }

}


export const getAvailableTasks = (appData: AppState["data"], nodeRoute: FosRoute): FosRoute[] => {
  const { nodeChildren, nodeType } = getNodeInfoShared(nodeRoute, appData)
  if (nodeType !== 'todo' && nodeType !== 'race' && nodeType !== 'choice'){
    return []
  }
  const childTasks =  nodeChildren.filter(([childType, childId]) => childType === 'todo' || childType === 'race' || childType === 'choice')
  
  const thisRoute = nodeType === 'todo' || nodeType === 'choice' ? [nodeRoute] : []


  const childTodos: FosRoute[] = childTasks.reduce((acc: FosRoute[], childElem: FosPathElem, index: number): FosRoute[] => {
    const [childType, childId] = childElem

    if (childType === 'todo'){
      const routes: FosRoute[] = [...acc, ...getAvailableTasks(appData, [...nodeRoute, childElem])]
      return routes
    } else if (childType === 'race'){
      const routes: FosRoute[] = [...acc, ...getAvailableTasks(appData, [...nodeRoute, childElem])]
      return routes
    } else if (childType === 'choice'){
      const routes: FosRoute[] = [...acc, [...nodeRoute, childElem]]
      return routes
    } else {
      return []
    }
  }, [] as FosRoute[]).concat(thisRoute)

  return childTodos


}


