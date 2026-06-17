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
import { FosNode } from '@fosforescent/shared/dag-implementation/node';
import { FosPath, FosNodeContent } from '@fosforescent/shared/types';
import { div, span, input, button, el } from './render';
import {
  createDragState,
  makeDropTarget,
  makeDragHandle,
  executeDrop,
  type DragState,
  type DragCallbacks,
  type DropPosition
} from './drag-drop';
import { pathToKey, pathEqual } from './path-utils';

// Type for elements that represent expressions
// Boolean marker - CIDs are computed from DOM content
type ExprEl = HTMLElement & {
  dataset: { fosnode: string };
};

// Module state
let store: FosStore;
let onSave: (() => void) | null = null;
let rootContainer: HTMLElement | null = null;
let rootPath: FosPath = [];

// Drag-drop state
let dragState: DragState = createDragState();
let dragCallbacks: DragCallbacks | null = null;

// Zoom callback
let onZoom: ((path: FosPath) => void) | null = null;

// Max depth for tree rendering (0 = unlimited)
let maxDepth: number = 0;

// Cached primitive CIDs (invalidated when store changes)
let cachedPrimitiveCids: {
  storeId: string | null;
  proposalFieldCid: string;
  proposedContentFieldCid: string;
  targetPointerCid: string;
  instructionPointerCid: string;
  previousVersionCid: string;
} | null = null;

// Version history cache (cleared on sync)
let versionHistoryCache: Map<string, Set<string>> = new Map();

/**
 * Structural edge types - these are metadata about the node, not content.
 * They should be exposed as data attributes, not rendered as rows.
 */
type StructuralEdges = {
  targetPointer?: string;      // CID of what this node points to
  instructionPointer?: string; // CID of the instruction/type
  previousVersion?: string;    // CID of previous version (for version history)
};

/**
 * Extract structural edges, proposals, and content from children.
 * Returns them separately:
 * - structural: alias metadata (targetPointer, instructionPointer, previousVersion)
 * - proposals: proposal edges (for branch selector, not rendered as rows)
 * - content: actual content children to render
 *
 * Filters out all "system" edges:
 * - targetPointer, instructionPointer, previousVersion (alias metadata)
 * - proposalField (branch selector)
 * - peerField, memberField (peer/membership system)
 * - proposedContentField, parentBranchField, etc. (proposal internals)
 */
const extractStructuralEdges = (
  children: FosExpression[],
  fosStore: FosStore
): { structural: StructuralEdges; content: FosExpression[]; proposals: FosExpression[] } => {
  const structural: StructuralEdges = {};
  const content: FosExpression[] = [];
  const proposals: FosExpression[] = [];

  // All structural/system edge IDs to filter out
  // Only include primitives that actually exist
  const systemEdgeIds = new Set<string>();

  const targetPointerId = fosStore.primitive.targetPointerConstructor?.getId();
  const instructionPointerId = fosStore.primitive.instructionPointerConstructor?.getId();
  const previousVersionId = fosStore.primitive.previousVersion?.getId();
  const proposalFieldId = fosStore.primitive.proposalField?.getId();
  const peerFieldId = fosStore.primitive.peerField?.getId();
  const memberFieldId = fosStore.primitive.memberField?.getId();
  const proposedContentFieldId = fosStore.primitive.proposedContentField?.getId();
  const parentBranchFieldId = fosStore.primitive.parentBranchField?.getId();
  const senderFieldId = fosStore.primitive.senderField?.getId();
  const timestampFieldId = fosStore.primitive.timestampField?.getId();
  const signatureFieldId = fosStore.primitive.signatureField?.getId();
  const proposalNameFieldId = fosStore.primitive.proposalNameField?.getId();

  // Add all defined system edge IDs
  if (targetPointerId) systemEdgeIds.add(targetPointerId);
  if (instructionPointerId) systemEdgeIds.add(instructionPointerId);
  if (previousVersionId) systemEdgeIds.add(previousVersionId);
  if (proposalFieldId) systemEdgeIds.add(proposalFieldId);
  if (peerFieldId) systemEdgeIds.add(peerFieldId);
  if (memberFieldId) systemEdgeIds.add(memberFieldId);
  if (proposedContentFieldId) systemEdgeIds.add(proposedContentFieldId);
  if (parentBranchFieldId) systemEdgeIds.add(parentBranchFieldId);
  if (senderFieldId) systemEdgeIds.add(senderFieldId);
  if (timestampFieldId) systemEdgeIds.add(timestampFieldId);
  if (signatureFieldId) systemEdgeIds.add(signatureFieldId);
  if (proposalNameFieldId) systemEdgeIds.add(proposalNameFieldId);

  for (const child of children) {
    const instrId = child.instructionNode.getId();

    if (instrId === targetPointerId) {
      structural.targetPointer = child.targetNode.getId();
    } else if (instrId === instructionPointerId) {
      structural.instructionPointer = child.targetNode.getId();
    } else if (instrId === previousVersionId) {
      structural.previousVersion = child.targetNode.getId();
    } else if (instrId === proposalFieldId) {
      // Proposals go to branch selector, not rendered as content rows
      proposals.push(child);
    } else if (!systemEdgeIds.has(instrId)) {
      // This is content (not a system edge)
      content.push(child);
    }
    // All other system edges are silently filtered out
  }

  return { structural, content, proposals };
};

/**
 * Apply structural metadata as data attributes on an element.
 */
const applyStructuralAttributes = (el: HTMLElement, structural: StructuralEdges): void => {
  if (structural.targetPointer) {
    el.setAttribute('data-target-pointer', structural.targetPointer);
  }
  if (structural.instructionPointer) {
    el.setAttribute('data-instruction-pointer', structural.instructionPointer);
  }
  if (structural.previousVersion) {
    el.setAttribute('data-previous-version', structural.previousVersion);
  }
};

