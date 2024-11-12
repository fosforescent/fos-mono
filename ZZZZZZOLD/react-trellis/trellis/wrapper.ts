import { TrellisMeta, TrellisNodeClass, TrellisNodeInterface, TrellisSerializedData } from "@/react-trellis/trellis/types";
import { TrellisComponents } from "../components/default";
import { 
  addYoungerSibling, 
  getDownNode, 
  getUpNode, 
  isEndOfString, 
  moveDown, 
  moveLeft, 
  moveNodeToTopChild, 
  moveNodeToUpSibling, 
  moveNodeToDownSibling, 
  moveRight, 
  moveUp, 
  snip } from "./util";
import { KeyboardEvent } from "react";

import _ from 'lodash'

export class TrellisWrappe<T extends TrellisNodeInterface<T>, S> implements TrellisNodeClass<T, S> {

  
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor(
    private node: T, 
    private route: TrellisNodeClass<T, S>[], 
    private trail: TrellisNodeClass<T, S>[], 
    public components: TrellisComponents<T, S>,
    private state: TrellisSerializedData,
    private updateState: (state: TrellisSerializedData) => void
  ){
    this.deserialize(state)
  }

  refresh(): void {
    for (const child of this.getChildren()){
      child.deserialize(this.state)
    }
    this.updateState(this.state)
  }

  serialize(): TrellisSerializedData {
    // console.log('serializing..', this.hasZoom(), this.state)
    const thisIdRoute: string[] = [...this.getRoute(), this].map((child) => child.getId())
    // console.log('thisIdRoute', thisIdRoute)

    const serializedState = this.getChildren().reduce((acc, child, index) => {
      const thisHasZoom = acc.zoomRoute.length > 0
      // console.log('thisHasZoom', thisHasZoom, child.hasZoom(), child)

      const childIdRoute = [...child.getRoute(), child].map((node) => node.getId())

      // console.log('childIdRoute', childIdRoute, child.hasZoom())

      return {
        zoomRoute: child.hasZoom() ? childIdRoute : acc.zoomRoute,
        focusRoute: child.hasFocus() !== null ? childIdRoute : acc.focusRoute,
        focusChar: child.hasFocus() ? child.hasFocus() : acc.focusChar,
        collapsedList: child.isCollapsed() ? [...acc.collapsedList, child.getId()] : acc.collapsedList,
        rowDepth: acc.rowDepth,
        draggingNode: acc.draggingNode,
        draggingOverNode: acc.draggingOverNode
      }
    }, {
      zoomRoute: this.hasZoom() ? thisIdRoute : this.state.zoomRoute,
      focusRoute: this.hasFocus() !== null ? thisIdRoute : this.state.focusRoute,
      focusChar: this.hasFocus() !== null ? this.hasFocus() : this.state.focusChar,
      collapsedList: this.isCollapsed() ? [this.getId()] : this.state.collapsedList,
      rowDepth: this.state.rowDepth,
      draggingNode: this.state.draggingNode,
      draggingOverNode: this.state.draggingOverNode
    })
    // console.log('serializedState', serializedState)
    return serializedState
  }

  deserialize(data: TrellisSerializedData){
    this.state = data
    this.getChildren().forEach((child) => {
      child.deserialize(data)
    })

  }

  

  getChildren(): TrellisNodeClass<T, S>[] {
    const unwrappedChildren = this.node.getChildren()
    const wrappedChildren = unwrappedChildren.map((child) => {

      const childUpdateState = (state: TrellisSerializedData) => {
        this.state = state
        // console.log('childUpdateState', this.route)
        this.updateState(this.serialize())
      }

      const wrappedNode: TrellisNodeClass<T, S> = new TrellisWrapper<T, S>(child, [...this.getRoute(), this], this.trail, this.components, this.state, childUpdateState.bind(this))
      return wrappedNode
    })
    return wrappedChildren
  }

