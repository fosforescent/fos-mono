import e from "cors"
import { FosNodesData,  AppState, FosPath, FosPathElem, FosNodeId, FosNodeContent, FosContextData, FosRoute, TrellisSerializedData } from "./types"
import { FosStore } from "./dag-implementation/store"
import { FosExpression, } from "./dag-implementation/expression"
import { FosNode } from "./dag-implementation/node"
import { defaultTrellisData } from "./defaults"





export const validateTrellisData = (data: unknown): TrellisSerializedData => {
  if (typeof data !== "object" || data === null || data === undefined) {
    throw new Error("Invalid data")
  }
  if (Object.keys(data).length === 0){
    console.warn('Trellis Data was empty')
    return defaultTrellisData
  }

  return {
    ...defaultTrellisData, 
    ...data
  }
}

export const validateNodeData = (nodeContent: unknown): FosNodeContent => {
  if (typeof nodeContent !== "object" || nodeContent === null || nodeContent === undefined) {
    throw new Error("Invalid data")
  }

  return nodeContent
}

export const validateProfileData = (profileData: unknown): AppState["info"]["profile"] => {
  if (typeof profileData !== "object" || profileData === null || profileData === undefined) {
    throw new Error("Invalid data")
  }

  return profileData
}

export const getDownNode = (expression: FosExpression): FosExpression | null => {

  const parent = expression.getParent()
  const children = parent.getChildren()  
  
  if (!parent.childrenVisible()){
    throw new Error('Parent is not visible')
  }

  if (children.length > 0 && expression.childrenVisible()){
    return children[0]!
  }
  const downSibling = getDownSibling(expression)
  // console.log('downSibling', downSibling)
  if (downSibling){
    return downSibling
  }else{
    return getAncestorLeastDownSibling(expression)
  }

}

export const getAncestorLeastDownSibling = (expression: FosExpression): FosExpression | null => {

  const parent = expression.getParent()
  
  console.log('leastDownSibling', parent,)
  if (parent.route.length === 1){
    return null
  }
  const parentDownSibling = getDownSibling(parent)
  // console.log('parentDownSibling', parentDownSibling)
  if (parentDownSibling){
    return parentDownSibling
  } else {
    return getAncestorLeastDownSibling(parent)
  }
}

export const getAncestorLeastUpSibling = (expression: FosExpression): FosExpression | null => {


  const parent = expression.getParent()
  
  if (parent.route.length === 1){
    return null
  }
  const parentUpSibling = getUpSibling(parent)
  if (parentUpSibling){
    return parentUpSibling
  } else {
    return getAncestorLeastUpSibling(parent)
  }
}


export const getUpSibling = (expression: FosExpression): FosExpression | null => {

  const { indexInParent, parent } = expression.getParentInfo()
  const siblings = parent.getChildren()
  if (indexInParent === 0){
    return null
  }
  const newRoute = siblings[indexInParent - 1]
  if (!newRoute){
    return null
  }
  return newRoute
}

export const getDownSibling = (expression: FosExpression): FosExpression | null => {
  
  const { indexInParent, parent } = expression.getParentInfo()
  const siblings = parent.getChildren()

  // console.log('downSibling - sibling routes', siblingRoutes, indexInParent, nodeRoute)
  if (indexInParent === siblings.length - 1){
    return null
  }
  const newExpr = siblings[indexInParent + 1]
  if (!newExpr){
    return null
  }
  return newExpr
}



export const getDownmostDescendent = (expression: FosExpression, depthLimit: number = -1): FosExpression => {
  if (depthLimit === 0){
    return expression
  }
 
  const childRoutes = expression.childRoutes()
  const hasChildren = expression.hasChildren()
  const childrenVisible = expression.childrenVisible()

  const children = expression.getChildren()
  
  if (childrenVisible && hasChildren ){
    return getDownmostDescendent(children[children.length - 1]!, depthLimit - 1)
  } else {
    return expression
  }
}


export const getUpNode = (expression: FosExpression): FosExpression | null => {
  
  const { indexInParent, parent, siblingRoutes } = expression.getParentInfo()

  const siblings = parent.getChildren()

  if (indexInParent > 0 ){
    return getDownmostDescendent(siblings[indexInParent - 1]!)
  }else{
    return parent
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





export const mutableReduceToRouteMapFromExpression = <T>(
  expression: FosExpression,
  operation: MutableExprOperation<T>
): Map<FosPath, T> => {
  let resultMap = new Map()
  const helper = (acc: Map<FosPath, T>, expr: FosExpression): void => {

    const  nodeRoute = expr.route

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
  contextData: AppStateLoaded["data"],
  operation: MutableExprOperation<T>
): Map<FosPath, T> {

  const store = new FosStore({ fosCtxData: contextData })

  const rootExpr = new FosExpression(store, [])

  const result = mutableReduceToRouteMapFromExpression<T>(rootExpr, operation)

  return result
  
}



type ExprOperation<T> = (
  expression: FosExpression,
  childExpressions: FosExpression[]
) => T

export function reduceToRouteMap<T>(
  contextData: AppStateLoaded["data"],
  operation: ExprOperation<T>
): Map<FosPath, T> {

  const resultMap = new Map<FosPath, T>()

  const op = (acc: Map<FosPath, T>, expr: FosExpression, childExpressions: FosExpression[]) => {
    const nodeRoute = expr.route
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
  contextData: AppStateLoaded["data"],
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
  contextData: AppStateLoaded["data"],
  operation: SingleMutableExprOperation<T>
): Map<FosPath, T> {


  const op = (acc: Map<FosPath, T>, expr: FosExpression, childExpressions: FosExpression[]) => {
    operation(acc, expr)
  }
  return mutableReduceToRouteMap(contextData, op)
  
}

export const getGroupFromRoute = (route: FosPath, store: FosStore): FosNode => {

  /**
   * TODO: Update to use multiple nested groups
   */

  const groupFieldNode = store.primitive.groupField
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
