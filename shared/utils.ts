import { FosNodesData,  AppState, FosPath, FosPathElem, FosNodeId, FosNodeContent, FosContextData, FosRoute, TrellisSerializedData, AppStateLoaded } from "./types"
import { FosStore } from "./dag-implementation/store"
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

  return nodeContent as FosNodeContent
}

export const validateProfileData = (profileData: unknown): AppState["info"]["profile"] => {
  if (typeof profileData !== "object" || profileData === null || profileData === undefined) {
    throw new Error("Invalid data")
  }

  return profileData as AppState["info"]["profile"]
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
      return store.getRootNode()   
  }


}
