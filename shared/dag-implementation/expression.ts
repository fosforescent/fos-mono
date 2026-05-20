
import { Delta, diff, patch } from "@n1ru4l/json-patch-plus"
import { AppState, AppStateLoaded, FosDataContent, FosNodeContent, FosNodeId, FosPath, FosPathElem } from "../types"
import { getAncestorLeastUpSibling, getDownNode, getDownSibling, getGroupFromRoute, getUpNode, getUpSibling, mutableReduceToRouteMapFromExpression, pathEqual } from "../utils"

import { FosNode } from "./node"
import { FosStore } from "./store"
import { runAvailableFunctions } from "./context"
import { getPrevInstructionPointerConstructor } from "./primitive-node"
import { BudgetManager, CalendarManager, LinearContext } from "./linear"

/**
 * Result of a merge operation
 */
export interface MergeResult {
  /** Whether the merge succeeded without conflicts */
  success: boolean
  /** The merged expression (null if conflicts exist) */
  merged: FosExpression | null
  /** Array of conflicts that need resolution */
  conflicts: Conflict[]
}

/**
 * Represents a merge conflict between two versions
 */
export interface Conflict {
  /** The instruction path where the conflict occurred */
  path: string
  /** Our version of the conflicting value */
  ours: FosNode
  /** Their version of the conflicting value */
  theirs: FosNode
  /** The common ancestor version (null if no common ancestor) */
  base: FosNode | null
  /** The conflict marker node containing both versions */
  conflictNode: FosNode
}



export class FosExpression {
  store: FosStore

  /** Direct reference to instruction node */
  instructionNode: FosNode

  /** Direct reference to target node */
  targetNode: FosNode

  /**
   * Parent expression - direct reference for navigation.
   * null only for root expression.
   */
  private _parent: FosExpression | null

  /**
   * Cached route - computed lazily from parent chain.
   * Invalidated when parent relationships change.
   */
  private _cachedRoute: FosPath | null = null

  /**
   * Primary constructor with parent pointer (preferred).
   * Use this for creating child expressions from an existing parent.
   */
  constructor(
    store: FosStore,
    instruction: FosNode,
    target: FosNode,
    parent: FosExpression | null
  )

  /**
   * Legacy constructor with route (for backward compatibility).
   * @deprecated Use the parent-based constructor instead
   */
  constructor(store: FosStore, route: FosPath)

  constructor(
    store: FosStore,
    instructionOrRoute: FosNode | FosPath,
    target?: FosNode,
    parent?: FosExpression | null
  ) {
    this.store = store

    // Check which constructor form is being used
    if (Array.isArray(instructionOrRoute)) {
      // Legacy route-based constructor
      const route = instructionOrRoute
      this._cachedRoute = route
      this._parent = null  // Will be populated if needed

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
    } else {
      // New parent-based constructor
      this.instructionNode = instructionOrRoute
      this.targetNode = target!
      this._parent = parent ?? null
    }
  }

  /**
   * Get the route (CID-based path).
   * Computed lazily from parent chain if not cached.
   */
  get route(): FosPath {
    if (this._cachedRoute !== null) {
      return this._cachedRoute
    }

    // Compute route from parent chain
    if (!this._parent) {
      this._cachedRoute = []
      return this._cachedRoute
    }

    this._cachedRoute = [
      ...this._parent.route,
      [this.instructionNode.getId(), this.targetNode.getId()]
    ]
    return this._cachedRoute
  }

  /**
   * Invalidate the cached route (call when parent chain changes).
   */
  invalidateRoute(): void {
    this._cachedRoute = null
  }

  /**
   * Get the parent expression (direct reference, no lookup needed).
   */
  getParentDirect(): FosExpression | null {
    return this._parent
  }

  /**
   * Set the parent expression (used during tree restructuring).
   */
  setParent(parent: FosExpression | null): void {
    this._parent = parent
    this.invalidateRoute()
  }




