# Infrastructure CLAUDE.md

## Directory Summary
The infra directory contains infrastructure configuration, deployment tools, and end-to-end testing for Fosforescent. It includes Docker Compose configurations, Terraform infrastructure as code, and Playwright E2E tests for comprehensive application testing.

## Key Components

### Docker Configuration
- `docker-compose.yaml` - Multi-service Docker Compose configuration
- Uses Dockerfiles from `../backend/Dockerfile` and `../frontend/Dockerfile`
- PostgreSQL database with pgvector extension
- Development and production service profiles

### End-to-End Testing
- `e2e-tests/` - Playwright test suites for full browser testing
- `helpers/` - Test helper functions and utilities
- `playwright.config.ts` - Playwright configuration
- `test-results/` - Test execution results and artifacts

### API Testing
- `apiTests/` - API integration tests for backend endpoints
- `auth-flow.http` - REST client file for manual API testing
- `auth-flow.postman_collection.json` - Postman collection
- `auth-flow.test.js` - Automated Node.js test script

### Terraform Infrastructure
- `terraform/` - Infrastructure as Code for cloud deployment
- Cloud provider configurations
- Domain and networking setup
- Database and storage provisioning

### Build and Development Tools
- `package.json` - E2E test dependencies and scripts
- `jest.config.js` - Jest configuration for infrastructure tests
- `Makefile` - Infrastructure-specific build and deployment commands

## Dependencies

### External Dependencies
- **Docker & Docker Compose**: Container orchestration
- **Playwright**: E2E testing framework
- **Terraform**: Infrastructure as Code
- **PostgreSQL**: Database with pgvector extension
- **Node.js**: Runtime for test execution

### Internal Dependencies
- `../backend/` - Backend service and Dockerfile
- `../frontend/` - Frontend service and Dockerfile
- `../prisma/` - Database schema and initialization
- `../shared/` - Shared types and utilities

## Data Inputs/Outputs

### Input Sources
- Docker Compose service definitions
- Terraform configuration files
- E2E test specifications
- Environment variables and secrets
- Application Dockerfiles from backend/frontend

### Output Destinations
- Running Docker containers
- Cloud infrastructure resources
- Test execution reports
- Deployment artifacts
- Container images

## Events Handled
- Container lifecycle management
- Database initialization and seeding
- E2E test execution across multiple browsers
- Infrastructure provisioning and updates
- Service health monitoring and restart policies

## Docker Compose Configuration

### Services
- **postgres**: PostgreSQL database with pgvector extension
  - Data persistence via Docker volumes
  - Health checks for startup dependencies
  - Exposes port 5435 (configurable)

- **backend**: Node.js API server
  - Built from `../backend/Dockerfile`
  - Multi-stage build for optimized production image
  - Database connectivity and environment configuration
  - Exposes port 4000 → 80 (internal)

- **frontend**: React application
  - Built from `../frontend/Dockerfile`
  - Vite build with static asset optimization
  - API connectivity to backend service
  - Exposes port 5173 → 80 (internal)

### Service Profiles
- `backend` - Run only backend and database
- `frontend` - Run only frontend (requires backend)
- `e2e` - Full stack for end-to-end testing

## E2E Testing Strategy

### Test Coverage
- **Authentication flows**: Login, registration, password reset
- **Dashboard functionality**: Navigation, user interface, responsive design
- **Console agent interactions**: AI agent communication and tool usage
- **Subscription workflows**: Payment, billing, token management
- **Graph operations**: Node creation, manipulation, visualization
- **Admin features**: User management, MCP server administration

### Test Configuration
- Multi-browser testing (Chromium, Firefox, WebKit)
- Parallel test execution
- Automatic retry on failure
- Screenshot and video capture on errors
- Network request interception and mocking

## Terraform Infrastructure

### Cloud Resources
- Compute instances for application hosting
- Database services (PostgreSQL with extensions)
- Load balancers and networking
- DNS and domain management
- SSL/TLS certificate provisioning

### Environment Management
- Separate configurations for development, staging, production
- Secret and configuration management
- Backup and disaster recovery
- Monitoring and alerting setup

## Data Transformations
- Docker image building and optimization
- Environment variable substitution
- Test data setup and teardown
- Infrastructure state management
- Service discovery and networking

## Development Commands

### Docker Operations
```bash
# Start all services
docker-compose up

# Start specific profile
docker-compose --profile backend up
docker-compose --profile e2e up

# Build and start
docker-compose up --build

# Clean up
docker-compose down -v
```

### E2E Testing
```bash
# Run all Playwright tests
npm test

# Run specific test file
npx playwright test auth.spec.ts

# Run with UI
npx playwright test --ui

# Generate test report
npx playwright show-report
```

### API Testing
```bash
# Run authentication flow tests
npm run test:api

# Test WebSocket connections
npm run test:api:ws

# Test MCP protocol
npm run test:api:mcp

# Test Temporal MCP server
npm run test:api:temporal

# Run all API tests
npm run test:api:all
```

### Terraform Operations
```bash
cd terraform
terraform init
terraform plan
terraform apply
terraform destroy
```

## TODOs
- [ ] Implement infrastructure monitoring and alerting
- [ ] Add automated backup and restore procedures
- [ ] Optimize Docker image sizes and build times
- [ ] Implement blue-green deployment strategy
- [ ] Add comprehensive infrastructure testing
- [ ] Implement secrets management with external tools
- [ ] Add container security scanning
- [ ] Optimize E2E test execution time
- [ ] Implement test parallelization across environments
- [ ] Add performance testing with load scenarios
- [x] **Add MCP server that exposes a webhook API for long-running tasks** - ✅ COMPLETED: Created Temporal MCP server (`backend/mcp/temporalMcpServer.ts`) that provides tools for task submission, monitoring, cancellation, and webhook notifications. Supports offline/reconnect scenarios with persistent task storage and status tracking.
- [ ] **Integrate Temporal MCP server with actual Temporal.io workflows** - Replace simulated task execution with real Temporal workflow orchestration
- [ ] **Implement webhook HTTP delivery system** - Add actual HTTP webhook delivery for task completion notifications
- [ ] **Add database persistence for tasks** - Store task data in PostgreSQL instead of in-memory storage