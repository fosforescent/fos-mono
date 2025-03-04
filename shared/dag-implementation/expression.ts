
import { Delta, diff, patch } from "@n1ru4l/json-patch-plus"
import { AppState, AppStateLoaded, FosDataContent, FosNodeContent, FosNodeId, FosPath, FosPathElem, FosReactGlobal } from "../types"
import { getAncestorLeastUpSibling, getDownNode, getDownSibling, getGroupFromRoute, getUpNode, getUpSibling, mutableReduceToRouteMapFromExpression, pathEqual } from "../utils"

import { FosNode } from "./node"
import { FosStore } from "./store"
import { runAvailableFunctions } from "./context"



export class FosExpression {
  store: FosStore
  route: FosPath
  instructionNode: FosNode
  targetNode: FosNode
  


  constructor(store: FosStore, route: FosPath) {
    this.route = route
    this.store = store


    

    if (route.length === 0) {
      this.instructionNode = this.store.primitive.voidNode
      this.targetNode = this.store.getRootNode()
    } else {
      const pathElem = route[route.length - 1]

      if (!pathElem) {
        throw new Error('Path element not found')
      }

      const [instructionId, targetId] = pathElem
      const instructionNode = this.store.getNodeByAddress(instructionId)

      if (!instructionNode) {
        throw new Error(`Instruction node not found for ${instructionId}`)
      }

      const targetNode = this.store.getNodeByAddress(targetId)

      if (!targetNode) {
        throw new Error(`Target node not found for ${targetId}`)
      }


      this.instructionNode = instructionNode
      this.targetNode = targetNode  
    }


     

  }


 

