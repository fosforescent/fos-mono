
import { FosDataContent, IFosNode, IFosPeer, FosPeer, FosContextData, defaultContext } from "@/fos-js";
import {  TrellisNodeInterface, TrellisSerializedData } from "@/react-trellis";



class FosWrapper implements TrellisNodeInterface<FosWrapper> {


  constructor(private node: IFosNode) {

  }



  setChildren(children: FosWrapper[]): void {

    this.node.setChildren(children.map(child => child.fosNode()))


  }


  getChildren(): FosWrapper[] {
    const nodeType = this.node.getNodeType()
    // console.log('getChildren', nodeType, this.node.getChildren().map(child => child.getId()))
    const thisChildren = this.node.getChildren()
    if (thisChildren.length === 0){
      // console.log('no children', this.node)
      return []
    }

      const children = this.node.getChildren().map(child => new FosWrapper(child))
      // console.log('children', this.node, children)
      return children
 
  }


  getOptions(): FosWrapper[] {
    const nodeType = this.node.getNodeType()
    if (nodeType === "option"){
      return this.node.getChildren().map(child => new FosWrapper(child))
    } else if (nodeType === "workflow"){
      return [new FosWrapper(this.node)]
    } else if (nodeType === "todo"){
      return [new FosWrapper(this.node)]
    } else {
      throw new Error(`Method not implemented for type ${nodeType}.`);
    }
  }

  setOptions(options: FosWrapper[]): void {
    const nodeType = this.node.getNodeType()
    if (nodeType === "option"){
      if (options.length > 0){
        this.node.setChildren(options.map(option => option.fosNode()))
      } else {
        // set child to option, then snip option
        // this.node.setChildren(options.map(option => option.fosNode()))
        const currentParent = this.getParent()
        if (!currentParent){
          throw new Error('Cannot set options on option with no parent')
        }
        const currentParentChildren = currentParent?.getChildren() || []
        const singleOption = options[0]!

        const updatedChildren = currentParentChildren.map(child => {
          if (child.getId() === this.getId()){
            return singleOption
          } else {
            return child
            }
        });
        currentParent.setChildren(updatedChildren)
      }
    } else if (nodeType === "workflow"){
        console.log('setOptions', options.map(option => option.getId()), nodeType, options.length)
      if (options.length > 1){
        const currentParent = this.getParent()
        if (!currentParent){
          throw new Error('Cannot set options on option with no parent')
        }
        const optionNode = currentParent.newChild("option")
        optionNode.setChildren(options)
        const currentParentChildren = this.getParent()?.getChildren() || []
        const newParentChildren = currentParentChildren.map(child => {
          if (child.getId() === this.getId()){
            return optionNode
          } else {
            return child
          }
        });
      } else {
        throw new Error('Cannot set option on task with less than 2 options')        
      }
    } else if (nodeType === "todo"){
      console.log('setOptions', options.map(option => option.getId()), nodeType, options.length)
    if (options.length > 1){
      const currentParent = this.getParent()
      if (!currentParent){
        throw new Error('Cannot set options on option with no parent')
      }
      const optionNode = currentParent.newChild("option")
      optionNode.setChildren(options)
      const currentParentChildren = this.getParent()?.getChildren() || []
      const newParentChildren = currentParentChildren.map(child => {
        if (child.getId() === this.getId()){
          return optionNode
        } else {
          return child
        }
      });
    } else {
      throw new Error('Cannot set option on task with less than 2 options')        
    }
  } else if (nodeType === "root"){
      throw new Error(`Method not implemented for type ${nodeType}.`);
    }
  }

  getId(): string {
    return this.node.getId()
  }


  newChild(nodeType: string | null = null): FosWrapper {
    console.log('newChild', nodeType, this.node.getNodeType())
    const newChildNode = this.node.newChild(nodeType)
    // console.log('newChildState', newChildNode.serialize())
    return new FosWrapper(newChildNode)
  }