/**
 * Get cached primitive CIDs. Re-caches if store has changed.
 */
const getPrimitiveCids = () => {
  const storeId = (store as any).rootNodeId || null;

  if (!cachedPrimitiveCids || cachedPrimitiveCids.storeId !== storeId) {
    cachedPrimitiveCids = {
      storeId,
      proposalFieldCid: store.primitive.proposalField.getId(),
      proposedContentFieldCid: store.primitive.proposedContentField.getId(),
      targetPointerCid: store.primitive.targetPointerConstructor.getId(),
      instructionPointerCid: store.primitive.instructionPointerConstructor.getId(),
      previousVersionCid: store.primitive.previousVersion.getId(),
    };
  }

  return cachedPrimitiveCids;
};

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
 *
 * Tracks version history: if the element has a data-original-cid attribute,
 * and the content has changed, adds a previousVersion edge pointing to the original.
 */
const parseTargetContent = (el: ExprEl): FosNodeContent => {
  // Get text from input
  const textInput = el.querySelector('.expr-input') as HTMLInputElement | null;
  const description = textInput?.value || '';

  // Get children by recursively parsing child expression elements
  const childElements = getChildExprs(el);
  const instructionCid = getInstructionCid();
  const children: [string, string][] = childElements.map(child => {
    const childContent = parseTargetContent(child);
    const childTargetCid = store.insert(childContent);
    return [instructionCid, childTargetCid];
  });

  // Check for original CID to track version history
  const originalCid = el.dataset.originalCid;
  const previousVersionCid = store.primitive.previousVersion.getId();

  // Build the base content
  const baseContent: FosNodeContent = {
    data: {
      description: { content: description }
    },
    children
  };

  // If we have an original CID, compute what the new CID would be
  // If it's different, add a previousVersion edge
  if (originalCid) {
    const testCid = store.insert(baseContent);
    if (testCid !== originalCid) {
      // Content has changed - add previousVersion edge
      return {
        ...baseContent,
        children: [[previousVersionCid, originalCid], ...children]
      };
    }
  }

  return baseContent;
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
 * CIDs are computed from DOM content.
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
 * Sync DOM to store. This is THE sync function for all DOM-first operations.
 * Clears caches and parses the entire DOM tree.
 */
const syncCurrentLevel = () => {
  if (!rootContainer) return;

  // Clear version history cache since content has changed
  versionHistoryCache.clear();

  // Parse all children from DOM
  const children = getChildExprs(rootContainer);
  const instructionCid = getInstructionCid();
  const contentEdges: [string, string][] = children.map(child => {
    const content = parseTargetContent(child);
    const targetCid = store.insert(content);
    return [instructionCid, targetCid];
  });

  console.log('[syncCurrentLevel] Parsed', contentEdges.length, 'children from DOM');
  console.log('[syncCurrentLevel] rootPath:', rootPath);

  // Check if we're viewing a branch (use cached CIDs)
  const primitiveCids = getPrimitiveCids();
  const firstEdge = rootPath[0];
  const secondEdge = rootPath[1];

  if (rootPath.length >= 2 &&
      firstEdge && secondEdge &&
      firstEdge[0] === primitiveCids.proposalFieldCid &&
      secondEdge[0] === primitiveCids.proposedContentFieldCid) {
    // Viewing a branch - sync to branch content
    console.log('[syncCurrentLevel] Syncing to branch');

    const proposalNodeCid = firstEdge[1];

    // Create new content node with DOM children
    const newContentNode = store.create({
      data: {},
      children: contentEdges
    });

    // Get the proposal node and update its proposedContent edge
    const proposalNode = store.getNodeByAddress(proposalNodeCid);
    if (!proposalNode) {
      console.error('[syncCurrentLevel] Proposal node not found');
      return;
    }

    const proposalEdges = proposalNode.getEdges();
    const newProposalEdges = proposalEdges.map(([instr, target]) => {
      if (instr === primitiveCids.proposedContentFieldCid) {
        return [instr, newContentNode.getId()] as [string, string];
      }
      return [instr, target] as [string, string];
    });

    const newProposalNode = store.create({
      data: proposalNode.getData(),
      children: newProposalEdges,
    });

    // Update the root alias to point to new proposal
    const rootExpr = new FosExpression(store, []);
    const rootEdges = rootExpr.targetNode.getEdges();
    const newRootEdges = rootEdges.map(([instr, target]) => {
      if (instr === primitiveCids.proposalFieldCid && target === proposalNodeCid) {
        return [instr, newProposalNode.getId()] as [string, string];
      }
      return [instr, target] as [string, string];
    });

    const newRootNode = store.create({
      data: rootExpr.targetNode.getData(),
      children: newRootEdges,
    });

    console.log('[syncCurrentLevel] Updated proposal:', newProposalNode.getId().slice(0, 12),
      'with content:', newContentNode.getId().slice(0, 12));

    // Update rootPath to point to new proposal and content
    rootPath = [
      [primitiveCids.proposalFieldCid, newProposalNode.getId()],
      [primitiveCids.proposedContentFieldCid, newContentNode.getId()]
    ];

    // Set new root
    (store as any).rootNodeId = newRootNode.getId();
    (store as any).updateCtxCallback?.((store as any).exportContext([]));
    return;
  }

  // Main content - original logic
  const rootExpr = new FosExpression(store, rootPath);

  if (rootExpr.isAlias()) {
    const aliasEdges = rootExpr.targetNode.getEdges();

    const instrPointerEdge = aliasEdges.find(e => e[0] === primitiveCids.instructionPointerCid);
    const instrPointer = instrPointerEdge ? instrPointerEdge[1] : instructionCid;

    const preservedEdges = aliasEdges.filter(e =>
      e[0] !== primitiveCids.targetPointerCid &&
      e[0] !== primitiveCids.instructionPointerCid &&
      e[0] !== primitiveCids.previousVersionCid
    );

    const newContentNode = store.create({
      data: {},
      children: contentEdges
    });

    const newAliasContent: FosNodeContent = {
      data: rootExpr.targetNode.getContent().data,
      children: [
        [primitiveCids.targetPointerCid, newContentNode.getId()],
        [primitiveCids.instructionPointerCid, instrPointer],
        [primitiveCids.previousVersionCid, rootExpr.targetNode.getId()],
        ...preservedEdges,
      ]
    };
    const newAliasNode = store.create(newAliasContent);

    console.log('[syncCurrentLevel] Created new alias:', newAliasNode.getId().slice(0, 12),
      'pointing to content with', contentEdges.length, 'children,',
      preservedEdges.length, 'preserved edges');

    (store as any).rootNodeId = newAliasNode.getId();
    (store as any).updateCtxCallback?.((store as any).exportContext([]));
  } else {
    const currentContent = rootExpr.targetNode.getContent();
    const newContent: FosNodeContent = {
      ...currentContent,
      children: contentEdges
    };
    const newNode = store.create(newContent);
    (store as any).rootNodeId = newNode.getId();
    (store as any).updateCtxCallback?.((store as any).exportContext([]));
  }
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

  const slot = getChildrenSlot(prev);
  if (!slot) return;

  slot.appendChild(el);
  updateDepthRecursive(el);

  syncCurrentLevel();
  triggerSave();

  focusInput(el);
};

const outdent = (el: ExprEl) => {
  const parent = getParentExpr(el);
  if (!parent) return;

  parent.after(el);
  updateDepthRecursive(el);

  syncCurrentLevel();
  triggerSave();

  focusInput(el);
};

const moveUp = (el: ExprEl) => {
  const prev = getPrevSibling(el);
  if (!prev) return;

  prev.before(el);
  syncCurrentLevel();
  triggerSave();

  focusInput(el);
};

const moveDown = (el: ExprEl) => {
  const next = getNextSibling(el);
  if (!next) return;

  next.after(el);
  syncCurrentLevel();
  triggerSave();

  focusInput(el);
};

const addSiblingBelow = (el: ExprEl) => {
  try {
    const depth = getDepth(el);
    const newEl = createExpressionElement('', depth);
    el.after(newEl);

    syncCurrentLevel();
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

  syncCurrentLevel();
  triggerSave();

  focusInput(newEl);
};

const deleteNode = (el: ExprEl) => {
  const next = getNextSibling(el) || getPrevSibling(el) || getParentExpr(el);
  const parent = getParentExpr(el);

  el.remove();

  syncCurrentLevel();
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

  syncCurrentLevel();
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
      console.log('[handleKeyDown] Tab pressed, shiftKey:', e.shiftKey);
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
  exprEl.dataset.fosnode = '';  // Boolean marker

  // New elements don't have a path yet - drag-drop won't work until synced
  renderExpressionContent(exprEl, description, depth, false, false, []);

  return exprEl;
};

// =============================================================================
// Breadcrumbs with Drop Targets
// =============================================================================

/**
 * Render breadcrumb navigation from root to current zoom path.
 * Each breadcrumb is clickable to zoom out and can be a drop target.
 */
const renderBreadcrumbs = (): HTMLElement => {
  const container = div({ class: 'expr-breadcrumbs' });

  // Build trail from root to current zoom
  const trail: { path: FosPath; label: string }[] = [];

  // Always start with Home (root)
  trail.push({ path: [], label: 'Home' });

  // Add each level of the root path
  if (rootPath.length > 0) {
    for (let i = 0; i < rootPath.length; i++) {
      const partialPath = rootPath.slice(0, i + 1);
      const expr = new FosExpression(store, partialPath);
      const label = expr.getDescription() || '(untitled)';
      trail.push({ path: partialPath, label });
    }
  }

  // Render each breadcrumb
  trail.forEach((crumb, index) => {
    const isLast = index === trail.length - 1;

    // Breadcrumb button
    const crumbBtn = button(
      {
        class: `expr-breadcrumb-item ${isLast ? 'active' : ''}`,
        'data-path': JSON.stringify(crumb.path)
      },
      [crumb.label]
    );

    // Click to zoom to this level
    crumbBtn.addEventListener('click', () => {
      if (onZoom) onZoom(crumb.path);
    });

    // Make breadcrumb a drop target if drag-drop is active
    if (dragCallbacks) {
      crumbBtn.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!e.dataTransfer) return;

        // Don't allow dropping on self or descendant
        if (dragState.dragging) {
          const draggingPath = dragState.dragging;
          if (pathEqual(draggingPath, crumb.path)) {
            e.dataTransfer.dropEffect = 'none';
            return;
          }
          // Check if crumb is descendant of dragging
          if (crumb.path.length > draggingPath.length) {
            const isDescendant = draggingPath.every((elem, i) => {
              const crumbElem = crumb.path[i];
              return crumbElem && elem[0] === crumbElem[0] && elem[1] === crumbElem[1];
            });
            if (isDescendant) {
              e.dataTransfer.dropEffect = 'none';
              return;
            }
          }
        }

        e.dataTransfer.dropEffect = 'move';
        crumbBtn.classList.add('expr-drop-target');
      });

      crumbBtn.addEventListener('dragleave', () => {
        crumbBtn.classList.remove('expr-drop-target');
      });

      crumbBtn.addEventListener('drop', (e) => {
        e.preventDefault();
        crumbBtn.classList.remove('expr-drop-target');

        if (dragState.dragging && dragCallbacks) {
          // Drop as child of this breadcrumb node
          dragCallbacks.onDrop(dragState.dragging, crumb.path, 'inside');
        }
      });
    }

    container.appendChild(crumbBtn);

    // Add separator (except after last)
    if (!isLast) {
      container.appendChild(span({ class: 'expr-breadcrumb-sep' }, ['/']));
    }
  });

  return container;
};

