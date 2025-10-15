# Event Services CLAUDE.md

## Directory Summary
The event-services directory contains microservices for handling external communication platforms. Each service acts as a bridge between external APIs (WhatsApp, Discord) and the internal SQS queue system for message processing.

## Architecture
Each service follows a simple echo pattern:
1. Receives messages from external platform APIs
2. Forwards incoming messages to the "inbox" SQS queue
3. Polls the "outbox" SQS queue for messages to send
4. Sends messages via the respective platform API

## Services

### WhatsApp Service (`whatsapp/`)
- Handles WhatsApp Business API integration
- Receives webhooks for incoming messages
- Sends messages via WhatsApp Business API
- Uses SQS for message queuing and processing

### Discord Service (`discord/`)  
- Handles Discord bot integration
- Receives Discord events via WebSocket or webhook
- Sends messages via Discord API
- Uses SQS for message queuing and processing

## Dependencies

### External Dependencies
- **AWS SDK**: For SQS queue integration
- **Docker**: For containerization
- **Node.js**: Runtime environment
- **Platform SDKs**: WhatsApp Business API, Discord.js

### Internal Dependencies
- `../infra/terraform/sqs.tf`: SQS queue definitions
- Shared message formats and types (to be defined)

## Data Flow

### Incoming Messages
1. External Platform → Service Webhook/API
2. Service → Format Message → SQS Inbox Queue
3. Core System processes from Inbox Queue

### Outgoing Messages  
1. Core System → SQS Outbox Queue
2. Service polls Outbox Queue
3. Service → External Platform API

## Environment Variables
Each service requires:
- `AWS_REGION`: AWS region for SQS
- `INBOX_QUEUE_URL`: URL of the inbox SQS queue
- `OUTBOX_QUEUE_URL`: URL of the outbox SQS queue
- Platform-specific credentials (API keys, tokens)

## Docker Configuration
Each service includes:
- Multi-stage Dockerfile for optimized builds
- Health check endpoints
- Graceful shutdown handling
- Environment-based configuration

## TODOs
- [ ] Define common message format specification
- [ ] Implement shared SQS client utilities
- [ ] Add monitoring and logging infrastructure
- [ ] Implement error handling and retry logic
- [ ] Add integration tests for each service
- [ ] Define deployment strategies (ECS, Kubernetes, etc.)
- [ ] Implement message deduplication
- [ ] Add rate limiting and throttling
- [ ] Create service discovery mechanism
- [ ] Implement circuit breaker patterns