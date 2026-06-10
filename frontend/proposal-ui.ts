/**
 * Proposal UI Module
 *
 * Pure DOM rendering functions for the peer consensus/proposal system.
 * Consistent with the vanilla TypeScript pattern used in views.ts and render.ts.
 */

import { div, span, button, el } from './render';
import type { Proposal, FieldDiff } from '@fosforescent/shared/dag-implementation/proposal';
import { PROPOSAL_COLORS } from '@fosforescent/shared/dag-implementation/proposal';

// ============================================================================
// Types
// ============================================================================

export type ProposalUICallbacks = {
  onSelectProposal: (proposalId: string | null) => void;
  onApprove: (proposal: Proposal) => void;
  onReject?: (proposal: Proposal) => void;
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

// ============================================================================
// Proposal Borders (left-edge color stripes)
// ============================================================================

/**
 * Render colored border stripes for proposals on a row.
 * Each proposal gets a 2px colored stripe stacked horizontally.
 */
export function renderProposalBorders(proposals: Proposal[]): HTMLElement {
  const container = div({ class: 'fos-proposal-borders' });

  for (const proposal of proposals) {
    const color = getColorForSender(proposal.senderPeerId);
    const border = div({
      class: 'fos-proposal-border',
      style: `background-color: ${color}`,
      title: `Proposal by ${truncatePeerId(proposal.senderPeerId)}`,
    });
    container.appendChild(border);
  }

  return container;
}

// ============================================================================
// Ancestor Trail (dimmed borders for descendants with proposals)
// ============================================================================

/**
 * Render ancestor trail borders indicating descendants have proposals.
 * Similar to proposal borders but with 0.4 opacity.
 */
export function renderAncestorTrail(descendantColors: string[]): HTMLElement {
  const container = div({ class: 'fos-ancestor-trails' });

  const uniqueColors = [...new Set(descendantColors)];
  for (const color of uniqueColors) {
    const trail = div({
      class: 'fos-ancestor-trail',
      style: `background-color: ${color}`,
    });
    container.appendChild(trail);
  }

  return container;
}

/**
 * Apply ancestor trail indicator to a row element.
 * Modifies the row to show it has descendant proposals.
 */
export function applyAncestorTrail(
  rowElement: HTMLElement,
  descendantColors: string[]
): void {
  if (descendantColors.length === 0) return;

  rowElement.classList.add('fos-has-descendant-proposal');
  const firstColor = descendantColors[0];
  if (firstColor) {
    rowElement.style.setProperty('--proposal-color', firstColor);
  }

  // If multiple colors, prepend the trail container
  if (descendantColors.length > 1) {
    const trail = renderAncestorTrail(descendantColors);
    rowElement.insertBefore(trail, rowElement.firstChild);
  }
}

// ============================================================================
// Proposal Selector Dropdown
// ============================================================================

/**
 * Render a proposal selector with dropdown and approve button.
 */
export function renderProposalSelector(
  proposals: Proposal[],
  members: string[],
  currentPeerId: string,
  selectedProposalId: string | null,
  callbacks: ProposalUICallbacks
): HTMLElement {
  if (proposals.length === 0) {
    return div({}); // Empty container if no proposals
  }

  const container = div({ class: 'fos-proposal-selector' });

  // Label
  container.appendChild(
    span({ class: 'fos-proposal-selector-label' }, ['Proposals:'])
  );

  // Dropdown
  const dropdown = el('select', { class: 'fos-proposal-dropdown' });

  // "None" option
  const noneOption = el('option', { value: '' }, ['-- Select --']);
  dropdown.appendChild(noneOption);

  // Proposal options
  for (const proposal of proposals) {
    const proposalId = proposal.node.getId();
    const option = el('option', { value: proposalId }, [
      `${truncatePeerId(proposal.senderPeerId)} (${proposal.approvals.length}/${members.length || '∞'} approvals)`,
    ]);
    if (proposalId === selectedProposalId) {
      option.setAttribute('selected', 'selected');
    }
    dropdown.appendChild(option);
  }

  dropdown.addEventListener('change', (e) => {
    const value = (e.target as HTMLSelectElement).value;
    callbacks.onSelectProposal(value || null);
  });

  container.appendChild(dropdown);

  // Show approve button if a proposal is selected
  if (selectedProposalId) {
    const selectedProposal = proposals.find(p => p.node.getId() === selectedProposalId);
    if (selectedProposal) {
      const hasApproved = selectedProposal.approvals.some(a => a.peerId === currentPeerId);

      const approveBtn = button(
        {
          class: `fos-approve-btn ${hasApproved ? 'approved' : ''}`,
          title: hasApproved ? 'Already approved' : 'Approve this proposal',
        },
        [hasApproved ? '✓ Approved' : 'Approve']
      );

      if (!hasApproved) {
        approveBtn.addEventListener('click', () => {
          callbacks.onApprove(selectedProposal);
        });
      } else {
        approveBtn.setAttribute('disabled', 'disabled');
      }

      container.appendChild(approveBtn);

      // Approval status
      const approvalStatus = div({ class: 'fos-approval-status' }, [
        span({ class: 'fos-approval-count' }, [
          String(selectedProposal.approvals.length),
        ]),
        span({}, [`/${members.length || '∞'} approvals`]),
      ]);
      container.appendChild(approvalStatus);
    }
  }

  return container;
}

// ============================================================================
// Field Diff Styling
// ============================================================================

/**
 * Apply diff styling to a field element based on the active proposal.
 * Adds outline and background color based on diff type.
 */
export function applyFieldDiffStyle(
  element: HTMLElement,
  fieldName: string,
  diffs: FieldDiff[],
  proposalColor: string
): void {
  const diff = diffs.find(d => d.field === fieldName);
  if (!diff) return;

  element.classList.add('fos-field-diff');
  element.classList.add(`fos-field-diff--${diff.type}`);
  element.style.setProperty('--proposal-color', proposalColor);
}

/**
 * Apply diff styles to multiple fields based on the active proposal.
 */
export function applyFieldDiffStyles(
  container: HTMLElement,
  diffs: FieldDiff[],
  proposalColor: string,
  fieldElementMap: Record<string, HTMLElement>
): void {
  for (const [fieldName, element] of Object.entries(fieldElementMap)) {
    applyFieldDiffStyle(element, fieldName, diffs, proposalColor);
  }
}

// ============================================================================
// Diff Preview Panel
// ============================================================================

/**
 * Render a diff preview panel showing all changes in a proposal.
 */
export function renderDiffPreview(
  diffs: FieldDiff[],
  proposalColor: string
): HTMLElement {
  const container = div({ class: 'fos-diff-preview' });

  const header = div({ class: 'fos-diff-preview-header' }, [
    span({}, ['Changes']),
    span(
      {
        class: 'fos-proposal-color-dot',
        style: `background-color: ${proposalColor}`,
      }
    ),
  ]);
  container.appendChild(header);

  for (const diff of diffs) {
    const fieldDiv = div({ class: 'fos-diff-field' }, [
      span({ class: 'fos-diff-field-name' }, [diff.field]),
      div({ class: 'fos-diff-field-values' }, [
        diff.currentValue !== undefined
          ? span({ class: 'fos-diff-current' }, [formatValue(diff.currentValue)])
          : span({}),
        diff.proposedValue !== undefined
          ? span({ class: 'fos-diff-proposed' }, [formatValue(diff.proposedValue)])
          : span({}),
      ]),
    ]);
    container.appendChild(fieldDiv);
  }

  return container;
}

// ============================================================================
// Members Indicator
// ============================================================================

/**
 * Render a small indicator showing member count for a node.
 */
export function renderMembersIndicator(memberCount: number): HTMLElement {
  return div({ class: 'fos-members-indicator', title: `${memberCount} members` }, [
    span({ class: 'fos-members-indicator-icon' }, ['👥']),
    span({ class: 'fos-members-indicator-count' }, [String(memberCount)]),
  ]);
}

// ============================================================================
// Propose Button
// ============================================================================

/**
 * Render a "Propose" button that appears on hover.
 */
export function renderProposeButton(
  onPropose: () => void
): HTMLElement {
  const btn = button(
    { class: 'fos-propose-btn', title: 'Propose changes to this node' },
    ['Propose']
  );

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onPropose();
  });

  return btn;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Truncate a peer ID for display (show first 8 chars).
 */