const renderExpressionContent = (
  el: ExprEl,
  description: string,
  depth: number,
  hasChildren: boolean,
  isCollapsed: boolean,
  path: FosPath
) => {
  // Build the row (render buffer)
  const row = div({ class: 'expr-row' });

  // Store path on the row for drag-drop
  row.dataset.fosPath = pathToKey(path);

  const handle = span({ class: 'expr-handle', title: 'Drag to reorder' }, ['⠿']);
  row.appendChild(handle);

  // Set up drag-drop if callbacks are available
  if (dragCallbacks) {
    // Row is both draggable and a drop target
    // Handle enables dragging on mousedown
    makeDropTarget(row, path, dragState, dragCallbacks);
    makeDragHandle(handle, row, path, dragState, dragCallbacks);
  }

  const indentEl = span({ class: 'expr-indent', style: `width: ${depth * 24}px` });
  row.appendChild(indentEl);

  // Only render toggle if there are children
  if (hasChildren) {
    const toggle = button({ class: 'expr-toggle' }, [isCollapsed ? '▸' : '▾']);
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCollapse(el);
    });
    row.appendChild(toggle);
  } else {
    // Spacer to maintain alignment
    row.appendChild(span({ class: 'expr-toggle-spacer' }));
  }

  const textInput = input({
    type: 'text',
    class: 'expr-input',
    value: description,
    placeholder: 'Enter description...'
  }) as HTMLInputElement;

  textInput.addEventListener('input', () => {
    // Sync DOM to store - target CID will be computed from DOM content
    syncCurrentLevel();
    triggerSave();
  });

  textInput.addEventListener('keydown', (e) => handleKeyDown(e, el));

  row.appendChild(textInput);

  const actions = div({ class: 'expr-actions' });

  // Zoom button to navigate into this node
  if (onZoom && path.length > 0) {
    const zoomBtn = button({ class: 'expr-btn-zoom', title: 'Zoom into this node' }, ['⊕']);
    zoomBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onZoom!(path);
    });
    actions.appendChild(zoomBtn);
  }

  const addBtn = button({ class: 'expr-btn-add', title: 'Add child' }, ['+']);
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
  const allChildren = expr.getTargetChildren();
  // proposals are filtered out here - they go to branch selector, not rendered as content rows
  const { structural, content: children, proposals: _proposals } = extractStructuralEdges(allChildren, store);
  const hasChildren = children.length > 0;
  const isCollapsed = expr.isCollapsed();

  // data-fosnode marks this as an expression element
  // CIDs are computed from DOM content, not stored
  // data-original-cid tracks the CID this element was rendered from (for version history)
  const el = div({
    'data-fosnode': '',
    'data-original-cid': expr.targetNode.getId()
  }) as unknown as ExprEl;

  if (isCollapsed) {
    el.setAttribute('data-collapsed', '');
  }

  // Apply structural metadata as data attributes
  applyStructuralAttributes(el, structural);

  renderExpressionContent(el, description, depth, hasChildren, isCollapsed, expr.route);

  // Check if we're at max depth (0 = unlimited)
  const atMaxDepth = maxDepth > 0 && depth >= maxDepth;

  // Render children (unless collapsed or at max depth)
  const slot = el.querySelector('.expr-children')!;
  if (hasChildren && !isCollapsed && !atMaxDepth) {
    for (const child of children) {
      slot.appendChild(renderExpression(child, depth + 1));
    }
  } else if (hasChildren && !isCollapsed && atMaxDepth) {
    // At max depth with children - show "more" indicator
    const moreIndicator = div({ class: 'expr-depth-limit' });
    const zoomBtn = button({ class: 'expr-depth-zoom-btn', title: 'Zoom in to see more' }, [
      `+${children.length} more...`
    ]);
    zoomBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onZoom) onZoom(expr.route);
    });
    moreIndicator.appendChild(zoomBtn);
    slot.appendChild(moreIndicator);
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

