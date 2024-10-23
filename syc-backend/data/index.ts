import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import _, { merge } from 'lodash'
import { checkDataFormat, getRootId, getRootNode, hashFosContextData, loadCtxFromDb,storeCtxToDb, updateRootNodeId, } from './util'
import { FosContextData, FosNodeContent, FosNodesData, FosPath, FosPeer } from '@/fos-js'
import { ReqWithClients } from '../clientManager'

import { prisma } from './../prismaClient'




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
      data: serverData,
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
      const userData = req.body.data as FosContextData
      const updatedTime = new Date(parseInt(req.body.updatedTime))

      // console.log('completeUserData', completeUserData, userData)


      // console.log('user', user)
      const serverData = await loadCtxFromDb(prisma, user.fosGroup)

      // console.log('serverData', serverData)
      
      checkDataFormat(serverData)

      if (!userData?.nodes) {
        console.log('userData.nodes is empty')
        return res.json({
          data: serverData,
          updated: false,
        })
  
      }

      const userDataWithNewRootNode = updateRootNodeId(userData, getRootId(serverData))

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
        trail: userDataWithNewRootNode.trail,
        focus: userDataWithNewRootNode.focus
      }

      const nodes = userDataWithNewRootNode.nodes

      // console.log('nodes', nodes, meta)
      await storeCtxToDb(prisma, user.fosGroup, meta, nodes)

      // console.log("stored")

      const newServerData = await loadCtxFromDb(prisma, user.fosGroup)

      // console.log('newServerData', newServerData)
      return res.json({
        data: newServerData,
        updated: true,
      })


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
