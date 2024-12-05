
import { ta } from "date-fns/locale"
import { AppState, FosDataContent, FosNodeContent, FosNodeId, FosPath, FosPathElem, FosReactGlobal } from "../types"
import { getAncestorLeastUpSibling, getDownNode, getDownSibling, getGroupFromRoute, getUpNode, getUpSibling, mutableReduceToRouteMapFromExpression, pathEqual } from "../utils"
import { FosNode } from "./node"
import { FosStore } from "./store"
import { QrCode } from "lucide-react"

export class FosExpression {
  store: FosStore
  route: FosPath
  instructionNode: FosNode
  targetNode: FosNode

  constructor(store: FosStore, route: FosPath) {
    this.route = route
    this.store = store

    const lastElem = route[route.length - 1]

    if (!lastElem) {
      const rootNode = store.getNodeByAddress(store.rootNodeId)

      if (!rootNode) {
        throw new Error('Root node not found')
      }

      const targetNode = rootNode.getAliasTarget()
      const instructionNode = store.primitive.voidNode
      this.instructionNode = instructionNode
      this.targetNode = targetNode
    } else {
      const instructionNode = store.getNodeByAddress(lastElem[0])
      if (!instructionNode) {
        throw new Error('Instruction node not found')
      }
      this.instructionNode = instructionNode
      const targetNode = store.getNodeByAddress(lastElem[1])
      if (!targetNode) {
        throw new Error('Target node not found')
      }
      this.targetNode = targetNode
    }
  }

  // Core Property Getters
  expressionType(): string {
    return this.instructionNode.getId()
  }

  expressionId(): string {
    return this.targetNode.getId()
  }

  expressionLabel(): string {
    return `${this.expressionType}-${this.expressionId}`
  }

  dragLabel(): string {
    return this.expressionLabel()
  }

  // instructionContent(): any {
  //   return this.instructionNode.getContent()
  // }

  // nodeData(): FosDataContent {
  //   return this.nodeContent().data
  // }

  // nodeChildren(): FosPathElem[] {
  //   return this.nodeContent().children
  // }

  // nodeContent(): FosNodeContent {
  //   return this.instructionNode.getContent()
  // }

  // nodeChild(index: number): FosPathElem {
  //   const child = this.nodeChildren()[index]
  //   if (!child) {
  //     throw new Error(`Child at index ${index} not found`)
  //   }
  //   return child
  // }

  childRoutes(): FosPath[] {
    return this.targetNode.getEdges().map(childEdge => [...this.route, childEdge])
  }

  hasChildren(): boolean {
    return this.targetNode.getEdges().length > 0
  }

  childrenVisible(): boolean {
    return !this.isCollapsed() && !this.isTooDeep()
  }

  depth(): number {
    return this.route.length
  }

  focusChar(): number | null {
    return this.store.trellisData.focusChar
  }

  pathElem(): FosPathElem {
    return [this.instructionNode.getId(), this.targetNode.getId()]
  }
  // State Getters
  currentMode(): string {
    return this.store.trellisData.mode
  }

  currentView(): string {
    return this.store.trellisData.view
  }

  currentActivity(): string {
    return this.store.trellisData.activity
  }

  currentGroup(): any {
    return getGroupFromRoute(this.route, this.store)
  }

  // Type Check Methods
  isRoot(): boolean {
    return this.route.length === 0
  }

  hasParent(): boolean {
    return this.route.length > 0
  }

  isWorkflow(): boolean {
    return this.store.primitive.workflowField.getId() === this.instructionNode.getId()
  }

  isOption(): boolean {
    return this.store.primitive.optionConstructor.getId() === this.targetNode.getId()
  }

  isChoice(): boolean {
    return this.store.primitive.choiceTarget.getId() === this.targetNode.getId()
  }

  isDocument(): boolean {
    return this.store.primitive.documentField.getId() === this.instructionNode.getId()
  }

  isComment(): boolean {
    return this.expressionType() === this.store.primitive.commentConstructor.getId()
  }

  isGroup(): boolean {
    return this.expressionType() === this.store.primitive.groupField.getId()
  }

  isMarketRequest(): boolean {
    return this.expressionType() === this.store.primitive.marketRequestNode.getId()
  }

  isMarketService(): boolean {
    return this.expressionType() === this.store.primitive.marketServiceNode.getId()
  }

  isSearch(): boolean {
    return this.expressionType() === this.store.primitive.searchQueryNode.getId()
  }

  isSearchResults(): boolean {
    return this.expressionType() === this.store.primitive.searchResultsNode.getId()
  }

  isLastNameField(): boolean {
    return this.expressionType() === this.store.primitive.lastNameField.getId()
  }

  isFirstNameField(): boolean {
    return this.expressionType() === this.store.primitive.firstNameField.getId()
  }

  isEmailField(): boolean {
    return this.expressionType() === this.store.primitive.emailField.getId()
  }

  isConflict(): boolean {
    return this.expressionType() === this.store.primitive.conflictNode.getId()
  }

  isError(): boolean {
    return this.expressionType() === this.store.primitive.errorNode.getId()
  }

  isContact(): boolean {
    return this.expressionType() === this.store.primitive.contactField.getId()
  }

  isBase(): boolean {
    return pathEqual(this.route, this.store.fosRoute)
  }

