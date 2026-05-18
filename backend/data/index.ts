import { Request, Response, NextFunction } from 'express'
import _, { merge } from 'lodash'
import { checkDataFormat, dbToStore, storeToDb, } from '../util'
import { ReqWithClients } from '../clientManager'

import { prisma } from '../prismaClient'
import { FosContextData, FosNodeContent, TrellisSerializedData } from '@fosforescent/shared/types'
import { InputJsonValue, JsonObject } from '@prisma/client/runtime/library'
import { FosStore } from '@fosforescent/shared/dag-implementation/store'
import { semanticSearch } from '@fosforescent/infra/qdrant'
// import {  processAndUpsertDocuments, searchQuery, upsertSearchTerms } from './search'
import { mutableMapExpressions } from '@fosforescent/shared/utils'
import { runActionsOnStore } from './runActions'




export const getUserData = async (req: Request, res: Response): Promise<Response> => {
  try {
    const claims = (req as any).claims
    const username = claims.username

    const user = await prisma.userModel.findUnique({
      where: { user_name: username },
      include: {
        fosNode: true
      }
    })

    if (!user) {
      throw new Error('User not found')
    }


    // console.log('user', user)
    const serverStore = await dbToStore(prisma, user)

    // console.log('serverData', serverData)

    // checkDataFormat(serverStore)

    return res.json({
      data: serverStore.exportContext([]),
      updated: false,
    })


  } catch (error) {
    console.error(error)
    return res.status(500).send('Internal Server Error')
  }
}


export const postUserDataPartial = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const username = claims.username

    const user = await prisma.userModel.findUnique({
      where: { user_name: username },
      include: {
        fosNode: true
      }
    })


    if (!user) {
      console.log('User not found', user, prisma.userModel.findUnique, prisma.userModel, prisma)
      throw new Error('User not found')
    } else {
      const userData = req.body.data as { fosData: FosContextData, trellisData: TrellisSerializedData }
      const updatedTime = new Date(parseInt(req.body.updatedTime))

      if (!userData) {
        throw new Error('No data provided')
      }


      const trellisData = userData.trellisData as unknown as TrellisSerializedData
      // console.log('user', user)
      const serverDataStore = await dbToStore(prisma, user)

      // console.log('serverData', serverData)


      serverDataStore.updateWithContext(userData)

      runActionsOnStore(serverDataStore)




      const userGroupData = user.fosNode.data as { lastVectorUploadTime: number }

      if (userGroupData.lastVectorUploadTime < Date.now() - 1000 * 60 * 60) {


        // const result = await upsertSearchTerms(serverDataStore);

        // if (result) {
        //   await prisma.fosNodeModel.update({
        //     where: { cid: user.fosNode.cid },
        //     data: { data: {
        //       ...(typeof user.fosNode.data === 'object') ? user.fosNode.data : {}, 
        //       lastVectorUploadTime: Date.now() 
        //     } }
        //   })
        // }

      }


      await storeToDb(prisma, user, serverDataStore)


      const updatedContext = serverDataStore.exportContext([])



      // console.log('newServerData', newServerData)
      return res.json({
        data: updatedContext,
        updated: true,
      })



      /*
        TODO: if is todo or service or public workflow, then insert into vector db
      */



    }
  } catch (error) {
    console.error(error)
    res.status(500).send('Internal Server Error')
    return res
  }
}







export const deleteUserData = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const username = claims.username

    const user = await prisma.userModel.findUnique({
      where: { user_name: username }
    })


    if (!user) {
      res.status(401).send('User not found')
      return res
    }

    const updatedUser = await prisma.userModel.update({
      where: { user_name: username },
      data: { data: {} }
    })

    return res.json({ data: updatedUser.data })
  } catch (error) {
    console.error(error)
    res.status(500).send('Internal Server Error')
    return res
  }
}


// ============================================
// Offline-first lazy-load endpoints
// ============================================

/**
 * GET /user/data/nodes/:cid - Fetch a single node by CID
 */
