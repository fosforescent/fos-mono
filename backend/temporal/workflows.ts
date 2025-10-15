/**
 * Temporal Workflows for Long-Running Tasks
 * 
 * These workflows implement the actual business logic for different types
 * of long-running tasks that can be submitted via the MCP server.
 */

import { proxyActivities, sleep, log, setHandler, defineSignal, defineQuery } from '@temporalio/workflow'
import type * as activities from './activities'

// Proxy activities with timeout configuration
const {
  processDataset,
  convertFile,
  processImage,
  generateReport,
  runBatchOperation,
  performAIInference,
  orchestrateWorkflow,
  migrateData,
  performBackup,
  performMaintenance,
  sendWebhook,
  updateTaskProgress
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '10m',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3
  }
})

// Workflow input interface
export interface TaskWorkflowInput {
  taskId: string
  taskName: string
  workflowType: string
  input: Record<string, any>
  webhookUrl?: string
  userId: string
  estimatedDuration?: number
}

// Workflow result interface
export interface TaskWorkflowResult {
  taskId: string
  success: boolean
  result?: any
  error?: string
  duration: number
  finalProgress: number
}

// Signals for workflow control
export const pauseTaskSignal = defineSignal<[]>('pauseTask')
export const resumeTaskSignal = defineSignal<[]>('resumeTask')
export const cancelTaskSignal = defineSignal<[string]>('cancelTask')
export const updateProgressSignal = defineSignal<[number, string?]>('updateProgress')

// Queries for workflow state
export const getProgressQuery = defineQuery<number>('getProgress')
export const getStatusQuery = defineQuery<string>('getStatus')
export const getResultQuery = defineQuery<any>('getResult')

/**
 * Main Task Workflow
 * 
 * This is the primary workflow that handles all types of long-running tasks.
 * It routes to specific implementations based on the workflow type.
 */