  equals(other: FosExpression): boolean {

    return pathEqual(this.route, other.route)
  }

  // State Check Methods
  isLocked(): boolean {
    return false
  }

  isDisabled(): boolean {
    return false
  }

  isEditing(): boolean {
    return false
  }

  isDiffing(): boolean {
    return false
  }

  isCollapsed(): boolean {
    const found = this.store.trellisData.collapsedList.find((collapsedRoute) => {
      return pathEqual(collapsedRoute, this.route)
    })
    return !!found
  }

  isDragging(): boolean {
    return pathEqual(this.store.trellisData.dragInfo.dragging?.nodeRoute || [], this.route)
  }

  isDraggingOver(): boolean {
    return pathEqual(this.store.trellisData.dragInfo.dragOverInfo?.nodeRoute || [], this.route)
  }

  hasFocus(): boolean {
    return pathEqual(this.store.trellisData.focusRoute, this.route)
  }

  isTooDeep(): boolean {
    return this.depth() > this.store.trellisData.rowDepth
  }

  isTodo(): boolean {
    return this.matchesPattern(this.store.primitive.unit, this.store.primitive.completeField)
  }

  // Navigation Methods
  getParent(): FosExpression {
    if (this.hasParent()) {
      return new FosExpression(this.store, this.route.slice(0, -1))
    } else {
      throw new Error('Cannot get parent of root node')
    }
  }

  getChildren(): FosExpression[] {
    return this.targetNode.getEdges().map((edge) => {
      return new FosExpression(this.store, [...this.route, edge])
    })
  }

  getChildByIndex(index: number): FosExpression {
    const edge = this.targetNode.getEdges()[index]
    if (!edge) {
      throw new Error('Child not found')
    }
    return new FosExpression(this.store, [...this.route, edge])
  }

  getInstructionChildren(): FosExpression[] {
    return this.instructionNode.getEdges().map((edge) => {
      return new FosExpression(this.store, [...this.route, edge])
    })
  }

  // Content Methods
  getDescription(): string {
    return this.targetNode.getContent().data.description?.content || ""
  }

  truncatedDescription(): string {
    const description = this.getDescription()
    return description.length > 20 ? description.slice(0, 17) + '...' : description
  }

  // Pattern Matching Methods
  matchesPattern(instructionPattern: FosNode, targetPattern: FosNode): boolean {
    const instructionNodesMatch = this.store.matchPattern(instructionPattern, this.instructionNode)
    const hasInstructionMatch = instructionNodesMatch.length > 0
    const targetNodesMatch = this.store.matchPattern(targetPattern, this.targetNode)
    const hasTargetMatch = targetNodesMatch.length > 0
    return hasInstructionMatch && hasTargetMatch
  }

  getChildrenMatchingPattern(typeNode: FosNode, targetNode: FosNode): FosExpression[] {
    return this.getChildren().filter((child) => {
      const instructionNodesMatch = this.store.matchPattern(typeNode, child.instructionNode)
      const hasInstructionMatch = instructionNodesMatch.length > 0
      const targetNodesMatch = this.store.matchPattern(targetNode, child.targetNode)
      const hasTargetMatch = targetNodesMatch.length > 0
      return hasInstructionMatch && hasTargetMatch
    })
  }

  getChildrenForActivity(activity: string): FosExpression[] {
    if (activity === 'comments') {
      return this.getChildrenMatchingPattern(this.store.primitive.commentConstructor, this.store.primitive.unit)
    }
    if (activity === 'todo') {
      return this.getChildrenMatchingPattern(this.store.primitive.unit, this.store.primitive.completeField)
    }
    return []
  }

  getAllDescendentsMatchingPattern(typeNode: FosNode, targetNode: FosNode): FosPath[] {
    const routeMap = mutableReduceToRouteMapFromExpression(this, (acc, expression) => {
      const instructionNodesMatch = this.store.matchPattern(typeNode, expression.instructionNode)
      const hasInstructionMatch = instructionNodesMatch.length > 0
      const targetNodesMatch = this.store.matchPattern(targetNode, expression.targetNode)
      const hasTargetMatch = targetNodesMatch.length > 0
      if (hasInstructionMatch && hasTargetMatch) {
        acc.set(expression.route, expression)
      }
      return acc
    })

    return [...routeMap.keys()]
  }

  getAllDescendentsForActivity(activity: string): FosPath[] {
    if (activity === 'comments') {
      return this.getAllDescendentsMatchingPattern(this.store.primitive.commentConstructor, this.store.primitive.unit)
    }
    if (activity === 'todo') {
      return this.getAllDescendentsMatchingPattern(this.store.primitive.unit, this.store.primitive.completeField)
    }
    return []
  }

  // Option Related Methods
  getOptions() {
    if (this.isOption()) {
      return this.getChildren().map((child, index) => ({
        value: index.toString(),
        label: child.getDescription()
      }))
    } else {
      throw new Error('getOptions must be used on an option expression')
    }
  }

