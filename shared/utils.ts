import e from "cors"
import { FosNodesData,  AppState, FosPath, FosPathElem, FosNodeId, FosNodeContent, FosContextData, FosRoute } from "./types"
import { FosStore } from "./dag-implementation/store"
import { FosExpression, getExpressionInfo } from "./dag-implementation/expression"
import { FosNode } from "./dag-implementation/node"




export const getDownNode = (nodeRoute: FosPath, appData: AppState["data"]): FosPath | null => {
  const { nodeData, nodeContent, nodeChildren, getParentInfo, childRoutes, childrenVisible } = getExpressionInfo(nodeRoute, appData)
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

export const getAncestorLeastDownSibling = (nodeRoute: FosPath, appData: AppState["data"]): FosPath | null => {
  const { getParentInfo } = getExpressionInfo(nodeRoute, appData)
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

export const getAncestorLeastUpSibling = (nodeRoute: FosPath, appData: AppState["data"]): FosPath | null => {
  const { getParentInfo } = getExpressionInfo(nodeRoute, appData)
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


export const getUpSibling = (nodeRoute: FosPath, appData: AppState["data"]): FosPath | null => {
  const { getParentInfo } = getExpressionInfo(nodeRoute, appData)
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

export const getDownSibling = (nodeRoute: FosPath, appData: AppState["data"]): FosPath | null => {
  const { getParentInfo } = getExpressionInfo(nodeRoute, appData)
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



export const getDownmostDescendent = (nodeRoute: FosPath, appData: AppState["data"], depthLimit: number = -1): FosPath => {
  if (depthLimit === 0){
    return nodeRoute
  }
  const { hasChildren, childRoutes, childrenVisible } = getExpressionInfo(nodeRoute, appData)
  if (childrenVisible && hasChildren ){
    return getDownmostDescendent(childRoutes[childRoutes.length - 1]!, appData, depthLimit - 1)
  } else {
    return nodeRoute
  }
}


export const getUpNode = (nodeRoute: FosPath, appData: AppState["data"]): FosPath | null => {
  const { nodeData, nodeContent, nodeChildren, getParentInfo } = getExpressionInfo(nodeRoute, appData)
  const { indexInParent, nodeContent: parentContent, nodeRoute: parentRoute, siblingRoutes } = getParentInfo()

  if (indexInParent > 0 ){
    return getDownmostDescendent(siblingRoutes[indexInParent - 1]!, appData)
  }else{
    return parentRoute
  }
}



export const getChildrenToShow = (appData: AppState["data"], parentRoute: FosPath, parentType: FosNodeId) => {
  console.log('getChildrenToShow', parentRoute, parentType)
  const { childRoutes  } = getExpressionInfo(parentRoute, appData)

  if (parentType === 'workflow'){
    const routes = childRoutes.filter((childRoute) => {
      const { nodeType } = getExpressionInfo(childRoute, appData)
      return nodeType === 'workflow' || nodeType === 'option'
    })
    return routes
  } else if (parentType === 'todo'){
    const routes = childRoutes.filter((childRoute) => {
      const { nodeType } = getExpressionInfo(childRoute, appData)
      return nodeType === 'todo' || nodeType === 'race' || nodeType === 'choice'
    })
    return routes
  } else {
    const routes = childRoutes.filter((childRoute) => {
      const { nodeType } = getExpressionInfo(childRoute, appData)
      return nodeType === parentType
    })
    return routes
  }

}


export const getAvailableTasks = (appData: AppState["data"], nodeRoute: FosPath): FosPath[] => {
  const { nodeChildren, nodeType } = getExpressionInfo(nodeRoute, appData)
  if (nodeType !== 'todo' && nodeType !== 'race' && nodeType !== 'choice'){
    return []
  }
  const childTasks =  nodeChildren.filter(([childType, childId]) => childType === 'todo' || childType === 'race' || childType === 'choice')
  
  const thisRoute = nodeType === 'todo' || nodeType === 'choice' ? [nodeRoute] : []


  const childTodos: FosPath[] = childTasks.reduce((acc: FosPath[], childElem: FosPathElem, index: number): FosPath[] => {
    const [childType, childId] = childElem

    if (childType === 'todo'){
      const routes: FosPath[] = [...acc, ...getAvailableTasks(appData, [...nodeRoute, childElem])]
      return routes
    } else if (childType === 'race'){
      const routes: FosPath[] = [...acc, ...getAvailableTasks(appData, [...nodeRoute, childElem])]
      return routes
    } else if (childType === 'choice'){
      const routes: FosPath[] = [...acc, [...nodeRoute, childElem]]
      return routes
    } else {
      return []
    }
  }, [] as FosPath[]).concat(thisRoute)

  return childTodos


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




export function isSuperset<T>(ss: T[], tt: T[]): boolean {
  const sSet = new Set(ss)
  for (const t of tt) {
    if (!sSet.has(t)) {
      return false
    }
  }
  return true
}

export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`)
  }
}

export function counter<K>(items: K[]): Map<K, number> {
  const counts = new Map<K, number>()
  items.forEach(it => counts.set(it, (counts.get(it) || 0) + 1))
  return counts
}

export const aggMap = (edges: [string, string][]): Map<string, string[]> => {
  const result = new Map<string, string[]>()
  edges.forEach(([edgeType, target]) => {
    if (result.has(edgeType)) {
      result.set(edgeType, [...result.get(edgeType) as [string, string], target])
    } else {
      result.set(edgeType, [target])
    }
  })
  return result
}



type NodeOperation<T> = (
  node: FosNodeContent,
  nodeId: FosNodeId,
  childResults: Map<FosNodeId, T>
) => T

export function traverseNodes<T>(
  contextData: FosContextData,
  operation: NodeOperation<T>
): Map<FosNodeId, T> {

  const resultMap = new Map()

  const {  nodes, baseNodeContent, baseNodeInstruction } = contextData
  const helper = (nodeContent: FosNodeContent, nodeId: FosNodeId, nodes: FosNodesData) => {

    // if node is empty, do operation and set in result map
    const hasChildren = nodeContent.children.length > 0
    if (!hasChildren){
      const result = operation(nodeContent, nodeId, new Map())
      resultMap.set(nodeId, result)
    } else {
      // else do operation on children first and then do it on self.
      // if any children are empty, do operation on them and set in result map
      const childResults = new Map()
      
      
      for (const elem of nodeContent.children){

        const resultElem = elem.map((nodeId) => {

          const childResultFromMap = resultMap.get(nodeId)
          if (childResultFromMap){
            childResults.set(nodeId, childResultFromMap)
            return nodeId
          } else {
            const childNode = nodes[nodeId]
            if (!childNode){
              return "ERROR"
            }
            const childResult = helper(childNode, nodeId, nodes)
            resultMap.set(nodeId, childResult)
            childResults.set(nodeId, childResult)
            return nodeId
    
          }

        })
      }
      const result = operation(nodeContent, nodeId, childResults)
      resultMap.set(nodeId, result)

    }

  }
  helper(baseNodeContent, "ROOTTARGET", nodes)
  helper(baseNodeInstruction, "ROOTINSTRUCTION", nodes)
  return resultMap
}



export const mutableReduceToRouteMapFromExpression = <T>(
  expression: FosExpression,
  operation: MutableExprOperation<T>
): Map<FosPath, T> => {
  let resultMap = new Map()
  const helper = (acc: Map<FosPath, T>, expr: FosExpression): void => {

    const { nodeRoute } = expr.getExpressionInfo()

    // Check for repeated pairs in the route
    for (let i = 0; i < nodeRoute.length; i++) {
      for (let j = i + 1; j < nodeRoute.length; j++) {
        if (nodeRoute[i]?.[0] === nodeRoute[j]?.[0] && 
            nodeRoute[i]?.[1] === nodeRoute[j]?.[1]) {
          // Found a cycle, stop traversing this path
          return
        }
      }
    }

    const childExpressions = expr.getChildren()

    operation(acc, expr, childExpressions)

    for (const childExpr of childExpressions) {
      const { nodeRoute: childRoute } = childExpr.getExpressionInfo()
      helper(acc, childExpr)
    }
  }

  helper(resultMap, expression)
  
  return resultMap
}



type MutableExprOperation<T> = (
  acc: Map<FosPath, T>,
  expression: FosExpression,
  childExpressions: FosExpression[]
) => void

export function mutableReduceToRouteMap<T>(
  contextData: AppState["data"],
  operation: MutableExprOperation<T>
): Map<FosPath, T> {

  const store = new FosStore(contextData)

  const rootExpr = new FosExpression(store, [])

  const result = mutableReduceToRouteMapFromExpression<T>(rootExpr, operation)

  return result
  
}



type ExprOperation<T> = (
  expression: FosExpression,
  childExpressions: FosExpression[]
) => T

export function reduceToRouteMap<T>(
  contextData: AppState["data"],
  operation: ExprOperation<T>
): Map<FosPath, T> {

  const resultMap = new Map<FosPath, T>()

  const op = (acc: Map<FosPath, T>, expr: FosExpression, childExpressions: FosExpression[]) => {
    const { nodeRoute } = expr.getExpressionInfo()
    const operationResult = operation(expr, childExpressions)
    resultMap.set(nodeRoute, operationResult)
    return operationResult
  }

  return mutableReduceToRouteMap<T>(contextData, op)
  
}


type SingleExprOperation<T> = (
  expression: FosExpression,
) => T

export function mapExpressions<T>(
  contextData: AppState["data"],
  operation: SingleExprOperation<T>
): Map<FosPath, T> {


  const op = (expr: FosExpression, childExpressions: FosExpression[]) => {
    return operation(expr)
  }
  return reduceToRouteMap(contextData, op)
  
}


type SingleMutableExprOperation<T> = (
  acc: Map<FosPath, T>,
  expression: FosExpression,
) => void

export function mutableMapExpressions<T>(
  contextData: AppState["data"],
  operation: SingleMutableExprOperation<T>
): Map<FosPath, T> {


  const op = (acc: Map<FosPath, T>, expr: FosExpression, childExpressions: FosExpression[]) => {
    operation(acc, expr)
  }
  return mutableReduceToRouteMap(contextData, op)
  
}

export const getGroupFromRoute = (route: FosPath, store: FosStore): FosNode => {

  const groupFieldNode = store.groupFieldNode
  if (route[0]?.[0] === groupFieldNode.getId()){
    const addr = route[0][1]
    const groupNode = store.getNodeByAddress(route[0][1])
    if (!groupNode){
      throw new Error('Group node not found')
    }
    return groupNode
  } else {
      return store.rootTarget   
  }


}
