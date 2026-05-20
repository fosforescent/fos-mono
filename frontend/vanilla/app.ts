/**
 * Vanilla TypeScript App
 *
 * Main application entry point. Creates the app shell and manages state.
 */

import { FosStore } from '@fosforescent/shared/dag-implementation/store';
import { FosContextData, FosPath, TrellisSerializedData } from '@fosforescent/shared/types';
import { defaultTrellisData } from '@fosforescent/shared/defaults';
import { el, div, button } from './render';
import type { ViewType, DragState } from './views';
import { renderView, createViewContextWithDrag } from './views';
import { renderTree } from './expression-tree';

// ============================================================================
// App State
// ============================================================================

export type AppState = {
  store: FosStore;
  view: ViewType;
  path: FosPath;
  zoomPath: FosPath;
  maxDepth: number;
  dragState: DragState | null;
};

// ============================================================================
// App Class
// ============================================================================

export class FosApp {
  private container: HTMLElement;
  private state: AppState;
  private contentEl: HTMLElement | null = null;

  constructor(container: HTMLElement, initialData?: FosContextData) {
    this.container = container;

    const trellisData: TrellisSerializedData = defaultTrellisData;

    this.state = {
      store: new FosStore(initialData ? { fosCtxData: { fosData: initialData, trellisData } } : {}),
      view: 'tree',
      path: [],
      zoomPath: [],
      maxDepth: this.calculateDepthFromWidth(window.innerWidth),
      dragState: null,
    };

    // Listen for window resize to update depth
    window.addEventListener('resize', this.handleResize);

    this.render();
  }

  // Calculate depth based on window width
  // Each indent level is ~24px, plus we need room for content (~200px minimum)
  private calculateDepthFromWidth(width: number): number {
    const indentPx = 24;
    const contentMinWidth = 200;
    const rowPadding = 100; // checkbox, drag handle, actions, etc.

    const availableForIndent = width - contentMinWidth - rowPadding;
    const maxLevels = Math.floor(availableForIndent / indentPx);

    // Mobile (< 480px): 1 level
    // Tablet (480-768px): 2-3 levels
    // Desktop (768+): more levels
    if (width < 480) return 1;
    if (width < 768) return Math.min(maxLevels, 3);

    // Cap at reasonable max
    return Math.min(Math.max(maxLevels, 1), 10);
  }

  private handleResize = () => {
    const newDepth = this.calculateDepthFromWidth(window.innerWidth);
    if (newDepth !== this.state.maxDepth) {
      this.setState({ maxDepth: newDepth });
    }
  };

  // --------------------------------------------------------------------------
  // State Management
  // --------------------------------------------------------------------------

  private setState(updates: Partial<AppState>) {
    this.state = { ...this.state, ...updates };
    this.renderContent();
  }

  setView(view: ViewType) {
    this.setState({ view });
  }

  navigate(path: FosPath) {
    this.setState({ path, view: path.length > 0 ? 'focus' : this.state.view });
  }

  zoom(path: FosPath) {
    this.setState({ zoomPath: path });
  }

  zoomOut() {
    if (this.state.zoomPath.length > 0) {
      // Go up one level
      this.setState({ zoomPath: this.state.zoomPath.slice(0, -1) });
    }
  }

  zoomToRoot() {
    this.setState({ zoomPath: [] });
  }

  // Clean up event listeners
  destroy() {
    window.removeEventListener('resize', this.handleResize);
  }

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  getData(): FosContextData {
    return this.state.store.exportContext(this.state.path).fosData;
  }

  setData(data: FosContextData) {
    this.state.store = new FosStore({
      fosCtxData: { fosData: data, trellisData: this.state.store.trellisData }
    });
    this.renderContent();
  }

  // Save to localStorage
  save() {
    const data = this.getData();
    localStorage.setItem('fos-data', JSON.stringify(data));
  }

