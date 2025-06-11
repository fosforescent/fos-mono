# Backend CLAUDE.md

## Directory Summary
The backend directory contains the Node.js/Express API server that provides the core functionality for Fosforescent. It handles authentication, data management, graph operations, subscriptions, and serves as the bridge between the frontend and the database.

## Key Components

### Core API Files
- `index.ts` - Main server entry point and Express app configuration
- `auth/` - Authentication system (JWT, registration, login, password reset)
- `data/` - Data management and search functionality
- `subscription/` - Stripe payment and subscription handling
- `email/` - Email service integration (Postmark)
- `mcp/` - Model Context Protocol server and client implementations

### Graph System Integration
- `qdrant.ts` - Qdrant vector database integration for semantic search  
- `embedding.ts` - Vector embedding generation using OpenAI
- Integration with `shared/dag-implementation/` for graph operations
- `prismaClient.ts` - Database client configuration

### API Token & Billing
- `apiTokens.ts` - API token management for external access
- `tokenManager.ts` - Token balance and usage tracking
- `toolBidManager.ts` - Tool bidding system for cost optimization
- `toolUsage.ts` - Tool usage tracking and billing

### Security & Middleware
- `adminAuth.ts` - Admin authentication middleware
- `apiTokenAuth.ts` - API token authentication
- `verifyJwt.ts` - JWT verification utilities
- `maxRequests.ts` - Rate limiting middleware
- `utils/validation.ts` - Parameter validation utilities for type safety

## Dependencies

### External Dependencies
- **Express 4.x**: Web framework for API endpoints (compatible types)
- **Prisma**: ORM for database operations
- **Qdrant**: Vector database for semantic search
- **Stripe**: Payment processing (API version 2024-10-28.acacia)
- **Postmark**: Email service
- **JWT**: Authentication tokens
- **OpenAI**: AI model integration and embeddings
- **bcrypt**: Password hashing

### Internal Dependencies
- `shared/` - Core graph types and implementations
- `prisma/` - Database schema and client

## Data Inputs/Outputs

### Input Sources
- HTTP requests from frontend application
- Webhook events from Stripe
- Email webhook events from Postmark
- Database queries via Prisma
- AI model responses from OpenAI

### Output Destinations
- JSON API responses to frontend
- Database writes via Prisma
- Email sends via Postmark
- Vector embeddings to Qdrant database
- WebSocket messages for real-time updates

## Events Handled
- User authentication (login, register, password reset)
- Graph node creation and updates
- Search queries with vector similarity
- Subscription management and billing
- Tool execution and cost tracking
- Admin operations and user management

## Data Transformations
- Password hashing with bcrypt
- JWT token generation and verification
- Vector embedding generation from text content
- Stripe webhook event processing
- Graph node serialization/deserialization
- API response formatting and error handling

## Build Configuration

### Development
- Uses `tsx` for TypeScript execution without compilation
- `nodemon` for hot reloading during development
- Environment variables loaded via `dotenv`

### Production (Docker)
- Multi-stage Docker build in `Dockerfile`
- TypeScript compilation with `tsc`
- Optimized Node.js runtime environment
- Exposes port 80 for production deployment

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `STRIPE_TOKEN` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook verification
- `OPENAI_API_KEY` - OpenAI API access for embeddings
- `POSTMARK_API_TOKEN` - Email service token
- `QDRANT_URL` - Qdrant vector database URL (default: http://localhost:6333)
- `QDRANT_API_KEY` - Qdrant API key (optional for local development)

## Testing
- Unit tests with Jest framework
- API endpoint testing
- Database integration tests
- Authentication flow testing

## Build Status
- ✅ **Frontend: Building successfully**
- ✅ **Backend: Building successfully with ZERO TypeScript errors** 
- ✅ Fixed Express 4.x type compatibility issues
- ✅ Migrated from pgvector to Qdrant for vector search
- ✅ Added comprehensive parameter validation utilities
- ✅ Fixed all MCP (Model Context Protocol) type issues
- ✅ Added missing Stripe database fields and relationships

## TODOs

### Infrastructure & Deployment
- [ ] Optimize Docker build for faster deployments (currently npm install is slow)
- [ ] Add monitoring and health check endpoints
- [ ] Implement backup and recovery procedures
- [ ] Add Qdrant collection monitoring and health checks

### Development & Quality
- [ ] Implement comprehensive API documentation
- [ ] Add comprehensive logging system
- [ ] Optimize database queries with caching
- [ ] Implement API versioning strategy
- [ ] Add batch processing optimization for large vector operations

### Completed Recently
- [x] **Added Qdrant server to docker-compose and injected via env vars into the logic**
- [x] **Integrated Qdrant client with automatic collection initialization**
- [x] **Migrated semantic search from PostgreSQL to Qdrant vector database**
- [x] **Updated data processing pipeline to use Qdrant batch operations**
- [x] Fixed all TypeScript compilation errors (100+ → 0)
- [x] Implemented parameter validation utility pattern
- [x] Fixed Express middleware type compatibility
- [x] Added missing database schema fields for Stripe integration