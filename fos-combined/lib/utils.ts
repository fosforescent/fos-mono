import { FosNodesData, FosPath, AppState } from "../types"

export const getNodeDescription = (nodeRoute: FosPath, state: AppState) => {
    const nodeId = nodeRoute[nodeRoute.length - 1]?.[1]
  
    if (!nodeId){
      throw new Error('nodeType or nodeId is undefined')
    }
  
    const nodeContent =  state.data.fosData.nodes[nodeId]
  
    if (!nodeContent){
      throw new Error('nodeContent is undefined')
    }
  
    const description = nodeContent?.data.description?.content
  
    if (!description){
      throw new Error('description is undefined')
    }
  
    return description
}



export const getNodeContent = (nodeRoute: FosPath, state: AppState) => {
    const [nodeType, nodeId] = nodeRoute[nodeRoute.length - 1]!
    if (!nodeType || !nodeId){
        throw new Error('nodeType or nodeId is undefined')
    }
    
    const nodeContent = state.data.fosData.nodes[nodeId]
    return nodeContent
}

export const getNodeChildren = (nodeRoute: FosPath, state: AppState) => {
    const nodeContent = getNodeContent(nodeRoute, state)
    if (!nodeContent){
      throw new Error('nodeContent is undefined')
    } 
    const nodeChildren = nodeContent.content
    return nodeChildren
}

export const getNodeData = (nodeRoute: FosPath, state: AppState) => {
    const nodeContent = getNodeContent(nodeRoute, state)
    if (!nodeContent){
      throw new Error('nodeContent is undefined')
    } 
    const nodeData = nodeContent.data
    return nodeData
}


  
export const getOptions = (nodeRoute: FosPath, state: AppState) => {
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
}

export const getDragItem = (nodeRoute: FosPath, breadcrumb: boolean) => {
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

export const getNodeInfo = (nodeRoute: FosPath, state: AppState) => {
    const [nodeType, nodeId] = nodeRoute[nodeRoute.length - 1]!
    if (!nodeType || !nodeId){
        throw new Error('nodeType or nodeId is undefined')
    }
    
    const isCollapsed = state.data.trellisData.collapsedList.some((route) => pathEqual(route, nodeRoute))

    const nodeContent = getNodeContent(nodeRoute, state)
    const nodeChildren = getNodeChildren(nodeRoute, state)
    const childRoutes = nodeChildren.map((child) => [...nodeRoute, child])
    const nodeData = getNodeData(nodeRoute, state)
    const nodeDescription = getNodeDescription(nodeRoute, state)

    const isTask = ["workflow", "todo", "option"].includes(nodeType)
    const isRoot = nodeType === "root"
    const isComment = nodeType === "comment"
    const isDocument = nodeType === "document"
    const isMaxDepth = false
    const isBase = nodeRoute.length === state.data.fosData.route.length
    const isSmallWindow = window.innerWidth !== undefined && window.innerWidth < 500
    const nodeOptions = getOptions(nodeRoute, state)
    const selectedIndex = nodeData.option?.selectedIndex || 0
    const locked = false


    const hasFocus = pathEqual(state.data.trellisData.focusRoute, nodeRoute)
    const focusChar = state.data.trellisData.focusChar
  
    const isDragging = pathEqual(state.data.trellisData.draggingNode, nodeRoute)
    const draggingOver = pathEqual(state.data.trellisData.draggingOverNode, nodeRoute)

    return {
        childRoutes,
        isCollapsed,
        locked,
        nodeType,
        nodeId,
        nodeContent,
        nodeChildren,
        nodeData,
        nodeDescription,
        isTask,
        isRoot,
        isComment,
        isDocument,
        isMaxDepth,
        isBase,
        isSmallWindow,
        selectedIndex,
        nodeOptions,
        hasFocus,
        focusChar,
        isDragging,
        draggingOver
    }
}

const pathEqual = (path1: FosPath | null, path2: FosPath | null) => {
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