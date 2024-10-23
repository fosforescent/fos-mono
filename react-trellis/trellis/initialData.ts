/* eslint camelcase: 0 */

import { TrellisDataInterface, TrellisEdgeData,  TrellisNodeData } from "./types"



// eslint-disable-next-line @typescript-eslint/ban-types
// export const defaultTrail: TrellisTrailData<{}> = [{ edge: {}, node: "root" }]

export const defaultFocus = {
  route: [],
  char: 0
}

export const defaultNodes: TrellisNodeData[] = [
  {
    id: "root",
    collapsed: false,
    data: {
      content: "My Goals"
    },
  },
  {
    id: "startTask",
    collapsed: false,
    data: {
      content: "Learn to use trellis"
    },
  }
]

// eslint-disable-next-line @typescript-eslint/ban-types
export const defaultEdges: TrellisEdgeData[] = [{
  source: "root",
  target: "startTask",
}]


// eslint-disable-next-line @typescript-eslint/ban-types
export const defaultContext: TrellisDataInterface = {
  nodes: defaultNodes,
  // trail: defaultTrail,
  rootNodeId: "root",
  edges: defaultEdges
}