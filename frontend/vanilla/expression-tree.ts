/**
 * Expression Tree
 *
 * Uses the "render buffer" pattern:
 * - Elements with data-fosnode are expression nodes (boolean marker)
 * - Both instruction and target CIDs are DERIVED from DOM structure/content
 * - DOM position = identity; DOM content = target content
 * - Graph operations traverse through the buffer to find expression nodes
 *
 * Key concepts:
 * - Instruction: inferred from DOM structure (for now, all nodes use voidNode)
 * - Target: computed from DOM content (text, checkbox state, children)
 */

import { FosExpression } from '@fosforescent/shared/dag-implementation/expression';
import { FosStore } from '@fosforescent/shared/dag-implementation/store';
import { FosPath, FosNodeContent } from '@fosforescent/shared/types';
import { div, span, input, button } from './render';

// Type for elements that represent expressions
// Only needs the fosnode marker - CIDs are derived from DOM
type ExprEl = HTMLElement & {
  dataset: { fosnode: string };
};

// Module state
let store: FosStore;
let onSave: (() => void) | null = null;
let rootContainer: HTMLElement | null = null;
let rootPath: FosPath = [];

/**
 * Get the default instruction CID.
 * For now, all expression nodes use voidNode as instruction.
 * Future: could infer from DOM structure (data-type attribute, etc.)
 */
const getInstructionCid = (): string => {
  return store.primitive.voidNode.getId();
};

// =============================================================================
// DOM Traversal (ignores render buffer)
// =============================================================================

/**
 * Find the parent expression element.
 * Expression elements are identified by having data-fosnode.
 */
const getParentExpr = (el: HTMLElement): ExprEl | null => {
  let cur = el.parentElement;
  while (cur) {
    if (cur.dataset?.fosnode !== undefined) {
      return cur as ExprEl;
    }
    cur = cur.parentElement;
  }
  return null;
};

/**
 * Find all child expression elements (direct children in the expression tree).
 * Traverses through buffer elements to find expressions.
 */
const getChildExprs = (el: HTMLElement): ExprEl[] => {
  const results: ExprEl[] = [];
  const walk = (node: Element) => {
    for (const child of node.children) {
      const htmlChild = child as HTMLElement;
      if (htmlChild.dataset?.fosnode !== undefined) {
        results.push(htmlChild as ExprEl);
        // Don't recurse - that's a different expression's buffer
      } else {
        walk(child);
      }
    }
  };
  walk(el);
  return results;
};

const getSiblings = (el: ExprEl): ExprEl[] => {
  const parent = getParentExpr(el);
  if (!parent) {
    // Root level - find siblings in container
    const container = el.parentElement;
    if (!container) return [];
    return getChildExprs(container);
  }
  return getChildExprs(parent);
};

const getPrevSibling = (el: ExprEl): ExprEl | null => {
  const siblings = getSiblings(el);
  const idx = siblings.indexOf(el);
  return idx > 0 ? siblings[idx - 1] ?? null : null;
};

const getNextSibling = (el: ExprEl): ExprEl | null => {
  const siblings = getSiblings(el);
  const idx = siblings.indexOf(el);
  return idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] ?? null : null;
};

const getChildrenSlot = (el: ExprEl): HTMLElement | null => {
  return el.querySelector('.expr-children');
};

const getInput = (el: ExprEl): HTMLInputElement | null => {
  return el.querySelector('.expr-input');
};

const getDepth = (el: ExprEl): number => {
  let depth = 0;
  let cur = getParentExpr(el);
  while (cur) {
    depth++;
    cur = getParentExpr(cur);
  }
  return depth;
};

// =============================================================================
// Content Parsing (DOM → CID)
// =============================================================================

/**
 * Parse a DOM element to derive its target content.
 * The DOM IS the source of truth - we compute the CID from it.
 */
const parseTargetContent = (el: ExprEl): FosNodeContent => {
  // Get text from input
  const textInput = el.querySelector('.expr-input') as HTMLInputElement | null;
  const description = textInput?.value || '';

  // Get checkbox state (if present)
  const checkbox = el.querySelector('.expr-checkbox') as HTMLInputElement | null;
  const checked = checkbox?.checked || false;

  // Get children by recursively parsing child expression elements
  const childElements = getChildExprs(el);
  const instructionCid = getInstructionCid();
  const children: [string, string][] = childElements.map(child => {
    const childContent = parseTargetContent(child);
    const childTargetCid = store.insert(childContent);
    return [instructionCid, childTargetCid];
  });

  return {
    data: {
      description: { content: description },
      ...(checked ? { todo: { completed: true, time: Date.now() } } : {})
    },
    children
  };
};

