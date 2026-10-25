# Infrastructure CLAUDE.md

## Directory Summary

Infrastructure configuration and deployment tools for Fosforescent: Docker Compose for local services, Terraform, the Prisma schema, and API smoke scripts.

## Deploying (GitHub Actions)

- **Backend and web app**: push to `main` or dispatch `.github/workflows/deploy-backend.yml` manually. Deploys authenticate with the `GCP_SA_KEY` secret; create or rotate it with `bash infra/scripts/setup-gcp-deployer.sh`.
- **Migrations** run only as part of the backend deploy. Migration SQL must be idempotent.
- **Infrastructure**: changes to `infra/terraform/**` go through `.github/workflows/deploy-infrastructure.yml`: plan on PRs; plan and apply on push to `main` (or manual dispatch with `action=apply`). Set its secrets (`GCP_TERRAFORM_SA_KEY`, `TF_DOTENV`, `TF_TFVARS`) with `infra/scripts/setup-terraform-ci.sh`, and re-run it after editing `.env` or `terraform.tfvars`.
- `terraform.tfvars` must hold the *real* database password, never its URL-encoded form; the composed `database_url` secret encodes it.
- **Desktop and mobile releases**: push a `v*` tag; see `docs/mobile-release.md`.

## Development Commands

The web app is not containerized: run it with `npm run dev:web`.

### Docker Operations
```bash
# Start all services
docker-compose up

# Start specific profile (db-only, backend, full)
docker-compose --profile backend up

# Build and start
docker-compose up --build

# Clean up
docker-compose down -v
```

### API Testing
```bash
# Authentication flow
npm run test:api

# WebSocket connections
npm run test:api:ws

# All API tests
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
- Infrastructure monitoring and alerting
- Automated backup and restore procedures
- Smaller Docker images and faster builds
- Blue-green deployment
- Infrastructure testing
- Secrets management with external tools
- Container security scanning
- Performance testing with load scenarios
