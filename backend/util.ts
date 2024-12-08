import crypto from "crypto";
import {
  AppState,
  FosContextData,
  FosNodeContent,
  FosNodesData,
  TrellisSerializedData,

} from "@/shared/types";



import { UserModel, FosNodeModel, PrismaClient } from "@prisma/client";

import { FosStore, hashContent } from "@/shared/dag-implementation/store";
import { JsonObject, UserArgs } from "@prisma/client/runtime/library";

import { Prisma } from '@prisma/client';
import { generateLinkToken } from "./email/email";
import { hashPassword } from "./auth/register";
import { defaultTrellisData } from "@/shared/defaults";
import { validateNodeData, validateTrellisData } from "@/shared/utils";
import { get } from "http";
import { th } from "date-fns/locale";



type UserWithNode = Prisma.UserModelGetPayload<{
  include: { fosNode: true };
}>;


export const checkDataFormat = (data: FosContextData) => {
  // console.log("Checking data", data);

  if (Object.keys(data as any).length > 100) {
    throw new Error("Data too large");
  }

  if ((data as any).data) {
    throw new Error("data.data");
  }

  if (!(data as any).nodes) {
    console.log("data", data);
    throw new Error("no data.nodes");
  }

};


export const validateTrellisDataToDB = (data: TrellisSerializedData): JsonObject => {
  return data as unknown as JsonObject
}
export const validateNodeDataToDB = (data: FosNodeContent): JsonObject => {
  return data as unknown as JsonObject
}
export const validateProfileDataToDB = (data: AppState["info"]["profile"]): JsonObject => {
  return data as unknown as JsonObject
}



export const dbToStore = async (
  prisma: PrismaClient,
  user: UserWithNode,
): Promise<FosStore> => {
  

  const trellisData: TrellisSerializedData = validateTrellisData(user.data)


  const nodesToAdd = await prisma.fosNodeModel.findMany({
    where: {
      FosNodeUserAccessLink: {
        some: {
          userId: user.id
        }
      }
    }
  })

  const table = nodesToAdd.reduce((acc, node) => {

    const hashed = hashContent(validateNodeData(node.data))
    if (node.cid !== hashed) {
      throw new Error ("Hashes don't match")
    }

    return {
      ...acc,
      [node.cid]: validateNodeData(node.data)
    }
  }, {} as FosNodesData)

  const ctx: FosContextData = {
    nodes: table,
    route: [],
    rootNodeId: user.fosNode.cid
  }

  

  const newStore = new FosStore({fosCtxData: {
    fosData: ctx,
    trellisData: trellisData
  }})

  


  const getChildNodesHelper = async (node: FosNodeModel) => {

    const nodeData: FosNodeContent = validateNodeData(node.data)
    const allIds = new Set(nodeData.children.flat())

    if (allIds.size > 0) {

      const nodesToAdd = await prisma.fosNodeModel.findMany({
        where: {
          cid: {
            in: [...allIds]
          },
          FosNodeUserAccessLink: {
            some: {
              userId: user.id
            }
          }
        }
      })

      const childrenPromises: Promise<void>[] = nodesToAdd.map(n => {
        const promise: Promise<void> = getChildNodesHelper(n)
        return promise
      })
      await Promise.all(childrenPromises)

    }
    if (!newStore.table.has(node.cid)) {
      const newStoreNode = newStore.create(nodeData)
    }
  }


  
  await getChildNodesHelper(user.fosNode)

  const rootNodeId = newStore.create(validateNodeData(user.fosNode.data)).cid

  newStore.rootNodeId = rootNodeId
  newStore.trellisData = trellisData

  return newStore

};


export const storeToDb = async (
  prisma: PrismaClient,
  user: UserWithNode,
  store: FosStore,
): Promise<FosStore> => {

  
  const existingNodes = await prisma.fosNodeModel.findMany({
    where: {
      FosNodeUserAccessLink: {
        some: {
          userId: user.id
        }
      }
    }
  })

  existingNodes.forEach(n => {
    const hashed = store.hash(validateNodeData(n.data))
    if (n.cid === hashed) {
      throw new Error ("Hashes don't match")
    }
  })

  type ReduceResultArrayTerm = {
    cid: string,
    data: JsonObject,
    FosNodeUserAccessLink: {
      create: {
        userId: number
      }
    }
  }

  const newEntries: ReduceResultArrayTerm[] = store.table.entries().reduce((acc: ReduceResultArrayTerm[], [id, node]: [string, FosNodeContent]) => {
    if (id !== hashContent(node)) {
      throw new Error("Hashes don't match")
    }

    if (existingNodes.find(n => n.cid === id)) {
      return acc
    } else {
      return [...acc, {
        cid: id,
        data: validateNodeDataToDB(node),
        FosNodeUserAccessLink: {
          create: {
            userId: user.id
          }
        }
      }]  
    }
  }, [])


  const nodes = prisma.fosNodeModel.createMany({
    data: newEntries
  })



  const updatedUser = await prisma.userModel.update({
    where: { user_name: user.user_name },
    data: { 
      data: validateTrellisDataToDB(store.trellisData),
      fosNodeId: store.rootNodeId,
      FosNodeUserAccessLink: {
        create: {
          fosNodeId: store.rootNodeId
        }
      }
    }
  })

  /**
   * TODO: merge mutations
   * 
   * 
   * 
   */

  return store

};





export const createSeedUser = async (prisma: PrismaClient, store: FosStore, username: string,  userData: Partial<UserArgs> ): Promise<FosStore> => {


  const password = "Dent4567"

  // Hash password
  const hashedPassword = await hashPassword(password) // You can adjust the salt rounds

  

  const existingNodes = await prisma.fosNodeModel.findMany({
  })

  type ReduceResultArrayTerm = {
    cid: string,
    data: JsonObject,
  }

  const newEntries: ReduceResultArrayTerm[] = store.table.entries().reduce((acc: ReduceResultArrayTerm[], [id, node]: [string, FosNodeContent]) => {
    if (id !== hashContent(node)) {
      throw new Error("Hashes don't match")
    }

    if (id === store.rootNodeId) {
      console.log("Root node", id)
    }
    if (existingNodes.find(n => n.cid === id)) {
      return acc
    } else {
      return [...acc, {
        cid: id,
        data: validateNodeDataToDB(node),

      }]  
    }
  }, [])


  const nodes = await prisma.fosNodeModel.createMany({
    data: newEntries
  })

  const rootNode = await prisma.fosNodeModel.findFirst({
    where: {
      cid: store.rootNodeId
    }
  })
  
  console.log("Root node", rootNode)

  const { token, expiration } = generateLinkToken()
  
  const user = await prisma.userModel.create({
    data: {
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
      data: validateTrellisDataToDB(defaultTrellisData),
      fosNodeId: store.rootNodeId,
      ...userData,
      user_name: username,
      FosNodeUserAccessLink: {
        create: {
          fosNodeId: store.rootNodeId
        }
      }
    },
  })

  const links = await prisma.fosNodeUserAccessLinkModel.createMany({
    data: newEntries.map(n => {
      return {
        fosNodeId: n.cid,
        userId: user.id
      }
    })
  })

  return store

}


