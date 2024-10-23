
/* eslint-disable */

import { FosNodeContent, FosNodeId, FosRoute, SelectionPath, FosContextData, RouteElement, FosDataContent } from './temp-types'

import { FosPeer, IFosPeer } from './fosPeer'


import _ from 'lodash'


export interface INodeMin<T extends INodeMin<T>> {
  // createChild: (edgeData: S, node: TrellisNodeClass<T, S>) => void
  // removeChild: (edge: TrellisEdgeClass<T, S>, node: TrellisNodeClass<T, S>) => void
  setChildren: (children: T[]) => void
  getChildren: () => T[]
  getId: () => string
  newChild: (nodeType?: string | null) => T
  getString: () => string
  setString: (string: string) => void
  getParent: () => T | null
  
}


export interface IFosNode extends INodeMin<IFosNode> {
  getId(): string
  getNodeType(): string
  getRoute(): FosRoute
  getAncestors(): [IFosNode, number][]
  getParent(): IFosNode | null
  getChild([type, id]: [string, string]): IFosNode
  getChildren(): IFosNode[]
  addPeer(peer: IFosPeer): Promise<void>
  pullFromPeer(peer: IFosPeer): Promise<void>
  getData(): FosDataContent
  setData(data: Partial<FosDataContent>): void
  pushToPeer(peer: IFosPeer): Promise<void>
  delete(): void
  // getUpNode(): IFosNode
  // getDownNode(): IFosNode
  focusNode(charpos?: number): void
  setChildren(children: IFosNode[]): void
  // newChild(type: FosNodeId): IFosNode
  newChild(nodeType?: string | null): IFosNode
  getString(): string
  setString(newString: string): void
  serializeData(): FosContextData
  notify(): Promise<void>
  handleChange(): Promise<void>
  setPath(path: SelectionPath): void
  setParent(parent: IFosNode): void
  serializeData(): FosContextData
  deserializeData(data: FosContextData): Promise<void>
  serialize: () => string
  deserialize: (data: string) => IFosNode
}


export class FosNodeBase implements IFosNode {

  peers: IFosPeer[] = []
  data: FosDataContent; 
  children: IFosNode[] = []
  zoomedIn: boolean = false
  focused: boolean = false
  cached: FosContextData | null = null

  constructor(context: FosContextData, private parent: FosNodeBase | null, private id: FosNodeId, private type: FosNodeId) {
    // console.log('FOS - constructor', id, type)
    const nodeData = context.nodes[this.id]

    if (!nodeData){
      // eslint-disable-next-line no-console
      console.log('context - constructor', context, 'id', this.id, 'type', this.type, context.nodes)
      // eslint-disable-next-line no-console
      console.trace()
      throw new Error(`no node content entry for ${this.id}.  Data is malformed.  Cannot construct node`)
      process?.exit(1)
    }
    
    this.data = {
      updated: {
        time: Date.now()
      },
      ...nodeData.data
    }
    this.init(context)
  }

  init(context: FosContextData) {
    const content: FosNodeContent = context.nodes[this.id]
    if (!content){
      // eslint-disable-next-line no-console
      console.log('context - init', context, 'id', this.id, 'type', this.type, context.nodes)
      throw new Error(`no node content entry for ${this.id}.  Data is malformed.  Cannot init node`)
    }


    this.data = content.data

    if (context.trail){
      this.zoomedIn = true
    }

    if (context.focus){
      this.focused = true
    }


    this.children = content.content.map(([type, id]: [string, string]) => {

      const updatedContext = {
        nodes: {
          ...context.nodes,
         },
        trail: context.trail ? context.trail.slice(1) : null,
        focus: context.focus ? {
          route: context.focus.route.slice(1),
          char: context.focus.char
        } : null
      }

      delete updatedContext.nodes[this.id]

      return new FosNodeBase(updatedContext, this, id, type)
    })
  }

  getNodeId() {
    return this.id
  }

  getNodeType() {
    return this.type
  }

  getId() {
    return `${this.getNodeId()}`
  }

  getRouteElem(): RouteElement {
    return [this.getNodeType(), this.getId()]
  }

