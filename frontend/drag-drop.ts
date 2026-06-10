/**
 * Drag and Drop
 *
 * HTML5 Drag and Drop implementation for tree node reordering.
 * Supports:
 * - Reordering siblings (drop above/below)
 * - Reparenting (drop as child)
 * - Visual feedback during drag
 */

import { FosExpression } from '@fosforescent/shared/dag-implementation/expression';
import { FosStore } from '@fosforescent/shared/dag-implementation/store';
import { FosPath } from '@fosforescent/shared/types';
import { pathEqual, pathToKey } from './tree-ops';

// ============================================================================
// Types
// ============================================================================

export type DropPosition = 'before' | 'after' | 'inside';

export type DragState = {
  dragging: FosPath | null;
  dragOver: FosPath | null;
  dropPosition: DropPosition | null;
};

export type DragCallbacks = {
  onDragStart: (path: FosPath) => void;
  onDragEnd: () => void;
  onDrop: (sourcePath: FosPath, targetPath: FosPath, position: DropPosition) => void;
};

// ============================================================================
// State Management
// ============================================================================

export const createDragState = (): DragState => ({
  dragging: null,
  dragOver: null,
  dropPosition: null,
});

// ============================================================================
// Drop Position Detection
// ============================================================================

/**
 * Determine drop position based on mouse Y position within element
 */
const getDropPosition = (event: DragEvent, element: HTMLElement): DropPosition => {
  const rect = element.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const height = rect.height;

  // Top 25% = before, bottom 25% = after, middle 50% = inside
  if (y < height * 0.25) {
    return 'before';
  } else if (y > height * 0.75) {
    return 'after';
  } else {
    return 'inside';
  }
};

// ============================================================================
// Make Element Draggable
// ============================================================================

export const makeDraggable = (
  element: HTMLElement,
  path: FosPath,
  state: DragState,
  callbacks: DragCallbacks
): (() => void) => {
  element.draggable = true;
  element.dataset.fosPath = pathToKey(path);

  const handleDragStart = (e: DragEvent) => {
    if (!e.dataTransfer) return;

    // Set drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', pathToKey(path));

    // Update state
    state.dragging = path;
    callbacks.onDragStart(path);

    // Add dragging class
    element.classList.add('fos-dragging');

    // Create custom drag image (optional)
    const dragImage = element.cloneNode(true) as HTMLElement;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.opacity = '0.8';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragEnd = () => {
    state.dragging = null;
    state.dragOver = null;
    state.dropPosition = null;
    callbacks.onDragEnd();
    element.classList.remove('fos-dragging');

    // Remove all drag-over classes
    document.querySelectorAll('.fos-drag-over, .fos-drop-before, .fos-drop-after, .fos-drop-inside')
      .forEach(el => {
        el.classList.remove('fos-drag-over', 'fos-drop-before', 'fos-drop-after', 'fos-drop-inside');
      });
  };

  element.addEventListener('dragstart', handleDragStart);
  element.addEventListener('dragend', handleDragEnd);

  // Return cleanup function
  return () => {
    element.removeEventListener('dragstart', handleDragStart);
    element.removeEventListener('dragend', handleDragEnd);
  };
};

// ============================================================================
// Make Element a Drop Target
// ============================================================================

export const makeDropTarget = (
  element: HTMLElement,
  path: FosPath,
  state: DragState,
  callbacks: DragCallbacks
): (() => void) => {
  element.dataset.fosDropTarget = pathToKey(path);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer) return;

    // Don't allow dropping on self
    if (state.dragging && pathEqual(state.dragging, path)) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    // Don't allow dropping on descendant
    if (state.dragging && isDescendant(path, state.dragging)) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    e.dataTransfer.dropEffect = 'move';

    // Update drop position
    const position = getDropPosition(e, element);
    state.dragOver = path;
    state.dropPosition = position;

    // Update visual feedback
    element.classList.add('fos-drag-over');
    element.classList.remove('fos-drop-before', 'fos-drop-after', 'fos-drop-inside');
    element.classList.add(`fos-drop-${position}`);
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: DragEvent) => {
    // Only remove if actually leaving the element (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!element.contains(relatedTarget)) {
      element.classList.remove('fos-drag-over', 'fos-drop-before', 'fos-drop-after', 'fos-drop-inside');
      if (state.dragOver && pathEqual(state.dragOver, path)) {
        state.dragOver = null;
        state.dropPosition = null;
      }
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    element.classList.remove('fos-drag-over', 'fos-drop-before', 'fos-drop-after', 'fos-drop-inside');

    if (!state.dragging || !state.dropPosition) return;

    // Don't drop on self
    if (pathEqual(state.dragging, path)) return;

    // Don't drop on descendant
    if (isDescendant(path, state.dragging)) return;

    callbacks.onDrop(state.dragging, path, state.dropPosition);
  };

  element.addEventListener('dragover', handleDragOver);
  element.addEventListener('dragenter', handleDragEnter);
  element.addEventListener('dragleave', handleDragLeave);
  element.addEventListener('drop', handleDrop);

  // Return cleanup function
  return () => {
    element.removeEventListener('dragover', handleDragOver);
    element.removeEventListener('dragenter', handleDragEnter);
    element.removeEventListener('dragleave', handleDragLeave);
    element.removeEventListener('drop', handleDrop);
  };
};