  // Load from localStorage
  load(): boolean {
    const stored = localStorage.getItem('fos-data');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.setData(data);
        return true;
      } catch (e) {
        console.error('Failed to load data:', e);
      }
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  private render() {
    this.container.innerHTML = '';
    this.container.className = 'fos-app';

    // Header
    const header = div({ class: 'fos-header' });

    const title = el('h1', {}, ['Fosforescent']);
    header.appendChild(title);

    // View switcher
    const viewSwitcher = div({ class: 'fos-view-switcher' });

    const views: { type: ViewType; label: string }[] = [
      { type: 'queue', label: 'Queue' },
      { type: 'tree', label: 'Tree' },
      { type: 'focus', label: 'Focus' },
    ];

    for (const v of views) {
      const btn = button(
        { class: `fos-view-button ${this.state.view === v.type ? 'active' : ''}` },
        [v.label]
      );
      btn.addEventListener('click', () => this.setView(v.type));
      viewSwitcher.appendChild(btn);
    }

    header.appendChild(viewSwitcher);
    this.container.appendChild(header);

    // Toolbar
    const toolbar = div({ class: 'fos-toolbar' });

    // Zoom out button (only shown when zoomed)
    const zoomOutBtn = button({ class: 'fos-button fos-zoom-out-btn' }, ['← Zoom Out']);
    zoomOutBtn.addEventListener('click', () => this.zoomOut());
    zoomOutBtn.style.display = this.state.zoomPath.length > 0 ? 'inline-flex' : 'none';
    toolbar.appendChild(zoomOutBtn);

    // Spacer
    toolbar.appendChild(div({ class: 'fos-toolbar-spacer' }));

    const saveBtn = button({ class: 'fos-button' }, ['Save']);
    saveBtn.addEventListener('click', () => {
      this.save();
      alert('Saved!');
    });
    toolbar.appendChild(saveBtn);

    const exportBtn = button({ class: 'fos-button' }, ['Export JSON']);
    exportBtn.addEventListener('click', () => {
      const data = JSON.stringify(this.getData(), null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fos-export.json';
      a.click();
      URL.revokeObjectURL(url);
    });
    toolbar.appendChild(exportBtn);

    this.container.appendChild(toolbar);

    // Content area
    this.contentEl = div({ class: 'fos-content' });
    this.container.appendChild(this.contentEl);
    this.renderContent();
  }

  private renderContent() {
    if (!this.contentEl) return;

    // Tree view uses web component approach
    if (this.state.view === 'tree') {
      this.contentEl.innerHTML = '';
      renderTree(this.state.store, this.contentEl, this.state.zoomPath, () => this.save());
      this.updateViewSwitcher();
      return;
    }

    const onUpdate = () => {
      this.renderContent();
      this.save();
    };

    // Save data without re-rendering (for text input changes)
    const onSave = () => {
      this.save();
    };

    const onNavigate = (path: FosPath) => this.navigate(path);
    const onZoom = (path: FosPath) => this.zoom(path);

    // Create context with drag, drop, and zoom support
    const { ctx, dragState } = createViewContextWithDrag({
      store: this.state.store,
      path: this.state.path,
      zoomPath: this.state.zoomPath,
      maxDepth: this.state.maxDepth,
      onUpdate,
      onSave,
      onNavigate,
      onZoom
    });

    // Store the drag state for persistence across renders
    this.state.dragState = dragState;

    this.contentEl.innerHTML = '';
    this.contentEl.appendChild(renderView(this.state.view, ctx));

    this.updateViewSwitcher();
  }

  private updateViewSwitcher() {
    // Update view switcher active state
    const buttons = this.container.querySelectorAll('.fos-view-button');
    const views: ViewType[] = ['queue', 'tree', 'focus'];
    buttons.forEach((btn, i) => {
      btn.classList.toggle('active', views[i] === this.state.view);
    });
  }
}

// ============================================================================
// Bootstrap
// ============================================================================

export const createFosApp = (
  selector: string | HTMLElement,
  options?: { autoLoad?: boolean }
): FosApp => {
  const container =
    typeof selector === 'string'
      ? document.querySelector<HTMLElement>(selector)
      : selector;

  if (!container) {
    throw new Error(`Container not found: ${selector}`);
  }

  const app = new FosApp(container);

  if (options?.autoLoad !== false) {
    app.load();
  }

  return app;
};

// Auto-init if this script is loaded directly
if (typeof window !== 'undefined') {
  (window as any).FosApp = FosApp;
  (window as any).createFosApp = createFosApp;
}
