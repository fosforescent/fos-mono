import express, { application } from 'express'
import http from 'http'

import { verifyJWTMiddleware } from './verifyJwt'
import { clientDetailsMiddleware } from './clientDetails'

import { postRegister, deleteAccount } from './auth/register'
import { postLogin } from './auth/login'
import { getVerifyJwt } from './auth/verifyJwt'
import { postConfirmEmail, postConfirmEmailInit } from './auth/confirmEmail'
import { postResetPwd, postResetPwdUpdate } from './auth/resetPwd'
import { postUpdatePwd } from './auth/updatePwd'
import { postCreatePortalSession } from './subscription/portalSession'
import { postCreateCheckoutSession } from './subscription/checkoutSession'
import { postSubscriptionWebhook } from './subscription/webhook'
import { postEmailWebhook } from './email/email'
import { getHealthCheck } from './health'
import { postUpdateEmail } from './auth/updateEmail'
import { checkUsernameExists } from './auth/checkUsername'
import { postContactMessage } from './email/contactMessage'

import { getUserData, deleteUserData, postUserDataPartial, getNodeByCid, getNodesByCids, postSync, getChangesSince } from './data'
import { getSuggest } from './suggest'
import {
  getMCPServers,
  getMCPServer,
  createMCPServer,
  updateMCPServer,
  deleteMCPServer,
  testMCPConnection,
  connectUserMCPServers,
  disconnectUserMCPServers,
  searchMCPServersEndpoint,
  searchMCPToolsEndpoint,
  getMCPServerTools,
  addMCPServerTool,
  updateMCPServerTool,
  deleteMCPServerTool
} from './mcpServer'
import {
  getUserApiTokens,
  createApiToken,
  updateApiToken,
  deleteApiToken,
  revokeApiToken
} from './apiTokens'
import { authenticateApiTokenMiddleware } from './apiTokenAuth'
import { requireAdminRole, requireSuperAdminRole } from './adminAuth'
import {
  getAdminMCPServers,
  getAdminMCPServerStats,
  createAdminMCPServer,
  updateAdminMCPServer,
  deleteAdminMCPServer,
  getAdminMCPServerAccess,
  grantAdminMCPServerAccess,
  revokeAdminMCPServerAccess,
  makeServerGlobal,
  getAdminUsers,
  updateUserRole,
  getAdminUserStats
} from './adminMCPServer'
import {
  getUserPrompts,
  getPrompt,
  respondToPrompt,
  cancelPrompt,
  getPromptStats,
  createPromptForUser
} from './userPrompts'
import {
  getUserToolUsage,
  getUserToolUsageStats,
  getToolUsage,
  getServerToolUsage,
  cancelToolUsage
} from './toolUsage'
import {
  getUserTokenBalance,
  getUserTokenTransactions,
  createTokenPurchaseCheckout,
  getTokenPurchases,
  getToolTokenPricing,
  setToolTokenPricing,
  getServerToolPricing,
  adminCreditTokens,
  getTokenStatistics
} from './tokens'

import { slowDown } from 'express-slow-down'

import cors from 'cors'

import { config } from 'dotenv'
import { getUserProfile, postUserProfile } from './user'
import { putError } from './error'
import { maxRequests } from './maxRequests'
import {
  queryUserByEmail,
  queryUserByDisplayName,
  getUserGroups,
  findOrCreateDM,
  createGroup,
  addUserToGroup,
  browsePublicGroups
} from './group'
import {
  sendMessageToGroup,
  getGroupMessages
} from './groupMessages'
// import { clientManagerMiddleware } from './clientManager'



import { prisma } from './prismaClient'
import { attachWs } from './ws'
import { postCreateOrGetConnectAccount } from './subscription/connectSession'
import { MCPExpressMiddleware } from './mcp/mcpMiddleware'
import { MCPProxy } from './mcp/mcpProxy'
import { initializeCollection } from '@fosforescent/infra/qdrant'


import jwt from 'jsonwebtoken'
import bodyparser from 'body-parser'



var jsonParser = bodyparser.json()

config()


const app = express()


const stripeRoute = express.Router()


stripeRoute.use(slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 500, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (2 ** used) * 50 // begin adding 500ms of delay per request above 100:
}))
stripeRoute.use(express.raw({ type: '*/*' }));



// const publicRoutes = express.Router();
const protectedRoutes = express.Router()
const dataRoutes = express.Router()
const apiRoutes = express.Router()

