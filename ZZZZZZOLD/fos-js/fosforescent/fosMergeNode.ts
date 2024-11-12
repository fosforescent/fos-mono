
// import { FosRoute } from './temp-types'

export {}

// export class FosOptionNode extends FosNode{

//   activeOptionIndex: number | null = null
//   activeRowIndex: number | null = null

//   constructor(public context: FosContext, public route: FosRoute) {
//     super(context, route)
//   }


// acceptMerge() {
//   const mergeNode = this.getNodeData().mergeNode
//   if (!mergeNode){
//     throw new Error('no merge node')
//   }
//   const mergeNodeData = this.context.data.nodes[mergeNode]
//   if (!mergeNodeData){
//     throw new Error('no merge node data')
//   }
//   const [parent, childIndex, optionIndex] = this.getParent(1)
//   const currentContent = parent.getOptionContent(optionIndex)
//   if (!currentContent.content[childIndex]){
//     console.log('acceptMerge - no current content', currentContent, childIndex, currentContent.content)
//     throw new Error('no current content')
//   }
//   const rowElem = currentContent.content[childIndex]
//   if (!rowElem){
//     console.log('acceptMerge - no current content', currentContent, childIndex, currentContent.content)
//     throw new Error('no current content')
//   }

//   const newRowElem: [string, string] = [rowElem[0], mergeNode]
//   const newRowsStart = currentContent.content.slice(0, childIndex)
//   const newRowsEnd = currentContent.content.slice(childIndex + 1)
//   const mergedContent = {
//     ...currentContent,
//     content: [...newRowsStart, newRowElem, ...newRowsEnd]
//   }
//   const newContext = parent.setNodeOptionData(optionIndex, mergedContent)
//   const thisNewNode = newContext.getNode(this.route)
//   const thisNewNodeData = thisNewNode.getNodeData()
//   const thisNewNodeUpdatedData = {
//     ...thisNewNodeData,
//     mergeNode: undefined
//   }
//   const newContext2 = thisNewNode.setNodeData(thisNewNodeUpdatedData)
//   return newContext2
// }

// rejectMerge(){
//   const mergeNode = this.getNodeData().mergeNode
//   if (!mergeNode){
//     throw new Error('no merge node')
//   }
//   const mergeNodeData = this.context.data.nodes[mergeNode]
//   if (!mergeNodeData){
//     throw new Error('no merge node data')
//   }

//   const thisNodeData = this.getNodeData()
//   const thisNodeUpdatedData = {
//     ...thisNodeData,
//     mergeNode: undefined
//   }
//   const newContext = this.setNodeData(thisNodeUpdatedData)
//   // console.log('rejectMerge', newContext.getNode(this.route).getNodeData())
//   return newContext
// }

// bothMerge() {
//   const mergeNode = this.getNodeData().mergeNode
//   if (!mergeNode){
//     throw new Error('no merge node')
//   }
//   const mergeNodeData = this.context.data.nodes[mergeNode]
//   if (!mergeNodeData){
//     throw new Error('no merge node data')
//   }
//   const [parent, childIndex, optionIndex] = this.getParent(1)
//   const currentContent = parent.getOptionContent(optionIndex)

//   const rowElem = currentContent.content[childIndex]
//   if (!rowElem){
//     console.log('acceptMerge - no current content', currentContent, childIndex, currentContent.content)
//     throw new Error('no current content')
//   }
//   const newRowElem: [string, string] = [rowElem[0], mergeNode]
  
//   const newRowsStart = currentContent.content.slice(0, childIndex + 1)
//   const newRowsEnd = currentContent.content.slice(childIndex + 1)
//   const mergedContent = {
//     ...currentContent,
//     content: [...newRowsStart, newRowElem, ...newRowsEnd]
//   }
//   const newContext = parent.setNodeOptionData(optionIndex, mergedContent)
//   const thisNewNode = newContext.getNode(this.route)
//   const thisNewNodeData = thisNewNode.getNodeData()
//   const thisNewNodeUpdatedData = {
//     ...thisNewNodeData,
//     mergeNode: undefined
//   }
//   const newContext2 = thisNewNode.setNodeData(thisNewNodeUpdatedData)
//   return newContext2
// }


