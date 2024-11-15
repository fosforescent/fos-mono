import { Request, Response, NextFunction } from 'express'
import _, { merge } from 'lodash'
import { checkDataFormat, hashFosContextData, loadCtxFromDb, storeCtxToDb } from './util'

import { ReqWithClients } from '../clientManager'
import { prisma } from './../prismaClient'


export const postNodeDataPartial = async (req: Request, res: Response) => {
  try {
    const claims = (req as any).claims
    const username = claims.username

    const user = await prisma.user.findUnique({
      where: { user_name: username }
    })

    if (!user) {
      console.log('User not found', user, prisma.user.findUnique, prisma.user, prisma)
      throw new Error('User not found')
    } else {
      const userData = req.body.data as FosContextData | null

      const updatedTime = new Date(parseInt(req.body.updatedTime))


      if (!userData) {
        throw new Error('No data')
      }

      
      if (!user) {
        throw new Error('User not found')
      }

      const userGroup = await prisma.fosGroup.findUnique({
        where: { id: user.fosGroupId }
      })

      if (!userGroup) {
        throw new Error('User group not found')
      }

      const serverData = await loadCtxFromDb(prisma, userGroup)


      const serverHash = hashFosContextData(serverData)


      const combinedData = {
        ...serverData,
        ...userData,
        nodes: {
          ...serverData.nodes,
          ...userData.nodes
        }
      }

      const userDataHash = hashFosContextData(combinedData)
      
    
      const updated = !_.isEqual(userDataHash, serverHash)

      if (updated) {
        const dataHistoryEntry = await prisma.dataHistory.create({
          data: {
            group_id: user.fosGroupId,
            data: user.data as FosContextData,
            createdAt: new Date()
          }
        })

        const combinedMeta = {
          ...combinedData,
          nodes: undefined
        }

        const combinedNodes = combinedData.nodes

        storeCtxToDb(prisma, userGroup, combinedMeta, combinedNodes)

      }

      const result = updated ? {
        updated: true,
        data: combinedData
      } : {
        data: serverData,
        updated: false
      }


      if (Object.keys(result.data.nodes || {}).length !== 0) {
        checkDataFormat(result.data)
      }


      if (Object.keys(result.data.nodes || {}).length !== 0) {
        checkDataFormat(result.data)
      }

      if (result.updated) {
        const dataHistoryEntry = await prisma.dataHistory.create({
          data: {
            group_id: user.fosGroupId,
            data: user.data as FosContextData,
            createdAt: new Date()
          }
        })

        const updatedUser = await prisma.user.update({
          where: { user_name: username },
          data: { data: { ...result.data, synced: true } }
        })

        const updatedUserData = updatedUser.data as FosContextData


        // (req as ReqWithClients).eventClient.sendEvent({
        //   type: 'newhash',
        //   data: hashFosContextData(updatedUserData)
        // })
  

        return res.json({
          data: updatedUserData,
          updated: true
        })
      } else {
        return res.json({
          data: user.data,
          updated: false
        })
      }
    }
  } catch (error) {
    console.error(error)
    return res.status(500).send('Internal Server Error')
  }
}



