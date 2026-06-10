/**
 * View Renderers
 *
 * Different ways to render the graph:
 * - Queue: Flat list of actionable items
 * - Tree: Hierarchical nested view
 * - Focus: Single node with context
 */

import { FosExpression } from '@fosforescent/shared/dag-implementation/expression';
import { FosStore } from '@fosforescent/shared/dag-implementation/store';
import { FosContextData, FosPath, FosNodeContent } from '@fosforescent/shared/types';
import { el, div, span, input, button } from './render';
import { attachKeyboardHandlers } from './keyboard';
import { isCollapsed, toggleCollapse, addChild, pathEqual } from './tree-ops';
import type { DragState, DragCallbacks, DropPosition } from './drag-drop';
import { createDragState, makeDraggableDropTarget, makeDragHandle } from './drag-drop';
import { getOrCreateUuid } from './ui-state';
import { createProposalManager, type Proposal, type ProposalManager, PROPOSAL_COLORS } from '@fosforescent/shared/dag-implementation/proposal';
import { getEffectiveMembers } from '@fosforescent/shared/dag-implementation/membership';
import {
  renderProposalBorders,
  renderProposalSelector,
  applyAncestorTrail,
  renderMembersIndicator,
  renderProposeButton,
  type ProposalUICallbacks,
} from './proposal-ui';

export type ViewType = 'queue' | 'tree' | 'focus';

export type ViewContext = {
  store: FosStore;
  path: FosPath;               // Root path (usually [])
  zoomPath: FosPath;           // Currently zoomed-to path
  maxDepth: number;            // Max visible depth (0 = unlimited)
  onUpdate: () => void;        // Re-render the view (structural changes)
  onSave: () => void;          // Save data without re-rendering (text edits)
  onNavigate: (path: FosPath) => void;
  onZoom: (path: FosPath) => void;
  dragState: DragState;
  dragCallbacks: DragCallbacks;
  // Proposal/Consensus support
  proposalManager?: ProposalManager;  // Manager for graph-based proposals
  currentPeerId?: string;      // Our peer ID (public key)
  selectedProposalId?: string | null;  // Currently selected proposal for viewing
  onSelectProposal?: (proposalId: string | null) => void;
  onApproveProposal?: (proposal: Proposal) => void;
  onProposeChanges?: (expr: FosExpression, newContent: FosNodeContent) => void;
};

// Helper to create node content with description
const createNodeContent = (description: string): FosNodeContent => ({
  data: {
    description: { content: description }
  },
  children: []
});

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
 * Extract structural edges from children.
 * Returns the structural metadata and the content children separately.
 */