  getRoute() {
    const helper = (node: FosNodeBase): FosRoute => {
      if (node.parent) {
        return [...helper(node.parent), node.getRouteElem()]
      } else {
        return [this.getRouteElem()]
      }
    }
    return helper(this)
  }


  updateNodeData(newData: FosDataContent): void {
    this.data = _.merge(this.data, newData)
    this.handleChange()
  }
  
  getChildren(): IFosNode[] {
    // let newChildren = []
    // for (const child of this.children){
    //   const serializedData = child.serializeData()
    //   const childData = child.getData()
    //   const newChild = new FosNodeBase(serializedData, this, child.getId(), child.getNodeType())
    //   newChild.setData(childData)
    //   newChildren.push(newChild)
    // }
    return this.children
  }

  setChildren(children: IFosNode[]) {

    children.forEach((child) => {
      child.setParent(this)
    })
    console.log('FOS- settingChildren', children)
    this.children = [...children]
    console.log('FOS- settingChildren ++', this.children)
    this.handleChange()
  }

  newId(): FosNodeId {
    return crypto.randomUUID()
  }

  // newChild(type: FosNodeId): IFosNode {
  newChild(childType: string | null = null): IFosNode {
    console.log('FOS - newChild', this.serialize())
    if (!childType || childType === 'workflow'){
      const newContent: FosNodeContent = {
        data: {
          description: {
            content: ''
          }
        },
        content: []
      }
      const newId = this.newId();
      const newNode = new FosNodeBase({
        nodes: {
          [newId]: newContent
        },
        trail: [],
        focus: {
          route: [],
          char: 0
        }
      }, this, newId, "workflow")
      this.setChildren([...this.children, newNode])    
      return newNode
    } else if (childType === 'option'){
      const newContent: FosNodeContent = {
        data: {
          description: {
            content: ''
          },
          option: {
            selectedIndex: 0
          }
        },
        content: []
      }
      const newId = this.newId();
      const newNode = new FosNodeBase({
        nodes: {
          [newId]: newContent
        },
        trail: [],
        focus: {
          route: [],
          char: 0
        }
      }, this, newId, "option")
      this.setChildren([...this.children, newNode])
      return newNode
    }else{
      throw new Error(`unknown child type ${childType}`)
    }
  }

  getChild([type, id]: [string, string]): IFosNode {
    const children = this.getChildren()
    const child = children.find((child: IFosNode) => {
      return child.getId() === id && child.getNodeType() === type
    })
    if (!child) {
      throw new Error(`no child found for ${type} ${id}`)
    }
    return child
  }


  isChildOf(parent: IFosNode) {
    const thisChild = this.parent?.getChildren().find((child: IFosNode) => {
      return child.getId() === this.getId() && child.getNodeType() === this.getNodeType()
    })
    // console.log('isChildOf', parentRoute, thisRoute, isParent)
    return !!thisChild
  }

  

  getAncestors(): [IFosNode, number][] {
    const helper = (node: IFosNode, acc: [IFosNode, number][]): [IFosNode, number][] => {
      const nodeParent = node.getParent()
      if (nodeParent) {

        const newEntry: [IFosNode, number] = [nodeParent, nodeParent.getChildren().findIndex((child: IFosNode) => {
          return child.getId() === node.getId() && child.getNodeType() === node.getNodeType()
        })]

        return helper(nodeParent, [...acc, newEntry])
      } else {
        return acc
      }
    }
    const result: [IFosNode, number][] =  helper(this, [])
    return result
  }
  
  getParent(): IFosNode | null {
    return this.parent
  }


  deleteRow(rowIndex:number) {
    this.children = this.children.filter((child, i) => i !== rowIndex)
  }

  delete() {
    const [parentNode, childIndex] = this.getAncestors()[0]
    parentNode.setChildren(parentNode.getChildren().filter((child: IFosNode, index) => index !== childIndex))
  }


  setData(data: Partial<FosNodeContent["data"]>) {
    // console.log('fos-js setData', this.updateNodeData)
    this.updateNodeData({
      ...this.data,
      ...data
    })
  }

  getData() {
    return this.data
  }

  getRelativeTrail() {
        
  }



  async addPeer(peer: FosPeer): Promise<void> {
    this.peers.push(peer)
    // await this.context.addPeer(peer, this.getRoute())
  }

