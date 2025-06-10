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
- `embedding.ts` - Vector embedding generation for semantic search
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

## Dependencies

### External Dependencies
- **Express**: Web framework for API endpoints
- **Prisma**: ORM for database operations
- **Stripe**: Payment processing
- **Postmark**: Email service
- **JWT**: Authentication tokens
- **OpenAI**: AI model integration
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
- Vector embeddings to database
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
- `OPENAI_API_KEY` - OpenAI API access
- `POSTMARK_API_TOKEN` - Email service token

## Testing
- Unit tests with Jest framework
- API endpoint testing
- Database integration tests
- Authentication flow testing

## TODOs
- [ ] Implement comprehensive API documentation
- [ ] Add more granular error handling
- [ ] Optimize database queries with caching
- [ ] Implement API versioning strategy
- [ ] Add comprehensive logging system
- [ ] Implement backup and recovery procedures
- [ ] Add monitoring and health check endpoints
- [ ] Optimize Docker build for faster deployments