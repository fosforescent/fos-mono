import { Request, Response, NextFunction } from 'express'
import _, { merge } from 'lodash'
import { checkDataFormat, dbToStore, storeToDb,  } from '../util'
import { ReqWithClients } from '../clientManager'

import { prisma } from '../prismaClient'
import { FosContextData, FosNodeContent, TrellisSerializedData } from '@/shared/types'
import { InputJsonValue, JsonObject } from '@prisma/client/runtime/library'
import { FosStore } from '@/shared/dag-implementation/store'
import { semanticSearch } from '../pinecone'
// import {  processAndUpsertDocuments, searchQuery, upsertSearchTerms } from './search'
import { mutableMapExpressions } from '@/shared/utils'
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
    

      await storeToDb(prisma, user, serverDataStore )


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
