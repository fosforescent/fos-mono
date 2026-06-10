/**
 * Keyboard Handling
 *
 * Handles navigation, editing, and tree manipulation shortcuts.
 * Uses FosExpression's built-in keyboard handling as reference.
 */

import { FosExpression } from '@fosforescent/shared/dag-implementation/expression';
import { FosPath } from '@fosforescent/shared/types';
import {
  TreeState,
  getUpNode,
  getDownNode,
  moveUp,
  moveDown,
  moveLeft,
  moveRight,
  addSiblingBelow,
  snip,
  deleteNode,
  setFocus,
  pathEqual,
  moveFocusUp,
  moveFocusDown,
  toggleCollapse,
  getUuidFromElement,
} from './tree-ops';

export type KeyboardAction =
  | { type: 'focus-up' }
  | { type: 'focus-down' }
  | { type: 'focus-start' }
  | { type: 'focus-end' }
  | { type: 'collapse' }
  | { type: 'move-up' }
  | { type: 'move-down' }
  | { type: 'move-left' }
  | { type: 'move-right' }
  | { type: 'add-sibling' }
  | { type: 'add-child' }
  | { type: 'delete' }
  | { type: 'snip' }
  | { type: 'none' };

/**
 * Determine the action to take based on a keyboard event.
 * This mirrors FosExpression.keyPressEvents() logic.
 */
export const getKeyboardAction = (event: KeyboardEvent): KeyboardAction => {
  const { key, ctrlKey, altKey, shiftKey, metaKey } = event;

  // Space - allow normal typing, but Ctrl+Space toggles collapse
  if (key === ' ') {
    if (ctrlKey) {
      event.preventDefault();
      return { type: 'collapse' };
    }
    return { type: 'none' };
  }

  // Enter - add sibling (unless shift for newline)
  // Don't preventDefault here - let executeKeyboardAction decide
  if (key === 'Enter') {
    if (shiftKey) {
      return { type: 'none' }; // Allow newline
    }
    return { type: 'add-sibling' };
  }

  // Arrow Up
  if (key === 'ArrowUp') {
    event.preventDefault();
    event.stopPropagation();

    if (ctrlKey && altKey) {
      return { type: 'move-up' };
    }
    if (ctrlKey) {
      return { type: 'focus-start' };
    }
    return { type: 'focus-up' };
  }

  // Arrow Down
  if (key === 'ArrowDown') {
    event.preventDefault();
    event.stopPropagation();

    if (ctrlKey && altKey) {
      return { type: 'move-down' };
    }
    if (ctrlKey) {
      return { type: 'focus-end' };
    }
    return { type: 'focus-down' };
  }

  // Arrow Left - outdent with Ctrl+Alt
  if (key === 'ArrowLeft') {
    if (ctrlKey && altKey) {
      event.preventDefault();
      return { type: 'move-left' };
    }
    return { type: 'none' };
  }

  // Arrow Right - indent with Ctrl+Alt
  if (key === 'ArrowRight') {
    if (ctrlKey && altKey) {
      event.preventDefault();
      return { type: 'move-right' };
    }
    return { type: 'none' };
  }

  // Tab - indent/outdent (must stop all propagation to prevent focus change)
  if (key === 'Tab') {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return shiftKey ? { type: 'move-left' } : { type: 'move-right' };
  }

  // Backspace on empty - snip or delete
  if (key === 'Backspace') {
    // We'll check if empty in the handler
    return shiftKey ? { type: 'delete' } : { type: 'snip' };
  }

  // Escape - could be used to clear focus or cancel
  if (key === 'Escape') {
    return { type: 'none' };
  }

  return { type: 'none' };
};

/**
 * Execute a keyboard action on a FosExpression.
 * Returns true if the action was handled (and UI should update).
 *
 * @param action - The keyboard action to execute
 * @param expr - The expression to act on
 * @param inputElement - The input element that received the keyboard event
 * @param selfUuid - UUID of the expression (from DOM), used to find siblings after mutations
 */
