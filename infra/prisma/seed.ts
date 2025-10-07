import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { dbToStore, storeToDb, validateNodeDataToDB } from '../../backend/util'
import { hashContent } from '@fosforescent/shared/dag-implementation/store'
import type { FosNodeContent } from '@fosforescent/shared/types'

const prisma = new PrismaClient()

async function main() {
  // Enable vector extension for embeddings
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;')

  console.log('Creating seed users...')

  // Create test users sequentially to avoid race conditions
  await createUser('alice@fosforescent.com', 'alice123', 'Alice Smith', 'user')
  await createUser('bob@fosforescent.com', 'bob123', 'Bob Johnson', 'user')
  await createUser('charlie@fosforescent.com', 'charlie123', 'Charlie Williams', 'user')
  await createUser('diana@fosforescent.com', 'diana123', 'Diana Brown', 'user')
  await createUser('eve@fosforescent.com', 'eve123', 'Eve Davis', 'user')

  // Fetch users with fosNode relation for group creation
  console.log('About to fetch users with fosNode relation...')
  const users = await prisma.userModel.findMany({
    include: { fosNode: true },
    orderBy: { id: 'asc' }
  })

  console.log('Fetched users count:', users.length)
  if (users.length > 0) {
    console.log('First user:', JSON.stringify({
      id: users[0].id,
      username: users[0].user_name,
      fosNodeId: users[0].fosNodeId,
      fosNode: users[0].fosNode
    }, null, 2))
  }

  if (users.length === 0) {
    throw new Error('No users found after creation!')
  }

  console.log('Creating groups...')

  // Create various groups among users
  await createGroups(users)

  console.log('Creating MCP servers...')

  // Create sample MCP servers
  const mcpServers = await Promise.all([
    createMCPServer({
      name: 'File System Tools',
      description: 'Tools for file system operations like reading, writing, and listing files',
      endpoint: 'ws://localhost:3001/mcp'
    }),
    createMCPServer({
      name: 'Web Search API',
      description: 'Search the web and retrieve information from various sources',
      endpoint: 'https://api.websearch.example.com/mcp'
    }),
    createMCPServer({
      name: 'Database Tools',
      description: 'Tools for database operations and queries',
      endpoint: 'ws://localhost:3002/mcp'
    }),
    createMCPServer({
      name: 'AI Assistant Tools',
      description: 'AI-powered tools for text processing and analysis',
      endpoint: 'https://ai-tools.example.com/mcp'
    })
  ])

  console.log('Creating MCP tools...')

  // Create tools for each server
  await createToolsForServer(mcpServers[0].id, [
    {
      name: 'read_file',
      description: 'Read contents of a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' }
        },
        required: ['path']
      }
    },
    {
      name: 'write_file',
      description: 'Write content to a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'Content to write' }
        },
        required: ['path', 'content']
      }
    },
    {
      name: 'list_directory',
      description: 'List files and directories in a path',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list' }
        },
        required: ['path']
      }
    }
  ])

  await createToolsForServer(mcpServers[1].id, [
    {
      name: 'web_search',
      description: 'Search the web for information',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Number of results' }
        },
        required: ['query']
      }
    },
    {
      name: 'get_webpage_content',
      description: 'Extract content from a webpage',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch' }
        },
        required: ['url']
      }
    }
  ])

  await createToolsForServer(mcpServers[2].id, [
    {
      name: 'execute_query',
      description: 'Execute a database query',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'SQL query to execute' },
          database: { type: 'string', description: 'Database name' }
        },
        required: ['query']
      }
    }
  ])

  await createToolsForServer(mcpServers[3].id, [
    {
      name: 'analyze_text',
      description: 'Analyze text for sentiment, topics, etc.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to analyze' },
          analysis_type: { type: 'string', enum: ['sentiment', 'topics', 'summary'] }
        },
        required: ['text', 'analysis_type']
      }
    },
    {
      name: 'translate_text',
      description: 'Translate text between languages',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to translate' },
          from_language: { type: 'string', description: 'Source language code' },
          to_language: { type: 'string', description: 'Target language code' }
        },
        required: ['text', 'to_language']
      }
    }
  ])

  console.log('Setting up user access...')

  // Grant access to users for all servers
  for (const user of users) {
    for (const server of mcpServers) {
      await prisma.userMCPServerAccessModel.create({
        data: {
          userId: user.id,
          serverId: server.id,
          role: 'user'
        }
      })
    }
  }

  console.log('Setting up token pricing...')

  // Set up token pricing for tools
  const pricingData = [
    { serverId: mcpServers[0].id, toolName: 'read_file', pricePerUseTokens: 1 },
    { serverId: mcpServers[0].id, toolName: 'write_file', pricePerUseTokens: 2 },
    { serverId: mcpServers[0].id, toolName: 'list_directory', pricePerUseTokens: 1 },
    { serverId: mcpServers[1].id, toolName: 'web_search', pricePerUseTokens: 5 },
    { serverId: mcpServers[1].id, toolName: 'get_webpage_content', pricePerUseTokens: 3 },
    { serverId: mcpServers[2].id, toolName: 'execute_query', pricePerUseTokens: 10 },
    { serverId: mcpServers[3].id, toolName: 'analyze_text', pricePerUseTokens: 8 },
    { serverId: mcpServers[3].id, toolName: 'translate_text', pricePerUseTokens: 6 }
  ]

  for (const pricing of pricingData) {
    await prisma.mCPToolPricingModel.create({
      data: pricing
    })
  }

  console.log('Setting up initial token balances...')

  // Give users initial token balances
  for (const user of users) {
    const initialTokens = user.role === 'admin' ? 10000 : 1000
    await prisma.userTokenBalanceModel.create({
      data: {
        userId: user.id,
        availableTokens: initialTokens,
        totalPurchased: initialTokens,
        totalUsed: 0,
        subscriptionTokens: initialTokens, // Initial grant as subscription tokens
        purchasedTokens: 0
      }
    })

    // Create initial token credit transaction
    await prisma.tokenTransactionModel.create({
      data: {
        transactionId: `initial_credit_${user.id}_${Date.now()}`,
        userId: user.id,
        type: 'subscription_grant',
        amount: initialTokens,
        description: 'Initial token grant',
        balanceBefore: 0,
        balanceAfter: initialTokens,
        metadata: {
          source: 'initial_setup',
          userRole: user.role
        }
      }
    })
  }

  console.log('Seed data created successfully!')
  console.log(`Created ${users.length} users`)
  console.log(`Created ${mcpServers.length} MCP servers`)
  console.log(`Created ${pricingData.length} tool pricing entries`)
}