function truncatePeerId(peerId: string): string {
  if (peerId.length <= 12) return peerId;
  return `${peerId.slice(0, 8)}...`;
}

/**
 * Format a value for display in diff preview.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(none)';
  if (typeof value === 'string') return value || '(empty)';
  if (typeof value === 'object') {
    // For nested objects, show a summary
    const json = JSON.stringify(value);
    if (json.length > 50) {
      return json.slice(0, 47) + '...';
    }
    return json;
  }
  return String(value);
}

// ============================================================================
// Integration Helper
// ============================================================================

/**
 * Full proposal UI integration for a row.
 * Call this after rendering a row to add proposal UI elements.
 */
export function integrateProposalUI(
  rowElement: HTMLElement,
  proposals: Proposal[],
  members: string[],
  currentPeerId: string,
  selectedProposalId: string | null,
  descendantColors: string[],
  callbacks: ProposalUICallbacks
): void {
  // Add class if has proposals
  if (proposals.length > 0) {
    rowElement.classList.add('has-proposals');

    // Add proposal borders at the start
    const borders = renderProposalBorders(proposals);
    rowElement.insertBefore(borders, rowElement.firstChild);
  }

  // Add ancestor trail if descendants have proposals
  if (descendantColors.length > 0 && proposals.length === 0) {
    applyAncestorTrail(rowElement, descendantColors);
  }
}