export const executeKeyboardAction = async (
  action: KeyboardAction,
  expr: FosExpression,
  inputElement?: HTMLInputElement | HTMLTextAreaElement,
  selfUuid?: string
): Promise<boolean> => {
  switch (action.type) {
    case 'focus-up':
      moveFocusUp(expr);
      return true;

    case 'focus-down':
      moveFocusDown(expr);
      return true;

    case 'focus-start':
      expr.moveFocusToStart();
      return true;

    case 'focus-end':
      expr.moveFocusToEnd();
      return true;

    case 'collapse':
      toggleCollapse(expr);
      return true;

    case 'move-up':
      moveUp(expr);
      return true;

    case 'move-down':
      moveDown(expr);
      return true;

    case 'move-left':
      moveLeft(expr);
      return true;

    case 'move-right':
      // Pass UUID to find sibling correctly even after mutations
      moveRight(expr, selfUuid);
      return true;

    case 'add-sibling':
      // Always add a sibling below on Enter
      // Pass UUID to find correct insertion position after mutations
      await addSiblingBelow(expr, selfUuid);
      return true;

    case 'delete':
      // Only delete if input is empty
      if (inputElement && inputElement.value.length > 0) {
        return false; // Let normal backspace work
      }
      await deleteNode(expr);
      return true;

    case 'snip':
      // Only snip if input is empty
      if (inputElement && inputElement.value.length > 0) {
        return false; // Let normal backspace work
      }
      snip(expr);
      return true;

    case 'none':
    default:
      return false;
  }
};

/**
 * Create a keyboard event handler for an input element.
 * Attaches to both keydown and keyup as needed.
 */
export const createInputKeyboardHandler = (
  getExpr: () => FosExpression,
  onUpdate: () => void
) => {
  console.log('[Keyboard] Handler created'); // Log when handler is attached
  return (event: KeyboardEvent) => {
    const expr = getExpr();
    const action = getKeyboardAction(event);

    console.log('[Keyboard] Key pressed:', event.key, 'Action:', action.type, 'Expr route length:', expr.route.length);

    if (action.type === 'none') {
      return;
    }

    const inputElement = event.target as HTMLInputElement | HTMLTextAreaElement;

    // Get UUID from the DOM element - this was captured at render time and stays
    // stable even after mutations change the expression's route
    const selfUuid = getUuidFromElement(inputElement);
    console.log('[Keyboard] Self UUID from DOM:', selfUuid);

    // For actions that will definitely be handled, prevent default synchronously
    // before any async operations
    const willHandle =
      action.type === 'add-sibling' ||
      action.type === 'focus-up' ||
      action.type === 'focus-down' ||
      action.type === 'focus-start' ||
      action.type === 'focus-end' ||
      action.type === 'collapse' ||
      action.type === 'move-up' ||
      action.type === 'move-down' ||
      action.type === 'move-left' ||
      action.type === 'move-right' ||
      // For delete/snip, only prevent if input is empty
      ((action.type === 'delete' || action.type === 'snip') && inputElement.value.length === 0);

    console.log('[Keyboard] Will handle:', willHandle);

    if (willHandle) {
      event.preventDefault();
    }

    // Execute the action (may be async), passing the UUID for sibling finding
    executeKeyboardAction(action, expr, inputElement, selfUuid)
      .then(handled => {
        console.log('[Keyboard] Handled:', handled);
        if (handled) {
          onUpdate();
        }
      })
      .catch(err => {
        console.error('[Keyboard] Action failed:', err);
      });
  };
};

/**
 * Attach keyboard handlers to an input element.
 */
export const attachKeyboardHandlers = (
  input: HTMLInputElement | HTMLTextAreaElement,
  getExpr: () => FosExpression,
  onUpdate: () => void
): (() => void) => {
  const handler = createInputKeyboardHandler(getExpr, onUpdate);

  // Use keydown in capture phase to intercept Tab before browser focus handling
  input.addEventListener('keydown', handler, { capture: true });

  // Return cleanup function
  return () => {
    input.removeEventListener('keydown', handler, { capture: true });
  };
};
