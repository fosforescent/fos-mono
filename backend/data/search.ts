import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppState, FosPath, FosRoute } from '@fosforescent/shared/types';
import { FosStore } from '@fosforescent/shared/dag-implementation/store';
import { FosExpression } from '@fosforescent/shared/dag-implementation/expression';
import { VertexAI } from '@google-cloud/vertexai';
import { Document } from '@langchain/core/documents';
import { mutableMapExpressions } from '@fosforescent/shared/utils';
import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings';
import { semanticSearch as qdrantSemanticSearch, upsertDocument, batchUpsertDocuments } from '@fosforescent/infra/qdrant';

// Initialize Vertex AI client
const projectId = process.env.GCP_PROJECT_ID
const location = process.env.GCP_REGION || 'us-central1'

if (!projectId) {
  throw new Error('GCP_PROJECT_ID environment variable not found')
}

const vertexAI = new VertexAI({ project: projectId, location: location })

// Initialize Prisma client
const prisma = new PrismaClient();

// Vertex AI embeddings adapter that implements LangChain's Embeddings interface
export class VertexAIEmbeddingsAdapter extends Embeddings {
  private client: VertexAI;
  private model: string;

  constructor(params: EmbeddingsParams & { client: VertexAI; model?: string }) {
    super(params);
    this.client = params.client;
    // Use text-embedding-004 (768 dimensions) or text-multilingual-embedding-002 (768 dimensions)
    // For compatibility with 3072 dimensions from OpenAI, we'll use textembedding-gecko@003
    this.model = params.model || 'text-embedding-004';
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const model = this.client.preview.getGenerativeModel({ model: this.model });

    // Process in batches to avoid rate limits
    const batchSize = 5;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const promises = batch.map(async (text) => {
        const request = {
          contents: [{ role: 'user', parts: [{ text }] }],
        };
        const result = await model.generateContent(request);
        // Vertex AI text embeddings return embeddings in a different format
        // We need to use the embedding API endpoint
        return this.getEmbedding(text);
      });

      const batchEmbeddings = await Promise.all(promises);
      embeddings.push(...batchEmbeddings);

      // Add delay between batches
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.getEmbedding(text);
  }

