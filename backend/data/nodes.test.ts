import type { Request, Response } from 'express'
import { prisma } from '../prismaClient'
import { getNodeByCid, getNodesByCids } from './index'

jest.mock('../prismaClient', () => ({ prisma: {
  userModel: { findUnique: jest.fn() },
  fosNodeUserAccessLinkModel: { findFirst: jest.fn(), findMany: jest.fn() }
} }))
jest.mock('../util', () => ({}))
jest.mock('@fosforescent/infra/qdrant', () => ({}))
jest.mock('./runActions', () => ({}))

const db = prisma as unknown as {
  userModel: { findUnique: jest.Mock },
  fosNodeUserAccessLinkModel: { findFirst: jest.Mock, findMany: jest.Mock }
}
function response() {
  const res = { status: jest.fn(), json: jest.fn() }
  res.status.mockReturnValue(res)
  res.json.mockReturnValue(res)
  return res
}
const request = (fields: object) => ({ claims: { username: 'alice' }, ...fields }) as Request
beforeEach(() => {
  jest.resetAllMocks()
  db.userModel.findUnique.mockResolvedValue({ id: 7 })
})

test('single-node reads use the authenticated user access relation', async () => {
  const data = { description: 'accessible' }
  db.fosNodeUserAccessLinkModel.findFirst.mockResolvedValue({ fosTargetNode: { cid: 'allowed', data } })
  const res = response()
  await getNodeByCid(request({ params: { cid: 'allowed' } }), res as unknown as Response)
  expect(db.userModel.findUnique).toHaveBeenCalledWith({ where: { user_name: 'alice' }, include: { fosNode: true } })
  expect(db.fosNodeUserAccessLinkModel.findFirst).toHaveBeenCalledWith({
    where: { userId: 7, fosTargetNode: { cid: 'allowed' } }, include: { fosTargetNode: true }
  })
  expect(res.json).toHaveBeenCalledWith({ cid: 'allowed', content: data })
})

test('a node without a user access link is not disclosed', async () => {
  db.fosNodeUserAccessLinkModel.findFirst.mockResolvedValue(null)
  const res = response()
  await getNodeByCid(request({ params: { cid: 'private' } }), res as unknown as Response)
  expect(res.status).toHaveBeenCalledWith(404)
})

test('batch reads return only accessible requested nodes', async () => {
  db.fosNodeUserAccessLinkModel.findMany.mockResolvedValue([{ fosTargetNode: { cid: 'allowed', data: { name: 'A' } } }])
  const res = response()
  await getNodesByCids(request({ query: { cids: 'allowed, private' } }), res as unknown as Response)
  expect(db.fosNodeUserAccessLinkModel.findMany).toHaveBeenCalledWith({
    where: { userId: 7, fosTargetNode: { cid: { in: ['allowed', 'private'] } } }, include: { fosTargetNode: true }
  })
  expect(res.json).toHaveBeenCalledWith({ nodes: { allowed: { name: 'A' } } })
})

test.each([getNodeByCid, getNodesByCids])('unknown users cannot read nodes', async handler => {
  db.userModel.findUnique.mockResolvedValue(null)
  const res = response()
  await handler(request({ params: { cid: 'private' }, query: { cids: 'private' } }), res as unknown as Response)
  expect(res.status).toHaveBeenCalledWith(401)
  expect(db.fosNodeUserAccessLinkModel.findFirst).not.toHaveBeenCalled()
  expect(db.fosNodeUserAccessLinkModel.findMany).not.toHaveBeenCalled()
})
