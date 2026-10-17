import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import type { Confirmation } from './confirmation'
import { validateRegistration } from './confirmation'

import { prisma } from '../prismaClient'

import { FosStore, hashContent } from '@fosforescent/shared/dag-implementation/store'
import { verifyCid } from '@fosforescent/shared/dag-implementation/cid'
import { validateNodeDataToDB } from '../util'

export const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, 10)
}

/**
 * Registration: username, password (typed twice) and an email address or phone number. The account is created
 * unapproved and a confirmation code goes to that address or number (auth/confirmation.ts); signing in works once
 * the code (or the emailed link) confirms it.
 */
export const postRegister = (confirmation: Confirmation) => async (req: Request, res: Response) => {
  const checked = validateRegistration(req.body)
  if (!checked.ok) return res.status(400).json({ error: checked.error })
  const { username, password, email, phone, channel } = checked.input
  const cookies = req.body?.cookies ?? false
  if (channel === 'phone' && !confirmation.smsAvailable()) return res.status(400).json({ error: 'Texting is not configured on this server; register with an email address instead.' })

  // Check if user already exists
  const existingUser = await prisma.userModel.findFirst({ where: { OR: [{ user_name: username }, ...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] } })
  if (existingUser) return res.status(409).json({ error: existingUser.user_name === username ? 'User already exists' : `That ${channel} already belongs to an account` })

  // Hash password
  const hashedPassword = await hashPassword(password) // You can adjust the salt rounds

  // Create user
  try {

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
      if (!verifyCid(id, node)) {
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
        email: email ?? null,
        phone: phone ?? null,
        password_reset_expiration: new Date(),
        accepted_terms: new Date(),
        api_calls_available: 1000,
        api_calls_used: 0,
        api_calls_total: 0,
        approved: false, // until the code sent to the email or phone confirms the account
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


    // The code goes out now; if it cannot be delivered the account stays unconfirmed and "Resend" tries again.
    try {
      const pending = await confirmation.start(user, channel)
      return res.status(201).json({ username: user.user_name, pending: pending.channel, destination: pending.destination })
    } catch (error) {
      console.warn('Failed to send the confirmation code:', error)
      return res.status(201).json({ username: user.user_name, pending: channel, destination: null, error: 'The confirmation code could not be sent. Use “Resend” in a moment.' })
    }
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