/**
 * Get the target CID for an element by parsing its content.
 */
const getTargetCid = (el: ExprEl): string => {
  const content = parseTargetContent(el);
  return store.insert(content);
};

/**
 * Get the full path to an element by walking up the tree.
 * Each segment is [instruction, computed-target-cid].
 */
const getPath = (el: ExprEl): FosPath => {
  const segments: FosPath = [];
  const instructionCid = getInstructionCid();
  let cur: ExprEl | null = el;
  while (cur) {
    const targetCid = getTargetCid(cur);
    segments.unshift([instructionCid, targetCid]);
    cur = getParentExpr(cur);
  }
  return segments;
};

/**
 * Get a FosExpression for an element.
 */
const getExpression = (el: ExprEl): FosExpression => {
  return new FosExpression(store, getPath(el));
};

// =============================================================================
// Store Sync
// =============================================================================

/**
 * Sync an element and its subtree to the store.
 * Since DOM IS the content, we just parse it and insert.
 * Returns the target CID of the synced element.
 */
const syncToStore = (el: ExprEl | null): string | null => {
  if (!el) {
    // Root level - sync root children
    syncRootLevel();
    return null;
  }

  // Parse this element's content from DOM and insert into store
  // This recursively inserts all children too
  const content = parseTargetContent(el);
  const targetCid = store.insert(content);

  return targetCid;
};

/**
 * Sync root-level children to the root expression.
 */
const syncRootLevel = () => {
  if (!rootContainer) return;

  // Parse all root-level children
  const children = getChildExprs(rootContainer);
  const instructionCid = getInstructionCid();
  const edges: [string, string][] = children.map(child => {
    const content = parseTargetContent(child);
    const targetCid = store.insert(content);
    return [instructionCid, targetCid];
  });

  // Update root expression with new children
  const rootExpr = new FosExpression(store, rootPath);
  const currentContent = rootExpr.targetNode.getContent();
  rootExpr.updateTargetContent({
    ...currentContent,
    children: edges
  });
};

const triggerSave = () => {
  onSave?.();
};

// =============================================================================
// Tree Operations
// =============================================================================

const indent = (el: ExprEl) => {
  const prev = getPrevSibling(el);
  if (!prev) return;

  const oldParent = getParentExpr(el);
  const slot = getChildrenSlot(prev);
  if (!slot) return;

  slot.appendChild(el);
  updateDepthRecursive(el);

  syncToStore(prev);
  // Sync old parent (or root level if oldParent is null)
  syncToStore(oldParent);
  triggerSave();

  focusInput(el);
};

const outdent = (el: ExprEl) => {
  const parent = getParentExpr(el);
  if (!parent) return;

  const grandparent = getParentExpr(parent);
  parent.after(el);
  updateDepthRecursive(el);

  syncToStore(parent);
  // Sync grandparent (or root level if grandparent is null)
  syncToStore(grandparent);
  triggerSave();

  focusInput(el);
};

const moveUp = (el: ExprEl) => {
  const prev = getPrevSibling(el);
  if (!prev) return;

  prev.before(el);
  // Sync parent (or root level if parent is null)
  syncToStore(getParentExpr(el));
  triggerSave();

  focusInput(el);
};

const moveDown = (el: ExprEl) => {
  const next = getNextSibling(el);
  if (!next) return;

  next.after(el);
  // Sync parent (or root level if parent is null)
  syncToStore(getParentExpr(el));
  triggerSave();

  focusInput(el);
};

const addSiblingBelow = (el: ExprEl) => {
  try {
    const depth = getDepth(el);
    const newEl = createExpressionElement('', depth);
    el.after(newEl);

    const parent = getParentExpr(el);
    syncToStore(parent);
    triggerSave();

    focusInput(newEl);
  } catch (err) {
    console.error('[addSiblingBelow] Error:', err);
  }
};

const addChild = (el: ExprEl) => {
  const slot = getChildrenSlot(el);
  if (!slot) return;

  const childDepth = getDepth(el) + 1;
  const newEl = createExpressionElement('', childDepth);
  slot.appendChild(newEl);
  el.removeAttribute('data-collapsed');
  updateToggle(el);

  syncToStore(el);
  triggerSave();

  focusInput(newEl);
};

