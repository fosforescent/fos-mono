import { FosContextData, FosDataContent, FosNodeContent, FosNodeId, FosNodesData } from '@/shared/types'
import { FosGroup, PrismaClient, User } from '@prisma/client'
import { GeneratedResult } from './seedData'
import { hashContent } from '@/shared/dag-implementation/store'

export const createNodes = async (prisma: PrismaClient, nodesData: FosNodesData) => {
    for (const [key, value] of Object.entries(nodesData)) {
        await prisma.fosNode.upsert({
        where: { id: key },
        update: {
          data: value,
          cid: hashContent(value),
        },
        create: {
            id: key,
            data: value,
            cid: hashContent(value),
        },
        })
    }
}

export const createUser = async (prisma: PrismaClient, rootTargetNodeId: FosNodeId, rootInstructionNodeId: FosNodeId,  userData: {
    user_name: string,
    rootTargetNodeContent?: [string, string][],
    rootTargetNodeData?: FosDataContent,
    rootInstructionNodeContent?: [string, string][],
    rootInstructionNodeData?: FosDataContent,
    description?: string
}) => {
  console.log('userData', userData.rootTargetNodeContent)

  const targetContent = {
    children: userData.rootTargetNodeContent || [],
    data: userData.rootTargetNodeData || {
        description: { content: `${userData.user_name} root node` },
    },
  }

  const instructionContent = {
    children: userData.rootInstructionNodeContent || [],
    data: userData?.rootInstructionNodeData || {
        description: { content: `${userData.user_name} root instruction node` },
    },
  }

  const user = await prisma.user.upsert({
      where: { user_name: userData.user_name },
      update: {},
      create: {
          user_name: userData.user_name,
          password: '$2b$10$rj7HD6..PmPz4nD2Y98T1uPkAacf74.5SF1UDKA7M3QzQwPbdaiW.',
          accepted_terms: (new Date()).toISOString(),
          api_calls_available: 200,
          subscription_status: 'active',
          approved: true,
          fosGroup: {
              create: {
                  rootTargetNode:{
                      create: {
                          id: rootTargetNodeId ,
                          cid: hashContent(targetContent),
                          data: targetContent
                      }
                  },
                  rootInstructionNode: {
                      create: {
                          id: rootInstructionNodeId,
                          data: instructionContent,
                          cid: hashContent(instructionContent)
                      }
                  },
                  data: {},
                  privateKey: 'privateKey',
                  publicKey: 'publicKey',
              }
          }
      },
  })
  return user
}

export const createGroup = async (prisma: PrismaClient, rootTargetNodeId: FosNodeId, rootInstructionNodeId: FosNodeId, groupData: {
    groupId?: number
    rootNodeContent?: [string, string][],
    rootNodeData?: FosDataContent,
    description?: string
}) => {


  const targetContent = {
    children: groupData.rootNodeContent || [],
    data: {
        ...groupData.rootNodeData,
        description: { content: `group ${groupData.groupId} root node`}
    },
  }

  const instructionContent = {
    children: [],
    data: {
        description: { content: `group ${groupData.groupId} root instruction node` },
    },
  }


    const group = await prisma.fosGroup.upsert({
        where: { id: 0 },
        update: {},
        create: {
            rootTargetNode:{
                create: {
                    id: rootTargetNodeId,
                    cid: hashContent(targetContent),
                    data: targetContent
                }
            },
            rootInstructionNode: {
                create: {
                    id: rootInstructionNodeId,
                    cid: hashContent(instructionContent),
                    data: instructionContent
                }
            },
            data: {},
            privateKey: 'privateKey',
            publicKey: 'publicKey',
        },
    })
    return group
}

export const createUserWithNodes = async (prisma: PrismaClient, userData: { user_name: string }, generated: GeneratedResult) => {

  
    await createNodes(prisma, generated.nodesData)

    const user = await createUser(prisma, generated.rootTargetNodeId, generated.rootInstructionNodeId, { ...userData, 
        rootTargetNodeContent: generated.rootTargetNodeContent.children,
        rootTargetNodeData: generated.rootInstructionNodeContent.data,
        rootInstructionNodeContent: generated.rootInstructionNodeContent.children,
        rootInstructionNodeData: generated.rootInstructionNodeContent.data,
    })

    const userGroup = await prisma.fosGroup.findFirst({
        where: { id: user.fosGroupId },
    })

    if (!userGroup) {
        throw new Error('User fos group not found')
    }

    await linkNodesToGroup(prisma, userGroup, generated.nodesData)
    return user
}

export const linkNodesToGroup = async (prisma: PrismaClient, group: FosGroup, nodesData: FosNodesData) => {

    for (const [nodeId, nodeData] of Object.entries(nodesData)) {
        await prisma.fosNodeGroupAccessLink.create({
            data: {
                fosNodeId: nodeId,
                fosGroupId: group.id,
            }
        })
        
    }
}


export const createGroupWithNodes = async (prisma: PrismaClient, groupData: { groupId?: number }, generated: GeneratedResult) => {

  
    await createNodes(prisma, generated.nodesData)

    const group = await createGroup(prisma, generated.rootTargetNodeId, generated.rootInstructionNodeId, { ...groupData, 
        rootNodeContent: generated.rootTargetNodeContent.children,
        rootNodeData: generated.rootInstructionNodeContent.data,
    })
    return group
}

export const attachUserToGroup = async (prisma: PrismaClient, user: User, group: FosGroup) => {

    const userFosGroup = await prisma.fosGroup.findFirst({
        where: { id: user.fosGroupId },
        include: { rootTargetNode: true, rootInstructionNode: true }
    })
    if (!userFosGroup) {
        throw new Error('User fos group not found')
    }

    const userRootNode = await prisma.fosNode.findFirst({
        where: { id: userFosGroup?.rootTargetNode.id },
    })
    
    if(!userRootNode) {
        throw new Error('User root node not found')
    }




    const groupUserNodeAccessLink = await prisma.fosNodeGroupAccessLink.create({
        data: {
            fosNodeId: group.rootTargetNodeId,
            fosGroupId: userFosGroup.id,
        }
    })

    if (userRootNode?.data) {
        const nodeContent = userRootNode.data as FosNodeContent
        if (!nodeContent.children) {
          console.log('nodeContent', nodeContent)
          throw new Error('User root node has no children')
        }       
        const newNodeData = {
            data: nodeContent.data,
            children: [...nodeContent.children, ["GROUP", group.rootTargetNodeId]]
        }

        await prisma.fosNode.update({
            where: { id: userRootNode?.id },
            data: {
                data: newNodeData
            }
        })
    }

    const groupRootInstructionNode = await prisma.fosNode.findFirst({
        where: { id: group.rootInstructionNodeId },
    })

    if (groupRootInstructionNode?.data) {
        const nodeContent = groupRootInstructionNode.data as FosNodeContent
        if (!nodeContent.children) {
          console.log('nodeContent', nodeContent)
          throw new Error('User root node has no children')
        }       
        const newNodeData = {
            data: nodeContent.data,
            children: [...nodeContent.children, ["PEER", userFosGroup.rootTargetNodeId]]
        }

        await prisma.fosNode.update({
            where: { id: groupRootInstructionNode?.id },
            data: {
                data: newNodeData
            }
        })
    }

}

const addUserCommentToGroup = async (prisma: PrismaClient, user: User, group: FosGroup, comment: string) => {



}

const addTodoToGroup = async (prisma: PrismaClient, user: User, group: FosGroup, todo: string) => {


}

const addWorkflowToGroup = async (prisma: PrismaClient, user: User, group: FosGroup, workflow: string) => {



}