  async removePeer(peer: IFosPeer){
    // this.context.peers = this.context.peers.filter((p) => p !== peer)
    this.peers = this.peers.filter((p) => p !== peer)
  }

  async pullFromPeer(peer: IFosPeer): Promise<void> {
    // console.log('pullFromPeer', this.peers, peer)
    const thisPeer = this.peers.filter((p) => p === peer)
    if (thisPeer.length === 0){
      throw new Error('peer not found')
    }else{
      const thisCtxData = await this.serializeData()
      const peerCtxData = await peer.pullFromPeer()
      if (!peerCtxData){
        return
      }
      const mergedData = {
        ...thisCtxData,
        nodes: {
          ...thisCtxData.nodes,
          ...peerCtxData.nodes
        }
      }

      // console.log('pullFromPeer --- GET PEER ROOT', peerCtxData)
      const peerRootNode = new FosNodeBase(mergedData, this.parent, getRootId(mergedData), 'root')

      const oldNodesWithoutConflicts = this.getChildren().filter((child: IFosNode) => peerRootNode.getChildren().find((peerChild: IFosNode) => peerChild.getId() === child.getId()) === undefined)
      

      this.setChildren([
        ...oldNodesWithoutConflicts,
        ...peerRootNode.getChildren()
      ])
      // console.log('pullFromPeer --- before serialize', mergedData)
      await this.deserializeData(mergedData)
      return
    }
  }

  async pushToPeer(peer: IFosPeer){
    const serializedData = await this.serializeData()
    console.log('pushToPeer', serializedData)
    await peer.pushToPeer(serializedData)
    return
  }

  serializeData(): FosContextData {
    console.log('serializeData - a')
    // console.log('serializeData', this.getId(), this.data, this.children.map((child: IFosNode) => child.getId()))
    const thisContent = {
      data: this.data,
      content: this.children.map((child: IFosNode) => {
        return [child.getNodeType(), child.getId()]
      })
    }
    console.log('serializeData - b')
    const childrenDatas = this.children.map((child: IFosNode) => {
      return child.serializeData()
    })

    console.log('serializeData - c')
    const zoomedChild = childrenDatas.find((childData) => { 
      return childData.trail && childData.trail.length > 0
    })
    
    console.log('serializeData - d')
    const focusedChild = childrenDatas.find((childData) => {
      return childData.focus && childData.focus.route.length > 0
    })

    const thisTrail = this.zoomedIn ? [this.getRouteElem(), ...(zoomedChild?.trail || [])] : null
    console.log('serializeData - e')

    const thisFocus = this.focused ? { 
        route: [this.getRouteElem(), ...(focusedChild?.focus?.route || [])],
        char: focusedChild?.focus?.char || 0
      }: null

    return {
      nodes: {
        [this.getId()]: thisContent,
        ...childrenDatas.reduce((acc, childData) => {
          return {
            ...acc,
            ...childData.nodes
          }
        }, {})
      },
      trail: thisTrail,
      focus: thisFocus
    }
  } 

  async deserializeData(data: FosContextData): Promise<void> {

    // console.log('deserializeData')
    if (!data.nodes[this.getId()] ){
      // console.log('data', data, 'id', this.getId())

      data.nodes[this.getId()] = {
        data: this.data,
        content: this.getChildren().map((child: IFosNode) => {
          return [child.getNodeType(), child.getId()]
        })
      }
    }

    this.init(data)
    return
  }

  focusNode(charpos?: number) {
    throw new Error('Method not implemented.')
  }



  async handleChange() {
    console.log('handleChange - A', this.getId())
    // console.trace();
    const newData = this.serializeData()
    console.log('handleChange - B', newData, this, this.cached)
    this.data.updated = {
      ...(this.data.updated  || {}),
      time: Date.now()
    }
    const changed = !_.isEqual(newData, this.cached)
    console.log('handleChange -- changed', changed, this.parent, newData, this.cached)
    if (Object.keys(newData.nodes).length < (Object.keys(this.cached?.nodes || {}).length || 0) ){
      console.log('handleChange -- nodes length', Object.keys(newData.nodes).length, Object.keys(this.serializeData().nodes).length)
      throw new Error('nodes length')

    }
    if (changed){
      // console.log("handleChange --- changed", this.getId(),  this.peers)
      for (const peer of this.peers){
        await this.pushToPeer(peer)
      }
      this.cached = JSON.parse(JSON.stringify(newData))
      await this.notify()
    }
  }

