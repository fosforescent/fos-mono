/* eslint-disable */

import { FosNodeContent, FosContextData, FosRoute, FosTrail, FosNodesData, FosPath, SelectionPath, FosNodeId } from './temp-types'


import _ from 'lodash'

import { FosNodeBase } from './fosNodeBase'
type ChildIndex = number
type OptionIndex = number



export class FosOptionNode extends FosNodeBase {

  

  constructor(context: FosContextData, parent: FosNodeBase | null, id: FosNodeId) {
    super(context, parent, id, "option")
  }

  getSelectedOption() {
    const data = this.getData()
    return data.option?.selectedIndex || 0
  }

  getSelectionPath() {

  }

  setSelectionPath(selectionPath: SelectionPath) {
    throw new Error('not implemented')
    // const newContext = Object.keys(selectionPath).reduce((accOuter, key, index) => {

    //   const thisNode = accOuter.getNode(this.getRoute())
    //   const nodeChildren = thisNode.getChildren()

    //   if (nodeChildren.length === 0){
    //     if (!selectionPath[key as unknown as number]){
    //       console.log('path is not valid - key not found', selectionPath, key)
    //       throw new Error('path is not valid - key not found')
    //     }
    //     if (Object.keys(selectionPath[key as unknown as number] || {}).length !== 0){
    //       console.log('path is not valid - key not empty at leaf', selectionPath, key)
    //       throw new Error('path is not valid')
    //     }


    //     const activeOptionIndex = parseInt(key)
    //     const newContext = thisNode.setNodeData({
    //       ...thisNode.getNodeData(),
    //       selectedOption: activeOptionIndex
    //     })
    //     return newContext

    //   } else {
    //     const selections = selectionPath[key as unknown as number]

    //     if (!selections){
    //       console.log('path is not valid - key not found', selectionPath, key)
    //       throw new Error('path is not valid - key not found')
    //     }
    //     if (selections.length !== nodeChildren.length){
    //       console.log('path is not valid - selections length different from children length', selections.length, nodeChildren.length, selectionPath, key, this.getNodeId())
    //       throw new Error('path is not valid')
    //     }

    //     const updatedContextWithChildSelections = nodeChildren.reduce((accInner: FosContext, child: FosNode, i: number) => {

    //       const childNode = accInner.getNode(child.getRoute())
    //       const childSelection = selections[i]

    //       if (!childSelection){
    //         console.log('path is not valid - selection not found for child', selectionPath, key)
    //         throw new Error('path is not valid - selection not found for child')
    //       }

    //       const selectionKeys = Object.keys(childSelection)

    //       if (selectionKeys.length !== 1){
    //         console.log('path is not valid - selection keys length not 1', selectionKeys, selectionPath, key)
    //         throw new Error('path is not valid')
    //       }

    //       const newChildContext =  childNode.setPath(childSelection)
    //       return newChildContext
    //     }, accOuter)

    //     const nodeFromUpdatedContext = updatedContextWithChildSelections.getNode(thisNode.getRoute())

    //     const updatedContextWithOptionSelection = nodeFromUpdatedContext.setNodeData({
    //       ...nodeFromUpdatedContext.getNodeData(),
    //       selectedOption: parseInt(key)
    //     })

    //     return updatedContextWithOptionSelection

    //   }
      

    // }, this.context)

    // return newContext
  }








  addNewTaskToOption(route: FosRoute, contentIndex?: number, optionIndex?: number ) {
    throw new Error('not implemented')
    // const node = this.getNode(route)

    // const newNodeData: FosNodeContent = {
    //   data: {
    //     description: {
    //       content: ""
    //     }
    //   },
    //   content: [],
    // }

    // const newRowId = this.newId(newNodeData)

    // const existingContent = node.getOptionContent(optionIndex)
    // const newRowIndex = contentIndex === undefined ? existingContent.content.length : contentIndex

    // const existingContentStart = existingContent.content.slice(0, newRowIndex + 1)
    // const existingContentEnd = existingContent.content.slice(newRowIndex + 1)

    // const pathElem = ['task', newRowId] as [string, string]

    // const newRows = existingContentStart.concat([pathElem]).concat(existingContentEnd)

    // const newContent: FosNodeContent = {
    //   ...existingContent,
    //   content: newRows
    // }

    // const newParentData = node.updateOptionData(newContent, optionIndex)
    // const parentId = node.getNodeId()

    // const newRoute = route.concat([pathElem]) as FosRoute

    // const newNodesData: FosNodesData = {
    //   ...this.data.nodes,
    //   [parentId]: newParentData,
    //   [newRowId]: newNodeData
    // }

    // console.log('route', route, newRoute)

    // return this.setNodes(newNodesData, { route: newRoute, char: 0 })

  }

  

  setOptionOnNode(route: FosRoute, optionData: FosNodeContent | null, index?: number) {
    throw new Error('not implemented')
    // const node = this.getNode(route)
    // const newNodeData = node.updateOptionData(optionData, index)
    // const newContext: FosContext = this.setNode(node, newNodeData)
    // console.log('newNodes', newContext);
    // return newContext
  }

  addOptionToNode(route: FosRoute, nodeOptionData?: FosNodeContent, index?: number) {
    throw new Error('not implemented')
    // const node = this.getNode(route)

    // const newOptionIndex = index === undefined ? node.getNodeData().options.length : index

    // const nodeData = node.getNodeData()
    // const newContent: FosNodeContent = {
    //   description: "",
    //   data: {},
    //   content: [],
    //   ...nodeOptionData
    // }
    // const optionsStart = nodeData.options.slice(0, newOptionIndex)
    // const optionsEnd = nodeData.options.slice(newOptionIndex)

    // const newNodeData: FosNodeData = {
    //   ...nodeData,
    //   selectedOption: newOptionIndex,
    //   options: optionsStart.concat([newContent]).concat(optionsEnd) as [FosNodeContent, ...FosNodeContent[]]
    // }
    // const newContext: FosContext = node.updateNodeData(newNodeData)
    // console.log('newNodes', newContext);
    // return this.context.setNodes(newContext.data.nodes);
  }

}


