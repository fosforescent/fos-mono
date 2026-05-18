import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import bcrypt from 'bcrypt'
import { dbToStore, storeToDb, validateNodeDataToDB } from '../../backend/util'
import { FosStore, hashContent } from '@fosforescent/shared/dag-implementation/store'
import type { FosNodeContent } from '@fosforescent/shared/types'
import { validateNodeData } from '@fosforescent/shared/utils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
loadEnv({ path: resolve(__dirname, '../../.env') })

const prisma = new PrismaClient()

async function ensureNodeInStore(store: FosStore, nodeCid: string, visited = new Set<string>()) {
  if (store.table.has(nodeCid) || visited.has(nodeCid)) {
    return
  }

  visited.add(nodeCid)

  const nodeRecord = await prisma.fosNodeModel.findUnique({
    where: { cid: nodeCid }
  })

  if (!nodeRecord) {
    throw new Error(`Node ${nodeCid} not found in database while seeding`)
  }

  const nodeContent = validateNodeData(nodeRecord.data)

  for (const [instructionCid, targetCid] of nodeContent.children) {
    if (!store.table.has(instructionCid)) {
      await ensureNodeInStore(store, instructionCid, visited)
    }
    if (!store.table.has(targetCid)) {
      await ensureNodeInStore(store, targetCid, visited)
    }
  }

  if (!store.table.has(nodeCid)) {
    store.create(nodeContent)
  }
}

