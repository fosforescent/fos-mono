/**
 * Proposal Module (Branching Model)
 *
 * Proposals work like git branches:
 * - Each proposal has a name (branch name)
 * - User selects which branch to edit
 * - Saving commits to the current branch
 * - Approving merges the branch
 *
 * A proposal is a child node with edges:
 *   - [proposalName, name_node] - branch name
 *   - [proposedContent, content_cid] - the content being edited
 *   - [sender, peer_id_node] - who created the branch
 *   - [timestamp, time_node] - when created
 *   - [previous, base_content_cid] - the base content
 *   - [approval, signature_node_1] - approvals
 *   ...
 *
 * Workflow:
 * 1. Create branch → creates proposal with name, copies current content
 * 2. Select branch → switch to editing that proposal's content
 * 3. Save → updates the proposal's proposedContent
 * 4. Both peers approve → content is merged
 */

import { FosNodeContent, FosPathElem } from '../types';
import { FosExpression } from './expression';
import { FosNode } from './node';
import { FosStore } from './store';
import { getEffectiveMembers } from './membership';

/** Color palette for proposals (derived in UI based on sender) */
export const PROPOSAL_COLORS = [
  '#ff6b6b', // Red
  '#feca57', // Yellow
  '#48dbfb', // Cyan
  '#ff9ff3', // Pink
  '#54a0ff', // Blue
  '#5f27cd', // Purple
] as const;

/**
 * Parsed proposal (branch) from graph structure
 */
export interface Proposal {
  /** The proposal node itself */
  node: FosNode;
  /** Branch/proposal name */
  name: string;
  /** CID of the proposed content (what's being edited) */
  proposedContentCid: string;
  /** The proposed content node */
  proposedContent: FosNode | null;
  /** Creator peer ID */
  senderPeerId: string;
  /** Timestamp when created */
  timestamp: number;
  /** CID of the base content (what it branched from) */
  previousCid: string;
  /** Array of approval signatures */
  approvals: Array<{
    peerId: string;
    signature: string;
  }>;
}

/**
 * Field-level diff between current and proposed content
 */
export interface FieldDiff {
  field: string;
  type: 'added' | 'modified' | 'removed';
  currentValue: unknown;
  proposedValue: unknown;
}

/**
 * Get the proposal constructor CID from a store
 */
function getProposalConstructorId(store: FosStore): string {
  return store.primitive.proposalField.getId();
}

/**
 * Get constructor CIDs for proposal edges
 */
function getConstructorIds(store: FosStore) {
  return {
    proposal: store.primitive.proposalField.getId(),
    proposalName: store.primitive.proposalNameField.getId(),
    proposedContent: store.primitive.proposedContentField.getId(),
    sender: store.primitive.senderField.getId(),
    timestamp: store.primitive.timestampField.getId(),
    previous: store.primitive.previousVersion.getId(),
    approval: store.primitive.approvalField.getId(),
    signature: store.primitive.signatureField.getId(),
  };
}

/**
 * Check if a child edge is a proposal
 */
function isProposalEdge(edge: FosPathElem, store: FosStore): boolean {
  const proposalId = getProposalConstructorId(store);
  return edge[0] === proposalId;
}

/**
 * Parse a proposal node into a structured Proposal object
 */