  getOptionInfo() {
    if (!this.isOption()) {
      throw new Error('getOptionInfo must be used on an option expression')
    }

    const selectedIndex = this.targetNode.getData().option?.selectedIndex || 0
    const nodeOptions = this.getOptions()
    const nodeChildren = this.getChildren()

    if (nodeChildren.length < 2) {
      throw new Error('Should not have less than 2 options')
    }

    if (!nodeChildren[selectedIndex]) {
      throw new Error('selectedChild not found')
    }



    const selectedChildRoute: FosPath = this.getChildByIndex(selectedIndex).route
    const isOptionChildCollapsed = this.store.trellisData.collapsedList.some((route) => 
      pathEqual(route, selectedChildRoute)
    )
    const resolutionStrategy = this.targetNode.getData().option?.defaultResolutionStrategy || 'selected'
    const selectedOption = nodeOptions[selectedIndex]
    const selectedChild = new FosExpression(this.store, selectedChildRoute)

    if (!selectedOption) {
      throw new Error('selectedOption not found')
    }

    return {
      selectedIndex,
      selectedChildRoute,
      nodeOptions,
      selectedOption,
      selectedChild,
      isOptionChildCollapsed,
      resolutionStrategy,
    }
  }

  // Parent Info Methods
  getParentInfo() {
    if (!this.hasParent()) {
      throw new Error('Cannot get parent of root node')
    }

    const parent = this.getParent()

    
    const indexInParent = parent.getChildren().findIndex((childExpr) => 

      this.equals(childExpr)
    )

    return {
      parent,
      indexInParent,
      siblingRoutes: parent.childRoutes
    }
  }

  isOptionChildCollapsed() {
    const { selectedChildRoute } = this.getOptionInfo()
    return this.store.trellisData.collapsedList.some((route) => 
      pathEqual(route, selectedChildRoute)
    )
  }

  // UI Related Methods
  getDragItem(breadcrumb: boolean = false) {
    return {
      id: this.expressionLabel(),
      data: { nodeRoute: this.route, breadcrumb },
      breadcrumb
    }
  }

  getDragInfo() {
    return this.store.trellisData.dragInfo
  }

  setDragInfo(dragInfo: AppState['data']['trellisData']['dragInfo']) {
    this.store.trellisData.dragInfo = dragInfo
  }

  getShortLabel() {
    const uuidPre = "" // `[${this.uuid.slice(0,8)}]` 
    const tCidPre = this.targetNode.getId().slice(0, 8)
    const iCidPre = this.instructionNode.getId().slice(0, 8)
    return `<${uuidPre}(${tCidPre}-${iCidPre})>`
  }

  commit() {
    // this should save all changes up through parents to the root and somehow persist to store
    throw new Error('Method not implemented')
  }


  setTargetNode(newTarget: FosNode) {
    this.route = [...this.route.slice(0, -1), [this.instructionNode.getId(), newTarget.getId()]]
    this.targetNode = newTarget
  }

  setInstructionNode(newInstruction: FosNode) {
    this.route = [...this.route.slice(0, -1), [newInstruction.getId(), this.targetNode.getId()]]
    this.instructionNode = newInstruction
  }


  // Content Modification Methods
  updateTargetContent(newContent: FosNodeContent) {
    const thisEdge = this.route[this.route.length - 1]
    const newTarget = this.store.create(newContent)

    if (!thisEdge) {
      throw new Error('Cannot update root node')
    }
    
    this.targetNode = newTarget
  }

 
  addOption () {
    throw new Error('Method not implemented')

  }

  deleteOption() {
    throw new Error('Method not implemented')
  }


  // Not Implemented Methods - These would need implementation based on requirements
  getGroupInfo() {
    throw new Error('Method not implemented')
  }

  getTodoInfo() {
    throw new Error('Method not implemented')
  }

  getAllowedChildren(): string[] {
    throw new Error('Method not implemented')
  }

  getPreviousVersions() {
    throw new Error('Method not implemented')
  }

  getGroupProposedVersions() {
    throw new Error('Method not implemented')
  }

  getBranchVersions() {
    throw new Error('Method not implemented')
  }

  getBranches() {
    throw new Error('Method not implemented')
  }

  getCommentInfo() {
    throw new Error('Method not implemented')
  }

  addBranch(content: string): FosExpression {
    throw new Error('Method not implemented')
  }

  addChoice(content: string): FosExpression {
    throw new Error('Method not implemented')
  }

  addWorkflow(content: string): FosExpression {
    throw new Error('Method not implemented')
  }

  addDocument(content: string): FosExpression {
    throw new Error('Method not implemented')
  }

  addGroup(content: string): FosExpression {
    throw new Error('Method not implemented')
  }

  addMarketRequest(content: string): FosExpression {
    throw new Error('Method not implemented')
  }

  addMarketService(content: string): FosExpression {
    throw new Error('Method not implemented')
  }

  proposeChange(branch: FosExpression) {
    throw new Error('Method not implemented')
  }

  registerMarketService(service: string) {
    throw new Error('Method not implemented')
  }

  registerMarketRequest(request: string) {
    throw new Error('Method not implemented')
  }

  applyPattern(instruction: FosNode, target: FosNode) {
    throw new Error('Method not implemented')
  }

  queryPattern(instruction: FosNode, target: FosNode) {
    throw new Error('Method not implemented')
  }

  removePattern(instruction: FosNode, target: FosNode) {
    throw new Error('Method not implemented')
  }

  createChildExpressionUnderTarget(instruction: FosNode, target: FosNode) {
    throw new Error('Method not implemented')
  }

  createChildExpressionUnderInstruction(instruction: FosNode, target: FosNode) {
    throw new Error('Method not implemented')
  }