  private async getEmbedding(text: string): Promise<number[]> {
    // Use Vertex AI Text Embeddings API
    // Note: You might need to use the REST API or aiplatform client for embeddings
    // This is a simplified version using the Vertex AI SDK
    const model = this.client.preview.getGenerativeModel({ model: this.model });

    try {
      // For text embeddings, we need to use the prediction service
      // This is a workaround - in production, use the proper embedding endpoint
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text }] }],
      });

      // Extract embedding from response
      // Note: The actual implementation depends on the Vertex AI SDK version
      // You may need to use the aiplatform PredictionServiceClient for embeddings
      const embedding = await this.getTextEmbeddingFromVertexAI(text);
      return embedding;
    } catch (error) {
      console.error('Error getting embedding from Vertex AI:', error);
      throw error;
    }
  }

  private async getTextEmbeddingFromVertexAI(text: string): Promise<number[]> {
    // Use Vertex AI Text Embeddings API endpoint
    // This requires the aiplatform client library
    const { PredictionServiceClient } = require('@google-cloud/aiplatform');

    const client = new PredictionServiceClient({
      apiEndpoint: `${location}-aiplatform.googleapis.com`,
    });

    const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/${this.model}`;

    const instance = {
      content: text,
    };

    const request = {
      endpoint,
      instances: [instance],
    };

    try {
      const [response] = await client.predict(request);
      const predictions = response.predictions;

      if (!predictions || predictions.length === 0) {
        throw new Error('No embeddings returned from Vertex AI');
      }

      // Extract embedding vector from prediction
      const embedding = predictions[0].embeddings?.values || predictions[0].values;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding format from Vertex AI');
      }

      return embedding;
    } catch (error) {
      console.error('Error calling Vertex AI Prediction Service:', error);
      throw error;
    }
  }
}

// Create embeddings adapter instance
const embeddingsAdapter = new VertexAIEmbeddingsAdapter({
  client: vertexAI,
});

// Get batch embeddings from Vertex AI
export async function getBatchEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    return await embeddingsAdapter.embedDocuments(texts);
  } catch (error) {
    console.error('Error getting embeddings:', error);
    throw error;
  }
}

// Process and store documents with their embeddings
export async function processAndStoreDocuments(
  docs: { text: string; nodeId: string; metadata?: Record<string, any> }[]
): Promise<number> {
  try {
    if (docs.length === 0) return 0;

    // Use batch upsert to Qdrant
    await batchUpsertDocuments(docs.map(doc => ({
      nodeId: doc.nodeId,
      content: doc.text,
      metadata: doc.metadata || {}
    })));

    console.log(`Successfully upserted ${docs.length} documents to Qdrant`);
    return docs.length;
  } catch (error) {
    console.error('Error in processAndStoreDocuments:', error);
    throw error;
  }
}

interface SearchResult {
  nodeId: string;
  score: number;
  description: string;
  metadata: Record<string, any>;
}

// Execute semantic search using Qdrant vector similarity
export async function semanticSearch(
  query: string,
  options: {
    k?: number;
    excludeIds?: string[];
    minScore?: number;
  } = {}
): Promise<Document[]> {
  try {
    const {
      k = 20,
      excludeIds = [],
      minScore = 0.7
    } = options;

    // Use Qdrant semantic search
    const searchResults = await qdrantSemanticSearch(query, k, minScore);

    // Filter out excluded IDs if specified
    const filteredResults = excludeIds.length > 0 
      ? searchResults.filter(result => !excludeIds.includes(result.nodeId))
      : searchResults;

    // Convert results to Document format
    return filteredResults.map(result => new Document({
      pageContent: result.content,
      metadata: {
        ...result.metadata,
        id: result.nodeId,
        score: result.score
      }
    }));
  } catch (error) {
    console.error('Error in semanticSearch:', error);
    throw error;
  }
}

// Execute search for a specific expression
export const executeSearch = async (
  expression: FosExpression,
  options: {
    limit?: number;
    minScore?: number;
    excludeIds?: string[];
  } = {}
): Promise<SearchResult[]> => {
  try {
    const nodeDescription = expression.getDescription();

    if (!nodeDescription) {
      console.warn('No node description available for search');
      return [];
    }

    const {
      limit = 20,
      minScore = 0.7,
      excludeIds = []
    } = options;

    // Get search results
    const searchResults = await semanticSearch(
      nodeDescription,
      {
        k: limit,
        excludeIds,
        minScore
      }
    );

    // Transform and filter results
    const results = processSearchResults(searchResults, expression.store.exportContext([]));

    results.forEach(result => {
      const { nodeId, score, description } = result;
      console.log(`Node ID: ${nodeId}, Score: ${score}, Description: ${description}`);
    });

    return results;
  } catch (error) {
    console.error('Error in executeSearch:', error);
    throw error;
  }
}

function processSearchResults(
  results: Document[],
  context: { fosData: { nodes: Record<string, any> } }
): SearchResult[] {
  return results
    .map(result => {
      const nodeId = result.metadata.id;
      const node = context.fosData.nodes[nodeId];

      return {
        nodeId,
        score: result.metadata.score || 0,
        description: node?.data.description?.content || 'No description available',
        metadata: result.metadata
      };
    })
    .sort((a, b) => b.score - a.score); // Sort by score descending
}

// API endpoint for search
export const searchQuery = async (req: Request, res: Response) => {
  try {
    const {
      route,
      context,
      limit,
      minScore,
      excludeIds
    } = req.body;

    if (!route || !context) {
      return res.status(400).json({
        error: 'Missing required parameters'
      });
    }

    const store = new FosStore({ fosCtxData: context });
    const expression = new FosExpression(store, route);

    const results = await executeSearch(expression, {
      limit,
      minScore,
      excludeIds
    });

    return res.json({
      results,
      total: results.length
    });
  } catch (error) {
    console.error('Error in search query:', error);
    return res.status(500).json({
      error: 'Failed to execute search'
    });
  }
}

// Upsert search terms for all nodes in store
export const upsertSearchTerms = async (store: FosStore): Promise<boolean> => {
  try {
    type UpsertObject = {
      nodeId: string;
      text: string;
      metadata: Record<string, any>;
    }

    const itemsMap = mutableMapExpressions<UpsertObject>(store.exportContext([]), (resultMap, expression) => {
      const nodeId = expression.targetNode.getId()
      const nodeRoute = expression.route
      const nodeDescription = expression.getDescription()
      const nodeData = expression.targetNode.getData()

      if (nodeDescription) {
        resultMap.set(nodeRoute, {
          nodeId: nodeId,
          text: nodeDescription,
          metadata: {
            route: nodeRoute,
            updatedAt: nodeData.updated?.time,
          }
        })
      }
    });

    const items = [...itemsMap.values()];

    if (items.length === 0) {
      console.warn('No valid items found to upsert');
      return false;
    }

    const processedCount = await processAndStoreDocuments(items);
    console.log(`Successfully processed ${processedCount} documents`);
    return true;
  } catch (error) {
    console.error('Error in upsertSearchTerms:', error);
    return false;
  }
}

// Initialize the database schema if needed
export async function initializeVectorExtension(): Promise<void> {
  try {
    // Check if vector extension is installed
    const extensionExists = await prisma.$queryRaw`
      SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector'
    `;

    if ((extensionExists as any)[0].count === '0') {
      // The vector extension needs to be installed by a superuser
      console.warn('The vector extension is not installed in PostgreSQL');
      console.warn('Please run: CREATE EXTENSION vector; with superuser privileges');
    }

    console.log('Vector extension check completed');
  } catch (error) {
    console.error('Error checking vector extension:', error);
  }
}