/**
 * Render an empty input row for adding new content.
 * This row is not represented in the graph until the user types something.
 *
 * @param parentExpr - The parent expression for the new content
 * @param depth - Indentation depth
 * @param onRerender - Optional callback to trigger tree re-render after adding (ensures drag-drop paths are set)
 */
const renderAddRow = (parentExpr: FosExpression, depth: number = 0, onRerender?: () => void): HTMLElement => {
  const row = div({ class: 'expr-row expr-add-row' });

  // Indent
  if (depth > 0) {
    const indent = span({ class: 'expr-indent' });
    indent.style.width = `${depth * 24}px`;
    row.appendChild(indent);
  }

  // Empty checkbox placeholder (for visual alignment)
  const checkPlaceholder = span({ class: 'expr-check-placeholder' });
  row.appendChild(checkPlaceholder);

  // Input for new content
  const inp = input({
    class: 'expr-input expr-add-input',
    type: 'text',
    placeholder: 'Add item...'
  }) as HTMLInputElement;

  const addNewChild = async (text: string) => {
    console.log('[addNewChild] Adding via DOM:', text);

    // DOM-first approach: create element, append to DOM, then sync
    const newEl = createExpressionElement(text, depth);

    // Find the children container in rootContainer and append
    if (rootContainer) {
      // Insert before the add-row
      const addRow = rootContainer.querySelector('.expr-add-row');
      if (addRow) {
        rootContainer.insertBefore(newEl, addRow);
      } else {
        rootContainer.appendChild(newEl);
      }

      // Now sync the DOM to store
      syncCurrentLevel();

      console.log('[addNewChild] DOM synced, new root edges:',
        new FosExpression(store, []).targetNode.getEdges().length);
    }

    inp.value = '';
    // Trigger save
    if (onSave) onSave();

    // Re-render tree to ensure drag-drop paths are properly set
    if (onRerender) {
      onRerender();
    }
  };

  inp.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && inp.value.trim()) {
      e.preventDefault();
      await addNewChild(inp.value.trim());
    }
  });

  // Also add on blur if there's content
  inp.addEventListener('blur', async () => {
    if (inp.value.trim()) {
      await addNewChild(inp.value.trim());
    }
  });

  row.appendChild(inp);
  return row;
};

