/**
 * The system account that owns the standard library (sync/library.ts). It is an ordinary account row with an
 * unusable password (nobody signs in as it; the server edits its store as the owner), created once at startup when
 * `FOS_LIBRARY_OWNER` (default `fos-library`) does not exist yet.
 */
import { randomBytes } from 'node:crypto'
import { FosStore, hashContent } from '@fosforescent/shared/dag-implementation/store'
import { verifyCid } from '@fosforescent/shared/dag-implementation/cid'
import { prisma } from './prismaClient'
import { hashPassword } from './auth/register'
import { validateNodeDataToDB } from './util'

export const libraryOwner = () => process.env.FOS_LIBRARY_OWNER || 'fos-library'

export async function createSystemAccount(username: string): Promise<void> {
  if (await prisma.userModel.findUnique({ where: { user_name: username }, select: { id: true } })) return
  const store = new FosStore()
  const ids = Array.from(store.table.keys())
  const existing = new Set((await prisma.fosNodeModel.findMany({ where: { cid: { in: ids } }, select: { cid: true } })).map((n: { cid: string }) => n.cid))
  const entries = Array.from(store.table.entries()).flatMap(([cid, node]) => {
    if (!verifyCid(cid, node)) throw new Error("Hashes don't match")
    return existing.has(cid) ? [] : [{ cid, data: validateNodeDataToDB(node) }]
  })
  if (entries.length) await prisma.fosNodeModel.createMany({ data: entries })
  const aliasData = { alias: { id: randomBytes(16).toString('hex') } }
  const aliasCid = hashContent({ data: aliasData, children: [[store.rootNodeId, store.rootNodeId]] as [string, string][] })
  await prisma.fosNodeModel.create({ data: { cid: aliasCid, data: aliasData } })
  const user = await prisma.userModel.create({
    data: {
      user_name: username,
      password: await hashPassword(randomBytes(32).toString('hex')),
      subscription_status: 'inactive', user_profile: {}, password_reset_expiration: new Date(), accepted_terms: new Date(),
      api_calls_available: 0, api_calls_used: 0, api_calls_total: 0,
      approved: true, cookies: false,
      fosNodeId: aliasCid,
      FosNodeUserAccessLink: { create: { fosNodeId: aliasCid } }
    }
  })
  if (entries.length) await prisma.fosNodeUserAccessLinkModel.createMany({ data: entries.map(n => ({ fosNodeId: n.cid, userId: user.id })) })
  console.log(`[library] created the system account @${username}`)
}