  async runFunctions(context: FosNode): Promise<void> {

    // Required bindings accrued from left
    // (optional bindings accrued from left)
    // internal bindings accrued from left


    // bindings accrued from right
    // bindings combined with 



    const result = await runAvailableFunctions(this)
    if (!result) {
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
    const isRootInstruction = this.instructionNode.getId() === this.store.primitive.rootInstructionNode.getId()

    if (!lastElem || isRootInstruction) {
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
      // const hasRootTarget = 
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
      console.log('Follow Alias Error', this.instructionNode.getId(), this.store.primitive.aliasConstructor.getId())
      throw new Error('Expression is not an alias')
    }

    const {
      instruction: aliasInstruction,
      target: aliasTarget
    } = this.targetNode.dereferenceNodes()

    // Create expression with parent pointer
    return new FosExpression(this.store, aliasInstruction, aliasTarget, this)
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

  /**
   * Get the parent expression.
   * Uses direct parent pointer if available (preferred), otherwise falls back to route-based lookup.
   */
  getParent(): FosExpression {
    // Use direct parent pointer if available
    if (this._parent) {
      return this._parent
    }

    // Fallback to route-based parent lookup for backward compatibility
    if (this.hasParent()) {
      return new FosExpression(this.store, this.route.slice(0, -1))
    } else {
      throw new Error('Cannot get parent of root node')
    }
  }

  /**
   * Get child expressions with proper parent pointers.
   * Uses resolved object references - no CID lookups needed.
   */
  getTargetChildren(index: number | null = null): FosExpression[] {
    // Use getEdgesResolved() for direct object references
    const children = this.targetNode.getEdgesResolved().map(([instrNode, targetNode]) => {
      return new FosExpression(this.store, instrNode, targetNode, this)
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

  /**
   * Get child at specific index with parent pointer.
   * Uses resolved object references - no CID lookups needed.
   */
  getChild(index: number): FosExpression | null {
    const edges = this.targetNode.getEdgesResolved()
    const edge = edges[index]
    if (!edge) return null

    const [instrNode, targetNode] = edge
    return new FosExpression(this.store, instrNode, targetNode, this)
  }

  /**
   * Get the index of this expression in its parent's children.
   * Uses object identity comparison instead of CID comparison.
   */
  getIndex(): number {
    if (!this._parent) return 0

    const siblings = this._parent.targetNode.getEdgesResolved()
    return siblings.findIndex(
      ([instrNode, targetNode]) =>
        instrNode === this.instructionNode &&
        targetNode === this.targetNode
    )
  }

  /**
   * Get the depth of this expression in the tree.
   */
  getDepth(): number {
    let depth = 0
    let current = this._parent
    while (current) {
      depth++
      current = current._parent
    }
    return depth
  }

  /**
   * Navigate from the root to a destination using only instruction CIDs.
   * This is used after updates when target CIDs have changed but instruction CIDs remain the same.
   * @param instructionPath Array of instruction CIDs to follow from root
   * @returns The expression at the destination path
   */
  static navigateByInstructions(store: FosStore, instructionPath: string[]): FosExpression {
    let currentExpr = store.getRootExpression()
    let pathToFollow = [...instructionPath]

    console.log('[navigateByInstructions] Starting navigation')
    console.log('[navigateByInstructions] Root isAlias:', currentExpr.isAlias())
    console.log('[navigateByInstructions] Root targetNode edges:', currentExpr.targetNode.getEdges().length)

    // Follow alias if root is an alias to get to actual data
    // After following the alias, we've navigated the first instruction in the path
    if (currentExpr.isAlias()) {
      const beforeFollow = currentExpr
      currentExpr = currentExpr.followAlias()
      console.log('[navigateByInstructions] After followAlias:')
      console.log('[navigateByInstructions]   instruction:', currentExpr.instructionNode.getId())
      console.log('[navigateByInstructions]   targetNode edges:', currentExpr.targetNode.getEdges().length)
      console.log('[navigateByInstructions]   pathToFollow[0]:', pathToFollow[0])

      // The followAlias step consumed the first instruction, so skip it
      if (pathToFollow.length > 0 && currentExpr.instructionNode.getId() === pathToFollow[0]) {
        pathToFollow = pathToFollow.slice(1)
        console.log('[navigateByInstructions] Skipped first instruction, new pathToFollow length:', pathToFollow.length)
      }
    }

    for (const instrId of pathToFollow) {
      // Follow alias if current expression is an alias
      const actualExpr = currentExpr.isAlias() ? currentExpr.followAlias() : currentExpr
      const children = actualExpr.getTargetChildren()
      const nextExpr = children.find(c => c.instructionNode.getId() === instrId)
      if (!nextExpr) {
        console.error('[navigateByInstructions] Navigation failed at instruction:', instrId)
        console.error('[navigateByInstructions] Available children:', children.map(c => c.instructionNode.getId()))
        console.error('[navigateByInstructions] Current expr instruction:', currentExpr.instructionNode.getId())
        console.error('[navigateByInstructions] Current expr targetNode edges:', currentExpr.targetNode.getEdges())
        console.error('[navigateByInstructions] Full instruction path:', instructionPath)
        console.error('[navigateByInstructions] Path to follow:', pathToFollow)
        throw new Error(`Could not navigate to instruction ${instrId}`)
      }
      currentExpr = nextExpr
    }
    return currentExpr
  }

  /**
   * Extract the instruction path (instruction CIDs only) from a route.
   */
  static getInstructionPath(route: FosPath): string[] {
    return route.map(([instr, _]) => instr)
  }


  getInstructionChildren(index: number | null = null): FosExpression[] {
    // Use getEdgesResolved() for direct object references
    const children = this.instructionNode.getEdgesResolved().map(([instrNode, targetNode]) => {
      return new FosExpression(this.store, instrNode, targetNode, this)
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

      console.log('allDescendentsMatchingPattern - instruction', hasInstructionMatch, expression.instructionNode, typeNode, expression.instructionNode.getData().description?.content || expression.instructionNode.getId(), expression.route)
      console.log('allDescendentsMatchingPattern - target', hasTargetMatch, expression.targetNode, targetNode, expression.targetNode.getData().description?.content || expression.targetNode.getId(), expression.route)
      console.log('allDescendentsMatchingPattern - info', expression.route, this)
      return acc
    })

    return [...routeMap.keys()]
  }

  getAllDescendentsForActivity(activity: string): FosPath[] {
    console.log('getAllDescendentsForActivity', activity)
    if (activity === 'comments') {
      const existingRoutes = this.getAllDescendentsMatchingPattern(this.store.primitive.commentConstructor, this.store.primitive.unit)
      const routeKeys = new Set(existingRoutes.map(route => JSON.stringify(route)))

      const globalCommentRoutes = [...this.store.table.entries()]
        .filter(([cid, node]) => node.data.comment?.scope === "global")
        .map(([cid]) => {
          const route: FosPath = [[this.store.primitive.commentConstructor.getId(), cid]]
          return route
        })
        .filter(route => {
          const key = JSON.stringify(route)
          if (routeKeys.has(key)) {
            return false
          }
          routeKeys.add(key)
          return true
        })

      return [...existingRoutes, ...globalCommentRoutes]
    }
    if (activity === 'todo') {
      return this.getAllDescendentsMatchingPattern(this.store.primitive.unit, this.store.primitive.completeField)
    }
    if (activity === 'document') {
      return this.getAllDescendentsMatchingPattern(this.store.primitive.documentField, this.store.primitive.unit)
    }
    if (activity === 'all') {
      // Return all descendant routes without filtering
      const routeMap = mutableReduceToRouteMapFromExpression(this, (acc, expression) => {
        acc.set(expression.route, expression)
        return acc
      })
      return [...routeMap.keys()]
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


  async update(instructionNode: FosNode, targetNode: FosNode): Promise<void> {
    console.log('[update] START', {
      routeLength: this.route.length,
      oldInstrId: this.instructionNode.getId().substring(0, 12),
      oldTargetId: this.targetNode.getId().substring(0, 12),
      newInstrId: instructionNode.getId().substring(0, 12),
      newTargetId: targetNode.getId().substring(0, 12)
    })

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
    console.log('[update] Creating newExpr with updateElem', updateElem[0].substring(0, 12))
    const newExpr = new FosExpression(this.store, [...this.route, updateElem])
    console.log('[update] newExpr created', {
      newExprInstrId: newExpr.instructionNode.getId().substring(0, 12),
      newExprTargetId: newExpr.targetNode.getId().substring(0, 12)
    })

    const prevInstruction = this.instructionNode
    const prevTarget = this.targetNode

    this.instructionNode = newExpr.instructionNode
    this.targetNode = newExpr.targetNode
    // Invalidate cached route since nodes changed
    this.invalidateRoute()
    console.log('[update] After assignment', {
      thisInstrId: this.instructionNode.getId().substring(0, 12),
      thisTargetId: this.targetNode.getId().substring(0, 12)
    })

    /**
     * send to some worker queue
     * if route is empty / is root, then just replace node & push history
     *
     *
     */



    newExpr.runUpdateRaw(prevInstruction, prevTarget)
    console.log('[update] END - runUpdateRaw completed')
  }

  runUpdateRaw(prevInstruction: FosNode, prevTarget: FosNode) {

    const parent = this.getParent()

    if (this.isRoot()) {
      const {
        target
      } = this.targetNode.dereferenceNodes()
      console.log('runUpdateRaw - root case', this.route, this.instructionNode.getId(), target.getId())
      this.store.setRootNode(target)

    } else {

      if (this.isAlias()) {
        console.log('runUpdateRaw - base case alias', this.route, this.instructionNode.getId(), this.targetNode.getId())
        const {
          target,
          instruction,
          // prevInstruction,
          // prevTarget
        } = this.targetNode.dereferenceNodes()


        const newAliasInfo = this.store.create({
          data: {},
          children: [
            [this.store.primitive.targetPointerConstructor.getId(), target.getId()],
            [this.store.primitive.instructionPointerConstructor.getId(), instruction.getId()],
            [this.store.primitive.prevTargetPointerConstructor.getId(), prevTarget.getId()],
            [this.store.primitive.prevInstructionPointerConstructor.getId(), prevInstruction.getId()],
          ]
        })

        /**
         * update 
         */

        const newParentTarget = parent.targetNode.updateEdge(
          prevInstruction.getId(),
          prevTarget.getId(),
          instruction.getId(),
          newAliasInfo.getId(),
        )

        // Propagate changes up to root without creating new update actions
        // (calling setTargetNode would create infinite loop since update actions are aliases)
        this.propagateTargetChange(parent, newParentTarget)

      } else {

        // replace child in parent target 
        const newParentTarget = parent.targetNode.updateEdge(
          prevInstruction.getId(),
          prevTarget.getId(),
          this.instructionNode.getId(),
          this.targetNode.getId(),
        )

        parent.setTargetNode(newParentTarget)


      }






    }


  }

  /**
   * Propagate a target node change up the tree to the root without creating update actions.
   * This is used during runUpdateRaw to avoid infinite recursion when handling aliases.
   */
  private propagateTargetChange(expr: FosExpression, newTarget: FosNode): void {
    console.log('[propagateTargetChange] expr.route.length:', expr.route.length, 'newTarget edges:', newTarget.getEdges().length)
    if (expr.route.length <= 1) {
      // At root level - update the root node
      console.log('[propagateTargetChange] Calling setRootNode with target that has', newTarget.getEdges().length, 'edges')
      this.store.setRootNode(newTarget)
    } else {
      // Update parent and continue propagating
      const parent = expr.getParent()
      const newParentTarget = parent.targetNode.updateEdge(
        expr.instructionNode.getId(),
        expr.targetNode.getId(),
        expr.instructionNode.getId(),
        newTarget.getId(),
      )
      this.propagateTargetChange(parent, newParentTarget)
    }
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
        [this.store.primitive.targetPointerConstructor.getId(), this.targetNode.getId()],

      ]
    })

    const updateElem: FosPathElem = [this.store.primitive.brachConstructorNode.getId(), branchArgNode.getId()]
    const newExpr = new FosExpression(this.store, [...this.route, updateElem])

    return newExpr


  }

  async setDescription(description: string): Promise<void> {
    console.log('[setDescription] START', {
      description: description.substring(0, 50),
      route: this.route,
      targetNodeId: this.targetNode.getId().substring(0, 12),
      instrNodeId: this.instructionNode.getId().substring(0, 12)
    })

    const newTarget = this.targetNode.updateData({
      description: {
        content: description
      }
    })
    console.log('[setDescription] newTarget created', {
      newTargetId: newTarget.getId().substring(0, 12),
      oldTargetId: this.targetNode.getId().substring(0, 12)
    })
    const newExpr = this.update(this.instructionNode, newTarget)
    console.log('[setDescription] END')
  }

  setFocusAndDescription(description: string, focusChar: number) {
    this.setDescription(description)
    this.updateFocus(focusChar)
  }

  async setSelectedOption(selectedOption: number): Promise<void> {
    const newTargetNode = this.targetNode.updateData({
      option: {
        defaultResolutionStrategy: 'selected',
        selectedIndex: selectedOption,
      }
    })
    await this.update(this.instructionNode, newTargetNode)
  }



  addOption(nodeContent: FosNodeContent, index: number) {
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
    const newAlternative = this.store.create({
      data: {
        description: {
          content
        }
      },
      children: []
    })
    const optionTarget = this.store.primitive.optionNotSelectedConstructor

    const newTarget = this.targetNode.addEdge(newAlternative.getId(), optionTarget.getId())
    await this.update(this.instructionNode, newTarget)

    // Return expression using direct object references
    return new FosExpression(this.store, newAlternative, optionTarget, this)
  }

  async addWorkflow(content: string): Promise<FosExpression> {
    const workflowConstructor = this.store.primitive.workflowField

    const workflowTargetNode = this.store.create({
      data: {
        description: {
          content
        }
      },
      children: []
    })

    const newTarget = this.targetNode.addEdge(workflowConstructor.getId(), workflowTargetNode.getId())
    await this.update(this.instructionNode, newTarget)

    // Return expression using direct object references
    return new FosExpression(this.store, workflowConstructor, workflowTargetNode, this)
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

    // Return expression using direct object references
    return new FosExpression(this.store, documentConstructor, documentTargetNode, this)
  }

  async addMarketRequest(content: string): Promise<FosExpression> {
    throw new Error('Method not implemented')
  }

  async addMarketService(content: string): Promise<FosExpression> {
    throw new Error('Method not implemented')
  }



  registerMarketService(service: string): FosExpression {

    if (!this.isWorkflow()) {
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
    if (!this.isTodo()) {
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

  /**
   * Query this expression's children as a Datalog-style scope
   * Returns all children matching the given instruction/target pattern
   *
   * @param instructionPattern Pattern for instruction node (use primitive.unit for wildcard)
   * @param targetPattern Pattern for target node (use primitive.unit for wildcard)
   * @returns Array of matching child expressions with bindings
   */
  queryPattern(instructionPattern: FosNode, targetPattern: FosNode): FosExpression[] {
    return this.getTargetChildren().filter((child) => {
      const instrMatches = instructionPattern.getId() === this.store.primitive.unit.getId() ||
        this.store.matchPattern(instructionPattern, child.instructionNode).length > 0
      const targetMatches = targetPattern.getId() === this.store.primitive.unit.getId() ||
        this.store.matchPattern(targetPattern, child.targetNode).length > 0
      return instrMatches && targetMatches
    })
  }

  /**
   * Query this scope for facts matching a predicate pattern
   * Facts are children with the FACT primitive as instruction
   *
   * @param predicatePattern The pattern to match against fact predicates
   * @returns Array of matching fact expressions
   */
  queryFacts(predicatePattern?: FosNode): FosExpression[] {
    const factPrimitive = this.store.primitive.factNode
    if (!predicatePattern) {
      // Return all facts
      return this.getTargetChildren().filter((child) =>
        child.instructionNode.getId() === factPrimitive.getId()
      )
    }
    return this.getTargetChildren().filter((child) => {
      if (child.instructionNode.getId() !== factPrimitive.getId()) {
        return false
      }
      return this.store.matchPattern(predicatePattern, child.targetNode).length > 0
    })
  }

  /**
   * Get all rules in this scope
   * Rules are children with the RULE primitive as instruction
   */
  getRulesInScope(): FosExpression[] {
    const rulePrimitive = this.store.primitive.ruleNode
    return this.getTargetChildren().filter((child) =>
      child.instructionNode.getId() === rulePrimitive.getId()
    )
  }

  /**
   * Synthesize expressions that would satisfy a given type/pattern
   *
   * This is type-directed synthesis: given a type (pattern),
   * generate all expressions from this scope that would satisfy it.
   *
   * @param typePattern The type/pattern to synthesize for
   * @returns Array of expressions that satisfy the type
   */
  synthesize(typePattern: FosNode): FosExpression[] {
    const results: FosExpression[] = []

    // 1. Check direct children that match the pattern
    const directMatches = this.getTargetChildren().filter((child) =>
      this.store.matchPattern(typePattern, child.targetNode).length > 0
    )
    results.push(...directMatches)

    // 2. Check facts that match the pattern
    const factMatches = this.queryFacts(typePattern)
    for (const fact of factMatches) {
      if (!results.some(r => r.targetNode.getId() === fact.targetNode.getId())) {
        results.push(fact)
      }
    }

    // 3. Try to derive from rules (simplified - just check rule heads)
    const rules = this.getRulesInScope()
    for (const rule of rules) {
      const ruleHead = this.getRuleHead(rule)
      if (ruleHead && this.store.matchPattern(typePattern, ruleHead).length > 0) {
        // Rule could potentially derive this type
        // For full synthesis, we'd need to check if body can be satisfied
        // For now, just note that this rule exists
      }
    }

    return results
  }

  /**
   * Get the head (derived pattern) of a rule expression
   */
  private getRuleHead(ruleExpr: FosExpression): FosNode | null {
    const ruleHeadPrimitive = this.store.primitive.ruleHeadNode
    const headChild = ruleExpr.getTargetChildren().find((child) =>
      child.instructionNode.getId() === ruleHeadPrimitive.getId()
    )
    return headChild?.targetNode ?? null
  }

  /**
   * Get the body (conditions) of a rule expression
   */
  private getRuleBody(ruleExpr: FosExpression): FosNode[] {
    const ruleBodyPrimitive = this.store.primitive.ruleBodyNode
    return ruleExpr.getTargetChildren()
      .filter((child) => child.instructionNode.getId() === ruleBodyPrimitive.getId())
      .map((child) => child.targetNode)
  }

  /**
   * Assert a fact into this scope (add as child with FACT instruction)
   *
   * @param factNode The fact to assert
   * @returns The new fact expression
   */
  async assertFact(factNode: FosNode): Promise<FosExpression> {
    const factPrimitive = this.store.primitive.factNode

    // Check if fact already exists
    const existing = this.queryFacts(factNode)
    if (existing.length > 0) {
      return existing[0]
    }

    const newTarget = this.targetNode.addEdge(factPrimitive.getId(), factNode.getId())
    await this.update(this.instructionNode, newTarget)

    // Return expression using direct object references
    return new FosExpression(this.store, factPrimitive, factNode, this)
  }

  /**
   * Retract a fact from this scope (remove child matching the fact)
   *
   * @param factPattern The fact pattern to retract
   */
  async retractFact(factPattern: FosNode): Promise<void> {
    const matches = this.queryFacts(factPattern)
    for (const match of matches) {
      const { targetIndexInParent } = match.getParentInfo()
      if (targetIndexInParent !== -1) {
        const newTarget = this.targetNode.removeEdgeByIndex(targetIndexInParent)
        await this.update(this.instructionNode, newTarget)
      }
    }
  }

  /**
   * Add a derivation rule to this scope
   *
   * @param head The pattern this rule derives
   * @param body The conditions that must match
   * @returns The new rule expression
   */
  async addRule(head: FosNode, body: FosNode[]): Promise<FosExpression> {
    const rulePrimitive = this.store.primitive.ruleNode
    const ruleHeadPrimitive = this.store.primitive.ruleHeadNode
    const ruleBodyPrimitive = this.store.primitive.ruleBodyNode

    // Build rule children: one head + multiple body conditions
    const ruleChildren: [string, string][] = [
      [ruleHeadPrimitive.getId(), head.getId()],
      ...body.map((b): [string, string] => [ruleBodyPrimitive.getId(), b.getId()])
    ]

    const ruleNode = this.store.create({
      data: { description: { content: 'Derivation rule' } },
      children: ruleChildren
    })

    const newTarget = this.targetNode.addEdge(rulePrimitive.getId(), ruleNode.getId())
    await this.update(this.instructionNode, newTarget)

    // Return expression using direct object references
    return new FosExpression(this.store, rulePrimitive, ruleNode, this)
  }

  /**
   * Apply all rules to derive new facts (forward chaining)
   * Continues until no new facts are derived (fixpoint)
   */
  async saturate(): Promise<void> {
    let changed = true
    while (changed) {
      changed = false
      const rules = this.getRulesInScope()

      for (const rule of rules) {
        const head = this.getRuleHead(rule)
        const body = this.getRuleBody(rule)

        if (!head) continue

        // Check if all body conditions are satisfied
        const bodySatisfied = body.every((condition) =>
          this.queryFacts(condition).length > 0
        )

        if (bodySatisfied) {
          // Check if head fact already exists
          const existingHead = this.queryFacts(head)
          if (existingHead.length === 0) {
            await this.assertFact(head)
            changed = true
          }
        }
      }
    }
  }

  /**
   * Complete a task and execute its effects
   * Default effect: assert completed(task)
   * Additional effects from TASK_EFFECT children
   */
  async completeTaskWithEffects(): Promise<void> {
    const taskEffectPrimitive = this.store.primitive.taskEffectNode
    const assertPrimitive = this.store.primitive.assertNode
    const retractPrimitive = this.store.primitive.retractNode
    const completedPrimitive = this.store.primitive.completedNode

    // Execute task-specific effects
    const effects = this.getTargetChildren().filter((child) =>
      child.instructionNode.getId() === taskEffectPrimitive.getId()
    )

    for (const effect of effects) {
      const effectChildren = effect.getTargetChildren()
      for (const ec of effectChildren) {
        if (ec.instructionNode.getId() === assertPrimitive.getId()) {
          await this.getParent().assertFact(ec.targetNode)
        } else if (ec.instructionNode.getId() === retractPrimitive.getId()) {
          await this.getParent().retractFact(ec.targetNode)
        }
      }
    }

    // Default effect: assert completed(task)
    const completedFact = this.store.create({
      data: { completed: { taskId: this.targetNode.getId(), time: Date.now() } },
      children: [[completedPrimitive.getId(), this.targetNode.getId()]]
    })

    if (this.hasParent()) {
      await this.getParent().assertFact(completedFact)
    }

    // Mark task as complete
    this.completeTask()
  }

  /**
   * Create a variable node for pattern matching
   */
  createVariable(name: string): FosNode {
    const variablePrimitive = this.store.primitive.variableNode
    return this.store.create({
      data: { variable: { name } },
      children: [[variablePrimitive.getId(), this.store.primitive.terminal.getId()]]
    }, `VAR_${name}`)
  }

  /**
   * Create a fact node from a predicate name and arguments
   */
  createFact(predicate: string, args: FosNode[]): FosNode {
    const factPrimitive = this.store.primitive.factNode
    const children: [string, string][] = args.map((arg) =>
      [factPrimitive.getId(), arg.getId()]
    )
    return this.store.create({
      data: { predicate, description: { content: predicate } },
      children
    }, `FACT_${predicate}`)
  }

  // === Version Control Methods ===

  /**
   * Get the version history of this expression by following PREV pointers
   * Returns an array of commits from newest to oldest
   */
  getHistory(): FosExpression[] {
    const history: FosExpression[] = []
    const prevPrimitive = this.store.primitive.previousVersion

    // Start from current expression
    let current: FosExpression | null = this

    while (current) {
      history.push(current)

      // Find PREV child
      const prevChild = current.getTargetChildren().find((child) =>
        child.instructionNode.getId() === prevPrimitive.getId()
      )

      if (prevChild && prevChild.targetNode.getId() !== this.store.primitive.terminal.getId()) {
        // Create expression for previous version
        current = new FosExpression(this.store, [...current.route, [prevPrimitive.getId(), prevChild.targetNode.getId()]])
      } else {
        current = null
      }
    }

    return history
  }

  /**
   * Create a commit (versioned snapshot) of this expression
   *
   * @param message Commit message
   * @param branchName Optional branch name (defaults to "main")
   * @returns The new expression with commit metadata
   */
  async createCommit(message: string, branchName: string = "main"): Promise<FosExpression> {
    const commitPrimitive = this.store.primitive.commitNode
    const prevPrimitive = this.store.primitive.previousVersion
    const branchNamePrimitive = this.store.primitive.branchNameNode

    // Create branch name node
    const branchNode = this.store.create({
      data: { branch: { name: branchName } },
      children: []
    }, `BRANCH_${branchName}`)

    // Create new target with commit metadata
    const commitData = {
      ...this.targetNode.getData(),
      commit: {
        message,
        timestamp: Date.now(),
        branch: branchName
      }
    }

    const newTarget = this.store.create({
      data: commitData,
      children: [
        [prevPrimitive.getId(), this.targetNode.getId()],
        [branchNamePrimitive.getId(), branchNode.getId()],
        ...this.targetNode.getEdges().filter(([instr]) =>
          instr !== prevPrimitive.getId() && instr !== branchNamePrimitive.getId()
        )
      ]
    })

    await this.update(this.instructionNode, newTarget)
    return this.isAlias() ? this.followAlias() : this
  }

  /**
   * Get all branches in this scope's history
   */
  getBranchNames(): string[] {
    const branches = new Set<string>()
    const branchNamePrimitive = this.store.primitive.branchNameNode

    const history = this.getHistory()
    for (const expr of history) {
      const branchChild = expr.getTargetChildren().find((child) =>
        child.instructionNode.getId() === branchNamePrimitive.getId()
      )
      if (branchChild) {
        const branchData = branchChild.targetNode.getData().branch
        if (branchData?.name) {
          branches.add(branchData.name)
        }
      }
    }

    // Default to "main" if no branches found
    if (branches.size === 0) {
      branches.add("main")
    }

    return Array.from(branches)
  }

  /**
   * Get the current branch name
   */
  getCurrentBranch(): string {
    const branchNamePrimitive = this.store.primitive.branchNameNode
    const branchChild = this.getTargetChildren().find((child) =>
      child.instructionNode.getId() === branchNamePrimitive.getId()
    )
    if (branchChild) {
      const branchData = branchChild.targetNode.getData().branch
      return branchData?.name ?? "main"
    }
    return "main"
  }

  /**
   * Create a new branch from this expression
   *
   * @param branchName Name for the new branch
   * @returns Expression on the new branch
   */
  async createNewBranch(branchName: string): Promise<FosExpression> {
    return this.createCommit(`Branch: ${branchName}`, branchName)
  }

  /**
   * Find the common ancestor between this expression and another
   *
   * @param other The other expression to find common ancestor with
   * @returns The common ancestor expression, or null if none found
   */
  findCommonAncestor(other: FosExpression): FosExpression | null {
    const thisHistory = this.getHistory()
    const otherHistory = other.getHistory()

    // Create set of this history's CIDs for fast lookup
    const thisIds = new Set(thisHistory.map(e => e.targetNode.getId()))

    // Find first common ancestor
    for (const expr of otherHistory) {
      if (thisIds.has(expr.targetNode.getId())) {
        return expr
      }
    }

    return null
  }

  /**
   * Merge another expression into this one
   *
   * @param other The expression to merge in
   * @param message Optional merge commit message
   * @returns MergeResult with merged expression or conflicts
   */
  async merge(other: FosExpression, message?: string): Promise<MergeResult> {
    const mergeSourcePrimitive = this.store.primitive.mergeSourceNode
    const conflictPrimitive = this.store.primitive.conflictNode
    const conflictOursPrimitive = this.store.primitive.conflictOursNode
    const conflictTheirsPrimitive = this.store.primitive.conflictTheirsNode
    const conflictBasePrimitive = this.store.primitive.conflictBaseNode

    // Find common ancestor
    const ancestor = this.findCommonAncestor(other)

    // Get children from both sides
    const ourChildren = this.getTargetChildren()
    const theirChildren = other.getTargetChildren()
    const ancestorChildren = ancestor?.getTargetChildren() ?? []

    // Map children by instruction ID for comparison
    const ourMap = new Map(ourChildren.map(c => [c.instructionNode.getId(), c]))
    const theirMap = new Map(theirChildren.map(c => [c.instructionNode.getId(), c]))
    const ancestorMap = new Map(ancestorChildren.map(c => [c.instructionNode.getId(), c]))

    const conflicts: Conflict[] = []
    const mergedChildren: [string, string][] = []

    // Process all unique instruction IDs
    const allInstrIds = new Set([...ourMap.keys(), ...theirMap.keys()])

    for (const instrId of allInstrIds) {
      const ours = ourMap.get(instrId)
      const theirs = theirMap.get(instrId)
      const base = ancestorMap.get(instrId)

      if (ours && theirs) {
        // Both have this child
        if (ours.targetNode.getId() === theirs.targetNode.getId()) {
          // Same - no conflict
          mergedChildren.push([instrId, ours.targetNode.getId()])
        } else if (base && ours.targetNode.getId() === base.targetNode.getId()) {
          // We didn't change, they did - take theirs
          mergedChildren.push([instrId, theirs.targetNode.getId()])
        } else if (base && theirs.targetNode.getId() === base.targetNode.getId()) {
          // They didn't change, we did - take ours
          mergedChildren.push([instrId, ours.targetNode.getId()])
        } else {
          // Both changed - conflict
          const conflictNode = this.store.create({
            data: { conflict: { path: instrId } },
            children: [
              [conflictOursPrimitive.getId(), ours.targetNode.getId()],
              [conflictTheirsPrimitive.getId(), theirs.targetNode.getId()],
              ...(base ? [[conflictBasePrimitive.getId(), base.targetNode.getId()] as [string, string]] : [])
            ]
          })
          conflicts.push({
            path: instrId,
            ours: ours.targetNode,
            theirs: theirs.targetNode,
            base: base?.targetNode ?? null,
            conflictNode
          })
          mergedChildren.push([conflictPrimitive.getId(), conflictNode.getId()])
        }
      } else if (ours) {
        // Only we have this
        if (base) {
          // They deleted it - conflict or accept deletion?
          // For now, keep ours (could be configurable)
          mergedChildren.push([instrId, ours.targetNode.getId()])
        } else {
          // We added it
          mergedChildren.push([instrId, ours.targetNode.getId()])
        }
      } else if (theirs) {
        // Only they have this
        if (base) {
          // We deleted it - accept their version
          mergedChildren.push([instrId, theirs.targetNode.getId()])
        } else {
          // They added it
          mergedChildren.push([instrId, theirs.targetNode.getId()])
        }
      }
    }

    // Create merged node
    const mergedData = {
      ...this.targetNode.getData(),
      merge: {
        message: message ?? `Merge ${other.getCurrentBranch()} into ${this.getCurrentBranch()}`,
        timestamp: Date.now(),
        hasConflicts: conflicts.length > 0
      }
    }

    const mergedTarget = this.store.create({
      data: mergedData,
      children: [
        [mergeSourcePrimitive.getId(), other.targetNode.getId()],
        ...mergedChildren
      ]
    })

    if (conflicts.length === 0) {
      await this.update(this.instructionNode, mergedTarget)
      return {
        success: true,
        merged: this.isAlias() ? this.followAlias() : this,
        conflicts: []
      }
    }

    return {
      success: false,
      merged: null,
      conflicts
    }
  }

  /**
   * Get any unresolved conflicts in this expression
   */
  getConflicts(): FosExpression[] {
    const conflictPrimitive = this.store.primitive.conflictNode
    return this.getTargetChildren().filter((child) =>
      child.instructionNode.getId() === conflictPrimitive.getId()
    )
  }

  /**
   * Check if this expression has unresolved conflicts
   */
  hasConflicts(): boolean {
    return this.getConflicts().length > 0
  }

  /**
   * Resolve a conflict by choosing a resolution
   *
   * @param conflictExpr The conflict expression to resolve
   * @param resolution Which version to use: 'ours', 'theirs', or a custom node
   */
  async resolveConflict(
    conflictExpr: FosExpression,
    resolution: 'ours' | 'theirs' | FosNode
  ): Promise<void> {
    const conflictPrimitive = this.store.primitive.conflictNode
    const conflictOursPrimitive = this.store.primitive.conflictOursNode
    const conflictTheirsPrimitive = this.store.primitive.conflictTheirsNode

    // Find the original instruction ID from conflict data
    const conflictData = conflictExpr.targetNode.getData().conflict
    if (!conflictData?.path) {
      throw new Error('Invalid conflict expression')
    }

    // Get the resolution value
    let resolvedNode: FosNode
    if (resolution === 'ours') {
      const oursChild = conflictExpr.getTargetChildren().find(c =>
        c.instructionNode.getId() === conflictOursPrimitive.getId()
      )
      if (!oursChild) throw new Error('Ours not found in conflict')
      resolvedNode = oursChild.targetNode
    } else if (resolution === 'theirs') {
      const theirsChild = conflictExpr.getTargetChildren().find(c =>
        c.instructionNode.getId() === conflictTheirsPrimitive.getId()
      )
      if (!theirsChild) throw new Error('Theirs not found in conflict')
      resolvedNode = theirsChild.targetNode
    } else {
      resolvedNode = resolution
    }

    // Replace conflict with resolved value
    const newChildren = this.targetNode.getEdges().map(([instr, target]) => {
      if (instr === conflictPrimitive.getId() && target === conflictExpr.targetNode.getId()) {
        return [conflictData.path, resolvedNode.getId()] as [string, string]
      }
      return [instr, target] as [string, string]
    })

    const newTarget = this.store.create({
      data: this.targetNode.getData(),
      children: newChildren
    })

    await this.update(this.instructionNode, newTarget)
  }

  /**
   * Resolve all conflicts automatically using a strategy
   *
   * @param strategy The resolution strategy: 'ours', 'theirs'
   */
  async resolveAllConflicts(strategy: 'ours' | 'theirs'): Promise<void> {
    const conflicts = this.getConflicts()
    for (const conflict of conflicts) {
      await this.resolveConflict(conflict, strategy)
    }
  }

  /**
   * Create a tag (named reference) to this version
   */
  async createTag(tagName: string): Promise<FosExpression> {
    const tagPrimitive = this.store.primitive.tagNode

    const tagNode = this.store.create({
      data: { tag: { name: tagName, timestamp: Date.now() } },
      children: []
    }, `TAG_${tagName}`)

    const newTarget = this.targetNode.addEdge(tagPrimitive.getId(), tagNode.getId())
    await this.update(this.instructionNode, newTarget)

    return this.isAlias() ? this.followAlias() : this
  }

  /**
   * Get all tags on this expression
   */
  getTags(): string[] {
    const tagPrimitive = this.store.primitive.tagNode
    return this.getTargetChildren()
      .filter(c => c.instructionNode.getId() === tagPrimitive.getId())
      .map(c => c.targetNode.getData().tag?.name)
      .filter((name): name is string => !!name)
  }

  // === Budget Methods (Linear Resources) ===

  /**
   * Create a budget as a child of this expression
   *
   * @param total Total amount available
   * @param currency Currency code (e.g., "USD")
   * @param name Optional budget name
   * @returns The new budget expression
   */
  async createBudget(total: number, currency: string = "USD", name?: string): Promise<FosExpression> {
    const budgetPrimitive = this.store.primitive.budgetNode

    const budgetTargetNode = this.store.create({
      data: {
        budget: {
          total,
          consumed: 0,
          currency,
          name
        },
        description: { content: name || `Budget: ${total} ${currency}` }
      },
      children: []
    })

    const newTarget = this.targetNode.addEdge(budgetPrimitive.getId(), budgetTargetNode.getId())
    await this.update(this.instructionNode, newTarget)

    // Return expression using direct object references
    return new FosExpression(this.store, budgetPrimitive, budgetTargetNode, this)
  }

  /**
   * Check if this expression is a budget
   */
  isBudget(): boolean {
    return this.instructionNode.getId() === this.store.primitive.budgetNode.getId()
  }

  /**
   * Get budget data if this is a budget expression
   */
  getBudgetInfo(): { total: number; consumed: number; available: number; currency: string; name?: string } | null {
    const budgetData = this.targetNode.getData().budget
    if (!budgetData) return null
    return {
      total: budgetData.total,
      consumed: budgetData.consumed,
      available: budgetData.total - budgetData.consumed,
      currency: budgetData.currency,
      name: budgetData.name
    }
  }

  /**
   * Create a sub-allocation from this budget
   *
   * @param amount Amount to allocate
   * @param name Optional allocation name
   * @returns The new allocation expression
   */
  async allocateBudget(amount: number, name?: string): Promise<FosExpression> {
    if (!this.isBudget()) {
      throw new Error('Can only allocate from a budget expression')
    }

    const budgetData = this.targetNode.getData().budget
    if (!budgetData) {
      throw new Error('Invalid budget data')
    }

    const available = budgetData.total - budgetData.consumed
    if (amount > available) {
      throw new Error(`Cannot allocate ${amount} from budget with ${available} available`)
    }

    const allocationPrimitive = this.store.primitive.allocationNode

    // Create allocation node
    const allocationNode = this.store.create({
      data: {
        budget: {
          total: amount,
          consumed: 0,
          currency: budgetData.currency,
          name,
          parentBudgetId: this.targetNode.getId()
        },
        description: { content: name || `Allocation: ${amount} ${budgetData.currency}` }
      },
      children: []
    })

    // Update this budget's consumed amount
    const updatedBudgetNode = this.store.create({
      data: {
        ...this.targetNode.getData(),
        budget: {
          ...budgetData,
          consumed: budgetData.consumed + amount
        }
      },
      children: [
        ...this.targetNode.getEdges(),
        [allocationPrimitive.getId(), allocationNode.getId()]
      ]
    })

    await this.update(this.instructionNode, updatedBudgetNode)

    // Return expression using direct object references
    return new FosExpression(this.store, allocationPrimitive, allocationNode, this)
  }

  /**
   * Spend from this budget
   *
   * @param amount Amount to spend
   * @param description Optional description of the spending
   */
  async spendBudget(amount: number, description?: string): Promise<void> {
    if (!this.isBudget()) {
      throw new Error('Can only spend from a budget expression')
    }

    const budgetData = this.targetNode.getData().budget
    if (!budgetData) {
      throw new Error('Invalid budget data')
    }

    const available = budgetData.total - budgetData.consumed
    if (amount > available) {
      throw new Error(`Cannot spend ${amount} from budget with ${available} available`)
    }

    const spentPrimitive = this.store.primitive.spentNode

    // Create spent record
    const spentNode = this.store.create({
      data: {
        spent: {
          amount,
          description,
          timestamp: Date.now()
        }
      },
      children: []
    })

    // Update budget with new consumed amount
    const updatedBudgetNode = this.store.create({
      data: {
        ...this.targetNode.getData(),
        budget: {
          ...budgetData,
          consumed: budgetData.consumed + amount
        }
      },
      children: [
        ...this.targetNode.getEdges(),
        [spentPrimitive.getId(), spentNode.getId()]
      ]
    })

    await this.update(this.instructionNode, updatedBudgetNode)
  }

  /**
   * Get all budgets in this scope
   */
  getBudgets(): FosExpression[] {
    const budgetPrimitive = this.store.primitive.budgetNode
    return this.getTargetChildren().filter((child) =>
      child.instructionNode.getId() === budgetPrimitive.getId()
    )
  }

  // === Calendar Methods (Linear Time Resources) ===

  /**
   * Create a calendar as a child of this expression
   *
   * @param name Calendar name
   * @returns The new calendar expression
   */
  async createCalendar(name: string): Promise<FosExpression> {
    const calendarPrimitive = this.store.primitive.calendarNode

    const calendarTargetNode = this.store.create({
      data: {
        calendar: {
          name,
          slots: []
        },
        description: { content: name }
      },
      children: []
    })

    const newTarget = this.targetNode.addEdge(calendarPrimitive.getId(), calendarTargetNode.getId())
    await this.update(this.instructionNode, newTarget)

    // Return expression using direct object references
    const calendarExpr = new FosExpression(this.store, calendarPrimitive, calendarTargetNode, this)
    return calendarExpr
  }

  /**
   * Check if this expression is a calendar
   */
  isCalendar(): boolean {
    return this.instructionNode.getId() === this.store.primitive.calendarNode.getId()
  }

  /**
   * Get calendar data if this is a calendar expression
   */
  getCalendarInfo(): { name: string; slots: Array<{ id: string; start: string; end: string; allocated: boolean; allocatedTo?: string }> } | null {
    const calendarData = this.targetNode.getData().calendar
    if (!calendarData) return null
    return {
      name: calendarData.name,
      slots: calendarData.slots || []
    }
  }

  /**
   * Add a time slot to this calendar
   *
   * @param start Start time (ISO 8601)
   * @param end End time (ISO 8601)
   * @returns The updated calendar expression
   */
  async addTimeSlot(start: string, end: string): Promise<FosExpression> {
    if (!this.isCalendar()) {
      throw new Error('Can only add time slots to a calendar expression')
    }

    const calendarData = this.targetNode.getData().calendar
    if (!calendarData) {
      throw new Error('Invalid calendar data')
    }

    const slotId = `slot_${Date.now()}`
    const newSlot = {
      id: slotId,
      start,
      end,
      allocated: false
    }

    const updatedCalendarNode = this.store.create({
      data: {
        ...this.targetNode.getData(),
        calendar: {
          ...calendarData,
          slots: [...(calendarData.slots || []), newSlot]
        }
      },
      children: this.targetNode.getEdges()
    })

    await this.update(this.instructionNode, updatedCalendarNode)
    return this.isAlias() ? this.followAlias() : this
  }

  /**
   * Allocate a time slot in this calendar
   *
   * @param slotId The slot ID to allocate
   * @param allocatedTo Description of what the slot is allocated to
   */
  async allocateTimeSlot(slotId: string, allocatedTo: string): Promise<void> {
    if (!this.isCalendar()) {
      throw new Error('Can only allocate time slots in a calendar expression')
    }

    const calendarData = this.targetNode.getData().calendar
    if (!calendarData) {
      throw new Error('Invalid calendar data')
    }

    const slots = calendarData.slots || []
    const slotIndex = slots.findIndex(s => s.id === slotId)

    if (slotIndex === -1) {
      throw new Error(`Time slot ${slotId} not found`)
    }

    if (slots[slotIndex].allocated) {
      throw new Error(`Time slot ${slotId} is already allocated`)
    }

    const updatedSlots = [...slots]
    updatedSlots[slotIndex] = {
      ...slots[slotIndex],
      allocated: true,
      allocatedTo
    }

    const updatedCalendarNode = this.store.create({
      data: {
        ...this.targetNode.getData(),
        calendar: {
          ...calendarData,
          slots: updatedSlots
        }
      },
      children: this.targetNode.getEdges()
    })

    await this.update(this.instructionNode, updatedCalendarNode)
  }

  /**
   * Get available (unallocated) time slots in this calendar
   */
  getAvailableTimeSlots(): Array<{ id: string; start: string; end: string }> {
    const calendarInfo = this.getCalendarInfo()
    if (!calendarInfo) return []
    return calendarInfo.slots.filter(s => !s.allocated).map(({ id, start, end }) => ({ id, start, end }))
  }

  /**
   * Get all calendars in this scope
   */
  getCalendars(): FosExpression[] {
    const calendarPrimitive = this.store.primitive.calendarNode
    return this.getTargetChildren().filter((child) =>
      child.instructionNode.getId() === calendarPrimitive.getId()
    )
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



  setSearchQuery(searchQuery: string) {
    throw new Error('Method not implemented')
  }






  completeTask() {
    const currentTargetVal = this.targetNode.value
    const newTarget = this.targetNode.updateData({
      todo: {
        completed: true,
        time: Date.now()
      },
    })
    this.update(this.instructionNode, newTarget)
  }


  async addTodo(description: string): Promise<FosExpression> {

    console.log('addTodo - this route', this.route)

    if (this.isAlias()) {
      const dereferencedThis = this.followAlias()
      console.log('addTodo - dereferencedThis route', dereferencedThis.route)
      return dereferencedThis.addTodo(description)

    }


    if (!this.isRoot() && !this.isWorkflow() && !this.isGroup()) {
      console.log('addTodo - not root or workflow or group', this.route, this.store.primitive)
      throw new Error('Method only implemented for root expressions groups and workflows')
    }

    let thisExpr: FosExpression = this


    const [newTarget, todoNode] = thisExpr.targetNode.addTodo(description)
    console.log('addTodo - newTarget', newTarget.getId(), 'todoNode', todoNode.getId())

    await thisExpr.update(thisExpr.instructionNode, newTarget)

    console.log('addTodo - updated expression', thisExpr.instructionNode.getId(), thisExpr.targetNode.getId())

    // Return expression using direct object references
    // todoNode is the instruction, completeField is the target (from addTodo in node.ts)
    return new FosExpression(this.store, todoNode, this.store.primitive.completeField, thisExpr)
  }




  async addComment (comment: string): Promise<FosExpression>  {

    const timestamp = Date.now()

    const newCommentNode = this.store.create({
      data: {
        description: {
          content: comment
        },
        comment: {
          content: comment,
          authorID: "global",
          authorName: "",
          time: timestamp,
          votes: {},
          scope: "global"
        },
        updated: {
          time: timestamp
        },
      },
      children: []
    })

    if (this.store.updateCtxCallback) {
      this.store.updateCtxCallback(this.store.exportContext(this.store.fosRoute))
    }

    const commentExpr = new FosExpression(this.store, [ [ this.store.primitive.commentConstructor.getId(), newCommentNode.getId() ]])

    return commentExpr
    
  }



  addTimeInterval(expr: FosExpression, startTime: number | undefined, stopTime: number | undefined) {
    throw new Error('Method not implemented')
  }

  startTimeInterval(expr: FosExpression) {
    throw new Error('Method not implemented')
  }

  stopTimeInterval(expr: FosExpression) {
    throw new Error('Method not implemented')
  }


  /**
   * Create a new group node
   */
  async createGroup(name: string, description?: string, visibility: 'public' | 'private' = 'private'): Promise<FosExpression> {
    const { v4: uuidv4 } = await import('uuid')
    const personFieldCid = this.store.primitive.personField.getId()

    const groupNode = this.store.create({
      data: {
        group: {
          id: uuidv4(),
          name,
          visibility,
          userProfiles: [this.targetNode.getId()],
          createdBy: this.targetNode.getId()
        },
        description: description ? { content: description } : undefined
      },
      children: [
        [personFieldCid, this.targetNode.getId()] // Creator is first member
      ]
    })

    const newTarget = this.targetNode.addEdge(this.store.primitive.groupField.getId(), groupNode.getId())
    await this.update(this.instructionNode, newTarget)

    // Return expression using direct object references
    return new FosExpression(this.store, this.store.primitive.groupField, groupNode, this)
  }

  /**
   * Create a DM (direct message) group between current user and target user
   */
  async createDM(targetUserNodeCid: string): Promise<FosExpression> {
    const { v4: uuidv4 } = await import('uuid')
    const personFieldCid = this.store.primitive.personField.getId()

    // Check if DM already exists - DMs are groups with exactly 2 members
    const existingDM = this.getTargetChildren().find((child) => {
      const groupData = child.targetNode.getData().group
      if (!groupData) return false
      const profiles = groupData.userProfiles || []
      return profiles.length === 2 && profiles.includes(this.targetNode.getId()) && profiles.includes(targetUserNodeCid)
    })

    if (existingDM) {
      return existingDM
    }

    // Create new DM node
    const dmNode = this.store.create({
      data: {
        group: {
          id: uuidv4(),
          name: 'Direct Message',
          userProfiles: [this.targetNode.getId(), targetUserNodeCid]
        }
      },
      children: [
        [personFieldCid, this.targetNode.getId()],
        [personFieldCid, targetUserNodeCid]
      ]
    })

    const newTarget = this.targetNode.addEdge(this.store.primitive.groupField.getId(), dmNode.getId())
    await this.update(this.instructionNode, newTarget)

    // Return expression using direct object references
    return new FosExpression(this.store, this.store.primitive.groupField, dmNode, this)
  }

  /**
   * Add a member to a group (adds PERSON_FIELD child)
   */
  async addMemberToGroup(memberNodeCid: string): Promise<FosExpression> {
    if (!this.isGroup()) {
      throw new Error('Can only add members to group expressions')
    }

    const personFieldCid = this.store.primitive.personField.getId()

    // Check if member already exists
    const existingMembers = this.targetNode.getEdges()
      .filter(([inst, _]) => inst === personFieldCid)
      .map(([_, target]) => target)

    if (existingMembers.includes(memberNodeCid)) {
      return this // Member already in group
    }

    const newTarget = this.targetNode.addEdge(personFieldCid, memberNodeCid)

    // Update group data
    const groupData = this.targetNode.getData().group
    if (groupData) {
      const updatedGroupData = {
        ...groupData,
        userProfiles: [...(groupData.userProfiles || []), memberNodeCid]
      }
      const updatedTarget = this.store.create({
        data: {
          ...newTarget.getData(),
          group: updatedGroupData
        },
        children: newTarget.getEdges()
      })

      await this.update(this.instructionNode, updatedTarget)
    } else {
      await this.update(this.instructionNode, newTarget)
    }

    return this.isAlias() ? this.followAlias() : this
  }

  /**
   * Send a message to a group (adds COMMENT_FIELD child)
   */
  async sendGroupMessage(message: string, authorCid: string, authorName: string): Promise<FosExpression> {
    if (!this.isGroup()) {
      throw new Error('Can only send messages to group expressions')
    }

    const commentNode = this.store.create({
      data: {
        comment: {
          content: message,
          authorID: authorCid,
          authorName: authorName,
          time: Date.now(),
          votes: {}
        }
      },
      children: []
    })

    const newTarget = this.targetNode.addEdge(this.store.primitive.commentConstructor.getId(), commentNode.getId())
    await this.update(this.instructionNode, newTarget)

    const actualExpr = this.isAlias() ? this.followAlias() : this
    const newTargetChildren = actualExpr.getTargetChildren()
    const messageExpr = newTargetChildren.find((child) =>
      child.instructionNode.getId() === commentNode.getId()
    )

    if (!messageExpr) {
      throw new Error('Message expression not found')
    }

    return messageExpr
  }

  inviteToGroup(expr: FosExpression, groupTarget: FosNode) {
    throw new Error('Method not implemented - use addMemberToGroup instead')
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

  revertToPrevious(previous: FosNode) {
    throw new Error('Method not implemented')
  }

  createBid(bid: string) {
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

  async runTask() {

    await this.executeWorkflow([])
    this.updateFocus(0)

  }



  async executeWorkflow(attachToRoute: FosPath): Promise<void> {
    const newTodoNode = this.targetNode.clone()
    const targetExpr = new FosExpression(this.store, attachToRoute)
    targetExpr.attachChild(newTodoNode, this.store.primitive.completeField, -1)
  }

  setVote(id: string, vote: number) {
    throw new Error('Method not implemented')
  }

  setApproval(id: string, approval: boolean) {
    throw new Error('Method not implemented')
  }

  addCommit(branch: string, tag?: string) {
    throw new Error('Method not implemented')
  }

  createBidRequest(todoRoute: FosPath, bidRequestInfo: {}) {
    throw new Error('Method not implemented')
  }

  approveBid(bidRoute: FosPath) {
    throw new Error('Method not implemented')
  }

  approveFulfillment(fulfillmentRoute: FosPath) {
    throw new Error('Method not implemented')
  }

  approvePayment(paymentRoute: FosPath) {
    throw new Error('Method not implemented')
  }

  createMergeRequest(route: FosPath) {
    throw new Error('Method not implemented')
  }

  addPin(route: FosPath) {
    throw new Error('Method not implemented')
  }

  removePin(route: FosPath) {
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


  async updateFocus(focusChar: number) {
    this.store.trellisData.focusChar = focusChar
  }

  // updateNodeData(newNodeData: Partial<FosDataContent>) {

  //   throw new Error('Method not implemented')
  //   const newNode = this.targetNode.updateData(newNodeData)
  //   this.targetNode = newNode
  // }

  updateZoom() {
    this.store.fosRoute = this.route
  }

  async addChild(newType: FosNode, newNodeContent: FosNodeContent, index: number = -1): Promise<FosExpression> {
    // Create the child target node - we keep this object reference
    const childTarget = this.store.create(newNodeContent)

    // Add edge to parent using CIDs (for storage)
    const newThisTarget = this.targetNode.addEdge(newType.getId(), childTarget.getId(), index)
    await this.update(this.instructionNode, newThisTarget)

    // Return child expression using direct object references (no CID lookup needed)
    // We already have the objects - newType and childTarget
    return new FosExpression(this.store, newType, childTarget, this)
  }

  async attachChild(newRowType: FosNode, newRowTarget: FosNode, index: number = -1): Promise<void> {
    const newTarget = this.targetNode.addEdge(newRowType.getId(), newRowTarget.getId(), index)
    await this.update(this.instructionNode, newTarget)
    // Child expression with parent pointer (for any callers that need it)
    // const child = new FosExpression(this.store, newRowType, newRowTarget, this)
  }

  attachTargetSibling(newRowType: FosNode, newRowTarget: FosNode, position: number | string) {
    // add option node to parent, put current node under it, and add new option

    const { parent, targetIndexInParent } = this.getParentInfo()
    if (targetIndexInParent === -1) {
      throw new Error('Node not found in parent')
    }
    let index = 0
    const parentChildren = parent.getTargetChildren()
    const parentRoute = parent.route
    if (typeof position === 'number') {
      index = position
    } else if (position === 'after') {
      index = targetIndexInParent + 1
    } else if (position === 'before') {
      index = targetIndexInParent
    } else if (position === 'first') {
      index = 0
    } else if (position === 'last') {
      index = parentChildren.length
    }

    const returnVal = this.attachChild(newRowType, newRowTarget, index)
    return returnVal
  }

  addTargetSibling(newRowType: FosNode, newNodeContent: FosNodeContent, position: number | string) {
    const newSiblingTarget = this.store.create(newNodeContent)
    this.attachTargetSibling(newRowType, newSiblingTarget, position)
    this.commit()
  }


  async removeNode(): Promise<void> {
    const { targetIndexInParent, instructionIndexInParent, parent } = this.getParentInfo()
    this.moveFocusUp()
    if (targetIndexInParent !== -1) {
      const newTarget = parent.targetNode.removeEdgeByIndex(targetIndexInParent)
      return parent.update(parent.instructionNode, newTarget)
    }
    if (instructionIndexInParent !== -1) {
      const newInstruction = parent.instructionNode.removeEdgeByIndex(instructionIndexInParent)
      return parent.update(newInstruction, parent.targetNode)
    }
    throw new Error('Node not found in parent')

  }





  snipNodeTarget() {

    const { targetIndexInParent, parent } = this.getParentInfo()

    const parentContent = parent.targetNode.getContent()
    const parentChildren = parentContent.children

    const newParentRows: FosPathElem[] = parentContent.children.reduce((acc: FosPathElem[], child: FosPathElem, i: number) => {
      if (i !== targetIndexInParent) {
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



  moveNodeAboveRoute(targetRoute: FosPath) {
    // Keep direct references to the nodes being moved
    const myInstructionNode = this.instructionNode
    const myTargetNode = this.targetNode

    this.removeNode()

    const targetExpression = new FosExpression(this.store, targetRoute)
    const { parent: targetParent, targetIndexInParent } = targetExpression.getParentInfo()

    const parentContent = targetParent.targetNode.getContent()

    const newParentRows: FosPathElem[] = targetParent.getTargetChildren().reduce((acc: FosPathElem[], child: FosExpression, i: number) => {
      if (i === targetIndexInParent) {
        const newElem: FosPathElem = this.pathElem()
        return [...acc, newElem, child.pathElem()]
      }
      return [...acc, child.pathElem()]
    }, [])

    const newParentContent = {
      ...parentContent,
      children: newParentRows,
    }

    const parentTargetNode = targetParent.targetNode.mutate(newParentContent)
    targetParent.update(targetParent.instructionNode, parentTargetNode)

    // Create moved expression using direct object references
    const movedExpr = new FosExpression(this.store, myInstructionNode, myTargetNode, targetParent)
    movedExpr.updateFocus(this.focusChar() || 0)
  }

  moveNodeBelowRoute(targetRoute: FosPath): FosExpression {
    // Keep direct references to the nodes being moved
    const myInstructionNode = this.instructionNode
    const myTargetNode = this.targetNode

    const targetExpression = new FosExpression(this.store, targetRoute)
    const { targetIndexInParent, parent } = targetExpression.getParentInfo()

    this.removeNode()
    const parentContent = parent.targetNode.getContent()

    const newParentRows: FosPathElem[] = parent.getTargetChildren().reduce((acc: FosPathElem[], child: FosExpression, i: number) => {
      if (i === targetIndexInParent) {
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

    // Create moved expression using direct object references
    const movedExpr = new FosExpression(this.store, myInstructionNode, myTargetNode, parent)
    movedExpr.updateFocus(this.focusChar() || 0)
    return movedExpr
  }

  moveNodeIntoRoute(targetRoute: FosPath, index: number = 0): FosExpression {

    const nodeContent = this.targetNode.getContent()
    const targetExpression = new FosExpression(this.store, targetRoute)

    // Keep direct references to the nodes being moved
    const myInstructionNode = this.instructionNode
    const myTargetNode = this.targetNode

    const newElem: FosPathElem = this.pathElem()

    const newParentRows: FosPathElem[] = index < 0
      ? [...nodeContent.children, targetExpression.pathElem()]
      : index === 0
        ? [newElem]
        : nodeContent.children.reduce((acc: FosPathElem[], child: FosPathElem, i: number) => {
          if (i === index) {
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

    // Create the moved child expression using direct object references
    // The parent is targetExpression (which has been updated in place)
    const movedExpr = new FosExpression(this.store, myInstructionNode, myTargetNode, targetExpression)

    movedExpr.updateFocus(this.focusChar() || 0)
    return movedExpr

  }

  reorderNodeChildren(newOrder: number[]) {

    const nodeContent = this.targetNode.getContent()

    const newTarget = this.targetNode.orderEdges(newOrder)
    const newExpr = this.update(this.instructionNode, newTarget)
    return newExpr
  }

  moveLeft() {

    const {
      parent,
      targetIndexInParent,
      siblingRoutes
    } = this.getParentInfo()

    if (parent.route.length === 1) {
      return
    }


    siblingRoutes().forEach((siblingRoute: FosPath, i: number) => {
      if (i < targetIndexInParent + 1) {
        return
      } else {
        console.log('siblingRoute', siblingRoute, this.route, i, targetIndexInParent)
        throw new Error('Not implemented')
        this.moveNodeIntoRoute(this.route, i - targetIndexInParent + 1)
      }
    })

    const exprInNewPath = this.moveNodeBelowRoute(parent.route)

  }

  moveRight(): FosExpression {


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
      if (actualUpSiblingExpr) {
        console.warn('this is a case that needs to be caught for better useability')
      }
      // moveNodeIntoRoute now returns the correctly navigated expression
      return this.moveNodeIntoRoute(upSiblingExpr.route, upSiblingExpr.getTargetChildren().length)
    }
    return this
  }

  moveUp() {

    const upSibling = getUpSibling(this)

    console.log('upSibling', upSibling)
    if (upSibling) {
      return this.moveNodeAboveRoute(upSibling.route)
    } else {
      const leastUpSibling = getAncestorLeastUpSibling(this)
      console.log('leastUpSibling', leastUpSibling)
      if (leastUpSibling) {
        return this.moveNodeIntoRoute(leastUpSibling.route, -1)
      } else {
        const parent = this.getParent()
        return this.moveNodeAboveRoute(parent.route)
      }
    }

  }

  moveDown() {

    const downSibling = getDownSibling(this)
    if (downSibling) {
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








  toggleOptionChildCollapse() {

    const isOptionChildCollapsed = this.isOptionChildCollapsed()

    const selectedOptionRoute = this.getOptionInfo().selectedChildRoute

    const newCollapsedList = isOptionChildCollapsed
      ? this.store.trellisData.collapsedList.filter((route: FosPath) => !pathEqual(route, selectedOptionRoute))
      : [...this.store.trellisData.collapsedList, selectedOptionRoute]

    this.store.trellisData.collapsedList = newCollapsedList

  }


  toggleCollapse() {

    const newCollapsedList = this.isCollapsed()
      ? this.store.trellisData.collapsedList.filter((route: FosPath) => !pathEqual(route, this.route))
      : [...this.store.trellisData.collapsedList, this.route]

    this.store.trellisData.collapsedList = newCollapsedList

  }



  moveFocusDown() {
    console.log(this.store.trellisData)
    const downNodeExpr = getDownNode(this)
    if (downNodeExpr) {
      downNodeExpr.updateFocus(this.focusChar() || 0)
    }
  }

  moveFocusUp() {
    console.log(this.store.trellisData)
    const upNodeExpr = getUpNode(this)
    if (upNodeExpr) {
      upNodeExpr.updateFocus(this.focusChar() || 0)
    }
  }

  moveFocusToEnd() {
    const description = this.getDescription()
    this.updateFocus(description.length)
  }

  moveFocusToStart() {
    this.updateFocus(0)
  }


  async addDownSibling(): Promise<FosExpression> {

    const { targetIndexInParent, parent } = this.getParentInfo()
    // Fixed: was calling this.addChild() instead of parent.addChild()
    const newChild = await parent.addChild(
      this.instructionNode,
      { data: { description: { content: "" } }, children: [] },
      targetIndexInParent + 1)
    await newChild.updateFocus(this.focusChar() || 0)
    return newChild
  }




  keyUpEvents(e: React.KeyboardEvent<HTMLDivElement>) {
    const value = e.target

    if (e.key === 'Backspace' && this.focusChar() === 0) {
      this.moveFocusUp()
    }

    if (e.key === " ") {
      e.stopPropagation();
    }

    if (e.key === "Enter") {
      // console.log('trying to prevent default');
      // e.preventDefault()
      // e.stopPropagation()
      if (e.shiftKey) {

        return
      } else {
        // console.log('addYoungerSibling - comboboxEditable', this.hasFocus(), this.getString().length, JSON.stringify(this.getString()))
        if (this.focusChar() === this.getDescription().length) {
          e.preventDefault()
          this.addDownSibling()
        }
      }
    }
    // console.log('keypress', e.key)


    if (e.key === "ArrowUp") {
      if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {

        this.moveFocusUp()
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (e.ctrlKey) {
        if (e.altKey) {
          this.moveUp()
        } else {
          this.moveFocusToStart()
        }
        e.stopPropagation();
        return
      }
    }


    if (e.key === "ArrowDown") {
      if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        e.stopPropagation()
        this.moveFocusDown()
        return
      }
      if (e.ctrlKey) {
        if (e.altKey) {
          this.moveDown()
        } else {
          this.moveFocusToEnd()
        }
        e.stopPropagation();
        return;
      }
    }

    if (e.key === "ArrowRight") {
      if (e.altKey && e.ctrlKey) {
        console.log('moveRight - comboboxEditable', this.getDescription(), this.route)
        this.moveRight()
      }
    }

    if (e.key === "ArrowLeft") {
      if (e.altKey && e.ctrlKey) {
        this.moveLeft()
      }
    }

    if (e.key === " " && e.ctrlKey) {
      this.toggleCollapse()
    }


  }

  keyDownEvents(e: React.KeyboardEvent<HTMLDivElement>) {


    // console.log('keydown', e.key)
    if (e.key === " ") {
      e.stopPropagation();
    }
    if (e.key === 'Enter') {
      e.stopPropagation()
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault()
      e.stopPropagation()
    }

    if (e.key === "Backspace" && !this.getDescription()) {
      console.log('deleteRow - comboboxEditable', this.getDescription(), this.route)
      if (this.hasFocus() && this.focusChar() === 0) {
        if (!e.shiftKey) {
          this.snipNodeTarget()
        } else {
          this.removeNode()
        }
      }
    }

  }


  keyPressEvents(event: React.KeyboardEvent<HTMLDivElement>) {

  }


  async addRowAsChild(newType: FosNode = this.instructionNode) {

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
    const childExpr = await this.addChild(newType, newNodeContent)
    // console.log('newState', newState, diff({left: appData, right: newState}))
    childExpr.updateFocus(0)

  }






}