/**
 * Follow the previousVersion chain for a node to get all ancestor CIDs.
 * Returns a Set of all CIDs in the version history (including the node itself).
 * Results are cached until syncCurrentLevel() is called.
 */
const getVersionAncestors = (nodeCid: string, maxDepth = 100): Set<string> => {
  // Check cache first
  const cached = versionHistoryCache.get(nodeCid);
  if (cached) return cached;

  const ancestors = new Set<string>();
  let currentCid: string | undefined = nodeCid;
  let depth = 0;
  const { previousVersionCid } = getPrimitiveCids();

  while (currentCid && depth < maxDepth) {
    ancestors.add(currentCid);
    const node = store.getNodeByAddress(currentCid);
    if (!node) break;

    // Find previousVersion edge
    const edges = node.getEdges();
    const prevEdge = edges.find(([instr]) => instr === previousVersionCid);
    currentCid = prevEdge?.[1];
    depth++;
  }

  // Cache the result
  versionHistoryCache.set(nodeCid, ancestors);
  return ancestors;
};

/**
 * Check if two nodes share a common ancestor in their version histories.
 * Returns true if they are versions of the same logical item.
 */
const sharesVersionHistory = (cidA: string, cidB: string): boolean => {
  if (cidA === cidB) return true;

  const ancestorsA = getVersionAncestors(cidA);
  const ancestorsB = getVersionAncestors(cidB);

  // Check if any ancestor of A is in B's history (or vice versa)
  for (const ancestor of ancestorsA) {
    if (ancestorsB.has(ancestor)) return true;
  }
  return false;
};

export interface DiffContext {
  branchColor: string;
  parentColor: string;  // Color for parent branch items (main or parent branch)
  parentContentCids: Set<string>;  // CIDs of parent content items
  parentOnlyItems: Array<{ description: string; targetCid: string }>;  // Items only in parent
  /** Called when user wants to sync an item from parent */
  onSyncFromParent?: (branchItemCid: string, parentItemCid: string) => void;
}

