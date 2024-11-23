import { is, tr } from "date-fns/locale";
import { AppState, DragInfo, FosPath, FosRoute, TrellisSerializedData } from "../types";
import { pathEqual } from "../utils";
import { FosNode } from "./node";
import { FosStore } from "./store";



export class FosExpression {

  store: FosStore
  route: FosPath
  instructionNode: FosNode
  targetNode: FosNode
  parent: FosExpression | undefined

  constructor(store: FosStore, route: FosPath) {

    console.log('constructing expression', route)
    this.route = route
    this.store = store
    if (route.length !== 0) {
      this.parent = new FosExpression(store, route.slice(0, -1))
    }

    const lastElem = route[route.length - 1]

    if (!lastElem) {
      this.instructionNode = store.rootInstruction
      this.targetNode = store.rootTarget
    } else {
      const instructionNode = store.getNodeByAddress(lastElem[0])
      if (!instructionNode){
        throw new Error('Instruction node not found')
      }
      this.instructionNode = instructionNode
      const targetNode = store.getNodeByAddress(lastElem[1])
      if (!targetNode){
        throw new Error('Target node not found')
      }
      this.targetNode = targetNode
    }

  }


  getChildren(): FosExpression[] {
    const children = this.targetNode.getEdges().map((edge) => {
      return new FosExpression(this.store, [...this.route, edge])
    })
    return children
  }

  isTodo(): boolean {
    const leftSideWorkflow = this.instructionNode.getId() === this.store.workflowFieldNode.getId()
    const rightSideChoice = this.targetNode.getId() === this.store.choiceTargetNode.getId()
 


    return leftSideWorkflow || rightSideChoice
  }

  
  isWorkflow(): boolean {
    const isTask = this.store.workflowFieldNode.getId() === this.instructionNode.getId()
    return isTask
  }

  isOption(): boolean {
    // alternatively... is workflow whose instruction is a choice
    const isOption = this.store.optionConstructor.getId() === this.targetNode.getId()
    return isOption
  }

  isRoot(): boolean {
    return this.route.length === 0
  }

  isChoice(): boolean {
    const isChoice = this.store.choiceTargetNode.getId() === this.targetNode.getId()
    return isChoice
  }

  isDocument(): boolean {
    const isDocument = this.store.documentFieldNode.getId() === this.instructionNode.getId()
    return isDocument      
  }

  getDescription(): string {
    return this.targetNode.getContent().data.description?.content || ""
  }

  isLocked(): boolean {
    return false
  }


  isCollapsed(): boolean {
    const found = this.store.trellisData.collapsedList.find((collapsedRoute) => {
      return pathEqual(collapsedRoute, this.route)
    })
    return !!found
  }

  isDragging(): boolean {
    const isDragging = pathEqual(this.store.trellisData.dragInfo.dragging?.nodeRoute || [], this.route)
    return isDragging
  }

  isDraggingOver(): boolean {
    const isDraggingOver = pathEqual(this.store.trellisData.dragInfo.dragOverInfo?.nodeRoute || [], this.route)
    return isDraggingOver
  }

  hasFocus(): boolean {
    return pathEqual(this.store.trellisData.focusRoute, this.route)
  }

  getFocusChar(): number | null {
    return this.store.trellisData.focusChar
  }

  getDepth(): number {
    return this.route.length
  }
  
  hasParent(): boolean {
    return this.route.length > 0
  }

  getParent(): FosExpression {
    if (this.hasParent()){
      return new FosExpression(this.store, this.route.slice(0, -1))
    } else {
      throw new Error('Cannot get parent of root node')
    }
  }

  getAllowedChildren(): string[] {
    // let allowedChildren
    // if (isRoot){
    //   allowedChildren = ['workflow', 'group', 'todo', 'option', 'comment', 'document']
    // }else if (isTask){
    //   allowedChildren = ['todo', 'option', 'comment']
    // }else if (isOption){
    //   allowedChildren = ['selected', 'workflow']
    // }else if (isComment){
    //   allowedChildren = ['comment']
    // }else if (isDocument){
    //   allowedChildren = ['document']
    // }else if (isChoice){
    //   allowedChildren = ['', 'todo']
    // }
    throw new Error("Method not implemented.")
  }

