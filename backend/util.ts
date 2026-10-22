import { rememberLoadedRoot, saveRootVersion } from './sync/storeVersion'
import crypto from "crypto";
import {
  AppState,
  FosContextData,
  FosNodeContent,
  FosNodesData,
  TrellisSerializedData,

} from "@fosforescent/shared/types";



import { UserModel, FosNodeModel, PrismaClient } from "@prisma/client";

import { FosStore } from "@fosforescent/shared/dag-implementation/store";
import { assertCurrentCid, verifyCid } from "@fosforescent/shared/dag-implementation/cid";
import { asAccountStore } from "./sync/deviceRoot";
import { JsonObject, UserArgs } from "@prisma/client/runtime/library";

import { Prisma } from '@prisma/client';
import { generateLinkToken } from "./email/email";
import { hashPassword } from "./auth/register";
import { defaultTrellisData } from "@fosforescent/shared/defaults";
import { validateNodeData, validateTrellisData } from "@fosforescent/shared/utils";
import { get } from "http";



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
      OR: [
        {
          FosNodeUserAccessLink: {
            some: {
              userId: user.id
            }
          }
        },
        {
          FosNodeUserAccessLink: {
            none: {}
          }
        }
      ]
    }
  })

  // one pass, mutating a single object: the former `{ ...acc }` reduce copied the table on every node (quadratic)
  const table: FosNodesData = {}
  for (const node of nodesToAdd) {
    const data = validateNodeData(node.data)
    // rows of another data version are not migrated: the database has to be reset
    assertCurrentCid(node.cid)
    if (!verifyCid(node.cid, data)) {
      throw new Error("Hashes don't match")
    }
    table[node.cid] = data
  }

  const ctx: FosContextData = {
    nodes: table,
    route: [],
    rootNodeId: user.fosNode.cid
  }



  const newStore = new FosStore({
    fosCtxData: {
      fosData: ctx,
      trellisData: trellisData
    }
  })




  const getChildNodesHelper = async (node: FosNodeModel) => {

    const nodeData: FosNodeContent = validateNodeData(node.data)
    const allIds = new Set((nodeData.children || []).flat())

    if (allIds.size > 0) {

      const nodesToAdd = await prisma.fosNodeModel.findMany({
        where: {
          cid: {
            in: [...allIds]
          },
          OR: [
            {
              FosNodeUserAccessLink: {
                some: {
                  userId: user.id
                }
              }
            },
            {
              FosNodeUserAccessLink: {
                none: {}
              }
            }
          ]
        }
      })

      const childrenPromises: Promise<void>[] = nodesToAdd.map(n => {
        const promise: Promise<void> = getChildNodesHelper(n)
        return promise
      })
      await Promise.all(childrenPromises)

    }
    if (!newStore.table.has(node.cid)) {
      assertCurrentCid(node.cid)
      newStore.create(nodeData)
    }
  }



  // The first query already loaded every node linked to the user; the recursive
  // walk (one query per node) is only needed when the root is not among them.
  if (!newStore.table.has(user.fosNode.cid)) {
    await getChildNodesHelper(user.fosNode)
  }

  const rootContent = validateNodeData(user.fosNode.data)
  const rootNodeId = newStore.table.has(user.fosNode.cid)
    ? user.fosNode.cid
    : newStore.create(rootContent).cid

  newStore.rootNodeId = rootNodeId
  newStore.trellisData = trellisData

  rememberLoadedRoot(newStore, user.fosNodeId)
  // an account's store is not a device root: its rows resolve through this server's own device root
  return asAccountStore(newStore)

};

export const ensureNodeInStore = async (
  prisma: PrismaClient,
  store: FosStore,
  nodeCid: string,
  visited: Set<string> = new Set(),
): Promise<void> => {
  if (store.table.has(nodeCid) || visited.has(nodeCid)) {
    return
  }

  visited.add(nodeCid)

  const nodeRecord = await prisma.fosNodeModel.findUnique({
    where: { cid: nodeCid }
  })

  if (!nodeRecord) {
    throw new Error(`Node ${nodeCid} not found in database`)
  }

  const nodeContent = validateNodeData(nodeRecord.data)

  for (const [instructionCid, targetCid] of nodeContent.children) {
    if (!store.table.has(instructionCid)) {
      await ensureNodeInStore(prisma, store, instructionCid, visited)
    }
    if (!store.table.has(targetCid)) {
      await ensureNodeInStore(prisma, store, targetCid, visited)
    }
  }

  if (!store.table.has(nodeCid)) {
    const insertedNode = store.create(nodeContent)
    if (insertedNode.getId() !== nodeCid) {
      throw new Error(`Hash mismatch when inserting node ${nodeCid}`)
    }
  }
}


