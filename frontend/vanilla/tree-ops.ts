/**
 * Tree Operations
 *
 * Wraps FosExpression methods for tree navigation, movement, and manipulation.
 * FosExpression already has most of these implemented - we just provide a cleaner API.
 */

import { FosExpression } from '@fosforescent/shared/dag-implementation/expression';
import { FosStore } from '@fosforescent/shared/dag-implementation/store';
import { FosPath, FosNodeContent } from '@fosforescent/shared/types';
import { getUuidByPath } from './ui-state';

// ============================================================================
// Navigation - These help find adjacent nodes for focus movement
// ============================================================================

/**
 * Compare expressions for identity.
 *
 * After mutations like setDescription(), the instruction CID may change
 * (e.g., from the original instruction to "updateAction" primitive).
 * UUIDs provide stable identity because they're assigned at render time
 * and map to the logical position in the tree.
 *
 * Strategy:
 * 1. If both have UUIDs, compare by UUID (stable across mutations)
 * 2. Fall back to path comparison
 *
 * NOTE: If `a` has been mutated, its route may have changed and UUID lookup
 * will fail. In that case, caller should provide `aUuid` explicitly.
 */
export const exprEqual = (a: FosExpression, b: FosExpression, aUuid?: string): boolean => {
  const uuidA = aUuid || getUuidByPath(a.route);
  const uuidB = getUuidByPath(b.route);

  // If both have UUIDs, compare by UUID
  if (uuidA && uuidB) {
    return uuidA === uuidB;
  }

  // Fallback to path comparison (for nodes not yet rendered)
  return pathEqual(a.route, b.route);
};

/**
 * Get UUID from a DOM element by traversing up to find the row.
 * The row has data-uuid attribute set at render time.
 */
export const getUuidFromElement = (element: HTMLElement | null): string | undefined => {
  let current = element;
  while (current) {
    if (current.dataset?.uuid) {
      return current.dataset.uuid;
    }
    current = current.parentElement;
  }
  return undefined;
};

/**
 * Get the node visually above this one (previous sibling's last descendent, or parent)
 * Uses UUID comparison to handle mutated expressions correctly.
 *
 * @param expr - The expression to find the up node for
 * @param selfUuid - Optional UUID for `expr` (use when expr has been mutated and its route changed)
 */
export const getUpNode = (expr: FosExpression, selfUuid?: string): FosExpression | null => {
  if (!expr.hasParent()) return null;

  const parent = expr.getParent();
  const siblings = parent.getTargetChildren();
  // Use UUID comparison when available
  const myIndex = siblings.findIndex(s => exprEqual(s, expr, selfUuid));

  if (myIndex > 0) {
    // Get previous sibling's last descendent
    const prevSibling = siblings[myIndex - 1];
    return getLastDescendent(prevSibling);
  } else {
    // No previous sibling, go to parent
    return parent;
  }
};

/**
 * Get the node visually below this one (first child, or next sibling, or parent's next sibling)
 * Uses UUID comparison to handle mutated expressions correctly.
 *
 * @param expr - The expression to find the down node for
 * @param skipChildren - Whether to skip children and go directly to sibling
 * @param selfUuid - Optional UUID for `expr` (use when expr has been mutated and its route changed)
 */
export const getDownNode = (expr: FosExpression, skipChildren = false, selfUuid?: string): FosExpression | null => {
  const children = expr.getTargetChildren();

  // First child (if not skipping and has children)
  if (!skipChildren && children.length > 0) {
    return children[0];
  }

  // Next sibling
  if (!expr.hasParent()) return null;

  const parent = expr.getParent();
  const siblings = parent.getTargetChildren();
  // Use UUID comparison when available
  const myIndex = siblings.findIndex(s => exprEqual(s, expr, selfUuid));

  if (myIndex !== -1 && myIndex < siblings.length - 1) {
    return siblings[myIndex + 1];
  }

  // Recurse up to find parent's next sibling (no UUID needed for parent)
  return getDownNode(parent, true);
};

/**
 * Get the last descendent of a node (deepest last child)
 */
export const getLastDescendent = (expr: FosExpression): FosExpression => {
  const children = expr.getTargetChildren();
  if (children.length === 0) return expr;
  return getLastDescendent(children[children.length - 1]);
};

/**
 * Get the previous sibling (not considering children)
 * Uses UUID comparison to handle mutated expressions correctly.
 *
 * @param expr - The expression to find the sibling for
 * @param selfUuid - Optional UUID for `expr` (use when expr has been mutated and its route changed)
 */