  async notify() {

    console.log("Notifying", this.parent?.getId())
    const thisData = this.serializeData()
    for (const peer of this.peers){
      await peer.pushToPeer(thisData)
    }
    if (this.parent){
      await this.parent.notify()
    }
  }

  getString(){
    return this.data.description?.content || ""
  }

  setString(newString: string){
    // console.log('FOS setString', newString)
    this.setData({
      description: {
        content: newString
      }
    })
    // this.setData notifies
    
  }

  setParent(parent: FosNodeBase){
    this.parent = parent
  }

  setPath(selectionPath: SelectionPath) {
    const thisNodeType = this.getNodeType()
    if (thisNodeType === "task"){
      const thisChildren = this.getChildren()
      const keys = Object.keys(selectionPath)
      if (!_.isEqual(keys, thisChildren.map((child: IFosNode) => child.getId()))){
        throw new Error('path is not valid - selection keys length not equal to children length for task node')
      }
      
      thisChildren.forEach((child, index) => {
        const key = child.getId()
        const childSelection = selectionPath[key]
        child.setPath(childSelection)
      })

      
    } else if (thisNodeType === "option"){
      const keys = Object.keys(selectionPath)
      if (keys.length !== 1){
        throw new Error('path is not valid - selection keys length not 1 for option node')
      }
      const thisData = this.getData()
      const selectedIndex = this.getChildren().findIndex((child: IFosNode) => child.getId() === keys[0])
      const newData = {
        ...thisData,
        option: {
          selectedIndex
        }
      }
      this.setData(newData)
      const selectedChild = this.getChildren()[selectedIndex]
      selectedChild.setPath(selectionPath[keys[0]])

    } else {
      throw new Error('setPath should not be called on a node of type ' + thisNodeType)
    }

  }

  serialize(): string {
    return JSON.stringify(this.serializeData())
  }

  deserialize(data: string): FosNodeBase {
    const parsedData = JSON.parse(data)
    checkDataFormat(parsedData)
    this.deserializeData(parsedData)
    return this
  }

}






export class FosRootNode extends FosNodeBase {

  constructor(contextData: FosContextData, setContextData: (contextData: FosContextData) => Promise<void> = async () => {}) {

    // console.log('FOS - FosRootNode constructor', contextData)
    const id = contextData.trail ? contextData.trail[0][1] : "root"
    const type = contextData.trail ? contextData.trail[0][0] : "root"
    super(contextData, null, id, type)

    const setContextWithLog = async (contextData: FosContextData) => {
      // console.log('setContextData', contextData)
      checkDataFormat(contextData)
      await setContextData(contextData)
    }

    const peer = new FosPeer({
      pushToRemote: setContextWithLog,
      pullFromRemote: async () => contextData,
      pushCondition: async (data) => !!data,
      pullCondition: async () => false,
      data: contextData,
      mergeData:  (data: FosContextData, newData: FosContextData) => newData
    })

    this.addPeer(peer)

  }
  

}






export const checkDataFormat = (data: FosContextData) => {

  // console.log('checking data format', data)

  if ((data as any).data){
    throw new Error('data.data')
  }

  if (!(data as any).nodes){
    // console.log('data', data)
    throw new Error('no data.nodes')
  }

  const hasRoot = Object.keys(data.nodes).some(key => {
    const content = data.nodes[key]?.content
    return content && content.some(([type, id]) => {
      // console.log("key", key, type, id)
      return type === 'task'
  })
  })

  if (!hasRoot){
    // console.log('data', data, data.nodes)
    throw new Error('no node root')
  }

}


const getRootId = (data: FosContextData) => {
  if (!data.trail){
    throw new Error('!data.trail')
  }
  const rootElem = data.trail?.[0]

  if (!rootElem){

    throw new Error('!rootElem')
  }

  return rootElem[1]

}