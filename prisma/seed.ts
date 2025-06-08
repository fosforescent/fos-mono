import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  // Enable vector extension for embeddings
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;')

  console.log('Creating seed users...')

  // Create test users
  const users = await Promise.all([
    createUser('admin@fosforescent.com', 'admin123', 'Admin User', 'admin'),
    createUser('user1@fosforescent.com', 'user123', 'Test User 1', 'user'),
    createUser('user2@fosforescent.com', 'user123', 'Test User 2', 'user'),
    createUser('developer@fosforescent.com', 'dev123', 'Developer User', 'user')
  ])

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
  
  // Create a simple node for each user
  const userNode = await prisma.fosNodeModel.create({
    data: {
      cid: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: {
        type: 'user_profile',
        displayName: displayName,
        email: email,
        seedCreated: true
      }
    }
  })
  
  return await prisma.userModel.create({
    data: {
      user_name: email,
      password: hashedPassword,
      role: role,
      accepted_terms: new Date(),
      fosNodeId: userNode.cid,
      user_profile: {
        displayName: displayName,
        email: email
      }
    }
  })
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