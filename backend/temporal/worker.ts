/**
 * Temporal Worker for Fosforescent Long-Running Tasks
 * 
 * This worker connects to Temporal server and executes workflows
 * for long-running tasks submitted via the MCP server.
 */

import { Worker, NativeConnection } from '@temporalio/worker'
import { config } from 'dotenv'
import * as activities from './activities.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
config()

const TEMPORAL_SERVER_HOST = process.env.TEMPORAL_SERVER_HOST || 'localhost:7233'
const TASK_QUEUE = 'fosforescent-tasks'

async function run() {
  console.log('🚀 Starting Fosforescent Temporal Worker')
  console.log(`📍 Temporal Server: ${TEMPORAL_SERVER_HOST}`)
  console.log(`📋 Task Queue: ${TASK_QUEUE}`)

  const maxRetries = 30
  const retryDelay = 2000 // 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Connection attempt ${attempt}/${maxRetries}...`)

      // Connect to Temporal server
      const connection = await NativeConnection.connect({
        address: TEMPORAL_SERVER_HOST,
      })

      // Create and start the worker
      const workflowsModulePath = join(__dirname, 'workflows.ts')

      const worker = await Worker.create({
        connection,
        workflowsPath: workflowsModulePath,
        activities,
        taskQueue: TASK_QUEUE,
        maxConcurrentActivityTaskExecutions: 10,
        maxConcurrentWorkflowTaskExecutions: 5,
        // Note: Connection config may vary by Temporal version
        // Optional: Add worker identity and build ID
        identity: `fosforescent-worker-${process.env.HOSTNAME || 'local'}-${Date.now()}`,
        buildId: process.env.GIT_COMMIT || 'development',
      })

      console.log('✅ Temporal Worker created successfully')
      console.log(`🔄 Worker Identity: ${worker.options.identity}`)
      console.log(`🏗️  Build ID: ${worker.options.buildId}`)

      // Start the worker
      console.log('▶️  Starting worker...')
      await worker.run()
      break // Success, exit retry loop

    } catch (error) {
      if (attempt === maxRetries) {
        console.error('❌ Worker failed to start after max retries:', error)
        process.exit(1)
      }

      console.log(`⏳ Connection failed, retrying in ${retryDelay/1000}s... (${error})`)
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down worker gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down worker gracefully...')
  process.exit(0)
})

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error)
  process.exit(1)
})

// Start the worker
run().catch((error) => {
  console.error('💥 Worker startup failed:', error)
  process.exit(1)
})
