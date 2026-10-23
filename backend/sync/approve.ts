/**
 * The fos `approve` handler (shared/sync/approvals.ts): it attests the approvals this server records for the
 * accounts it serves (a member deciding on a submission through the event grammar's `decide`), signed with its
 * identity key, the key `verify` uses and publishes on the fos member entry of every account's root. Anyone can then
 * check that the approval was given (`verifyApproval`). Keypairs held by peers replace it for p2p.
 */
import { sign } from 'node:crypto'
import { attesterKey, type Attester, type Replica } from '@fosforescent/shared/sync/index'
import { standardHostRef, type HostHandler } from './host-runtime'
import type { IdentityKey } from './verify'

export function approveHandler(key: IdentityKey, peer = 'fos'): HostHandler {
  return {
    peerId: peer, ref: standardHostRef(peer, 'approve'),
    attester(replica: Replica): Attester | null {
      // the key row this server publishes in this account: what an approval's signature row has on its left
      const node = attesterKey(replica, peer)
      return node ? { key: node, sign: payload => sign(null, Buffer.from(payload), key.privateKey).toString('base64') } : null
    }
  }
}
