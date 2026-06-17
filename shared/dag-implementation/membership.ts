/**
 * Membership Module
 *
 * Handles member inheritance and membership checking for peer consensus.
 * Members are defined at any node level via member edges pointing to peer reference nodes.
 * Membership is inherited down the tree.
 *
 * Graph structure:
 * ROOT
 * ├── [peerField, peerNode1]      // Peer reference stored at root
 * ├── [peerField, peerNode2]
 * └── [aliasField, content]
 *     └── TaskA
 *         ├── [memberField, peerNode1]  // Member edge points to peer ref
 *         ├── [memberField, peerNode2]
 *         └── TaskA1                    // Inherits membership from TaskA
 */

import { FosExpression } from './expression';
import { FosNode } from './node';
import { FosStore } from './store';

/**
 * Peer reference structure stored in peer node data
 */
export interface PeerReference {
  peerId: string;
  publicKey?: string;
  name?: string;
  sdpOffer?: string;
  lastSeen?: number;
  active?: boolean;
}

/**
 * Get all peer reference nodes from the root
 */
export function getPeerReferences(store: FosStore): Array<{ node: FosNode; peer: PeerReference }> {
  const rootExpr = new FosExpression(store, []);
  const peerFieldCid = store.primitive.peerField.getId();
  const edges = rootExpr.targetNode.getEdges();

  const peers: Array<{ node: FosNode; peer: PeerReference }> = [];

  for (const [instrCid, targetCid] of edges) {
    if (instrCid === peerFieldCid) {
      const peerNode = store.getNodeByAddress(targetCid);
      if (peerNode) {
        const data = peerNode.getData();
        const peerId = data.peerId?.content || data.description?.content || targetCid.slice(0, 12);
        peers.push({
          node: peerNode,
          peer: {
            peerId,
            publicKey: data.publicKey?.content,
            name: data.name?.content,
            sdpOffer: data.peerSdpOffer?.content,
            lastSeen: data.peerSdpOffer?.timestamp,
            active: data.peerSdpOffer?.active ?? true,
          }
        });
      }
    }
  }

  return peers;
}

/**
 * Update a peer reference with connection info (SDP offer, active status)
 */
export function updatePeerConnection(
  store: FosStore,
  peerId: string,
  updates: { sdpOffer?: string; active?: boolean }
): void {
  const peers = getPeerReferences(store);
  const peerRef = peers.find(p => p.peer.peerId === peerId);
  if (!peerRef) return;

  const currentData = peerRef.node.getData();
  const newPeerSdpOffer = {
    content: updates.sdpOffer ?? currentData.peerSdpOffer?.content ?? '',
    timestamp: Date.now(),
    active: updates.active ?? currentData.peerSdpOffer?.active ?? true,
  };

  const newPeerNode = store.create({
    data: {
      ...currentData,
      peerSdpOffer: newPeerSdpOffer,
    },
    children: peerRef.node.getEdges(),
  });

  // Update root to point to new peer node
  const rootExpr = new FosExpression(store, []);
  const peerFieldCid = store.primitive.peerField.getId();
  const currentEdges = rootExpr.targetNode.getEdges();

  const newEdges = currentEdges.map(([instr, target]) => {
    if (instr === peerFieldCid && target === peerRef.node.getId()) {
      return [instr, newPeerNode.getId()] as [string, string];
    }
    return [instr, target] as [string, string];
  });

  const newRootNode = store.create({
    data: rootExpr.targetNode.getData(),
    children: newEdges,
  });

  rootExpr.setTargetNode(newRootNode);
}

/**
 * Find or create a peer reference node at root for the given peer ID
 */
export function getOrCreatePeerReference(store: FosStore, peerId: string, publicKey?: string): FosNode {
  // Check if peer already exists
  const existing = getPeerReferences(store);
  const found = existing.find(p => p.peer.peerId === peerId);
  if (found) {
    return found.node;
  }

  // Create new peer reference node
  const peerNode = store.create({
    data: {
      peerId: { content: peerId },
      publicKey: publicKey ? { content: publicKey } : undefined,
    },
    children: [],
  });

  // Add to root
  const rootExpr = new FosExpression(store, []);
  const peerFieldCid = store.primitive.peerField.getId();
  const currentEdges = rootExpr.targetNode.getEdges();

  const newRootNode = store.create({
    data: rootExpr.targetNode.getData(),
    children: [...currentEdges, [peerFieldCid, peerNode.getId()]],
  });

  rootExpr.setTargetNode(newRootNode);

  return peerNode;
}

/**
 * Get member peer IDs for a node by following member edges to peer references.
 * Does NOT inherit - only returns members directly on this node.
 */
export function getDirectMembers(expression: FosExpression): string[] {
  const store = expression.store;
  const memberFieldCid = store.primitive.memberField.getId();
  const edges = expression.targetNode.getEdges();

  const members: string[] = [];

  for (const [instrCid, targetCid] of edges) {
    if (instrCid === memberFieldCid) {
      // targetCid points to a peer reference node
      const peerNode = store.getNodeByAddress(targetCid);
      if (peerNode) {
        const data = peerNode.getData();
        const peerId = data.peerId?.content || targetCid.slice(0, 12);
        members.push(peerId);
      }
    }
  }

  return members;
}

/**
 * Get the effective members for an expression by walking up the parent chain.
 * Returns the first members definition found, or empty array if unrestricted.
 *
 * @param expression - The expression to get members for
 * @returns Array of peer IDs who are members, or empty if unrestricted
 */
