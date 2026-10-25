# Backend CLAUDE.md

## Directory Summary
The Node.js/Express API server: authentication, data management, graph operations, subscriptions, and the always-on account peer for the web, desktop and CLI clients.

## Responsibilities
- `index.ts` - server entry and Express app configuration
- `auth/` - authentication; `auth/deviceLogin.ts` - browser sign-in for a device without a browser (the `fos` CLI)
- `subscription/` - Stripe payments and subscriptions
- `email/` - email delivery (Postmark)
- `mcp/` - the MCP client MCP peers use
- `voice/voiceNotes.ts` - voice and media notes; `voice/organize.ts` - the organize native
- `search/` - semantic search over rows and the market
- `integrations/` - integration peers (OAuth providers, Stripe, the phone channel, MCP servers)
- `channels/` - chat and SMS channels; `channels/textCommands.ts` - texted commands as an adapter of the event grammar
- `util.ts` - store load/save
- `sync/provideNode.ts` - node exchange, the only sync route
- `sync/accountStore.ts` - loading and saving an account's store
- `sync/events.ts` - adapts HTTP, MCP and the WebSocket to the event grammar
- `sync/evaluation.ts`, `sync/cron.ts` - owner evaluations and scheduled runs
- `sync/sharing.ts` - published nodes
- `sync/verify.ts` - the fos `verify` handler; `sync/approve.ts` - the `approve` handler
- `sync/peerInvites.ts` - invite tokens granting scoped peer credentials
- `userDirectory.ts` - finding Fos accounts for peer search
- `tokenManager.ts`, `tokens.ts` - fos points ledger and routes
- `verifyJwt.ts`, `requestUser.ts`, `maxRequests.ts`, `promptNotifications.ts` - JWT verification, request identity, rate limiting, WebSocket notifications and presence

## Rules
- Resource submissions preserve the supplier's time bounds as data for every resource type; nothing enforces them. Calendar effects must require an explicit finite event start and end; do not infer an endpoint from the amount or replace null with the current time.
- Using an offered allocation authors the shared allocate invocation and runs it through the server's `allocate` handler; the input endpoint records no consumption itself.
- Market fulfillment must provide an independent result through a declared output ref, created before instructions are pinned. A supply must not point back to the task that depends on it. Withdrawal of the result must invalidate fulfillment.
- Native host services must be declared as typed graph refs. Runtime restoration must retain their pinned definitions and must not recreate deleted offers. Dispatch and lifecycle hooks must discover accepted native values through scope; grants and service-name lists must not substitute for declarations. Isolated account work must retain its enclosing server graph scope.
- Search has no route: it runs only as the fos `search` effect. Rows are told apart only by their type.
- Market proposals are taken only where the market member has `edit` or the requester is a member with `edit`.
- Integration effects are registry handlers; there are no routes per handler.
- Organize must keep the original capture input available.
- Inbound SMS must be signature-verified.
- Loads refuse rows in another data version: reset the database, nothing is migrated. Saves must not duplicate access links.
- An account's store is handled one request at a time.
- Another account's node served to a signed-in user is propose-only.
- Peer credentials are confined to the `/user/data/peer-sync/*` namespace.
- User objects read from graphs must be re-verified before acting on them.
- Requirements and allocations are one kind of row (negative = requirement).
- The evaluation journal is saved before dispatch; uncertainty becomes manual recovery, never a duplicate retry. If the tree changes during an external effect, the attempt remains uncertain and is not automatically repeated.
- Invited peer credentials cannot initiate account integration effects: their `complete` becomes an evaluation request.
- A stale writer must not overwrite another instance's commit, and a rejected evaluation claim must not dispatch effects.
- The server advertises `cron` only when cron is enabled.

## Event grammar
Every input surface is an adapter of `shared/sync/events.ts`. Invited peers are bounded by their signed scope; every operation checks live membership, link masks, branch selections and explicit child restrictions; peers' submissions are proposals, their completions are evaluation requests. No endpoint accepts raw CIDs or graph writes.

## Public node input
- Publishing is an ordinary member edge of an audience peer; there is no configure route and no share id (addresses are `{ owner, path }`).
- Whoever may not run or read a node gets 404, as for a node that does not exist.
- A visitor's input and votes need both the visitor and its audience to be allowed.
- A published template is an endpoint: each visitor's run is their execution, valid while the endpoint stays published to that audience.
- Choices are inputs like any other; there is no poll handler. Approvals/rankings record input and never call proposal merge. Changed poll options invalidate earlier totals, and resubmission replaces the visitor's prior input.
- Only declared unbound text slots and direct allocation requirements are exposed as fields.
- Signed-in visitors' input and local source links stay in their own account; the host stores an allowlisted projection plus a reference to that participation state. Anonymous input is owned by the host.
- Anonymous receipts use a separate derived signing key and cannot authenticate account sync.
- The read-only embed projection joins no visitor, saves nothing, and refuses Fos-user audiences and executions.
- Only the public node routes allow any origin, without credentials (guest receipts travel in the body, never cookies); every other route keeps the account origins list.

## Standard library
There is no server-owned library and no system account: the standard library is a mutable ref like any other (`shared/sync/library.ts`). Every device root has one from its build; a group shares one the way it shares any node, and members' changes are their submissions accepted under the node's merge rule.

## Operations
- Deploy: `.github/workflows/deploy-backend.yml` on push to `main`; see `infra/CLAUDE.md`.
- `FOS_ENABLE_CRON=true` enables cron. **Run it only on one always-on backend instance**: the per-user store lock is process-local. A distributed scheduler/lease is required before enabling it on multiple instances or a scale-to-zero service.
- The Discord gateway is a persistent socket: it needs min instances ≥ 1 and CPU always allocated. Set channel secrets on Cloud Run with `gcloud run services update --update-secrets`.
- Media provider calls need live-provider validation in addition to the mocked handler tests.

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `FOS_IDENTITY_SEED` - optional 32-byte seed (hex or base64) of the ed25519 key that attests user objects; derived from `JWT_SECRET` when absent
- `STRIPE_TOKEN` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook verification
- `OPENAI_API_KEY` - the optional OpenAI voice provider (`VOICE_PROVIDER=openai`)
- `POSTMARK_API_TOKEN` - Email service token
- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `DISCORD_TOKEN`, `CHANNELS_ECHO` - chat channels (optional; adapters without credentials stay off)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` - SMS
- `GCP_PROJECT_ID`, `VERTEX_LOCATION`, `EMBEDDING_MODEL` - Vertex embeddings for row search (locally `GOOGLE_APPLICATION_CREDENTIALS` must point at a valid credential)
- `ROW_INDEX_DISABLED=true` - turns off row indexing
- `MCP_LISTEN=true` - runs open tool requests after saves
- `WEB_URL` (falls back to `FRONTEND_URL`) - where the web app lives
- `FOS_ENABLE_CRON=true` - enables cron (see above)

## TODOs
- [ ] Optimize Docker build for faster deployments
- [ ] Add monitoring and health check endpoints
- [ ] Implement backup and recovery procedures
- [ ] Implement comprehensive API documentation
- [ ] Add comprehensive logging system
- [ ] Optimize database queries with caching
- [ ] Implement API versioning strategy
- [ ] Add batch processing optimization for large vector operations
- [ ] Authority-minting handlers (fos points, calendar, confirmed payments) become natives whose bank is a row
- [ ] Replace resource handler dispatch by requirement resource name with rows