async function main() {
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;')

  console.log('Creating seed users...')

  const seedUsers = [
    { email: 'admin@fosforescent.com', password: 'admin123', displayName: 'System Admin', role: 'admin' as const },
    { email: 'user1@fosforescent.com', password: 'user123', displayName: 'Test User One', role: 'user' as const },
    { email: 'user2@fosforescent.com', password: 'user123', displayName: 'Test User Two', role: 'user' as const },
    { email: 'alice@fosforescent.com', password: 'alice123', displayName: 'Alice Smith', role: 'user' as const },
    { email: 'bob@fosforescent.com', password: 'bob123', displayName: 'Bob Johnson', role: 'user' as const },
    { email: 'charlie@fosforescent.com', password: 'charlie123', displayName: 'Charlie Williams', role: 'user' as const },
    { email: 'diana@fosforescent.com', password: 'diana123', displayName: 'Diana Brown', role: 'user' as const },
    { email: 'eve@fosforescent.com', password: 'eve123', displayName: 'Eve Davis', role: 'user' as const }
  ]

  for (const entry of seedUsers) {
    await createUser(entry.email, entry.password, entry.displayName, entry.role)
  }

  await prisma.userModel.updateMany({
    where: {
      user_name: {
        in: seedUsers.map((u) => u.email)
      }
    },
    data: {
      approved: true
    }
  })

  console.log('About to fetch users with fosNode relation...')
  const users = await prisma.userModel.findMany({
    include: { fosNode: true },
    orderBy: { id: 'asc' }
  })

  console.log('Fetched users count:', users.length)
  if (users.length > 0) {
    console.log(
      'First user:',
      JSON.stringify(
        {
          id: users[0].id,
          username: users[0].user_name,
          fosNodeId: users[0].fosNodeId,
          fosNode: users[0].fosNode
        },
        null,
        2
      )
    )
  }

  if (users.length === 0) {
    throw new Error('No users found after creation!')
  }

  console.log('Creating groups...')
  await createGroups(users)

  console.log('Creating MCP servers...')

  const mcpServerDefinitions = [
    {
      name: 'File System Tools',
      description: 'Tools for file system operations like reading, writing, and listing files',
      endpoint: 'ws://localhost:3001/mcp'
    },
    {
      name: 'Web Search API',
      description: 'Search the web and retrieve information from various sources',
      endpoint: 'https://api.websearch.example.com/mcp'
    },
    {
      name: 'Database Tools',
      description: 'Tools for database operations and queries',
      endpoint: 'ws://localhost:3002/mcp'
    },
    {
      name: 'AI Assistant Tools',
      description: 'AI-powered tools for text processing and analysis',
      endpoint: 'https://ai-tools.example.com/mcp'
    }
  ]

  const mcpServers = []
  for (const definition of mcpServerDefinitions) {
    const server = await createMCPServer(definition)
    mcpServers.push(server)
  }

  console.log('Creating MCP tools...')

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

  for (const user of users) {
    for (const server of mcpServers) {
      await prisma.userMCPServerAccessModel.upsert({
        where: {
          userId_serverId: {
            userId: user.id,
            serverId: server.id
          }
        },
        update: {},
        create: {
          userId: user.id,
          serverId: server.id,
          role: 'user'
        }
      })
    }
  }

  console.log('Setting up token pricing...')

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
    await prisma.mCPToolPricingModel.upsert({
      where: {
        serverId_toolName: {
          serverId: pricing.serverId,
          toolName: pricing.toolName
        }
      },
      update: {
        pricePerUseTokens: pricing.pricePerUseTokens,
        isEnabled: true
      },
      create: pricing
    })
  }

  console.log('Setting up initial token balances...')

  for (const user of users) {
    const initialTokens = user.role === 'admin' ? 10000 : 1000
    await prisma.userTokenBalanceModel.upsert({
      where: { userId: user.id },
      update: {
        availableTokens: initialTokens,
        totalPurchased: initialTokens,
        totalUsed: 0,
        subscriptionTokens: initialTokens,
        purchasedTokens: 0
      },
      create: {
        userId: user.id,
        availableTokens: initialTokens,
        totalPurchased: initialTokens,
        totalUsed: 0,
        subscriptionTokens: initialTokens,
        purchasedTokens: 0
      }
    })

    await prisma.tokenTransactionModel.upsert({
      where: {
        transactionId: `initial_credit_${user.id}`
      },
      update: {},
      create: {
        transactionId: `initial_credit_${user.id}`,
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
  console.log(`Ensured ${mcpServers.length} MCP servers`)
  console.log(`Configured ${pricingData.length} tool pricing entries`)
}

async function createUser(email: string, password: string, displayName: string, role: 'admin' | 'user') {
  const existingUser = await prisma.userModel.findUnique({
    where: { user_name: email },
    include: { fosNode: true }
  })

  if (existingUser) {
    if (!existingUser.approved) {
      await prisma.userModel.update({
        where: { user_name: email },
        data: { approved: true }
      })
    }
    console.log(`User ${email} already exists, skipping creation`)
    return await prisma.userModel.findUnique({
      where: { user_name: email },
      include: { fosNode: true }
    })
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const { v4: uuidv4 } = await import('uuid')

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

  const aliasId = uuidv4()
  const aliasContent: FosNodeContent = {
    data: {
      alias: {
        id: aliasId
      }
    },
    children: [[workspaceCid, workspaceCid]] as FosNodeContent['children']
  }
  const aliasCid = hashContent(aliasContent)

  console.log(`Creating alias node for ${displayName} with CID: ${aliasCid}, aliasId: ${aliasId}`)

  const aliasNode = await prisma.fosNodeModel.create({
    data: {
      cid: aliasCid,
      data: validateNodeDataToDB(aliasContent)
    }
  })

  const user = await prisma.userModel.create({
    data: {
      user_name: email,
      password: hashedPassword,
      role,
      accepted_terms: new Date(),
      fosNodeId: aliasNode.cid,
      user_profile: {
        displayName,
        email
      },
      approved: true,
      data: {
        nodes: {},
        route: [],
        rootNodeId: aliasNode.cid
      }
    }
  })

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
  console.log(
    'createGroups received users:',
    users.map((u) => ({ id: u.id, email: u.user_name, fosNodeId: u.fosNodeId, hasFosNode: !!u.fosNode }))
  )

  const userByEmail = new Map(users.map((u) => [u.user_name, u]))

  const admin = userByEmail.get('admin@fosforescent.com')
  const alice = userByEmail.get('alice@fosforescent.com')
  const bob = userByEmail.get('bob@fosforescent.com')
  const charlie = userByEmail.get('charlie@fosforescent.com')
  const diana = userByEmail.get('diana@fosforescent.com')
  const eve = userByEmail.get('eve@fosforescent.com')
  const user1 = userByEmail.get('user1@fosforescent.com')
  const user2 = userByEmail.get('user2@fosforescent.com')

  const requiredUsers = [
    { key: 'admin', value: admin },
    { key: 'alice', value: alice },
    { key: 'bob', value: bob },
    { key: 'charlie', value: charlie },
    { key: 'diana', value: diana },
    { key: 'eve', value: eve },
    { key: 'user1', value: user1 },
    { key: 'user2', value: user2 }
  ]

  const missing = requiredUsers.filter((entry) => !entry.value).map((entry) => entry.key)
  if (missing.length > 0) {
    throw new Error(`Missing required users for group seed: ${missing.join(', ')}`)
  }

  const getDisplayName = (user: any) => {
    const profile = user.user_profile as any
    return profile?.displayName || user.user_name
  }

  const resolveGroupExpression = (expr: any) => (expr?.isAlias && expr.isAlias() ? expr.followAlias() : expr)

  const getGroupExpressionForMember = async (member: any, groupCid: string) => {
    const store = await dbToStore(prisma, member)
    await ensureNodeInStore(store, groupCid)
    const root = store.getRootExpression()
    const candidate = root.getTargetChildren().find(
      (child: any) => child.targetNode.getId() === groupCid
    )

    if (!candidate) {
      console.warn(`Group ${groupCid} not found in store for ${member.user_name}`)
      await storeToDb(prisma, member, store)
      return null
    }

    const resolved = resolveGroupExpression(candidate)
    if (!resolved?.isGroup || !resolved.isGroup()) {
      console.warn(`Expression for ${groupCid} is not a group for ${member.user_name}`)
      await storeToDb(prisma, member, store)
      return null
    }

    return { store, groupExpr: resolved }
  }

  const seedGroupMessages = async (
    groupCid: string,
    messages: Array<{ author: any; body: string }>
  ) => {
    for (const entry of messages) {
      const result = await getGroupExpressionForMember(entry.author, groupCid)
      if (!result) {
        continue
      }

      const { store, groupExpr } = result
      const commentFieldCid = store.primitive.commentConstructor.getId()
      const existingMessages = groupExpr
        .getTargetChildren()
        .filter((child: any) => child.instructionNode.getId() === commentFieldCid)

      const alreadyExists = existingMessages.some((child: any) => {
        const commentData = child.targetNode.getData().comment
        return commentData?.content === entry.body && commentData?.authorID === entry.author.fosNodeId
      })

      if (!alreadyExists) {
        await groupExpr.sendGroupMessage(entry.body, entry.author.fosNodeId, getDisplayName(entry.author))
      }

      await storeToDb(prisma, entry.author, store)
    }
  }

  console.log('Creating DM between Alice and Bob...')
  const aliceStore = await dbToStore(prisma, alice)
  await ensureNodeInStore(aliceStore, bob.fosNodeId)
  const aliceRoot = aliceStore.getRootExpression()
  await aliceRoot.createDM(bob.fosNodeId)
  await storeToDb(prisma, alice, aliceStore)

  const bobStoreForDM = await dbToStore(prisma, bob)
  await ensureNodeInStore(bobStoreForDM, alice.fosNodeId)
  const bobRootForDM = bobStoreForDM.getRootExpression()
  await bobRootForDM.createDM(alice.fosNodeId)
  await storeToDb(prisma, bob, bobStoreForDM)

  let designTeamCid: string | undefined

  console.log('Creating small team: Alice, Charlie, Diana...')
  const aliceStoreTeam = await dbToStore(prisma, alice)
  await ensureNodeInStore(aliceStoreTeam, charlie.fosNodeId)
  await ensureNodeInStore(aliceStoreTeam, diana.fosNodeId)
  const aliceRootTeam = aliceStoreTeam.getRootExpression()

  let teamGroup = aliceRootTeam.getTargetChildren().find(
    (child) => child.targetNode.getData().group?.name === 'Design Team'
  )
  if (!teamGroup) {
    teamGroup = await aliceRootTeam.createGroup('Design Team', 'Team working on design projects', 'public')
  }
  let resolvedTeamGroup = resolveGroupExpression(teamGroup)
  if (!resolvedTeamGroup || !resolvedTeamGroup.isGroup()) {
    throw new Error('Resolved Design Team expression is not a group')
  }
  resolvedTeamGroup = await resolvedTeamGroup.addMemberToGroup(charlie.fosNodeId)
  resolvedTeamGroup = await resolvedTeamGroup.addMemberToGroup(diana.fosNodeId)
  resolvedTeamGroup = await resolvedTeamGroup.addMemberToGroup(user1.fosNodeId)
  designTeamCid = resolvedTeamGroup?.targetNode?.getId()
  await storeToDb(prisma, alice, aliceStoreTeam)

  if (designTeamCid) {
    const designTeamMembers = [charlie, diana, user1]
    for (const member of designTeamMembers) {
      const memberStore = await dbToStore(prisma, member)
      await ensureNodeInStore(memberStore, designTeamCid)
      await storeToDb(prisma, member, memberStore)
    }
  }

  let developmentTeamCid: string | undefined

  console.log('Creating medium team: Bob, Charlie, Diana, Eve...')
  const bobStore = await dbToStore(prisma, bob)
  await ensureNodeInStore(bobStore, charlie.fosNodeId)
  await ensureNodeInStore(bobStore, diana.fosNodeId)
  await ensureNodeInStore(bobStore, eve.fosNodeId)
  const bobRoot = bobStore.getRootExpression()
  let devGroup = bobRoot.getTargetChildren().find(
    (child) => child.targetNode.getData().group?.name === 'Development Team'
  )
  if (!devGroup) {
    devGroup = await bobRoot.createGroup('Development Team', 'Backend and frontend developers', 'public')
  }
  let resolvedDevGroup = resolveGroupExpression(devGroup)
  resolvedDevGroup = await resolvedDevGroup.addMemberToGroup(charlie.fosNodeId)
  resolvedDevGroup = await resolvedDevGroup.addMemberToGroup(diana.fosNodeId)
  resolvedDevGroup = await resolvedDevGroup.addMemberToGroup(eve.fosNodeId)
  resolvedDevGroup = await resolvedDevGroup.addMemberToGroup(user1.fosNodeId)
  developmentTeamCid = resolvedDevGroup?.targetNode?.getId()
  await storeToDb(prisma, bob, bobStore)

  if (developmentTeamCid) {
    const developmentMembers = [charlie, diana, eve, user1]
    for (const member of developmentMembers) {
      const memberStore = await dbToStore(prisma, member)
      await ensureNodeInStore(memberStore, developmentTeamCid)
      await storeToDb(prisma, member, memberStore)
    }
  }

  console.log('Creating large team: All members...')
  const charlieStore = await dbToStore(prisma, charlie)
  await ensureNodeInStore(charlieStore, alice.fosNodeId)
  await ensureNodeInStore(charlieStore, bob.fosNodeId)
  await ensureNodeInStore(charlieStore, diana.fosNodeId)
  await ensureNodeInStore(charlieStore, eve.fosNodeId)
  await ensureNodeInStore(charlieStore, user1.fosNodeId)
  const charlieRoot = charlieStore.getRootExpression()
  let allHandsGroup = charlieRoot.getTargetChildren().find(
    (child) => child.targetNode.getData().group?.name === 'All Hands'
  )
  if (!allHandsGroup) {
    allHandsGroup = await charlieRoot.createGroup(
      'All Hands',
      'Company-wide announcements and discussions',
      'public'
    )
  }
  let resolvedAllHands = resolveGroupExpression(allHandsGroup)
  resolvedAllHands = await resolvedAllHands.addMemberToGroup(alice.fosNodeId)
  resolvedAllHands = await resolvedAllHands.addMemberToGroup(bob.fosNodeId)
  resolvedAllHands = await resolvedAllHands.addMemberToGroup(diana.fosNodeId)
  resolvedAllHands = await resolvedAllHands.addMemberToGroup(eve.fosNodeId)
  resolvedAllHands = await resolvedAllHands.addMemberToGroup(user1.fosNodeId)
  await storeToDb(prisma, charlie, charlieStore)

  const allHandsCid = resolveGroupExpression(allHandsGroup)?.targetNode?.getId()
  if (allHandsCid) {
    const allHandsMembers = [charlie, diana, user1]
    for (const member of allHandsMembers) {
      const memberStore = await dbToStore(prisma, member)
      await ensureNodeInStore(memberStore, allHandsCid)
      await storeToDb(prisma, member, memberStore)
    }
  }

  console.log('Creating public support group for user1, admin, user2...')
  const user1Store = await dbToStore(prisma, user1)
  await ensureNodeInStore(user1Store, admin.fosNodeId)
  await ensureNodeInStore(user1Store, user2.fosNodeId)
  const user1Root = user1Store.getRootExpression()
  let supportGroup = user1Root.getTargetChildren().find(
    (child) => child.targetNode.getData().group?.name === 'Support Desk'
  )
  if (!supportGroup) {
    supportGroup = await user1Root.createGroup(
      'Support Desk',
      'Customer support handoffs and updates',
      'public'
    )
  }
  let resolvedSupportGroup = resolveGroupExpression(supportGroup)
  resolvedSupportGroup = await resolvedSupportGroup.addMemberToGroup(admin.fosNodeId)
  resolvedSupportGroup = await resolvedSupportGroup.addMemberToGroup(user2.fosNodeId)
  await storeToDb(prisma, user1, user1Store)

  const supportGroupCid = resolveGroupExpression(supportGroup)?.targetNode?.getId()
  if (supportGroupCid) {
    const adminStore = await dbToStore(prisma, admin)
    await ensureNodeInStore(adminStore, supportGroupCid)
    await storeToDb(prisma, admin, adminStore)

    const user2Store = await dbToStore(prisma, user2)
    await ensureNodeInStore(user2Store, supportGroupCid)
    await storeToDb(prisma, user2, user2Store)
  }

  console.log('Seeding conversations for user1-focused groups...')
  if (supportGroupCid) {
    await seedGroupMessages(supportGroupCid, [
      { author: user1, body: "Morning team! Customer ACME Corp reported they can't access billing." },
      { author: admin, body: 'Thanks for the heads up. I will check the auth logs and update you shortly.' },
      { author: user2, body: "I'll reach out to their admin contact and gather more details." }
    ])
  }

  if (allHandsCid) {
    await seedGroupMessages(allHandsCid, [
      {
        author: charlie,
        body: "Reminder: Friday's product demo is at 10am. Please share your updates before Thursday."
      },
      {
        author: user1,
        body: 'Support is prepping a FAQ sheet so onboarding has quick reference answers.'
      },
      {
        author: diana,
        body: 'Design is finalizing the slides today and will post a review link this afternoon.'
      }
    ])
  }

  if (designTeamCid) {
    await seedGroupMessages(designTeamCid, [
      {
        author: alice,
        body: 'Uploaded the refreshed navigation mockups to the Figma board for feedback.'
      },
      {
        author: user1,
        body: "Thanks Alice! I'll double-check the flows for any support friction we've seen."
      },
      {
        author: charlie,
        body: 'Let us sync tomorrow at 2pm to lock copy and prepare the handoff.'
      }
    ])
  }

  if (developmentTeamCid) {
    await seedGroupMessages(developmentTeamCid, [
      {
        author: bob,
        body:
          'Deployed the new usage metrics service behind a feature flag—please watch alerts tonight.'
      },
      {
        author: user1,
        body: 'Could we surface the daily active counts in the support dashboard next sprint?'
      },
      {
        author: eve,
        body: "Sounds good, I'll stub the API and open a ticket for the UI work."
      }
    ])
  }

  console.log('Creating DM between Diana and Eve...')
  const dianaStore = await dbToStore(prisma, diana)
  await ensureNodeInStore(dianaStore, eve.fosNodeId)
  const dianaRoot = dianaStore.getRootExpression()
  await dianaRoot.createDM(eve.fosNodeId)
  await storeToDb(prisma, diana, dianaStore)

  const eveStore = await dbToStore(prisma, eve)
  await ensureNodeInStore(eveStore, diana.fosNodeId)
  const eveRoot = eveStore.getRootExpression()
  await eveRoot.createDM(diana.fosNodeId)
  await storeToDb(prisma, eve, eveStore)

  console.log('Created seed groups:')
  console.log('  • DM: Alice & Bob')
  console.log('  • Design Team: Alice, Charlie, Diana, user1')
  console.log('  • Development Team: Bob, Charlie, Diana, Eve, user1')
  console.log('  • All Hands: Alice, Bob, Charlie, Diana, Eve, user1')
  console.log('  • Support Desk: user1, admin, user2')
  console.log('  • DM: Diana & Eve')
  console.log('Seeded conversations for Support Desk, All Hands, Design Team, and Development Team')
}

async function createMCPServer(data: { name: string; description: string; endpoint: string }) {
  const server = await prisma.mCPServerModel.upsert({
    where: { name: data.name },
    update: {
      description: data.description,
      endpoint: data.endpoint
    },
    create: {
      name: data.name,
      description: data.description,
      endpoint: data.endpoint,
      status: 'disconnected'
    }
  })

  return server
}

async function createToolsForServer(
  serverId: number,
  tools: Array<{
    name: string
    description: string
    inputSchema: any
  }>
) {
  for (const tool of tools) {
    const existing = await prisma.mCPToolModel.findFirst({
      where: {
        serverId,
        name: tool.name
      }
    })

    if (existing) {
      continue
    }

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
  })
  .catch(async (e) => {
    console.error('Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