  queryAvailableActionsForPrimitivePattern(instruction: FosNode, target: FosNode) {
    throw new Error('Method not implemented')
  }

  getOrMakeAlias(): FosNode {

  }

  setSearchQuery (searchQuery: string){
    throw new Error('Method not implemented')
  }




  attachUserToGroup(groupStore: FosStore, userStore: FosStore) {
    
    const groupExpr = new FosExpression(groupStore, [])

    const userExpr = new FosExpression(userStore, [])


    const groupAliasNode = groupExpr.getOrMakeAlias()

    const clonedGroupTargetNode = userStore.cloneNodeFromOtherStore(groupExpr.targetNode)

    const userGroupShadowNode = userStore.cloneNodeFromOtherStore(groupAliasNode)

    const userGroupTargetNode = userStore.create({
      data: {

      },
      children: [
        [userStore.primitive.groupShadowNode.getId(), userGroupShadowNode.getId()],
      ]
    })

    const userGroupEntryExpr =  userExpr.attachChild(userStore.primitive.groupField, groupExpr.targetNode )

    const groupPeerEntryExpr = groupExpr.attachChild(groupStore.primitive.peerNode, userGroupTargetNode)

  }



  completeTask () {
    const currentTargetVal = this.targetNode.value
    const newTarget = this.targetNode.updateData({
        todo: {
          completed: true,
          time: Date.now()
        },
      })
    this.setTargetNode(newTarget)
  }



  addTodo (description: string): FosExpression {
    const newTaskNode = this.store.create({
      data: {
        description: {
          content: description
        },
        updated: {
          time: Date.now()
        },
      },
      children: []
    })

    const newEdge = this.targetNode.addEdge(newTaskNode.getId(), this.store.primitive.completeField.getId())
    const newExpression = new FosExpression(this.store, [...this.route, [newTaskNode.getId(), this.store.primitive.completeField.getId()]])
    return newExpression
  }

  addComment (comment: string ) {
    const newCommentNode = this.store.create({
      data: {
        description: {
          content: comment
        },
        updated: {
          time: Date.now()
        },
      },
      children: []
    })

    const newEdge = this.targetNode.addEdge(this.store.primitive.commentConstructor.getId(), newCommentNode.getId())
    
  }



  addTimeInterval (expr: FosExpression, startTime: number | undefined, stopTime: number | undefined) {
    throw new Error('Method not implemented')
  }

  startTimeInterval(expr: FosExpression) {
    throw new Error('Method not implemented')
  }

  stopTimeInterval(expr: FosExpression) {
    throw new Error('Method not implemented')
  }


  inviteToGroup(expr: FosExpression, groupTarget: FosNode) {
    throw new Error('Method not implemented')
  }


  addLink(expr: FosExpression, nodeToLink: FosNode) {
    throw new Error('Method not implemented')
  }

  deleteLink(expr: FosExpression, linkNode: FosNode) {
    throw new Error('Method not implemented')
  }

  deleteGroup(expr: FosExpression, group: FosNode) {
    throw new Error('Method not implemented')
  }

  deleteComment(expr: FosExpression, comment: FosNode) {
    throw new Error('Method not implemented')
  }

  editComment(expr: FosExpression, comment: FosNode, newComment: string) {
    throw new Error('Method not implemented')
  }


  makeChoice(expr: FosExpression, option: FosNode) {
    throw new Error('Method not implemented')
  }

  makeProposal(expr: FosExpression) {
    throw new Error('Method not implemented')
  }

  makeBranch(expr: FosExpression, branch: string) { 
    throw new Error('Method not implemented')
  }

  resolveConflict(expr: FosExpression, conflict: string) {
    throw new Error('Method not implemented')
  }

  revertToPrevious(expr: FosExpression, previous: FosNode) {
    throw new Error('Method not implemented')
  }


  createBid(expr: FosExpression, bid: string) {
    throw new Error('Method not implemented')
  }


  createOffer(expr: FosExpression, offer: string) {
    throw new Error('Method not implemented')
  }

  upvote(expr: FosExpression, node: FosNode) {
    throw new Error('Method not implemented')
  }

  downvote(expr: FosExpression, node: FosNode) {
    throw new Error('Method not implemented')
  }

  approve(expr: FosExpression, node: FosNode) {
    throw new Error('Method not implemented')
  }

  createCommit(expr: FosExpression) {
    throw new Error('Method not implemented')
  }

  sendInvoice(expr: FosExpression, invoice: FosNode) {
    throw new Error('Method not implemented')
  }

  addEntryToInvoice(expr: FosExpression, invoice: FosNode, entry: FosNode) {
    throw new Error('Method not implemented')
  }

  addCommentToInvoice(expr: FosExpression, invoice: FosNode, comment: FosNode) {
    throw new Error('Method not implemented')
  }

  updateEntryInInvoice(expr: FosExpression, invoice: FosNode, entry: FosNode, newEntry: string) {
    throw new Error('Method not implemented')
  }

  addPaymentToInvoice(expr: FosExpression, invoice: FosNode, payment: FosNode) {
    throw new Error('Method not implemented')
  }

  toggleMarketService(expr: FosExpression) {
    throw new Error('Method not implemented')
  }

  toggleServiceForGroup(expr: FosExpression, group: FosNode) {
    throw new Error('Method not implemented')
  }


