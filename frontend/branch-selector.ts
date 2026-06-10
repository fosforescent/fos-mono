/**
 * Branch Selector UI
 *
 * Dropdown for selecting branches (proposals) and creating new ones.
 * Appears in the toolbar, similar to git branch selection.
 */

import { div, span, button, el } from './render';
import type { Proposal, ProposalManager } from '@fosforescent/shared/dag-implementation/proposal';
import { PROPOSAL_COLORS } from '@fosforescent/shared/dag-implementation/proposal';
import type { FosExpression } from '@fosforescent/shared/dag-implementation/expression';

// ============================================================================
// Types
// ============================================================================

export type BranchSelectorCallbacks = {
  /** Called when a branch is selected (null = main/no branch) */
  onSelectBranch: (proposalId: string | null) => void;
  /** Called when a new branch is created */
  onCreateBranch: (name: string) => void;
  /** Called when the selected branch is approved */
  onApproveBranch: (proposal: Proposal) => void;
};

export type BranchSelectorProps = {
  /** All proposals/branches for the current node */
  proposals: Proposal[];
  /** Currently selected branch ID (null = main branch) */
  selectedBranchId: string | null;
  /** Current peer's ID */
  currentPeerId: string;
  /** Members who can approve */
  members: string[];
  /** Callbacks */
  callbacks: BranchSelectorCallbacks;
};

// ============================================================================
// Color Helpers
// ============================================================================

/**
 * Get a color for a sender based on their peer ID
 */
function getColorForSender(senderPeerId: string): string {
  let hash = 0;
  for (let i = 0; i < senderPeerId.length; i++) {
    hash = ((hash << 5) - hash) + senderPeerId.charCodeAt(i);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % PROPOSAL_COLORS.length;
  return PROPOSAL_COLORS[index] ?? PROPOSAL_COLORS[0];
}

/**
 * Truncate a peer ID for display
 */
function truncatePeerId(peerId: string): string {
  if (peerId.length <= 12) return peerId;
  return `${peerId.slice(0, 8)}...`;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Render the branch selector dropdown
 */
export function renderBranchSelector(props: BranchSelectorProps): HTMLElement {
  const { proposals, selectedBranchId, currentPeerId, members, callbacks } = props;

  const container = div({ class: 'fos-branch-selector' });

  // Branch icon
  const icon = span({ class: 'fos-branch-icon' }, ['\u{2442}']); // Unicode branch symbol
  container.appendChild(icon);

  // Current branch label
  let currentLabel = 'main';
  let currentColor = '';

  if (selectedBranchId) {
    const selected = proposals.find(p => p.node.getId() === selectedBranchId);
    if (selected) {
      currentLabel = selected.name || truncatePeerId(selected.senderPeerId);
      currentColor = getColorForSender(selected.senderPeerId);
    }
  }

  // Dropdown button
  const dropdownBtn = button(
    {
      class: 'fos-branch-dropdown-btn',
      style: currentColor ? `border-left: 3px solid ${currentColor}` : ''
    },
    [currentLabel, span({ class: 'fos-dropdown-arrow' }, ['\u25BC'])]
  );

  // Dropdown menu (hidden by default)
  const menu = div({ class: 'fos-branch-menu', style: 'display: none;' });

  // Main branch option
  const mainOption = div(
    {
      class: `fos-branch-option ${!selectedBranchId ? 'selected' : ''}`,
      'data-branch-id': ''
    },
    [
      span({ class: 'fos-branch-option-name' }, ['main']),
      !selectedBranchId ? span({ class: 'fos-branch-check' }, ['\u2713']) : null
    ].filter(Boolean) as (string | HTMLElement)[]
  );
  mainOption.addEventListener('click', () => {
    callbacks.onSelectBranch(null);
    menu.style.display = 'none';
  });
  menu.appendChild(mainOption);

  // Separator
  if (proposals.length > 0) {
    menu.appendChild(div({ class: 'fos-branch-separator' }));
  }

  // Existing branches
  for (const proposal of proposals) {
    const proposalId = proposal.node.getId();
    const isSelected = proposalId === selectedBranchId;
    const color = getColorForSender(proposal.senderPeerId);
    const approvalCount = proposal.approvals.length;
    const requiredCount = members.length || 1;

    const option = div(
      {
        class: `fos-branch-option ${isSelected ? 'selected' : ''}`,
        'data-branch-id': proposalId,
        style: `border-left: 3px solid ${color}`
      },
      [
        span({ class: 'fos-branch-option-name' }, [proposal.name || truncatePeerId(proposal.senderPeerId)]),
        span({ class: 'fos-branch-option-meta' }, [
          `${approvalCount}/${requiredCount}`
        ]),
        isSelected ? span({ class: 'fos-branch-check' }, ['\u2713']) : null
      ].filter(Boolean) as (string | HTMLElement)[]
    );
    option.addEventListener('click', () => {
      callbacks.onSelectBranch(proposalId);
      menu.style.display = 'none';
    });
    menu.appendChild(option);
  }

  // Separator before create
  menu.appendChild(div({ class: 'fos-branch-separator' }));

  // Create new branch
  const createOption = div({ class: 'fos-branch-option fos-branch-create' });

  const createInput = el('input', {
    class: 'fos-branch-create-input',
    type: 'text',
    placeholder: 'New branch name...'
  }) as HTMLInputElement;

  const createBtn = button({ class: 'fos-branch-create-btn' }, ['+']);
  createBtn.addEventListener('click', () => {
    const name = createInput.value.trim();
    if (name) {
      callbacks.onCreateBranch(name);
      createInput.value = '';
      menu.style.display = 'none';
    }
  });

  createInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const name = createInput.value.trim();
      if (name) {
        callbacks.onCreateBranch(name);
        createInput.value = '';
        menu.style.display = 'none';
      }
    }
  });

  createOption.appendChild(createInput);
  createOption.appendChild(createBtn);
  menu.appendChild(createOption);

  container.appendChild(dropdownBtn);
  container.appendChild(menu);

  // Toggle menu on button click
  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = menu.style.display !== 'none';
    menu.style.display = isVisible ? 'none' : 'block';

    // Focus input when opening
    if (!isVisible) {
      setTimeout(() => createInput.focus(), 0);
    }
  });

  // Close menu when clicking outside
  const closeMenu = (e: Event) => {
    if (!container.contains(e.target as Node)) {
      menu.style.display = 'none';
    }
  };
  document.addEventListener('click', closeMenu);

  // Add approve button if a branch is selected
  if (selectedBranchId) {
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
