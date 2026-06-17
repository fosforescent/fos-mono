/**
 * Branch Selector UI
 *
 * Dropdown for selecting branches (proposals) and creating new ones.
 * Appears in the toolbar, similar to git branch selection.
 */

import { div, span, button, el } from './render';
import type { Proposal, ProposalManager } from '@fosforescent/shared/dag-implementation/proposal';
import { getBranchColor, MAIN_BRANCH_COLOR } from '@fosforescent/shared/dag-implementation/proposal';
import type { FosExpression } from '@fosforescent/shared/dag-implementation/expression';
import type { NodePeers, IPeer } from './peer-connection';
import { createPeerConnectionBuilder, type AnyPeerConnectionBuilder } from './peer-connection';
import { parseFosUrl, isFosUrl, type ParsedFosUrl } from './fos-url';

// ============================================================================
// Types
// ============================================================================

/** Member with data that can be viewed */
export type MemberWithData = {
  peerId: string;
  lastUpdated: number;
};

/** Stored peer reference (persisted in graph) */
export type StoredPeer = {
  peerId: string;
  name?: string;
  active: boolean;  // Whether currently connected
  lastSeen?: number;
};

export type BranchSelectorCallbacks = {
  /** Called when a branch is selected (null = main/no branch) */
  onSelectBranch: (proposalId: string | null) => void;
  /** Called when a new branch is created (parentBranchId = null means branch from main) */
  onCreateBranch: (name: string, parentBranchId: string | null) => void;
  /** Called when the selected branch is approved */
  onApproveBranch: (proposal: Proposal) => void;
  /** Called to compare two branches (source vs target) - source=null means main */
  onCompareBranches?: (source: string | null, target: string | null) => void;
  /** Called to merge FROM a source branch INTO a target branch */
  onMergeBranch?: (sourceProposalId: string | null, targetProposalId: string | null) => void;
  /** Called to broadcast the selected branch as a merge request to peers */
  onRequestMerge?: (proposal: Proposal) => void;
  /** Called when a member is selected to view their content */
  onSelectMember?: (memberId: string | null) => void;
  /** Called when a peer successfully connects */
  onPeerConnected?: (peer: IPeer) => void;
  /** Called when a connected peer is clicked to request sync */
  onRequestPeerSync?: (peerId: string) => void;
};

