/**
 * Temporal MCP Server for Long-Running Tasks
 * 
 * Provides MCP tools and resources for managing long-running asynchronous tasks
 * with temporal workflow patterns. Supports task submission, monitoring, and
 * webhook notifications for task completion.
 */

import { JsonRpcRequest, JsonRpcResponse, MCPTool, MCPResource, MCPPrompt } from './mcpTypes'
import { prisma } from '../prismaClient'
import { v4 as uuidv4 } from 'uuid'
import { temporalClient } from '../temporal/client'
import type { TaskWorkflowInput } from '../temporal/workflows'

// Task status enumeration
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running', 
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Task priority levels
export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Task definition interface
export interface LongRunningTask {
  id: string
  name: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  workflowType: string
  input: Record<string, any>
  output?: Record<string, any>
  error?: string
  progress?: number
  estimatedDuration?: number
  actualDuration?: number
  webhookUrl?: string
  userId: string
  createdAt: Date
  updatedAt: Date
  startedAt?: Date
  completedAt?: Date
  retryCount: number
  maxRetries: number
  parentTaskId?: string
  tags: string[]
}

// Webhook payload interface
export interface TaskWebhookPayload {
  taskId: string
  status: TaskStatus
  output?: Record<string, any>
  error?: string
  progress?: number
  timestamp: Date
}

// In-memory task store for MCP tracking (Temporal handles actual execution)
const taskStore = new Map<string, LongRunningTask & { workflowId?: string }>()

// Webhook notification queue
const webhookQueue: TaskWebhookPayload[] = []

export class TemporalMCPServer {
  private tools: MCPTool[] = []
  private resources: MCPResource[] = []
  private prompts: MCPPrompt[] = []

  constructor() {
    this.setupTools()
    this.setupResources()
    this.setupPrompts()
  }