export const renderTree = (
  fosStore: FosStore,
  container: HTMLElement,
  initialRootPath: FosPath = [],
  saveCallback?: () => void,
  diffContext?: DiffContext,
  zoomCallback?: (path: FosPath) => void,
  maxDepthOption: number = 0
) => {
  store = fosStore;
  onSave = saveCallback || null;
  onZoom = zoomCallback || null;
  maxDepth = maxDepthOption;
  rootContainer = container;
  rootPath = initialRootPath;
  container.innerHTML = '';

  // Render breadcrumbs if zoomed in
  if (rootPath.length > 0) {
    container.appendChild(renderBreadcrumbs());
  }

  // Initialize drag-drop state and callbacks
  dragState = createDragState();
  dragCallbacks = {
    onDragStart: (path: FosPath) => {
      dragState.dragging = path;
    },
    onDragEnd: () => {
      dragState.dragging = null;
      dragState.dragOver = null;
      dragState.dropPosition = null;
    },
    onDrop: (sourcePath: FosPath, targetPath: FosPath, position: DropPosition) => {
      try {
        // DOM-first approach: move DOM elements, then sync to store
        const sourceKey = pathToKey(sourcePath);
        const targetKey = pathToKey(targetPath);

        // Find the rows by their path
        const sourceRow = container.querySelector(`[data-fos-path="${sourceKey}"]`) as HTMLElement;
        const targetRow = container.querySelector(`[data-fos-path="${targetKey}"]`) as HTMLElement;

        if (!sourceRow || !targetRow) {
          console.error('[DragDrop] Could not find source or target row');
          return;
        }

        // Find the expression elements (data-fosnode) that contain these rows
        // These are what we actually need to move in the DOM
        const sourceExprEl = sourceRow.closest('[data-fosnode]') as HTMLElement;
        const targetExprEl = targetRow.closest('[data-fosnode]') as HTMLElement;

        if (!sourceExprEl || !targetExprEl) {
          console.error('[DragDrop] Could not find expression elements');
          return;
        }

        console.log('[DragDrop] DOM move:', position);

        switch (position) {
          case 'before':
            // Insert source expression element before target expression element
            targetExprEl.parentElement?.insertBefore(sourceExprEl, targetExprEl);
            break;

          case 'after':
            // Insert source expression element after target expression element
            targetExprEl.parentElement?.insertBefore(sourceExprEl, targetExprEl.nextSibling);
            break;

          case 'inside':
            // Move source expression element as child of target expression element
            // Insert before any add-row if it exists, otherwise append
            const addRow = targetExprEl.querySelector(':scope > .expr-add-row');
            if (addRow) {
              targetExprEl.insertBefore(sourceExprEl, addRow);
            } else {
              targetExprEl.appendChild(sourceExprEl);
            }
            break;
        }

        // Sync DOM to store
        syncCurrentLevel();

        // Re-render after drop to ensure paths are updated
        renderTree(fosStore, container, initialRootPath, saveCallback, diffContext, zoomCallback, maxDepthOption);

        // Trigger save
        if (onSave) onSave();
      } catch (e) {
        console.error('[DragDrop] Drop failed:', e);
      }
    }
  };

  // Re-render callback for add row - ensures drag-drop paths are properly set
  const rerender = () => {
    renderTree(fosStore, container, initialRootPath, saveCallback, diffContext, zoomCallback, maxDepthOption);
  };

  console.log('[renderTree] rootPath:', rootPath);

  // Check if path starts with a proposal edge (viewing a branch)
  // Use cached CIDs for performance
  const primitiveCids = getPrimitiveCids();
  let contentNode: FosNode | null = null;
  let isViewingBranch = false;

  const firstEdge = rootPath[0];
  const secondEdge = rootPath[1];
  if (rootPath.length >= 2 &&
      firstEdge && secondEdge &&
      firstEdge[0] === primitiveCids.proposalFieldCid &&
      secondEdge[0] === primitiveCids.proposedContentFieldCid) {
    // Path points into a branch's content
    isViewingBranch = true;
    const contentCid = secondEdge[1];
    contentNode = store.getNodeByAddress(contentCid);

    // If there are more edges after the content, navigate into them
    if (rootPath.length > 2) {
      // TODO: Handle deeper navigation within branch
      console.log('[renderTree] Deep branch navigation not yet implemented');
    }

    console.log('[renderTree] Viewing branch content:', contentCid?.slice(0, 12));
  }

  if (isViewingBranch && contentNode) {
    // Render branch content directly
    console.log('[renderTree] Branch content has', contentNode.getEdges().length, 'edges');

    // Get parent branch content for diff comparison (by version history)
    let parentContentCids: Set<string> = new Set();
    let parentOnlyItems: Array<{ description: string; targetCid: string }> = [];

    if (diffContext) {
      parentContentCids = diffContext.parentContentCids;
      parentOnlyItems = diffContext.parentOnlyItems;
    } else {
      // Build parent content CIDs from the root alias (default to main)
      const rootExpr = new FosExpression(store, []);
      let parentExpr = rootExpr;
      while (parentExpr.isAlias()) {
        parentExpr = parentExpr.followAlias();
      }
      const parentChildren = parentExpr.getTargetChildren();
      for (const child of parentChildren) {
        parentContentCids.add(child.targetNode.getId());
        parentOnlyItems.push({
          description: child.targetNode.getData()?.description?.content || '',
          targetCid: child.targetNode.getId()
        });
      }
      console.log('[renderTree] Parent branch has', parentContentCids.size, 'items');
    }

    // Build set of branch CIDs for comparing against parent
    const branchCids = new Set<string>();
    const children = contentNode.getEdgesResolved();
    for (const [, targetNode] of children) {
      branchCids.add(targetNode.getId());
    }

    // Render branch items with diff highlighting and sync icons
    for (const [instrNode, targetNode] of children) {
      const childExpr = new FosExpression(store, instrNode, targetNode, null);
      const rowEl = renderExpression(childExpr);

      // Check if this item shares version history with any parent item
      const branchItemCid = targetNode.getId();
      let matchingParentCid: string | null = null;

      for (const parentCid of parentContentCids) {
        if (sharesVersionHistory(branchItemCid, parentCid)) {
          matchingParentCid = parentCid;
          break;
        }
      }

      // Check if item differs from parent and add sync icon if so
      if (matchingParentCid && diffContext?.onSyncFromParent) {
        const isExactMatch = parentContentCids.has(branchItemCid);
        if (!isExactMatch) {
          // Modified from parent - add sync icon to pull update
          const syncBtn = button({
            class: 'expr-sync-btn',
            title: 'Sync from parent branch',
            style: `background: ${diffContext.parentColor}40; border-color: ${diffContext.parentColor}`
          }, ['\u21BB']);  // ↻ refresh symbol
          syncBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            diffContext.onSyncFromParent!(branchItemCid, matchingParentCid!);
          });
          // Find the row element and append sync button
          const exprRow = rowEl.querySelector('.expr-row');
          if (exprRow) {
            exprRow.appendChild(syncBtn);
          }
        }
      }

      container.appendChild(rowEl);
    }

    // Show "ghost" rows for items in parent but not in this branch
    const parentColor = diffContext?.parentColor || '#888888';
    for (const parentItem of parentOnlyItems) {
      // Check if any branch item shares version history with this parent item
      let hasVersionInBranch = false;
      for (const branchCid of branchCids) {
        if (sharesVersionHistory(parentItem.targetCid, branchCid)) {
          hasVersionInBranch = true;
          break;
        }
      }

      if (!hasVersionInBranch) {
        // Create a ghost row for this parent-only item
        // Uses parent branch color instead of label
        const ghostRow = div({ class: 'expr-row expr-ghost-row' });
        ghostRow.style.opacity = '0.5';
        ghostRow.style.borderLeft = `3px solid ${parentColor}`;
        ghostRow.style.paddingLeft = '5px';
        ghostRow.style.marginLeft = '-8px';
        ghostRow.style.fontStyle = 'italic';

        const textSpan = span({ class: 'expr-ghost-text' }, [
          parentItem.description
        ]);
        ghostRow.appendChild(textSpan);

        // Add sync icon to add this item from parent
        if (diffContext?.onSyncFromParent) {
          const syncBtn = button({
            class: 'expr-sync-btn expr-sync-add',
            title: 'Add from parent branch',
            style: `background: ${parentColor}40; border-color: ${parentColor}`
          }, ['+']);
          syncBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Pass empty string for branchItemCid to indicate this is a new item
            diffContext.onSyncFromParent!('', parentItem.targetCid);
          });
          ghostRow.appendChild(syncBtn);
        }

        container.appendChild(ghostRow);
      }
    }

    // Add row - syncCurrentLevel handles branch updates based on rootPath
    const dummyExpr = new FosExpression(store, []);
    container.appendChild(renderAddRow(dummyExpr, 0, rerender));
    return;
  }

  // Standard rendering for main content
  const rootExpr = new FosExpression(store, rootPath);

  console.log('[renderTree] rootExpr.isAlias():', rootExpr.isAlias());
  console.log('[renderTree] rootExpr.targetNode edges:', rootExpr.targetNode.getEdges().length);

  // Follow aliases recursively until we get to actual content
  let actualExpr = rootExpr;
  let aliasDepth = 0;
  const maxAliasDepth = 10;
  while (actualExpr.isAlias() && aliasDepth < maxAliasDepth) {
    actualExpr = actualExpr.followAlias();
    aliasDepth++;
  }
  if (aliasDepth > 0) {
    console.log('[renderTree] Followed', aliasDepth, 'alias level(s)');
  }

  console.log('[renderTree] actualExpr.targetNode edges:', actualExpr.targetNode.getEdges().length);

  // Extract content from dereferenced expression
  const contentChildren = actualExpr.getTargetChildren();
  const { structural, content: children } = extractStructuralEdges(contentChildren, store);
  console.log('[renderTree] content children:', children.length);

  // Apply structural metadata to container
  applyStructuralAttributes(container, structural);

  for (const child of children) {
    container.appendChild(renderExpression(child));
  }

  // Add empty input row for adding new content
  container.appendChild(renderAddRow(actualExpr, 0, rerender));
};

