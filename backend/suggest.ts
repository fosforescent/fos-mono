import { Request, Response } from 'express'
import {prisma} from './prismaClient'
import { VertexAI } from '@google-cloud/vertexai'

// Initialize Vertex AI client
const projectId = process.env.GCP_PROJECT_ID
const location = process.env.GCP_REGION || 'us-central1'

if (!projectId) {
  throw new Error('GCP_PROJECT_ID environment variable not found')
}

const vertexAI = new VertexAI({ project: projectId, location: location })

// Mapping function to convert OpenAI format to Vertex AI format
function convertOpenAIToVertexAI(openAIRequest: any) {
  const { messages, temperature, max_tokens, top_p, model } = openAIRequest

  // Convert messages format
  const contents = messages.map((msg: any) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }))

  // Use gemini-pro or gemini-pro-vision based on model parameter
  const vertexModel = model?.includes('vision') ? 'gemini-pro-vision' : 'gemini-1.5-pro'

  return {
    contents,
    generationConfig: {
      temperature: temperature || 0.7,
      maxOutputTokens: max_tokens || 2048,
      topP: top_p || 0.95,
    },
    model: vertexModel
  }
}

// Mapping function to convert Vertex AI response to OpenAI format
function convertVertexAIToOpenAI(vertexResponse: any, model: string = 'gemini-1.5-pro') {
  const candidates = vertexResponse.candidates || []
  const choices = candidates.map((candidate: any, index: number) => ({
    index,
    message: {
      role: 'assistant',
      content: candidate.content.parts.map((part: any) => part.text).join('')
    },
    finish_reason: candidate.finishReason === 'STOP' ? 'stop' : 'length'
  }))

  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices,
    usage: {
      prompt_tokens: vertexResponse.usageMetadata?.promptTokenCount || 0,
      completion_tokens: vertexResponse.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: vertexResponse.usageMetadata?.totalTokenCount || 0
    }
  }
}

export const getSuggest = async (req: Request, res: Response) => {
  const claims = (req as any).claims
  const username = claims.username

  const user = await prisma.userModel.findUnique({
    where: { user_name: username }
  })

  if (!user) {
    res.status(401).send('User not found')
    return
  }

  if (user.api_calls_used > user.api_calls_available) {
    res.status(429).send('API limit reached')
    return
  }

  try {
    // Convert OpenAI request to Vertex AI format
    const vertexRequest = convertOpenAIToVertexAI(req.body)

    // Get generative model
    const generativeModel = vertexAI.getGenerativeModel({
      model: vertexRequest.model,
    })

    // Generate content
    const result = await generativeModel.generateContent({
      contents: vertexRequest.contents,
      generationConfig: vertexRequest.generationConfig,
    })

    const response = await result.response

    // Convert Vertex AI response to OpenAI format
    const responseJson = convertVertexAIToOpenAI(response, vertexRequest.model)

    const updatedUser = await prisma.userModel.update({
      where: { user_name: username },
      data: {
        api_calls_total: user.api_calls_total + 1,
        api_calls_used: user.api_calls_used + 1
      }
    })

    res.json({
      subscription_data: {
        api_calls_used: updatedUser.api_calls_used,
        api_calls_total: updatedUser.api_calls_total,
        api_calls_available: updatedUser.api_calls_available,
        subscription_status: updatedUser.subscription_status
      },
      responses: responseJson
    })
  } catch (error) {
    console.error('Error calling Vertex AI:', error)
    res.status(500).json({
      error: 'Failed to generate completion',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
