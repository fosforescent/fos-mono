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

## Setup

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
cd apiTests
npm install
node auth-flow.test.js
```

## Test Scenarios

### Authentication Flow
1. Register new user
2. Confirm email (if enabled)
3. Login with credentials
4. Use JWT token for protected endpoints
5. Test token expiration
6. Test password reset flow

### Protected Endpoints
1. Get user data
2. Update user profile
3. Test API token management

## Test Data
Tests use dynamic usernames with timestamps to avoid conflicts:
- Username: `testuser_{{timestamp}}`
- Password: `TestPass123` (meets requirements: 8+ chars, uppercase, number)