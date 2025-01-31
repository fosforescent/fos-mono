import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import OpenAI from "openai";
import { Document } from '@langchain/core/documents';
import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings';

export const maxDuration = 300;

// Type definitions
interface PineconeDocument {
  id: string;
  values: number[];
  metadata: Record<string, any>;
}

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
    if (!responseDataEntry || !responseDataEntry.embedding) {
        throw new Error('Failed to embed query');
    }
    return responseDataEntry.embedding;
  }
}

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY as string
});

// Create embeddings adapter instance with required params
const embeddingsAdapter = new OpenAIEmbeddingsAdapter({
  client: openai,
//   stripNewLines: true, // Required param from EmbeddingsParams
});

export async function upsertEmbeddings(
  indexName: string,
  embeddings: number[][],
  metadata: Record<string, any>[]
): Promise<void> {
  try {
    // Ensure metadata is not undefined and has required structure
    const upserts: PineconeDocument[] = embeddings.map((embedding, index) => ({
      id: `doc-${index}`,
      values: embedding,
      metadata: metadata[index] || {}, // Provide empty object as fallback
    }));

    const index = pinecone.index(indexName);
    await index.upsert(upserts);
  } catch (error) {
    console.error('Error upserting embeddings:', error);
    throw new Error('Failed to upsert embeddings');
  }
}

export async function resetIndex(indexName: string): Promise<void> {
  try {
    const exists = await pineconeIndexExists(indexName);
    if (exists) {
      await deleteIndex(indexName);
    }
    await createIndexIfNecessary(indexName);
  } catch (error) {
    console.error('Error resetting index:', error);
    throw new Error('Failed to reset index');
  }
}

async function deleteIndex(indexName: string): Promise<void> {
  try {
    await pinecone.deleteIndex(indexName);
  } catch (error) {
    console.error('Error deleting index:', error);
    throw new Error('Failed to delete index');
  }
}

export async function createIndexIfNecessary(indexName: string): Promise<void> {
  try {
    const exists = await pineconeIndexExists(indexName);
    if (!exists) {
      await pinecone.createIndex({
        name: indexName,
        dimension: 1024,
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          }
        },
        waitUntilReady: true,
        suppressConflicts: true
      });
    }
  } catch (error) {
    console.error('Error creating index:', error);
    throw new Error('Failed to create index');
  }
}

export async function pineconeIndexHasVectors(indexName: string): Promise<boolean> {
  try {
    const targetIndex = pinecone.index(indexName);
    const stats = await targetIndex.describeIndexStats();
    return Boolean(stats.totalRecordCount && stats.totalRecordCount > 0);
  } catch (error) {
    console.error('Error checking Pinecone index for vectors:', error);
    return false;
  }
}

export async function pineconeIndexExists(indexName: string): Promise<boolean> {
  try {
    const { indexes } = await pinecone.listIndexes();
    return indexes?.some(index => index.name === indexName) ?? false;
  } catch (error) {
    console.error('Error checking if Pinecone index exists:', error);
    return false;
  }
}

interface SearchOptions {
    k?: number;
    includeIds?: string[];  // IDs to include in search
    excludeIds?: string[];  // IDs to exclude from search
    fetchK?: number;        // How many results to fetch before MMR (default 2 * k)
  }
  

export async function semanticSearch(
  indexName: string,
  queryText: string,
  options: SearchOptions = {}
): Promise<Document[]> {
  try {
    const {
      k = 20,
      includeIds,
      excludeIds,
      fetchK = k * 2
    } = options;

    // Build metadata filter
    let filter = {};
    
    if (includeIds && includeIds.length > 0) {
      filter = {
        id: { $in: includeIds }
      };
    }
    
    if (excludeIds && excludeIds.length > 0) {
      filter = {
        id: { $nin: excludeIds },
        ...filter
      };
    }

    // Initialize PineconeStore with our adapter
    const vectorStore = await PineconeStore.fromExistingIndex(
      embeddingsAdapter,
      {
        pineconeIndex: pinecone.index(indexName),
      }
    );

    // Perform MMR search with filter
    const results = await vectorStore.maxMarginalRelevanceSearch(queryText, {
      k,
      fetchK,
      filter // Apply the filter to the search
    });

    // Remove duplicates based on metadata.id
    return results.filter((result, index) => 
      index === results.findIndex(r => r.metadata.id === result.metadata.id)
    );
  } catch (error) {
    console.error('Error performing semantic search:', error);
    throw new Error('Failed to perform semantic search');
  }
}

// Example usage functions:

export async function searchWithinIds(
  indexName: string,
  queryText: string,
  ids: string[],
  limit: number = 20
): Promise<Document[]> {
  return semanticSearch(indexName, queryText, {
    k: limit,
    includeIds: ids
  });
}

export async function searchExcludingIds(
  indexName: string,
  queryText: string,
  excludedIds: string[],
  limit: number = 20
): Promise<Document[]> {
  return semanticSearch(indexName, queryText, {
    k: limit,
    excludeIds: excludedIds
  });
}
  
// More complex filtering example
export async function advancedFilteredSearch(
  indexName: string,
  queryText: string,
  options: {
    mustIncludeIds?: string[];
    excludeIds?: string[];
    categoryFilter?: string;
    dateRange?: {
      start: Date;
      end: Date;
    };
    limit?: number;
  }
): Promise<Document[]> {
  try {
    const vectorStore = await PineconeStore.fromExistingIndex(
      embeddingsAdapter,
      {
        pineconeIndex: pinecone.index(indexName),
      }
    );

    // Build complex filter
    const filter: Record<string, any> = {};

    if (options.mustIncludeIds?.length) {
      filter.id = { $in: options.mustIncludeIds };
    }

    if (options.excludeIds?.length) {
      filter.id = { ...filter.id, $nin: options.excludeIds };
    }

    if (options.categoryFilter) {
      filter.category = options.categoryFilter;
    }

    if (options.dateRange) {
      filter.timestamp = {
        $gte: options.dateRange.start.toISOString(),
        $lte: options.dateRange.end.toISOString()
      };
    }

    // Perform search with complex filter
    const results = await vectorStore.maxMarginalRelevanceSearch(queryText, {
      k: options.limit || 20,
      fetchK: (options.limit || 20) * 2,
      filter
    });

    return results.filter((result, index) => 
      index === results.findIndex(r => r.metadata.id === result.metadata.id)
    );
  } catch (error) {
    console.error('Error performing advanced filtered search:', error);
    throw new Error('Failed to perform advanced filtered search');
  }
}