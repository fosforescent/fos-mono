# Backend CLAUDE.md

## Directory Summary
The backend directory contains the Node.js/Express API server that provides the core functionality for Fosforescent. It handles authentication, data management, graph operations, subscriptions, and is the always-on account peer for the web, desktop and CLI clients.

## Key Components

### Core API Files
- `index.ts` - Main server entry point and Express app configuration
- `auth/` - Authentication system (JWT, registration, login, password reset)
- `subscription/` - Stripe payment and subscription handling
- `email/` - Email service integration (Postmark)
- `mcp/` - Model Context Protocol server and client implementations
- `voice/voiceNotes.ts` - `POST /user/data/voice-notes` (raw audio body ≤ 25 MB): transcription, hierarchical summary (chunks → summaries → summary), sentiment/topic clusters as JSON. Provider: **Gemini on Vertex AI** by default (`geminiVoiceDeps`, model `VOICE_GEMINI_MODEL` = gemini-2.5-flash, location `VERTEX_LOCATION`/`GCP_REGION`; auth is the Cloud Run service account's `roles/aiplatform.user`, locally application-default credentials); `VOICE_PROVIDER=openai` switches to OpenAI (`OPENAI_API_KEY`). Spend is metered from token counts (`VOICE_PRICE_TEXT_IN/AUDIO_IN/OUT` USD per 1M tokens) and recorded per user as `TokenTransactionModel` debits (description `Voice note …`, `metadata.usd`; `ToolUseModel` is unusable because its `toolUseId` is a foreign key to a bid session); users without an active subscription (`subscription_status` active/trialing/past_due, or admins) get `VOICE_FREE_BUDGET_USD` (default 1.00) in total, then 402. Deps are injectable (`createVoiceNoteHandler(deps, usage)`), tests mock them
- `search/rowIndex.ts` + `search/routes.ts` - semantic search over rows and the market. `indexStore` embeds every row of a user's store (Vertex `text-embedding-005`, 768 dims, table `RowEmbeddingModel` with a pgvector column written through raw SQL; hash-based upsert, vanished rows deleted) and runs debounced after each `saveStore` in `sync/accountStore.ts` (`ROW_INDEX_DELAY_MS`, `ROW_INDEX_DISABLED=true` to turn off). Routes (user JWT): `POST /user/data/search {query, market, limit}`, `POST /user/data/search/reindex`, `GET /user/data/market/node?owner=&id=` (a listed node, or one the requester is a member of, with proposals filtered to the requester's own), `POST /user/data/market/proposals {owner, aliasId, rows}` (the requester's branch recorded as a proposal `user:<name>` on the owner's node under the owner's lock; `rows[].id` lets a supply reference an allocation sent in the same proposal; `requirement` rows are accepted so an allocation bin travels whole). Both market routes open a node to accounts the owner made members with `edit` (`hasCapability`), not only listed nodes; a listing is the `fos:listing` node value (`shared/sync/market.ts`), written only by the `market` effect. Design: `docs/sync.md`, "Requirements, resource banks, queries and the market"
- `integrations/` - integration peers: `providers.ts` (registry: OAuth GitHub/Google/Discord, platform Stripe, the phone channel), `secrets.ts` (AES-GCM token storage under `INTEGRATION_SECRET`, signed OAuth state, phone codes), `routes.ts` (`GET /user/integrations`, `:provider/start`, public `/integrations/:provider/callback`, `DELETE :provider`, `phone` + `phone/verify`; `createIssue` (GitHub) and `createCalendarEvent` (Google) are the functions the registry effects call, there are no routes per handler; `notifyUser` texts a linked phone; `prismaIntegrationDeps`), `store.ts` (a user's tree as a replica for edits: `editTree`, `walkRows`), `mcpPeers.ts` (MCP servers as peers: `GET /user/data/mcp-peers`, `attach` makes a server a member `mcp:<id>` advertising `tool`; `mcpToolHandler` is the registry effect that runs `-tool` requirements on `complete` (binding in `prepare`, call in `effect`); `runOpenToolRequests` listens after saves when `MCP_LISTEN=true` via `afterSaveHooks`). Tests: `routes.test.ts`, `mcpPeers.test.ts` (dependency-injected, no network). Model: `IntegrationConnectionModel`.
- `channels/textCommands.ts` - texted commands as an adapter of the event grammar: a linked sender's "done <words>", "list" or new row become `search`/`submit`/`read` events for that account's owner (`createTextCommandInbound`, wired to every channel source in `index.ts`; only phones are linked to accounts today)
- `channels/sms.ts` - Twilio SMS adapter (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`): outbound through the Messages API, inbound `POST /channels/sms/webhook` (form-encoded, `X-Twilio-Signature` verified against `API_URL`).
- `sync/registry.ts` + `sync/hostHandlers.ts` - the handler registry: which capabilities this host (`fos`: search as a route; `market` (lists the task, indexes, records the supply), `poll` (resolves a choice from the tally), `points` (pays a `-ff` requirement on the token ledger, one idempotent transfer per requirement), `send-payment` (opens a Stripe payment for a `-$` requirement and waits; the webhook settles it through `sync/payments.ts` and resumes the evaluation; only with `STRIPE_TOKEN`) and `llm` as effects; `cron` only with `FOS_ENABLE_CRON`) and the peers it fronts (`integration:github` → repo effect, `integration:google` → calendar effect, `mcp:*` → tool effect, `integration:phone` → notify) actually have. Effects run through `complete` events only; an effect may answer `'pending'` (the llm handler does) and the evaluation pauses as `awaiting-review` until the owner accepts the proposal. Everything advertised is derived from it: `capabilities` in every sync and node-provider response (`SERVER_TRANSPORT_CAPABILITIES` + registered fos services), the fos/integration member offers written into each account's Home (`ensureHomeContext(..., registry.hostOffers())`), and `provides` in `GET /user/integrations`. Handlers with an `effect` run through `sync/evaluation.ts`; the rest are services reached by their own routes. Add a handler here, never a capability constant.
- `channels/` - chat channels inside this process (formerly the standalone `event-services`): `GET/POST /channels/whatsapp/webhook` (Meta verification, optional `X-Hub-Signature-256` check, text messages → bus), a discord.js gateway bot, `GET /channels/health`. `channelBus.onInbound(handler)` receives `InboundMessage`s, `channelBus.send({destination, to, text})` replies; inbound messages are mirrored to `PUBSUB_INBOX_TOPIC` when set; `CHANNELS_ECHO=true` echoes for smoke tests. Env: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `DISCORD_TOKEN` (set on Cloud Run with `gcloud run services update --update-secrets`). The Discord gateway is a persistent socket: it needs min instances ≥ 1 and CPU always allocated, which the dev Cloud Run service does not have today
- `util.ts` - `dbToStore`/`storeToDb`; loads migrate older cid formats, saves add only missing access links (the link table has no unique constraint, so re-creating links on every save used to duplicate them and slow every load)
- `auth/deviceLogin.ts` - browser sign-in for a device without a browser (the `fos` CLI): `POST /auth/device/start` → code + verify URL, `GET /auth/device/poll`; the signed-in web app calls `GET|POST /user/data/device-login/:code[/approve|/deny]`; in-memory, 10-minute codes, grants a normal user JWT (so SSO in the web app signs the CLI in too)
- `sync/provideNode.ts` - `POST /user/data/peer-sync/provide-node` (node-provider, the only sync route: every device, peer and the `fos` CLI sync node by node through it; owners get Home made sure of, `ensureAccountContext`, and every answer carries the account's `presence`; with `owner` in the body, another account's node served to a signed-in user as that account's peer `user:<me>`, propose-only) and `GET /user/data/peer-sync/locate?owner=&id=` (where a shared node lives and the grants there). `sync/events.ts` takes `owner` the same way (`principalOf`), so read/submit/complete run as `user:<me>` on the owner's store; `complete` runs the owner's registry when they granted `execute`.
- `sync/hostHandlers.ts` `mailHandler` - the fos `mail` effect: a `-mail someone@example.com Subject` requirement under a task emails that address (Postmark, `sendPlainEmail`, from `EMAIL_FROM`) with the task and its rows as the body, on the account's behalf, and records the supply as `fos`.
- `sync/peerInvites.ts` - invite tokens (`/user/data/peer-invite*`, public `/peer/connect*`) that grant scoped peer JWTs (`kind: 'peer'`, confined by `verifyJwt.ts` to peer-sync); table `PeerInviteModel`
- `sync/accountStore.ts` - loading and saving an account's store (`dbToStore`/`storeToDb`, one request at a time per account `withUserLock`, `AccountStoreDeps`), where a device attaches (`GET/DELETE /user/data/peer-sync/attachment`), re-indexing and `afterSaveHooks` after a save, nudging other devices over WebSocket (`sendToUser` in `promptNotifications.ts`). The `/user/data/peer-sync/*` prefix is the namespace peer credentials may use; sync itself is node exchange (`provideNode.ts`)

### Graph System Integration
- `embedding.ts` - embeddings for the MCP server registry (same Vertex model and pgvector layout as `search/rowIndex.ts`)
- `userDirectory.ts` - `GET /groups/search/name|email`: find Fos accounts for the web's peer search
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
- **Stripe**: Payment processing (API version 2024-10-28.acacia)
- **Postmark**: Email service
- **JWT**: Authentication tokens
- **Vertex AI (Gemini, text-embedding-005)**: voice notes, the server's own `llm` handler and row embeddings; OpenAI is an optional voice provider
- **bcrypt**: Password hashing

### Internal Dependencies
- `shared/` - Core graph types and implementations
- `prisma/` - Database schema and client

## Data Inputs/Outputs

### Input Sources
- HTTP requests from the web app, the `fos` binary and MCP agents
- Webhook events from Stripe
- Email webhook events from Postmark
- Database queries via Prisma
- AI model responses from OpenAI

### Output Destinations
- JSON API responses
- Database writes via Prisma
- Email sends via Postmark
- Row embeddings into PostgreSQL (pgvector)
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
- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `DISCORD_TOKEN`, `CHANNELS_ECHO` - chat channels (optional; adapters without credentials stay off)
- `GCP_PROJECT_ID`, `VERTEX_LOCATION`, `EMBEDDING_MODEL` - Vertex embeddings for row search (service account on Cloud Run; locally `GOOGLE_APPLICATION_CREDENTIALS` must point at a valid credential)
- `WEB_URL` (falls back to `FRONTEND_URL`) - where the web app lives; used for the device sign-in verify URL

## Testing
- Unit tests with Jest framework
- API endpoint testing
- Database integration tests
- Authentication flow testing

## TODOs

### Infrastructure & Deployment
- [ ] Optimize Docker build for faster deployments (currently npm install is slow)
- [ ] Add monitoring and health check endpoints
- [ ] Implement backup and recovery procedures

### Development & Quality
- [ ] Implement comprehensive API documentation
- [ ] Add comprehensive logging system
- [ ] Optimize database queries with caching
- [ ] Implement API versioning strategy
- [ ] Add batch processing optimization for large vector operations

### Completed Recently
- [x] Fixed all TypeScript compilation errors (100+ → 0)
- [x] Implemented parameter validation utility pattern
- [x] Fixed Express middleware type compatibility
- [x] Added missing database schema fields for Stripe integration
## Graph evaluation and cron
`sync/events.ts` adapts HTTP, MCP and the WebSocket to the event grammar; an `invite` event also delivers the node into the invitee's Home (`ensureMemberLink`) when the registry advertises `relay`. `sync/evaluation.ts` runs owner evaluations (`runNode`, reached through a `complete` event, and `runCron`). It checks the submitted content version and branch selections under the existing per-user load/save lock, then uses the shared evaluator with the handler registry as its driver. The journal is saved before dispatch; uncertainty becomes manual recovery rather than a duplicate retry. Invited peer credentials cannot initiate account integration effects: their `complete` becomes an evaluation request (see `shared/sync/events.ts`).

`sync/cron.ts` is opt-in with `FOS_ENABLE_CRON=true`. **Run only on one always-on backend instance**: the existing per-user store lock is process-local. The runner scans paginated accounts every 30 seconds, claims occurrences in the graph, and uses the same evaluator. It checks the current UTC minute, has no missed-run catch-up, and uses the server's default branch selections. The flag is deliberately off for the default autoscaled deployment; the server advertises `cron` only when enabled. A distributed scheduler/lease is still required before enabling this on multiple instances or a scale-to-zero service.

`util.ts` now advances the visible account root with an atomic compare-and-swap against the version observed by `dbToStore` (`sync/storeVersion.ts`). A stale writer cannot overwrite another instance's commit, and a rejected evaluation claim cannot dispatch effects. If another instance changes the tree during an external effect, the attempt remains uncertain and requires recovery; it is not automatically repeated. Integration HTTP calls have a 15-second deadline, evaluation stops starting work after two minutes, and recovery of an interrupted run waits three minutes from its start.

## Public node input
`sync/sharing.ts` serves audience-scoped node projections at `/public/node/visit` and `/public/node/input`; signed-in visitors use `/user/data/sharing/visit` and `/user/data/sharing/input`. Only the owning account can configure `/user/data/sharing`. Settings, poll handlers and participation use existing named typed refs and member edges. Poll responses are tallied for display and resolve the choice only when the owner runs the node (the fos `poll` effect); the last input of a template execution evaluates it through the host's registry (`runNode`), outside the request's locks. Anonymous receipts use a separate derived signing key and cannot authenticate account sync. Poll names are display labels, not verified identities.

Signed-in visitors get a host-peer container and foreign reference under Home. Their input and local source links stay in their own account; the host stores an allowlisted projection plus a reference to that participation state. Anonymous input is owned by the host. Approvals/rankings record input and never call proposal merge. Poll ballots are versioned; changed options invalidate earlier totals, and resubmission replaces the visitor's prior input. Only declared unbound text slots and direct allocation requirements are exposed as fields. Source projections refresh on submission, not continuously. Links currently address a node by account/path and support the default context; branch-specific links are not supported. Cross-account writes use deterministic refs and sorted per-account locks but are not a distributed transaction: guest intent may remain after a failed host save and can be resubmitted.

## The event grammar (`sync/events.ts`)
Every input surface is an adapter of `shared/sync/events.ts`: `POST /user/data/events` (`{event, scope?}`), `POST /user/data/peer-sync/mcp` (JSON-RPC through `shared/sync/mcp-adapter.ts`; owners pass `?scope=[…]`, peers use their signed attachment) and the WebSocket `{type:'event'}` message all build the same principal from the JWT claims and call `dispatchEvent` under the user's store lock; `complete` hands the authorized request to `createEvaluationService.runNode` after releasing the lock. Invited peers are bounded by their signed scope; every operation checks live membership, link masks, branch selections and explicit child restrictions; peers' submissions are proposals, their completions are evaluation requests. No endpoint accepts raw CIDs or graph writes. Tests: `sync/events.test.ts` (the former task-tree MCP tests), `channels/textCommands.test.ts`.

### Media notes
The existing authenticated `/user/data/voice-notes` pipeline also accepts JPEG/PNG/WebP images and MP4/WebM videos, bounded to 25 MB. It returns the same summary/cluster/source-text structure and uses the existing account usage budget (`VoiceUsageModel`, one row per transcription, summed in USD against `VOICE_FREE_BUDGET_USD`; never the fos-points ledger). Gemini handles images and videos; the OpenAI implementation handles images and explicitly rejects video. Picture/video originals are not stored by this endpoint. Provider calls need live-provider validation in addition to the mocked handler tests.

## Standard library (2026-10-17)

- `library.ts` creates the system account `FOS_LIBRARY_OWNER` (default `fos-library`, unusable password); `sync/library.ts` `ensureStandardLibrary` runs at startup (index.ts `server.listen`): the `fos:library` node in that account's Home, shared with the `users` audience (read, edit, rank), merge policy (two approvals), seed templates; the address lands on `registry.library`.
- `ensureAccountContext` (provide-node owner path) = `ensureHomeContext` with the host's offers. The library is not linked into accounts: devices ship it, contributors link it themselves.
- `sync/sharing.ts` `submit` applies the node's merge policy after recording a vote (`applyMergePolicy`), so library proposals merge at the threshold. Tests: `sync/library.test.ts`.
- There is no public route for the library: client builds pull it through the `fos` CLI (`fos library export`, the node-provider protocol as the signed-in user).