const deleteNode = (el: ExprEl) => {
  const next = getNextSibling(el) || getPrevSibling(el) || getParentExpr(el);
  const parent = getParentExpr(el);

  el.remove();

  // Sync parent (or root level if parent is null)
  syncToStore(parent);
  if (parent) {
    updateToggle(parent);
  }
  triggerSave();

  if (next) focusInput(next);
};

const snipNode = (el: ExprEl) => {
  const children = getChildExprs(el);
  const parent = getParentExpr(el);
  const prev = getPrevSibling(el);

  if (children.length === 0) {
    deleteNode(el);
    return;
  }

  // Promote children to siblings
  for (const child of children) {
    el.before(child);
    updateDepthRecursive(child);
  }
  el.remove();

  // Sync parent (or root level if parent is null)
  syncToStore(parent);
  if (parent) {
    updateToggle(parent);
  }
  triggerSave();

  const focusTarget = prev || children[0];
  if (focusTarget) focusInput(focusTarget);
};

const toggleCollapse = (el: ExprEl) => {
  const isCollapsed = el.hasAttribute('data-collapsed');
  if (isCollapsed) {
    el.removeAttribute('data-collapsed');
  } else {
    el.setAttribute('data-collapsed', '');
  }
  updateToggle(el);

  // Persist to store
  getExpression(el).toggleCollapse();
  triggerSave();
};

// =============================================================================
// Focus Navigation
// =============================================================================

const focusInput = (el: ExprEl, cursorPos?: number) => {
  const inp = getInput(el);
  if (!inp) return;
  inp.focus();
  if (cursorPos !== undefined) {
    inp.setSelectionRange(cursorPos, cursorPos);
  }
};

const focusUp = (el: ExprEl) => {
  const prev = getPrevSibling(el);
  if (prev) {
    // Go to previous sibling's deepest last descendant
    let target: ExprEl = prev;
    while (!target.hasAttribute('data-collapsed')) {
      const children = getChildExprs(target);
      if (children.length === 0) break;
      const lastChild = children[children.length - 1];
      if (lastChild) target = lastChild;
      else break;
    }
    focusInput(target);
  } else {
    const parent = getParentExpr(el);
    if (parent) focusInput(parent);
  }
};

const focusDown = (el: ExprEl) => {
  // First child if not collapsed
  if (!el.hasAttribute('data-collapsed')) {
    const children = getChildExprs(el);
    const firstChild = children[0];
    if (firstChild) {
      focusInput(firstChild);
      return;
    }
  }

  // Next sibling
  const next = getNextSibling(el);
  if (next) {
    focusInput(next);
    return;
  }

  // Walk up to find ancestor's next sibling
  let cur = getParentExpr(el);
  while (cur) {
    const curNext = getNextSibling(cur);
    if (curNext) {
      focusInput(curNext);
      return;
    }
    cur = getParentExpr(cur);
  }
};

// =============================================================================
// UI Updates
// =============================================================================

const updateDepthRecursive = (el: ExprEl) => {
  const depth = getDepth(el);
  const indentEl = el.querySelector('.expr-indent') as HTMLElement;
  if (indentEl) {
    indentEl.style.width = `${depth * 24}px`;
  }
  for (const child of getChildExprs(el)) {
    updateDepthRecursive(child);
  }
};

const updateToggle = (el: ExprEl) => {
  const toggle = el.querySelector('.expr-toggle') as HTMLElement;
  if (!toggle) return;

  const children = getChildExprs(el);
  const hasChildren = children.length > 0;
  const isCollapsed = el.hasAttribute('data-collapsed');

  toggle.textContent = hasChildren ? (isCollapsed ? '▸' : '▾') : '';
};

// =============================================================================
// Keyboard Handling
// =============================================================================

const handleKeyDown = (e: KeyboardEvent, el: ExprEl) => {
  const inp = e.target as HTMLInputElement;

  switch (e.key) {
    case 'Tab':
      e.preventDefault();
      e.stopPropagation();
      e.shiftKey ? outdent(el) : indent(el);
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (e.ctrlKey && e.altKey) {
        moveUp(el);
      } else {
        focusUp(el);
      }
      break;

    case 'ArrowDown':
      e.preventDefault();
      if (e.ctrlKey && e.altKey) {
        moveDown(el);
      } else {
        focusDown(el);
      }
      break;

    case 'Enter':
      if (!e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        addSiblingBelow(el);
      }
      break;

    case 'Backspace':
      if (inp.value === '') {
        e.preventDefault();
        e.shiftKey ? deleteNode(el) : snipNode(el);
      }
      break;

    case ' ':
      if (e.ctrlKey) {
        e.preventDefault();
        toggleCollapse(el);
      }
      break;
  }
};

