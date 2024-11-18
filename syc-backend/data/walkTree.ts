import crypto from "crypto";
import {
  AppState,
  FosContextData,
  FosNodeContent,
  FosNodesData,
  TrellisSerializedData
} from "@/fos-combined/types";


import { Pinecone } from '@pinecone-database/pinecone';


import { User, FosNode, FosGroup, PrismaClient } from "@prisma/client";
import { getNodeInfo, getNodeInfoShared } from "@/fos-combined/lib/utils";

import { Request, Response, NextFunction } from 'express'
import _, { get, merge } from 'lodash'

import { ReqWithClients } from '../clientManager'

import { prisma } from './../prismaClient'
import { InputJsonValue, JsonObject } from '@prisma/client/runtime/library'
import { validate } from "uuid";




export const walkNodes = async (clientData: AppState["data"]): {
  contextToReturn: AppState["data"],
  contextToStore: AppState["data"],
} => {

  /**
   * Actions: 
   * - payment node
   *   - separate from allocated payment
   * - invoice node
   *   - separate from invoice draft 
   * - group node
   *   - should summarize group data... leave off peers etc.
   *   - should create diff of workflows and other documents
   *   - can just pull all discussion nodes for now
   *   - how to do votes?
   * - bid / bid request node
   *   - should create corresponding request on other user's node
   *   - approvals from both parties should change bid to fulfillment
   * - fulfillment node
   *   - approvals from both parties should cause payment to be made
   *   
   * 
   * 
   */

  




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


      const clientData = req.body.data as { fosData: FosContextData, trellisData: TrellisSerializedData } 

      checkDataFormat(clientData)
      
      const clientRootId = getRootId(clientData.fosData)

      if (clientRootId !== user.fosGroup.rootNodeId) {
        throw new Error('Client root node does not match user root node')
      }
      
    
      const {
        contextToReturn, 
        contextToStore
      } = await walkNodes(clientData)


      // console.log('nodes', nodes, meta)
      await storeCtxToDb(prisma, contextToStore, user)

      return res.json({
        data: contextToReturn,
        updated: true,
      })

    }
  } catch (error) {
    console.error(error)
    res.status(500).send('Internal Server Error')
    return res
  }
}





export const storeCtxToDb = async (
  prisma: PrismaClient,
  appData: AppState["data"],
  user: User,
) => {
  // console.log("STORE CTX TO DB", meta, nodes);


  checkDataFormat(appData);

  
  const formattedNodes = Object.keys(appData.fosData.nodes).map((key: string) => {
    return {
      id: key,
      data: appData.fosData.nodes[key],
    };
  });

  for (const fNode of formattedNodes) {    

      await prisma.fosNode.upsert({
        where: { id: fNode.id },
        update: {
          data: {
            id: fNode.id,
            data: fNode.data,
          },
        },
        create: {
          id: fNode.id,
          data: fNode.data,
        },  
      })
  }

  const updatedUser = await prisma.user.update({
    where: { user_name: user.user_name },
    data: { data: appData.trellisData as unknown as JsonObject}
  })

  const rootNodeId = appData.fosData.route?.[0]?.[1];

  const updatedGroup = await prisma.fosGroup.update({
    where: { id: user.fosGroupId },
    data: {
      rootNodeId: rootNodeId,
    },
  });


};





export const checkAndFormatData = (clientData: AppState["data"], serverData: AppState["data"]): AppState["data"] => {
  
  const userDataWithNewRootNode = updateRootNodeId(clientData.fosData, getRootId(serverData.fosData))

  checkDataFormat({ fosData: userDataWithNewRootNode, trellisData: clientData.trellisData })

  if (!clientData) {
    throw new Error('No data provided in request')
  }
  

  const clientDataWithAllNodes = {
    ...userDataWithNewRootNode,
    nodes: {
      ...serverData.fosData.nodes,
      ...userDataWithNewRootNode.nodes,
    }
  }

  const fullData = { fosData: clientDataWithAllNodes, trellisData: clientData.trellisData }
  checkDataFormat(fullData)

  return fullData
}


export const checkDataFormat = (data: AppState["data"]) => {
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

  
  if (!data.fosData.route) {
    throw new Error("no trail");
  }

  if (!Object.keys(data.fosData.nodes).length) {
    throw new Error("no nodes");
  }

  const rootId = data.fosData.route?.[0]?.[1] || "root";
  
  if (!rootId) {
    console.log("rootNodeId", rootId);
    console.log("nodes", nodes);
  
    throw new Error("no root node");
  }



  const hasRoot = data.fosData.nodes[rootId];

  if (!hasRoot && Object.keys(data.fosData.nodes).length > 0) {
    console.log("data", data, rootId, data.fosData.nodes);
    throw new Error("no data.nodes.root");
  }
};



export const updateRootNodeId = (
  contextData: FosContextData,
  newRootId: string
): FosContextData => {
  const currentRootId = getRootId(contextData);
  if (currentRootId === newRootId) {
    return contextData;
  }

  const rootNodeData = contextData.nodes[currentRootId];

  if (!rootNodeData) {
    throw new Error("no root node in context data");
  }

  contextData.nodes[newRootId] = rootNodeData;
  delete contextData.nodes[currentRootId];

  if (!contextData.route) {
    return {
      ...contextData,
      route: [["root", newRootId]],
    };
  } else {
    const [head, ...tail] = contextData.route;

    if(!head) {
      throw new Error("improperly formatted trail in context data");
    }

    return {
      ...contextData,
      route: [[head[0], newRootId], ...tail],
    };
  }
};


export const getRootId = (data: FosContextData) => {
  if (!data.route) {
    throw new Error("!data.trail");
  }
  const rootElem = data.route?.[0];

  if (!rootElem) {
    throw new Error("!rootElem");
  }

  return rootElem[1];
};