export const getUpSibling = (expr: FosExpression, selfUuid?: string): FosExpression | null => {
  console.log('[getUpSibling] Called, selfUuid:', selfUuid);

  if (!expr.hasParent()) {
    console.log('[getUpSibling] No parent - returning null');
    return null;
  }

  const parent = expr.getParent();
  const siblings = parent.getTargetChildren();
  console.log('[getUpSibling] Parent has', siblings.length, 'children');

  // Use UUID comparison when available - handles mutated expressions correctly
  const myIndex = siblings.findIndex(s => exprEqual(s, expr, selfUuid));
  console.log('[getUpSibling] My index among siblings:', myIndex);

  if (myIndex === -1) {
    console.log('[getUpSibling] PROBLEM: Could not find self among siblings!');
    console.log('[getUpSibling] My instructionNode:', expr.instructionNode);
    console.log('[getUpSibling] My targetNode:', expr.targetNode);
    console.log('[getUpSibling] selfUuid was:', selfUuid);
    return null;
  }

  if (myIndex > 0) {
    console.log('[getUpSibling] Found up sibling at index', myIndex - 1);
    return siblings[myIndex - 1];
  }

  console.log('[getUpSibling] At index 0, no up sibling');
  return null;
};

/**
 * Get the next sibling (not considering children)
 * Uses UUID comparison to handle mutated expressions correctly.
 *
 * @param expr - The expression to find the sibling for
 * @param selfUuid - Optional UUID for `expr` (use when expr has been mutated and its route changed)
 */
export const getDownSibling = (expr: FosExpression, selfUuid?: string): FosExpression | null => {
  if (!expr.hasParent()) return null;

  const parent = expr.getParent();
  const siblings = parent.getTargetChildren();
  // Use UUID comparison when available
  const myIndex = siblings.findIndex(s => exprEqual(s, expr, selfUuid));

  if (myIndex !== -1 && myIndex < siblings.length - 1) {
    return siblings[myIndex + 1];
  }
  return null;
};

// ============================================================================
// Movement Operations - These use FosExpression's built-in methods
// ============================================================================

/**
 * Move node to be a child of its previous sibling (indent/Tab)
 * Implements indent directly to avoid stale reference bug in expression.moveRight()
 *
 * @param expr - The expression to indent
 * @param selfUuid - Optional UUID for `expr` (use when expr has been mutated and its route changed)
 */
export const moveRight = (expr: FosExpression, selfUuid?: string): FosExpression => {
  console.log('[TreeOps] moveRight called, expr route:', expr.route, 'selfUuid:', selfUuid);
  // Need a previous sibling to indent into
  const upSibling = getUpSibling(expr, selfUuid);
  if (!upSibling) {
    // No sibling above - can't indent
    console.log('[TreeOps] moveRight: no sibling above, cannot indent');
    return expr;
  }

  console.log('[TreeOps] moveRight: moving into sibling at route:', upSibling.route);
  try {
    // Use moveNodeIntoRoute directly and don't try to return the new expression
    // (the expression.moveRight() has a bug where it uses stale references)
    expr.moveNodeIntoRoute(upSibling.route, upSibling.getTargetChildren().length);
    console.log('[TreeOps] moveRight: success');
    return expr; // Return original - caller will re-render anyway
  } catch (e) {
    console.error('[TreeOps] moveRight failed:', e);
    return expr;
  }
};

/**
 * Move node to be a sibling of its parent (outdent/Shift+Tab)
 * Uses FosExpression.moveLeft()
 */
export const moveLeft = (expr: FosExpression): void => {
  console.log('[TreeOps] moveLeft called, expr route:', expr.route);
  // Need a parent to outdent from, and grandparent to move to
  if (!expr.hasParent()) {
    // Already at root - can't outdent
    console.log('[TreeOps] moveLeft: no parent, cannot outdent');
    return;
  }

  const parent = expr.getParent();
  if (!parent.hasParent()) {
    // Parent is root - can't outdent further
    console.log('[TreeOps] moveLeft: parent is root, cannot outdent further');
    return;
  }

  console.log('[TreeOps] moveLeft: calling expr.moveLeft()');
  try {
    expr.moveLeft();
    console.log('[TreeOps] moveLeft: success');
  } catch (e) {
    console.error('[TreeOps] moveLeft failed:', e);
  }
};

/**
 * Swap with previous sibling (move node up in the list)
 * Uses FosExpression.moveUp()
 */
export const moveUp = (expr: FosExpression): void => {
  try {
    expr.moveUp();
  } catch (e) {
    console.warn('[TreeOps] moveUp failed:', e);
  }
};

/**
 * Swap with next sibling (move node down in the list)
 * Uses FosExpression.moveDown()
 */