  toggleMarketRequest(expr: FosExpression) {
    throw new Error('Method not implemented')
  }

  runTask () {

    const newExpr = this.executeWorkflow([])
    newExpr.updateFocus(0)
  
  }
  
    
  
  setVote (id: string, vote: number) {
    throw new Error('Method not implemented')
  }    
  
  setApproval (id: string, approval: boolean) {
    throw new Error('Method not implemented')
  }    
  
  addCommit (branch: string, tag?: string) {
    throw new Error('Method not implemented')
  }    
  
  createBidRequest (todoRoute: FosPath, bidRequestInfo: {}) {
    throw new Error('Method not implemented')
  }

  approveBid (bidRoute: FosPath) {
  throw new Error('Method not implemented')
}
    
  approveFulfillment (fulfillmentRoute: FosPath) {
    throw new Error('Method not implemented')
  }
  
  approvePayment (paymentRoute: FosPath) {
    throw new Error('Method not implemented')
  }

  createMergeRequest (route: FosPath) {
    throw new Error('Method not implemented')
  }

  addPin (route: FosPath) {
    throw new Error('Method not implemented')
  }

  removePin (route: FosPath) {
    throw new Error('Method not implemented')
  }
 
  // updateNodeContent (newNodeContent: FosNodeContent) {
    
  //   throw new Error('Method not implemented')
  //   newNodeContent.children.forEach(([childType, childId]: FosPathElem) => {
  //     if (childId === this.targetNode.getId()) {
  //         throw new Error('Cannot add node as child of itself')
  //     }
  //   })

  //   const newNode = this.store.create(newNodeContent)
  //   this.targetNode = newNode
  // }
  
  
  updateFocus (focusChar: number){
    this.store.trellisData.focusChar = focusChar
  }
  
  // updateNodeData(newNodeData: Partial<FosDataContent>) {
    
  //   throw new Error('Method not implemented')
  //   const newNode = this.targetNode.updateData(newNodeData)
  //   this.targetNode = newNode
  // }
  
  updateZoom(route: FosPath){
    this.store.fosRoute = route
  }
  
  addChild(newType: FosNode, newNodeContent: FosNodeContent, index: number = -1): FosExpression {
    const childTarget = this.store.create(newNodeContent)
    const newThisTarget = this.targetNode.addEdge(newType.getId(), childTarget.getId(), index) 
    this.targetNode = newThisTarget
    const child = this.getChildren().find((child) => pathEqual(child.route, [...this.route, [newType.getId(), childTarget.getId()]]))
    if (!child) {
      throw new Error('Child not found')
    }
    return child
  }
  
  attachChild(newRowType: FosNode, newRowId: FosNode, index: number = -1): FosExpression {
    const newTarget = this.targetNode.addEdge(newRowType.getId(), newRowId.getId(), index)
    this.setTargetNode(newTarget)
    return new FosExpression(this.store, [...this.route, [newRowType.getId(), newRowId.getId()]])
  }
  
  attachSibling(newRowType: FosNode, newRowTarget: FosNode, position: number | string ) {
      // add option node to parent, put current node under it, and add new option
      
      const { parent, indexInParent } = this.getParentInfo()
      let index = 0
      const parentChildren = parent.getChildren()
      const parentRoute = parent.route
      if (typeof position === 'number'){
          index = position
      } else if (position === 'after'){
          index = indexInParent + 1
      } else if (position === 'before'){
          index = indexInParent
      } else if (position === 'first'){
          index = 0
      } else if (position === 'last'){
          index = parentChildren.length
      }
  
      const returnVal = this.attachChild(newRowType, newRowTarget, index)
      return returnVal
  }
  
  addSibling(newRowType: FosNode, newNodeContent: FosNodeContent, position: number | string ) {
    const newSiblingTarget = this.store.create(newNodeContent)
    this.attachSibling(newRowType, newSiblingTarget, position)
    this.commit()
  }
  
  
  removeNode(){
    const { indexInParent, parent } = this.getParentInfo()
    this.moveFocusUp()
    const newParentTarget = parent.targetNode.removeEdgeByIndex(indexInParent)
    parent.targetNode = newParentTarget

  }
  
  

  
  changeInstruction(newInstruction: FosNode) {
    this.instructionNode = newInstruction

    
  }
  
  
  snipNode () {
    
    const { indexInParent, parent } = this.getParentInfo()

    const parentContent = parent.targetNode.getContent()
    const parentChildren = parentContent.children
  
    const newParentRows: FosPathElem[] = parentContent.children.reduce((acc: FosPathElem[], child: FosPathElem, i: number) => {
      if (i !== indexInParent){
        return [...acc, ...parentChildren]
      }
      return [...acc, child]
    }, [])
  
    const newParentContent = {
      ...parentContent,
      children: newParentRows,
    }
  
    const newParentTarget = parent.targetNode.mutate(newParentContent)
    parent.targetNode = newParentTarget
    parent.commit()
  
  }
  
    
  