const extractStructuralEdges = (
  children: FosExpression[],
  store: FosStore
): { structural: StructuralEdges; content: FosExpression[] } => {
  const structural: StructuralEdges = {};
  const content: FosExpression[] = [];

  const targetPointerId = store.primitive.targetPointerConstructor.getId();
  const instructionPointerId = store.primitive.instructionPointerConstructor.getId();
  const previousVersionId = store.primitive.previousVersion.getId();

  for (const child of children) {
    const instrId = child.instructionNode.getId();

    if (instrId === targetPointerId) {
      structural.targetPointer = child.targetNode.getId();
    } else if (instrId === instructionPointerId) {
      structural.instructionPointer = child.targetNode.getId();
    } else if (instrId === previousVersionId) {
      structural.previousVersion = child.targetNode.getId();
    } else {
      // This is content, not structural metadata
      content.push(child);
    }
  }

  return { structural, content };
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
 * Get the render type for an expression based on its instruction (left side).
 */
type RenderType = 'task' | 'string' | 'document' | 'workflow' | 'generic';

const getRenderType = (expr: FosExpression, store: FosStore): RenderType => {
  const instrId = expr.instructionNode.getId();

  // Check known types
  if (instrId === store.primitive.workflowField.getId()) return 'workflow';
  if (instrId === store.primitive.documentField.getId()) return 'document';
  if (instrId === store.primitive.stringField.getId()) return 'string';

  // Default to task-like rendering for most content
  return 'task';
};

// ============================================================================
// Breadcrumb Navigation (with zoom and drop targets)
// ============================================================================

const renderBreadcrumbs = (
  ctx: ViewContext
): HTMLElement => {
  const container = div({ class: 'fos-breadcrumbs' });

  // Build the breadcrumb trail from root to current zoom
  const trail: { path: FosPath; label: string }[] = [];

  // Always start with "Home" (root)
  trail.push({ path: [], label: 'Home' });

  // Add each level of the zoom path
  if (ctx.zoomPath.length > 0) {
    for (let i = 0; i < ctx.zoomPath.length; i++) {
      const partialPath = ctx.zoomPath.slice(0, i + 1);
      const expr = new FosExpression(ctx.store, partialPath);
      const label = expr.getDescription() || '(untitled)';
      trail.push({ path: partialPath, label });
    }
  }

  // Render each breadcrumb
  trail.forEach((crumb, index) => {
    const isLast = index === trail.length - 1;
    const isZoomed = ctx.zoomPath.length > 0;

    // Breadcrumb button
    const crumbBtn = button(
      {
        class: `fos-breadcrumb-item ${isLast ? 'active' : ''}`,
        'data-path': JSON.stringify(crumb.path)
      },
      [crumb.label]
    );

    // Click to zoom to this level
    crumbBtn.addEventListener('click', () => {
      ctx.onZoom(crumb.path);
    });

    // Make breadcrumb a drop target (drop here = make child of this node)
    if (ctx.dragState && ctx.dragCallbacks) {
      crumbBtn.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!e.dataTransfer) return;

        // Don't allow dropping on self or descendant
        if (ctx.dragState.dragging) {
          const draggingPath = ctx.dragState.dragging;
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
        crumbBtn.classList.add('fos-drop-target');
      });

      crumbBtn.addEventListener('dragleave', () => {
        crumbBtn.classList.remove('fos-drop-target');
      });

      crumbBtn.addEventListener('drop', (e) => {
        e.preventDefault();
        crumbBtn.classList.remove('fos-drop-target');

        if (ctx.dragState.dragging) {
          // Drop as first child of this breadcrumb node
          ctx.dragCallbacks.onDrop(ctx.dragState.dragging, crumb.path, 'inside');
        }
      });
    }

    container.appendChild(crumbBtn);

    // Add separator (except after last)
    if (!isLast) {
      container.appendChild(span({ class: 'fos-breadcrumb-sep' }, ['/']));
    }
  });

  return container;
};

// ============================================================================
// Shared Components
// ============================================================================