export async function taskWorkflow(input: TaskWorkflowInput): Promise<TaskWorkflowResult> {
  const startTime = Date.now()
  let progress = 0
  let status = 'running'
  let result: any = null
  let isPaused = false
  let isCancelled = false
  let cancelReason = ''

  // Set up signal and query handlers
  setHandler(pauseTaskSignal, () => {
    isPaused = true
    status = 'paused'
    log.info('Task paused', { taskId: input.taskId })
  })

  setHandler(resumeTaskSignal, () => {
    isPaused = false
    status = 'running'
    log.info('Task resumed', { taskId: input.taskId })
  })

  setHandler(cancelTaskSignal, (reason: string) => {
    isCancelled = true
    cancelReason = reason
    status = 'cancelled'
    log.info('Task cancelled', { taskId: input.taskId, reason })
  })

  setHandler(updateProgressSignal, (newProgress: number, message?: string) => {
    progress = Math.min(Math.max(newProgress, 0), 100)
    log.info('Progress updated', { taskId: input.taskId, progress, message })
  })

  setHandler(getProgressQuery, () => progress)
  setHandler(getStatusQuery, () => status)
  setHandler(getResultQuery, () => result)

  log.info('Starting task workflow', { 
    taskId: input.taskId, 
    workflowType: input.workflowType,
    userId: input.userId
  })

  try {
    // Wait for pause/resume cycles
    while (isPaused && !isCancelled) {
      await sleep('1s')
    }

    if (isCancelled) {
      throw new Error(`Task cancelled: ${cancelReason}`)
    }

    // Update initial progress
    progress = 5
    await updateTaskProgress(input.taskId, progress, 'Task started')

    // Route to specific workflow implementation
    switch (input.workflowType) {
      case 'data_processing':
        result = await dataProcessingWorkflow(input)
        break
      case 'file_conversion':
        result = await fileConversionWorkflow(input)
        break
      case 'image_processing':
        result = await imageProcessingWorkflow(input)
        break
      case 'report_generation':
        result = await reportGenerationWorkflow(input)
        break
      case 'batch_operation':
        result = await batchOperationWorkflow(input)
        break
      case 'ai_inference':
        result = await aiInferenceWorkflow(input)
        break
      case 'workflow_orchestration':
        result = await workflowOrchestrationWorkflow(input)
        break
      case 'data_migration':
        result = await dataMigrationWorkflow(input)
        break
      case 'backup_operation':
        result = await backupOperationWorkflow(input)
        break
      case 'system_maintenance':
        result = await systemMaintenanceWorkflow(input)
        break
      default:
        throw new Error(`Unknown workflow type: ${input.workflowType}`)
    }

    progress = 100
    status = 'completed'
    await updateTaskProgress(input.taskId, progress, 'Task completed successfully')

    // Send webhook notification if configured
    if (input.webhookUrl) {
      await sendWebhook(input.webhookUrl, {
        taskId: input.taskId,
        status: 'completed',
        result,
        progress: 100,
        timestamp: new Date().toISOString()
      })
    }

    const duration = Date.now() - startTime
    log.info('Task workflow completed successfully', { 
      taskId: input.taskId, 
      duration,
      result 
    })

    return {
      taskId: input.taskId,
      success: true,
      result,
      duration,
      finalProgress: progress
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    status = 'failed'
    
    await updateTaskProgress(input.taskId, progress, `Task failed: ${errorMessage}`)

    // Send failure webhook notification
    if (input.webhookUrl) {
      await sendWebhook(input.webhookUrl, {
        taskId: input.taskId,
        status: 'failed',
        error: errorMessage,
        progress,
        timestamp: new Date().toISOString()
      })
    }

    const duration = Date.now() - startTime
    log.error('Task workflow failed', { 
      taskId: input.taskId, 
      error: errorMessage,
      duration 
    })

    return {
      taskId: input.taskId,
      success: false,
      error: errorMessage,
      duration,
      finalProgress: progress
    }
  }
}

// Individual workflow implementations
async function dataProcessingWorkflow(input: TaskWorkflowInput): Promise<any> {
  const { dataset, operation, filters } = input.input
  
  await updateTaskProgress(input.taskId, 20, 'Loading dataset')
  await sleep('2s') // Simulate loading time

  await updateTaskProgress(input.taskId, 40, 'Applying filters')
  await sleep('3s') // Simulate processing time

  await updateTaskProgress(input.taskId, 70, 'Processing data')
  const result = await processDataset(dataset, operation, filters)

  await updateTaskProgress(input.taskId, 90, 'Finalizing results')
  await sleep('1s')

  return result
}

async function fileConversionWorkflow(input: TaskWorkflowInput): Promise<any> {
  const { sourceFile, targetFormat, options } = input.input
  
  await updateTaskProgress(input.taskId, 25, 'Reading source file')
  await sleep('2s')

  await updateTaskProgress(input.taskId, 50, 'Converting file')
  const result = await convertFile(sourceFile, targetFormat, options)

  await updateTaskProgress(input.taskId, 90, 'Saving converted file')
  await sleep('1s')

  return result
}

async function imageProcessingWorkflow(input: TaskWorkflowInput): Promise<any> {
  const { images, operations, quality } = input.input
  
  const results = []
  const totalImages = images.length
  
  for (let i = 0; i < images.length; i++) {
    const progressPercent = Math.floor(((i + 1) / totalImages) * 80) + 10
    await updateTaskProgress(input.taskId, progressPercent, `Processing image ${i + 1} of ${totalImages}`)
    
    const result = await processImage(images[i], operations, quality)
    results.push(result)
    
    await sleep('1s') // Simulate processing time per image
  }

  return { processedImages: results, totalProcessed: results.length }
}

async function reportGenerationWorkflow(input: TaskWorkflowInput): Promise<any> {
  const { reportType, dataSource, parameters } = input.input
  
  await updateTaskProgress(input.taskId, 30, 'Gathering data')
  await sleep('3s')

  await updateTaskProgress(input.taskId, 60, 'Generating report')
  const result = await generateReport(reportType, dataSource, parameters)

  await updateTaskProgress(input.taskId, 85, 'Formatting report')
  await sleep('2s')

  return result
}

async function batchOperationWorkflow(input: TaskWorkflowInput): Promise<any> {
  const { operation, items, batchSize } = input.input
  
  const results = []
  const totalBatches = Math.ceil(items.length / batchSize)
  
  for (let i = 0; i < totalBatches; i++) {
    const batch = items.slice(i * batchSize, (i + 1) * batchSize)
    const progressPercent = Math.floor(((i + 1) / totalBatches) * 80) + 10
    
    await updateTaskProgress(input.taskId, progressPercent, `Processing batch ${i + 1} of ${totalBatches}`)
    
    const batchResult = await runBatchOperation(operation, batch)
    results.push(...batchResult)
    
    await sleep('1s') // Small delay between batches
  }

  return { processedItems: results, totalProcessed: results.length }
}

async function aiInferenceWorkflow(input: TaskWorkflowInput): Promise<any> {
  const { modelName, inputData, options } = input.input
  
  await updateTaskProgress(input.taskId, 20, 'Loading AI model')
  await sleep('2s')

  await updateTaskProgress(input.taskId, 50, 'Running inference')
  const result = await performAIInference(modelName, inputData, options)

  await updateTaskProgress(input.taskId, 80, 'Processing results')
  await sleep('1s')

  return result
}

async function workflowOrchestrationWorkflow(input: TaskWorkflowInput): Promise<any> {
  const { workflows, dependencies } = input.input
  
  await updateTaskProgress(input.taskId, 30, 'Analyzing workflow dependencies')
  await sleep('2s')

  await updateTaskProgress(input.taskId, 70, 'Orchestrating workflows')
  const result = await orchestrateWorkflow(workflows, dependencies)

  return result
}

async function dataMigrationWorkflow(input: TaskWorkflowInput): Promise<any> {
  const { source, destination, options } = input.input
  
  await updateTaskProgress(input.taskId, 25, 'Connecting to source')
  await sleep('2s')

  await updateTaskProgress(input.taskId, 50, 'Migrating data')
  const result = await migrateData(source, destination, options)

  await updateTaskProgress(input.taskId, 85, 'Validating migration')
  await sleep('2s')

  return result
}

async function backupOperationWorkflow(input: TaskWorkflowInput): Promise<any> {
  const { targets, destination, compression } = input.input
  
  await updateTaskProgress(input.taskId, 30, 'Preparing backup')
  await sleep('2s')

  await updateTaskProgress(input.taskId, 70, 'Creating backup')
  const result = await performBackup(targets, destination, compression)

  await updateTaskProgress(input.taskId, 90, 'Verifying backup')
  await sleep('1s')

  return result
}

async function systemMaintenanceWorkflow(input: TaskWorkflowInput): Promise<any> {
  const { tasks, schedule } = input.input
  
  const results = []
  const totalTasks = tasks.length
  
  for (let i = 0; i < tasks.length; i++) {
    const progressPercent = Math.floor(((i + 1) / totalTasks) * 80) + 10
    await updateTaskProgress(input.taskId, progressPercent, `Performing maintenance task: ${tasks[i]}`)
    
    const result = await performMaintenance(tasks[i])
    results.push(result)
    
    await sleep('2s') // Maintenance tasks take time
  }

  return { completedTasks: results, totalTasks: results.length }
}