function parseProposalNode(proposalNode: FosNode, store: FosStore): Proposal | null {
  const ids = getConstructorIds(store);
  const edges = proposalNode.getEdges();

  let name = '';
  let proposedContentCid = '';
  let senderPeerId = '';
  let timestamp = 0;
  let previousCid = '';
  const approvals: Array<{ peerId: string; signature: string }> = [];

  for (const [instrCid, targetCid] of edges) {
    if (instrCid === ids.proposalName) {
      const nameNode = store.getNodeByAddress(targetCid);
      if (nameNode) {
        const desc = nameNode.getData().description?.content;
        if (desc) name = desc;
      }
    } else if (instrCid === ids.proposedContent) {
      proposedContentCid = targetCid;
    } else if (instrCid === ids.sender) {
      // The target is a node containing the peer ID in its data
      const senderNode = store.getNodeByAddress(targetCid);
      if (senderNode) {
        const desc = senderNode.getData().description?.content;
        if (desc) senderPeerId = desc;
      }
    } else if (instrCid === ids.timestamp) {
      const timeNode = store.getNodeByAddress(targetCid);
      if (timeNode) {
        const desc = timeNode.getData().description?.content;
        if (desc) timestamp = parseInt(desc, 10) || 0;
      }
    } else if (instrCid === ids.previous) {
      previousCid = targetCid;
    } else if (instrCid === ids.approval) {
      // Each approval points to a signature node
      const sigNode = store.getNodeByAddress(targetCid);
      if (sigNode) {
        // The signature node has [sender, peerIdNode] and [signature, sigDataNode]
        const sigEdges = sigNode.getEdges();
        let approverId = '';
        let signature = '';
        for (const [sigInstr, sigTarget] of sigEdges) {
          if (sigInstr === ids.sender) {
            const approverNode = store.getNodeByAddress(sigTarget);
            if (approverNode) {
              approverId = approverNode.getData().description?.content || '';
            }
          } else if (sigInstr === ids.signature) {
            const sigDataNode = store.getNodeByAddress(sigTarget);
            if (sigDataNode) {
              signature = sigDataNode.getData().description?.content || '';
            }
          }
        }
        if (approverId && signature) {
          approvals.push({ peerId: approverId, signature });
        }
      }
    }
  }

  if (!proposedContentCid || !senderPeerId || !previousCid) {
    return null; // Invalid proposal
  }

  const proposedContent = store.getNodeByAddress(proposedContentCid);

  return {
    node: proposalNode,
    name,
    proposedContentCid,
    proposedContent,
    senderPeerId,
    timestamp,
    previousCid,
    approvals,
  };
}

/**
 * Proposal Manager for working with graph-based proposals
 */
export class ProposalManager {
  private store: FosStore;

  constructor(store: FosStore) {
    this.store = store;
  }

  /**
   * Get all proposals for a node (proposals are children with proposal constructor)
   */
  getProposalsForNode(expression: FosExpression): Proposal[] {
    const proposals: Proposal[] = [];
    const edges = expression.targetNode.getEdges();
    const proposalId = getProposalConstructorId(this.store);

    for (const [instrCid, targetCid] of edges) {
      if (instrCid === proposalId) {
        const proposalNode = this.store.getNodeByAddress(targetCid);
        if (proposalNode) {
          const parsed = parseProposalNode(proposalNode, this.store);
          if (parsed) {
            proposals.push(parsed);
          }
        }
      }
    }

    return proposals;
  }

  /**
   * Create a new proposal (branch) for changes to a node
   *
   * @param expression - The expression to propose changes for
   * @param proposedContent - The proposed new content node
   * @param senderPeerId - The peer ID of the proposer
   * @param name - Branch/proposal name
   * @returns The created proposal
   */
  createProposal(
    expression: FosExpression,
    proposedContent: FosNode,
    senderPeerId: string,
    name: string
  ): Proposal {
    const ids = getConstructorIds(this.store);
    const currentTargetCid = expression.targetNode.getId();

    // Create name node (contains branch name in description)
    const nameNode = this.store.create({
      data: { description: { content: name } },
      children: [],
    });

    // Create sender node (contains peer ID in description)
    const senderNode = this.store.create({
      data: { description: { content: senderPeerId } },
      children: [],
    });

    // Create timestamp node
    const timestampNode = this.store.create({
      data: { description: { content: String(Date.now()) } },
      children: [],
    });

    // Create the proposal node with edges
    const proposalEdges: FosPathElem[] = [
      [ids.proposalName, nameNode.getId()],
      [ids.proposedContent, proposedContent.getId()],
      [ids.sender, senderNode.getId()],
      [ids.timestamp, timestampNode.getId()],
      [ids.previous, currentTargetCid],
    ];

    const proposalNode = this.store.create({
      data: {},
      children: proposalEdges,
    });

    // Add the proposal as a child of the current target node
    const newTargetNode = expression.targetNode.addEdge(
      ids.proposal,
      proposalNode.getId()
    );
    expression.setTargetNode(newTargetNode);

    return {
      node: proposalNode,
      name,
      proposedContentCid: proposedContent.getId(),
      proposedContent,
      senderPeerId,
      timestamp: Date.now(),
      previousCid: currentTargetCid,
      approvals: [],
    };
  }

