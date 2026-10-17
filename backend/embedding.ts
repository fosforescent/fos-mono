// Embeddings for the MCP server registry (descriptions of servers and tools), using the same
// Vertex model and 768-dimension pgvector layout as the row search index in search/rowIndex.ts.
import { vertexEmbed } from './search/rowIndex'

const embed = vertexEmbed()

export async function generateMCPEmbedding(text: string | null): Promise<number[] | null> {
  if (!text || text.trim().length === 0) return null
  try {
    const [vector] = await embed([text.trim()])
    return vector ?? null
  } catch (error) {
    console.error('Error generating MCP embedding:', error)
    return null
  }
}

export async function generateMCPEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const validTexts = texts.filter(text => text && text.trim().length > 0)
  if (validTexts.length === 0) return []
  try {
    return await embed(validTexts)
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
    const [queryEmbedding] = await embed([query])
    if (!queryEmbedding) return []
    const { prisma } = await import('./prismaClient')
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
    const [queryEmbedding] = await embed([query])
    if (!queryEmbedding) return []
    const { prisma } = await import('./prismaClient')
    const serverFilter = serverId ? `AND "serverId" = ${serverId}` : ''
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