async function createUser(email: string, password: string, displayName: string, role: 'admin' | 'user') {
  const hashedPassword = await bcrypt.hash(password, 10)
  const { v4: uuidv4 } = await import('uuid')

  // Create the actual workspace root node
  const workspaceContent: FosNodeContent = {
    data: {
      description: {
        content: `${displayName}'s workspace`
      }
    },
    children: []
  }
  const workspaceCid = hashContent(workspaceContent)

  console.log(`Creating workspace node for ${displayName} with CID: ${workspaceCid}`)

  const workspaceNode = await prisma.fosNodeModel.create({
    data: {
      cid: workspaceCid,
      data: validateNodeDataToDB(workspaceContent)
    }
  })

  // Create an alias node that points to the workspace
  const aliasId = uuidv4()
  const aliasContent: FosNodeContent = {
    data: {
      alias: {
        id: aliasId
      }
    },
    children: [[workspaceCid, workspaceCid]] as FosNodeContent["children"]
  }
  const aliasCid = hashContent(aliasContent)

  console.log(`Creating alias node for ${displayName} with CID: ${aliasCid}, aliasId: ${aliasId}`)

  const aliasNode = await prisma.fosNodeModel.create({
    data: {
      cid: aliasCid,
      data: validateNodeDataToDB(aliasContent)
    }
  })

  // Create user with reference to the alias node
  const user = await prisma.userModel.create({
    data: {
      user_name: email,
      password: hashedPassword,
      role: role,
      accepted_terms: new Date(),
      fosNodeId: aliasNode.cid, // Points to the alias node
      user_profile: {
        displayName: displayName,
        email: email
      },
      data: {
        nodes: {},
        route: [],
        rootNodeId: aliasNode.cid
      }
    }
  })

  // Create access links for both nodes
  await prisma.fosNodeUserAccessLinkModel.createMany({
    data: [
      {
        userId: user.id,
        fosNodeId: aliasNode.cid
      },
      {
        userId: user.id,
        fosNodeId: workspaceNode.cid
      }
    ]
  })

  return user
}

