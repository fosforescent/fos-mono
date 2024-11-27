import { Request, Response, NextFunction } from 'express'
import { prisma } from '../prismaClient'
import { createIndexIfNecessary, OpenAIEmbeddingsAdapter, pineconeIndexExists, semanticSearch } from '../pinecone'
import { AppState, FosPath, FosRoute } from '@/shared/types'
import { FosStore } from '@/shared/dag-implementation/store'
import { FosExpression, getExpressionInfo } from '@/shared/dag-implementation/expression'
import OpenAI from 'openai'
import { Pinecone } from '@pinecone-database/pinecone'
import { Document } from '@langchain/core/documents'
import{ mutableMapExpressions, } from '@/shared/utils'

// Initialize the client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
if (!process.env.PINECONE_INDEX) {
  throw new Error('PINECONE_INDEX not set')
}




export async function getBatchEmbeddings(texts: string[]) {
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

export async function processAndUpsertDocuments(
  docs: { text: string; metadata: Record<string, any> }[],
): Promise<number> {
  try {
    if (docs.length === 0) return 0;

    const texts = docs.map(doc => doc.text);
    const embeddings = await getBatchEmbeddings(texts);
    const metadata = docs.map(doc => doc.metadata);
    
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY as string
    });
    
    const index = pinecone.index(process.env.PINECONE_INDEX!);
    const batchSize = 100;
    
    for (let i = 0; i < embeddings.length; i += batchSize) {
      const batch = embeddings.slice(i, i + batchSize);
      const metadataBatch = metadata.slice(i, i + batchSize);
      
      const vectors = batch.map((embedding, idx) => ({
        id: metadata[i + idx]!.id, // Use the node ID as the Pinecone vector ID
        values: embedding,
        metadata: metadataBatch[idx]
      }));
      
      await index.upsert(vectors);
      
      if (batch.length === batchSize) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return embeddings.length;
  } catch (error) {
    console.error('Error in processAndUpsertDocuments:', error);
    throw error;
  }
}


if (!process.env.PINECONE_INDEX) {
  throw new Error('PINECONE_INDEX not set')
}

interface SearchResult {
  nodeId: string;
  score: number;
  description: string;
  metadata: Record<string, any>;
}



// export const executeSearch = async (nodeRoute: FosRoute, context: AppState["data"]) => {
//   try {
//     const store = new FosStore(context);
//     const expression = new FosExpression(store, nodeRoute);
//     const { nodeDescription } = expression.getExpressionInfo();
    
//     if (!nodeDescription) {
//       console.warn('No node description available for search');
//       return [];
//     }

//     const results = await semanticSearch(process.env.PINECONE_INDEX!, nodeDescription);
//     return results;
//   } catch (error) {
//     console.error('Error in executeSearch:', error);
//     throw error;
//   }
// }
export const executeSearch = async (
  expression: FosExpression,
  options: {
    limit?: number;
    minScore?: number;
    excludeIds?: string[];
  } = {}
): Promise<SearchResult[]> => {
  try {
    const { nodeDescription, nodeRoute } = expression.getExpressionInfo();
    
    if (!nodeDescription) {
      console.warn('No node description available for search');
      return [];
    }

    const {
      limit = 20,
      minScore = 0.7, // Minimum similarity score (0-1)
      excludeIds = []
    } = options;

    // Get search results
    const searchResults = await semanticSearch(
      process.env.PINECONE_INDEX!, 
      nodeDescription,
      {
        k: limit,
        excludeIds,
      }
    );

    // Transform and filter results
    const results =  processSearchResults(searchResults, expression.store.exportContext([]), minScore);


    results.forEach(result => {
      const { nodeId, score, description } = result;
      console.log(`Node ID: ${nodeId}, Score: ${score}, Description: ${description}`);
      // const searchResult = expression.store.createExpression(nodeRoute, )
    });
    
    return results;



  } catch (error) {
    console.error('Error in executeSearch:', error);
    throw error;
  }
}

function processSearchResults(
  results: Document[],
  context: AppState["data"],
  minScore: number
): SearchResult[] {
  return results
    .filter(result => {
      // Filter out results below minimum score
      const score = result.metadata.score || 0;
      return score >= minScore;
    })
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

export const upsertSearchTerms = async (store: FosStore): Promise<boolean> => {
  try {
    await createIndexIfNecessary(process.env.PINECONE_INDEX!)

    type UpsertObject = {
      metadata: Record<string, any>;
      text: string;
    }

    const itemsMap = mutableMapExpressions<UpsertObject>(store.exportContext([]), (resultMap, expression) => {
      const { nodeId, nodeDescription, nodeRoute, nodeData } = expression.getExpressionInfo();
      if (nodeDescription) {
        resultMap.set(nodeRoute, {
          metadata: {
            id: nodeId,
            route: nodeRoute,
            updatedAt: nodeData.updated?.time,
          },
          text: nodeDescription
        })
      }
    });

    const items = [...itemsMap.values()];
    
    if (items.length === 0) {
      console.warn('No valid items found to upsert');
      return false;
    }

    const processedCount = await processAndUpsertDocuments(items);
    console.log(`Successfully processed ${processedCount} documents`);
    return true;

  } catch (error) {
    console.error('Error in upsertSearchTerms:', error);
    return false;
  }
}

// export const upsertSearchTerms = async (context: AppState["data"]): Promise<boolean> => {
//   try {
//     await createIndexIfNecessary(process.env.PINECONE_INDEX!)

//     const items = Object.entries(context.fosData.nodes)
//       .filter(([_, node]) => node?.data.description?.content) // Filter out nodes without descriptions
//       .map(([id, node]) => ({
//         metadata: {
//           id,
//           // Add any additional metadata fields you want to store
//         },
//         text: node.data.description!.content
//       }));

//     if (items.length === 0) {
//       console.warn('No valid items found to upsert');
//       return false;
//     }

//     const processedCount = await processAndUpsertDocuments(items, process.env.PINECONE_INDEX!);
//     console.log(`Successfully processed ${processedCount} documents`);
//     return true;

//   } catch (error) {
//     console.error('Error in upsertSearchTerms:', error);
//     return false;
//   }
// }

