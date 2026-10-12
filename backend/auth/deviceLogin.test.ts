import type { Request, Response } from 'express'
import * as jsonwebtoken from 'jsonwebtoken'
const jwtVerify: typeof jsonwebtoken.verify = jsonwebtoken.verify ?? (jsonwebtoken as unknown as { default: typeof jsonwebtoken }).default.verify

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
process.env.WEB_URL = 'https://app.example'

import { deviceLoginHandlers, _resetDeviceLogins } from './deviceLogin'

type Sent = { status: number; body: any }
function fakeRes(): { res: Response; sent: () => Sent } {
  const state: Sent = { status: 200, body: undefined }
  const res = {
    status(code: number) { state.status = code; return res },
    json(body: unknown) { state.body = body; return res }
  } as unknown as Response
  return { res, sent: () => state }
}
const req = (body: unknown, claims: unknown = null, params: Record<string, string> = {}, query: Record<string, string> = {}): Request =>
  ({ body, claims, params, query } as unknown as Request)

beforeEach(() => _resetDeviceLogins())

test('a device gets a code, the browser approves it, the device receives a user jwt once', () => {
  const start = fakeRes()
  deviceLoginHandlers.start(req({ name: 'laptop' }), start.res)
  const { code, verifyUrl } = start.sent().body
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  expect(verifyUrl).toBe(`https://app.example/?device=${encodeURIComponent(code)}`)

  const pending = fakeRes()
  deviceLoginHandlers.poll(req(null, null, {}, { code }), pending.res)
  expect(pending.sent().body).toEqual({ status: 'pending' })

  // the browser (signed in as alice) looks the code up, with sloppy formatting, then approves
  const describe = fakeRes()
  deviceLoginHandlers.describe(req(null, { username: 'alice' }, { code: code.toLowerCase().replace('-', ' ') }), describe.res)
  expect(describe.sent().body).toEqual({ code, name: 'laptop', status: 'pending' })
  const approve = fakeRes()
  deviceLoginHandlers.approve(req(null, { username: 'alice' }, { code }), approve.res)
  expect(approve.sent().body).toEqual({ approved: true, name: 'laptop' })

  const done = fakeRes()
  deviceLoginHandlers.poll(req(null, null, {}, { code }), done.res)
  expect(done.sent().body.status).toBe('approved')
  expect(done.sent().body.username).toBe('alice')
  const claims = jwtVerify(done.sent().body.jwt, 'test-secret') as { username: string; device: string; kind?: string }
  expect(claims.username).toBe('alice')
  expect(claims.device).toBe('laptop')
  expect(claims.kind).toBeUndefined() // a full user credential, not a scoped peer one

  // delivered once: the code is gone afterwards, and cannot be approved twice
  const again = fakeRes()
  deviceLoginHandlers.poll(req(null, null, {}, { code }), again.res)
  expect(again.sent().body).toEqual({ status: 'expired' })
  const twice = fakeRes()
  deviceLoginHandlers.approve(req(null, { username: 'alice' }, { code }), twice.res)
  expect(twice.sent().status).toBe(404)
})

test('denied codes report denied and unknown codes are expired', () => {
  const start = fakeRes()
  deviceLoginHandlers.start(req({}), start.res)
  const { code } = start.sent().body
  deviceLoginHandlers.deny(req(null, { username: 'alice' }, { code }), fakeRes().res)
  const poll = fakeRes()
  deviceLoginHandlers.poll(req(null, null, {}, { code }), poll.res)
  expect(poll.sent().body).toEqual({ status: 'denied' })
  const unknown = fakeRes()
  deviceLoginHandlers.poll(req(null, null, {}, { code: 'ZZZZ-ZZZZ' }), unknown.res)
  expect(unknown.sent().body).toEqual({ status: 'expired' })
})