  /**
   * Update the content of an existing proposal (commit to branch)
   * This is called when saving while a proposal/branch is selected.
   *
   * @param expression - The expression containing the proposal
   * @param proposalNodeCid - The CID of the proposal to update
   * @param newContent - The new content node to set
   * @returns The updated proposal
   */
  updateProposalContent(
    expression: FosExpression,
    proposalNodeCid: string,
    newContent: FosNode
  ): Proposal {
    const ids = getConstructorIds(this.store);
    const proposalNode = this.store.getNodeByAddress(proposalNodeCid);
    if (!proposalNode) {
      throw new Error(`Proposal not found: ${proposalNodeCid}`);
    }

    // Get existing edges, replacing the proposedContent edge
    const existingEdges = proposalNode.getEdges();
    const newEdges = existingEdges.map(([instr, target]) => {
      if (instr === ids.proposedContent) {
        return [instr, newContent.getId()] as FosPathElem;
      }
      return [instr, target] as FosPathElem;
    });

    // Create updated proposal node
    const newProposalNode = this.store.create({
      data: proposalNode.getData(),
      children: newEdges,
    });

    // Update the parent to point to the new proposal node
    const currentEdges = expression.targetNode.getEdges();
    const updatedParentEdges = currentEdges.map(([instr, target]) => {
      if (instr === ids.proposal && target === proposalNodeCid) {
        return [instr, newProposalNode.getId()] as FosPathElem;
      }
      return [instr, target] as FosPathElem;
    });

    const newTargetNode = expression.targetNode.mutate({
      ...expression.targetNode.getContent(),
      children: updatedParentEdges,
    });
    expression.setTargetNode(newTargetNode);

    // Re-parse and return the updated proposal
    const parsed = parseProposalNode(newProposalNode, this.store);
    if (!parsed) {
      throw new Error('Failed to parse updated proposal');
    }
    return parsed;
  }

  /**
   * Get a proposal by its CID from an expression's children
   */
  getProposalById(expression: FosExpression, proposalNodeCid: string): Proposal | null {
    const proposalNode = this.store.getNodeByAddress(proposalNodeCid);
    if (!proposalNode) {
      return null;
    }
    return parseProposalNode(proposalNode, this.store);
  }

  /**
   * Get a proposal by its branch name
   */
  getProposalByName(expression: FosExpression, name: string): Proposal | null {
    const proposals = this.getProposalsForNode(expression);
    return proposals.find(p => p.name === name) || null;
  }

  /**
   * Add an approval to a proposal
   */
  addApproval(
    expression: FosExpression,
    proposalNodeCid: string,
    peerId: string,
    signature: string
  ): void {
    const ids = getConstructorIds(this.store);
    const proposalNode = this.store.getNodeByAddress(proposalNodeCid);
    if (!proposalNode) {
      throw new Error(`Proposal not found: ${proposalNodeCid}`);
    }

    // Create peer ID node for this approval
    const approverNode = this.store.create({
      data: { description: { content: peerId } },
      children: [],
    });

    // Create signature data node
    const signatureDataNode = this.store.create({
      data: { description: { content: signature } },
      children: [],
    });

    // Create approval node with sender and signature edges
    const approvalNode = this.store.create({
      data: {},
      children: [
        [ids.sender, approverNode.getId()],
        [ids.signature, signatureDataNode.getId()],
      ],
    });

    // Add approval edge to proposal node
    const newProposalNode = proposalNode.addEdge(ids.approval, approvalNode.getId());

    // Update the parent to point to the new proposal node
    const currentEdges = expression.targetNode.getEdges();
    const newEdges = currentEdges.map(([instr, target]) => {
      if (instr === ids.proposal && target === proposalNodeCid) {
        return [instr, newProposalNode.getId()] as FosPathElem;
      }
      return [instr, target] as FosPathElem;
    });

    const newTargetNode = expression.targetNode.mutate({
      ...expression.targetNode.getContent(),
      children: newEdges,
    });
    expression.setTargetNode(newTargetNode);
  }

  /**
   * Check if a proposal has unanimous approval from all members
   */
  hasUnanimousApproval(proposal: Proposal, members: string[]): boolean {
    if (members.length === 0) {
      // No members defined = unrestricted, auto-approve
      return true;
    }

    const approvedPeerIds = new Set(proposal.approvals.map(a => a.peerId));
    return members.every(memberId => approvedPeerIds.has(memberId));
  }

