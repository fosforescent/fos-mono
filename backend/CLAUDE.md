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
- `mcp/temporalMcpServer.ts` - Temporal MCP server for long-running task management
- `voice/voiceNotes.ts` - `POST /user/data/voice-notes` (raw audio body ≤ 25 MB): transcription, hierarchical summary (chunks → summaries → summary), sentiment/topic clusters as JSON. Provider: **Gemini on Vertex AI** by default (`geminiVoiceDeps`, model `VOICE_GEMINI_MODEL` = gemini-2.5-flash, location `VERTEX_LOCATION`/`GCP_REGION`; auth is the Cloud Run service account's `roles/aiplatform.user`, locally application-default credentials); `VOICE_PROVIDER=openai` switches to OpenAI (`OPENAI_API_KEY`). Spend is metered from token counts (`VOICE_PRICE_TEXT_IN/AUDIO_IN/OUT` USD per 1M tokens) and recorded per user as `TokenTransactionModel` debits (description `Voice note …`, `metadata.usd`; `ToolUseModel` is unusable because its `toolUseId` is a foreign key to a bid session); users without an active subscription (`subscription_status` active/trialing/past_due, or admins) get `VOICE_FREE_BUDGET_USD` (default 1.00) in total, then 402. Deps are injectable (`createVoiceNoteHandler(deps, usage)`), tests mock them
- `search/rowIndex.ts` + `search/routes.ts` - semantic search over rows and the market. `indexStore` embeds every row of a user's store (Vertex `text-embedding-005`, 768 dims, table `RowEmbeddingModel` with a pgvector column written through raw SQL; hash-based upsert, vanished rows deleted) and runs debounced after each `saveStore` in `sync/peerSync.ts` (`ROW_INDEX_DELAY_MS`, `ROW_INDEX_DISABLED=true` to turn off). Routes (user JWT): `POST /user/data/search {query, market, limit}`, `POST /user/data/search/reindex`, `GET /user/data/market/node?owner=&id=` (a listed node with proposals filtered to the requester's own), `POST /user/data/market/proposals {owner, aliasId, rows}` (the requester's branch recorded as a proposal `user:<name>` on the owner's node under the owner's lock; `rows[].id` lets a supply reference an allocation sent in the same proposal; `requirement` rows are accepted so an allocation bin travels whole). Both market routes open a node to accounts the owner made members with `edit` (`hasCapability`), not only listed nodes. Design: `docs/sync.md`, "Requirements, resource banks, queries and the market"
- `sync/peerSync.ts` reports `SERVER_CAPABILITIES` (http, ws, relay, search, market, mail) in every sync response as what this server registers with the device (`capabilities`), next to `presence`.
- `channels/` - chat channels inside this process (formerly the standalone `event-services`): `GET/POST /channels/whatsapp/webhook` (Meta verification, optional `X-Hub-Signature-256` check, text messages → bus), a discord.js gateway bot, `GET /channels/health`. `channelBus.onInbound(handler)` receives `InboundMessage`s, `channelBus.send({destination, to, text})` replies; inbound messages are mirrored to `PUBSUB_INBOX_TOPIC` when set; `CHANNELS_ECHO=true` echoes for smoke tests. Env: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `DISCORD_TOKEN` (set on Cloud Run with `gcloud run services update --update-secrets`). The Discord gateway is a persistent socket: it needs min instances ≥ 1 and CPU always allocated, which the dev Cloud Run service does not have today
- `util.ts` - `dbToStore`/`storeToDb`; loads migrate older cid formats, saves add only missing access links (the link table has no unique constraint, so re-creating links on every save used to duplicate them and slow every load)
- `auth/deviceLogin.ts` - browser sign-in for a device without a browser (the `fos` CLI): `POST /auth/device/start` → code + verify URL, `GET /auth/device/poll`; the signed-in web app calls `GET|POST /user/data/device-login/:code[/approve|/deny]`; in-memory, 10-minute codes, grants a normal user JWT (so SSO in the web app signs the CLI in too)
- `sync/peerInvites.ts` - invite tokens (`/user/data/peer-invite*`, public `/peer/connect*`) that grant scoped peer JWTs (`kind: 'peer'`, confined by `verifyJwt.ts` to peer-sync); table `PeerInviteModel`
- `sync/peerSync.ts` - `POST/GET /user/data/peer-sync` (+ `/attachment`): user-group side of the offline/online sync (`shared/sync`, `docs/sync.md`); merges into the user's FosStore via `dbToStore`/`storeToDb`, serializes per user, nudges other devices over WebSocket (`sendToUser` in `promptNotifications.ts`)

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
- Deployed by `.github/workflows/deploy-backend.yml` on push to `main` (image → gcr.io → Cloud Run `fos-backend-dev`, schema via `prisma db push`); see `infra/CLAUDE.md`
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
- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `DISCORD_TOKEN`, `CHANNELS_ECHO` - chat channels (optional; adapters without credentials stay off)
- `GCP_PROJECT_ID`, `VERTEX_LOCATION`, `EMBEDDING_MODEL` - Vertex embeddings for row search (service account on Cloud Run; locally `GOOGLE_APPLICATION_CREDENTIALS` must point at a valid credential)
- `WEB_URL` (falls back to `FRONTEND_URL`) - where the web app lives; used for the device sign-in verify URL

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
- [x] **Added Temporal.io integration with complete MCP server for long-running tasks**
- [x] **Integrated Temporal MCP server with actual Temporal workflows and workers**
- [x] Fixed all TypeScript compilation errors (100+ → 0)
- [x] Implemented parameter validation utility pattern
- [x] Fixed Express middleware type compatibility
- [x] Added missing database schema fields for Stripe integration