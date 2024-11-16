import crypto from "crypto";
import {
  FosContextData,
  FosNodeContent,
  FosNodesData,

} from "@/fos-combined/types";
import { User, FosNode, FosGroup, PrismaClient } from "@prisma/client";

import { generateKeyPair, randomUUID } from "crypto";

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
  const newId = randomUUID();
  return newId;
}

export function hashFosContextData(fosContextData: FosContextData) {
  // Convert the FosContextData object to a JSON string
  // console.log('keys', Object.keys(fosContextData.nodes))
  const objectWithRelevantData = {
    nodes: Object.keys(fosContextData.nodes || {}).reduce((acc, key) => {
      const nodeData = fosContextData.nodes[key];
      // if (!nodeData.mergeNode) {
      //   delete nodeData.mergeNode
      // }
      const returnVal = {
        ...acc,
        [key]: nodeData,
      };
      return returnVal;
    }, {}),
    route: fosContextData.route,
  };

  const dataString = JSON.stringify(objectWithRelevantData);

  // Create a SHA-256 hash from the JSON string
  const hash = crypto.createHash("sha256").update(dataString).digest("hex");

  return hash;
}

export const dataIsEmpty = (data: FosContextData) => {
  if (!data.nodes) {
    return true;
  }

  const rootNodeId = getRootId(data);
  const rootNode = data.nodes[rootNodeId];
  if (rootNode && rootNode.content.length < 2) {
    if (rootNode.data.description?.content) {
      return false;
    }
    return true;
  } else {
    return false;
  }
};

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

  const rootId = data.route?.[0]?.[1] || "root";

  const hasRoot = data.nodes[rootId];

  if (!hasRoot && Object.keys(data.nodes).length > 0) {
    console.log("data", data, rootId, data.nodes);
    throw new Error("no data.nodes.root");
  }
};



export const loadCtxFromDb = async (
  prisma: PrismaClient,
  userGroup: FosGroup
) => {
  const existingData = userGroup.data as Partial<Omit<FosContextData, "nodes">>;

  const meta = {
    route: [["root", userGroup.rootNodeId]],
    ...(userGroup.data as Partial<Omit<FosContextData, "nodes">>),
  } as Omit<FosContextData, "nodes">;

  if (!userGroup) {
    throw new Error("user does not have associated fos group");
  }

  const groupIds = (await getAllMemberships(userGroup, [], prisma)).map(
    (group) => group.id
  );

  const nodeModels = await prisma.fosNode.findMany({
    where: {
      FosNodeGroupAccessLink: {
        some: {
          fosGroupId: {
            in: groupIds,
          },
        },
      },
    },
  });

  const rootNodeModel = await prisma.fosNode.findUnique({
    where: {
      id: userGroup.rootNodeId,
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

  return {
    ...meta,
    nodes:
      Object.keys(nodes).length > 0 ? nodes : generateBackupNodes(userGroup),
  };
};

export const generateBackupNodes = (userGroup: FosGroup) => {
  const startTaskId = randomUUID();

  return {
    [userGroup.rootNodeId]: {
      content: [["workflow", startTaskId]],
      data: {
        description: {
          content: "",
        },
      },
    },
    [startTaskId]: {
      content: [],
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
  meta: Omit<FosContextData, "nodes">,
  nodes: FosNodesData
) => {
  // console.log("STORE CTX TO DB", meta, nodes);

  if (!meta.route) {
    throw new Error("no trail");
  }

  if (!Object.keys(nodes).length) {
    throw new Error("no nodes");
  }

  const formattedNodes = Object.keys(nodes).map((key: string) => {
    return {
      id: key,
      data: nodes[key],
    };
  });

  const groupIds = (await getAllMemberships(userGroup, [], prisma)).map(
    (group) => group.id
  );

  for (const fNode of formattedNodes) {
    const node = await prisma.fosNode.findUnique({
      where: {
        id: fNode.id,
      },
    });

    // console.log("NODE", node?.id, fNode.id, fNode.data);

    if (node) {
      const nodeLink = await prisma.fosNodeGroupAccessLink.findFirst({
        where: {
          fosNodeId: node.id,
          fosGroupId: {
            in: groupIds,
          },
        },
      });

      const updatedTimestamp = fNode.data?.data.updated?.time
        ? new Date(fNode.data?.data.updated?.time)
        : new Date(0);

      const hasPermission = !!nodeLink || userGroup.rootNodeId === node.id;
      const isNewer = updatedTimestamp > node.updatedAt;

      if (hasPermission) {
        if (isNewer) {
          await prisma.fosNode.upsert({
            where: { id: fNode.id },
            update: { data: fNode.data },
            create: { id: fNode.id, data: fNode.data },
          });
        }
      } else {
        console.log(
          "PERMISSION ERROR",
          fNode.id,
          "link",
          nodeLink,
          !!nodeLink,
          "groupIds",
          groupIds,
          fNode.data,
          userGroup.rootNodeId
        );

        throw new Error(
          "no permission to update node --- how did this end up in client? "
        );

        // await prisma.fosNode.create({
        //   data: {
        //     id: fNode.id,
        //     data: fNode.data,
        //     FosNodeGroupAccessLink: {
        //       create: groupIds.map((groupId) => {
        //         return {
        //           fosGroupId: groupId
        //         }
        //       })
        //     }
        //   }
        // })
      }
    } else {
      await prisma.fosNode.create({
        data: {
          id: fNode.id,
          data: fNode.data,
          FosNodeGroupAccessLink: {
            create: groupIds.map((groupId) => {
              return {
                fosGroupId: groupId,
              };
            }),
          },
        },
      });

      // await changeNodeIdForGroup(prisma, userGroup, fNode.id, newId)
    }
  }

  const rootNodeId = meta.route?.[0]?.[1];
  console.log("rootNodeId", rootNodeId);
  console.log("nodes", nodes);

  const updatedGroup = await prisma.fosGroup.update({
    where: { id: userGroup.id },
    data: {
      data: meta,
      rootNodeId: rootNodeId,
    },
  });
};

export const getAllMemberships = async (
  group: FosGroup,
  all: FosGroup[],
  prisma: PrismaClient
) => {
  const groupWithContainers = await prisma.fosGroup.findUnique({
    where: {
      id: group.id,
    },
    select: {
      containers: {
        select: {
          containerGroup: true,
        },
      },
    },
  });
  if (groupWithContainers && groupWithContainers.containers.length > 0) {
    const children: FosGroup[] = [group];
    for (const item of groupWithContainers.containers) {
      const childMemberships = await getAllMemberships(
        item.containerGroup,
        [] as FosGroup[],
        prisma
      );
      children.concat(childMemberships);
    }
    return all.concat();
  } else {
    return [group, ...all];
  }
};

export const createUserGroup = async (prisma: PrismaClient) => {
  const rootNodeData: FosNodeContent = {
    content: [],
    data: {
      description: {
        content: "",
      },
    },
  };

  const rootNode = await prisma.fosNode.create({
    data: {
      data: rootNodeData,
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
      rootNodeId: rootNode.id,
      privateKey,
      publicKey,
    },
  });

  return group;
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

export const getGroupNodes = async (
  prisma: PrismaClient,
  userGroup: FosGroup
) => {
  const groupIds = (await getAllMemberships(userGroup, [], prisma)).map(
    (group) => group.id
  );

  const nodeModels = await prisma.fosNode.findMany({
    where: {
      FosNodeGroupAccessLink: {
        some: {
          fosGroupId: {
            in: groupIds,
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
    const content = nodeData.content;

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
          content: newContent,
        },
      },
    });
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