// =============================================================================
// View Types
// =============================================================================

export type ViewType = 'tree' | 'queue' | 'focus';

// =============================================================================
// Queue View - Flat list of all items
// =============================================================================

export const renderQueue = (
  fosStore: FosStore,
  container: HTMLElement,
  initialRootPath: FosPath = [],
  saveCallback?: () => void,
  zoomCallback?: (path: FosPath) => void
) => {
  store = fosStore;
  onSave = saveCallback || null;
  onZoom = zoomCallback || null;
  rootContainer = container;
  rootPath = initialRootPath;
  container.innerHTML = '';
  container.classList.add('expr-queue-container');

  // Initialize drag-drop (disabled for queue view - flat list)
  dragState = createDragState();
  dragCallbacks = null;

  const rootExpr = new FosExpression(store, rootPath);

  // Follow aliases
  let actualExpr = rootExpr;
  while (actualExpr.isAlias()) {
    actualExpr = actualExpr.followAlias();
  }

  // Get all descendants as flat list
  const allChildren = actualExpr.getTargetChildren();
  const { content: children } = extractStructuralEdges(allChildren, store);

  // Messages area (scrollable)
  const messagesArea = div({ class: 'expr-queue-messages' });

  if (children.length === 0) {
    messagesArea.appendChild(
      div({ class: 'expr-empty' }, ['No items. Start typing below.'])
    );
  }

  // Render each item as a chat bubble
  for (const child of children) {
    const rowEl = renderQueueRow(child);
    messagesArea.appendChild(rowEl);
  }

  container.appendChild(messagesArea);

  // Input area at bottom (chat-style)
  const inputArea = div({ class: 'expr-queue-input-area' });
  const chatInput = input({
    type: 'text',
    class: 'expr-queue-input',
    placeholder: 'Type a message...'
  }) as HTMLInputElement;

  const sendBtn = button({ class: 'expr-queue-send-btn' }, ['Send']);

  const doSend = async () => {
    const text = chatInput.value.trim();
    if (text) {
      await actualExpr.addChild(actualExpr.instructionNode, {
        data: { description: { content: text } },
        children: []
      });
      chatInput.value = '';
      triggerSave();
      // Re-render
      renderQueue(fosStore, container, initialRootPath, saveCallback, zoomCallback);
      // Scroll to bottom
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }
  };

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });
  sendBtn.addEventListener('click', doSend);

  inputArea.appendChild(chatInput);
  inputArea.appendChild(sendBtn);
  container.appendChild(inputArea);

  // Scroll to bottom on initial render
  requestAnimationFrame(() => {
    messagesArea.scrollTop = messagesArea.scrollHeight;
  });
};

/**
 * Render a single row for queue view (chat bubble style)
 */
const renderQueueRow = (expr: FosExpression): HTMLElement => {
  const description = expr.getDescription() || '';
  const path = expr.route;

  const bubble = div({ class: 'expr-queue-bubble' });
  bubble.dataset.fosPath = pathToKey(path);

  // Message content (editable)
  const content = div({ class: 'expr-queue-bubble-content' });
  content.textContent = description;
  content.contentEditable = 'true';
  content.setAttribute('data-placeholder', 'Empty message...');

  content.addEventListener('input', () => {
    expr.setDescription(content.textContent || '');
    triggerSave();
  });

  content.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      content.blur();
    }
  });

  bubble.appendChild(content);

  // Actions (show on hover)
  const actions = div({ class: 'expr-queue-bubble-actions' });

  // Zoom button to see this item in tree view
  if (onZoom && path.length > 0) {
    const zoomBtn = button({ class: 'expr-btn-zoom', title: 'View in tree' }, ['⊕']);
    zoomBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onZoom!(path);
    });
    actions.appendChild(zoomBtn);
  }

  const deleteBtn = button({ class: 'expr-btn-delete', title: 'Delete' }, ['×']);
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // DOM-first: remove bubble from DOM, then sync
    bubble.remove();
    syncCurrentLevel();
    triggerSave();
    // Re-render
    if (rootContainer) {
      renderQueue(store, rootContainer, rootPath, onSave || undefined, onZoom || undefined);
    }
  });
  actions.appendChild(deleteBtn);

  bubble.appendChild(actions);

  return bubble;
};

