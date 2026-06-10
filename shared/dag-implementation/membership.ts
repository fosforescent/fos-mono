/**
 * Membership Module
 *
 * Handles member inheritance and membership checking for peer consensus.
 * Members are defined at any node level and inherited down the tree.
 */

import { FosExpression } from './expression';

/**
 * Get the effective members for an expression by walking up the parent chain.
 * Returns the first members definition found, or empty array if unrestricted.
 *
 * @param expression - The expression to get members for
 * @returns Array of peer IDs (public keys) who are members, or empty if unrestricted
 */
export function getEffectiveMembers(expression: FosExpression): string[] {
  let current: FosExpression | null = expression;

  while (current !== null) {
    const members = current.targetNode.getData().members;
    if (members && members.peerIds.length > 0) {
      return members.peerIds;
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
 * @param peerId - The peer ID (public key) to check
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
    const members = current.targetNode.getData().members;
    if (members && members.peerIds.length > 0) {
      return current;
    }
    current = current.getParentDirect();
  }

  return null;
}

/**
 * Set members for a node. This will affect all descendants that don't have
 * their own members definition.
 *
 * Note: Since nodes are immutable, this creates a new node with the updated
 * members. The caller must handle updating parent references.
 *
 * @param expression - The expression to set members on
 * @param peerIds - Array of peer IDs (public keys) to set as members
 * @returns The new target node with updated members
 */
export function setMembers(expression: FosExpression, peerIds: string[]): void {
  const newNode = expression.targetNode.updateData({
    members: { peerIds }
  });
  // Update the expression's target node reference
  // The parent will need to be updated with the new node CID
  expression.setTargetNode(newNode);
}

/**
 * Add a member to a node's membership list.
 * Creates the members field if it doesn't exist.
 *
 * @param expression - The expression to add member to
 * @param peerId - The peer ID to add
 */
export function addMember(expression: FosExpression, peerId: string): void {
  const currentData = expression.targetNode.getData();
  const currentMembers = currentData.members?.peerIds ?? [];

  if (!currentMembers.includes(peerId)) {
    const newNode = expression.targetNode.updateData({
      members: { peerIds: [...currentMembers, peerId] }
    });
    expression.setTargetNode(newNode);
  }
}

/**
 * Remove a member from a node's membership list.
 *
 * @param expression - The expression to remove member from
 * @param peerId - The peer ID to remove
 */
export function removeMember(expression: FosExpression, peerId: string): void {
  const currentData = expression.targetNode.getData();
  const currentMembers = currentData.members?.peerIds ?? [];

  const newMembers = currentMembers.filter(id => id !== peerId);

  if (newMembers.length === 0) {
    // Set members to undefined to remove the field
    const newNode = expression.targetNode.updateData({
      members: undefined
    });
    expression.setTargetNode(newNode);
  } else {
    const newNode = expression.targetNode.updateData({
      members: { peerIds: newMembers }
    });
    expression.setTargetNode(newNode);
  }
}
