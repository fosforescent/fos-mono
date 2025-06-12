/**
 * Temporal Worker for Fosforescent Long-Running Tasks
 * 
 * This worker connects to Temporal server and executes workflows
 * for long-running tasks submitted via the MCP server.
 */

import { Worker } from '@temporalio/worker'
import { config } from 'dotenv'
import * as activities from './activities'

// Load environment variables
config()

const TEMPORAL_SERVER_HOST = process.env.TEMPORAL_SERVER_HOST || 'localhost:7233'
const TASK_QUEUE = 'fosforescent-tasks'

async function run() {
  console.log('🚀 Starting Fosforescent Temporal Worker')
  console.log(`📍 Temporal Server: ${TEMPORAL_SERVER_HOST}`)
  console.log(`📋 Task Queue: ${TASK_QUEUE}`)

  try {
    // Create and start the worker
    const worker = await Worker.create({
      workflowsPath: require.resolve('./workflows'),
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

  } catch (error) {
    console.error('❌ Worker failed to start:', error)
    process.exit(1)
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