  getDragItem(breadcrumb: boolean = false) {
    console.log('getDragItem', breadcrumb, this)
    const nodeType = this.instructionNode.getId()
    const nodeId = this.targetNode.getId()
    const dragItem = {
      id: `${nodeType}-${nodeId}`,
      data: { nodeRoute: this.route, breadcrumb },
      breadcrumb
    }
    return dragItem
  }


  expressionContent() {
    return {
      nodeType: this.instructionNode.getId(),
      nodeId: this.targetNode.getId(),
      nodeContent: this.targetNode.getContent(),
      instructionContent: this.instructionNode.getContent(),
    }
  }

  getOptions() {
    if (this.isOption()){
  
      return this.getChildren().map((child, index) => {
        return ({value: index.toString(), label: child.getDescription()})
      })
    } else {
  
      throw new Error('getOptions must be used on an option expression')
  
    }
  }

  getSelectedChild() {

  }

  getOptionInfo() {
    const { nodeData, nodeContent, nodeChildren } = this.getExpressionInfo()

    if (nodeContent.children.length < 2){
      throw new Error('Should not have less than 2 options')
    }
    const selectedIndex = nodeData.option?.selectedIndex || 0
  
    const nodeOptions = this.getOptions()
  
    if (!nodeChildren[selectedIndex]){
      throw new Error('selectedChild not found')
    }
    const selectedChildRoute: FosPath = [...this.route , nodeChildren[selectedIndex]]
  
    
    const isOptionChildCollapsed = this.store.trellisData.collapsedList.some((route) => pathEqual(route, selectedChildRoute))
  
    const resolutionStrategy = nodeData.option?.defaultResolutionStrategy || 'selected'
  
    if (!selectedChildRoute){
      throw new Error('selectedChild not found')
    }

    const selectedOption = nodeOptions[selectedIndex]

    if(!selectedOption){
      throw new Error('selectedOption not found')
    }

    const selectedChild = new FosExpression(this.store, selectedChildRoute)

    return {
      getSelectedNodeInfo: selectedChild.getExpressionInfo,
      selectedIndex,
      selectedChildRoute,
      nodeOptions,
      selectedOption,
      selectedChild,
      isOptionChildCollapsed,
      resolutionStrategy,
    }
  }

  isDisabled() {
    return false
  }

  getSelectedOptionAndIndexInParent() {

  }

  getParentInfo() {

    const parentRoute = this.route.slice(0, this.route.length - 1)
    if (parentRoute.length === 0){
      throw new Error('Cannot get parent of root node') 
    } else {
      const parent = this.getParent()
      const parentInfo = parent.getExpressionInfo()

      const {
        nodeType: parentType,
        nodeId: parentId,
        nodeContent: parentContent,
        instructionContent: parentInstructionContent,
      } = parent.expressionContent()

      const {
        nodeType,
        nodeId
      } = this.expressionContent()


      // console.log('parentInfo', nodeType, nodeId, parentInfo.nodeChildren)
      const indexInParent = parentInfo.nodeChildren.findIndex(([childType, childId]) => {
        // console.log('childType', childType, nodeType, childType === nodeType, childType === nodeType && childId === nodeId)
        // console.log('childId', childId, nodeId, childId === nodeId, childType === nodeType && childId === nodeId)
        return childType === nodeType && childId === nodeId
      })

      const siblingRoutes = parentInfo.childRoutes //.filter((_, i) => i !== indexInParent)

      return {
        ...parentInfo,
        indexInParent,
        siblingRoutes,
        parentType,
        parentId,
        parentContent,
        parentInstructionContent,
        
      }
    }
    

  }

  getChildrenOfType(type: string) {
    //(type: FosNodeId) => getChildrenToShow(state, nodeRoute, type)
    return this.getChildren().filter((child) => child.instructionNode.getId() === type)
  }

  getNodesOfType() {
    const ctxData = this.store.exportContext(this.route)
    return getNodesOfTypeForPath(ctxData, this.route)

  }


  getGroupInfo() {


  }

