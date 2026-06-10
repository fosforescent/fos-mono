/**
 * Vanilla TypeScript UI Renderer
 *
 * Functional approach: pattern match on graph nodes to determine display.
 * No React, no virtual DOM - direct DOM manipulation from the graph.
 */

import { FosExpression } from '@fosforescent/shared/dag-implementation/expression';
import { FosStore } from '@fosforescent/shared/dag-implementation/store';
import { FosNode } from '@fosforescent/shared/dag-implementation/node';
import { FosPath, FosContextData, FosNodeContent } from '@fosforescent/shared/types';

// ============================================================================
// Core Types
// ============================================================================

export type RenderContext = {
  store: FosStore;
  root: HTMLElement;
  path: FosPath;
  depth: number;
  onUpdate: (newData: FosContextData) => void;
};

export type NodeRenderer = (expr: FosExpression, ctx: RenderContext) => HTMLElement;

// ============================================================================
// Element Helpers (minimal DOM utilities)
// ============================================================================

export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | EventListener> = {},
  children: (HTMLElement | string)[] = []
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (typeof value === 'string') {
      element.setAttribute(key, value);
    }
  }

  for (const child of children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  }

  return element;
};

export const div = (attrs: Record<string, string | EventListener> = {}, children: (HTMLElement | string)[] = []) =>
  el('div', attrs, children);

export const span = (attrs: Record<string, string | EventListener> = {}, children: (HTMLElement | string)[] = []) =>
  el('span', attrs, children);

export const input = (attrs: Record<string, string | EventListener> = {}) =>
  el('input', attrs);

export const button = (attrs: Record<string, string | EventListener> = {}, children: (HTMLElement | string)[] = []) =>
  el('button', attrs, children);

// Helper to create node content
export const createNodeContent = (description: string): FosNodeContent => ({
  data: {
    description: { content: description }
  },
  children: []
});

// ============================================================================
// Pattern Matching on Node Types
// ============================================================================

type NodePattern = {
  match: (expr: FosExpression) => boolean;
  render: NodeRenderer;
};

const patterns: NodePattern[] = [];

export const registerPattern = (pattern: NodePattern) => {
  patterns.push(pattern);
};

// Find the first matching pattern and render
export const renderNode: NodeRenderer = (expr, ctx) => {
  for (const pattern of patterns) {
    if (pattern.match(expr)) {
      return pattern.render(expr, ctx);
    }
  }
  // Default fallback
  return renderDefault(expr, ctx);
};

// ============================================================================
// Default Renderer
// ============================================================================

const renderDefault: NodeRenderer = (expr, ctx) => {
  const description = expr.getDescription();
  const children = expr.getTargetChildren();

  const childElements = children.map((child) =>
    renderNode(child, {
      ...ctx,
      path: child.route,
      depth: ctx.depth + 1
    })
  );

  return div(
    { class: 'fos-node', 'data-depth': String(ctx.depth) },
    [
      div({ class: 'fos-node-content' }, [
        span({ class: 'fos-node-description' }, [description || '(empty)']),
      ]),
      ...(childElements.length > 0
        ? [div({ class: 'fos-node-children' }, childElements)]
        : []
      ),
    ]
  );
};

// ============================================================================
// Built-in Patterns
// ============================================================================

// Task/Todo pattern - match everything for now
registerPattern({
  match: () => true,
  render: (expr, ctx) => {
    const description = expr.getDescription();

    const checkbox = input({
      type: 'checkbox',
      class: 'fos-checkbox',
      onChange: () => {
        ctx.onUpdate(ctx.store.exportContext(ctx.path).fosData);
      }
    });

    const textInput = input({
      type: 'text',
      class: 'fos-input',
      value: description || '',
      onInput: (e) => {
        const target = e.target as HTMLInputElement;
        expr.setDescription(target.value);
        ctx.onUpdate(ctx.store.exportContext(ctx.path).fosData);
      }
    });

    const children = expr.getTargetChildren();
    const childElements = children.map((child) =>
      renderNode(child, {
        ...ctx,
        path: child.route,
        depth: ctx.depth + 1
      })
    );

    return div(
      { class: 'fos-task', 'data-depth': String(ctx.depth) },
      [
        div({ class: 'fos-task-header' }, [
          checkbox,
          textInput,
        ]),
        ...(childElements.length > 0
          ? [div({ class: 'fos-task-children' }, childElements)]
          : []
        ),
      ]
    );
  }
});

// ============================================================================
// Main Render Function
// ============================================================================

export const render = (
  store: FosStore,
  rootElement: HTMLElement,
  onUpdate: (newData: FosContextData) => void
) => {
  const rootExpr = new FosExpression(store, []);

  const ctx: RenderContext = {
    store,
    root: rootElement,
    path: [],
    depth: 0,
    onUpdate,
  };

  // Clear and render
  rootElement.innerHTML = '';
  rootElement.appendChild(renderNode(rootExpr, ctx));
};

// ============================================================================
// Reactive Updates
// ============================================================================

export const createApp = (
  container: HTMLElement,
  initialData?: FosContextData
) => {
  let store = new FosStore(initialData ? { fosCtxData: { fosData: initialData, trellisData: { focusRoute: [], focusChar: null, collapsedList: [], rowDepth: 1, activity: 'todo', mode: 'default', view: 'Queue', dragInfo: { dragging: null, dragOverInfo: null } } } } : {});

  const update = (newData: FosContextData) => {
    render(store, container, update);
  };

  // Initial render
  render(store, container, update);

  return {
    getStore: () => store,
    update,
    setData: (data: FosContextData) => {
      store = new FosStore({ fosCtxData: { fosData: data, trellisData: store.trellisData } });
      render(store, container, update);
    }
  };
};
