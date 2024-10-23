import React from "react"

import type { TrellisComponents } from "../components/default"

export type TrellisTrail<T extends TrellisNodeInterface<T>, S> = TrellisNodeClass<T, S>[]

export type TrellisInterfaceOptions = Partial<{
  canUndo: boolean,
  undo: () => void,
  canRedo: boolean,
  redo: () => void,
  theme: "light" | "dark" | "system",
  // components?: Partial<{
  //   root: React.ComponentType<TrellisNodeProps<T, S>>,
  //   head: React.ComponentType<TrellisNodeProps<T, S>>,
  //   rows: React.ComponentType<TrellisNodeProps<T, S>>,
  //   row: React.ComponentType<TrellisNodeProps<T, S>>,
  //   rowBody: React.ComponentType<TrellisNodeProps<T, S>>,
  //   cell: React.ComponentType<TrellisNodeProps<T, S>>,
  //   breadcrumb: React.ComponentType<TrellisNodeProps<T, S>>,
  //   breadcrumbs: React.ComponentType<TrellisNodeProps<T, S>>,
  //   loading: React.ComponentType<TrellisNodeProps<T, S>>,
  // }>,
  // functions?: Partial<TrellisGraphFunctions<T, S>>,

}>

export type TrellisOptions<T, S> = Partial<{
  canUndo: boolean,
  undo: () => void,
  canRedo: boolean,
  redo: () => void,

  // functions?: Partial<TrellisGraphFunctions<T, S>>,
}>






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

export interface TrellisDataInterface {
  nodes: TrellisNodeData[]
  edges: TrellisEdgeData[]
  rootNodeId: string

}


export interface TrellisNodeInterface<T extends TrellisNodeInterface<T>> {
  // createChild: (edgeData: S, node: TrellisNodeClass<T, S>) => void
  // removeChild: (edge: TrellisEdgeClass<T, S>, node: TrellisNodeClass<T, S>) => void
  setChildren: (children: T[]) => void
  getChildren: () => T[]
  getId: () => string
  newChild: () => T
  getString: () => string
  setString: (string: string) => void
  getParent: () => T | null
  // isCollapsed?: () => boolean
  // toggleCollapse?: () => void
  showRow?: () => React.ReactNode
  showHead?: () => React.ReactNode
  showRoot?: () => React.ReactNode
  showRowActions?: () => React.ReactNode
  showScreen?: () => React.ReactNode
  showBreadcrumb?: () => React.ReactNode
  showCell?: () => React.ReactNode
  getUpNode?: () => T | null
  getDownNode?: () => T | null
  moveUp?: () => void
  moveDown?: () => void
  moveLeft?: () => void
  moveRight?: () => void
  moveFocusUp?: () => void
  moveFocusDown?: () => void
  snip?: () => void
  isCollapsed?: () => boolean
  toggleCollapse?: () => void
  hasZoom?: () => boolean
  setZoom?: () => void
  hasFocus?: () => number | null
  setFocus?: (focusChar: number | null) => void
  delete?: () => void
  keyDownEvents?: (e: React.KeyboardEvent) => void
  keyUpEvents?: (e: React.KeyboardEvent) => void
  isBeingDragged?: () => boolean
  isBeingDraggedOver?: () => boolean
  userIsDragging?: () => boolean
  // serialize?: () => TrellisSerializedData
  // deserialize?: (data: TrellisSerializedData) => void
  refresh?: () => void
  
}

export interface TrellisNodeClass<T extends TrellisNodeInterface<T>, S> {
  // createChild: () => { node: TrellisNodeClass }
  // addChild: (node: TrellisNodeClass) => void
  // removeChild: (node: TrellisNodeClass) => void
  getInterfaceNode: () => T
  getChildren: () => TrellisNodeClass<T, S>[]
  setChildren: (children: TrellisNodeClass<T, S>[]) => void
  getWrappedChildren: (visibleOnly?: boolean) => TrellisNodeClass<T, S>[]
  setWrappedChildren: (children: TrellisNodeClass<T, S>[]) => void
  toggleCollapse: () => void
  moveNodeToTopChild: (node: TrellisNodeClass<T, S>) => void
  moveNodeToUpSibling: (node: TrellisNodeClass<T, S>) => void
  moveNodeToDownSibling: (node: TrellisNodeClass<T, S>) => void
  // addYoungerSibling: () => void
  moveLeft: () => void
  moveRight: () => void
  moveUp: () => void
  moveDown: () => void
  moveFocusUp: () => void
  moveFocusDown: () => void
  snip: () => void
  isCollapsed: () => boolean
  getId: () => string
  getRoute: () => TrellisTrail<T, S>
  // getNode: (trail: TrellisTrail) => TrellisNodeClass | null
  hasZoom: () => boolean
  setZoom: () => void
  getString: () => string
  setString: (string: string) => void
  components: TrellisComponents<T, S>
  getRoot: () => TrellisNodeClass<T, S>
  isRoot: () => boolean
  // getTrail: () => TrellisTrail<T, S>
  newChild: () => TrellisNodeClass<T, S>
  hasFocus: () => number | null
  setFocus: (focusChar: number | null) => void
  getParent: () => TrellisNodeClass<T, S> | null
  // getFocusedChild: () => [TrellisNodeClass<T, S>, number] | null
  delete: () => void
  keyDownEvents: (e: React.KeyboardEvent) => void
  keyUpEvents: (e: React.KeyboardEvent) => void
  isBeingDragged: () => boolean
  isBeingDraggedOver: () => boolean
  userIsDragging: () => boolean
  serialize: () => TrellisSerializedData
  deserialize: (data: TrellisSerializedData) => void
  refresh: () => void
  getMeta: () => TrellisMeta<T, S>
}


export interface TrellisMeta<T extends TrellisNodeInterface<T>, S> {
  focus: {
    route: TrellisTrail<T, S>,
    focusChar: number | null
  },
  zoom: {
    route: TrellisTrail<T, S> | null
  },
  trellisNode: TrellisNodeClass<T, S>,
  node: T, 
  keyDownEvents: (e: React.KeyboardEvent) => void,
  keyUpEvents: (e: React.KeyboardEvent) => void,
  isBeingDragged: boolean,
  isBeingDraggedOver: boolean,
  dragging: boolean,
  isFocused: number | null,
  acquireFocus: (char: number | null) => void,
  isCollapsed: () => boolean,
  toggleCollapse: () => void,
}

export interface TrellisSerializedData {
  zoomRoute: string[],
  focusRoute: string[],
  focusChar: number | null,
  collapsedList: string[],
  rowDepth: number,
  draggingNode: string | null,
  draggingOverNode: string | null,
}