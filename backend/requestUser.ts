import { Request } from 'express'
import { prisma } from './prismaClient'

// The id of the account a JWT-authenticated request (verifyJwt.ts sets `claims`) belongs to
export const getUserId = async (req: Request): Promise<number> => {
  const claims = (req as any).claims
  if (!claims?.username) throw new Error('No valid authentication found')
  const user = await prisma.userModel.findUnique({ where: { user_name: claims.username } })
  if (!user) throw new Error('User not found')
  return user.id
}