// getMergeOptions(): {
//   description: Change[],
//   content: ArrayChange<[string, string]>[]
// }[] {
//   const baseNodeOptions = this.getNodeData().options
//   const mergeNodeOptions = this.mergeNodeData().options


//   const optionsDiff = diffArrays(baseNodeOptions, mergeNodeOptions, { comparator: (left: FosNodeContent, right: FosNodeContent) => {
//     return diffIsClose(diffChars(left.description, right.description)) || diffIsClose(diffArrays(left.content, right.content))
//   } })
  

//   let currentBaseNodeIndex = 0
//   let currentMergeNodeIndex = 0

//   const optionsDiffWithSubdiffs = optionsDiff.reduce((acc: {
//     description: Change[],
//     content: ArrayChange<[string, string]>[]
//   }[], change: ArrayChange<FosNodeContent>) => {
    
//     if (change.added){
//       // taking new
//       const withDiffs = change.value.map((optionValue, i) => {
//         const mergeIndex = currentMergeNodeIndex + i
//         const mergeNodeOption = mergeNodeOptions[mergeIndex]

//         if (!mergeNodeOption){
//           throw new Error('no merge node option')
//         }

//         const mergeDescription = mergeNodeOption.description
//         const mergeContent = mergeNodeOption.content

//         return {
//           description: diffChars(mergeDescription, mergeDescription),
//           content: diffArrays(mergeContent, mergeContent, { comparator: (left: [string, string], right: [string, string]) => {
//             return left[0] === right[0] && left[1] === right[1]
//           } })
//         }

//       })
//       currentMergeNodeIndex = change.count ? currentMergeNodeIndex + change.count : currentMergeNodeIndex
//       return [...acc, ...withDiffs]
//     } else if (change.removed) {
//       // taking old
//       const withDiffs = change.value.map((optionValue, i) => {
//         const baseIndex = currentBaseNodeIndex + i
//         const baseNodeOption = baseNodeOptions[baseIndex]

//         if (!baseNodeOption){
//           throw new Error('no merge node option')
//         }

//         const baseDescription = baseNodeOption.description
//         const baseContent = baseNodeOption.content

//         return {
//           description: diffChars(baseDescription, baseDescription),
//           content: diffArrays(baseContent, baseContent, { comparator: (left: [string, string], right: [string, string]) => {
//             return left[0] === right[0] && left[1] === right[1]
//           } })
//         }

//       })
//       currentBaseNodeIndex = change.count ? currentBaseNodeIndex + change.count : currentBaseNodeIndex
//       return [...acc, ...withDiffs]

//     } else {
//       const withDiffs = change.value.map((optionValue, i) => {

//         const mergeIndex = currentMergeNodeIndex + i
//         const mergeNodeOption = mergeNodeOptions[mergeIndex]

//         if (!mergeNodeOption){
//           throw new Error('no merge node option')
//         }

//         const mergeDescription = mergeNodeOption.description
//         const mergeContent = mergeNodeOption.content

//         const baseIndex = currentBaseNodeIndex + i
//         const baseNodeOption = baseNodeOptions[baseIndex]

//         if (!baseNodeOption){
//           throw new Error('no merge node option')
//         }

//         const baseDescription = baseNodeOption.description
//         const baseContent = baseNodeOption.content

//         return {
//           description: diffChars(baseDescription, mergeDescription),
//           content: diffArrays(baseContent, mergeContent, { comparator: (left: [string, string], right: [string, string]) => {
//             return left[0] === right[0] && left[1] === right[1]
//           } })
//         }

//       })
//       currentBaseNodeIndex = change.count ? currentBaseNodeIndex + change.count : currentBaseNodeIndex
//       return [...acc, ...withDiffs]
//     }


//   }, [])

//   return optionsDiffWithSubdiffs
// }

// hasMerge() {
//   const nodeOptions = this.getNodeData()
//   const hasMergeID = !!nodeOptions.mergeNode

