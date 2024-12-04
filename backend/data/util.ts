import crypto from "crypto";
import {
  AppState,
  FosContextData,
  FosNodeContent,
  FosNodesData,

} from "@/shared/types";


import { validate as isUuid } from "uuid";

import { User, FosNode, FosGroup, PrismaClient } from "@prisma/client";

import { generateKeyPair, randomUUID } from "crypto";
import { upsertSearchTerms } from "./search";
import { FosStore } from "@/shared/dag-implementation/store";

export function hashNode(nodeData: FosNodeContent) {
  // Convert the FosNodeData object to a JSON string
  const dataString = JSON.stringify({ ...nodeData });

  // Create a SHA-256 hash from the JSON string
  const hash = crypto.createHash("sha256").update(dataString).digest("hex");

  return hash;
}

export function hashNodeContent(nodeData: FosNodeContent) {
  // Convert the FosNodeData object to a JSON string
  const dataString = JSON.stringify({ ...nodeData });

  // Create a SHA-256 hash from the JSON string
  const hash = crypto.createHash("sha256").update(dataString).digest("hex");

  return hash;
}

export function generateNewId(data: FosContextData) {
  console.log("Generating new id");
  const newId = randomUUID();
  return newId;
}

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



export const loadCtxFromDb = async (
  prisma: PrismaClient,
  userGroup: FosGroup,
  User: User
): Promise<FosContextData> => {
  const existingData = userGroup.data as Partial<Omit<FosContextData, "nodes">>;


  const baseTargetNode = await prisma.fosNode.findUnique({
    where: {
      id: userGroup.rootTargetNodeId,
    },
  });

  const baseNodeInstruction = await prisma.fosNode.findUnique({
    where: {
      id: userGroup.rootInstructionNodeId,
    },
  });

  const meta = {
    route: [],
    ...(userGroup.data as Partial<Omit<FosContextData, "nodes">>),
    baseNodeContent: baseTargetNode?.data as FosNodeContent,
    baseNodeInstruction: baseNodeInstruction?.data as FosNodeContent
  } as Omit<FosContextData, "nodes">;

  if (!userGroup) {
    throw new Error("user does not have associated fos group");
  }

  // const groupIds = (await getAllMemberships(userGroup, [], prisma)).map(
  //   (group) => group.id
  // );

  const nodeModels = await prisma.fosNode.findMany()
 
  // const nodeModels = await prisma.fosNode.findMany({
  //   where: {
  //     FosNodeGroupAccessLink: {
  //       some: {
  //         fosGroupId: {
  //           // in: groupIds,
  //           in: [userGroup.id],
  //         },
  //       },
  //     },
  //   },
  // });

  const rootNodeModel = await prisma.fosNode.findUnique({
    where: {
      id: userGroup.rootTargetNodeId,
    },
  });

  if (!rootNodeModel) {
    throw new Error("no root node");
  }

  const nodes = [rootNodeModel, ...nodeModels].reduce((acc, nodeModel) => {
    const result: FosNodesData = {
      ...acc,
      [nodeModel.id]: nodeModel.data,
    };
    // console.log('NODE', nodeModel.id, (nodeModel.data as any).description?.content)
    return result;
  }, {});

  // console.log("LOADING DATA FROM DB", meta, nodes);

  const result: FosContextData = {
    ...meta,
    nodes: Object.keys(nodes).length > 0 ? nodes : generateBackupNodes(userGroup),
  }
  return result;
};

export const generateBackupNodes = (userGroup: FosGroup) => {
  const startTaskId = randomUUID();

  return {
    [userGroup.rootTargetNodeId]: {
      children: [["workflow", startTaskId]],
      data: {
        description: {
          content: "",
        },
      },
    },
    [startTaskId]: {
      children: [],
      data: {
        description: {
          content: "",
        },
      },
    },
  };
};