const renderTaskRow = (
  expr: FosExpression,
  ctx: ViewContext,
  depth: number = 0,
  enableDragDrop: boolean = true,
  descendantProposalColors: string[] = []
): HTMLElement => {
  const description = expr.getDescription() || '';
  const allChildren = expr.getTargetChildren();
  const { structural, content: children } = extractStructuralEdges(allChildren, ctx.store);
  const hasChildren = children.length > 0;
  const collapsed = isCollapsed(expr);
  const path = expr.route;

  // Capture path and assign stable UUID at render time
  // This UUID stays mapped to this logical position even after mutations
  const uuid = getOrCreateUuid(path);

  // Get proposals and members for this node
  const proposals = ctx.proposalManager?.getProposalsForNode(expr) ?? [];
  const members = getEffectiveMembers(expr);
  const hasProposals = proposals.length > 0;

  const row = div({ class: `fos-row ${hasProposals ? 'has-proposals' : ''}` });

  // Store UUID on the row element for later lookup
  row.dataset.uuid = uuid;

  // Apply structural metadata as data attributes
  applyStructuralAttributes(row, structural);

  // Add proposal borders if this node has proposals
  if (hasProposals) {
    const borders = renderProposalBorders(proposals);
    row.appendChild(borders);
  }

  // Add ancestor trail if descendants have proposals (but this node doesn't)
  if (!hasProposals && descendantProposalColors.length > 0) {
    applyAncestorTrail(row, descendantProposalColors);
  }

  // Drag handle (grip icon)
  const dragHandle = span({ class: 'fos-drag-handle', title: 'Drag to reorder' }, ['⋮⋮']);
  row.appendChild(dragHandle);

  // Indent spacer
  if (depth > 0) {
    row.appendChild(span({ class: 'fos-indent', style: `width: ${depth * 24}px` }));
  }

  // Checkbox
  const checkbox = input({ type: 'checkbox', class: 'fos-checkbox' });
  checkbox.addEventListener('change', () => {
    // TODO: Toggle completion state
    ctx.onUpdate();
  });
  row.appendChild(checkbox);

  // Expand/collapse toggle
  if (hasChildren) {
    const toggleBtn = button(
      { class: 'fos-toggle' },
      [collapsed ? '\u25b8' : '\u25be'] // ▸ or ▾
    );
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCollapse(expr);
      ctx.onUpdate();
    });
    row.appendChild(toggleBtn);
  } else {
    row.appendChild(span({ class: 'fos-toggle-spacer' }));
  }

  // Text input with keyboard handling
  const textInput = input({
    type: 'text',
    class: 'fos-text-input',
    value: description,
    placeholder: 'Enter task...'
  }) as HTMLInputElement;

  // Handle text changes - update data but don't re-render (would lose focus)
  textInput.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    expr.setDescription(target.value);
    // Don't call ctx.onUpdate() here - it would re-render and lose focus
    ctx.onSave();
  });

  // Attach keyboard handlers (Enter, arrows, backspace, etc.)
  console.log('[Views] Attaching keyboard handlers to input');
  attachKeyboardHandlers(
    textInput,
    () => expr,
    ctx.onUpdate
  );

  // Focus handling
  textInput.addEventListener('focus', () => {
    expr.updateFocus(textInput.selectionStart || 0);
  });

  // Check if this node should have focus
  const focusChar = expr.focusChar();
  if (focusChar !== null) {
    // Schedule focus after render
    requestAnimationFrame(() => {
      textInput.focus();
      textInput.setSelectionRange(focusChar, focusChar);
    });
  }

  row.appendChild(textInput);

  // Members indicator (if this node has members defined)
  const nodeMembers = expr.targetNode.getData().members;
  if (nodeMembers && nodeMembers.peerIds.length > 0) {
    row.appendChild(renderMembersIndicator(nodeMembers.peerIds.length));
  }

  // Actions
  const actions = div({ class: 'fos-row-actions' });

  // Propose button (if we have peer context and callbacks)
  if (ctx.currentPeerId && ctx.onProposeChanges && members.length > 0) {
    const proposeBtn = renderProposeButton(() => {
      // Create a proposal with current content (user would modify first in real usage)
      const currentContent = expr.targetNode.getContent();
      ctx.onProposeChanges!(expr, currentContent);
    });
    actions.appendChild(proposeBtn);
  }

  const addBtn = button({ class: 'fos-btn-icon', title: 'Add subtask' }, ['+']);
  addBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await addChild(expr, '');
    ctx.onUpdate();
  });
  actions.appendChild(addBtn);

  const deleteBtn = button({ class: 'fos-btn-icon', title: 'Delete' }, ['\u00d7']);
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await expr.removeNode();
    ctx.onUpdate();
  });
  actions.appendChild(deleteBtn);

  row.appendChild(actions);

  // Set up drag and drop (using the drag handle for initiation)
  if (enableDragDrop && ctx.dragState && ctx.dragCallbacks) {
    makeDraggableDropTarget(row, path, ctx.dragState, ctx.dragCallbacks);
    makeDragHandle(dragHandle, row);
  }

  // Double-click to zoom into this node
  row.addEventListener('dblclick', (e) => {
    // Only zoom if double-clicking on the row itself, not on inputs/buttons
    const target = e.target as HTMLElement;
    console.log('[Views] Double-click on:', target.tagName, 'path:', path);
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') return;
    e.preventDefault();
    console.log('[Views] Zooming to path:', path);
    ctx.onZoom(path);
  });

  return row;
};

