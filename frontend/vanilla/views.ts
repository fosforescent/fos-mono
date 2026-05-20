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
};

// Helper to create node content with description
const createNodeContent = (description: string): FosNodeContent => ({
  data: {
    description: { content: description }
  },
  children: []
});

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
            const isDescendant = draggingPath.every((elem, i) =>
              elem[0] === crumb.path[i][0] && elem[1] === crumb.path[i][1]
            );
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
  enableDragDrop: boolean = true
): HTMLElement => {
  const description = expr.getDescription() || '';
  const children = expr.getTargetChildren();
  const hasChildren = children.length > 0;
  const collapsed = isCollapsed(expr);
  const path = expr.route;

  // Capture path and assign stable UUID at render time
  // This UUID stays mapped to this logical position even after mutations
  const uuid = getOrCreateUuid(path);

  const row = div({ class: 'fos-row' });

  // Store UUID on the row element for later lookup
  row.dataset.uuid = uuid;

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

  // Actions
  const actions = div({ class: 'fos-row-actions' });

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

const renderTreeNode = (
  expr: FosExpression,
  ctx: ViewContext,
  depth: number = 0,
  enableDragDrop: boolean = true
): HTMLElement => {
  const container = div({ class: 'fos-tree-node' });
  const collapsed = isCollapsed(expr);
  const children = expr.getTargetChildren();
  const hasChildren = children.length > 0;

  // Check if we're at max depth (0 = unlimited)
  const atMaxDepth = ctx.maxDepth > 0 && depth >= ctx.maxDepth;

  container.appendChild(renderTaskRow(expr, ctx, depth, enableDragDrop));

  // Show children if not collapsed AND (not at max depth OR children explicitly expanded)
  if (hasChildren && !collapsed && !atMaxDepth) {
    const childContainer = div({ class: 'fos-children' });
    for (const child of children) {
      childContainer.appendChild(renderTreeNode(child, ctx, depth + 1, enableDragDrop));
    }
    container.appendChild(childContainer);
  }

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

  return container;
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

  const children = zoomedExpr.getTargetChildren();

  if (children.length === 0) {
    container.appendChild(
      div({ class: 'fos-empty' }, ['Empty. Add an item below.'])
    );
  }

  // Enable drag and drop for tree view
  const enableDragDrop = !!(ctx.dragState && ctx.dragCallbacks);

  for (const child of children) {
    container.appendChild(renderTreeNode(child, ctx, 0, enableDragDrop));
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
  const children = expr.getTargetChildren();
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
    onZoom
  } = options;

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
    dragCallbacks
  };

  return { ctx, dragState };
};

// Re-export drag types for external use
export type { DragState, DragCallbacks, DropPosition } from './drag-drop';
export { createDragState } from './drag-drop';