export const getNodeByCid = async (req: Request, res: Response): Promise<Response> => {
  try {
    const claims = (req as any).claims
    const username = claims.username
    const { cid } = req.params

    if (!cid || typeof cid !== 'string') {
      return res.status(400).json({ error: 'Invalid CID parameter' })
    }

    const user = await prisma.userModel.findUnique({
      where: { user_name: username },
      include: { fosNode: true }
    })

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    // Check if the user has access to this node
    const nodeAccess = await prisma.fosNodeUserAccessLinkModel.findFirst({
      where: {
        userModelId: user.id,
        fosNodeModel: { cid }
      },
      include: { fosNodeModel: true }
    })

    if (!nodeAccess) {
      return res.status(404).json({ error: 'Node not found or access denied' })
    }

    return res.json({
      cid,
      content: nodeAccess.fosNodeModel.data as FosNodeContent
    })
  } catch (error) {
    console.error('Error fetching node:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

/**
 * GET /user/data/nodes?cids=cid1,cid2,cid3 - Batch fetch multiple nodes
 */
export const getNodesByCids = async (req: Request, res: Response): Promise<Response> => {
  try {
    const claims = (req as any).claims
    const username = claims.username
    const cidsParam = req.query.cids as string

    if (!cidsParam || typeof cidsParam !== 'string') {
      return res.status(400).json({ error: 'Invalid cids parameter' })
    }

    const cids = cidsParam.split(',').map(c => c.trim()).filter(c => c.length > 0)

    if (cids.length === 0) {
      return res.json({ nodes: {} })
    }

    if (cids.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 CIDs per request' })
    }

    const user = await prisma.userModel.findUnique({
      where: { user_name: username }
    })

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    // Fetch all accessible nodes for the user with matching CIDs
    const nodeAccessLinks = await prisma.fosNodeUserAccessLinkModel.findMany({
      where: {
        userModelId: user.id,
        fosNodeModel: { cid: { in: cids } }
      },
      include: { fosNodeModel: true }
    })

    const nodes: Record<string, FosNodeContent> = {}
    for (const link of nodeAccessLinks) {
      nodes[link.fosNodeModel.cid] = link.fosNodeModel.data as FosNodeContent
    }

    return res.json({ nodes })
  } catch (error) {
    console.error('Error batch fetching nodes:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

/**
 * POST /user/data/sync - Differential sync endpoint
 * Receives mutations from client, applies them, returns conflicts and server changes
 */
export const postSync = async (req: Request, res: Response): Promise<Response> => {
  try {
    const claims = (req as any).claims
    const username = claims.username

    const { mutations, lastSyncTime } = req.body as {
      mutations: Array<{
        id?: number
        operation: 'create' | 'update' | 'delete'
        cid: string
        content?: FosNodeContent
        timestamp: number
      }>
      lastSyncTime: number
    }

    if (!mutations || !Array.isArray(mutations)) {
      return res.status(400).json({ error: 'Invalid mutations array' })
    }

    const user = await prisma.userModel.findUnique({
      where: { user_name: username },
      include: { fosNode: true }
    })

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    const serverDataStore = await dbToStore(prisma, user)
    const applied: Array<{ id: number; cid: string }> = []
    const conflicts: Array<{
      cid: string
      local: FosNodeContent
      server: FosNodeContent
    }> = []

    // Process each mutation
    for (const mutation of mutations) {
      if (mutation.operation === 'create' || mutation.operation === 'update') {
        if (!mutation.content) {
          continue
        }

        // Check if node already exists in server
        const existingContent = serverDataStore.table.get(mutation.cid)

        if (existingContent) {
          // Check for conflict - if server version differs from what client sent
          const serverHash = serverDataStore.hash(existingContent)
          const clientHash = serverDataStore.hash(mutation.content)

          if (serverHash !== clientHash) {
            // Conflict detected
            conflicts.push({
              cid: mutation.cid,
              local: mutation.content,
              server: existingContent
            })
            continue
          }
        }

        // Apply the mutation
        serverDataStore.table.set(mutation.cid, mutation.content)

        if (mutation.id !== undefined) {
          applied.push({ id: mutation.id, cid: mutation.cid })
        }
      } else if (mutation.operation === 'delete') {
        // Don't actually delete - just mark as applied
        // In a content-addressed system, we typically don't delete nodes
        if (mutation.id !== undefined) {
          applied.push({ id: mutation.id, cid: mutation.cid })
        }
      }
    }

    // Save updated store to database
    await storeToDb(prisma, user, serverDataStore)

    // Get server changes since lastSyncTime
    // For now, we return an empty array - full implementation would track changes
    const serverChanges: Array<{ cid: string; content: FosNodeContent }> = []

    const newSyncTime = Date.now()

    return res.json({
      applied,
      conflicts,
      serverChanges,
      newSyncTime
    })
  } catch (error) {
    console.error('Error during sync:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

/**
 * GET /user/data/changes?since=timestamp - Get changes since a timestamp
 */
export const getChangesSince = async (req: Request, res: Response): Promise<Response> => {
  try {
    const claims = (req as any).claims
    const username = claims.username
    const since = parseInt(req.query.since as string) || 0

    const user = await prisma.userModel.findUnique({
      where: { user_name: username },
      include: { fosNode: true }
    })

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    // For now, return empty changes
    // A full implementation would track node modifications with timestamps
    const changes: Array<{ cid: string; content: FosNodeContent }> = []
    const syncTime = Date.now()

    return res.json({ changes, syncTime })
  } catch (error) {
    console.error('Error fetching changes:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