// ============================================================================
// Queue View - Flat list of items
// ============================================================================

export const renderQueueView = (ctx: ViewContext): HTMLElement => {
  const container = div({ class: 'fos-queue-view' });

  const rootExpr = new FosExpression(ctx.store, ctx.path);
  const items = rootExpr.getAllDescendentsForActivity('todo');

  if (items.length === 0) {
    container.appendChild(
      div({ class: 'fos-empty' }, ['No items. Add one below.'])
    );
  }

  for (const itemPath of items) {
    const expr = new FosExpression(ctx.store, itemPath);
    container.appendChild(renderTaskRow(expr, ctx, 0));
  }

  // Add new item input at bottom
  const addRow = div({ class: 'fos-add-row' });
  const addInput = input({
    type: 'text',
    class: 'fos-text-input',
    placeholder: 'Add new item...'
  }) as HTMLInputElement;

  addInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = addInput.value.trim();
      if (value) {
        await rootExpr.addChild(rootExpr.instructionNode, createNodeContent(value));
        addInput.value = '';
        ctx.onUpdate();
      }
    }
  });

  addRow.appendChild(addInput);
  container.appendChild(addRow);

  return container;
};

// ============================================================================
// Tree View - Hierarchical nested view with drag and drop
// ============================================================================

/**
 * Collect all proposals from an expression and its descendants.
 * Used to populate the proposal selector dropdown.
 */
const collectAllProposals = (
  expr: FosExpression,
  pm: ProposalManager | undefined,
  visited = new Set<string>()
): Proposal[] => {
  if (!pm) return [];
  const nodeId = expr.targetNode.getId();
  if (visited.has(nodeId)) return [];
  visited.add(nodeId);

  const proposals: Proposal[] = [];

  // Get proposals for this node
  const nodeProposals = pm.getProposalsForNode(expr);
  proposals.push(...nodeProposals);

  // Recurse into children
  const children = expr.getTargetChildren();
  for (const child of children) {
    const childProposals = collectAllProposals(child, pm, visited);
    proposals.push(...childProposals);
  }

  return proposals;
};

/**
 * Get a color for a sender based on their peer ID
 */