  moveNodeAboveRoute ( targetRoute: FosPath) {
    


    this.removeNode() 

    const targetExpression = new FosExpression(this.store, targetRoute)
    const { parent: targetParent, indexInParent } = targetExpression.getParentInfo()
    
    const parentContent = targetParent.targetNode.getContent()
  
    const newParentRows: FosPathElem[] = targetParent.getChildren().reduce((acc: FosPathElem[], child: FosExpression, i: number) => {
      if (i === indexInParent){
        const newElem: FosPathElem = this.pathElem()
        const newChildren: FosPathElem[] =  [...acc, newElem, child.pathElem()]
      }
      return [...acc, child.pathElem()]
    }, [])
  
    const newParentContent = {
      ...parentContent,
      children: newParentRows,
    }

  
    const parentTargetNode = targetParent.targetNode.mutate(newParentContent)
    targetParent.setTargetNode(parentTargetNode)
  
    const thisChildInParent = targetParent.getChildren().find((child) => pathEqual(child.route, [...targetParent.route, this.pathElem()]))
    
    thisChildInParent?.updateFocus(this.focusChar() || 0)

  }
    
  moveNodeBelowRoute (targetRoute: FosPath): FosExpression {

    const targetExpression = new FosExpression(this.store, targetRoute)

    const { indexInParent, parent } = targetExpression.getParentInfo()
    this.removeNode() 
    const parentContent = parent.targetNode.getContent()
  

    const newParentRows: FosPathElem[] = parent.getChildren().reduce((acc: FosPathElem[], child: FosExpression, i: number) => {
      if (i === indexInParent){
        const newElem: FosPathElem = this.pathElem()
        return [...acc, child.pathElem(), newElem]
      }
      return [...acc, child.pathElem()]
    }, [])
  
    const newParentContent = {
      ...parentContent,
      children: newParentRows,
    }
  
    const parentTargetNode = parent.targetNode.mutate(newParentContent)
    parent.setTargetNode(parentTargetNode)
    
    const thisChildInParent = parent.getChildren().find((child) => pathEqual(child.route, [...parent.route, this.pathElem()]))

    if (!thisChildInParent){
        throw new Error('Child not found')
    }

    thisChildInParent.updateFocus(this.focusChar() || 0)

    return thisChildInParent
  
  }
  
  moveNodeIntoRoute (targetRoute: FosPath, index: number = 0): FosExpression {

    const nodeContent = this.targetNode.getContent()
    const targetExpression = new FosExpression(this.store, targetRoute)
    
    const newElem: FosPathElem = this.pathElem()


    const newParentRows: FosPathElem[] = index < 0 
        ? [...nodeContent.children, targetExpression.pathElem()]
        : index === 0
            ? [ newElem ] 
            : nodeContent.children.reduce((acc: FosPathElem[], child: FosPathElem, i: number) => {
        if (i === index){
            return [...acc, newElem, child]
        }
        return [...acc, child]
        }, [])

    console.log('newParentRows', newParentRows, targetRoute, newElem, index, nodeContent.children)
    const newParentContent = {
      ...nodeContent,
      children: newParentRows,
    }
    
    const newTargetNode = targetExpression.targetNode.mutate(newParentContent)
    targetExpression.setTargetNode(newTargetNode)

    this.removeNode()

    const thisChildInParent = targetExpression.getChildren().find((child) => pathEqual(child.route, [...targetExpression.route, this.pathElem()]))
    if (!thisChildInParent){
        throw new Error('Child not found')
    }

    thisChildInParent.updateFocus(this.focusChar() || 0)
    return thisChildInParent

  }

  reorderNodeChildren (newOrder: number[]){

    const nodeContent = this.targetNode.getContent()

    const newTarget = this.targetNode.orderEdges(newOrder)
    this.setTargetNode(newTarget)
  }
  
  moveLeft () {
    
    const { 
        parent,        
        indexInParent, 
        siblingRoutes
    } = this.getParentInfo()
  
    if (parent.route.length === 1){
        return 
    }


    siblingRoutes().forEach((siblingRoute: FosPath, i: number) => {
      if (i < indexInParent + 1){
          return
      } else {
        console.log('siblingRoute', siblingRoute, this.route, i, indexInParent)
        throw new Error('Not implemented')
        this.moveNodeIntoRoute(this.route, i - indexInParent + 1)
      }
    })

    const exprInNewPath = this.moveNodeBelowRoute(parent.route)

  }
  
  moveRight (): FosExpression {

    
      /** TODO
       *  this should use getUpSibling and be put inside that node if it's a sibling
       *  if it's an uncle, then it should be put inside the uncle node
       *  if it's an ancestor of an older sibling, then it should be moved under
       *  this node, and then this node should be moved to a down sibling of whatever
       *  it's nested under
       */
  
      const upSiblingExpr = getUpNode(this)
      const actualUpSiblingExpr = getUpSibling(this)
  
      console.log('upSiblingRoute', upSiblingExpr)
      if (upSiblingExpr) {

        this.moveNodeIntoRoute(upSiblingExpr.route, upSiblingExpr.getChildren().length)
        if (actualUpSiblingExpr){
            console.warn('this is a case that needs to be caught for better useability')
        }
        const thisChildInParent = upSiblingExpr.getChildren().find((child) => pathEqual(child.route, [...upSiblingExpr.route, this.pathElem()]))        
        if (!thisChildInParent){
            throw new Error('Child not found')
        }
        return thisChildInParent
      } 
      return this
  }
  