// Define your list of allowed origins
const allowedOrigins = [
  'localhost',
  'frontend',
  'fosforescent.com',
  'fos-prod.pages.dev',
  'www.fosforescent.com',
  "fos-mono.pages.dev",
  /^.*\.fosforescent\.com$/,
  /^.*\.fos-mono.pages\.dev$/,
  /^localhost\:[0-9]+$/,
  /^frontend\:[0-9]+$/,

]

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: any) => {
    if (allowedOrigins.find((item) => {
      if (typeof item === 'string') {
        const exactMatch = origin?.indexOf(item || '!@#$%^') !== -1
        if (exactMatch) return true
      }
      const regexMatch = origin?.match(item)
      return regexMatch
    })
      || !origin
      || allowedOrigins.find((item) => origin.match(item))
    ) {
      callback(null, true)
    } else {
      console.log('origin', origin, allowedOrigins)
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Explicitly require Authorization header
  credentials: true // This might be necessary depending on your auth method
}

// Enable CORS with the above options
app.use(cors(corsOptions))
app.set('trust proxy', '10.244.0.96');
app.set('trust proxy', '10.124.0.3');
// Handle preflight requests for all routes
app.options('*', cors(corsOptions)) // Respond to preflight requests

stripeRoute.post('/', postSubscriptionWebhook)

app.use('/subscription/webhook', stripeRoute)

// protectedRoutes.use(express.json());
// dataRoutes.use(express.json());
app.use(express.json())

protectedRoutes.use((req, res, next) => {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    console.log(`X-Forwarded-For: ${xForwardedFor}`); // Log the IP addresses
  } else {
    console.log(`Direct access, no forwarding IP`);
  }
  next();
});


protectedRoutes.use(clientDetailsMiddleware)

app.get('/', getHealthCheck)
app.post('/auth/register', slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 1, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (3 ** used) * 500 // begin adding 500ms of delay per request above 100:
}), postRegister)
app.post('/auth/login', slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 3, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (2 ** used) * 500 // begin adding 500ms of delay per request above 100:
}), postLogin)
app.post('/auth/reset-pwd', slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 1, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (3 ** used) * 500 // begin adding 500ms of delay per request above 100:
}), postResetPwd)
app.post('/auth/reset-pwd-update', slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 1, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (3 ** used) * 500 // begin adding 500ms of delay per request above 100:
}), postResetPwdUpdate)
// TODO: add middleware to reject requests from non-stripe IPs

// TODO add middleware to reject requests from non-postmarkapp IPs
app.post('/email/webhook', slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 500, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (2 ** used) * 50 // begin adding 500ms of delay per request above 100:
}), postEmailWebhook)
app.post('/email/contact-message', slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 1, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (3 ** used) * 500 // begin adding 500ms of delay per request above 100:
}), postContactMessage)
app.post('/auth/check-username', slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 500, // allow 3 requests per 15 minutes, then...
  delayMs: (used) => (2 ** used) * 50 // begin adding 500ms of delay per request above 100:
}), checkUsernameExists)
app.put('/error', maxRequests(10), putError)

dataRoutes.use(verifyJWTMiddleware)
// dataRoutes.use(clientManagerMiddleware)
dataRoutes.post('/', slowDown({
  windowMs: 1 * 60 * 1000, // 1 minute,
  delayAfter: 100, // allow 100 requests per 1 minute, then...
  delayMs: (used) => 1.5 ** (used - 100) // begin adding 500ms of delay per request above 100:
}), postUserDataPartial)

// dataRoutes.use(clientManagerMiddleware)
dataRoutes.get('/', slowDown({
  windowMs: 1 * 60 * 1000, // 1 minute,
  delayAfter: 100, // allow 100 requests per 1 minute, then...
  delayMs: (used) => 1.5 ** (used - 100) // begin adding 500ms of delay per request above 100:
}), getUserData)

// Offline-first lazy-load endpoints
dataRoutes.get('/nodes/:cid', slowDown({
  windowMs: 1 * 60 * 1000,
  delayAfter: 200,
  delayMs: (used) => 1.5 ** (used - 200)
}), getNodeByCid)

dataRoutes.get('/nodes', slowDown({
  windowMs: 1 * 60 * 1000,
  delayAfter: 100,
  delayMs: (used) => 1.5 ** (used - 100)
}), getNodesByCids)

dataRoutes.post('/sync', slowDown({
  windowMs: 1 * 60 * 1000,
  delayAfter: 50,
  delayMs: (used) => 1.5 ** (used - 50)
}), postSync)

dataRoutes.get('/changes', slowDown({
  windowMs: 1 * 60 * 1000,
  delayAfter: 100,
  delayMs: (used) => 1.5 ** (used - 100)
}), getChangesSince)


protectedRoutes.use(slowDown({
  windowMs: 10 * 60 * 1000, // 15 minutes,
  delayAfter: 100, // allow 100 requests per 15 minutes, then...
  delayMs: (used) => (used) ** 1.3 * 500 // begin adding 500ms of delay per request above 100:
}))

// Protected routes
protectedRoutes.use(verifyJWTMiddleware)

