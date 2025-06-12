# API Tests

This directory contains API tests for the Fosforescent backend. The tests are organized to be used with various API testing tools:

- **Postman Collections** (`.json`) - Import into Postman
- **REST Client Files** (`.http`) - Use with VS Code REST Client extension or similar tools
- **Test Scripts** (`.js`) - Automated test scripts

## Test Collections

### Authentication Flow
- `auth-flow.postman_collection.json` - Postman collection for authentication
- `auth-flow.http` - REST client file for authentication tests
- `auth-flow.test.js` - Automated test script

### WebSocket Testing
- `websocket-flow.http` - REST client file with WebSocket connection instructions
- `websocket-flow.test.js` - Automated WebSocket connection tests
- `mcp-protocol.test.js` - MCP (Model Context Protocol) specific tests
- `temporal-mcp.test.js` - Temporal MCP server tests for long-running tasks

## Setup

### Prerequisites
Make sure the backend is running:
```bash
# From the root directory
cd backend
npm run dev
# OR with Docker
cd infra
docker-compose up backend
```

### Environment Variables
Create a `.env.test` file with:
```
API_BASE_URL=http://localhost:4000
TEST_USERNAME=testuser_{{timestamp}}
TEST_PASSWORD=TestPass123
TEST_EMAIL=test@fosforescent.com
```

### Postman
1. Import the `.postman_collection.json` files
2. Set up environment variables in Postman
3. Run the collections

### VS Code REST Client
1. Install the REST Client extension
2. Open the `.http` files
3. Click "Send Request" above each request

### Node.js Test Scripts
```bash
# From the infra directory
npm run test:api        # Run auth flow tests
npm run test:api:auth   # Same as above
npm run test:api:ws     # Run WebSocket connection tests
npm run test:api:mcp    # Run MCP protocol tests
npm run test:api:temporal # Run Temporal MCP server tests
npm run test:api:all    # Run all API tests
```

### WebSocket Testing Tools
Install wscat for manual WebSocket testing:
```bash
npm install -g wscat
```

Manual WebSocket testing:
```bash
# Test normal WebSocket (replace TOKEN with actual JWT)
wscat -c "ws://localhost:4000/TOKEN"

# Test MCP WebSocket
wscat -c "ws://localhost:4000/mcp"
```

## Test Scenarios

### Authentication Flow
1. Register new user
2. Confirm email (if enabled)
3. Login with credentials
4. Use JWT token for protected endpoints
5. Test token expiration
6. Test password reset flow

### WebSocket Connections
1. Normal WebSocket connection with JWT authentication
2. Connection error handling (invalid tokens, missing tokens)
3. Basic message sending and receiving
4. Connection cleanup and close handling

### MCP Protocol Testing
1. WebSocket connection to MCP endpoint
2. MCP protocol initialization
3. Resource listing and management
4. Tool discovery and invocation
5. Prompt template listing
6. Error handling and protocol compliance

### Temporal MCP Server Testing
1. Long-running task submission and management
2. Task status monitoring and progress tracking
3. Workflow type discovery and configuration
4. Task cancellation and retry mechanisms
5. Webhook notification system testing
6. Resource access for task metrics and monitoring
7. Interactive prompt templates for task management

### Protected Endpoints
1. Get user data
2. Update user profile
3. Test API token management

## Test Data
Tests use dynamic usernames with timestamps to avoid conflicts:
- Username: `testuser_{{timestamp}}`
- Password: `TestPass123` (meets requirements: 8+ chars, uppercase, number)