export const storeToDb = async (
  prisma: PrismaClient,
  user: UserWithNode,
  store: FosStore,
): Promise<FosStore> => {

  const existingNodes = await prisma.fosNodeModel.findMany({
    where: {
      OR: [
        {
          FosNodeUserAccessLink: {
            some: {
              userId: user.id
            }
          }
        },
        {
          FosNodeUserAccessLink: {
            none: {}
          }
        }
      ]
    }
  })
  const existingCids = new Set(existingNodes.map((n) => n.cid))

  existingNodes.forEach(n => {
    if (!verifyCid(n.cid, validateNodeData(n.data))) {
      throw new Error("Hashes don't match")
    }
  })

  const shouldLinkNodeToUser = (node: FosNodeContent) => {
    const scope = node.data.comment?.scope
    if (scope === "global") {
      return false
    }
    return true
  }

  const nodesToCreate: { cid: string, data: JsonObject }[] = []
  const linksToEnsure: string[] = []

  Array.from(store.table.entries()).forEach(([id, node]: [string, FosNodeContent]) => {
    if (!verifyCid(id, node)) {
      throw new Error("Hashes don't match")
    }

    const alreadyExists = existingCids.has(id)
    if (!alreadyExists) {
      nodesToCreate.push({
        cid: id,
        data: validateNodeDataToDB(node)
      })
    }

    if (shouldLinkNodeToUser(node)) {
      linksToEnsure.push(id)
    }
  })

  if (nodesToCreate.length > 0) {
    await prisma.fosNodeModel.createMany({
      data: nodesToCreate,
      skipDuplicates: true
    })
  }

  // Only add links that do not exist yet: the table has no unique constraint, so
  // re-creating them on every save would duplicate every link (and slow every load).
  const uniqueLinksToEnsure = [...new Set(linksToEnsure)]
  const alreadyLinked = new Set(
    (await prisma.fosNodeUserAccessLinkModel.findMany({
      where: { userId: user.id, fosNodeId: { in: uniqueLinksToEnsure } },
      select: { fosNodeId: true }
    })).map((l) => l.fosNodeId)
  )
  const linksToCreate = uniqueLinksToEnsure.filter((cid) => !alreadyLinked.has(cid))

  if (linksToCreate.length > 0) {
    await prisma.fosNodeUserAccessLinkModel.createMany({
      data: linksToCreate.map(fosNodeId => ({
        fosNodeId,
        userId: user.id
      })),
      skipDuplicates: true
    })
  }

  // A second backend instance must not overwrite a root loaded before another writer's commit.
  // Nodes are immutable and can be inserted beforehand; the visible root advances atomically.
  await saveRootVersion(store, user.fosNodeId, async (expected, next) => {
    const saved = await prisma.userModel.updateMany({
      where: { id: user.id, fosNodeId: expected },
      data: { data: validateTrellisDataToDB(store.trellisData), fosNodeId: next }
    })
    return saved.count === 1
  })

  /**
   * TODO: merge mutations
   * 
   * 
   * 
   */

  return store

};





export const createSeedUser = async (prisma: PrismaClient, store: FosStore, username: string, userData: Partial<UserArgs>): Promise<FosStore> => {


  const password = "Dent4567"

  // Hash password
  const hashedPassword = await hashPassword(password) // You can adjust the salt rounds



  const existingNodes = await prisma.fosNodeModel.findMany({
  })
  const existingCids2 = new Set(existingNodes.map((n) => n.cid))

  type ReduceResultArrayTerm = {
    cid: string,
    data: JsonObject,
  }

  const newEntries: ReduceResultArrayTerm[] = Array.from(store.table.entries()).reduce((acc: ReduceResultArrayTerm[], [id, node]: [string, FosNodeContent]) => {
    if (!verifyCid(id, node)) {
      throw new Error("Hashes don't match")
    }

    if (id === store.rootNodeId) {
      console.log("Root node", id)
    }
    if (existingCids2.has(id)) {
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