const getColorForSender = (senderPeerId: string): string => {
  // Simple hash to pick a color
  let hash = 0;
  for (let i = 0; i < senderPeerId.length; i++) {
    hash = ((hash << 5) - hash) + senderPeerId.charCodeAt(i);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % PROPOSAL_COLORS.length;
  return PROPOSAL_COLORS[index] ?? PROPOSAL_COLORS[0];
};

/**
 * Collect proposal colors from all descendants of an expression.
 * Used for the ancestor trail visual indicator.
 */
const collectDescendantProposalColors = (
  expr: FosExpression,
  pm: ProposalManager | undefined,
  visited = new Set<string>()
): string[] => {
  if (!pm) return [];
  const nodeId = expr.targetNode.getId();
  if (visited.has(nodeId)) return [];
  visited.add(nodeId);

  const colors: string[] = [];

  // Get proposals for this node - derive color from sender
  const proposals = pm.getProposalsForNode(expr);
  for (const p of proposals) {
    const color = getColorForSender(p.senderPeerId);
    if (!colors.includes(color)) {
      colors.push(color);
    }
  }

  // Recurse into children
  const children = expr.getTargetChildren();
  for (const child of children) {
    const childColors = collectDescendantProposalColors(child, pm, visited);
    for (const c of childColors) {
      if (!colors.includes(c)) {
        colors.push(c);
      }
    }
  }

  return colors;
};

const renderTreeNode = (
  expr: FosExpression,
  ctx: ViewContext,
  depth: number = 0,
  enableDragDrop: boolean = true
): { element: HTMLElement; proposalColors: string[] } => {
  const container = div({ class: 'fos-tree-node' });
  const collapsed = isCollapsed(expr);
  const allChildren = expr.getTargetChildren();
  const { structural, content: children } = extractStructuralEdges(allChildren, ctx.store);
  const hasChildren = children.length > 0;

  // Apply structural metadata as data attributes
  applyStructuralAttributes(container, structural);

  // Check if we're at max depth (0 = unlimited)
  const atMaxDepth = ctx.maxDepth > 0 && depth >= ctx.maxDepth;

  // Collect descendant proposal colors for ancestor trail
  let descendantColors: string[] = [];

  // Show children if not collapsed AND (not at max depth OR children explicitly expanded)
  if (hasChildren && !collapsed && !atMaxDepth) {
    const childContainer = div({ class: 'fos-children' });
    for (const child of children) {
      const childResult = renderTreeNode(child, ctx, depth + 1, enableDragDrop);
      childContainer.appendChild(childResult.element);
      // Collect colors from descendants
      for (const c of childResult.proposalColors) {
        if (!descendantColors.includes(c)) {
          descendantColors.push(c);
        }
      }
    }
    container.appendChild(childContainer);
  } else if (hasChildren && !collapsed && atMaxDepth) {
    // At max depth but not collapsed - collect colors from hidden descendants
    for (const child of children) {
      const childColors = collectDescendantProposalColors(child, ctx.proposalManager);
      for (const c of childColors) {
        if (!descendantColors.includes(c)) {
          descendantColors.push(c);
        }
      }
    }
  }

  // Render the row with descendant colors for ancestor trail
  const row = renderTaskRow(expr, ctx, depth, enableDragDrop, descendantColors);
  container.insertBefore(row, container.firstChild);

  // Get this node's proposal colors to pass up
  const thisNodeProposals = ctx.proposalManager?.getProposalsForNode(expr) ?? [];
  const thisNodeColors = thisNodeProposals.map(p => getColorForSender(p.senderPeerId));
  const allColors = [...thisNodeColors, ...descendantColors].filter(
    (c, i, arr) => arr.indexOf(c) === i
  );

  // If at max depth with children, show a "more" indicator
  if (hasChildren && !collapsed && atMaxDepth) {
    const moreIndicator = div({ class: 'fos-depth-limit' });
    const zoomBtn = button({ class: 'fos-zoom-btn', title: 'Double-click row to zoom in' }, [
      `+${children.length} more...`
    ]);
    zoomBtn.addEventListener('click', () => {
      ctx.onZoom(expr.route);
    });
    moreIndicator.appendChild(zoomBtn);
    container.appendChild(moreIndicator);
  }

  return { element: container, proposalColors: allColors };
};

export const renderTreeView = (ctx: ViewContext): HTMLElement => {
  const container = div({ class: 'fos-tree-view' });

  // Show breadcrumbs if zoomed in
  if (ctx.zoomPath && ctx.zoomPath.length > 0) {
    container.appendChild(renderBreadcrumbs(ctx));
  }

  // Get the zoomed root (or actual root if not zoomed)
  const zoomedExpr = ctx.zoomPath && ctx.zoomPath.length > 0
    ? new FosExpression(ctx.store, ctx.zoomPath)
    : new FosExpression(ctx.store, ctx.path);

  // Extract structural metadata and content children
  const allChildren = zoomedExpr.getTargetChildren();
  const { structural, content: children } = extractStructuralEdges(allChildren, ctx.store);

  // Apply structural metadata to container
  applyStructuralAttributes(container, structural);

  if (children.length === 0) {
    container.appendChild(
      div({ class: 'fos-empty' }, ['Empty. Add an item below.'])
    );
  }

  // Enable drag and drop for tree view
  const enableDragDrop = !!(ctx.dragState && ctx.dragCallbacks);

  for (const child of children) {
    const result = renderTreeNode(child, ctx, 0, enableDragDrop);
    container.appendChild(result.element);
  }

  // Show proposal selector if we have peer context and there are proposals
  if (ctx.currentPeerId && ctx.onSelectProposal && ctx.onApproveProposal && ctx.proposalManager) {
    // Find all proposals in the current view
    const allProposals = collectAllProposals(zoomedExpr, ctx.proposalManager);
    if (allProposals.length > 0) {
      const members = getEffectiveMembers(zoomedExpr);
      const callbacks: ProposalUICallbacks = {
        onSelectProposal: ctx.onSelectProposal,
        onApprove: ctx.onApproveProposal,
      };
      const selector = renderProposalSelector(
        allProposals,
        members,
        ctx.currentPeerId,
        ctx.selectedProposalId ?? null,
        callbacks
      );
      // Insert after breadcrumbs but before content
      if (ctx.zoomPath && ctx.zoomPath.length > 0 && container.children.length > 1) {
        const secondChild = container.children[1];
        if (secondChild) {
          container.insertBefore(selector, secondChild);
        } else {
          container.appendChild(selector);
        }
      } else {
        container.insertBefore(selector, container.firstChild);
      }
    }
  }

  // Add new item input at bottom
  const addRow = div({ class: 'fos-add-row' });
  const addInput = input({
    type: 'text',
    class: 'fos-text-input',
    placeholder: 'Add new item...'
  }) as HTMLInputElement;

  addInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = addInput.value.trim();
      if (value) {
        await zoomedExpr.addChild(zoomedExpr.instructionNode, createNodeContent(value));
        addInput.value = '';
        ctx.onUpdate();
      }
    }
  });

  addRow.appendChild(addInput);
  container.appendChild(addRow);

  return container;
};

