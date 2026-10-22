/**
 * The fos `approve` handler (shared/sync/approvals.ts): an `approve` requirement on a group's node, its text the
 * branch, approves that pull request (the `branch:<name>` submission there) as the account running it. The approval
 * is a row of the branch, signed with this server's identity key (the key `verify` uses, published on the fos member
 * entry of every account's root); keypairs held by peers replace it for p2p. The group's merge rule (its
 * `approveMerge` row, else every editor and the owner) is then checked, and the branch merged into main when it holds.
 */
import { sign } from 'node:crypto'
import { addSupply, approveSubmission, mergeIfApproved, publishedKeys } from '@fosforescent/shared/sync/index'
import { standardHostRef, type HostHandler } from './host-runtime'
import { verifyEd25519, type IdentityKey } from './verify'

/** The branch an approve requirement names: its text, without a leading `approve`. */
export function approvedBranch(title: string): string {
  return title.replace(/^\s*-?\s*approve\b:?\s*/i, '').trim()
}

export function approveHandler(key: IdentityKey, peer = 'fos'): HostHandler {
  const signer = { by: peer, sign: (payload: string) => sign(null, Buffer.from(payload), key.privateKey).toString('base64') }
  return {
    peerId: peer, ref: standardHostRef(peer, 'approve'),
    async effect(ctx) {
      const path = ctx.step.path, at = path.slice(0, -1), branch = approvedBranch(ctx.step.row?.title ?? '')
      if (!branch) throw new Error('Name the branch to approve: "approve <branch>".')
      const name = branch, now = ctx.now()
      const approved = approveSubmission(ctx.replica(), at, name, `user:${ctx.username}`, signer, now)
      const { replica } = mergeIfApproved(approved, at, name, { ...publishedKeys(approved), [peer]: key.publicKey }, verifyEd25519, now)
      await ctx.update(addSupply(replica, at, path.at(-1)!, { capability: 'approve', by: peer, ref: name }, now))
    }
  }
}
