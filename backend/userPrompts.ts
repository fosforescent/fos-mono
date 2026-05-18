import { Request, Response } from 'express'
import { prisma } from './prismaClient'
import { getUserId } from './apiTokenAuth'
import { notifyUserOfPrompt, notifyUserOfPromptResponse } from './promptNotifications'

interface CreatePromptRequest {
  title: string
  message: string
  promptType?: 'input' | 'confirmation' | 'choice'
  options?: string[]
  inputSchema?: object
  defaultValue?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  expiresInMinutes?: number
  serverId?: number
}

interface RespondToPromptRequest {
  response: string
}

// Get user's prompts
export const getUserPrompts = async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req)
    const { status, limit = 50, offset = 0 } = req.query

    const where: any = { userId }
    
    if (status && typeof status === 'string') {
      where.status = status
    }

    // Mark expired prompts
    await prisma.userPromptModel.updateMany({
      where: {
        userId,
        status: 'pending',
        expiresAt: {
          lte: new Date()
        }
      },
      data: {
        status: 'expired'
      }
    })

    const prompts = await prisma.userPromptModel.findMany({
      where,
      include: {
        server: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      skip: parseInt(offset as string),
      take: parseInt(limit as string)
    })

    const totalCount = await prisma.userPromptModel.count({ where })

    res.json({
      prompts: prompts.map(prompt => ({
        ...prompt,
        isExpired: prompt.expiresAt ? new Date() > prompt.expiresAt : false
      })),
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: totalCount > parseInt(offset as string) + parseInt(limit as string)
      }
    })
  } catch (error) {
    console.error('Error fetching user prompts:', error)
    res.status(500).json({ error: 'Failed to fetch prompts' })
  }
}

// Get a specific prompt
export const getPrompt = async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req)
    const { promptId } = req.params

    const prompt = await prisma.userPromptModel.findFirst({
      where: {
        promptId,
        userId
      },
      include: {
        server: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' })
    }

    // Check if expired and update status
    if (prompt.status === 'pending' && prompt.expiresAt && new Date() > prompt.expiresAt) {
      await prisma.userPromptModel.update({
        where: { id: prompt.id },
        data: { status: 'expired' }
      })
      prompt.status = 'expired'
    }

    res.json({
      prompt: {
        ...prompt,
        isExpired: prompt.expiresAt ? new Date() > prompt.expiresAt : false
      }
    })
  } catch (error) {
    console.error('Error fetching prompt:', error)
    res.status(500).json({ error: 'Failed to fetch prompt' })
  }
}

// Respond to a prompt
export const respondToPrompt = async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req)
    const { promptId } = req.params
    const { response }: RespondToPromptRequest = req.body

    if (!response && response !== '') {
      return res.status(400).json({ error: 'Response is required' })
    }

    // Find the prompt
    const prompt = await prisma.userPromptModel.findFirst({
      where: {
        promptId,
        userId
      }
    })

    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' })
    }

    if (prompt.status !== 'pending') {
      return res.status(400).json({ error: 'Prompt is no longer pending' })
    }

    // Check if expired
    if (prompt.expiresAt && new Date() > prompt.expiresAt) {
      await prisma.userPromptModel.update({
        where: { id: prompt.id },
        data: { status: 'expired' }
      })
      return res.status(400).json({ error: 'Prompt has expired' })
    }

    // Validate response based on prompt type
    if (prompt.promptType === 'choice' && prompt.options) {
      const options = Array.isArray(prompt.options) ? prompt.options as string[] : []
      if (!options.includes(response)) {
        return res.status(400).json({ 
          error: 'Invalid choice', 
          validOptions: options 
        })
      }
    }

    if (prompt.promptType === 'confirmation') {
      if (!['yes', 'no', 'true', 'false'].includes(response.toLowerCase())) {
        return res.status(400).json({ 
          error: 'Invalid confirmation response', 
          validOptions: ['yes', 'no', 'true', 'false'] 
        })
      }
    }

    // TODO: Validate against inputSchema if provided

    // Update the prompt with response
    const updatedPrompt = await prisma.userPromptModel.update({
      where: { id: prompt.id },
      data: {
        response,
        status: 'responded',
        respondedAt: new Date()
      },
      include: {
        server: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Notify user of response confirmation
    notifyUserOfPromptResponse(userId, {
      promptId: updatedPrompt.promptId,
      status: 'responded',
      response: response
    })

    res.json({
      success: true,
      prompt: updatedPrompt
    })
  } catch (error) {
    console.error('Error responding to prompt:', error)
    res.status(500).json({ error: 'Failed to respond to prompt' })
  }
}

// Cancel a prompt
export const cancelPrompt = async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req)
    const { promptId } = req.params

    const prompt = await prisma.userPromptModel.findFirst({
      where: {
        promptId,
        userId
      }
    })

    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' })
    }

    if (prompt.status !== 'pending') {
      return res.status(400).json({ error: 'Can only cancel pending prompts' })
    }

    await prisma.userPromptModel.update({
      where: { id: prompt.id },
      data: { status: 'cancelled' }
    })

    res.json({ success: true, message: 'Prompt cancelled' })
  } catch (error) {
    console.error('Error cancelling prompt:', error)
    res.status(500).json({ error: 'Failed to cancel prompt' })
  }
}

// Get prompt statistics
export const getPromptStats = async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req)

    const stats = await prisma.$transaction(async (tx) => {
      const total = await tx.userPromptModel.count({ where: { userId } })
      const pending = await tx.userPromptModel.count({ 
        where: { userId, status: 'pending' } 
      })
      const responded = await tx.userPromptModel.count({ 
        where: { userId, status: 'responded' } 
      })
      const expired = await tx.userPromptModel.count({ 
        where: { userId, status: 'expired' } 
      })
      const cancelled = await tx.userPromptModel.count({ 
        where: { userId, status: 'cancelled' } 
      })

      return {
        total,
        pending,
        responded,
        expired,
        cancelled
      }
    })

    res.json({ stats })
  } catch (error) {
    console.error('Error fetching prompt stats:', error)
    res.status(500).json({ error: 'Failed to fetch prompt statistics' })
  }
}

// Admin: Create a prompt for a user (for testing/admin purposes)
export const createPromptForUser = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      title,
      message,
      promptType = 'input',
      options,
      inputSchema,
      defaultValue,
      priority = 'normal',
      expiresInMinutes,
      serverId
    }: CreatePromptRequest & { userId: number } = req.body

    if (!userId || !title || !message) {
      return res.status(400).json({ error: 'userId, title, and message are required' })
    }

    // Verify user exists
    const user = await prisma.userModel.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const promptId = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    let expiresAt = null
    if (expiresInMinutes) {
      expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000)
    }

    const prompt = await prisma.userPromptModel.create({
      data: {
        userId,
        serverId,
        promptId,
        title,
        message,
        promptType,
        options: options || [],
        inputSchema: inputSchema || {},
        defaultValue,
        priority,
        expiresAt
      },
      include: {
        server: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Send notification to user
    const serverName = serverId ? (await prisma.mCPServerModel.findUnique({
      where: { id: serverId },
      select: { name: true }
    }))?.name : undefined

    notifyUserOfPrompt(userId, {
      promptId: prompt.promptId,
      title: prompt.title,
      message: prompt.message,
      priority: prompt.priority,
      promptType: prompt.promptType,
      serverId,
      serverName
    })

    res.status(201).json({
      success: true,
      prompt
    })
  } catch (error) {
    console.error('Error creating prompt:', error)
    res.status(500).json({ error: 'Failed to create prompt' })
  }
}