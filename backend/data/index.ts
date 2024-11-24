import { Request, Response, NextFunction } from 'express'
import _, { merge } from 'lodash'
import { checkDataFormat, loadCtxFromDb,storeCtxToDb,  } from './util'
import { ReqWithClients } from '../clientManager'

import { prisma } from '../prismaClient'
import { FosContextData, FosNodeContent, TrellisSerializedData } from '@/shared/types'
import { InputJsonValue, JsonObject } from '@prisma/client/runtime/library'
import { FosStore } from '@/shared/dag-implementation/store'
import { semanticSearch } from '../pinecone'
import {  processAndUpsertDocuments, searchQuery, upsertSearchTerms } from './search'
import { mutableMapExpressions } from '@/shared/utils'
import { runActionsOnStore } from './runActions'




export const getUserData = async (req: Request, res: Response): Promise<Response> => {
  try {
    const claims = (req as any).claims
    const username = claims.username

    const user = await prisma.user.findUnique({
      where: { user_name: username },
      include: {
        fosGroup: true
      }
    })

    if (!user) {
      throw new Error('User not found')
    }


    // console.log('user', user)
    const serverData = await loadCtxFromDb(prisma, user.fosGroup, user)

    // console.log('serverData', serverData)
    
    checkDataFormat(serverData)

    return res.json({
      data: { 
        fosData: serverData,
        trellisData: user.data,
      },
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

    const user = await prisma.user.findUnique({
      where: { user_name: username },
      include: {
        fosGroup: true
      }
    })


    if (!user) {
      console.log('User not found', user, prisma.user.findUnique, prisma.user, prisma)
      throw new Error('User not found')
    } else {
      const userData = req.body.data as { fosData: FosContextData, trellisData: TrellisSerializedData } 
      const updatedTime = new Date(parseInt(req.body.updatedTime))

      if (!userData) {
        throw new Error('No data provided')
      }
      

      const trellisData = userData.trellisData as unknown as TrellisSerializedData
      // console.log('user', user)
      const serverData = await loadCtxFromDb(prisma, user.fosGroup, user)

      // console.log('serverData', serverData)
      
      checkDataFormat(serverData)

      if (!userData.fosData.nodes) {
        console.log('userData.nodes is empty')
        return res.json({
          data: {
            fosData: serverData,
            trellisData: user.data,
          },
          updated: false,
        })
  
      }


      const serverDataStore = new FosStore({ fosData: serverData, trellisData } )

      serverDataStore.updateWithContext(userData)

      runActionsOnStore(serverDataStore)




      const userGroupData = user.fosGroup.data as { lastVectorUploadTime: number }
      
      if (userGroupData.lastVectorUploadTime < Date.now() - 1000 * 60 * 60) {


        const result = await upsertSearchTerms(serverDataStore);

        if (result) {
          await prisma.fosGroup.update({
            where: { id: user.fosGroup.id },
            data: { data: {
              ...(typeof user.fosGroup.data === 'object') ? user.fosGroup.data : {}, 
              lastVectorUploadTime: Date.now() 
            } }
          })
        }
    
      }
    

      await storeCtxToDb(prisma, user.fosGroup, serverDataStore )


      const updatedContext = serverDataStore.exportContext([])

      const updatedUser = await prisma.user.update({
        where: { user_name: username },
        data: { data: serverDataStore.trellisData as unknown as JsonObject}
      })

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

    const user = await prisma.user.findUnique({
      where: { user_name: username }
    })

    const userGroup = await prisma.fosGroup.findFirst({
      where: {
        id: user?.fosGroupId
      }
    })


    
  

    if (!user) {
      res.status(401).send('User not found')
      return res
    }

    const dataHistory = await prisma.dataHistory.findMany({
      where: {
        group_id: userGroup?.id
      }
    })

    const dataHistoryDelete = await prisma.dataHistory.deleteMany({
      where: {
        group_id: userGroup?.id
      }
    })

    const updatedUser = await prisma.user.update({
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