  moveUp () {

    const upSibling = getUpSibling(this)
  
    console.log('upSibling', upSibling)
    if (upSibling){
      return this.moveNodeAboveRoute(upSibling.route)
    } else {
      const leastUpSibling = getAncestorLeastUpSibling(this)
      console.log('leastUpSibling', leastUpSibling)
      if (leastUpSibling){
        return this.moveNodeIntoRoute(leastUpSibling.route, -1)
      } else {
        const parent = this.getParent()
        return this.moveNodeAboveRoute(parent.route)
      }
    }
  
  }
  
  moveDown () {

    const downSibling = getDownSibling(this)
      if (downSibling){
          return this.moveNodeBelowRoute(downSibling.route)
      } else {
          // move above parent
          throw new Error('Not implemented')
          // return moveNodeIntoRoute(appData, route, parentRoute, 0)
      }
  }
  

  

  async doAction(action: () => Promise<void>, setData: (state: AppState["data"]) => void) {
    action().then(() => {
      this.commit()
      const updatedContext: AppState["data"] = this.store.exportContext([])
      setData(updatedContext)
    })
  }






  setDescription (description: string) {
  
    const newTarget = this.targetNode.updateData({
      description: {
        content: description
      }
    })
    this.setTargetNode(newTarget)

  }

  setFocusAndDescription (description: string, focusChar: number) {
    this.setDescription(description)
    this.updateFocus(focusChar)
  }

  setSelectedOption ( selectedOption: number) {
    const newTargetNode = this.targetNode.updateData({
        option: {
            defaultResolutionStrategy: 'selected',
            selectedIndex: selectedOption,
        }
    })
    this.setTargetNode(newTargetNode)

  }

  

  
  toggleOptionChildCollapse () {
          
    const isOptionChildCollapsed = this.isOptionChildCollapsed()

    const selectedOptionRoute = this.getOptionInfo().selectedChildRoute
              
    const newCollapsedList = isOptionChildCollapsed 
        ? this.store.trellisData.collapsedList.filter((route: FosPath) => !pathEqual(route, selectedOptionRoute)) 
        : [...this.store.trellisData.collapsedList, selectedOptionRoute]

    this.store.trellisData.collapsedList = newCollapsedList

  }


  toggleCollapse () {
                
    const newCollapsedList = this.isCollapsed() 
        ? this.store.trellisData.collapsedList.filter((route: FosPath) => !pathEqual(route, this.route)) 
        : [...this.store.trellisData.collapsedList, this.route]

        this.store.trellisData.collapsedList = newCollapsedList

  }



  moveFocusDown () {
    console.log(this.store.trellisData)
    const downNodeExpr = getDownNode(this)
    if (downNodeExpr){
      downNodeExpr.updateFocus(this.focusChar() || 0)
    }
  }

  moveFocusUp () {
    console.log(this.store.trellisData)
    const upNodeExpr = getUpNode(this)
    if (upNodeExpr){
      upNodeExpr.updateFocus(this.focusChar() || 0)
    }
  }

  moveFocusToEnd () {
    const description = this.getDescription()
    this.updateFocus(description.length)
  }

  moveFocusToStart () {
    this.updateFocus(0)
  }


 addDownSibling () {

  const { indexInParent, parent } = this.getParentInfo()
  const newChild = this.addChild( 
        this.instructionNode, 
        {data: {description: {content: ""}}, children: []}, 
    indexInParent + 1)
    newChild.updateFocus(this.focusChar() || 0)
  }




