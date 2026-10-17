# Infrastructure CLAUDE.md

## Directory Summary
The infra directory contains infrastructure configuration and deployment tools for Fosforescent: Docker Compose for local services, Terraform infrastructure as code, the Prisma schema, and API smoke scripts.

## Deploying (GitHub Actions)

Only a `dev` environment exists in GCP today and it serves the live site: Cloud Run `fos-backend-dev` behind `api.fosforescent.com`, the web app on Cloudflare Pages behind `fosforescent.com`, Cloud SQL `fos-postgres-dev`.

- `.github/workflows/deploy-backend.yml` — on push to `main` (backend/shared/prisma/web paths) or manual dispatch: builds `backend/Dockerfile` (context = repo root), pushes `gcr.io/fosforescent/fos-backend:<sha>` and `:latest`, runs `prisma db push` through the Cloud SQL proxy (fails on destructive changes instead of applying them), rolls Cloud Run to the new image with `WEB_URL`, then builds `web/` with `VITE_API_URL=https://api.fosforescent.com` and rsyncs it to the bucket. Auth is the `GCP_SA_KEY` secret (service account `github-deployer`); create/rotate it with `bash infra/scripts/setup-gcp-deployer.sh`.
- `.github/workflows/deploy-infrastructure.yml` — Terraform for `infra/terraform/**`: plan on PRs; plan **and apply** on push to `main` (also manual dispatch with `action=apply`). On 2026-10-12 the config was reconciled with the deployed `dev` resources (f1-micro HDD Cloud SQL on public IP, no VPC/connector, no load balancer, no Cloud DNS; Cloud Run with the `/cloudsql` volume; non-expiring Pub/Sub subscriptions) and `terraform plan` is clean. Secrets: `GCP_TERRAFORM_SA_KEY`, `TF_DOTENV`, `TF_TFVARS` (`infra/scripts/setup-terraform-ci.sh`; re-run after editing `.env` or `terraform.tfvars`). Gotcha: `terraform.tfvars` must hold the *real* database password; the composed `database_url` secret `urlencode()`s it. Putting the encoded form in tfvars makes `google_sql_user` set the wrong password and breaks the backend's DB connection.
- The old standalone `event-services` (WhatsApp/Discord bridges over SQS) and their workflow are gone; the bridges live in `backend/channels/` and deploy with the backend.
- `.github/workflows/desktop-release.yml`, `mobile-ios.yml`, `mobile-android.yml` — on `v*` tags; see `docs/mobile-release.md`.

## Key Components

### Docker Configuration
- `docker-compose.yaml` - Multi-service Docker Compose configuration
- Uses `../backend/Dockerfile`
- PostgreSQL database with pgvector extension
- Development and production service profiles

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
- `package.json` - Prisma and API smoke scripts
- `jest.config.js` - Jest configuration for infrastructure tests
- `Makefile` - Infrastructure-specific build and deployment commands

## Dependencies

### External Dependencies
- **Docker & Docker Compose**: Container orchestration
- **Terraform**: Infrastructure as Code
- **PostgreSQL**: Database with pgvector extension
- **Node.js**: Runtime for test execution

### Internal Dependencies
- `../backend/` - Backend service and Dockerfile
- `../prisma/` - Database schema and initialization
- `../shared/` - Shared types and utilities

## Data Inputs/Outputs

### Input Sources
- Docker Compose service definitions
- Terraform configuration files
- Environment variables and secrets
- The backend Dockerfile

### Output Destinations
- Running Docker containers
- Cloud infrastructure resources
- Test execution reports
- Deployment artifacts
- Container images

## Events Handled
- Container lifecycle management
- Database initialization and seeding
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

### Service Profiles
- `db-only` - PostgreSQL only
- `backend` - backend and database
- `full` - backend, database, Temporal

The web app is not containerized: run it with `npm run dev:web` (or `npm test` in `web/` for its regression suite).

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
docker-compose --profile full up

# Build and start
docker-compose up --build

# Clean up
docker-compose down -v
```

### API Testing
```bash
# Run authentication flow tests
npm run test:api

# Test WebSocket connections
npm run test:api:ws

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
- [ ] Add performance testing with load scenarios