# CLAUDE.md

## Directory Summary

Handles user data management, graph operations, and semantic search functionality for the Fosforescent system.

### Dependencies
- **express**: HTTP request/response handling
- **lodash**: Data manipulation utilities
- **@prisma/client**: Database ORM and client
- **@fosforescent/shared/dag-implementation/store**: Core graph store implementation
- **@fosforescent/shared/dag-implementation/expression**: Expression evaluation system
- **@fosforescent/shared/types**: Shared type definitions
- **@fosforescent/shared/utils**: Utility functions
- **openai**: OpenAI API client for embeddings
- **@langchain/core**: LangChain document and embeddings interfaces
- **../util**: Data validation and transformation utilities
- **../clientManager**: Client connection management
- **../prismaClient**: Database connection
- **../pinecone**: Vector database integration (legacy)

### Data Inputs

#### HTTP Requests
- **GET /user-data**: JWT token in Authorization header
- **POST /user-data-partial**: `{data: {fosData: FosContextData, trellisData: TrellisSerializedData}, updatedTime: string}`
- **DELETE /user-data**: JWT token in Authorization header
- **POST /search**: `{route: FosRoute, context: FosContextData, limit?: number, minScore?: number, excludeIds?: string[]}`

#### Database Queries
- **UserModel**: User account data with fosNode relationships
- **FosNodeModel**: Graph nodes and content
- **FosNodeUserAccessLinkModel**: User access permissions to nodes
- **NodeVectorModel**: Vector embeddings for semantic search

#### External APIs
- **OpenAI Embeddings API**: Text-to-vector conversion using text-embedding-3-large model

### Data Outputs

#### HTTP Responses
- **User Data**: `{data: FosContextData, updated: boolean}` - Exported graph context
- **Search Results**: `{results: SearchResult[], total: number}` - Semantic search matches
- **Error Responses**: JSON error messages with HTTP status codes

#### Database Updates
- **FosNodeModel**: Updated graph nodes and relationships
- **NodeVectorModel**: Vector embeddings with metadata
- **UserModel**: Updated user data and timestamps

#### Vector Database
- **Embeddings**: 3072-dimensional vectors stored in PostgreSQL with pgvector extension
- **Metadata**: Node routes, update timestamps, and search metadata

### Events Handled
- **Graph Updates**: User data modifications, node creation/updates
- **Search Operations**: Semantic search queries with vector similarity
- **Data Synchronization**: Client-server data sync with conflict resolution
- **Vector Indexing**: Automatic embedding generation for searchable content
- **Action Execution**: Running actions on updated graph stores

### Data Transformations
- **Database to Store**: `dbToStore()` - PostgreSQL records → FosStore instances
- **Store to Database**: `storeToDb()` - FosStore instances → PostgreSQL records
- **Context Export**: Graph data → JSON serializable format for client
- **Context Import**: Client updates → Graph store updates
- **Text to Vectors**: Node descriptions → 3072-dimensional embeddings via OpenAI
- **Search Results**: Vector similarity → Ranked document results
- **Batch Processing**: Text arrays → Embedding arrays (max 1000 per batch)

### Search & Vector Operations
- **Embedding Generation**: Uses OpenAI text-embedding-3-large model
- **Vector Storage**: PostgreSQL with pgvector extension for cosine similarity
- **Semantic Search**: Query embedding → Similar document retrieval
- **Batch Processing**: Rate-limited embedding generation (100ms delays)
- **Score Filtering**: Configurable minimum similarity threshold (default 0.7)
- **Result Ranking**: Cosine similarity scores for relevance ordering

### Performance Features
- **Incremental Updates**: Only processes changed nodes for vector indexing
- **Rate Limiting**: Delays between large embedding batches
- **Selective Indexing**: Only indexes nodes with descriptions
- **Upsert Operations**: Efficient database updates for existing records
- **Batch Processing**: Groups multiple operations for efficiency

## TODOs