export const storeCtxToDb = async (
  prisma: PrismaClient,
  userGroup: FosGroup,
  store: FosStore,
) => {
  // console.log("STORE CTX TO DB", meta, nodes);
  

  let cidsLeft = new Set(store.table.keys())
  let nodeObjects: {
    content: FosNodeContent,
    uuid: string, 
    cid: string,
  }[] = []
  store.aliasMap.keys().forEach((key) => {
    if (isUuid(key)) {
      const cid = store.aliasMap.get(key);
      if (!cid) {
        throw new Error("no cid found for alias");
      }
      const nodeContent = store.table.get(cid);
      if (!nodeContent) {
        throw new Error("no node content found for cid");
      }
      nodeObjects.push({
        content: nodeContent,
        uuid: key,
        cid: cid
      })
      cidsLeft.delete(cid)
    }
  })



  for (const fNode of nodeObjects) {
    const node = await prisma.fosNode.findUnique({
      where: {
        id: fNode.uuid,
      },
    });

    if(!node){
      throw new Error("no node found")
    }


    const updatedTimestamp = fNode.content?.data.updated?.time
      ? new Date(fNode.content?.data.updated?.time)
      : new Date(0);
    const isNewer = updatedTimestamp > node.updatedAt;

    const hasPermission = true;


    if (hasPermission) {
      if (isNewer) {
        await prisma.fosNode.upsert({
          where: { id: fNode.uuid },
          update: { data: fNode.content },
          create: { id: fNode.uuid, data: fNode.content, cid: fNode.cid },
        });
      }
    } else {
      console.log(
        "PERMISSION ERROR",
        fNode.uuid,
        "link",
        "groupIds",
        // groupIds,
        fNode,
        userGroup.rootTargetNodeId
      );

      throw new Error(
        "no permission to update node --- how did this end up in client? "
      );


    }
  } 
  
  
  for (const cid of cidsLeft) {

    const nodeContent = store.table.get(cid);

    const found = await prisma.fosNode.findMany({
      where: {
        cid: cid,
      },
    });

    if (found.length === 0) {
      await prisma.fosNode.create({
        data: {
          cid: cid,
          data: nodeContent,
        },
      });
    };

  }

  const meta: Partial<Omit<FosContextData, "nodes">> = {
    route: store.fosRoute,
    baseNodeContent: store.rootTarget.getContent(),
    baseNodeInstruction: store.rootInstruction.getContent(),
  };

  const updatedGroupNode = await prisma.fosNode.update({
    where: { id: userGroup.rootTargetNodeId },
    data: {
      data: store.rootTarget.getContent(),
    },
  });

  const updatedGroupInstructionNode = await prisma.fosNode.update({
    where: { id: userGroup.rootInstructionNodeId },
    data: {
      data: store.rootInstruction.getContent(),
    },
  });

};

// export const getAllMemberships = async (
//   group: FosGroup,
//   all: FosGroup[],
//   prisma: PrismaClient
// ) => {
//   const groupWithContainers = await prisma.fosGroup.findUnique({
//     where: {
//       id: group.id,
//     },
//     select: {
//       containers: {
//         select: {
//           containerGroup: true,
//         },
//       },
//     },
//   });
//   if (groupWithContainers && groupWithContainers.containers.length > 0) {
//     const children: FosGroup[] = [group];
//     for (const item of groupWithContainers.containers) {
//       const childMemberships = await getAllMemberships(
//         item.containerGroup,
//         [] as FosGroup[],
//         prisma
//       );
//       children.concat(childMemberships);
//     }
//     return all.concat();
//   } else {
//     return [group, ...all];
//   }
// };

export const createUserGroup = async (prisma: PrismaClient) => {
  const rootTargetNodeData: FosNodeContent = {
    children: [],
    data: {
      description: {
        content: "",
      },
    },
  };
  const rootInstructionNodeData: FosNodeContent = {
    children: [],
    data: {
      description: {
        content: "",
      },
    },
  };
  const rootTargetNode = await prisma.fosNode.create({
    data: {
      data: rootTargetNodeData,
      cid: hashNodeContent(rootTargetNodeData),
    },
  });
  const rootInstructionNode = await prisma.fosNode.create({
    data: {
      data: rootInstructionNodeData,
      cid: hashNodeContent(rootInstructionNodeData),
    },
  });

  const { publicKey, privateKey } = await new Promise<{
    publicKey: string;
    privateKey: string;
  }>((resolve, reject) => {
    generateKeyPair(
      "rsa",
      {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: "spki",
          format: "pem",
        },
        privateKeyEncoding: {
          type: "pkcs8",
          format: "pem",
          cipher: "aes-256-cbc",
          passphrase: "top secret",
        },
      },
      (err, publicKey, privateKey) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            publicKey,
            privateKey,
          });
        }
      }
    );
  });

  const group = await prisma.fosGroup.create({
    data: {
      rootTargetNodeId: rootTargetNode.id,
      rootInstructionNodeId: rootInstructionNode.id,
      privateKey,
      publicKey,
    },
  });

  return group;
};



export const getGroupNodes = async (
  prisma: PrismaClient,
  userGroup: FosGroup
) => {
  // const groupIds = (await getAllMemberships(userGroup, [], prisma)).map(
  //   (group) => group.id
  // );

  const nodeModels = await prisma.fosNode.findMany({
    where: {
      FosNodeGroupAccessLink: {
        some: {
          fosGroupId: {
            // in: groupIds,
            in: [userGroup.id],
          },
        },
      },
    },
  });

  return nodeModels;
};

export const changeNodeIdForGroup = async (
  prisma: PrismaClient,
  group: FosGroup,
  oldId: string,
  newId: string
) => {
  const nodes = await getGroupNodes(prisma, group);

  for (const node of nodes) {
    const nodeData = node.data as FosNodeContent;
    const content = nodeData.children;

    const newContent = content.map(([type, id]) => {
      return [type, id === oldId ? newId : id];
    });

    await prisma.fosNode.update({
      where: {
        id: node.id,
      },
      data: {
        data: {
          ...nodeData,
          children: newContent,
        },
      },
    });
  }
};
