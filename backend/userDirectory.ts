/** User directory lookups used by the web client to find Fos accounts by name or email. */
import { Request, Response } from 'express'
import { prisma } from './prismaClient'

/**
 * Find users by email (exact match)
 */
export const queryUserByEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.query

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email required' })
    }

    const users = await prisma.userModel.findMany({
      where: {
        user_profile: {
          path: ['email'],
          equals: email
        }
      },
      select: {
        id: true,
        user_name: true,
        user_profile: true,
        fosNodeId: true
      },
      take: 10
    })

    return res.json({ users })
  } catch (error) {
    console.error('Error querying user by email:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Find users by display name (fuzzy search)
 */
export const queryUserByDisplayName = async (req: Request, res: Response) => {
  try {
    const { name } = req.query

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name required' })
    }

    const users = await prisma.userModel.findMany({
      where: {
        OR: [
          { user_name: { contains: name, mode: 'insensitive' } },
          {
            user_profile: {
              path: ['displayName'],
              string_contains: name
            }
          }
        ]
      },
      select: {
        id: true,
        user_name: true,
        user_profile: true,
        fosNodeId: true
      },
      take: 20
    })

    return res.json({ users })
  } catch (error) {
    console.error('Error querying user by display name:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
