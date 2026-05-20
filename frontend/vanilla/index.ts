/**
 * Vanilla TypeScript UI for Fosforescent
 *
 * A minimal, functional approach to rendering the graph.
 * No React, no virtual DOM - direct DOM manipulation.
 *
 * Usage:
 *
 * ```typescript
 * import { createFosApp } from './vanilla';
 *
 * const app = createFosApp('#app');
 *
 * // Or with initial data:
 * const app = createFosApp('#app');
 * app.setData(myFosContextData);
 *
 * // Change views:
 * app.setView('tree');
 * app.setView('queue');
 * app.setView('focus');
 *
 * // Navigate:
 * app.navigate(somePath);
 *
 * // Get current data:
 * const data = app.getData();
 * ```
 */

// Core app
export { FosApp, createFosApp } from './app';

// Views
export { renderView, renderQueueView, renderTreeView, renderFocusView, createViewContextWithDrag } from './views';
export type { ViewType, ViewContext, ViewContextOptions } from './views';

// Rendering primitives
export { el, div, span, input, button, render, renderNode, registerPattern, createNodeContent } from './render';
export type { RenderContext, NodeRenderer } from './render';

// Tree operations (wrapping FosExpression methods)
export {
  // Navigation
  getUpNode,
  getDownNode,
  getLastDescendent,
  getUpSibling,
  getDownSibling,
  // Movement
  moveUp,
  moveDown,
  moveLeft,
  moveRight,
  // Editing
  addSiblingBelow,
  addChild,
  addRowAsChild,
  snip,
  deleteNode,
  // Focus
  moveFocusUp,
  moveFocusDown,
  updateFocus,
  getFocusChar,
  // Collapse
  toggleCollapse,
  isCollapsed,
  // Path utilities
  pathEqual,
  isAncestor,
  pathToKey,
  // State
  createTreeState,
  setFocus,
  hasFocus,
} from './tree-ops';
export type { TreeState } from './tree-ops';

// Keyboard handling
export {
  getKeyboardAction,
  executeKeyboardAction,
  createInputKeyboardHandler,
  attachKeyboardHandlers,
} from './keyboard';
export type { KeyboardAction } from './keyboard';

// Drag and drop
export {
  createDragState,
  makeDraggable,
  makeDropTarget,
  makeDraggableDropTarget,
  makeDragHandle,
  executeDrop,
} from './drag-drop';
export type { DragState, DragCallbacks, DropPosition } from './drag-drop';