  /**
   * Apply a proposal - the proposal node becomes the new content
   * The proposal already has `previous` pointing to the old content
   */
  applyProposal(expression: FosExpression, proposalNodeCid: string): boolean {
    const ids = getConstructorIds(this.store);
    const proposalNode = this.store.getNodeByAddress(proposalNodeCid);
    if (!proposalNode) {
      throw new Error(`Proposal not found: ${proposalNodeCid}`);
    }

    const proposal = parseProposalNode(proposalNode, this.store);
    if (!proposal) {
      throw new Error('Invalid proposal structure');
    }

    const members = getEffectiveMembers(expression);
    if (!this.hasUnanimousApproval(proposal, members)) {
      return false;
    }

    // The proposal node (with all metadata: sender, time, approvals, previous)
    // becomes the new target. We merge the proposed content's data/children
    // with the proposal's metadata edges.

    // Get the proposed content
    const proposedContent = proposal.proposedContent;
    if (!proposedContent) {
      throw new Error('Proposed content not found');
    }

    // Create the final node: proposed content data + proposal metadata edges
    const proposedData = proposedContent.getData();
    const proposedChildren = proposedContent.getEdges();

    // Keep the proposal metadata edges (sender, timestamp, previous, approvals)
    // but replace proposedContent with the actual content
    const proposalEdges = proposalNode.getEdges().filter(([instr]) => {
      // Keep everything except proposedContent (that's now merged)
      return instr !== ids.proposedContent;
    });

    const finalNode = this.store.create({
      data: proposedData,
      children: [...proposedChildren, ...proposalEdges],
    });

    // Remove the proposal from the parent and update target to new node
    const parent = expression.getParentDirect();
    if (parent) {
      // Update parent's edge to point to the final node instead of old target
      const parentEdges = parent.targetNode.getEdges();
      const newParentEdges = parentEdges.map(([instr, target]) => {
        if (target === expression.targetNode.getId()) {
          return [instr, finalNode.getId()] as FosPathElem;
        }
        return [instr, target] as FosPathElem;
      });

      const newParentTarget = parent.targetNode.mutate({
        ...parent.targetNode.getContent(),
        children: newParentEdges,
      });
      parent.setTargetNode(newParentTarget);
    }

    return true;
  }

  /**
   * Remove a proposal without applying it
   */
  removeProposal(expression: FosExpression, proposalNodeCid: string): void {
    const ids = getConstructorIds(this.store);
    const currentEdges = expression.targetNode.getEdges();

    const newEdges = currentEdges.filter(([instr, target]) => {
      return !(instr === ids.proposal && target === proposalNodeCid);
    });

    const newTargetNode = expression.targetNode.mutate({
      ...expression.targetNode.getContent(),
      children: newEdges,
    });
    expression.setTargetNode(newTargetNode);
  }

  /**
   * Compute the diff between current and proposed content
   */
  computeDiff(current: FosNodeContent, proposed: FosNodeContent): FieldDiff[] {
    const diffs: FieldDiff[] = [];

    const currentData = current.data;
    const proposedData = proposed.data;

    // Get all unique keys from both objects
    const allKeys = new Set([
      ...Object.keys(currentData),
      ...Object.keys(proposedData),
    ]);

    for (const key of allKeys) {
      // Skip internal fields
      if (key === 'members') continue;

      const currentValue = (currentData as Record<string, unknown>)[key];
      const proposedValue = (proposedData as Record<string, unknown>)[key];

      if (currentValue === undefined && proposedValue !== undefined) {
        diffs.push({
          field: key,
          type: 'added',
          currentValue,
          proposedValue,
        });
      } else if (currentValue !== undefined && proposedValue === undefined) {
        diffs.push({
          field: key,
          type: 'removed',
          currentValue,
          proposedValue,
        });
      } else if (JSON.stringify(currentValue) !== JSON.stringify(proposedValue)) {
        diffs.push({
          field: key,
          type: 'modified',
          currentValue,
          proposedValue,
        });
      }
    }

    // Compare children
    if (JSON.stringify(current.children) !== JSON.stringify(proposed.children)) {
      diffs.push({
        field: 'children',
        type: 'modified',
        currentValue: current.children,
        proposedValue: proposed.children,
      });
    }

    return diffs;
  }

  /**
   * Check if a node has any proposals
   */
  hasProposals(expression: FosExpression): boolean {
    const edges = expression.targetNode.getEdges();
    const proposalId = getProposalConstructorId(this.store);
    return edges.some(([instr]) => instr === proposalId);
  }

  /**
   * Check if any descendant has proposals
   */
  hasDescendantProposals(expression: FosExpression, visited = new Set<string>()): boolean {
    const nodeId = expression.targetNode.getId();
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);

    if (this.hasProposals(expression)) {
      return true;
    }

    const children = expression.getTargetChildren();
    for (const child of children) {
      if (this.hasDescendantProposals(child, visited)) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Create a ProposalManager for a store
 */
export function createProposalManager(store: FosStore): ProposalManager {
  return new ProposalManager(store);
}