  keyUpEvents (e: React.KeyboardEvent<HTMLDivElement>) {
    const value = e.target
    
    if (e.key === 'Backspace' && this.focusChar() === 0){
        this.moveFocusUp()
    }
    
    if (e.key === " ") {
        e.stopPropagation();
    }

    if (e.key === "Enter") {
        // console.log('trying to prevent default');
        // e.preventDefault()
        // e.stopPropagation()
        if (e.shiftKey){
        
        return
        } else {
        // console.log('addYoungerSibling - comboboxEditable', this.hasFocus(), this.getString().length, JSON.stringify(this.getString()))
            if(this.focusChar() === this.getDescription().length){
                e.preventDefault()
                this.addDownSibling()
            }
        }
    }
    // console.log('keypress', e.key)


    if (e.key === "ArrowUp") {
        if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey){

            this.moveFocusUp()
            e.preventDefault()
            e.stopPropagation()
            return 
        }
        if (e.ctrlKey){
            if (e.altKey){
                this.moveUp()
            } else {
                this.moveFocusToStart()
            }
            e.stopPropagation();
            return 
        }
    }

    
    if (e.key === "ArrowDown") {
        if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey){
            e.preventDefault()
            e.stopPropagation()
            this.moveFocusDown()
            return 
        }
        if (e.ctrlKey){
            if (e.altKey){
                this.moveDown()
            } else {
                this.moveFocusToEnd()
            }
            e.stopPropagation();
            return;
        }
    }

    if (e.key === "ArrowRight"){
        if (e.altKey && e.ctrlKey){
            console.log('moveRight - comboboxEditable', this.getDescription(), this.route)
            this.moveRight()
        }
    }

    if (e.key === "ArrowLeft"){
        if (e.altKey && e.ctrlKey){
            this.moveLeft()
        }
    }

    if (e.key === " " && e.ctrlKey){
        this.toggleCollapse()
    }


  }

  keyDownEvents (e: React.KeyboardEvent<HTMLDivElement>) {
    

    // console.log('keydown', e.key)
    if (e.key === " ") {
        e.stopPropagation();
    }
    if (e.key === 'Enter'){
        e.stopPropagation()
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault()
        e.stopPropagation()
    }

    if (e.key === "Backspace" && !this.getDescription()){
        console.log('deleteRow - comboboxEditable', this.getDescription(), this.route)
        if (this.hasFocus() && this.focusChar() === 0){
            if (!e.shiftKey){
                this.snipNode()
            }else{
              this.removeNode()
            }
        }
    }

  }
  

  keyPressEvents (event: React.KeyboardEvent<HTMLDivElement>) {

  }


  addRowAsChild (newType: FosNode = this.instructionNode) {
        
    const newNodeContent: FosNodeContent = {
        data: {
            description: {
                content: ""
            },
            option: {
                selectedIndex: 0,
                defaultResolutionStrategy: "selected" as "selected"
            },
            updated: {
                time: Date.now()
            }
        },
        children: []
    }
    const childExpr  = this.addChild(newType, newNodeContent)
    // console.log('newState', newState, diff({left: appData, right: newState}))
    childExpr.updateFocus(0)

  }



    
  clone(): FosExpression {
    throw new Error('Method not implemented')

    type CloneReturnVal = { newRows: [FosNodeId, FosNodeId][], newContext: AppState["data"] }
    const { newRows, newContext }: CloneReturnVal  = nodeContent.children.reduce((acc: CloneReturnVal, childPathElem: FosPathElem) => {
        const {
            newId: newChildId,
            newState: stateWithChild
        } = cloneNode(acc.newContext, [...route, childPathElem])
        const returnVal: CloneReturnVal = {
            newRows: [...acc.newRows, [childPathElem[0], newChildId]],
            newContext: stateWithChild
        }
        return returnVal
    }, { newRows: [], newContext: currentAppData })


    const newNodeContent: FosNodeContent = {
        children: newRows,
        data: {
            ...nodeData,
            description: {
                content: `${nodeData.description?.content} (copy - ${new Date().toLocaleString()})`
            },
            updated: {
                time: new Date().getTime(),
            },
        }
    }
    const { newId, newState: stateWithNewNode } = insertNewNode(newContext, newNodeContent)
    return {
        newId,
        newState: stateWithNewNode
    }
  }

  instantiateChildrenAndMapContent() {



    type InstReturnVal = { newRows: FosPathElem[], newContext: AppState["data"] }




    const { newRows, newContext }  = this.nodeContent().children.reduce((acc: InstReturnVal, childPathElem: FosPathElem) => {

      const [childType, childId] = childPathElem


      const {
          newId: newChildId,
          newState: stateWithChild,
          newType: newChildType
      } = this.evaluate(acc.newContext, [...route, childPathElem])
      const returnVal: InstReturnVal = {
          newRows: [...acc.newRows, [newChildType, newChildId]],
          newContext: stateWithChild
      }
      return returnVal


    }, { newRows: [], newContext: startAppData })


    const newNodeContent: FosNodeContent = {
      children: newRows,
      data: {
          ...nodeData,
          description: {
              content: `${nodeData.description?.content}`
          },
          updated: {
              time: new Date().getTime(),
          },
      }
    }
    
    const { newId, newState: stateWithNewNode } = insertNewNode(newContext, newNodeContent)
    // const { newId, newState: stateWithNewNode } = insertNewNode(newContext, newNodeContent)

    return { newId, newState: stateWithNewNode }
  }



  evaluate() {

    if (this.isOption()){

      const { resolutionStrategy, selectedIndex } = this.getOptionInfo()

        if (resolutionStrategy === "selected") {

          
          throw new Error('Not implemented')

          // return {
          //     newId: selectedElem[1],
          //     newType: selectedElem[0],
          //     newState: startAppData
          // }

        } else if (resolutionStrategy === "race"){
            
        const { newId, newState: stateWithNewNode } = this.instantiateChildrenAndMapContent()

            return {
                newId,
                newType: "race",
                newState: stateWithNewNode
            }
    
        
        } else if (resolutionStrategy === "choice"){

          const { newId, newState: stateWithNewNode } = this.instantiateChildrenAndMapContent()

            return {
                newId,
                newType: "choice",
                newState: stateWithNewNode
            }

        } else {
            throw new Error("Invalid resolution strategy")
        }


    } else if (this.isTodo()) {


      const { newId, newState: stateWithNewNode } = this.instantiateChildrenAndMapContent()


        return {
            newId: "void",
            newType: newId,
            newState: stateWithNewNode
        }
    } else if (this.isChoice()) {

        const { newId, newState: stateWithNewNode } = this.instantiateChildrenAndMapContent()
        return {
            newId: "void",
            newType: "newId",
            newState: stateWithNewNode
        }  

    } else {
        const { newId, newState: stateWithNewNode } = this.instantiateChildrenAndMapContent()

        return {
            newId,
            newType: this.nodeType(),
            newState: stateWithNewNode
        }
    }

    
  }
    
  
  executeWorkflow(attachToRoute: FosPath): FosExpression {
      
    const newTodoNode = this.targetNode.clone()

    const targetExpr = new FosExpression(this.store, attachToRoute)

    targetExpr.attachChild(newTodoNode.getId(), this.store.primitive.completeField.getId(), -1 )

    targetExpr
    

  }





}