  getString(): string {
    const thisNodeString =  this.node.getString()
    return thisNodeString
  }

  setString(value: string): void {
    this.node.setString(value)
  }

  getParent(): FosWrapper | null {
    const parentNode = this.node.getParent()
    if (!parentNode) {
      return null
    }
    return new FosWrapper(parentNode)
  }
  
  getData(): FosDataContent {
    return this.node.getData()
  }

  setData(data: FosDataContent): void {
    // console.log('fosWrapper.setData')
    this.node.setData(data)
  }

  getNodeType(): string {
    return this.node.getNodeType()
  }

  fosNode(): IFosNode {
    return this.node
  }

  addOption(): FosWrapper {
    console.log('addOption', this.node.getNodeType())
    const nodeType = this.node.getNodeType()
    if (nodeType === "option"){
      const optionNode = this.newChild("option")
      this.setOptions(this.getOptions().concat([optionNode]) )
      const newOption = this.getOptions().find((option, index) => {
        return option.getId() === optionNode.getId()
      })
      if (!newOption){
        throw new Error('new option not found')
      }
      return newOption
    } else {
      throw new Error('Cannot add option to : ' + nodeType)
    }
  }

  getRoute(): FosWrapper[] {
    const parent = this.getParent()
    if (!parent){
      return [this]
    } else {
      return parent.getRoute().concat([this])
    }
  }

  getTrellisRoute(): string[] {
    const thisRoute = this.getRoute()
    console.log('getTrellisRoute', thisRoute.map(n => n.getId()), thisRoute)
    // const filteredRoute = thisRoute.filter(node => node.getNodeType() === "workflow" || node.getNodeType() === "root")
    const ids = thisRoute.map(node => node.getId())
    // console.log('getTrellisRoute', thisRoute.map(n => n.getId()), ids, filteredRoute.map(node => node.getNodeType()))
    return ids
  }

  getSelectedOption(): FosWrapper {
    const thisNodeType = this.getNodeType()

    if (thisNodeType === "option"){
      const thisData = this.getData()
      const selectedIndex = thisData.option?.selectedIndex || 0
      const options = this.getOptions()
      const selectedOption = options[selectedIndex]
      if (!selectedOption){
        throw new Error('selectedOption not found')
      }
      return selectedOption
    } else if (thisNodeType === "workflow"){
      return this
    } else if (thisNodeType === "todo"){
      return this
    } else {
      throw new Error('getSelectedOption not implemented for this node type')
    }

  }

  // serialize(): string {
  //   return this.node.serialize()
  // }

  // deserialize (data: string): FosWrapper{
  //   const deserializedNode = this.node.deserialize(data)
  //   return new FosWrapper(deserializedNode)
  // };

  syncPeers(): void {
    const peerData = this.node.getData().peers
    const peers = createPeers(peerData)
    for (const peer of peers){
      this.node.pullFromPeer(peer)
      this.node.pushToPeer(peer)
    }


  }

}


const createPeers = (peerData: FosDataContent["peers"]): IFosPeer[] => {
  if (!peerData){
    return []
  }

  const peers = Object.entries(peerData).map(([peerId, peerData]) => {
    const peer = new FosPeer({
      pushToRemote: async (data: FosContextData) => {
        throw new Error('pushToRemote not implemented')
        console.log('pushToRemote', data)
      },
      pullFromRemote: async () => {
        console.log('pullFromRemote')
        throw new Error('pullFromRemote not implemented')
        return undefined
      },
      pushCondition: async () => {
        throw new Error('pushCondition not implemented')
        return true
      },
      pullCondition: async () => {
        throw new Error('pullCondition not implemented')
        return true
      },
      data: defaultContext, 
      mergeData(newData, baseData) {
        return newData
      },
    })
    // peer.pullFromPeer(peerData)
    return peer
  })

  return peers
}


export {
  FosWrapper
}