//   const mergeDiff = nodeOptions.mergeNode ? !_.isEqual(nodeOptions, this.context.data.nodes[nodeOptions.mergeNode] || {}) : false


//   const hasMerge = hasMergeID && mergeDiff
//   // console.log('hasMerge', hasMerge, hasMergeID, mergeDiff, nodeOptions, this.context.data.nodes[nodeOptions.mergeNode!], this.context.data.nodes)
//   return hasMerge  
// }

// getMergedIndex() {
//   const nodeOptions = this.getNodeData()
//   const mergeNode = nodeOptions.mergeNode
//   if (!mergeNode){
//     throw new Error('no merge node')
//   }
//   const mergeNodeData = this.context.data.nodes[mergeNode]
//   if (!mergeNodeData){
//     throw new Error('no merge node data')
//   }
//   const baseNodeIndex = nodeOptions.selectedOption
//   const mergeNodeIndex = mergeNodeData.selectedOption

//   return (mergeNodeIndex ? mergeNodeIndex : baseNodeIndex)

// }

// getMergeChildren(index?: number) {
//   if (!index){
//     index = this.getMergedIndex()
//   }
//   if (!index){
//     throw Error("no index")
//   }
//   const mergedOptions = this.getMergeOptions()
//   const mergedOption = mergedOptions[index]
//   if (!mergedOption){
//     throw new Error('no merged option')
//   }
//   const mergedContent = mergedOption.content
//   const mergeChildren : {
//     added?: boolean,
//     removed?: boolean,
//     node: FosNode
//   }[] = mergedContent.reduce((acc: {
//     added?: boolean,
//     removed?: boolean,
//     node: FosNode
//   }[], change: ArrayChange<[string, string]>) => {
//     const changeNodes = change.value.map(([type, id]) => {
//       const newRoute = this.route.concat([[type, id]]) as FosRoute
//       // if (type === 'task') {
//         const result: {
//           added?: boolean,
//           removed?: boolean,
//           node: FosNode
//         } = {
//           ...(change.added ? {added: true} : {}),
//           ...(change.removed ? {removed: true} : {}),
//           node: this.context.getNode(newRoute)
//         }
//         return result
//       // } else {
//       //   throw new Error(`unknown type ${type}`)
//       // }
//     })
//     const result : {
//       added?: boolean,
//       removed?: boolean,
//       node: FosNode
//     }[] = [...acc, ...changeNodes]

//     return result
//   }, [])
//   return mergeChildren
// }


// mergeNodeData(){
//   const mergeNode = this.getNodeData().mergeNode
//   if (!mergeNode){
//     throw new Error('no merge node')
//   }
//   const mergeNodeData = this.context.data.nodes[mergeNode]
//   if (!mergeNodeData){
//     throw new Error('no merge node data')
//   }
//   return mergeNodeData
// }

// mergeNodeContent() {
//   const mergeNodeData = this.mergeNodeData()
//   const mergeSelectedOption = mergeNodeData.selectedOption
//   const mergeNodeContent = mergeNodeData.options[mergeSelectedOption]

//   if (!mergeNodeContent){
//     console.log('getMergeDescription - no merge content', mergeNodeContent)
//     throw new Error('no merge content')
//   }
//   return mergeNodeContent
// }






// }













// type DiffChange <T> = Change | ArrayChange<T>

// const diffIsClose = <T>(diffArray: DiffChange<T>[] ) => {
//   if (diffArray.length === undefined || isNaN(diffArray.length)){
//     throw new Error('diff array is empty')
//   }
//   // console.log('diffIsClose', diffArray)
//   const {
//     total,
//     changed
//   } : { total: number, changed: number } = diffArray.reduce((acc: {total: number, changed: number}, change : DiffChange<T> ) => {

//     const result : {total : number, changed: number } = { 
//       changed: (change.added || change.removed) ? acc.changed + 1 : acc.changed,
//       total: acc.total + 1
//     }
//     return result
//   }, {total: 0, changed: 0})
//   // console.log('total', changed / total, diffArray)
//   return ( changed / total ) < 0.5
// }