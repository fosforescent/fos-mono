/**
 * Fosforescent Frontend
 *
 * Vanilla TypeScript UI - minimal, functional approach to rendering the graph.
 * No React, no virtual DOM - direct DOM manipulation.
 *
 * Usage:
 *
 * ```typescript
 * import { createFosApp } from './index';
 *
 * const app = createFosApp('#app');
 * app.setData(myFosContextData);
 *
 * // Change views:
 * app.setView('tree');
 * app.setView('queue');
 * app.setView('focus');
 * app.setView('peer');  // Peer connection UI
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

// Views (from expression-tree)
export { renderView, renderTree, renderQueue, renderFocus, renderExpression } from './expression-tree';
export type { ViewType, DiffContext } from './expression-tree';

// Rendering primitives
export { el, div, span, input, button, render, renderNode, registerPattern, createNodeContent } from './render';
export type { RenderContext, NodeRenderer } from './render';

// Path utilities
export { pathEqual, isAncestor, pathToKey } from './path-utils';

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

// Peer connection (WebRTC) - per-node, multiple peers
// Automatically uses Tauri backend in desktop, browser WebRTC otherwise
export {
  NodePeer,
  NodePeers,
  PeerConnectionBuilder,
  renderNodePeersUI,
  createPeerConnectionBuilder,
  isWebRTCAvailable,
} from './peer-connection';
export type {
  ConnectionState,
  PeerMessage,
  NodePeersUIOptions,
  AnyPeerConnectionBuilder,
  AnyNodePeer,
} from './peer-connection';

// Tauri-specific peer connection (for direct access if needed)
export { isTauri, TauriPeerConnectionBuilder, TauriNodePeer } from './peer-connection-tauri';

// Branch selector (proposal/branching system)
export { renderBranchSelector, renderCompactBranchSelector } from './branch-selector';
export type { BranchSelectorCallbacks, BranchSelectorProps } from './branch-selector';