  async runFunctions(context: FosNode): Promise<void> {

    // Required bindings accrued from left
    // (optional bindings accrued from left)
    // internal bindings accrued from left


    // bindings accrued from right
    // bindings combined with 



    const result = await runAvailableFunctions(this)
    if (!result){ 
      throw new Error('No function matched context and expression')
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

  isUpdate(): boolean {
    const leftIsUpdate = (this.instructionNode.getId() === this.store.primitive.updateAction.getId())
    return leftIsUpdate
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


  getSelectedChild(): FosExpression {
    throw new Error('Method not implemented')

  }

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

 
  equals(other: FosExpression): boolean {
    const instructionsEqual = this.instructionNode.getId() === other.instructionNode.getId()
    const targetsEqual = this.targetNode.getId() === other.targetNode.getId()
    const pathsEqual = pathEqual(this.route, other.route)
    const allEqual = instructionsEqual && targetsEqual && pathsEqual
    return allEqual
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


  // Type Check Methods
  isRoot() {
    const lastElem = this.route[this.route.length - 1]
    
    if (!lastElem) {
      return true
    }

    // return this.route.length === 0
  }

  hasParent(): boolean {
    return this.route.length > 0
  }


  isAlias(): boolean {

    /**
     * should we just check if it's using the alias constructor?  Rather than doing this structure check?
     */

    // console.log('isAlias', this.instructionNode.getId(), this.store.primitive.aliasConstructor.getId())
    const targetHasTargetEdge = this.targetNode.getEdges().some((edge) => {
      // console.log('edge', edge, this.store.primitive.targetPointerConstructor.getId())
      return edge[0] === this.store.primitive.targetPointerConstructor.getId()
    })
    // console.log('targetHasTargetEdge', targetHasTargetEdge)
    const targetHasAliasInstruction = this.targetNode.getEdges().some((edge) => {
      return edge[0] === this.store.primitive.instructionPointerConstructor.getId()
    })

    return targetHasTargetEdge
  }



  followAlias(): FosExpression {
    if (!this.isAlias()) {
      throw new Error('Expression is not an alias')
    }

    const {
      instruction: aliasInstruction,
      target: aliasTarget
    } = this.targetNode.dereferenceNodes()

    return new FosExpression(this.store, [...this.route, [aliasInstruction.getId(), aliasTarget.getId()]])


  }


  isReference(): boolean {
    const isAlias = this.isAlias()
    return isAlias
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
  // Navigation Methods
  getParent(): FosExpression {
    if (this.hasParent()) {
      return new FosExpression(this.store, this.route.slice(0, -1))
    } else {
      throw new Error('Cannot get parent of root node')
    }
  }

  getTargetChildren(index: number | null = null): FosExpression[] {
    const children = this.targetNode.getEdges().map((edge) => {
      return new FosExpression(this.store, [...this.route, edge])
    })
    if (index === null) {
      return children
    }
    const indexedChild = children.slice(index, index + 1)[0]
    if (!indexedChild) {
      throw new Error('Child not found')
    }
    return [indexedChild]
  }



  getInstructionChildren(index: number | null = null): FosExpression[] {
    const children = this.instructionNode.getEdges().map((edge) => {
      return new FosExpression(this.store, [...this.route, edge])
    })
    if (index === null) {
      return children
    }
    const indexedChild = children.slice(index, index + 1)[0]
    if (!indexedChild) {
      throw new Error('Child not found')
    }
    return [indexedChild]
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

  getTargetChildrenMatchingPattern(typeNode: FosNode, targetNode: FosNode): FosExpression[] {
    return this.getTargetChildren().filter((child) => {
      const instructionNodesMatch = this.store.matchPattern(typeNode, child.instructionNode)
      const hasInstructionMatch = instructionNodesMatch.length > 0
      const targetNodesMatch = this.store.matchPattern(targetNode, child.targetNode)
      const hasTargetMatch = targetNodesMatch.length > 0
      return hasInstructionMatch && hasTargetMatch
    })
  }

  getTargetChildrenForActivity(activity: string): FosExpression[] {
    if (activity === 'comments') {
      return this.getTargetChildrenMatchingPattern(this.store.primitive.commentConstructor, this.store.primitive.unit)
    }
    if (activity === 'todo') {
      return this.getTargetChildrenMatchingPattern(this.store.primitive.unit, this.store.primitive.completeField)
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

      console.log('allDescendentsMatchingPattern - instruction', hasInstructionMatch, expression.instructionNode, typeNode,  expression.instructionNode.getData().description?.content || expression.instructionNode.getId(), expression.route)
      console.log('allDescendentsMatchingPattern - target', hasTargetMatch, expression.targetNode, targetNode, expression.targetNode.getData().description?.content || expression.targetNode.getId(), expression.route)
      console.log('allDescendentsMatchingPattern - info', expression.route, this)
      return acc
    })

    return [...routeMap.keys()]
  }

  getAllDescendentsForActivity(activity: string): FosPath[] {
    console.log('getAllDescendentsForActivity', activity)
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
      return this.getTargetChildren().map((child, index) => ({
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
    const nodeChildren = this.getTargetChildren()

    if (nodeChildren.length < 2) {
      throw new Error('Should not have less than 2 options')
    }

    if (!nodeChildren[selectedIndex]) {
      throw new Error('selectedChild not found')
    }



    const selectedChildRoute: FosPath | undefined = this.getTargetChildren(selectedIndex)[0]?.route
    if (!selectedChildRoute) {
      throw new Error('selectedChildRoute not found')
    }

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
    
    let thisParent: FosExpression = this.getParent()

    if (thisParent.instructionNode.getId() === this.store.primitive.targetPointerConstructor.getId()) {
      const {
        instruction: aliasInstruction,
        target: aliasTarget
      } = thisParent.targetNode.dereferenceNodes()
      thisParent = new FosExpression(this.store, [...thisParent.route.slice(-1), [aliasInstruction.getId(), aliasTarget.getId()]])
      
    }
    

    let oneWasFound = false
    const targetIndexInParent = thisParent.getTargetChildren().findIndex((childExpr) => {
      if (thisParent.isAlias()) {
        const {
          instruction: aliasInstruction,
          target: aliasTarget
        } = thisParent.targetNode.dereferenceNodes()
        if (childExpr.instructionNode.getId() === this.store.primitive.instructionPointerConstructor.getId()) {
          const isMatch = aliasInstruction.getId() === childExpr.targetNode.getId()
          if (!isMatch) {
            throw new Error('Alias parent does not contain alias instruction')
          }
          return isMatch && (oneWasFound = true)
        }
        if (childExpr.instructionNode.getId() === this.store.primitive.targetPointerConstructor.getId()) {
          const isMatch = aliasTarget.getId() === childExpr.targetNode.getId()
          if (!isMatch) {
            throw new Error('Alias parent does not contain target node')
          }
          return isMatch && (oneWasFound = true)
        }
      }
      return this.equals(childExpr)
  })

    const instructionIndexInParent = thisParent.getInstructionChildren().findIndex((childExpr) => 

      this.equals(childExpr)
    )

    if (targetIndexInParent === -1 && instructionIndexInParent === -1) {
      throw new Error('Parent does not contain this child')
    }

    if (targetIndexInParent !== -1 && instructionIndexInParent !== -1) {
      throw new Error('Edge duplicated in instruction and target')
    }



    return {
      parent: thisParent,
      targetIndexInParent,
      instructionIndexInParent,
      siblingRoutes: thisParent.childRoutes
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

  setDragInfo(dragInfo: AppStateLoaded['data']['trellisData']['dragInfo']) {
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


  async update (instructionNode: FosNode, targetNode: FosNode): Promise<void> {


    // if this is alias...
    // const newTargetNode = this.store.create({
    //   data: {},
    //   children: [
    //     [this.store.primitive.targetPointerConstructor.getId(), targetNode.getId()],
    //     [this.store.primitive.instructionPointerConstructor.getId(), instructionNode.getId()],
    //     [this.store.primitive.previousVersion.getId(), this.targetNode.getId()],
    //   ]
    // })



    const updateArgNode: FosNode = this.store.create({
      data: {},
      children: [
        [this.store.primitive.prevInstructionPointerConstructor.getId(), this.instructionNode.getId()],
        [this.store.primitive.prevTargetPointerConstructor.getId(), this.targetNode.getId()],
        [this.store.primitive.instructionPointerConstructor.getId(), instructionNode.getId()],
        [this.store.primitive.targetPointerConstructor.getId(), targetNode.getId()],

      ]
    })

    const updateElem: FosPathElem = [this.store.primitive.updateAction.getId(), updateArgNode.getId()]
    const newExpr = new FosExpression(this.store, [...this.route, updateElem])


    this.instructionNode = newExpr.instructionNode
    this.targetNode = newExpr.targetNode
    this.route = newExpr.route

  }

  // Content Modification Methods
  updateTargetContent(newContent: FosNodeContent) {
    const thisEdge = this.route[this.route.length - 1]
    const newTarget = this.store.create(newContent)

    if (!thisEdge) {
      throw new Error('Cannot update root node')
    }
    
    return this.setTargetNode(newTarget)
  }

  setTargetNode(targetNode: FosNode) {
    return this.update(this.instructionNode, targetNode)
  }

  setInstructionNode(instructionNode: FosNode) {
    return this.update(instructionNode, this.targetNode)
  }

  getAction() {
    // 


  }

  async addBranch(content: string): Promise<FosExpression> {



    const branchArgNode: FosNode = this.store.create({
      data: {},
      children: [
        [this.store.primitive.prevInstructionPointerConstructor.getId(), this.store.primitive.voidNode.getId()],
        [this.store.primitive.prevTargetPointerConstructor.getId(), this.store.primitive.voidNode.getId()],
        [this.store.primitive.instructionPointerConstructor.getId(), this.instructionNode.getId()],
        [this.store.primitive.targetPointerConstructor.getId(),   this.targetNode.getId()],

      ]
    })

    const updateElem: FosPathElem = [this.store.primitive.brachConstructorNode.getId(), branchArgNode.getId()]
    const newExpr = new FosExpression(this.store, [...this.route, updateElem])

    return newExpr
    

  }

  async setDescription (description: string): Promise<void> {
  
    const newTarget = this.targetNode.updateData({
      description: {
        content: description
      }
    })
    const newExpr = this.update(this.instructionNode, newTarget)

  }
  
  setFocusAndDescription (description: string, focusChar: number) {
    this.setDescription(description)
    this.updateFocus(focusChar)
  }
  
  async setSelectedOption ( selectedOption: number): Promise<void> {
    const newTargetNode = this.targetNode.updateData({
        option: {
            defaultResolutionStrategy: 'selected',
            selectedIndex: selectedOption,
        }
    })
    await this.update(this.instructionNode, newTargetNode)
  }
  
  
  
  addOption (nodeContent: FosNodeContent, index: number) {
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

 

  async addChoice(content: string): Promise<FosExpression> {
    const currentInstructionNode = this.instructionNode

    const newAlternative = this.store.create({
      data: {
        description: {
          content
        }
      },
      children: []
    })

    const newTarget = this.targetNode.addEdge(newAlternative.getId(), this.store.primitive.optionNotSelectedConstructor.getId())
    await this.update(currentInstructionNode, newTarget)
    const newExpr = new FosExpression(this.store, [...this.route, [newAlternative.getId(), this.store.primitive.optionNotSelectedConstructor.getId()]])
    return newExpr

  }

  async addWorkflow(content: string): Promise<FosExpression> {
    const workflowConstructor = this.store.primitive.workflowField

    const workflowTargetNode = this.store.create({
      data: {
        description: {
          content
        }
      },
      children: [        
      ]
    })

    const newTarget = this.targetNode.addEdge(workflowConstructor.getId(), workflowTargetNode.getId())
    await this.update(this.instructionNode, newTarget)
    const newExpr = new FosExpression(this.store, [...this.route, [workflowConstructor.getId(), workflowTargetNode.getId()]])
    return newExpr
  }

  async addDocument(content: string): Promise<FosExpression> {

    
    const documentConstructor = this.store.primitive.documentField
    const documentTargetNode = this.store.create({
      data: {
        description: {
          content
        }
      },
      children: [
        [this.store.primitive.targetPointerConstructor.getId(), this.targetNode.getId()]
      ]
    })

    const newTarget = this.targetNode.addEdge(documentConstructor.getId(), documentTargetNode.getId())
    await this.update(this.instructionNode, newTarget)
    const newExpr = new FosExpression(this.store, [...this.route, [documentConstructor.getId(), documentTargetNode.getId()]])
    return newExpr
  }

  async addMarketRequest(content: string): Promise<FosExpression> {
    throw new Error('Method not implemented')
  }

  async addMarketService(content: string): Promise<FosExpression> {
    throw new Error('Method not implemented')
  }



  registerMarketService(service: string): FosExpression {

    if (!this.isWorkflow()){
      throw new Error('Method only implemented for workflow expressions')
    }

    const rootExpr = this.store.getRootExpression()
    const marketServiceNode = this.store.create({
      data: {
        description: {
          content: service
        }
      },
      children: [
        [this.store.primitive.targetPointerConstructor.getId(), this.targetNode.getId()]
      ]
    })
    const newRootTarget = rootExpr.targetNode.addEdge(this.store.primitive.marketServiceNode.getId(), marketServiceNode.getId())
    rootExpr.update(rootExpr.instructionNode, newRootTarget)
    const newExpr = new FosExpression(this.store, [[this.store.primitive.marketServiceNode.getId(), marketServiceNode.getId()]])
    return newExpr
  }

  registerMarketRequest(request: string) {
    if (!this.isTodo()){
      throw new Error('Method only implemented for todo expressions')
    }

    const rootExpr = this.store.getRootExpression()
    const marketRequestNode = this.store.create({
      data: {
        description: {
          content: request
        }
      },
      children: [
        [this.store.primitive.targetPointerConstructor.getId(), this.instructionNode.getId()]
      ]
    })
    const newRootTarget = rootExpr.targetNode.addEdge(this.store.primitive.marketRequestNode.getId(), marketRequestNode.getId())
    rootExpr.update(rootExpr.instructionNode, newRootTarget)
    const newExpr = new FosExpression(this.store, [[this.store.primitive.marketRequestNode.getId(), marketRequestNode.getId()]])
    return newExpr


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



  setSearchQuery (searchQuery: string){
    throw new Error('Method not implemented')
  }






  completeTask () {
    const currentTargetVal = this.targetNode.value
    const newTarget = this.targetNode.updateData({
        todo: {
          completed: true,
          time: Date.now()
        },
      })
    this.update(this.instructionNode, newTarget)
  }


  async addTodo (description: string): Promise<FosExpression>  {
    if (!this.isRoot() && !this.isWorkflow() && !this.isGroup()){
      throw new Error('Method only implemented for root expressions groups and workflows')
    }

    let thisExpr: FosExpression = this


    const [newTarget, todoNode] = thisExpr.targetNode.addTodo(description)    

    await thisExpr.update(thisExpr.instructionNode, newTarget)

    const newThisTargetChildren = this.getTargetChildren()

    const todoExpr = newThisTargetChildren.find((child) => {
      return child.instructionNode.getId() === todoNode.getId()
    })
    if (!todoExpr) {
      throw new Error('Todo expression not found')
    }
    return todoExpr

  }




  async addComment (comment: string): Promise<FosExpression>  {

    const newCommentNode = this.store.create({
      data: {
        description: {
          content: comment
        },
        updated: {
          time: Date.now()
        },
      },
      children: [
      ]
    })

    const rootExpr = this.store.getRootExpression()

    const newRootTarget = rootExpr.targetNode.addEdge(this.store.primitive.commentConstructor.getId(), newCommentNode.getId())

    await rootExpr.update(rootExpr.instructionNode, newRootTarget)

    const commentExpr = new FosExpression(this.store, [ [ this.store.primitive.commentConstructor.getId(), newCommentNode.getId() ]])

    return commentExpr
    
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

  async runTask () {

    await this.executeWorkflow([])
    this.updateFocus(0)
  
  }
  

    
  async executeWorkflow(attachToRoute: FosPath): Promise<void> {
    const newTodoNode = this.targetNode.clone()
    const targetExpr = new FosExpression(this.store, attachToRoute)
    targetExpr.attachChild(newTodoNode, this.store.primitive.completeField, -1 )
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
  
  
  async updateFocus (focusChar: number){
    this.store.trellisData.focusChar = focusChar
  }
  
  // updateNodeData(newNodeData: Partial<FosDataContent>) {
    
  //   throw new Error('Method not implemented')
  //   const newNode = this.targetNode.updateData(newNodeData)
  //   this.targetNode = newNode
  // }
  
  updateZoom(){
    this.store.fosRoute = this.route
  }
  
  async addChild(newType: FosNode, newNodeContent: FosNodeContent, index: number = -1): Promise<FosExpression> {
    const childTarget = this.store.create(newNodeContent)
    const newThisTarget = this.targetNode.addEdge(newType.getId(), childTarget.getId(), index) 
    await this.update(this.instructionNode, newThisTarget)
    const child = this.getTargetChildren().find((child) => pathEqual(child.route, [...this.route, [newType.getId(), childTarget.getId()]]))
    if (!child) {
      throw new Error('Child not found')
    }
    return child
  }
  
  async attachChild(newRowType: FosNode, newRowTarget: FosNode, index: number = -1): Promise<void> {
    const newTarget = this.targetNode.addEdge(newRowType.getId(), newRowTarget.getId(), index)
    await this.update(this.instructionNode, newTarget)
    const child = new FosExpression(this.store, [...this.route, [newRowType.getId(), newRowTarget.getId()]])

  }
  
  attachTargetSibling(newRowType: FosNode, newRowTarget: FosNode, position: number | string ) {
      // add option node to parent, put current node under it, and add new option
      
      const { parent, targetIndexInParent } = this.getParentInfo()
      if (targetIndexInParent === -1){
          throw new Error('Node not found in parent')
      }
      let index = 0
      const parentChildren = parent.getTargetChildren()
      const parentRoute = parent.route
      if (typeof position === 'number'){
          index = position
      } else if (position === 'after'){
          index = targetIndexInParent + 1
      } else if (position === 'before'){
          index = targetIndexInParent
      } else if (position === 'first'){
          index = 0
      } else if (position === 'last'){
          index = parentChildren.length
      }
  
      const returnVal = this.attachChild(newRowType, newRowTarget, index)
      return returnVal
  }
  
  addTargetSibling(newRowType: FosNode, newNodeContent: FosNodeContent, position: number | string ) {
    const newSiblingTarget = this.store.create(newNodeContent)
    this.attachTargetSibling(newRowType, newSiblingTarget, position)
    this.commit()
  }
  
  
  async removeNode(): Promise<void>{
    const { targetIndexInParent, instructionIndexInParent, parent } = this.getParentInfo()
    this.moveFocusUp()
    if (targetIndexInParent !== -1){
      const newTarget = parent.targetNode.removeEdgeByIndex(targetIndexInParent)
      return parent.update(parent.instructionNode, newTarget)
    }
    if (instructionIndexInParent !== -1){
      const newInstruction = parent.instructionNode.removeEdgeByIndex(instructionIndexInParent)
      return parent.update(newInstruction, parent.targetNode)
    }
    throw new Error('Node not found in parent')

  }
  
  


  
  snipNodeTarget () {
    
    const { targetIndexInParent, parent } = this.getParentInfo()

    const parentContent = parent.targetNode.getContent()
    const parentChildren = parentContent.children
  
    const newParentRows: FosPathElem[] = parentContent.children.reduce((acc: FosPathElem[], child: FosPathElem, i: number) => {
      if (i !== targetIndexInParent){
        return [...acc, ...parentChildren]
      }
      return [...acc, child]
    }, [])
  
    const newParentContent = {
      ...parentContent,
      children: newParentRows,
    }
  
    const newParentTarget = parent.targetNode.mutate(newParentContent)
    parent.update(parent.instructionNode, newParentTarget)
    parent.commit()
  
  }
  
    
  
  moveNodeAboveRoute (targetRoute: FosPath) {
    


    this.removeNode() 

    const targetExpression = new FosExpression(this.store, targetRoute)
    const { parent: targetParent, targetIndexInParent } = targetExpression.getParentInfo()
    
    const parentContent = targetParent.targetNode.getContent()
  
    const newParentRows: FosPathElem[] = targetParent.getTargetChildren().reduce((acc: FosPathElem[], child: FosExpression, i: number) => {
      if (i === targetIndexInParent){
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
    targetParent.update(targetParent.instructionNode, parentTargetNode)
  
    const thisChildInParent = targetParent.getTargetChildren().find((child) => pathEqual(child.route, [...targetParent.route, this.pathElem()]))
    
    thisChildInParent?.updateFocus(this.focusChar() || 0)

  }
    
  moveNodeBelowRoute (targetRoute: FosPath): FosExpression {

    const targetExpression = new FosExpression(this.store, targetRoute)

    const { targetIndexInParent, parent } = targetExpression.getParentInfo()
    this.removeNode() 
    const parentContent = parent.targetNode.getContent()
  

    const newParentRows: FosPathElem[] = parent.getTargetChildren().reduce((acc: FosPathElem[], child: FosExpression, i: number) => {
      if (i === targetIndexInParent){
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
    parent.update(parent.instructionNode, parentTargetNode)
    
    const thisChildInParent = parent.getTargetChildren().find((child) => pathEqual(child.route, [...parent.route, this.pathElem()]))

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
    targetExpression.update(targetExpression.instructionNode, newTargetNode)

    this.removeNode()

    const thisChildInParent = targetExpression.getTargetChildren().find((child) => pathEqual(child.route, [...targetExpression.route, this.pathElem()]))
    if (!thisChildInParent){
        throw new Error('Child not found')
    }

    thisChildInParent.updateFocus(this.focusChar() || 0)
    return thisChildInParent

  }

  reorderNodeChildren (newOrder: number[]){

    const nodeContent = this.targetNode.getContent()

    const newTarget = this.targetNode.orderEdges(newOrder)
    const newExpr = this.update(this.instructionNode, newTarget)
    return newExpr
  }
  
  moveLeft () {
    
    const { 
        parent,        
        targetIndexInParent, 
        siblingRoutes
    } = this.getParentInfo()
  
    if (parent.route.length === 1){
        return 
    }


    siblingRoutes().forEach((siblingRoute: FosPath, i: number) => {
      if (i < targetIndexInParent + 1){
          return
      } else {
        console.log('siblingRoute', siblingRoute, this.route, i, targetIndexInParent)
        throw new Error('Not implemented')
        this.moveNodeIntoRoute(this.route, i - targetIndexInParent + 1)
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

        this.moveNodeIntoRoute(upSiblingExpr.route, upSiblingExpr.getTargetChildren().length)
        if (actualUpSiblingExpr){
            console.warn('this is a case that needs to be caught for better useability')
        }
        const thisChildInParent = upSiblingExpr.getTargetChildren().find((child) => pathEqual(child.route, [...upSiblingExpr.route, this.pathElem()]))        
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
  

  

  async doAction(action: () => Promise<void>, setData: (state: AppStateLoaded["data"]) => void) {
    action().then(() => {
      this.commit()
      const updatedContext: AppStateLoaded["data"] = this.store.exportContext([])
      setData(updatedContext)
    })
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


 async addDownSibling (): Promise<FosExpression> {

  const { targetIndexInParent, parent } = this.getParentInfo()
  const newChild = await this.addChild( 
        this.instructionNode, 
        {data: {description: {content: ""}}, children: []}, 
    targetIndexInParent + 1)
    await newChild.updateFocus(this.focusChar() || 0)
    return newChild
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
                this.snipNodeTarget()
            }else{
              this.removeNode()
            }
        }
    }

  }
  

  keyPressEvents (event: React.KeyboardEvent<HTMLDivElement>) {

  }


  async addRowAsChild (newType: FosNode = this.instructionNode) {
        
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
    const childExpr  = await this.addChild(newType, newNodeContent)
    // console.log('newState', newState, diff({left: appData, right: newState}))
    childExpr.updateFocus(0)

  }






}