  setChildren(children: TrellisNodeClass<T, S>[]): void {
    // console.log('trellis - setting children', children)
    const unwrappedChildren = children.map((child) => {
      return child.getInterfaceNode()
    })
    this.node.setChildren(unwrappedChildren)
    this.refresh()
  }


  findChildById(id: string): TrellisNodeClass<T, S> | null {
    const rootNode = this.getRoot()
    const helper = (node: TrellisNodeClass<T, S>): TrellisNodeClass<T, S> | null => {
      if (node.getId() === id) {
        return node
      } else {
        return node.getWrappedChildren().find((child) => helper(child)) || null
      }
    }
    return helper(rootNode)
  }

  getWrappedChildren(visibleOnly = false): TrellisNodeClass<T, S>[] {
    const unwrappedChildren: T[] = this.node.getChildren()
    if (visibleOnly && this.isCollapsed()){
      return []
    }
    const wrappedChildren = unwrappedChildren.map((child: T) => {
      const childUpdateState = (state: TrellisSerializedData) => {
        this.state = state

        const serialized = this.serialize()
        // console.log('childUpdateState', this.route, this.state, serialized)

        this.updateState(this.serialize())
      }

      const wrappedChild: TrellisNodeClass<T, S> = new TrellisWrapper<T, S>(child, [...this.getRoute(), this], this.trail, this.components, this.state, childUpdateState.bind(this))
      return wrappedChild
    })
    return wrappedChildren
  }

  setWrappedChildren(children: TrellisNodeClass<T, S>[]): void {
    const unwrappedChildren = children.map((child) => {
      return child.getInterfaceNode()
    })
    this.node.setChildren(unwrappedChildren)
  }

  delete(): void {
    if (this.node.delete){
      this.node.delete()
    }else{
      const parent = this.getParent()
      if (parent) {
        const newChildren = parent.getChildren().filter((child) => child.getId() !== this.getId())
        parent.setChildren(newChildren)
      }  
    }
  }


  getInterfaceNode(): T {
    return this.node
  }

  isCollapsed(): boolean {
    return this.state.collapsedList.includes(this.getId())
  }

  toggleCollapse(): void {

    if (this.isCollapsed()){
      this.state = {
        ...this.state,
        collapsedList: this.state.collapsedList.filter((id) => id !== this.getId())
      }
    }else {
      this.state = {
        ...this.state,
        collapsedList: [...this.state.collapsedList, this.getId()]
      }
    }

    this.refresh()

  };

  getId() {
    return this.node.getId()
  }

  getRoute(): TrellisNodeClass<T, S>[] {
    return this.route
  }


  getParent(): TrellisNodeClass<T, S> | null {
    if (this.route.length === 0) {
      return null
    } else {
      return this.route[this.route.length - 1] || null
    }
  }


  getUpNode(): TrellisNodeClass<T, S> | null {
    const upNode = getUpNode<TrellisNodeClass<T, S>>(this)
    console.log('getUpNode', upNode)
    return upNode
  }


  getDownNode(): TrellisNodeClass<T, S> | null {
    const downNode = getDownNode<T, S>(this)
    console.log('getDownNode', downNode)
    return downNode
  }

  moveLeft(): void {
    const thisFocus = this.hasFocus()
    const nodeInNewPosition = moveLeft<TrellisNodeClass<T, S>>(this)
    nodeInNewPosition.setFocus(thisFocus || 0)
  };

  moveNodeToUpSibling(node: TrellisNodeClass<T, S>): void{
    moveNodeToUpSibling<TrellisNodeClass<T, S>>(this, node)
  };


  moveNodeToTopChild(node: TrellisNodeClass<T, S>): void{
    console.log('moveNodeToTopChild', node)
    const thisFocus = this.hasFocus()
    const nodeInNewPosition = moveNodeToTopChild<TrellisNodeClass<T, S>>(this, node)
    nodeInNewPosition.setFocus(thisFocus || 0)
  };

