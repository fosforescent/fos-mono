# Backend CLAUDE.md

## Directory Summary
The backend directory contains the Node.js/Express API server that provides the core functionality for Fosforescent. It handles authentication, data management, graph operations, subscriptions, and is the always-on account peer for the web, desktop and CLI clients.

## Key Components

### Core API Files
- `index.ts` - Main server entry point and Express app configuration
- `auth/` - Authentication system (JWT, registration, login, password reset)
- `subscription/` - Stripe payment and subscription handling
- `email/` - Email service integration (Postmark)
- `mcp/` - `mcpClient.ts` + `mcpTypes.ts`: the MCP client the MCP peers use (`integrations/mcpPeers.ts`)
- `voice/voiceNotes.ts` - `POST /user/data/voice-notes` (raw audio body ≤ 25 MB): transcription, hierarchical summary (chunks → summaries → summary), sentiment/topic clusters as JSON. Provider: **Gemini on Vertex AI** by default (`geminiVoiceDeps`, model `VOICE_GEMINI_MODEL` = gemini-2.5-flash, location `VERTEX_LOCATION`/`GCP_REGION`; auth is the Cloud Run service account's `roles/aiplatform.user`, locally application-default credentials); `VOICE_PROVIDER=openai` switches to OpenAI (`OPENAI_API_KEY`). Spend is metered from token counts (`VOICE_PRICE_TEXT_IN/AUDIO_IN/OUT` USD per 1M tokens) and recorded per user as `TokenTransactionModel` debits (description `Voice note …`, `metadata.usd`); users without an active subscription (`subscription_status` active/trialing/past_due, or admins) get `VOICE_FREE_BUDGET_USD` (default 1.00) in total, then 402. Deps are injectable (`createVoiceNoteHandler(deps, usage)`), tests mock them
- `search/rowIndex.ts` + `search/routes.ts` - semantic search over rows and the market. `indexStore` embeds every row of a user's store (Vertex `text-embedding-005`, 768 dims, table `RowEmbeddingModel` with a pgvector column written through raw SQL; hash-based upsert, vanished rows deleted) and runs debounced after each `saveStore` in `sync/accountStore.ts` (`ROW_INDEX_DELAY_MS`, `ROW_INDEX_DISABLED=true` to turn off); a row's `market` column is whether the market peer `fos:market` is a member there with `read` (inherited down the tree, `marketGrantsOf`); reference rows (their row type) are skipped; each row's type id is stored in the table's `kind` column (`IndexedRow.type`, `SearchHit.type`; `capability` for published handlers). Search has no route: `searchRows` is called only by the fos `search` effect (`searchHandler` in `sync/hostHandlers.ts`). Market routes (user JWT, `createMarketHandlers`): `GET /user/data/market/node?owner=&id=` (a node the market lists, or one the requester is a member of, with proposals filtered to the requester's own), `POST /user/data/market/proposals {owner, aliasId, bid}` (a bid of rows the client built, `shared/sync/market.ts` `applyBid`, recorded as a proposal `user:<name>` on the owner's node under the owner's lock; rows are told apart only by their type). Proposals are taken where the market member has `edit` or the requester is a member with `edit` (`hasCapability`). Design: `docs/sync.md`, "Requirements, resource banks, queries and the market"
- `integrations/` - integration peers: `providers.ts` (registry: OAuth GitHub/Google/Discord, platform Stripe, the phone channel), `secrets.ts` (AES-GCM token storage under `INTEGRATION_SECRET`, signed OAuth state, phone codes), `routes.ts` (`GET /user/integrations`, `:provider/start`, public `/integrations/:provider/callback`, `DELETE :provider`, `phone` + `phone/verify`; `createIssue` (GitHub) and `createCalendarEvent` (Google) are the functions the registry effects call, there are no routes per handler; `notifyUser` texts a linked phone; `prismaIntegrationDeps`), `store.ts` (a user's tree as a replica for edits: `editTree`, `walkRows`), `mcpPeers.ts` (MCP servers as peers: `GET /user/data/mcp-peers`, `attach` makes a server a member `mcp:<id>` advertising `tool`; `mcpToolHandler` is the registry effect that runs `-tool` requirements on `complete` (binding in `prepare`, call in `effect`); `runOpenToolRequests` listens after saves when `MCP_LISTEN=true` via `afterSaveHooks`). Tests: `routes.test.ts`, `mcpPeers.test.ts` (dependency-injected, no network). Model: `IntegrationConnectionModel`.
- `voice/organize.ts` - organizing a capture into one node's subtree is the fos `organize` effect, not a route (plan format, validation and application in `shared/sync/organize.ts`). `organizeHandler(model, usage)` fills an `organize` requirement placed in the target (`requestOrganize`: its text the label, its `lib:type:note` row the capture ≤ 100k chars) when a `complete` event reaches it: `prepare` refuses a missing capture or a non-paying account over the voice budget before the evaluation opens; the effect builds the outline from the account's own store (`captureOutline`, the target's subtree, `fos:` rows skipped), makes one model call (`organizeCapture`: `ORGANIZE_SYSTEM`, JSON, retried once on invalid JSON, validated against the outline: unknown parents → the target, rows name a standard-library row type of `ORGANIZE_TYPES`), submits the plan with the capture kept as a note (stamp in UTC) as ONE submission by `fos` on the target (`proposeOrganizePlan`: a proposal on the target's mutable ref whose content is the plan applied to a draft of its value; no row is written into main), writes `{rows, under, captureId, title, proposal, name, additions}` as the requirement's `fos:organized` value and records the supply. The owner accepts it on a device as one local edit (web `App.acceptSubmission`, shared `acceptSubmissionRows`; the device's next node sync makes the server fill the accepted rows from the submission and close it, `node-sync.ts`) or rejects it with the ordinary `decide`; nothing lands in main before. One provider instance per capture (`model()`), spend recorded as voice usage (`recordSafely`). `createAccountOrganizer(storeDeps, runNode)` does the same for an account without a device (texts): places the requirement in Home under the account lock, runs it through `evaluationService.runNode`, then removes the request (null on any failure); the submission waits in Home for a device to accept it. `voice-notes?transcript=only` returns just the transcript (the client then organizes it); audio types are folded by `mediaTypeOf` (iOS `audio/mp4`, `audio/x-m4a`, `audio/aac`, …). Tests: `voice/organize.test.ts` (fake model through the event route and evaluation)
- `channels/textCommands.ts` - texted commands as an adapter of the event grammar: a linked sender's "done <words>", "list" or "[ ] task" become `search`/`submit`/`read` events for that account's owner; any other text is organized for Home's subtree by the same `organize` handler devices use (`organize(username, text, label)` dep = `createAccountOrganizer`, which runs an `organize` requirement in Home): one pending fos submission in Home (the rows plus the message as a note) that the owner accepts or rejects on a device, and the reply says so; over budget or on failure it is a plain row in Home as before (`createTextCommandInbound`, wired to every channel source in `index.ts`; only phones are linked to accounts today)
- `channels/sms.ts` - Twilio SMS adapter (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`): outbound through the Messages API, inbound `POST /channels/sms/webhook` (form-encoded, `X-Twilio-Signature` verified against `API_URL`).
- `sync/host-runtime.ts` + `sync/hostHandlers.ts` - native primitive definitions and ref-driven execution: which services this host (`fos`: `search` (fills a `-?` requirement: pgvector hits as ref rows under it, then the supply), `market` (makes the market peer a member of the task, indexes, records the supply), `points` (pays a `-ff` requirement on the token ledger, one idempotent transfer per requirement), `send-payment` (opens a Stripe payment for a `-$` request, a negative row of the money type `lib:type:allocation:money`, and waits; settlement writes the positive money row, the payment, that fills it; the webhook settles it through `sync/payments.ts` and resumes the evaluation; only with `STRIPE_TOKEN`), `verify` (attests `@name`, `sync/verify.ts`), `organize` (files a capture into a node, `voice/organize.ts`), `title` (a summary title for a row's text, `titleHandler`) and `llm` as effects; `cron` only with `FOS_ENABLE_CRON`) and the peers it fronts (`integration:github` → repo effect, `integration:google` → calendar effect, `mcp:*` → tool effect, `integration:phone` → notify) actually have. Effects run through `complete` events only; an effect may answer `'pending'` (the llm handler does) and the evaluation pauses as `awaiting-review` until the owner accepts the proposal. These definitions seed initial ref declarations and reconstruct native meanings after loading. Only scoped ref rows and their accepted primitive values select executors; deleting a declaration withdraws it, including after reload. Compatibility advertisements include: `capabilities` in every sync and node-provider response (`SERVER_TRANSPORT_CAPABILITIES` + registered fos services), the fos/integration member offers and the handlers' public keys (`HostHandler.publicKey` → `hostOffers().keys`) written into each account's Home (`ensureHomeContext(..., runtime.hostOffers())`), and `provides` in `GET /user/integrations`. Handlers with an `effect` run through `sync/evaluation.ts`; the rest (cron, notify) are only advertised; no handler has a route of its own. Declare a typed primitive ref; no capability-name registration is required. Handlers with a `submission` hook run after every node exchange that wrote (`runtime.afterSubmission`, called by `sync/provideNode.ts` under the account lock; failures are logged, the exchange still answers): `relayHandler` runs the shared relay (`shared/sync/relay.ts`) as `fos`, moving a message left on a node into its addressee's queue under that member's entry when the account knows the peer there, and leaving it otherwise (docs/sync.md, "Relay").
- `channels/` - chat channels inside this process (formerly the standalone `event-services`): `GET/POST /channels/whatsapp/webhook` (Meta verification, optional `X-Hub-Signature-256` check, text messages → bus), a discord.js gateway bot, `GET /channels/health`. `channelBus.onInbound(handler)` receives `InboundMessage`s, `channelBus.send({destination, to, text})` replies; inbound messages are mirrored to `PUBSUB_INBOX_TOPIC` when set; `CHANNELS_ECHO=true` echoes for smoke tests. Env: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `DISCORD_TOKEN` (set on Cloud Run with `gcloud run services update --update-secrets`). The Discord gateway is a persistent socket: it needs min instances ≥ 1 and CPU always allocated, which the dev Cloud Run service does not have today
- `util.ts` - `dbToStore`/`storeToDb`; loads refuse rows in another data version (`UnsupportedDataVersionError`: reset the database, nothing is migrated), saves add only missing access links (the link table has no unique constraint, so re-creating links on every save used to duplicate them and slow every load)
- `auth/deviceLogin.ts` - browser sign-in for a device without a browser (the `fos` CLI): `POST /auth/device/start` → code + verify URL, `GET /auth/device/poll`; the signed-in web app calls `GET|POST /user/data/device-login/:code[/approve|/deny]`; in-memory, 10-minute codes, grants a normal user JWT (so SSO in the web app signs the CLI in too)
- `sync/provideNode.ts` - `POST /user/data/peer-sync/provide-node` (node-provider, the only sync route: every device, peer and the `fos` CLI sync node by node through it; owners get Home made sure of, `ensureAccountContext`, and every answer carries the account's `presence`; with `owner` in the body, another account's node served to a signed-in user as that account's peer `user:<me>`, propose-only) and `GET /user/data/peer-sync/locate?owner=&id=` (where a shared node lives and the grants there). `sync/events.ts` takes `owner` the same way (`principalOf`), so read/submit/complete run as `user:<me>` on the owner's store; `complete` runs the owner's registry when they granted `execute`.
- `sync/verify.ts` - the fos `verify` handler (an effect, no route): a `verify` requirement (`requestVerification` in shared/sync/users.ts, text `@name`, kept under Home's `fos:users`) evaluated through `complete` is filled with the attested user object (`lib:type:user`: account id, username, display name, public key, an ed25519 server attestation) bound as its `user` field, plus the supply `{capability: 'verify', by: 'fos'}`; an unknown name is refused in `prepare`. Its `publicKey` is in `runtime.hostOffers().keys`, so `ensureHomeContext` publishes it on the fos member entry of every account's root as the `fos:key:fos` user row (graph data the owner's devices receive with that entry through node exchange and check attestations against; an old Home key row is removed). `verify(user)` re-checks objects read from graphs before acting on them (the fos-points and payment payees in `hostHandlers.ts` `payeeOf`). Key: `FOS_IDENTITY_SEED` (32 bytes hex/base64), else HKDF of `JWT_SECRET`, else per-process random. Display name and public key come from `user_profile.displayName`/`name` and `user_profile.publicKey`. Tests: `verify.test.ts` (the requirement filled, the key reaching a device through node exchange, the routes gone)
- `sync/hostHandlers.ts` `mailHandler` - the fos `mail` effect: a `-mail someone@example.com Subject` requirement under a task emails that address (Postmark, `sendPlainEmail`, from `EMAIL_FROM`) with the task and its rows as the body, on the account's behalf, and records the supply as `fos`.
- `sync/peerInvites.ts` - invite tokens (`/user/data/peer-invite*`, public `/peer/connect*`) that grant scoped peer JWTs (`kind: 'peer'`, confined by `verifyJwt.ts` to peer-sync); table `PeerInviteModel`
- `sync/accountStore.ts` - loading and saving an account's store (`dbToStore`/`storeToDb`, one request at a time per account `withUserLock`, `AccountStoreDeps`), where a device attaches (`GET/DELETE /user/data/peer-sync/attachment`), re-indexing and `afterSaveHooks` after a save, nudging other devices over WebSocket (`sendToUser` in `promptNotifications.ts`). The `/user/data/peer-sync/*` prefix is the namespace peer credentials may use; sync itself is node exchange (`provideNode.ts`)

### Graph System Integration
- `userDirectory.ts` - `GET /groups/search/name|email`: find Fos accounts for the web's peer search
- Integration with `shared/dag-implementation/` for graph operations
- `prismaClient.ts` - Database client configuration

### Token Billing
- `tokenManager.ts` - Token balance and transaction ledger
- `tokens.ts` - `/tokens/balance`, `/tokens/transactions`, `/tokens/purchase` (Stripe checkout), purchases

### Security & Middleware
- `verifyJwt.ts` - JWT verification utilities
- `requestUser.ts` - `getUserId`: the account id of a JWT-authenticated request, from its claims
- `maxRequests.ts` - Rate limiting middleware
- `promptNotifications.ts` - each user's open WebSockets: `sendToUser`, presence (`onlinePeersOf`)

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
- `../infra/prisma/` - Database schema and migrations; `prismaClient.ts` - the client

## Data Inputs/Outputs

### Input Sources
- HTTP requests from the web app, the `fos` binary and MCP agents
- Webhook events from Stripe
- Email webhook events from Postmark
- Database queries via Prisma
- AI model responses from Vertex AI (optionally OpenAI)

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
- Effects run through `complete` events (handler registry)

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
- `FOS_IDENTITY_SEED` - optional 32-byte seed (hex or base64) of the ed25519 key that attests user objects (`sync/verify.ts`); derived from `JWT_SECRET` when absent
- `STRIPE_TOKEN` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook verification
- `OPENAI_API_KEY` - the optional OpenAI voice provider (`VOICE_PROVIDER=openai`)
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
- [x] Fixed Express middleware type compatibility
- [x] Added missing database schema fields for Stripe integration
## Graph evaluation and cron
`sync/events.ts` adapts HTTP, MCP and the WebSocket to the event grammar; an `invite` event also delivers the node into the invitee's Home (`ensureMemberLink`) when the registry advertises `relay`. `sync/evaluation.ts` runs owner evaluations (`runNode`, reached through a `complete` event, and `runCron`). It checks the submitted content version and branch selections under the existing per-user load/save lock, then uses the shared evaluator with the host runtime as its driver. The journal is saved before dispatch; uncertainty becomes manual recovery rather than a duplicate retry. Invited peer credentials cannot initiate account integration effects: their `complete` becomes an evaluation request (see `shared/sync/events.ts`).

`sync/cron.ts` is opt-in with `FOS_ENABLE_CRON=true`. **Run only on one always-on backend instance**: the existing per-user store lock is process-local. The runner scans paginated accounts every 30 seconds, claims occurrences in the graph, and uses the same evaluator. It checks the current UTC minute, has no missed-run catch-up, and uses the server's default branch selections. The flag is deliberately off for the default autoscaled deployment; the server advertises `cron` only when enabled. A distributed scheduler/lease is still required before enabling this on multiple instances or a scale-to-zero service.

`util.ts` now advances the visible account root with an atomic compare-and-swap against the version observed by `dbToStore` (`sync/storeVersion.ts`). A stale writer cannot overwrite another instance's commit, and a rejected evaluation claim cannot dispatch effects. If another instance changes the tree during an external effect, the attempt remains uncertain and requires recovery; it is not automatically repeated. Integration HTTP calls have a 15-second deadline, evaluation stops starting work after two minutes, and recovery of an interrupted run waits three minutes from its start.

## Public node input
`sync/sharing.ts` serves published nodes: a node may be visited when an audience peer (`audience:public`, `audience:users`) is a member that may run or read it (`publication`); the owner publishes on a device as an ordinary member edge, so there is no configure route and no share id (addresses are `{ owner, path }`). Whoever may not run or read a node gets 404, as for a node that does not exist. The `url` handler (`publicUrlHandler`, a submission hook) keeps each published node's URL as a row in the server's member entry above it (`WEB_URL`). Visits and input at `/public/node/visit` and `/public/node/input`; signed-in visitors use `/user/data/sharing/visit` and `/user/data/sharing/input`. A visitor joins as a member with `execute`; its input and votes need both it and its audience (`mayParticipate`). A published template is an endpoint: each visitor's run is a node marked as their execution (`markExecution`), valid while the endpoint stays published to that audience. Choices are inputs like any other; there is no poll handler. The last input of a template execution evaluates it through the host's registry (`runNode`), outside the request's locks. Anonymous receipts use a separate derived signing key and cannot authenticate account sync.
`GET /public/node/read?owner=&path=[…]` (`read`) is the embed's read-only projection: no visitor joins, nothing is saved, Fos-user audiences and executions are refused (a template endpoint reads as its page), `Cache-Control: public, max-age=60`. In `index.ts` `/public/node/read|visit|input` use `cors({ origin: '*', methods: ['GET', 'POST'], credentials: false })` so embeds on any site can read and answer (guest receipts travel in the body, never cookies); every other route keeps the account origins list (`corsFor`). On the shared original, `submit` records text answers as the visitor's candidate values (`proposeVisitorValues`: binding proposals on missing bindings, one `fos:visitor-submission` node proposal for empty fields), each visitor its own peer. Test: `sync/sharing.test.ts`.

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
