import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppState, FosPath, FosRoute } from '@/shared/types';
import { FosStore } from '@/shared/dag-implementation/store';
import { FosExpression } from '@/shared/dag-implementation/expression';
import OpenAI from 'openai';
import { Document } from '@langchain/core/documents';
import { mutableMapExpressions } from '@/shared/utils';
import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Prisma client
const prisma = new PrismaClient();

// OpenAI embeddings adapter that implements LangChain's Embeddings interface
export class OpenAIEmbeddingsAdapter extends Embeddings {
  private client: OpenAI;

  constructor(params: EmbeddingsParams & { client: OpenAI }) {
    super(params);
    this.client = params.client;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: "text-embedding-3-large",
      input: texts,
    });
    return response.data.map(item => item.embedding);
  }

  async embedQuery(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: "text-embedding-3-large",
      input: text,
    });
    const responseDataEntry = response.data[0];
    if (responseDataEntry === undefined) {
      throw new Error('No embeddings found for query');
    }
    return responseDataEntry.embedding;
  }
}

// Create embeddings adapter instance
const embeddingsAdapter = new OpenAIEmbeddingsAdapter({
  client: openai,
});

// Get batch embeddings from OpenAI
export async function getBatchEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const batchSize = 1000;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const response = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: batch,
      });

      embeddings.push(...response.data.map(item => item.embedding));

      // Add a small delay between large batches to avoid rate limiting
      if (batch.length === batchSize) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return embeddings;
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

    const texts = docs.map(doc => doc.text);
    const embeddings = await getBatchEmbeddings(texts);


    // Store embeddings in database
    for (let i = 0; i < docs.length; i++) {

      const thisDoc = docs[i];


      if (!thisDoc) {
        console.warn('No document found for embedding:', i);
        continue;
      } else {

        await prisma.nodeVectorModel.upsert({
          where: {
            nodeId_content: {
              nodeId: thisDoc.nodeId,
              content: thisDoc.text
            }
          },
          update: {
            embedding: embeddings[i],
            metadata: thisDoc.metadata || {},
            updatedAt: new Date()
          },
          create: {
            nodeId: thisDoc.nodeId,
            content: thisDoc.text,
            embedding: embeddings[i],
            metadata: thisDoc.metadata || {}
          }
        });

      }
    }

    return embeddings.length;
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

// Execute semantic search using PostgreSQL vector similarity
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

    // Get embedding for query
    const queryEmbedding = await embeddingsAdapter.embedQuery(query);

    // Build the SQL query with filters
    let excludeClause = '';
    if (excludeIds.length > 0) {
      excludeClause = `AND "nodeId" NOT IN (${excludeIds.map(id => `'${id}'`).join(',')})`;
    }

    // Execute raw SQL query for vector similarity search
    const results = await prisma.$queryRaw`
      SELECT 
        "nodeId" as id,
        content,
        metadata,
        1 - (embedding <=> ${queryEmbedding}::vector) as score
      FROM "NodeVectorModel"
      WHERE 1 - (embedding <=> ${queryEmbedding}::vector) >= ${minScore}
      ${excludeClause ? excludeClause : ''}
      ORDER BY embedding <=> ${queryEmbedding}::vector
      LIMIT ${k}
    `;

    // Convert results to Document format
    return (results as any[]).map(row => new Document({
      pageContent: row.content,
      metadata: {
        ...row.metadata,
        id: row.id,
        score: row.score
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