// ============================================================================
// Focus View - Single node detail view
// ============================================================================

export const renderFocusView = (ctx: ViewContext): HTMLElement => {
  const container = div({ class: 'fos-focus-view' });

  const expr = new FosExpression(ctx.store, ctx.path);
  const description = expr.getDescription() || '';

  // Breadcrumb navigation
  if (ctx.path.length > 0) {
    const breadcrumb = div({ class: 'fos-breadcrumb' });
    const homeLink = button({ class: 'fos-breadcrumb-link' }, ['Home']);
    homeLink.addEventListener('click', () => ctx.onNavigate([]));
    breadcrumb.appendChild(homeLink);
    breadcrumb.appendChild(span({}, [' / ']));
    breadcrumb.appendChild(span({}, [description || '(untitled)']));
    container.appendChild(breadcrumb);
  }

  // Main content area
  const content = div({ class: 'fos-focus-content' });

  // Title input
  const titleInput = input({
    type: 'text',
    class: 'fos-title-input',
    value: description,
    placeholder: 'Title...'
  }) as HTMLInputElement;

  titleInput.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    expr.setDescription(target.value);
    ctx.onSave(); // Don't re-render, just save
  });

  content.appendChild(titleInput);

  // Notes/body textarea
  const notesArea = el('textarea', {
    class: 'fos-notes-area',
    placeholder: 'Add notes...'
  }) as HTMLTextAreaElement;

  notesArea.addEventListener('input', () => {
    // TODO: Store notes in node data
    ctx.onSave(); // Don't re-render, just save
  });

  content.appendChild(notesArea);
  container.appendChild(content);

  // Children as subtasks
  const allChildren = expr.getTargetChildren();
  const { content: children } = extractStructuralEdges(allChildren, ctx.store);
  if (children.length > 0) {
    const subtasks = div({ class: 'fos-subtasks' });
    subtasks.appendChild(el('h3', {}, ['Subtasks']));

    for (const child of children) {
      const row = renderTaskRow(child, ctx, 0);
      row.addEventListener('dblclick', () => {
        ctx.onNavigate(child.route);
      });
      subtasks.appendChild(row);
    }

    container.appendChild(subtasks);
  }

  // Add subtask button
  const addSubtaskRow = div({ class: 'fos-add-row' });
  const addSubtaskInput = input({
    type: 'text',
    class: 'fos-text-input',
    placeholder: 'Add subtask...'
  }) as HTMLInputElement;

  addSubtaskInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = addSubtaskInput.value.trim();
      if (value) {
        await expr.addChild(expr.instructionNode, createNodeContent(value));
        addSubtaskInput.value = '';
        ctx.onUpdate();
      }
    }
  });

  addSubtaskRow.appendChild(addSubtaskInput);
  container.appendChild(addSubtaskRow);

  return container;
};

