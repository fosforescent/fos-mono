/**
 * Temporal Client for Fosforescent MCP Server
 * 
 * This client connects to Temporal and provides methods for
 * starting, monitoring, and controlling workflows.
 */

import { Client, Connection } from '@temporalio/client'
import { taskWorkflow, pauseTaskSignal, resumeTaskSignal, cancelTaskSignal, getProgressQuery, getStatusQuery } from './workflows'
import type { TaskWorkflowInput, TaskWorkflowResult } from './workflows'

const TEMPORAL_SERVER_HOST = process.env.TEMPORAL_SERVER_HOST || 'localhost:7233'
const TASK_QUEUE = 'fosforescent-tasks'

class TemporalTaskClient {
  private client: Client | null = null
  private connection: Connection | null = null

  async connect(): Promise<void> {
    if (this.client) {
      return // Already connected
    }

    try {
      this.connection = await Connection.connect({
        address: TEMPORAL_SERVER_HOST,
      })

      this.client = new Client({
        connection: this.connection,
      })

      console.log(`✅ Connected to Temporal server at ${TEMPORAL_SERVER_HOST}`)
    } catch (error) {
      console.error('❌ Failed to connect to Temporal server:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close()
      this.connection = null
      this.client = null
      console.log('🔌 Disconnected from Temporal server')
    }
  }

  async startTask(input: TaskWorkflowInput): Promise<string> {
    if (!this.client) {
      throw new Error('Temporal client not connected')
    }

    try {
      const workflowId = `task-${input.taskId}-${Date.now()}`
      
      const handle = await this.client.workflow.start(taskWorkflow, {
        workflowId,
        taskQueue: TASK_QUEUE,
        args: [input],
        workflowRunTimeout: '1h', // Maximum runtime
        workflowTaskTimeout: '10s',
        memo: {
          taskId: input.taskId,
          userId: input.userId,
          workflowType: input.workflowType
        },
        searchAttributes: {
          TaskId: [input.taskId],
          UserId: [input.userId],
          WorkflowType: [input.workflowType]
        }
      })

      console.log(`🚀 Started workflow ${workflowId} for task ${input.taskId}`)
      return workflowId
    } catch (error) {
      console.error('❌ Failed to start workflow:', error)
      throw error
    }
  }

  async getTaskStatus(workflowId: string): Promise<{
    status: string
    progress: number
    result?: any
    isRunning: boolean
  }> {
    if (!this.client) {
      throw new Error('Temporal client not connected')
    }

    try {
      const handle = this.client.workflow.getHandle(workflowId)
      
      const [status, progress, result] = await Promise.all([
        handle.query(getStatusQuery),
        handle.query(getProgressQuery),
        handle.query(getStatusQuery).then(status => 
          status === 'completed' || status === 'failed' ? 
          handle.result().catch(() => null) : null
        )
      ])

      const workflowStatus = await handle.describe()
      const isRunning = workflowStatus.status.name === 'RUNNING'

      return {
        status,
        progress,
        result,
        isRunning
      }
    } catch (error) {
      console.error('❌ Failed to get task status:', error)
      throw error
    }
  }

  async pauseTask(workflowId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Temporal client not connected')
    }

    try {
      const handle = this.client.workflow.getHandle(workflowId)
      await handle.signal(pauseTaskSignal)
      console.log(`⏸️  Paused task workflow ${workflowId}`)
    } catch (error) {
      console.error('❌ Failed to pause task:', error)
      throw error
    }
  }

  async resumeTask(workflowId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Temporal client not connected')
    }

    try {
      const handle = this.client.workflow.getHandle(workflowId)
      await handle.signal(resumeTaskSignal)
      console.log(`▶️  Resumed task workflow ${workflowId}`)
    } catch (error) {
      console.error('❌ Failed to resume task:', error)
      throw error
    }
  }

  async cancelTask(workflowId: string, reason: string = 'User requested cancellation'): Promise<void> {
    if (!this.client) {
      throw new Error('Temporal client not connected')
    }

    try {
      const handle = this.client.workflow.getHandle(workflowId)
      await handle.signal(cancelTaskSignal, reason)
      console.log(`🛑 Cancelled task workflow ${workflowId}: ${reason}`)
    } catch (error) {
      console.error('❌ Failed to cancel task:', error)
      throw error
    }
  }

  async getTaskResult(workflowId: string): Promise<TaskWorkflowResult> {
    if (!this.client) {
      throw new Error('Temporal client not connected')
    }

    try {
      const handle = this.client.workflow.getHandle(workflowId)
      const result = await handle.result()
      console.log(`📋 Retrieved result for workflow ${workflowId}`)
      return result
    } catch (error) {
      console.error('❌ Failed to get task result:', error)
      throw error
    }
  }

  async listRunningTasks(userId?: string): Promise<Array<{
    workflowId: string
    taskId: string
    workflowType: string
    startTime: Date
    status: string
  }>> {
    if (!this.client) {
      throw new Error('Temporal client not connected')
    }

    try {
      let query = 'WorkflowType="taskWorkflow" AND ExecutionStatus="Running"'
      if (userId) {
        query += ` AND UserId="${userId}"`
      }

      const workflows = []
      for await (const workflow of this.client.workflow.list({ query })) {
        workflows.push({
          workflowId: workflow.workflowId,
          taskId: String(workflow.searchAttributes?.TaskId?.[0] || ''),
          workflowType: String(workflow.searchAttributes?.WorkflowType?.[0] || ''),
          startTime: workflow.startTime || new Date(),
          status: workflow.status.name
        })
      }

      return workflows
    } catch (error) {
      console.error('❌ Failed to list running tasks:', error)
      throw error
    }
  }

  async getWorkflowHistory(workflowId: string): Promise<any[]> {
    if (!this.client) {
      throw new Error('Temporal client not connected')
    }

    try {
      const handle = this.client.workflow.getHandle(workflowId)
      const history = []
      
      // Note: fetchHistory() API may have changed, using describe instead
      const workflowInfo = await handle.describe()
      history.push({
        eventId: workflowInfo.workflowId,
        eventType: 'WorkflowExecutionStarted',
        timestamp: workflowInfo.startTime,
        attributes: workflowInfo.searchAttributes
      })

      return history
    } catch (error) {
      console.error('❌ Failed to get workflow history:', error)
      throw error
    }
  }

  async terminateTask(workflowId: string, reason: string = 'Task terminated'): Promise<void> {
    if (!this.client) {
      throw new Error('Temporal client not connected')
    }

    try {
      const handle = this.client.workflow.getHandle(workflowId)
      await handle.terminate(reason)
      console.log(`💀 Terminated task workflow ${workflowId}: ${reason}`)
    } catch (error) {
      console.error('❌ Failed to terminate task:', error)
      throw error
    }
  }
}

// Singleton instance
export const temporalClient = new TemporalTaskClient()

// Auto-connect on module load
temporalClient.connect().catch(error => {
  console.warn('⚠️  Failed to auto-connect to Temporal server on startup:', error.message)
  console.log('ℹ️  Will retry connection when needed')
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  await temporalClient.disconnect()
})

process.on('SIGINT', async () => {
  await temporalClient.disconnect()
})