protectedRoutes.get('/auth/verify-jwt', getVerifyJwt)
protectedRoutes.post('/auth/confirm-email-init', postConfirmEmailInit)
protectedRoutes.post('/auth/confirm-email', postConfirmEmail)
protectedRoutes.post('/auth/update-password', postUpdatePwd)
protectedRoutes.post('/auth/update-email', postUpdateEmail)

protectedRoutes.post('/subscription/connect-session', postCreateOrGetConnectAccount)
protectedRoutes.post('/subscription/checkout-session', postCreateCheckoutSession)
protectedRoutes.post('/subscription/portal-session', postCreatePortalSession)
protectedRoutes.get('/user/profile', getUserProfile)
protectedRoutes.post('/user/profile', postUserProfile)
protectedRoutes.delete('/user', deleteAccount)

// Group routes
protectedRoutes.get('/groups/search/email', queryUserByEmail)
protectedRoutes.get('/groups/search/name', queryUserByDisplayName)
protectedRoutes.get('/groups', getUserGroups)
protectedRoutes.get('/groups/public', browsePublicGroups)
protectedRoutes.post('/groups', createGroup)
protectedRoutes.post('/groups/dm', findOrCreateDM)
protectedRoutes.post('/groups/:groupCid/members', addUserToGroup)

// Group messages routes
protectedRoutes.get('/groups/:groupCid/messages', getGroupMessages)
protectedRoutes.post('/groups/:groupCid/messages', sendMessageToGroup)

// MCP Server routes
protectedRoutes.get('/mcp/servers', getMCPServers)
protectedRoutes.get('/mcp/servers/search', searchMCPServersEndpoint)
protectedRoutes.get('/mcp/servers/:id', getMCPServer)
protectedRoutes.post('/mcp/servers', createMCPServer)
protectedRoutes.put('/mcp/servers/:id', updateMCPServer)
protectedRoutes.delete('/mcp/servers/:id', deleteMCPServer)
protectedRoutes.post('/mcp/servers/:id/test', testMCPConnection)
protectedRoutes.post('/mcp/connect-all', connectUserMCPServers)
protectedRoutes.post('/mcp/disconnect-all', disconnectUserMCPServers)

// MCP Tools routes
protectedRoutes.get('/mcp/tools/search', searchMCPToolsEndpoint)
protectedRoutes.get('/mcp/servers/:id/tools', getMCPServerTools)
protectedRoutes.post('/mcp/servers/:id/tools', addMCPServerTool)
protectedRoutes.put('/mcp/servers/:id/tools/:toolId', updateMCPServerTool)
protectedRoutes.delete('/mcp/servers/:id/tools/:toolId', deleteMCPServerTool)

// API Token management routes (JWT protected - for web UI)
protectedRoutes.get('/api-tokens', getUserApiTokens)
protectedRoutes.post('/api-tokens', createApiToken)
protectedRoutes.put('/api-tokens/:id', updateApiToken)
protectedRoutes.delete('/api-tokens/:id', deleteApiToken)
protectedRoutes.post('/api-tokens/:id/revoke', revokeApiToken)

// User Prompt routes (JWT protected - for web UI)
protectedRoutes.get('/prompts', getUserPrompts)
protectedRoutes.get('/prompts/stats', getPromptStats)
protectedRoutes.get('/prompts/:promptId', getPrompt)
protectedRoutes.post('/prompts/:promptId/respond', respondToPrompt)
protectedRoutes.post('/prompts/:promptId/cancel', cancelPrompt)

// Tool Usage routes (JWT protected - for web UI)
protectedRoutes.get('/tool-usage', getUserToolUsage)
protectedRoutes.get('/tool-usage/stats', getUserToolUsageStats)
protectedRoutes.get('/tool-usage/:toolUseId', getToolUsage)
protectedRoutes.post('/tool-usage/:toolUseId/cancel', cancelToolUsage)
protectedRoutes.get('/mcp/servers/:serverId/tool-usage', getServerToolUsage)

// Token Management routes (JWT protected - for web UI)
protectedRoutes.get('/tokens/balance', getUserTokenBalance)
protectedRoutes.get('/tokens/transactions', getUserTokenTransactions)
protectedRoutes.post('/tokens/purchase', createTokenPurchaseCheckout)
protectedRoutes.get('/tokens/purchases', getTokenPurchases)

// Tool Pricing routes (JWT protected - for web UI)
protectedRoutes.get('/mcp/servers/:serverId/tools/:toolName/pricing', getToolTokenPricing)
protectedRoutes.put('/mcp/servers/:serverId/tools/:toolName/pricing', setToolTokenPricing)
protectedRoutes.get('/mcp/servers/:serverId/pricing', getServerToolPricing)