export type BranchSelectorProps = {
  /** All proposals/branches for the current node */
  proposals: Proposal[];
  /** Currently selected branch ID (null = main branch) */
  selectedBranchId: string | null;
  /** Currently selected member ID (null = viewing our own data) */
  selectedMemberId: string | null;
  /** Current peer's ID */
  currentPeerId: string;
  /** Members who can approve */
  members: string[];
  /** Members with synced data (can be selected to view their content) */
  membersWithData: MemberWithData[];
  /** All stored peers at root (persisted, may be connected or disconnected) */
  storedPeers: StoredPeer[];
  /** Number of connected peers */
  peerCount: number;
  /** Node peers manager for peer connections */
  nodePeers: NodePeers | null;
  /** Active comparison (source vs target branch IDs, null = main) */
  comparingBranches: { source: string | null; target: string | null } | null;
  /** Callbacks */
  callbacks: BranchSelectorCallbacks;
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Truncate a peer ID for display
 */
function truncatePeerId(peerId: string): string {
  if (peerId.length <= 12) return peerId;
  return `${peerId.slice(0, 8)}...`;
}

/**
 * Format a timestamp as a relative time string
 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * Build a tree structure from proposals based on parentBranchId
 */
type BranchNode = {
  proposal: Proposal | null;  // null for main
  children: BranchNode[];
};

function buildBranchTree(proposals: Proposal[]): BranchNode {
  const root: BranchNode = { proposal: null, children: [] };
  const nodeMap = new Map<string, BranchNode>();

  // First pass: create nodes for all proposals
  for (const p of proposals) {
    nodeMap.set(p.node.getId(), { proposal: p, children: [] });
  }

  // Second pass: build tree structure
  for (const p of proposals) {
    const node = nodeMap.get(p.node.getId())!;
    if (p.parentBranchId && nodeMap.has(p.parentBranchId)) {
      // Add as child of parent branch
      nodeMap.get(p.parentBranchId)!.children.push(node);
    } else {
      // Add as child of main
      root.children.push(node);
    }
  }

  return root;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Render the branch selector dropdown
 */
export function renderBranchSelector(props: BranchSelectorProps): HTMLElement {
  const {
    proposals,
    selectedBranchId,
    selectedMemberId,
    currentPeerId,
    members,
    membersWithData,
    storedPeers,
    peerCount,
    nodePeers,
    comparingBranches,
    callbacks,
  } = props;

  const container = div({ class: 'fos-branch-selector' });

  // Branch icon
  const icon = span({ class: 'fos-branch-icon' }, ['\u{2442}']); // Unicode branch symbol
  container.appendChild(icon);

  // Current branch label and color
  let currentLabel = 'main';
  let currentColor = getBranchColor(selectedBranchId);

  // If viewing a member's data, show that instead of branch
  if (selectedMemberId) {
    currentLabel = `Viewing: ${truncatePeerId(selectedMemberId)}`;
    currentColor = '#6b7280'; // Gray for viewing peer data
  } else if (selectedBranchId) {
    const selected = proposals.find(p => p.node.getId() === selectedBranchId);
    if (selected) {
      const baseName = selected.name || 'branch';
      const isFromOtherPeer = selected.senderPeerId !== currentPeerId;
      currentLabel = isFromOtherPeer
        ? `${baseName}@${truncatePeerId(selected.senderPeerId)}`
        : baseName;
    }
  }

  // Dropdown button - always show color (main has its color too)
  const dropdownBtn = button(
    {
      class: 'fos-branch-dropdown-btn',
      style: `border-left: 3px solid ${currentColor}`
    },
    [currentLabel, span({ class: 'fos-dropdown-arrow' }, ['\u25BC'])]
  );

  // Dropdown menu (hidden by default)
  const menu = div({ class: 'fos-branch-menu', style: 'display: none;' });

  // Build branch tree
  const branchTree = buildBranchTree(proposals);

  // Track which branch we're creating from (for the input)
  let createFromBranchId: string | null = null;

  // Add section state - declared here so it can be used in branch option click handlers
  let addMode: 'select' | 'branch' | 'peer-create' | 'peer-join' = 'select';
  let peerBuilder: AnyPeerConnectionBuilder | null = null;
  let addSectionEl: HTMLElement | null = null;
  let renderAddSectionFn: (() => void) | null = null;
  let pendingPeerUrl: ParsedFosUrl | null = null;  // Stores parsed URL when connecting to a new peer

  // Helper function to set add mode from branch option click handlers
  const setAddMode = (mode: 'select' | 'branch' | 'peer-create' | 'peer-join') => {
    addMode = mode;
    if (renderAddSectionFn) {
      renderAddSectionFn();
    }
  };

  // Helper to render a branch option with its children
  const renderBranchOption = (
    branchNode: BranchNode,
    depth: number,
    parentBranchId: string | null
  ): HTMLElement[] => {
    const elements: HTMLElement[] = [];
    const proposal = branchNode.proposal;
    const proposalId = proposal?.node.getId() ?? null;
    const isMain = proposal === null;
    const isSelected = proposalId === selectedBranchId;
    const color = getBranchColor(proposalId);
    const indent = depth * 16;  // 16px per level

    const option = div(
      {
        class: `fos-branch-option ${isSelected ? 'selected' : ''}`,
        'data-branch-id': proposalId ?? '',
        style: `border-left: 3px solid ${color}; margin-left: ${indent}px`
      }
    );

    // Branch name - show @peerId suffix for branches from other peers
    let name: string;
    if (isMain) {
      name = 'main';
    } else if (proposal) {
      const baseName = proposal.name || 'branch';
      const isFromOtherPeer = proposal.senderPeerId !== currentPeerId;
      name = isFromOtherPeer
        ? `${baseName}@${truncatePeerId(proposal.senderPeerId)}`
        : baseName;
    } else {
      name = 'branch';
    }
    option.appendChild(span({ class: 'fos-branch-option-name' }, [name]));

    // Approval count (for non-main)
    if (!isMain && proposal) {
      const approvalCount = proposal.approvals.length;
      const requiredCount = members.length || 1;
      option.appendChild(span({ class: 'fos-branch-option-meta' }, [
        `${approvalCount}/${requiredCount}`
      ]));
    }

    // Selected check
    if (isSelected) {
      option.appendChild(span({ class: 'fos-branch-check' }, ['\u2713']));
    }

    // Action buttons container
    const actions = span({ class: 'fos-branch-actions' });

    // Add "+" button to create sub-branch
    const addBtn = button(
      {
        class: 'fos-branch-add-btn',
        title: `Create branch from ${name}`,
        style: `background: ${color}40`
      },
      ['+']
    );
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      createFromBranchId = proposalId;
      // Switch to branch creation mode - the renderAddSection will handle focus
      if (typeof setAddMode === 'function') {
        setAddMode('branch');
      }
    });
    actions.appendChild(addBtn);

    // Add compare button with sub-dropdown for selecting comparison target
    if (callbacks.onCompareBranches) {
      const compareBtn = button(
        {
          class: 'fos-branch-compare-btn',
          title: `Compare ${name} with...`,
          style: `background: ${color}40`
        },
        ['↔']  // Compare icon
      );

      // Sub-dropdown for selecting comparison target
      const compareSubmenu = div({
        class: 'fos-branch-compare-submenu',
        style: 'display: none;'
      });

      // Add "main" option if this isn't main
      if (!isMain) {
        const mainOption = div({
          class: 'fos-branch-submenu-option',
          style: `border-left: 3px solid ${MAIN_BRANCH_COLOR}`
        }, ['main']);
        mainOption.addEventListener('click', (e) => {
          e.stopPropagation();
          callbacks.onCompareBranches!(proposalId, null);
          menu.style.display = 'none';
          compareSubmenu.style.display = 'none';
        });
        compareSubmenu.appendChild(mainOption);
      }

      // Add all other branches as comparison targets
      for (const p of proposals) {
        const targetId = p.node.getId();
        if (targetId === proposalId) continue;  // Skip self

        const targetColor = getBranchColor(targetId);
        const targetName = p.name || 'branch';
        const targetOption = div({
          class: 'fos-branch-submenu-option',
          style: `border-left: 3px solid ${targetColor}`
        }, [targetName]);
        targetOption.addEventListener('click', (e) => {
          e.stopPropagation();
          callbacks.onCompareBranches!(proposalId, targetId);
          menu.style.display = 'none';
          compareSubmenu.style.display = 'none';
        });
        compareSubmenu.appendChild(targetOption);
      }

      // If this is main, add option to compare with each branch
      if (isMain) {
        for (const p of proposals) {
          const targetId = p.node.getId();
          const targetColor = getBranchColor(targetId);
          const targetName = p.name || 'branch';
          const targetOption = div({
            class: 'fos-branch-submenu-option',
            style: `border-left: 3px solid ${targetColor}`
          }, [targetName]);
          targetOption.addEventListener('click', (e) => {
            e.stopPropagation();
            callbacks.onCompareBranches!(null, targetId);
            menu.style.display = 'none';
            compareSubmenu.style.display = 'none';
          });
          compareSubmenu.appendChild(targetOption);
        }
      }

      compareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Toggle submenu
        const isVisible = compareSubmenu.style.display !== 'none';
        // Hide all other submenus first
        menu.querySelectorAll('.fos-branch-compare-submenu').forEach(sm => {
          (sm as HTMLElement).style.display = 'none';
        });
        compareSubmenu.style.display = isVisible ? 'none' : 'block';
      });

      actions.appendChild(compareBtn);
      actions.appendChild(compareSubmenu);
    }

    option.appendChild(actions);

    // Click to select
    option.addEventListener('click', () => {
      callbacks.onSelectBranch(proposalId);
      menu.style.display = 'none';
    });

    elements.push(option);

    // Render children recursively
    for (const child of branchNode.children) {
      elements.push(...renderBranchOption(child, depth + 1, proposalId));
    }

    return elements;
  };

  // Render main and its children (all top-level branches)
  const branchElements = renderBranchOption(branchTree, 0, null);
  for (const el of branchElements) {
    menu.appendChild(el);
  }

  // Separator before peers section
  const { onSelectMember } = callbacks;

  // Build set of connected peer IDs for status display
  const connectedPeerIds = new Set<string>();
  if (nodePeers) {
    for (const peer of nodePeers.getAllPeers()) {
      connectedPeerIds.add(peer.id);
    }
  }

  // Show peers section if we have any stored peers
  if (storedPeers.length > 0) {
    menu.appendChild(div({ class: 'fos-branch-separator' }));

    // "Peers" header with count
    const connectedCount = connectedPeerIds.size;
    const headerText = connectedCount > 0
      ? `Peers (${connectedCount} connected)`
      : `Peers (${storedPeers.length} stored)`;
    menu.appendChild(div(
      { class: 'fos-branch-section-header' },
      [headerText]
    ));

    // List all stored peers with connection status
    for (const storedPeer of storedPeers) {
      // Skip self
      if (storedPeer.peerId === currentPeerId) continue;

      const isConnected = connectedPeerIds.has(storedPeer.peerId);
      const peerOption = div({
        class: `fos-branch-option fos-peer-option ${isConnected ? '' : 'fos-peer-disconnected'}`,
        'data-peer-id': storedPeer.peerId,
      });

      // Connection status indicator
      const statusDot = span({
        class: 'fos-peer-status-dot',
        style: `color: ${isConnected ? '#22c55e' : '#6b7280'}; margin-right: 4px;`,
        title: isConnected ? 'Connected' : 'Disconnected'
      }, [isConnected ? '●' : '○']);
      peerOption.appendChild(statusDot);

      // Peer name or truncated ID
      const displayName = storedPeer.name || (
        storedPeer.peerId.length > 16
          ? `${storedPeer.peerId.slice(0, 8)}...${storedPeer.peerId.slice(-4)}`
          : storedPeer.peerId
      );
      peerOption.appendChild(span({ class: 'fos-branch-option-name' }, [displayName]));

      // Last seen time (if disconnected)
      if (!isConnected && storedPeer.lastSeen) {
        const timeAgo = formatTimeAgo(storedPeer.lastSeen);
        peerOption.appendChild(span({ class: 'fos-branch-option-meta' }, [timeAgo]));
      }

      // Sync button (only if connected)
      if (isConnected && callbacks.onRequestPeerSync) {
        const syncBtn = button({
          class: 'fos-peer-sync-btn',
          title: 'Request sync from this peer'
        }, ['↻']);
        syncBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          callbacks.onRequestPeerSync!(storedPeer.peerId);
          // Show feedback
          syncBtn.textContent = '✓';
          setTimeout(() => { syncBtn.textContent = '↻'; }, 1500);
        });
        peerOption.appendChild(syncBtn);
      }

      // Click to request sync (if connected)
      peerOption.addEventListener('click', () => {
        if (isConnected && callbacks.onRequestPeerSync) {
          callbacks.onRequestPeerSync(storedPeer.peerId);
        }
        menu.style.display = 'none';
      });

      menu.appendChild(peerOption);
    }
  }

  // Show peers with synced data (separate section)
  if (membersWithData.length > 0 && onSelectMember) {
    if (peerCount === 0) {
      // If no peers section was added above, add separator
      menu.appendChild(div({ class: 'fos-branch-separator' }));
    }

    // "Peers with Data" header
    menu.appendChild(div(
      { class: 'fos-branch-section-header' },
      ['Peers with Data']
    ));

    // "View Our Data" option (to switch back from viewing a member)
    const ourDataOption = div({
      class: `fos-branch-option fos-member-option ${selectedMemberId === null ? 'selected' : ''}`,
      'data-member-id': '',
    });
    ourDataOption.appendChild(span({ class: 'fos-branch-option-name' }, ['Our Data']));
    if (selectedMemberId === null) {
      ourDataOption.appendChild(span({ class: 'fos-branch-check' }, ['\u2713']));
    }
    ourDataOption.addEventListener('click', () => {
      onSelectMember(null);
      menu.style.display = 'none';
    });
    menu.appendChild(ourDataOption);

    // Each member with data
    for (const member of membersWithData) {
      const isSelected = selectedMemberId === member.peerId;
      const memberOption = div({
        class: `fos-branch-option fos-member-option ${isSelected ? 'selected' : ''}`,
        'data-member-id': member.peerId,
      });

      // Member name (truncated peer ID)
      const displayName = member.peerId.length > 12
        ? `${member.peerId.slice(0, 8)}...`
        : member.peerId;
      memberOption.appendChild(span({ class: 'fos-branch-option-name' }, [displayName]));

      // Last updated time
      const timeAgo = formatTimeAgo(member.lastUpdated);
      memberOption.appendChild(span({ class: 'fos-branch-option-meta' }, [timeAgo]));

      if (isSelected) {
        memberOption.appendChild(span({ class: 'fos-branch-check' }, ['\u2713']));
      }

      memberOption.addEventListener('click', () => {
        onSelectMember(member.peerId);
        menu.style.display = 'none';
      });
      menu.appendChild(memberOption);
    }
  }

  // Separator before add section
  menu.appendChild(div({ class: 'fos-branch-separator' }));

  // Add section - branch input + link button
  addSectionEl = div({ class: 'fos-branch-add-section' });

  // Branch creation input row
  const branchRow = div({ class: 'fos-branch-create-row' });

  const createInput = el('input', {
    class: 'fos-branch-create-input',
    type: 'text',
    placeholder: 'New branch...'
  }) as HTMLInputElement;

  const createBtn = button({ class: 'fos-branch-create-btn', title: 'Create branch' }, ['+']);

  const doCreateBranch = () => {
    const name = createInput.value.trim();
    if (name) {
      callbacks.onCreateBranch(name, createFromBranchId);
      createInput.value = '';
      createFromBranchId = null;
      createInput.placeholder = 'New branch...';
      menu.style.display = 'none';
    }
  };

  createBtn.addEventListener('click', doCreateBranch);
  createInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doCreateBranch();
  });

  // Link button - opens overlay for peer/file/link options
  const linkBtn = button({ class: 'fos-branch-link-btn', title: 'Add reference (peer, file, link)' }, ['\u{1F517}']);

  // Backdrop and overlay for reference options
  const backdrop = div({ class: 'fos-reference-backdrop', style: 'display: none;' });
  const overlay = div({ class: 'fos-reference-overlay', style: 'display: none;' });

  const closeOverlay = () => {
    overlay.style.display = 'none';
    backdrop.style.display = 'none';
    addMode = 'select';
  };

  backdrop.addEventListener('click', closeOverlay);

  const renderOverlay = () => {
    overlay.innerHTML = '';

    if (addMode === 'select') {
      // Reference type options
      const header = div({ class: 'fos-reference-header' }, [
        span({}, ['Add Reference']),
        button({ class: 'fos-reference-close' }, ['\u00D7'])
      ]);
      header.querySelector('.fos-reference-close')!.addEventListener('click', closeOverlay);
      overlay.appendChild(header);

      // URL input section
      const urlSection = div({ class: 'fos-reference-url-section' });
      const urlInput = el('input', {
        class: 'fos-reference-url-input',
        type: 'text',
        placeholder: 'Paste fos:// URL or create new...'
      }) as HTMLInputElement;

      const urlStatus = div({ class: 'fos-reference-url-status' });

      // Handle URL input
      urlInput.addEventListener('input', () => {
        const value = urlInput.value.trim();
        if (!value) {
          urlStatus.textContent = '';
          urlStatus.className = 'fos-reference-url-status';
          return;
        }

        if (isFosUrl(value)) {
          const parsed = parseFosUrl(value);
          if (parsed) {
            if (parsed.type === 'peer' && parsed.peerId) {
              // Check if peer exists
              // For now, show that we'll need to connect
              urlStatus.textContent = `Peer: ${parsed.peerId.slice(0, 12)}... (will connect)`;
              urlStatus.className = 'fos-reference-url-status fos-reference-url-status--info';
            } else if (parsed.type === 'local') {
              urlStatus.textContent = `Local path with ${parsed.path.length} segments`;
              urlStatus.className = 'fos-reference-url-status fos-reference-url-status--success';
            } else if (parsed.type === 'file') {
              urlStatus.textContent = `File: ${parsed.filePath}`;
              urlStatus.className = 'fos-reference-url-status fos-reference-url-status--info';
            }
          } else {
            urlStatus.textContent = 'Invalid fos:// URL';
            urlStatus.className = 'fos-reference-url-status fos-reference-url-status--error';
          }
        } else {
          urlStatus.textContent = 'Enter a fos:// URL';
          urlStatus.className = 'fos-reference-url-status fos-reference-url-status--error';
        }
      });

      const urlAddBtn = button({ class: 'fos-button' }, ['Add Reference']);
      urlAddBtn.addEventListener('click', () => {
        const value = urlInput.value.trim();
        if (!value || !isFosUrl(value)) return;

        const parsed = parseFosUrl(value);
        if (!parsed) return;

        if (parsed.type === 'peer' && parsed.peerId) {
          // Need to connect to peer first
          // Store the parsed URL and switch to peer connection mode
          pendingPeerUrl = parsed;
          addMode = 'peer-create';
          renderOverlay();
        } else {
          // Local or file reference - just close for now
          // TODO: Actually create the reference
          console.log('[Reference] Adding:', parsed);
          closeOverlay();
          menu.style.display = 'none';
        }
      });

      urlSection.appendChild(urlInput);
      urlSection.appendChild(urlStatus);
      urlSection.appendChild(div({ class: 'fos-reference-url-actions' }, [urlAddBtn]));
      overlay.appendChild(urlSection);

      // Separator
      overlay.appendChild(div({ class: 'fos-reference-separator' }, [
        span({}, ['or create new'])
      ]));

      const options = div({ class: 'fos-reference-options' });

      // Peer option
      const peerOption = div({ class: 'fos-reference-option' });
      peerOption.appendChild(span({ class: 'fos-reference-icon' }, ['\u{1F517}']));
      peerOption.appendChild(div({ class: 'fos-reference-info' }, [
        span({ class: 'fos-reference-title' }, ['Peer Connection']),
        span({ class: 'fos-reference-desc' }, ['Connect to another device via WebRTC'])
      ]));
      peerOption.addEventListener('click', () => {
        pendingPeerUrl = null;
        addMode = 'peer-create';
        renderOverlay();
      });
      options.appendChild(peerOption);

      // File option (future)
      const fileOption = div({ class: 'fos-reference-option fos-reference-option--disabled' });
      fileOption.appendChild(span({ class: 'fos-reference-icon' }, ['\u{1F4C1}']));
      fileOption.appendChild(div({ class: 'fos-reference-info' }, [
        span({ class: 'fos-reference-title' }, ['Local File']),
        span({ class: 'fos-reference-desc' }, ['Reference a .fos file (coming soon)'])
      ]));
      options.appendChild(fileOption);

      // URL option (future)
      const urlOption = div({ class: 'fos-reference-option fos-reference-option--disabled' });
      urlOption.appendChild(span({ class: 'fos-reference-icon' }, ['\u{1F310}']));
      urlOption.appendChild(div({ class: 'fos-reference-info' }, [
        span({ class: 'fos-reference-title' }, ['URL']),
        span({ class: 'fos-reference-desc' }, ['Link to remote content (coming soon)'])
      ]));
      options.appendChild(urlOption);

      overlay.appendChild(options);

    } else if (addMode === 'peer-create' || addMode === 'peer-join') {
      // Peer connection flow
      renderPeerConnectionInOverlay(overlay, addMode === 'peer-join');
    }
  };

  const renderPeerConnectionInOverlay = (container: HTMLElement, isJoin: boolean) => {
    // Header with back button
    const header = div({ class: 'fos-reference-header' }, [
      button({ class: 'fos-reference-back' }, ['\u2190']),
      span({}, ['Peer Connection']),
      button({ class: 'fos-reference-close' }, ['\u00D7'])
    ]);
    header.querySelector('.fos-reference-back')!.addEventListener('click', () => {
      peerBuilder?.cancel();
      peerBuilder = null;
      addMode = 'select';
      renderOverlay();
    });
    header.querySelector('.fos-reference-close')!.addEventListener('click', () => {
      peerBuilder?.cancel();
      peerBuilder = null;
      closeOverlay();
      addMode = 'select';
    });
    container.appendChild(header);

    // Tabs
    const tabs = div({ class: 'fos-peer-tabs' });
    const createTab = button({ class: `fos-peer-tab ${!isJoin ? 'active' : ''}` }, ['Create Invite']);
    const joinTab = button({ class: `fos-peer-tab ${isJoin ? 'active' : ''}` }, ['Join']);

    createTab.addEventListener('click', () => {
      peerBuilder?.cancel();
      peerBuilder = null;
      addMode = 'peer-create';
      renderOverlay();
    });
    joinTab.addEventListener('click', () => {
      peerBuilder?.cancel();
      peerBuilder = null;
      addMode = 'peer-join';
      renderOverlay();
    });
    tabs.appendChild(createTab);
    tabs.appendChild(joinTab);
    container.appendChild(tabs);

    const content = div({ class: 'fos-peer-content' });

    if (!isJoin) {
      // Create tab
      const generateBtn = button({ class: 'fos-button' }, ['Generate Invite']);

      generateBtn.addEventListener('click', async () => {
        if (!nodePeers) {
          alert('Peer connections not available');
          return;
        }

        peerBuilder = createPeerConnectionBuilder(nodePeers.path);

        try {
          const offer = await peerBuilder.createOffer();
          try { await navigator.clipboard.writeText(offer); } catch (e) { }

          content.innerHTML = '';
          const textarea = el('textarea', { class: 'fos-peer-textarea', readonly: 'true' }) as HTMLTextAreaElement;
          textarea.value = offer;

          const copyBtn = button({ class: 'fos-button fos-button--small' }, ['Copied!']);
          setTimeout(() => (copyBtn.textContent = 'Copy'), 2000);
          copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(offer);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
          });

          const answerInput = el('textarea', {
            class: 'fos-peer-textarea',
            placeholder: 'Paste response here...',
          }) as HTMLTextAreaElement;

          answerInput.addEventListener('focus', async () => {
            if (answerInput.value.trim()) return;
            try {
              const clipboardText = await navigator.clipboard.readText();
              if (clipboardText.trim()) answerInput.value = clipboardText.trim();
            } catch (e) { }
          });

          const connectBtn = button({ class: 'fos-button' }, ['Connect']);
          const statusEl = div({ class: 'fos-peer-status' });

          connectBtn.addEventListener('click', async () => {
            if (!peerBuilder || !answerInput.value.trim()) return;
            connectBtn.disabled = true;
            connectBtn.textContent = 'Connecting...';

            try {
              const peer = await peerBuilder.acceptAnswer(answerInput.value.trim());
              nodePeers!.addPeer(peer);
              statusEl.textContent = 'Connected!';
              statusEl.className = 'fos-peer-status fos-peer-status--success';
              callbacks.onPeerConnected?.(peer);
              setTimeout(() => {
                closeOverlay();
                menu.style.display = 'none';
                addMode = 'select';
                peerBuilder = null;
              }, 1000);
            } catch (e: any) {
              connectBtn.disabled = false;
              connectBtn.textContent = 'Connect';
              statusEl.textContent = `Error: ${e.message}`;
              statusEl.className = 'fos-peer-status fos-peer-status--error';
            }
          });

          content.appendChild(div({ class: 'fos-peer-label' }, ['Send this invite to peer:']));
          content.appendChild(textarea);
          content.appendChild(div({ class: 'fos-peer-row' }, [copyBtn]));
          content.appendChild(div({ class: 'fos-peer-label' }, ['Paste their response:']));
          content.appendChild(answerInput);
          content.appendChild(div({ class: 'fos-peer-row' }, [connectBtn]));
          content.appendChild(statusEl);
        } catch (e: any) {
          alert(`Error: ${e.message}`);
        }
      });

      content.appendChild(generateBtn);
    } else {
      // Join tab
      const offerInput = el('textarea', {
        class: 'fos-peer-textarea',
        placeholder: 'Paste invite here...',
      }) as HTMLTextAreaElement;

      offerInput.addEventListener('focus', async () => {
        if (offerInput.value.trim()) return;
        try {
          const clipboardText = await navigator.clipboard.readText();
          if (clipboardText.trim()) offerInput.value = clipboardText.trim();
        } catch (e) { }
      });

      const joinBtn = button({ class: 'fos-button' }, ['Join']);

      joinBtn.addEventListener('click', async () => {
        if (!nodePeers || !offerInput.value.trim()) return;
        console.log('[Branch Selector] Join clicked, path:', JSON.stringify(nodePeers.path));
        peerBuilder = createPeerConnectionBuilder(nodePeers.path);

        try {
          console.log('[Branch Selector] Calling acceptOffer...');
          const result = await peerBuilder.acceptOffer(offerInput.value.trim());
          console.log('[Branch Selector] acceptOffer returned:', result);
          const { answer, waitForConnection } = result;
          try { await navigator.clipboard.writeText(answer); } catch (e) { }

          content.innerHTML = '';
          const textarea = el('textarea', { class: 'fos-peer-textarea', readonly: 'true' }) as HTMLTextAreaElement;
          textarea.value = answer;

          const copyBtn = button({ class: 'fos-button fos-button--small' }, ['Copied!']);
          setTimeout(() => (copyBtn.textContent = 'Copy'), 2000);
          copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(answer);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
          });

          const waitingEl = div({ class: 'fos-peer-status' }, ['Waiting for connection...']);

          content.appendChild(div({ class: 'fos-peer-label' }, ['Send this response to peer:']));
          content.appendChild(textarea);
          content.appendChild(div({ class: 'fos-peer-row' }, [copyBtn]));
          content.appendChild(waitingEl);

          const peer = await waitForConnection();
          nodePeers.addPeer(peer);
          waitingEl.textContent = 'Connected!';
          waitingEl.className = 'fos-peer-status fos-peer-status--success';
          callbacks.onPeerConnected?.(peer);

          setTimeout(() => {
            closeOverlay();
            menu.style.display = 'none';
            addMode = 'select';
            peerBuilder = null;
          }, 1000);
        } catch (e: any) {
          alert(`Error: ${e.message}`);
        }
      });

      content.appendChild(div({ class: 'fos-peer-label' }, ['Paste the invite:']));
      content.appendChild(offerInput);
      content.appendChild(div({ class: 'fos-peer-row' }, [joinBtn]));

      setTimeout(() => offerInput.focus(), 0);
    }

    container.appendChild(content);
  };

  linkBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    addMode = 'select';
    renderOverlay();
    backdrop.style.display = 'block';
    overlay.style.display = 'block';
  });

  // Update input placeholder when createFromBranchId changes
  renderAddSectionFn = () => {
    createInput.placeholder = createFromBranchId ? `Branch from ${createFromBranchId.slice(0, 8)}...` : 'New branch...';
    createInput.focus();
  };

  branchRow.appendChild(createInput);
  branchRow.appendChild(createBtn);
  branchRow.appendChild(linkBtn);
  addSectionEl.appendChild(branchRow);

  // Add backdrop and overlay to body for proper fixed positioning
  document.body.appendChild(backdrop);
  document.body.appendChild(overlay);

  menu.appendChild(addSectionEl);

  container.appendChild(dropdownBtn);
  container.appendChild(menu);

  // Toggle menu on button click
  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = menu.style.display !== 'none';
    menu.style.display = isVisible ? 'none' : 'block';
  });

  // Close menu when clicking outside
  const closeMenu = (e: Event) => {
    if (!container.contains(e.target as Node)) {
      menu.style.display = 'none';
    }
  };
  document.addEventListener('click', closeMenu);

  // Show comparison mode indicator and merge button
  if (comparingBranches) {
    const { source, target } = comparingBranches;
    const sourceColor = getBranchColor(source);
    const targetColor = getBranchColor(target);
    const sourceName = source
      ? (proposals.find(p => p.node.getId() === source)?.name || 'branch')
      : 'main';
    const targetName = target
      ? (proposals.find(p => p.node.getId() === target)?.name || 'branch')
      : 'main';

    const compareIndicator = div({ class: 'fos-compare-indicator' });

    // Source badge
    const sourceBadge = span({
      class: 'fos-compare-badge',
      style: `border-color: ${sourceColor}; background: ${sourceColor}20`
    }, [sourceName]);
    compareIndicator.appendChild(sourceBadge);

    // Arrow
    compareIndicator.appendChild(span({ class: 'fos-compare-arrow' }, ['↔']));

    // Target badge
    const targetBadge = span({
      class: 'fos-compare-badge',
      style: `border-color: ${targetColor}; background: ${targetColor}20`
    }, [targetName]);
    compareIndicator.appendChild(targetBadge);

    container.appendChild(compareIndicator);

    // Merge button - merge source INTO target
    if (callbacks.onMergeBranch) {
      const mergeBtn = button(
        {
          class: 'fos-branch-merge-btn-action',
          title: `Merge ${sourceName} into ${targetName}`
        },
        [`Merge → ${targetName}`]
      );
      mergeBtn.addEventListener('click', () => {
        callbacks.onMergeBranch!(source, target);
      });
      container.appendChild(mergeBtn);
    }

    // Exit comparison button
    const exitBtn = button(
      {
        class: 'fos-compare-exit-btn',
        title: 'Exit comparison mode'
      },
      ['×']
    );
    exitBtn.addEventListener('click', () => {
      if (callbacks.onCompareBranches) {
        callbacks.onCompareBranches(null, null);  // Signal exit comparison
      }
    });
    container.appendChild(exitBtn);
  }

  // Add approve button if a branch is selected (and not in comparison mode)
  if (selectedBranchId && !comparingBranches) {
    const selected = proposals.find(p => p.node.getId() === selectedBranchId);
    if (selected) {
      const hasApproved = selected.approvals.some(a => a.peerId === currentPeerId);

      const approveBtn = button(
        {
          class: `fos-branch-approve-btn ${hasApproved ? 'approved' : ''}`,
          title: hasApproved ? 'Already approved' : 'Approve this branch'
        },
        [hasApproved ? '\u2713 Approved' : 'Approve']
      );

      if (!hasApproved) {
        approveBtn.addEventListener('click', () => {
          callbacks.onApproveBranch(selected);
        });
      } else {
        approveBtn.setAttribute('disabled', 'disabled');
      }

      container.appendChild(approveBtn);

      // Add Request Merge button if peers are connected
      if (peerCount > 0 && callbacks.onRequestMerge) {
        const requestMergeBtn = button(
          {
            class: 'fos-branch-request-merge-btn',
            title: `Send merge request to ${peerCount} peer${peerCount > 1 ? 's' : ''}`
          },
          [`Request Merge (${peerCount})`]
        );
        requestMergeBtn.addEventListener('click', () => {
          callbacks.onRequestMerge!(selected);
        });
        container.appendChild(requestMergeBtn);
      }
    }
  }

  return container;
}

// ============================================================================
// Compact Version (for toolbar)
// ============================================================================

/**
 * Render a compact branch indicator for the toolbar
 * Shows just the current branch name with a small dropdown
 */
export function renderCompactBranchSelector(props: BranchSelectorProps): HTMLElement {
  return renderBranchSelector(props);
}
