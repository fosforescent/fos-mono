import {  TrellisNodeClass, TrellisNodeInterface } from "../../trellis/types"

import _ from 'lodash'



export type TrellisTrail<T extends TrellisNodeInterface<T>> = T[]



export interface TrellisNodeData {
  id: string,
  collapsed: boolean,
  data: {
    content: string
  }
}

export interface TrellisEdgeData{
  source: string,
  target: string,
}

export type TrellisGraphData = {
  nodes: TrellisNodeData[],
  edges: TrellisEdgeData[],
  rootNodeId: string,
}


// export type TrellisGraphFunctions = {
//   updateData?: (data: TrellisGraphData) => void,
//   newNode: (data: S) => TrellisNodeData,
//   getDefaultNextEdgeData: (source: TrellisEdgeClass) => S,
// }



// export type TrellisNodeProps = {
//   node: TrellisNodeClass,
//   edge: TrellisEdgeClass,
//   options: TrellisOptions,
// }
export interface TrellisEdgeClass <T extends TrellisNodeInterface<T>, S>{
  getSource: () => TrellisNodeClass<T, S>
  getTarget: () => TrellisNodeClass<T, S>
  getData: () => { source: string, target: string }
  remove: () => void
  setTarget: (target: string) => void
  createBlankTarget: () => TrellisNodeClass<T, S>
  zoom: () => void
  unzoom: () => void

}


// eslint-disable-next-line @typescript-eslint/ban-types
export class DefaultTrellisGraph {


  trail: TrellisTrail<DefaultTrellisNode> = []
  private nodes: TrellisNodeData[]
  private edges: TrellisEdgeData[]
  private updateData: ((data: TrellisGraphData) => void) | undefined
  private rootNodeId: string


  constructor(args: TrellisGraphData){
    this.nodes = args.nodes
    this.edges = args.edges
    this.rootNodeId = args.rootNodeId

  }



  getRootNode(): DefaultTrellisNode {
    const rootNodeData = this.nodes.find(node => node.id === this.rootNodeId)
    if (!rootNodeData){
      throw new Error('Root node not found')
    }
    const rootNode = new DefaultTrellisNode(this, rootNodeData, [])
    return rootNode
  }

  getEdgeDataFromSource(source: string): TrellisEdgeData[] {
    return this.edges.filter(edge => edge.source === source)
  }

  getNodeDataFromId(id: string): TrellisNodeData {
    const data = this.nodes.find(node => node.id === id)
    if (!data){
      throw new Error('Node not found')
    }
    return data
  }

  deleteEdgesFromSource(source: string){
    this.edges = this.edges.filter(edge => edge.source !== source)
  }

  addEdge(source: string, target: string){
    this.edges.push({source, target})
  }

  insertNode(data: {content: string}): string {
    const newNodeId = _.uniqueId('node_')
    this.nodes.push({
      id: newNodeId,
      collapsed: false,
      data
    })
    return newNodeId
  }

  setNodeData(id: string, data: {content: string}){
    const node = this.nodes.find(node => node.id === id)
    if (!node){
      throw new Error('Node not found')
    }
    node.data = data
  }

}

// eslint-disable-next-line @typescript-eslint/ban-types
export class DefaultTrellisNode implements TrellisNodeInterface<DefaultTrellisNode> {


  constructor(private graph: DefaultTrellisGraph, private data: TrellisNodeData, private route: TrellisTrail<DefaultTrellisNode>){ }



  getChildren(): DefaultTrellisNode[]{
    const children = this.graph.getEdgeDataFromSource(this.data.id).map(edge => {
      const targetData = this.graph.getNodeDataFromId(edge.target)
      return new DefaultTrellisNode(this.graph, targetData , [...this.route, this])
    })
    return children
  }

  setChildren(children: DefaultTrellisNode[]){

    this.graph.deleteEdgesFromSource(this.getId())
    
    children.forEach(child => {
      this.graph.addEdge(this.getId(), child.getId())
    })

  }

  newChild(): DefaultTrellisNode {
    const newNodeId = this.graph.insertNode({content: ''})
    this.graph.addEdge(this.getId(), newNodeId)
    const newNodeData = this.graph.getNodeDataFromId(newNodeId)
    const newNode = new DefaultTrellisNode(this.graph, newNodeData, [...this.route, this])
    return newNode
  }

  getId(): string {
    return this.data.id
  }

  getString(): string {
    return this.data.data.content
  }

  setString(string: string){
    this.data.data.content = string
    this.graph.setNodeData(this.getId(), {content: string})
  }

  getParent(): DefaultTrellisNode | null {
    const parent = this.route[this.route.length - 1]
    return parent || null
  };

}