async function createGroups(users: any[]) {
  console.log('createGroups received users:', users.map(u => ({ id: u.id, fosNodeId: u.fosNodeId, hasFosNode: !!u.fosNode })))

  // TODO: DM creation disabled - there's an issue with createDM not finding the DM after creation
  // The architecture needs to be revisited - DMs should be standalone nodes that both users reference
  // For now, users are created and E2E tests can test without DMs

  console.log('Skipping DM creation - users created successfully')

  // Send a message in the DM
  const aliceStore2 = await dbToStore(prisma, users[0])
  const aliceRoot2 = aliceStore2.getRootExpression()
  const dmExpr = aliceRoot2.getTargetChildren().find(
    child => child.targetNode.getId() === dmAliceBob.targetNode.getId()
  )
  if (dmExpr) {
    await dmExpr.sendGroupMessage('Hey Bob! How are you?', users[0].fosNodeId, 'Alice Smith')
  }
  await storeToDb(prisma, users[0], aliceStore2)

  // Group 2: Small team - Alice, Charlie, Diana (3 members)
  console.log('Creating small team: Alice, Charlie, Diana...')
  const aliceStore3 = await dbToStore(prisma, users[0])
  const aliceRoot3 = aliceStore3.getRootExpression()
  const teamGroup = await aliceRoot3.createGroup(
    'Design Team',
    'Team working on design projects',
    'private'
  )
  await teamGroup.addMemberToGroup(users[2].fosNodeId) // Charlie
  await teamGroup.addMemberToGroup(users[3].fosNodeId) // Diana
  await storeToDb(prisma, users[0], aliceStore3)

  // Send messages in the team
  const aliceStore4 = await dbToStore(prisma, users[0])
  const aliceRoot4 = aliceStore4.getRootExpression()
  const teamExpr = aliceRoot4.getTargetChildren().find(
    child => child.targetNode.getData().group?.name === 'Design Team'
  )
  if (teamExpr) {
    await teamExpr.sendGroupMessage('Welcome to the design team!', users[0].fosNodeId, 'Alice Smith')
    await teamExpr.sendGroupMessage('Happy to be here!', users[2].fosNodeId, 'Charlie Williams')
  }
  await storeToDb(prisma, users[0], aliceStore4)

  // Group 3: Medium team - Bob, Charlie, Diana, Eve (4 members)
  console.log('Creating medium team: Bob, Charlie, Diana, Eve...')
  const bobStore = await dbToStore(prisma, users[1])
  const bobRoot = bobStore.getRootExpression()
  const devGroup = await bobRoot.createGroup(
    'Development Team',
    'Backend and frontend developers',
    'public'
  )
  await devGroup.addMemberToGroup(users[2].fosNodeId) // Charlie
  await devGroup.addMemberToGroup(users[3].fosNodeId) // Diana
  await devGroup.addMemberToGroup(users[4].fosNodeId) // Eve
  await storeToDb(prisma, users[1], bobStore)

  // Send messages
  const bobStore2 = await dbToStore(prisma, users[1])
  const bobRoot2 = bobStore2.getRootExpression()
  const devExpr = bobRoot2.getTargetChildren().find(
    child => child.targetNode.getData().group?.name === 'Development Team'
  )
  if (devExpr) {
    await devExpr.sendGroupMessage('Let\'s build something great!', users[1].fosNodeId, 'Bob Johnson')
  }
  await storeToDb(prisma, users[1], bobStore2)

  // Group 4: Large team - All 5 members
  console.log('Creating large team: All members...')
  const charlieStore = await dbToStore(prisma, users[2])
  const charlieRoot = charlieStore.getRootExpression()
  const allHandsGroup = await charlieRoot.createGroup(
    'All Hands',
    'Company-wide announcements and discussions',
    'public'
  )
  await allHandsGroup.addMemberToGroup(users[0].fosNodeId) // Alice
  await allHandsGroup.addMemberToGroup(users[1].fosNodeId) // Bob
  await allHandsGroup.addMemberToGroup(users[3].fosNodeId) // Diana
  await allHandsGroup.addMemberToGroup(users[4].fosNodeId) // Eve
  await storeToDb(prisma, users[2], charlieStore)

  // Send messages
  const charlieStore2 = await dbToStore(prisma, users[2])
  const charlieRoot2 = charlieStore2.getRootExpression()
  const allHandsExpr = charlieRoot2.getTargetChildren().find(
    child => child.targetNode.getData().group?.name === 'All Hands'
  )
  if (allHandsExpr) {
    await allHandsExpr.sendGroupMessage('Welcome everyone!', users[2].fosNodeId, 'Charlie Williams')
    await allHandsExpr.sendGroupMessage('Excited to collaborate!', users[3].fosNodeId, 'Diana Brown')
    await allHandsExpr.sendGroupMessage('This is going to be great!', users[4].fosNodeId, 'Eve Davis')
  }
  await storeToDb(prisma, users[2], charlieStore2)

  // Group 5: Another DM - Diana and Eve
  console.log('Creating DM between Diana and Eve...')
  const dianaStore = await dbToStore(prisma, users[3])
  const dianaRoot = dianaStore.getRootExpression()
  const dmDianaEve = await dianaRoot.createDM(users[4].fosNodeId)
  await storeToDb(prisma, users[3], dianaStore)

  // Send a message
  const dianaStore2 = await dbToStore(prisma, users[3])
  const dianaRoot2 = dianaStore2.getRootExpression()
  const dmExpr2 = dianaRoot2.getTargetChildren().find(
    child => child.targetNode.getId() === dmDianaEve.targetNode.getId()
  )
  if (dmExpr2) {
    await dmExpr2.sendGroupMessage('Hi Eve! Want to grab coffee?', users[3].fosNodeId, 'Diana Brown')
  }
  await storeToDb(prisma, users[3], dianaStore2)

  console.log('Created 5 groups:')
  console.log('  - DM: Alice & Bob')
  console.log('  - Design Team: Alice, Charlie, Diana (3 members)')
  console.log('  - Development Team: Bob, Charlie, Diana, Eve (4 members, public)')
  console.log('  - All Hands: All 5 members (public)')
  console.log('  - DM: Diana & Eve')
}

async function createMCPServer(data: {
  name: string
  description: string
  endpoint: string
}) {
  return await prisma.mCPServerModel.create({
    data: {
      name: data.name,
      description: data.description,
      endpoint: data.endpoint,
      status: 'disconnected'
    }
  })
}

async function createToolsForServer(serverId: number, tools: Array<{
  name: string
  description: string
  inputSchema: any
}>) {
  for (const tool of tools) {
    await prisma.mCPToolModel.create({
      data: {
        serverId,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }
    })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log('Seed completed successfully')
  })
  .catch(async (e) => {
    console.error('Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })