// MCP-specific embedding utilities that complement the existing search system
import { OpenAIEmbeddingsAdapter } from './data/search'
import OpenAI from 'openai'

// Reuse the existing OpenAI client from the search system
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Reuse the existing embeddings adapter
const embeddingsAdapter = new OpenAIEmbeddingsAdapter({
  client: openai,
});

// Utility function to generate embedding for MCP descriptions
// Uses the same model as the existing search system for consistency
export async function generateMCPEmbedding(text: string | null): Promise<number[] | null> {
  if (!text || text.trim().length === 0) {
    return null
  }
  
  try {
    // Use the existing embeddings adapter to maintain consistency
    return await embeddingsAdapter.embedQuery(text.trim())
  } catch (error) {
    console.error('Error generating MCP embedding:', error)
    return null
  }
}

// Batch generate embeddings for multiple MCP items
export async function generateMCPEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }
  
  try {
    // Filter out empty texts
    const validTexts = texts.filter(text => text && text.trim().length > 0)
    if (validTexts.length === 0) {
      return []
    }
    
    // Use the existing embeddings adapter for batch processing
    return await embeddingsAdapter.embedDocuments(validTexts)
  } catch (error) {
    console.error('Error generating MCP embeddings batch:', error)
    return []
  }
}

// Search MCP servers by description similarity
export async function searchMCPServers(
  query: string, 
  options: {
    limit?: number
    minScore?: number
    userId?: number
  } = {}
): Promise<Array<{ serverId: number; score: number; name: string; description: string }>> {
  const { limit = 10, minScore = 0.7 } = options
  
  try {
    // Generate embedding for the search query
    const queryEmbedding = await embeddingsAdapter.embedQuery(query)
    
    // Import prisma here to avoid circular dependencies
    const { prisma } = await import('./prismaClient')
    
    // Search MCP servers by description embedding similarity
    const results = await prisma.$queryRaw`
      SELECT 
        id as "serverId",
        name,
        description,
        1 - ("descriptionEmbedding" <=> ${queryEmbedding}::vector) as score
      FROM "MCPServerModel"
      WHERE 
        "descriptionEmbedding" IS NOT NULL
        AND 1 - ("descriptionEmbedding" <=> ${queryEmbedding}::vector) >= ${minScore}
      ORDER BY "descriptionEmbedding" <=> ${queryEmbedding}::vector
      LIMIT ${limit}
    ` as Array<{ serverId: number; name: string; description: string; score: number }>
    
    return results
  } catch (error) {
    console.error('Error searching MCP servers:', error)
    return []
  }
}

// Search MCP tools by description similarity
export async function searchMCPTools(
  query: string,
  options: {
    limit?: number
    minScore?: number
    serverId?: number
  } = {}
): Promise<Array<{ toolId: number; serverId: number; name: string; description: string; score: number }>> {
  const { limit = 10, minScore = 0.7, serverId } = options
  
  try {
    // Generate embedding for the search query
    const queryEmbedding = await embeddingsAdapter.embedQuery(query)
    
    // Import prisma here to avoid circular dependencies
    const { prisma } = await import('./prismaClient')
    
    // Build the WHERE clause for optional server filtering
    const serverFilter = serverId ? `AND "serverId" = ${serverId}` : ''
    
    // Search MCP tools by description embedding similarity
    const results = await prisma.$queryRaw`
      SELECT 
        id as "toolId",
        "serverId",
        name,
        description,
        1 - ("descriptionEmbedding" <=> ${queryEmbedding}::vector) as score
      FROM "MCPToolModel"
      WHERE 
        "descriptionEmbedding" IS NOT NULL
        AND 1 - ("descriptionEmbedding" <=> ${queryEmbedding}::vector) >= ${minScore}
        ${serverFilter}
      ORDER BY "descriptionEmbedding" <=> ${queryEmbedding}::vector
      LIMIT ${limit}
    ` as Array<{ toolId: number; serverId: number; name: string; description: string; score: number }>
    
    return results
  } catch (error) {
    console.error('Error searching MCP tools:', error)
    return []
  }
}