  private setupTools() {
    this.tools = [
      {
        name: 'submit_task',
        description: 'Submit a new long-running task for execution',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Task name' },
            description: { type: 'string', description: 'Task description' },
            workflowType: { type: 'string', description: 'Type of workflow to execute' },
            input: { type: 'object', description: 'Task input parameters' },
            priority: { 
              type: 'string', 
              enum: Object.values(TaskPriority),
              description: 'Task priority level'
            },
            webhookUrl: { type: 'string', description: 'URL to notify on completion' },
            estimatedDuration: { type: 'number', description: 'Estimated duration in seconds' },
            maxRetries: { type: 'number', description: 'Maximum retry attempts' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Task tags' }
          },
          required: ['name', 'workflowType', 'input']
        }
      },
      {
        name: 'get_task_status',
        description: 'Get the current status of a task',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID to check' }
          },
          required: ['taskId']
        }
      },
      {
        name: 'cancel_task',
        description: 'Cancel a running or pending task',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID to cancel' },
            reason: { type: 'string', description: 'Cancellation reason' }
          },
          required: ['taskId']
        }
      },
      {
        name: 'list_tasks',
        description: 'List tasks with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            status: { 
              type: 'string', 
              enum: Object.values(TaskStatus),
              description: 'Filter by task status'
            },
            priority: {
              type: 'string',
              enum: Object.values(TaskPriority),
              description: 'Filter by priority'
            },
            workflowType: { type: 'string', description: 'Filter by workflow type' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
            limit: { type: 'number', description: 'Maximum number of results' },
            offset: { type: 'number', description: 'Pagination offset' }
          }
        }
      },
      {
        name: 'retry_task',
        description: 'Retry a failed task',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID to retry' },
            resetProgress: { type: 'boolean', description: 'Reset progress to 0%' }
          },
          required: ['taskId']
        }
      },
      {
        name: 'update_task_progress',
        description: 'Update task progress (typically called by workflow)',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID' },
            progress: { type: 'number', minimum: 0, maximum: 100, description: 'Progress percentage' },
            message: { type: 'string', description: 'Progress message' }
          },
          required: ['taskId', 'progress']
        }
      },
      {
        name: 'submit_webhook_notification',
        description: 'Submit a webhook notification for task completion',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID' },
            payload: { type: 'object', description: 'Webhook payload' }
          },
          required: ['taskId', 'payload']
        }
      },
      {
        name: 'get_workflow_types',
        description: 'Get available workflow types for task execution',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'list_running_workflows',
        description: 'List currently running Temporal workflows',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Maximum number of workflows to return' }
          }
        }
      }
    ]
  }

  private setupResources() {
    this.resources = [
      {
        uri: 'temporal://tasks',
        name: 'Task Collection',
        description: 'Collection of all long-running tasks',
        mimeType: 'application/json'
      },
      {
        uri: 'temporal://workflows',
        name: 'Workflow Types',
        description: 'Available workflow types for task execution',
        mimeType: 'application/json'
      },
      {
        uri: 'temporal://webhooks',
        name: 'Webhook Queue',
        description: 'Pending webhook notifications',
        mimeType: 'application/json'
      },
      {
        uri: 'temporal://metrics',
        name: 'Task Metrics',
        description: 'Aggregated task execution metrics',
        mimeType: 'application/json'
      }
    ]
  }

  private setupPrompts() {
    this.prompts = [
      {
        name: 'task_submission_wizard',
        description: 'Interactive wizard for submitting complex tasks',
        arguments: [
          {
            name: 'workflow_type',
            description: 'Type of workflow to execute',
            required: true
          }
        ]
      },
      {
        name: 'task_monitoring_dashboard',
        description: 'Generate a monitoring dashboard for active tasks',
        arguments: [
          {
            name: 'user_id',
            description: 'User ID to filter tasks',
            required: false
          }
        ]
      },
      {
        name: 'task_failure_analysis',
        description: 'Analyze failed tasks and suggest remediation',
        arguments: [
          {
            name: 'task_id',
            description: 'ID of failed task to analyze',
            required: true
          }
        ]
      }
    ]
  }

  // Tool execution methods
  async executeTool(name: string, arguments_: any, userId: string): Promise<any> {
    switch (name) {
      case 'submit_task':
        return this.submitTask(arguments_, userId)
      case 'get_task_status':
        return this.getTaskStatus(arguments_.taskId, userId)
      case 'cancel_task':
        return this.cancelTask(arguments_.taskId, arguments_.reason, userId)
      case 'list_tasks':
        return this.listTasks(arguments_, userId)
      case 'retry_task':
        return this.retryTask(arguments_.taskId, arguments_.resetProgress, userId)
      case 'update_task_progress':
        return this.updateTaskProgress(arguments_.taskId, arguments_.progress, arguments_.message)
      case 'submit_webhook_notification':
        return this.submitWebhookNotification(arguments_.taskId, arguments_.payload)
      case 'get_workflow_types':
        return this.getWorkflowTypes()
      case 'list_running_workflows':
        return this.listRunningWorkflows(arguments_.limit, userId)
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  }

  private async submitTask(args: any, userId: string): Promise<LongRunningTask> {
    const task: LongRunningTask & { workflowId?: string } = {
      id: uuidv4(),
      name: args.name,
      description: args.description,
      status: TaskStatus.PENDING,
      priority: args.priority || TaskPriority.NORMAL,
      workflowType: args.workflowType,
      input: args.input,
      webhookUrl: args.webhookUrl,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
      maxRetries: args.maxRetries || 3,
      estimatedDuration: args.estimatedDuration,
      tags: args.tags || []
    }

    try {
      // Create Temporal workflow input
      const workflowInput: TaskWorkflowInput = {
        taskId: task.id,
        taskName: task.name,
        workflowType: task.workflowType,
        input: task.input,
        webhookUrl: task.webhookUrl,
        userId: task.userId,
        estimatedDuration: task.estimatedDuration
      }

      // Start the actual Temporal workflow
      const workflowId = await temporalClient.startTask(workflowInput)
      task.workflowId = workflowId
      task.status = TaskStatus.RUNNING
      task.startedAt = new Date()
      task.updatedAt = new Date()

      console.log(`✅ Task ${task.id} submitted to Temporal workflow ${workflowId}`)
    } catch (error) {
      console.error(`❌ Failed to start Temporal workflow for task ${task.id}:`, error)
      task.status = TaskStatus.FAILED
      task.error = error instanceof Error ? error.message : 'Failed to start workflow'
    }

    taskStore.set(task.id, task)
    return task
  }

  private async getTaskStatus(taskId: string, userId: string): Promise<LongRunningTask | null> {
    const task = taskStore.get(taskId)
    if (!task || task.userId !== userId) {
      return null
    }

    // If we have a Temporal workflow ID, get the latest status from Temporal
    if (task.workflowId) {
      try {
        const temporalStatus = await temporalClient.getTaskStatus(task.workflowId)
        
        // Update our local task with Temporal status
        task.progress = temporalStatus.progress
        task.updatedAt = new Date()
        
        // Map Temporal status to our task status
        if (temporalStatus.status === 'completed') {
          task.status = TaskStatus.COMPLETED
          task.progress = 100
          task.completedAt = new Date()
          task.output = temporalStatus.result
        } else if (temporalStatus.status === 'failed') {
          task.status = TaskStatus.FAILED
          task.error = 'Workflow failed'
          task.completedAt = new Date()
        } else if (temporalStatus.status === 'running') {
          task.status = TaskStatus.RUNNING
        }
        
        taskStore.set(taskId, task)
      } catch (error) {
        console.error(`❌ Failed to get Temporal status for task ${taskId}:`, error)
        // Fall back to stored task status
      }
    }
    
    return task
  }

  private async cancelTask(taskId: string, reason: string, userId: string): Promise<boolean> {
    const task = taskStore.get(taskId)
    if (!task || task.userId !== userId) {
      return false
    }

    if (task.status === TaskStatus.RUNNING || task.status === TaskStatus.PENDING) {
      // Cancel the Temporal workflow if it exists
      if (task.workflowId) {
        try {
          await temporalClient.cancelTask(task.workflowId, reason)
          console.log(`✅ Cancelled Temporal workflow ${task.workflowId} for task ${taskId}`)
        } catch (error) {
          console.error(`❌ Failed to cancel Temporal workflow for task ${taskId}:`, error)
        }
      }

      task.status = TaskStatus.CANCELLED
      task.error = reason
      task.updatedAt = new Date()
      task.completedAt = new Date()
      
      // Send webhook notification if configured
      if (task.webhookUrl) {
        this.queueWebhookNotification(task)
      }
      
      return true
    }
    
    return false
  }

  private async listTasks(filters: any, userId: string): Promise<LongRunningTask[]> {
    let tasks = Array.from(taskStore.values()).filter(task => task.userId === userId)

    if (filters.status) {
      tasks = tasks.filter(task => task.status === filters.status)
    }
    if (filters.priority) {
      tasks = tasks.filter(task => task.priority === filters.priority)
    }
    if (filters.workflowType) {
      tasks = tasks.filter(task => task.workflowType === filters.workflowType)
    }
    if (filters.tags && filters.tags.length > 0) {
      tasks = tasks.filter(task => 
        filters.tags.some((tag: string) => task.tags.includes(tag))
      )
    }

    // Apply pagination
    const offset = filters.offset || 0
    const limit = filters.limit || 50
    
    return tasks
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit)
  }

  private async retryTask(taskId: string, resetProgress: boolean, userId: string): Promise<boolean> {
    const task = taskStore.get(taskId)
    if (!task || task.userId !== userId || task.status !== TaskStatus.FAILED) {
      return false
    }

    if (task.retryCount >= task.maxRetries) {
      return false
    }

    task.status = TaskStatus.PENDING
    task.retryCount++
    task.error = undefined
    task.output = undefined
    task.updatedAt = new Date()
    task.startedAt = undefined
    task.completedAt = undefined
    
    if (resetProgress) {
      task.progress = 0
    }

    try {
      // Create new Temporal workflow input for retry
      const workflowInput: TaskWorkflowInput = {
        taskId: task.id,
        taskName: task.name,
        workflowType: task.workflowType,
        input: task.input,
        webhookUrl: task.webhookUrl,
        userId: task.userId,
        estimatedDuration: task.estimatedDuration
      }

      // Start a new Temporal workflow for the retry
      const workflowId = await temporalClient.startTask(workflowInput)
      task.workflowId = workflowId
      task.status = TaskStatus.RUNNING
      task.startedAt = new Date()
      task.updatedAt = new Date()

      console.log(`✅ Task ${task.id} retried with new Temporal workflow ${workflowId}`)
      return true
    } catch (error) {
      console.error(`❌ Failed to retry Temporal workflow for task ${taskId}:`, error)
      task.status = TaskStatus.FAILED
      task.error = error instanceof Error ? error.message : 'Failed to retry workflow'
      return false
    }
  }

  private async updateTaskProgress(taskId: string, progress: number, message?: string): Promise<boolean> {
    const task = taskStore.get(taskId)
    if (!task || task.status !== TaskStatus.RUNNING) {
      return false
    }

    task.progress = progress
    task.updatedAt = new Date()
    
    // In a real implementation, this might trigger progress webhooks
    return true
  }

  private async submitWebhookNotification(taskId: string, payload: any): Promise<boolean> {
    const task = taskStore.get(taskId)
    if (!task || !task.webhookUrl) {
      return false
    }

    const webhookPayload: TaskWebhookPayload = {
      taskId,
      status: task.status,
      output: task.output,
      error: task.error,
      progress: task.progress,
      timestamp: new Date(),
      ...payload
    }

    webhookQueue.push(webhookPayload)
    
    // In a real implementation, this would send HTTP POST to webhook URL
    console.log(`Webhook queued for task ${taskId}:`, webhookPayload)
    
    return true
  }

  private async getWorkflowTypes(): Promise<string[]> {
    // Return actual Temporal workflow types available
    return [
      'data_processing',
      'file_conversion',
      'image_processing',
      'report_generation',
      'batch_operation',
      'ai_inference',
      'workflow_orchestration',
      'data_migration',
      'backup_operation',
      'system_maintenance'
    ]
  }

  private async listRunningWorkflows(limit?: number, userId?: string): Promise<any[]> {
    try {
      const runningWorkflows = await temporalClient.listRunningTasks(userId)
      const limitedResults = limit ? runningWorkflows.slice(0, limit) : runningWorkflows
      
      console.log(`📋 Found ${runningWorkflows.length} running workflows for user ${userId || 'all'}`)
      return limitedResults
    } catch (error) {
      console.error('❌ Failed to list running workflows:', error)
      return []
    }
  }

  private queueWebhookNotification(task: LongRunningTask) {
    const payload: TaskWebhookPayload = {
      taskId: task.id,
      status: task.status,
      output: task.output,
      error: task.error,
      progress: task.progress,
      timestamp: new Date()
    }
    
    webhookQueue.push(payload)
    
    // In production, process webhook queue with proper HTTP calls
    console.log(`Webhook notification queued for task ${task.id}`)
  }

  // Resource access methods
  async getResource(uri: string): Promise<any> {
    switch (uri) {
      case 'temporal://tasks':
        return Array.from(taskStore.values())
      case 'temporal://workflows':
        return await this.getWorkflowTypes()
      case 'temporal://webhooks':
        return webhookQueue
      case 'temporal://metrics':
        return this.getTaskMetrics()
      default:
        throw new Error(`Unknown resource: ${uri}`)
    }
  }

  private getTaskMetrics() {
    const tasks = Array.from(taskStore.values())
    const now = new Date()
    const oneDay = 24 * 60 * 60 * 1000

    return {
      total: tasks.length,
      byStatus: {
        pending: tasks.filter(t => t.status === TaskStatus.PENDING).length,
        running: tasks.filter(t => t.status === TaskStatus.RUNNING).length,
        completed: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
        failed: tasks.filter(t => t.status === TaskStatus.FAILED).length,
        cancelled: tasks.filter(t => t.status === TaskStatus.CANCELLED).length
      },
      recentTasks: tasks.filter(t => 
        now.getTime() - t.createdAt.getTime() < oneDay
      ).length,
      averageDuration: tasks
        .filter(t => t.actualDuration)
        .reduce((sum, t) => sum + (t.actualDuration || 0), 0) / 
        Math.max(1, tasks.filter(t => t.actualDuration).length),
      successRate: tasks.filter(t => t.status === TaskStatus.COMPLETED).length / 
        Math.max(1, tasks.filter(t => 
          t.status === TaskStatus.COMPLETED || t.status === TaskStatus.FAILED
        ).length)
    }
  }

  // MCP interface methods
  getTools(): MCPTool[] {
    return this.tools
  }

  getResources(): MCPResource[] {
    return this.resources
  }

  getPrompts(): MCPPrompt[] {
    return this.prompts
  }
}

export const temporalMcpServer = new TemporalMCPServer()