// =============================================================================
// Focus View - Single node detail view
// =============================================================================

export const renderFocus = (
  fosStore: FosStore,
  container: HTMLElement,
  initialRootPath: FosPath = [],
  saveCallback?: () => void,
  zoomCallback?: (path: FosPath) => void
) => {
  store = fosStore;
  onSave = saveCallback || null;
  onZoom = zoomCallback || null;
  rootContainer = container;
  rootPath = initialRootPath;
  container.innerHTML = '';

  // Initialize drag-drop (disabled for focus view)
  dragState = createDragState();
  dragCallbacks = null;

  // Re-render callback for add row
  const rerender = () => {
    renderFocus(fosStore, container, initialRootPath, saveCallback, zoomCallback);
  };

  const rootExpr = new FosExpression(store, rootPath);

  // Follow aliases
  let actualExpr = rootExpr;
  while (actualExpr.isAlias()) {
    actualExpr = actualExpr.followAlias();
  }

  const description = actualExpr.getDescription() || '';

  // Breadcrumb navigation
  if (rootPath.length > 0) {
    const breadcrumb = div({ class: 'expr-breadcrumb' });

    const homeBtn = button({ class: 'expr-breadcrumb-link' }, ['Home']);
    homeBtn.addEventListener('click', () => {
      if (onZoom) onZoom([]);
    });
    breadcrumb.appendChild(homeBtn);
    breadcrumb.appendChild(span({ class: 'expr-breadcrumb-sep' }, [' / ']));
    breadcrumb.appendChild(span({}, [description || '(untitled)']));

    container.appendChild(breadcrumb);
  }

  // Main content area
  const content = div({ class: 'expr-focus-content' });

  // Title input (large)
  const titleInput = input({
    type: 'text',
    class: 'expr-title-input',
    value: description,
    placeholder: 'Title...'
  }) as HTMLInputElement;

  titleInput.addEventListener('input', () => {
    actualExpr.setDescription(titleInput.value);
    triggerSave();
  });

  content.appendChild(titleInput);

  // Notes textarea (placeholder for future implementation)
  const notesArea = el('textarea', {
    class: 'expr-notes-area',
    placeholder: 'Add notes... (not yet persisted)'
  }) as HTMLTextAreaElement;

  content.appendChild(notesArea);
  container.appendChild(content);

  // Children section
  const allChildren = actualExpr.getTargetChildren();
  const { content: children } = extractStructuralEdges(allChildren, store);

  if (children.length > 0) {
    const childSection = div({ class: 'expr-children-section' });
    childSection.appendChild(el('h3', {}, ['Children']));

    for (const child of children) {
      const rowEl = renderFocusChildRow(child);
      childSection.appendChild(rowEl);
    }

    container.appendChild(childSection);
  }

  // Add child input
  container.appendChild(renderAddRow(actualExpr, 0, rerender));
};

/**
 * Render a child row for focus view
 */
const renderFocusChildRow = (expr: FosExpression): HTMLElement => {
  const description = expr.getDescription() || '';
  const path = expr.route;

  const row = div({ class: 'expr-row expr-focus-child-row' });
  row.dataset.fosPath = pathToKey(path);

  const textInput = input({
    type: 'text',
    class: 'expr-input',
    value: description,
    placeholder: 'Enter description...'
  }) as HTMLInputElement;

  textInput.addEventListener('input', () => {
    expr.setDescription(textInput.value);
    triggerSave();
  });

  row.appendChild(textInput);

  const actions = div({ class: 'expr-actions' });

  // Zoom into this child
  if (onZoom && path.length > 0) {
    const zoomBtn = button({ class: 'expr-btn-zoom', title: 'Focus on this item' }, ['⊕']);
    zoomBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onZoom!(path);
    });
    actions.appendChild(zoomBtn);
  }

  const deleteBtn = button({ class: 'expr-btn-delete', title: 'Delete' }, ['×']);
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // DOM-first: remove row from DOM, then sync and re-render
    row.remove();
    syncCurrentLevel();
    triggerSave();
    // Re-render
    if (rootContainer) {
      renderFocus(store, rootContainer, rootPath, onSave || undefined, onZoom || undefined);
    }
  });
  actions.appendChild(deleteBtn);

  row.appendChild(actions);

  // Double-click to zoom
  row.addEventListener('dblclick', () => {
    if (onZoom) onZoom(path);
  });

  return row;
};

// =============================================================================
// View Dispatcher
// =============================================================================

export const renderView = (
  viewType: ViewType,
  fosStore: FosStore,
  container: HTMLElement,
  initialRootPath: FosPath = [],
  saveCallback?: () => void,
  diffContext?: DiffContext,
  zoomCallback?: (path: FosPath) => void,
  maxDepthOption: number = 0
) => {
  switch (viewType) {
    case 'queue':
      renderQueue(fosStore, container, initialRootPath, saveCallback, zoomCallback);
      break;
    case 'focus':
      renderFocus(fosStore, container, initialRootPath, saveCallback, zoomCallback);
      break;
    case 'tree':
    default:
      renderTree(fosStore, container, initialRootPath, saveCallback, diffContext, zoomCallback, maxDepthOption);
      break;
  }
};
