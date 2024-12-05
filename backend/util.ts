import crypto from "crypto";
import {
  AppState,
  FosContextData,
  FosNodeContent,
  FosNodesData,
  TrellisSerializedData,

} from "@/shared/types";


import { validate as isUuid } from "uuid";

import { UserModel, FosNodeModel, PrismaClient } from "@prisma/client";

import { generateKeyPair, randomUUID } from "crypto";
import { upsertSearchTerms } from "./data/search";
import { FosStore } from "@/shared/dag-implementation/store";
import { JsonObject, UserArgs } from "@prisma/client/runtime/library";

import { Prisma } from '@prisma/client';
import { generateLinkToken } from "./email/email";
import { hashPassword } from "./auth/register";
import { defaultTrellisData } from "@/shared/defaults";



type UserWithNode = Prisma.UserModelGetPayload<{
  include: { fosNode: true };
}>;
// export function generateNewId(data: FosContextData) {
//   console.log("Generating new id");
//   const newId = randomUUID();
//   return newId;
// }


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

export const validateTrellisDataFromStore = (data: unknown): TrellisSerializedData => {

  return data
}

export const validateNodeDataFromStore = (nodeContent: unknown): FosNodeContent => {

  return nodeContent
}

export const validateProfileDataFromStore = (profileData: unknown): AppState["info"]["profile"] => {

  return profileData
}

export const validateTrellisDataToStore = (data: TrellisSerializedData): JsonObject => {
  return data as unknown as JsonObject
}
export const validateNodeDataToStore = (data: FosNodeContent): JsonObject => {
  return data as unknown as JsonObject
}
export const validateProfileDataToStore = (data: AppState["info"]["profile"]): JsonObject => {
  return data as unknown as JsonObject
}



export const dbToStore = async (
  prisma: PrismaClient,
  user: UserWithNode,
): Promise<FosStore> => {
  

  const trellisData: TrellisSerializedData = validateTrellisDataFromStore(user.data)

  const newStore = new FosStore()


  const getChildNodesHelper = async (node: FosNodeModel) => {

    const nodeData: FosNodeContent = validateNodeDataFromStore(node.data)
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


      for (const node of nodesToAdd) {
        await getChildNodesHelper(node)
      }

    }

    const newStoreNode = newStore.create(nodeData)

  }

  const rootNode = newStore.getNodeByAddress(user.fosNode.cid)
  
  getChildNodesHelper(user.fosNode)
  newStore.rootNodeId = user.fosNode.cid
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
    if (existingNodes.find(n => n.cid === id)) {
      return acc
    } else {
      return [...acc, {
        cid: id,
        data: validateNodeDataToStore(node),
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
      data: validateTrellisDataToStore(store.trellisData),
      fosNodeId: store.rootNodeId
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



export const createSeedUser = async (prisma: PrismaClient, store: FosStore, userData: { username: string } & Partial<UserArgs> ): Promise<FosStore> => {


  const password = "dent4567"

  // Hash password
  const hashedPassword = await hashPassword(password) // You can adjust the salt rounds

  // Create user

  const { token, expiration } = generateLinkToken()
  
  const user = await prisma.userModel.create({
    data: {
      user_name: userData.username,
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
      data: validateTrellisDataToStore(defaultTrellisData),
      fosNodeId: (new FosStore()).rootNodeId,
      ...userData
    },
  })

  return store

}


