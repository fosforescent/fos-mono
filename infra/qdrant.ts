import { config } from 'dotenv'
// Load environment variables first
config({ path: '../.env' })

import { QdrantClient } from '@qdrant/js-client-rest'
import OpenAI from 'openai'

// Initialize Qdrant client
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY, // Optional for local development
})

// Initialize OpenAI for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// Validate environment variables
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY not set - embedding generation will fail');
}

const COLLECTION_NAME = 'fosforescent_nodes'
const VECTOR_SIZE = 3072 // OpenAI text-embedding-3-large dimension

export interface SearchResult {
  id: string
  score: number
  nodeId: string
  content: string
  metadata?: Record<string, any>
}

// Ensure collection exists
export const initializeCollection = async (): Promise<void> => {
  try {
    // Check if collection exists
    const collections = await qdrant.getCollections()
    const collectionExists = collections.collections.some(
      col => col.name === COLLECTION_NAME
    )

    if (!collectionExists) {
      // Create collection
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine',
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 1,
      })
      console.log(`Created Qdrant collection: ${COLLECTION_NAME}`)
    }
  } catch (error) {
    console.error('Error initializing Qdrant collection:', error)
    throw error
  }
}

// Generate embedding using OpenAI
export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
      encoding_format: 'float',
    })
    
    const embedding = response.data[0]?.embedding
    if (!embedding) {
      throw new Error('No embedding returned from OpenAI')
    }
    return embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw error
  }
}

// Search for similar content
export const semanticSearch = async (
  query: string,
  limit: number = 10,
  minScore: number = 0.7
): Promise<SearchResult[]> => {
  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query)
    
    // Search in Qdrant
    const searchResult = await qdrant.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit,
      score_threshold: minScore,
      with_payload: true,
    })

    // Transform results
    return searchResult.map(result => ({
      id: result.id.toString(),
      score: result.score || 0,
      nodeId: result.payload?.nodeId as string || '',
      content: result.payload?.content as string || '',
      metadata: result.payload?.metadata as Record<string, any> || {},
    }))
  } catch (error) {
    console.error('Qdrant search error:', error)
    return []
  }
}

// Upsert document/node content
export const upsertDocument = async (
  nodeId: string,
  content: string,
  metadata: Record<string, any> = {}
): Promise<void> => {
  try {
    // Generate embedding
    const embedding = await generateEmbedding(content)
    
    if (!embedding || embedding.length === 0) {
      throw new Error('Failed to generate embedding for content')
    }
    
    // Upsert to Qdrant
    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: nodeId,
          vector: embedding,
          payload: {
            nodeId,
            content,
            metadata,
            updatedAt: new Date().toISOString(),
          },
        },
      ],
    })
  } catch (error) {
    console.error('Qdrant upsert error:', error)
    throw error
  }
}

// Delete document
export const deleteDocument = async (nodeId: string): Promise<void> => {
  try {
    await qdrant.delete(COLLECTION_NAME, {
      wait: true,
      points: [nodeId],
    })
  } catch (error) {
    console.error('Qdrant delete error:', error)
    throw error
  }
}

// Batch upsert for multiple documents
export const batchUpsertDocuments = async (
  documents: Array<{
    nodeId: string
    content: string
    metadata?: Record<string, any>
  }>
): Promise<void> => {
  try {
    // Generate embeddings for all documents
    const contents = documents.map(doc => doc.content)
    const embeddings = await Promise.all(
      contents.map(content => generateEmbedding(content))
    )

    // Validate all embeddings
    embeddings.forEach((embedding, index) => {
      if (!embedding || embedding.length === 0) {
        throw new Error(`Failed to generate embedding for document ${documents[index]?.nodeId || index}`)
      }
    })

    // Prepare points for batch upsert
    const points = documents.map((doc, index) => ({
      id: doc.nodeId,
      vector: embeddings[index]!, // We validated above that all embeddings exist
      payload: {
        nodeId: doc.nodeId,
        content: doc.content,
        metadata: doc.metadata || {},
        updatedAt: new Date().toISOString(),
      },
    }))

    // Batch upsert
    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points,
    })
  } catch (error) {
    console.error('Qdrant batch upsert error:', error)
    throw error
  }
}

// Get collection info
export const getCollectionInfo = async () => {
  try {
    return await qdrant.getCollection(COLLECTION_NAME)
  } catch (error) {
    console.error('Error getting collection info:', error)
    throw error
  }
}