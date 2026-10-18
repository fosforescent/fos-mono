/** The ledger transfer behind fos-points payouts: one transaction, idempotent on its key. */
type Balance = { userId: number; availableTokens: number; totalPurchased: number; totalUsed: number; subscriptionTokens: number; purchasedTokens: number }
type Transaction = Record<string, unknown> & { transactionId: string }
const balances = new Map<number, Balance>(), transactions: Transaction[] = []
const fake = {
  userTokenBalanceModel: {
    findUnique: async ({ where }: { where: { userId: number } }) => balances.get(where.userId) ?? null,
    create: async ({ data }: { data: Balance }) => { balances.set(data.userId, { ...data }); return { ...data } },
    update: async ({ where, data }: { where: { userId: number }; data: Partial<Balance> }) => { const next = { ...balances.get(where.userId)!, ...data }; balances.set(where.userId, next); return next }
  },
  tokenTransactionModel: {
    findUnique: async ({ where }: { where: { transactionId: string } }) => transactions.find(t => t.transactionId === where.transactionId) ?? null,
    create: async ({ data }: { data: Transaction }) => { transactions.push({ ...data }); return { ...data } }
  },
  $transaction: async (fn: (tx: typeof fake) => Promise<unknown>) => fn(fake)
}
jest.mock('./prismaClient', () => ({ prisma: fake }))
jest.mock('stripe', () => ({ __esModule: true, default: class { constructor() {} } }))
import { tokenManager } from './tokenManager'

beforeEach(() => { balances.clear(); transactions.length = 0; balances.set(1, { userId: 1, availableTokens: 10, totalPurchased: 10, totalUsed: 0, subscriptionTokens: 0, purchasedTokens: 10 }) })

test('a transfer debits the payer and credits the payee in one transaction, creating the payee balance when needed', async () => {
  expect(await tokenManager.transferTokens(1, 2, 4, { debit: 'to bob', credit: 'from owner' }, 'points:owner:task/pay', { kind: 'points' })).toBe('transferred')
  expect(balances.get(1)).toMatchObject({ availableTokens: 6, totalUsed: 4 })
  expect(balances.get(2)).toMatchObject({ availableTokens: 4, purchasedTokens: 4, totalPurchased: 4 })
  expect(transactions.map(t => [t.transactionId, t.userId, t.amount, t.type])).toEqual([['points:owner:task/pay:debit', 1, -4, 'debit'], ['points:owner:task/pay:credit', 2, 4, 'credit']])
  expect(transactions[0]!.metadata).toEqual({ kind: 'points', to: 2 })
})

test('the same key never moves tokens twice; shortfalls and self-transfers are refused before anything changes', async () => {
  await tokenManager.transferTokens(1, 2, 4, { debit: 'd', credit: 'c' }, 'k')
  expect(await tokenManager.transferTokens(1, 2, 4, { debit: 'd', credit: 'c' }, 'k')).toBe('already-transferred')
  expect(balances.get(1)!.availableTokens).toBe(6)
  expect(transactions).toHaveLength(2)
  await expect(tokenManager.transferTokens(1, 2, 7, { debit: 'd', credit: 'c' }, 'k2')).rejects.toThrow('Insufficient tokens')
  await expect(tokenManager.transferTokens(1, 1, 1, { debit: 'd', credit: 'c' }, 'k3')).rejects.toThrow('two different accounts')
  await expect(tokenManager.transferTokens(1, 2, 1.5, { debit: 'd', credit: 'c' }, 'k4')).rejects.toThrow('whole, positive')
  expect(balances.get(1)!.availableTokens).toBe(6)
  expect(transactions).toHaveLength(2)
})