  moveNodeToDownSibling(node: TrellisNodeClass<T, S>): void {
    console.log('moveNodeToDownSibling', node)
    const nodeInNewPosition = moveNodeToDownSibling<TrellisNodeClass<T, S>>(this, node)
    // nodeInNewPosition.setFocus(node.hasFocus() || 0)
  };

  addYoungerSibling(): TrellisNodeClass<T, S>{
    addYoungerSibling<TrellisNodeClass<T, S>>(this)
    const sibling = this.getDownNode()
    console.log('addYoungerSibling', sibling)
    if (!sibling){
      throw new Error('addYoungerSibling - no sibling found')
    }
    sibling.setFocus(0)
    return sibling
  }

  moveRight(){
    const thisFocus = this.hasFocus()
    const updatedNode = moveRight<T, S>(this)
    updatedNode.setFocus(thisFocus || 0)
  };

  moveDown(): void{
    moveDown<TrellisNodeClass<T, S>>(this)
  };

  moveUp(): void {
    moveUp<T, S>(this)
  }


  moveFocusUp(): void {
    const upNode = this.getUpNode()
    if (upNode){
      upNode.setFocus(this.hasFocus() || 0)
    }
  }

  moveFocusDown(): void {
    const downNode = this.getDownNode()
    if (downNode){
      downNode.setFocus(this.hasFocus() || 0)
    }
  }
  snip(): void {
    snip<TrellisNodeClass<T, S>>(this)
  }

  hasFocus(): number | null {
    const thisRoute = [...this.getRoute(), this].map((node) => node.getId())
    const focusRoute = this.state.focusRoute
    const isFocusRoute = _.isEqual(thisRoute, focusRoute)
    return isFocusRoute ? (this.state.focusChar || 0) : null
  }

  setFocus(focusChar: number | null){
    // console.log('setting focus', focusChar, this.state, this)
    // console.trace()
    this.state = { 
      ...this.state, 
      focusRoute: [...this.getRoute(), this].map((node) => node.getId()),
      focusChar: focusChar }
    // console.log('setting focus', this.state, this)
    this.refresh()
  }

  setZoom(): void {
    const newZoomRoute = [...this.getRoute(), this].map((node) => node.getId())
    this.state = { ...this.state, zoomRoute: newZoomRoute } 
    console.log('setting zoom', newZoomRoute, this.state)
    this.refresh()
  }

  hasZoom(): boolean {
    const thisRoute = [...this.getRoute(), this].map((node) => node.getId())
    const zoomRoute = this.state.zoomRoute
    // console.log('hasZoom', thisRoute, zoomRoute)
    const routesMatch = _.isEqual(thisRoute, zoomRoute)
    return routesMatch
  }
  

  getString(): string {
    return this.node.getString()
  }

  setString(newString: string) {
    this.node.setString(newString)
    this.refresh()

  }

  newChild(): TrellisNodeClass<T, S> {
    const newChild =  this.node.newChild()

    const childUpdateState = (state: TrellisSerializedData) => {
      this.state = state
      console.log('childUpdateState', this.route)
      this.updateState(this.serialize())
    }

    const newWrappedNode = new TrellisWrapper(newChild, [...this.getRoute(), this], this.trail, this.components, this.state, childUpdateState.bind(this))
    return newWrappedNode
  }

  getRoot(): TrellisNodeClass<T, S> {
    const parent = this.getParent()
    if (!parent) {
      return this
    } else {
      return parent.getRoot()
    }
  };

  isRoot(){
    return !this.getParent()
  };



  keyDownEvents(e: React.KeyboardEvent): void {
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

    if (e.key === "Backspace" && !this.getString()){
      console.log('deleteRow - comboboxEditable', this.getString(), this.node)
      if (this.hasFocus() === 0){
        this.moveFocusUp()
        if (!e.shiftKey){
          this.snip()
        }else{
          this.delete()
        }
      }
    }


  }


