/**
 * Vanilla TypeScript App
 *
 * Main application entry point. Creates the app shell and manages state.
 */

import { FosStore } from '@fosforescent/shared/dag-implementation/store';
import { FosContextData, FosPath, TrellisSerializedData, FosNodeContent } from '@fosforescent/shared/types';
import { FosExpression } from '@fosforescent/shared/dag-implementation/expression';
import { defaultTrellisData } from '@fosforescent/shared/defaults';
import { el, div, button } from './render';
import type { ViewType, DragState } from './views';
import { renderView, createViewContextWithDrag } from './views';
import { renderTree } from './expression-tree';
import { NodePeers, renderNodePeersUI } from './peer-connection';
import { getSyncMeta, setSyncMeta, clearAllData } from './lib/offline/db';
import { createProposalManager, type Proposal } from '@fosforescent/shared/dag-implementation/proposal';
import { getEffectiveMembers } from '@fosforescent/shared/dag-implementation/membership';
import { renderBranchSelector, type BranchSelectorCallbacks } from './branch-selector';

// ============================================================================
// App State
// ============================================================================

export type AppViewType = ViewType | 'peer';

export type AppState = {
  store: FosStore;
  view: AppViewType;
  path: FosPath;
  zoomPath: FosPath;
  maxDepth: number;
  dragState: DragState | null;
  nodePeers: Map<string, NodePeers>;  // path key -> peers
  selectedBranchId: string | null;    // Currently selected proposal/branch
  currentPeerId: string;              // Our peer ID (for proposal system)
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
      nodePeers: new Map(),
      selectedBranchId: null,
      currentPeerId: this.generatePeerId(),
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

  setView(view: AppViewType) {
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

  // --------------------------------------------------------------------------
  // Branch/Proposal Management
  // --------------------------------------------------------------------------

  /** Generate or retrieve our peer ID (persisted in localStorage) */
  private generatePeerId(): string {
    const storageKey = 'fos-peer-id';
    let peerId = localStorage.getItem(storageKey);
    if (!peerId) {
      // Generate a random peer ID (in production, this would be derived from Ed25519 keypair)
      peerId = 'peer-' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      localStorage.setItem(storageKey, peerId);
    }
    return peerId;
  }

  /** Select a branch (proposal) to view/edit */
  selectBranch(branchId: string | null) {
    this.setState({ selectedBranchId: branchId });
  }

  /** Create a new branch with the given name */
  createBranch(name: string) {
    const proposalManager = createProposalManager(this.state.store);
    const expression = new FosExpression(this.state.store, this.state.zoomPath);

    // Clone current content as the initial proposed content
    const currentContent = expression.targetNode.getContent();
    const proposedContentNode = this.state.store.create(currentContent);

    // Create the proposal
    const proposal = proposalManager.createProposal(
      expression,
      proposedContentNode,
      this.state.currentPeerId,
      name
    );

    // Select the new branch
    this.setState({ selectedBranchId: proposal.node.getId() });
  }

  /** Approve the currently selected branch */
  async approveBranch(proposal: Proposal) {
    const proposalManager = createProposalManager(this.state.store);
    const expression = new FosExpression(this.state.store, this.state.zoomPath);

    // Create a signature (in production, this would use Ed25519)
    const signatureData = JSON.stringify({
      proposalId: proposal.node.getId(),
      peerId: this.state.currentPeerId,
      timestamp: Date.now(),
    });
    const signature = btoa(signatureData); // Simple base64 for now

    // Add the approval
    proposalManager.addApproval(
      expression,
      proposal.node.getId(),
      this.state.currentPeerId,
      signature
    );

    // Check if unanimous and auto-apply
    const members = getEffectiveMembers(expression);
    const updatedProposal = proposalManager.getProposalById(expression, proposal.node.getId());
    if (updatedProposal && proposalManager.hasUnanimousApproval(updatedProposal, members)) {
      proposalManager.applyProposal(expression, proposal.node.getId());
      this.setState({ selectedBranchId: null });
    } else {
      this.renderContent();
    }

    await this.save();
  }

  /** Get proposals for the current zoom path */
  private getCurrentProposals(): Proposal[] {
    const proposalManager = createProposalManager(this.state.store);
    const expression = new FosExpression(this.state.store, this.state.zoomPath);
    return proposalManager.getProposalsForNode(expression);
  }

  /** Get members for the current zoom path */
  private getCurrentMembers(): string[] {
    const expression = new FosExpression(this.state.store, this.state.zoomPath);
    return getEffectiveMembers(expression);
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

  // Save to IndexedDB
  async save(): Promise<void> {
    const data = this.getData();
    try {
      await setSyncMeta('fosContextData', data);
    } catch (e) {
      console.error('Failed to save data to IndexedDB:', e);
      // Fallback to localStorage
      localStorage.setItem('fos-data', JSON.stringify(data));
    }
  }

  // Load from IndexedDB
  async load(): Promise<boolean> {
    try {
      const data = await getSyncMeta<FosContextData>('fosContextData');
      if (data) {
        this.setData(data);
        return true;
      }
    } catch (e) {
      console.error('Failed to load data from IndexedDB:', e);
    }

    // Fallback: try localStorage (for migration from old storage)
    const stored = localStorage.getItem('fos-data');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.setData(data);
        // Migrate to IndexedDB
        await this.save();
        // Clear old localStorage
        localStorage.removeItem('fos-data');
        console.log('Migrated data from localStorage to IndexedDB');
        return true;
      } catch (e) {
        console.error('Failed to load data from localStorage:', e);
      }
    }
    return false;
  }

  // Clear all stored data
  async clearData(): Promise<void> {
    await clearAllData();
    localStorage.removeItem('fos-data');
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

    const views: { type: ViewType | 'peer'; label: string }[] = [
      { type: 'queue', label: 'Queue' },
      { type: 'tree', label: 'Tree' },
      { type: 'focus', label: 'Focus' },
      { type: 'peer', label: 'Peer' },
    ];

    for (const v of views) {
      const btn = button(
        { class: `fos-view-button ${this.state.view === v.type ? 'active' : ''}` },
        [v.label]
      );
      btn.addEventListener('click', () => this.setView(v.type as AppViewType));
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

    // Branch selector
    const proposals = this.getCurrentProposals();
    const members = this.getCurrentMembers();
    const branchCallbacks: BranchSelectorCallbacks = {
      onSelectBranch: (id) => this.selectBranch(id),
      onCreateBranch: (name) => this.createBranch(name),
      onApproveBranch: (proposal) => this.approveBranch(proposal),
    };
    const branchSelector = renderBranchSelector({
      proposals,
      selectedBranchId: this.state.selectedBranchId,
      currentPeerId: this.state.currentPeerId,
      members,
      callbacks: branchCallbacks,
    });
    toolbar.appendChild(branchSelector);

    // Spacer
    toolbar.appendChild(div({ class: 'fos-toolbar-spacer' }));

    const saveBtn = button({ class: 'fos-button' }, ['Save']);
    saveBtn.addEventListener('click', async () => {
      await this.save();
      saveBtn.textContent = 'Saved!';
      setTimeout(() => (saveBtn.textContent = 'Save'), 1500);
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

    const clearBtn = button({ class: 'fos-button fos-button--danger' }, ['Clear Data']);
    clearBtn.addEventListener('click', async () => {
      if (confirm('This will clear all saved data. Are you sure?')) {
        await this.clearData();
        window.location.reload();
      }
    });
    toolbar.appendChild(clearBtn);

    this.container.appendChild(toolbar);

    // Content area
    this.contentEl = div({ class: 'fos-content' });
    this.container.appendChild(this.contentEl);
    this.renderContent();
  }

  private renderContent() {
    if (!this.contentEl) return;

    // Peer view shows connection UI for current path
    if (this.state.view === 'peer') {
      this.contentEl.innerHTML = '';

      // Get or create NodePeers for current path
      const pathKey = this.state.zoomPath.join('/') || 'root';
      let nodePeers = this.state.nodePeers.get(pathKey);
      if (!nodePeers) {
        nodePeers = new NodePeers(this.state.zoomPath);
        this.state.nodePeers.set(pathKey, nodePeers);
      }

      // Path indicator
      const pathLabel = div({ class: 'fos-peer-path-label' }, [
        `Node: ${this.state.zoomPath.length ? this.state.zoomPath.join(' → ') : '(root)'}`,
      ]);
      this.contentEl.appendChild(pathLabel);

      // Peers UI
      const peersUI = renderNodePeersUI({ peers: nodePeers });
      this.contentEl.appendChild(peersUI);

      this.updateViewSwitcher();
      return;
    }

    // Tree view uses web component approach
    if (this.state.view === 'tree') {
      this.contentEl.innerHTML = '';
      renderTree(this.state.store, this.contentEl, this.state.zoomPath, () => this.save());
      this.updateViewSwitcher();
      return;
    }

    const onUpdate = () => {
      this.renderContent();
      this.save(); // async, fire and forget
    };

    // Save data without re-rendering (for text input changes)
    const onSave = () => {
      this.save(); // async, fire and forget
    };

    const onNavigate = (path: FosPath) => this.navigate(path);
    const onZoom = (path: FosPath) => this.zoom(path);

    // Create proposal manager
    const proposalManager = createProposalManager(this.state.store);

    // Create context with drag, drop, zoom, and proposal support
    const { ctx, dragState } = createViewContextWithDrag({
      store: this.state.store,
      path: this.state.path,
      zoomPath: this.state.zoomPath,
      maxDepth: this.state.maxDepth,
      onUpdate,
      onSave,
      onNavigate,
      onZoom,
      // Proposal/consensus support
      proposalManager,
      currentPeerId: this.state.currentPeerId,
      selectedProposalId: this.state.selectedBranchId,
      onSelectProposal: (id) => this.selectBranch(id),
      onApproveProposal: (proposal) => this.approveBranch(proposal),
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
    const views: AppViewType[] = ['queue', 'tree', 'focus', 'peer'];
    buttons.forEach((btn, i) => {
      btn.classList.toggle('active', views[i] === this.state.view);
    });
  }
}

// ============================================================================
// Bootstrap
// ============================================================================

export const createFosApp = async (
  selector: string | HTMLElement,
  options?: { autoLoad?: boolean }
): Promise<FosApp> => {
  const container =
    typeof selector === 'string'
      ? document.querySelector<HTMLElement>(selector)
      : selector;

  if (!container) {
    throw new Error(`Container not found: ${selector}`);
  }

  const app = new FosApp(container);

  if (options?.autoLoad !== false) {
    await app.load();
  }

  return app;
};

// Auto-init if this script is loaded directly
if (typeof window !== 'undefined') {
  (window as any).FosApp = FosApp;
  (window as any).createFosApp = createFosApp;
}