// ============================================================================
// View Dispatcher
// ============================================================================

export const renderView = (view: ViewType, ctx: ViewContext): HTMLElement => {
  switch (view) {
    case 'queue':
      return renderQueueView(ctx);
    case 'tree':
      return renderTreeView(ctx);
    case 'focus':
      return renderFocusView(ctx);
    default:
      return renderQueueView(ctx);
  }
};

// ============================================================================
// Helper: Create ViewContext with Drag, Drop, and Zoom support
// ============================================================================

export type ViewContextOptions = {
  store: FosStore;
  path: FosPath;
  zoomPath?: FosPath;
  maxDepth?: number;
  onUpdate: () => void;
  onSave: () => void;
  onNavigate: (path: FosPath) => void;
  onZoom: (path: FosPath) => void;
  // Proposal/Consensus options
  proposalManager?: ProposalManager;
  currentPeerId?: string;
  selectedProposalId?: string | null;
  onSelectProposal?: (proposalId: string | null) => void;
  onApproveProposal?: (proposal: Proposal) => void;
  onProposeChanges?: (expr: FosExpression, newContent: FosNodeContent) => void;
};

export const createViewContextWithDrag = (
  options: ViewContextOptions
): { ctx: ViewContext; dragState: DragState } => {
  const {
    store,
    path,
    zoomPath = [],
    maxDepth = 0,
    onUpdate,
    onSave,
    onNavigate,
    onZoom,
    // Proposal options
    proposalManager: providedProposalManager,
    currentPeerId,
    selectedProposalId,
    onSelectProposal,
    onApproveProposal,
    onProposeChanges,
  } = options;

  // Use provided proposal manager or create one for this store
  const proposalManager = providedProposalManager ?? createProposalManager(store);

  const dragState = createDragState();

  const dragCallbacks: DragCallbacks = {
    onDragStart: (dragPath: FosPath) => {
      console.log('[DragDrop] Start:', dragPath);
      dragState.dragging = dragPath;
      onUpdate();
    },
    onDragEnd: () => {
      console.log('[DragDrop] End');
      dragState.dragging = null;
      dragState.dragOver = null;
      dragState.dropPosition = null;
      onUpdate();
    },
    onDrop: (sourcePath: FosPath, targetPath: FosPath, position: DropPosition) => {
      console.log('[DragDrop] Drop:', { sourcePath, targetPath, position });
      try {
        const sourceExpr = new FosExpression(store, sourcePath);

        // Execute the move based on drop position (following trellis pattern)
        switch (position) {
          case 'before':
            // Move source above target (become target's up-sibling)
            sourceExpr.moveNodeAboveRoute(targetPath);
            break;
          case 'after':
            // Move source below target (become target's down-sibling)
            sourceExpr.moveNodeBelowRoute(targetPath);
            break;
          case 'inside':
            // Move source as first child of target
            sourceExpr.moveNodeIntoRoute(targetPath, 0);
            break;
        }

        console.log('[DragDrop] Success');
        onUpdate();
      } catch (e) {
        console.error('[DragDrop] Drop failed:', e);
      }
    }
  };

  const ctx: ViewContext = {
    store,
    path,
    zoomPath,
    maxDepth,
    onUpdate,
    onSave,
    onNavigate,
    onZoom,
    dragState,
    dragCallbacks,
    // Proposal/Consensus
    proposalManager,
    currentPeerId,
    selectedProposalId,
    onSelectProposal,
    onApproveProposal,
    onProposeChanges,
  };

  return { ctx, dragState };
};

// Re-export drag types for external use
export type { DragState, DragCallbacks, DropPosition } from './drag-drop';
export { createDragState } from './drag-drop';

// Re-export proposal types and functions for external use
export type { Proposal, FieldDiff, ProposalManager } from '@fosforescent/shared/dag-implementation/proposal';
export { createProposalManager, PROPOSAL_COLORS } from '@fosforescent/shared/dag-implementation/proposal';
export { getEffectiveMembers, isMember, setMembers, addMember, removeMember } from '@fosforescent/shared/dag-implementation/membership';
