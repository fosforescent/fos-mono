import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { generateLinkToken, sendConfirmationEmail } from '../email/email'

import { prisma } from '../prismaClient'

import { FosStore, hashContent } from '@fosforescent/shared/dag-implementation/store'
import { validateNodeDataToDB } from '../util'

export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, 10)
}

export const postRegister = async (req: Request, res: Response) => {
  console.log('🔵 POST /auth/register received:', { username: req.body.username, hasPassword: !!req.body.password, accepted_terms: req.body.accepted_terms })
  const { username, password, accepted_terms, cookies } = req.body

  if (!username || !password) {
    console.log('❌ Missing username or password:', { username, hasPassword: !!password })
    return res.status(400).json({ error: 'Missing username or password' })
  }

  if (!accepted_terms) {
    return res.status(400).json({ error: 'You must accept the terms and conditions' })
  }

  // Check if user already exists
  const existingUser = await prisma.userModel.findUnique({
    where: {
      user_name: username
    }
  })

  if (existingUser) {
    return res.status(409).json({ error: 'User already exists' })
  }

  // validate password
  // match at least one uppercase letter and number
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one uppercase letter and one number' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' })
  }

  // Hash password
  const hashedPassword = await hashPassword(password) // You can adjust the salt rounds

  // Create user
  try {
    const { token, expiration } = generateLinkToken()

    // Create a new FosStore and insert its nodes into the database first
    const newStore = new FosStore()

    // Get the node IDs from the new store
    const newStoreNodeIds = Array.from(newStore.table.keys())
    
    // Get only existing nodes with matching IDs (much more efficient)
    const existingNodes = await prisma.fosNodeModel.findMany({
      where: {
        cid: {
          in: newStoreNodeIds
        }
      },
      select: {
        cid: true
      }
    })

    // Prepare new nodes for insertion
    const newEntries = Array.from(newStore.table.entries()).reduce((acc, [id, node]) => {
      if (id !== hashContent(node)) {
        throw new Error("Hashes don't match")
      }

      if (existingNodes.find(n => n.cid === id)) {
        return acc
      } else {
        return [...acc, {
          cid: id,
          data: validateNodeDataToDB(node),
        }]
      }
    }, [] as Array<{ cid: string, data: any }>)

    // Insert new nodes into database
    if (newEntries.length > 0) {
      await prisma.fosNodeModel.createMany({
        data: newEntries
      })
    }

    // Create an alias node for the user's root node
    const { v4: uuidv4 } = await import('uuid')
    const aliasId = uuidv4()
    const aliasData = {
      alias: {
        id: aliasId
      }
    }
    const aliasContent = {
      data: aliasData,
      children: [[newStore.rootNodeId, newStore.rootNodeId]] as [string, string][]
    }
    const aliasCid = hashContent(aliasContent)

    await prisma.fosNodeModel.create({
      data: {
        cid: aliasCid,
        data: aliasData
      }
    })

    const user = await prisma.userModel.create({
      data: {
        user_name: username,
        password: hashedPassword,
        subscription_status: 'inactive',
        user_profile: {},
        email_confirmation_token: token,
        email_confirmation_expiration: expiration,
        password_reset_expiration: new Date(),
        accepted_terms: new Date(),
        api_calls_available: 1000,
        api_calls_used: 0,
        api_calls_total: 0,
        approved: true,
        cookies,
        fosNodeId: aliasCid,
        FosNodeUserAccessLink: {
          create: {
            fosNodeId: aliasCid
          }
        }
      },
    })

    // Create access links for all nodes in the store
    if (newEntries.length > 0) {
      await prisma.fosNodeUserAccessLinkModel.createMany({
        data: newEntries.map(n => ({
          fosNodeId: n.cid,
          userId: user.id
        }))
      })
    }


    // Omit sending password back in the response
    const { password, ...result } = user

    // Send email confirmation email only if username is a valid email
    if (username.includes('@') && username.includes('.')) {
      try {
        await sendConfirmationEmail(username, token, (req as any).clientDetails)
      } catch (error) {
        console.warn('Failed to send confirmation email:', error)
        // Continue without email confirmation for development/testing
      }
    } else {
      console.log('Skipping email confirmation for non-email username:', username)
    }

    return res.status(201).json(result)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export const deleteAccount = async (req: Request, res: Response) => {
  const claims = (req as any).claims
  const username = claims.username

  try {
    const user = await prisma.userModel.delete({
      where: {
        user_name: username
      }
    })


    const userEvents = await prisma.userEventModel.deleteMany({
      where: {
        userId: user.id
      }
    })

    res.json(user)
  } catch (error) {
    console.error(error)
    res.status(500).send('Internal Server Error')
  }
}