  keyUpEvents (e: KeyboardEvent<Element>) {


  // const handleKeyPress = (e: React.KeyboardEvent) => {
    // if (e.key === 'Enter'){
    //   e.preventDefault()
    //   e.stopPropagation()
    //   addYoungerSibling()
    // }
    // addYoungerSibling={addYoungerSibling}
    // moveLeft={moveLeft}
    // moveRight={moveRight}
    // deleteRow={deleteRow}
    // moveFocusDown={moveFocusDown}
    // moveFocusUp={moveFocusUp}
    // toggleCollapse={toggleCollapse}
    // moveDown={moveDown}
    // moveUp={moveUp}
    // handleRedo={handleRedo}
    // handleUndo={handleUndo}


  // }

    // console.log('keyup', e.key)
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
        if(isEndOfString(this)){
          e.preventDefault()
          this.addYoungerSibling()
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
        e.stopPropagation();
      }
    }

    
    if (e.key === "ArrowDown") {
      if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey){
        e.preventDefault()
        e.stopPropagation()
        this.moveFocusDown()
        return 
      }
    }

    if (e.key === "ArrowRight"){
      if (e.altKey && e.ctrlKey){
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


  isBeingDragged(): boolean {
    return this.state.draggingNode === this.getId()
  }

  isBeingDraggedOver(): boolean {
    return this.state.draggingOverNode === this.getId()
  }

  userIsDragging(): boolean {
    return this.state.draggingNode !== null
  }

  getMeta(): TrellisMeta<T, S>{


    const zoomHelper = (node: TrellisNodeClass<T, S>, trail: string[]): TrellisNodeClass<T, S>[] => {
      const [trailHead, ...trailTail] = trail
      // console.log('zoomHelper', node.getId(), trailHead, trailTail)
      if (node.getId() !== trailHead) {
        // console.log('node', node.getId(), trailHead)
        throw new Error('zoomHelper - trailHead not found')
      }
      if (trailTail.length === 0) {
        return [node]
      } else {
        const nextNode = node.getChildren().find((child) => child.getId() === trailTail[0])
        if (nextNode) {
          const nextResult = zoomHelper(nextNode, trailTail)
          // console.log('nextNode', nextNode.getId(), trailTail, nextResult, node.getId())
          return [node, ...nextResult]
        } else {
          throw new Error('zoomHelper - nextNode not found')
        }
      }
    }

    const zoomedRoute = this.state.zoomRoute.length > 0 ? zoomHelper(this.getRoot(), this.state.zoomRoute) : [this.getRoot()]

    const focusHelper = (node: TrellisNodeClass<T, S>, trail: string[]): TrellisNodeClass<T, S>[] => {
      const [trailHead, ...trailTail] = trail
      if (node.getId() !== trailHead) {
        throw new Error('focusHelper - trailHead not found')
      }
      if (trailTail.length === 0) {
        return [node]
      } else {
        const nextNode = node.getChildren().find((child) => child.getId() === trailTail[0])
        if (nextNode) {
          return [node, ...focusHelper(nextNode, trailTail)]
        } else {
          // console.log('focusHelper', node.getId(), trailTail, node.getChildren(), this.state.focusRoute)
          return [node]
          throw new Error('focusHelper - nextNode not found')
        }
      }
    }

    const focusRoute = this.state.focusRoute.length > 0 ? focusHelper(this.getRoot(), this.state.focusRoute) : [this.getRoot()]


    return {
      zoom: {
        route: zoomedRoute
      },
      focus: {
        route: focusRoute,
        focusChar: this.state.focusChar
      },
      trellisNode: this,
      node: this.getInterfaceNode(),
      keyDownEvents: this.keyDownEvents.bind(this),
      keyUpEvents: this.keyUpEvents.bind(this),
      isBeingDragged: this.isBeingDragged(),
      isBeingDraggedOver: this.isBeingDraggedOver(),
      dragging: this.userIsDragging(),
      isFocused: this.hasFocus(),
      acquireFocus: this.setFocus.bind(this),
      isCollapsed: this.isCollapsed.bind(this),
      toggleCollapse: this.toggleCollapse.bind(this),
    }
  }

}