  getCommentInfo() {

  }

  getExpressionInfo() {

    const nodeType = this.instructionNode.getId()
    const nodeId = this.targetNode.getId()
  
    const nodeLabel = `${nodeType}-${nodeId}`
  
    const nodeDescription = this.getDescription()
    const truncatedDescription =  nodeDescription.length > 20 ? nodeDescription.slice(0, 17) + '...' : nodeDescription
  
    const children = this.getChildren()
    const hasChildren = children.length > 0
    const childRoutes = children.map((child) => child.route)
    const depth = this.getDepth()
  
    const maxDepth = this.store.trellisData.rowDepth
    const isTooDeep = depth > maxDepth
    const isWorkflow = this.isWorkflow()
    const isTodo = this.isTodo()
  
    const nodeContent = this.instructionNode.getContent()
  
    const nodeData = nodeContent.data
    const nodeChildren = nodeContent.children
  
    const hasParent = this.hasParent()

    const expressionContent = this.expressionContent()
    const isCollapsed = this.isCollapsed()
    const childrenVisible = !isCollapsed && !isTooDeep

    const isBase = pathEqual(this.route, this.store.fosRoute)

    const isSearch = nodeType === this.store.searchQueryNode.getId()

    return {
      ...expressionContent,
      childrenVisible,
      hasParent,
      locked: this.isLocked(),
      isDragging: this.isDragging(),
      draggingOver: this.isDraggingOver(),
      nodeDescription: this.getDescription(),
      isRoot: this.isRoot(),
      isCollapsed,
      isSearch,
      children,
      childRoutes,
      hasChildren,
      focusChar: this.store.trellisData.focusChar,
      isTooDeep,
      hasFocus: this.hasFocus(),
      depth,
      nodeLabel,
      dragLabel: nodeLabel,
      isOption: this.isOption(),
      isChoice: this.isChoice(),
      isDocument: this.isDocument(),
      disabled: this.isDisabled(),
      isTodo,
      isWorkflow,
      nodeData,
      nodeContent,
      nodeChildren,
      nodeRoute: this.route,
      getDragItem: this.getDragItem.bind(this),
      getParentInfo: this.getParentInfo.bind(this),
      getOptionInfo: this.getOptionInfo.bind(this),
      getChildrenOfType: this.getChildrenOfType.bind(this),
      getNodesOfType: this.getNodesOfType.bind(this),
      getGroupInfo: this.getGroupInfo.bind(this),
      truncatedDescription,
      isBase
  
    }
  }


}


export const getExpressionInfo = (nodeRoute: FosPath, state: AppState["data"]) => {

  const store = new FosStore(state)  
  const expression = new FosExpression(store, nodeRoute)

  return expression.getExpressionInfo()
}






export const getNodesOfTypeForPath = (appData: AppState["data"], nodeRoute: FosPath) => {


  console.log('getNodesOfTypeForPath', nodeRoute, appData)
  const { childRoutes } = getExpressionInfo(nodeRoute, appData)

  const workflows = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getExpressionInfo(childRoute, appData)
    return nodeType === 'WORKFLOW' || nodeType === 'OPTION'
  })

  const todos = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getExpressionInfo(childRoute, appData)
    return nodeType === 'TODO' || nodeType === 'RACE' || nodeType === 'CHOICE'
  })

  const groups = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getExpressionInfo(childRoute, appData)
    return nodeType === 'GROUP'
  })

  const comments = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getExpressionInfo(childRoute, appData)
    return nodeType === 'COMMENT'
  })

  const documents = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getExpressionInfo(childRoute, appData)
    return nodeType === 'DOCUMENT'
  })

  const marketRequest = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getExpressionInfo(childRoute, appData)
    return nodeType === 'marketRequest'
  })

  const marketService = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getExpressionInfo(childRoute, appData)
    return nodeType === 'marketService'
  })

  const field = () => childRoutes.filter((childRoute) => {
    const { nodeType } = getExpressionInfo(childRoute, appData)
    return nodeType === 'field'
  })

  return {
    workflows,
    todos,
    groups,
    comments,
    documents,
    marketRequest,
    marketService,
    field,

  }

}