export const moveDown = (expr: FosExpression): void => {
  try {
    expr.moveDown();
  } catch (e) {
    console.warn('[TreeOps] moveDown failed:', e);
  }
};

// ============================================================================
// Editing Operations
// ============================================================================

/**
 * Add a sibling below the current node
 * Implements this directly because expression.addDownSibling() has a bug
 * If at root level (no parent), adds a child instead
 *
 * @param expr - The expression to add a sibling below
 * @param selfUuid - Optional UUID for `expr` (use when expr has been mutated and its route changed)
 */
export const addSiblingBelow = async (expr: FosExpression, selfUuid?: string): Promise<FosExpression> => {
  if (!expr.hasParent()) {
    // Root node - add as child instead
    return expr.addChild(
      expr.instructionNode,
      { data: { description: { content: '' } }, children: [] }
    );
  }

  // Get parent and current index using UUID comparison when available
  const parent = expr.getParent();
  const siblings = parent.getTargetChildren();
  const myIndex = siblings.findIndex(s => exprEqual(s, expr, selfUuid));

  // Add new child to parent at index after current node
  const newSibling = await parent.addChild(
    expr.instructionNode,
    { data: { description: { content: '' } }, children: [] },
    myIndex + 1
  );

  // Set focus on the new sibling
  await newSibling.updateFocus(0);

  return newSibling;
};

/**
 * Add a child to the current node
 * Uses FosExpression.addChild()
 */
export const addChild = async (
  expr: FosExpression,
  description = ''
): Promise<FosExpression> => {
  const newContent: FosNodeContent = {
    data: { description: { content: description } },
    children: []
  };
  return expr.addChild(expr.instructionNode, newContent);
};

/**
 * Add a child to the current node using addRowAsChild pattern
 */
export const addRowAsChild = async (expr: FosExpression): Promise<void> => {
  return expr.addRowAsChild();
};

/**
 * Snip: Remove node but keep its children (promote them to siblings)
 * Uses FosExpression.snipNodeTarget()
 */
export const snip = (expr: FosExpression): void => {
  expr.snipNodeTarget();
};

/**
 * Delete node and all its children
 * Uses FosExpression.removeNode()
 */
export const deleteNode = async (expr: FosExpression): Promise<void> => {
  return expr.removeNode();
};

// ============================================================================
// Focus Operations - These use FosExpression's built-in focus methods
// ============================================================================

/**
 * Move focus to the node above
 */
export const moveFocusUp = (expr: FosExpression): void => {
  expr.moveFocusUp();
};

/**
 * Move focus to the node below
 */
export const moveFocusDown = (expr: FosExpression): void => {
  expr.moveFocusDown();
};

/**
 * Update focus position within the current node
 */
export const updateFocus = (expr: FosExpression, char: number): void => {
  expr.updateFocus(char);
};

/**
 * Get current focus character position
 */
export const getFocusChar = (expr: FosExpression): number | null => {
  return expr.focusChar();
};

// ============================================================================
// Collapse Operations
// ============================================================================

/**
 * Toggle collapse state of the node
 */
export const toggleCollapse = (expr: FosExpression): void => {
  expr.toggleCollapse();
};

/**
 * Check if node is collapsed
 */
export const isCollapsed = (expr: FosExpression): boolean => {
  return expr.isCollapsed();
};

// ============================================================================
// Path Utilities
// ============================================================================

export const pathEqual = (a: FosPath, b: FosPath): boolean => {
  if (a.length !== b.length) return false;
  return a.every((elem, i) => elem[0] === b[i][0] && elem[1] === b[i][1]);
};

export const isAncestor = (ancestor: FosPath, descendant: FosPath): boolean => {
  if (ancestor.length >= descendant.length) return false;
  return ancestor.every((elem, i) => elem[0] === descendant[i][0] && elem[1] === descendant[i][1]);
};

export const pathToKey = (path: FosPath): string =>
  path.map(([a, b]) => `${a}:${b}`).join('/');

// ============================================================================
// Tree State (for UI state not stored in FosExpression)
// ============================================================================

export type TreeState = {
  focusPath: FosPath | null;
  focusChar: number;
  zoomPath: FosPath;
  draggingPath: FosPath | null;
  dragOverPath: FosPath | null;
};

export const createTreeState = (): TreeState => ({
  focusPath: null,
  focusChar: 0,
  zoomPath: [],
  draggingPath: null,
  dragOverPath: null,
});

export const setFocus = (state: TreeState, path: FosPath | null, char = 0): TreeState => ({
  ...state,
  focusPath: path,
  focusChar: char,
});

export const hasFocus = (state: TreeState, path: FosPath): boolean =>
  state.focusPath !== null && pathEqual(state.focusPath, path);