export function getEffectiveMembers(expression: FosExpression): string[] {
  let current: FosExpression | null = expression;

  while (current !== null) {
    const members = getDirectMembers(current);
    if (members.length > 0) {
      return members;
    }

    // Also check the old inline format for backwards compatibility
    const data = current.targetNode.getData();
    if (data.members && data.members.peerIds && data.members.peerIds.length > 0) {
      return data.members.peerIds;
    }

    current = current.getParentDirect();
  }

  // No members defined anywhere in ancestor chain = unrestricted
  return [];
}

/**
 * Check if a peer is a member of the effective membership for an expression.
 * If no members are defined (unrestricted), returns true for any peer.
 *
 * @param expression - The expression to check membership for
 * @param peerId - The peer ID to check
 * @returns true if the peer is a member or if the node is unrestricted
 */
export function isMember(expression: FosExpression, peerId: string): boolean {
  const members = getEffectiveMembers(expression);
  // Empty members array means unrestricted - anyone can participate
  return members.length === 0 || members.includes(peerId);
}

/**
 * Get the path to the node that defines membership for this expression.
 * Useful for showing where membership is defined in the UI.
 *
 * @param expression - The expression to find membership definition for
 * @returns The expression that defines membership, or null if unrestricted
 */
export function getMembershipSource(expression: FosExpression): FosExpression | null {
  let current: FosExpression | null = expression;

  while (current !== null) {
    const members = getDirectMembers(current);
    if (members.length > 0) {
      return current;
    }

    // Also check old inline format
    const data = current.targetNode.getData();
    if (data.members && data.members.peerIds && data.members.peerIds.length > 0) {
      return current;
    }

    current = current.getParentDirect();
  }

  return null;
}

/**
 * Add a member to a node by creating a member edge to the peer reference.
 * Creates the peer reference at root if it doesn't exist.
 *
 * @param expression - The expression to add member to
 * @param peerId - The peer ID to add
 * @param publicKey - Optional public key for new peer references
 */
export function addMember(expression: FosExpression, peerId: string, publicKey?: string): void {
  const store = expression.store;

  // Get or create the peer reference at root
  const peerNode = getOrCreatePeerReference(store, peerId, publicKey);

  // Check if already a member
  const memberFieldCid = store.primitive.memberField.getId();
  const currentEdges = expression.targetNode.getEdges();
  const alreadyMember = currentEdges.some(
    ([instr, target]) => instr === memberFieldCid && target === peerNode.getId()
  );

  if (!alreadyMember) {
    // Add member edge
    const newNode = store.create({
      data: expression.targetNode.getData(),
      children: [...currentEdges, [memberFieldCid, peerNode.getId()]],
    });
    expression.setTargetNode(newNode);
  }
}

/**
 * Remove a member from a node.
 *
 * @param expression - The expression to remove member from
 * @param peerId - The peer ID to remove
 */
export function removeMember(expression: FosExpression, peerId: string): void {
  const store = expression.store;
  const memberFieldCid = store.primitive.memberField.getId();
  const currentEdges = expression.targetNode.getEdges();

  // Find the peer reference node for this peerId
  const peers = getPeerReferences(store);
  const peerRef = peers.find(p => p.peer.peerId === peerId);
  if (!peerRef) return;

  // Remove the member edge
  const newEdges = currentEdges.filter(
    ([instr, target]) => !(instr === memberFieldCid && target === peerRef.node.getId())
  );

  if (newEdges.length !== currentEdges.length) {
    const newNode = store.create({
      data: expression.targetNode.getData(),
      children: newEdges,
    });
    expression.setTargetNode(newNode);
  }
}

/**
 * Set members for a node (replaces all existing member edges).
 *
 * @param expression - The expression to set members on
 * @param peerIds - Array of peer IDs to set as members
 */
export function setMembers(expression: FosExpression, peerIds: string[]): void {
  const store = expression.store;
  const memberFieldCid = store.primitive.memberField.getId();
  const currentEdges = expression.targetNode.getEdges();

  // Remove existing member edges
  const nonMemberEdges = currentEdges.filter(([instr]) => instr !== memberFieldCid);

  // Add new member edges
  const newMemberEdges: [string, string][] = peerIds.map(peerId => {
    const peerNode = getOrCreatePeerReference(store, peerId);
    return [memberFieldCid, peerNode.getId()];
  });

  const newNode = store.create({
    data: expression.targetNode.getData(),
    children: [...nonMemberEdges, ...newMemberEdges],
  });
  expression.setTargetNode(newNode);
}

/**
 * Get all nodes that have a specific peer as a member.
 * Useful for determining what to sync with a peer.
 */
export function getNodesWithMember(store: FosStore, peerId: string): FosExpression[] {
  // This would require traversing the entire graph
  // For now, we'll implement a simpler version that checks from root
  const results: FosExpression[] = [];

  const visited = new Set<string>();
  const queue: FosExpression[] = [new FosExpression(store, [])];

  while (queue.length > 0) {
    const expr = queue.shift()!;
    const nodeCid = expr.targetNode.getId();

    if (visited.has(nodeCid)) continue;
    visited.add(nodeCid);

    // Check if this node has the peer as a member
    if (isMember(expr, peerId)) {
      // Also check if membership is defined at THIS node (not inherited)
      const directMembers = getDirectMembers(expr);
      if (directMembers.includes(peerId)) {
        results.push(expr);
      }
    }

    // Add children to queue
    for (const child of expr.getTargetChildren()) {
      queue.push(child);
    }
  }

  return results;
}