// protectedRoutes.get('/user/data', getUserData)
// protectedRoutes.delete('/user/data', deleteUserData)
// protectedRoutes.delete('/user', deleteAccount)

dataRoutes.post('/suggest', getSuggest)

// dataRoutes.get('/data/events', clientManagerMiddleware, getDataSSEvents)

// API routes with API token authentication (for programmatic access)
apiRoutes.use(authenticateApiTokenMiddleware)
apiRoutes.get('/mcp/servers', getMCPServers)
apiRoutes.get('/mcp/servers/search', searchMCPServersEndpoint)
apiRoutes.get('/mcp/servers/:id', getMCPServer)
apiRoutes.post('/mcp/servers/:id/test', testMCPConnection)
apiRoutes.get('/mcp/tools/search', searchMCPToolsEndpoint)
apiRoutes.get('/mcp/servers/:id/tools', getMCPServerTools)
apiRoutes.get('/tool-usage', getUserToolUsage)
apiRoutes.get('/tool-usage/stats', getUserToolUsageStats)
apiRoutes.get('/tool-usage/:toolUseId', getToolUsage)

// Admin routes (requires admin/superadmin role)
const adminRoutes = express.Router()
adminRoutes.use(requireAdminRole)

// Admin MCP server management
adminRoutes.get('/mcp/servers', getAdminMCPServers)
adminRoutes.get('/mcp/servers/stats', getAdminMCPServerStats)
adminRoutes.get('/mcp/servers/search', searchMCPServersEndpoint)
adminRoutes.post('/mcp/servers', createAdminMCPServer)
adminRoutes.put('/mcp/servers/:id', updateAdminMCPServer)
adminRoutes.delete('/mcp/servers/:id', deleteAdminMCPServer)
adminRoutes.get('/mcp/servers/:id/access', getAdminMCPServerAccess)
adminRoutes.post('/mcp/servers/:id/access', grantAdminMCPServerAccess)
adminRoutes.delete('/mcp/servers/:id/access/:userId', revokeAdminMCPServerAccess)
adminRoutes.post('/mcp/servers/:id/make-global', makeServerGlobal)

// Admin MCP tools search
adminRoutes.get('/mcp/tools/search', searchMCPToolsEndpoint)

// Admin user management
adminRoutes.get('/users', getAdminUsers)
adminRoutes.get('/users/stats', getAdminUserStats)
adminRoutes.put('/users/:userId', updateUserRole)

// Admin prompt management
adminRoutes.post('/prompts', createPromptForUser)

// Admin token management
adminRoutes.post('/tokens/credit', adminCreditTokens)
adminRoutes.get('/tokens/stats', getTokenStatistics)


const mcpMiddleware = new MCPExpressMiddleware({
  serverName: 'Fosforescent MCP Server',
  serverVersion: '1.0.0'
})



const mcpHttpMiddleware: (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction) => Promise<void>
  = mcpMiddleware.getHTTPMiddleware()

const mcpRoutes: express.Router = express.Router()

mcpRoutes.use(mcpHttpMiddleware)



app.use('/user/data', dataRoutes)
app.use('/api/v1', apiRoutes)
app.use('/admin', adminRoutes)
app.use('/', protectedRoutes)
app.use('/mcp', mcpRoutes)



const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  console.error('JWT_SECRET not set')
  throw new Error('JWT_SECRET not set')
}


export interface Claims {
  username: string;
  exp: number;
  // Add other properties as needed
}



const server = http.createServer(app);

// Initialize MCP middleware and proxy

const mcpProxy = new MCPProxy()

// Attach MCP WebSocket server
mcpMiddleware.attachToServer(server, '/mcp');

// Add MCP HTTP endpoint for JSON-RPC over HTTP



// Make MCP proxy available globally for other parts of the application
(global as any).mcpProxy = mcpProxy

attachWs(server)

// Start the server
const PORT = parseInt(process.env.PORT || '4000', 10);

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/{jwt}`);
  console.log(`MCP endpoint: ws://localhost:${PORT}/mcp`);
  console.log(`MCP HTTP endpoint: http://localhost:${PORT}/mcp/http`);
  
  // Initialize Qdrant collection
  try {
    await initializeCollection();
    console.log('Qdrant collection initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Qdrant collection:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')
  await mcpProxy.cleanup()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully')
  await mcpProxy.cleanup()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})


// Also mount the app here
// server.on('request', app);

// const port = process.env.PORT || 80
// app.listen(port, () => {
//   console.log(`Server running on http://localhost:${port}`)
// })


// // Your Socket.IO code here, e.g., handling connections
// io.on('connection', (socket: Socket ) => {
//   console.log('a user connected:', socket.id);

//   // Example event
//   socket.on('message', (msg) => {
//     console.log('message: ' + msg);
//   });
// });