// ============================================================================
// Helper: Check if path is descendant of another
// ============================================================================

const isDescendant = (possibleDescendant: FosPath, possibleAncestor: FosPath): boolean => {
  if (possibleDescendant.length <= possibleAncestor.length) return false;
  return possibleAncestor.every((elem, i) =>
    elem[0] === possibleDescendant[i][0] && elem[1] === possibleDescendant[i][1]
  );
};

// ============================================================================
// Execute Drop Operation
// ============================================================================

export const executeDrop = async (
  store: FosStore,
  sourcePath: FosPath,
  targetPath: FosPath,
  position: DropPosition
): Promise<void> => {
  const sourceExpr = new FosExpression(store, sourcePath);
  const targetExpr = new FosExpression(store, targetPath);

  switch (position) {
    case 'before':
      // Move source above target
      sourceExpr.moveNodeAboveRoute(targetPath);
      break;

    case 'after':
      // Move source below target
      sourceExpr.moveNodeBelowRoute(targetPath);
      break;

    case 'inside':
      // Move source as child of target
      sourceExpr.moveNodeIntoRoute(targetPath, -1); // -1 = append
      break;
  }
};

// ============================================================================
// Combined: Make Element Both Draggable and Drop Target
// ============================================================================

export const makeDraggableDropTarget = (
  element: HTMLElement,
  path: FosPath,
  state: DragState,
  callbacks: DragCallbacks
): (() => void) => {
  const cleanupDraggable = makeDraggable(element, path, state, callbacks);
  const cleanupDropTarget = makeDropTarget(element, path, state, callbacks);

  return () => {
    cleanupDraggable();
    cleanupDropTarget();
  };
};

// ============================================================================
// Drag Handle (for grabbing a specific part of the element)
// ============================================================================

export const makeDragHandle = (
  handle: HTMLElement,
  draggableElement: HTMLElement
): void => {
  // Prevent dragging from the handle itself starting drag on parent
  draggableElement.draggable = false;

  handle.addEventListener('mousedown', () => {
    draggableElement.draggable = true;
  });

  handle.addEventListener('mouseup', () => {
    // Keep draggable for a moment in case drag started
    setTimeout(() => {
      if (!draggableElement.classList.contains('fos-dragging')) {
        draggableElement.draggable = false;
      }
    }, 100);
  });

  // Also handle touch
  handle.addEventListener('touchstart', () => {
    draggableElement.draggable = true;
  });
};
