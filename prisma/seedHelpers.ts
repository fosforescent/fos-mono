import { FosContextData, FosDataContent, FosNodeContent, FosNodeId, FosNodesData } from '@/fos-combined/types'
import { FosGroup, PrismaClient, User } from '@prisma/client'

export const createNodes = async (prisma: PrismaClient, nodesData: FosNodesData) => {
    for (const [key, value] of Object.entries(nodesData)) {
        await prisma.fosNode.upsert({
        where: { id: key },
        update: {},
        create: {
            id: key,
            data: value,
        },
        })
    }
}

export const createUser = async (prisma: PrismaClient, rootNodeId: FosNodeId,  userData: {
    user_name: string,
    rootNodeContent?: [string, string][],
    rootNodeData?: FosDataContent,
    description?: string
}) => {
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
                    rootNode:{
                        create: {
                            id: rootNodeId ,
                            data: {
                                content: userData.rootNodeContent || [],
                                data: userData.rootNodeData || {
                                    description: { content: `${userData.user_name} root node` },
                                },
                            }
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

export const createGroup = async (prisma: PrismaClient, rootNodeId: FosNodeId, groupData: {
    groupId?: number
    rootNodeContent?: [string, string][],
    rootNodeData?: FosDataContent,
    description?: string
}) => {
    const group = await prisma.fosGroup.upsert({
        where: { id: 0 },
        update: {},
        create: {
            rootNode:{
                create: {
                    id: rootNodeId,
                    data: {
                        content: groupData.rootNodeContent || [],
                        data: {
                            ...groupData.rootNodeData,
                            description: { content: `group ${groupData.groupId} root node`}
                        },
                    }
                }
            },
            data: {},
            privateKey: 'privateKey',
            publicKey: 'publicKey',
        },
    })
    return group
}

export const createUserWithNodes = async (prisma: PrismaClient, userData: { user_name: string }, generated: { nodesData: FosNodesData, rootNodeId: FosNodeId, rootNodeContent: FosNodeContent }) => {
    const { nodesData, rootNodeId, rootNodeContent } = generated    

    await createNodes(prisma, nodesData)

    const user = await createUser(prisma, rootNodeId, { ...userData, 
        rootNodeContent: rootNodeContent.content,
        rootNodeData: rootNodeContent.data,
    })

    const userGroup = await prisma.fosGroup.findFirst({
        where: { id: user.fosGroupId },
    })

    if (!userGroup) {
        throw new Error('User fos group not found')
    }

    await linkNodesToGroup(prisma, userGroup, nodesData)
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


export const createGroupWithNodes = async (prisma: PrismaClient, groupData: { groupId?: number }, generated: { nodesData: FosNodesData, rootNodeId: FosNodeId, rootNodeContent: FosNodeContent }) => {
    const { nodesData, rootNodeId, rootNodeContent } = generated    

    await createNodes(prisma, nodesData)

    const group = await createGroup(prisma, rootNodeId, { ...groupData, 
        rootNodeContent: rootNodeContent.content,
        rootNodeData: rootNodeContent.data,
    })
    return group
}

export const attachUserToGroup = async (prisma: PrismaClient, user: User, group: FosGroup) => {

    const userFosGroup = await prisma.fosGroup.findFirst({
        where: { id: user.fosGroupId },
        include: { rootNode: true }
    })
    if (!userFosGroup) {
        throw new Error('User fos group not found')
    }

    const userRootNode = await prisma.fosNode.findFirst({
        where: { id: userFosGroup?.rootNode.id },
    })
    
    if(!userRootNode) {
        throw new Error('User root node not found')
    }




    const groupUserNodeAccessLink = await prisma.fosNodeGroupAccessLink.create({
        data: {
            fosNodeId: group.rootNodeId,
            fosGroupId: userFosGroup.id,
        }
    })

    if (userRootNode?.data) {
        const nodeContent = userRootNode.data as FosNodeContent
        const newNodeData = {
            data: nodeContent.data,
            content: [...nodeContent.content, ["group", group.rootNodeId]]
        }

        await prisma.fosNode.update({
            where: { id: userRootNode?.id },
            data: {
                data: newNodeData
            }
        })
    }

    const groupRootNode = await prisma.fosNode.findFirst({
        where: { id: group.rootNodeId },
    })

    if (groupRootNode?.data) {
        const nodeContent = groupRootNode.data as FosNodeContent
        const newNodeData = {
            data: nodeContent.data,
            content: [...nodeContent.content, ["peer", userFosGroup.rootNodeId]]
        }

        await prisma.fosNode.update({
            where: { id: groupRootNode?.id },
            data: {
                data: newNodeData
            }
        })
    }

}