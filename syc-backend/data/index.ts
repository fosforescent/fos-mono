import { Request, Response, NextFunction } from 'express'
import _, { merge } from 'lodash'
import { checkDataFormat, getRootId, hashFosContextData, loadCtxFromDb,storeCtxToDb, updateRootNodeId, } from './util'
import { ReqWithClients } from '../clientManager'

import { prisma } from './../prismaClient'
import { FosContextData, TrellisSerializedData } from '@/fos-combined/types'
import { InputJsonValue, JsonObject } from '@prisma/client/runtime/library'




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
    const serverData = await loadCtxFromDb(prisma, user.fosGroup)

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
      

      // console.log('user', user)
      const serverData = await loadCtxFromDb(prisma, user.fosGroup)

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

      const userDataWithNewRootNode = updateRootNodeId(userData.fosData, getRootId(serverData))

      // console.log('userData', userDataWithNewRootNode)
      // Object.keys(userDataWithNewRootNode.nodes).forEach((key) => {
      //   console.log('key - userdata', key, userDataWithNewRootNode.nodes[key]?.content, userDataWithNewRootNode.nodes[key]?.data?.description)
      // })
      checkDataFormat(userDataWithNewRootNode)

      const userDataWithAllNodes = {
        ...userDataWithNewRootNode,
        nodes: {
          ...serverData.nodes,
          ...userDataWithNewRootNode.nodes,
        }
      }

      Object.keys(userDataWithNewRootNode.nodes).forEach((key) => {
        console.log('key - mergeddata', key, userDataWithNewRootNode.nodes[key]?.content, userDataWithNewRootNode.nodes[key]?.data?.description)
      })

      const meta: Omit<FosContextData, "nodes"> = {
        route: userDataWithNewRootNode.route,
      }

      const nodes = userDataWithNewRootNode.nodes

      // console.log('nodes', nodes, meta)
      await storeCtxToDb(prisma, user.fosGroup, meta, nodes)

      // console.log("stored")

      const newServerData = await loadCtxFromDb(prisma, user.fosGroup)


      const updatedUser = await prisma.user.update({
        where: { user_name: username },
        data: { data: userData.trellisData as unknown as JsonObject}
      })

      // console.log('newServerData', newServerData)
      return res.json({
        data: { 
          fosData: newServerData,
          trellisData: user.data,
        },
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