// =============================================================================
// Render Buffer (DOM creation)
// =============================================================================

/**
 * Create a new expression element.
 * Both instruction and target CIDs are computed from DOM when synced.
 */
const createExpressionElement = (
  description: string,
  depth: number = 0
): ExprEl => {
  const exprEl = document.createElement('div') as unknown as ExprEl;
  exprEl.dataset.fosnode = '';  // Boolean marker - presence indicates expression node

  renderExpressionContent(exprEl, description, depth, false, false);

  return exprEl;
};

const renderExpressionContent = (
  el: ExprEl,
  description: string,
  depth: number,
  hasChildren: boolean,
  isCollapsed: boolean,
  isCompleted: boolean = false
) => {
  // Build the row (render buffer)
  const row = div({ class: 'expr-row' });

  const handle = span({ class: 'expr-handle', title: 'Drag to reorder' }, ['⋮⋮']);
  row.appendChild(handle);

  const indentEl = span({ class: 'expr-indent', style: `width: ${depth * 24}px` });
  row.appendChild(indentEl);

  const checkbox = input({ type: 'checkbox', class: 'expr-checkbox' }) as HTMLInputElement;
  checkbox.checked = isCompleted;
  checkbox.addEventListener('change', () => {
    // Checkbox state is part of target content - sync to store
    const parent = getParentExpr(el);
    syncToStore(parent);
    triggerSave();
  });
  row.appendChild(checkbox);

  const toggle = button({ class: 'expr-toggle' }, [
    hasChildren ? (isCollapsed ? '▸' : '▾') : ''
  ]);
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCollapse(el);
  });
  row.appendChild(toggle);

  const textInput = input({
    type: 'text',
    class: 'expr-input',
    value: description,
    placeholder: 'Enter task...'
  }) as HTMLInputElement;

  textInput.addEventListener('input', () => {
    // Just trigger save - target CID will be computed from DOM content
    const parent = getParentExpr(el);
    syncToStore(parent);
    triggerSave();
  });

  textInput.addEventListener('keydown', (e) => handleKeyDown(e, el));

  row.appendChild(textInput);

  const actions = div({ class: 'expr-actions' });

  const addBtn = button({ class: 'expr-btn-add', title: 'Add subtask' }, ['+']);
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    addChild(el);
  });
  actions.appendChild(addBtn);

  const deleteBtn = button({ class: 'expr-btn-delete', title: 'Delete' }, ['×']);
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteNode(el);
  });
  actions.appendChild(deleteBtn);

  row.appendChild(actions);

  // Children slot
  const childrenSlot = div({ class: 'expr-children' });

  el.appendChild(row);
  el.appendChild(childrenSlot);
};

// =============================================================================
// Public API
// =============================================================================

export const renderExpression = (expr: FosExpression, depth = 0): ExprEl => {
  const description = expr.getDescription() || '';
  const children = expr.getTargetChildren();
  const hasChildren = children.length > 0;
  const isCollapsed = expr.isCollapsed();
  const isCompleted = expr.targetNode.getContent().data.todo?.completed ?? false;

  // data-fosnode marks this as an expression element
  // Both instruction and target CIDs are derived from DOM
  const el = div({
    'data-fosnode': ''
  }) as unknown as ExprEl;

  if (isCollapsed) {
    el.setAttribute('data-collapsed', '');
  }

  renderExpressionContent(el, description, depth, hasChildren, isCollapsed, isCompleted);

  // Render children
  const slot = el.querySelector('.expr-children')!;
  for (const child of children) {
    slot.appendChild(renderExpression(child, depth + 1));
  }

  // Check if this node should have focus
  const focusChar = expr.focusChar();
  if (focusChar !== null) {
    requestAnimationFrame(() => {
      const inp = el.querySelector('.expr-input') as HTMLInputElement;
      if (inp) {
        inp.focus();
        inp.setSelectionRange(focusChar, focusChar);
      }
    });
  }

  return el;
};

export const renderTree = (
  fosStore: FosStore,
  container: HTMLElement,
  initialRootPath: FosPath = [],
  saveCallback?: () => void
) => {
  store = fosStore;
  onSave = saveCallback || null;
  rootContainer = container;
  rootPath = initialRootPath;
  container.innerHTML = '';

  const rootExpr = new FosExpression(store, rootPath);

  for (const child of rootExpr.getTargetChildren()) {
    container.appendChild(renderExpression(child));
  }
};
