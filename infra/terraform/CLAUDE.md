# CLAUDE.md

## Directory Summary

Terraform-based infrastructure as code for deploying and managing the Fosforescent application on Google Cloud Platform (GCP) with Cloudflare for CDN and DNS.

### Dependencies
- **Terraform**: Infrastructure as code tool (version ~> 1.6.3)
- **Google Cloud Provider**: GCP infrastructure management (version ~> 5.0)
- **Google Cloud Beta Provider**: GCP beta features (version ~> 5.0)
- **Cloudflare Provider**: CDN, DNS, and Pages deployment (version ~> 4.0)
- **Random Provider**: Random password generation (version ~> 3.5)
- **Local Provider**: Local file and configuration management

### Data Inputs

#### Configuration Variables
- **Provider Credentials**: API keys and authentication tokens
- **Domain Configuration**: DNS settings and domain names
- **Database Settings**: Connection strings and instance specifications
- **Application Config**: Environment-specific settings and secrets

#### Terraform State
- **Resource State**: Current infrastructure state tracking
- **State Backend**: Remote state storage configuration
- **State Locking**: Concurrent execution prevention
- **Import Operations**: Existing resource integration

### Data Outputs

#### Cloud Infrastructure
- **GCP Cloud Run**: Backend service deployment with auto-scaling
- **GCP Cloud SQL**: PostgreSQL database with pgvector extension
- **GCP Pub/Sub**: Message queuing for event processing
- **GCP Secret Manager**: Secure secrets and credentials storage
- **GCP Cloud Storage**: Application data and Terraform state storage
- **GCP Service Accounts**: Identity and access management
- **Cloudflare Pages**: Frontend deployment and hosting (optional)
- **DNS Configuration**: Domain routing and subdomain management
- **CDN Setup**: Content delivery and performance optimization

#### Configuration Files
- **Environment Variables**: Generated configuration for Cloud Run
- **Connection Strings**: Database and service connection details via Secret Manager
- **SSL Certificates**: Automated certificate management via Cloud Run
- **Service Account Keys**: Authentication for external services

### Events Handled
- **Infrastructure Deployment**: Initial resource creation
- **Configuration Updates**: Environment and setting changes
- **Scaling Operations**: Resource scaling up/down
- **Backup Management**: Automated backup configuration
- **Security Updates**: Certificate renewal and security patches

### Data Transformations
- **Terraform Config → Cloud Resources**: Infrastructure code deployed to cloud providers
- **Variables → Environment Config**: Terraform variables converted to application configuration
- **State Changes → Resource Updates**: Infrastructure modifications tracked and applied
- **Outputs → Connection Details**: Resource information exposed for application consumption

### Infrastructure Components

#### Frontend Hosting
- **Cloudflare Pages**: Static site hosting with global CDN (optional)
- **Domain Management**: DNS configuration and SSL certificates
- **Performance Optimization**: Caching and content delivery
- **Security Features**: DDoS protection and security headers

#### Backend Infrastructure (GCP)
- **Cloud Run**: Serverless container deployment with auto-scaling
  - Minimum instances: 0 (dev) or 1 (prod)
  - Maximum instances: 3 (dev) or 10 (prod)
  - CPU: 2 vCPU, Memory: 2Gi
  - VPC connector for private database access
- **Cloud SQL**: Managed PostgreSQL database
  - PostgreSQL 15 with pgvector extension enabled
  - High availability: REGIONAL (prod) or ZONAL (dev)
  - Automated backups with point-in-time recovery (prod)
  - Private IP with VPC peering
- **Pub/Sub**: Message queuing and event processing
  - Inbox/Outbox topics with dead letter queues
  - 14-day message retention
  - Automatic retry with exponential backoff
- **Secret Manager**: Centralized secrets management
  - Database credentials, API keys, JWT secrets
  - Automatic replication across regions
  - IAM-based access control
- **Cloud Storage**: Object storage for application data
  - Terraform state storage with versioning
  - Application data bucket with lifecycle policies

#### Service Accounts & IAM
- **Backend Service Account**: Full access to all backend services
  - Pub/Sub publisher/subscriber
  - Cloud SQL client
  - Secret Manager accessor
  - Cloud Storage admin
  - Vertex AI user
- **Event Services Service Account**: Limited to Pub/Sub access
- **Cloud Run Service Account**: Runtime service account
  - Cloud SQL client
  - Secret Manager accessor
  - Pub/Sub publisher
  - Cloud Storage viewer
  - Vertex AI user

#### Networking
- **VPC Network**: Custom VPC for private resources
- **VPC Peering**: Cloud SQL private IP connectivity
- **VPC Connector**: Cloud Run to VPC access (10.8.0.0/28)
- **DNS Management**: Domain and subdomain configuration
- **SSL/TLS**: Automatic certificate management via Cloud Run
- **Security Policies**: IAM roles and network security

### Deployment Features
- **Multi-Environment**: Development and production workspaces
- **Zero-Downtime Deployment**: Cloud Run gradual traffic migration
- **Rollback Capability**: Cloud Run revision management
- **Automated Provisioning**: Terraform-based infrastructure deployment
- **CI/CD Integration**: Container registry and Cloud Build support

### Security Management
- **Secret Manager**: Encrypted storage of all sensitive credentials
- **Service Account Keys**: IAM-based authentication for services
- **Network Security**: VPC-based private networking for databases
- **Certificate Management**: Automatic SSL/TLS via Cloud Run
- **Backup Encryption**: Automated encrypted backups for Cloud SQL

### AI/ML Integration
- **Vertex AI**: Google Cloud's unified AI platform
  - **Chat Completions**: Gemini 1.5 Pro model for conversational AI
  - **Text Embeddings**: text-embedding-004 model for semantic search
  - **IAM Integration**: Service accounts with aiplatform.user role
  - **OpenAI Compatibility**: Request/response format conversion
- **Migration from OpenAI**:
  - Replaced OpenAI Chat Completions API with Vertex AI Gemini
  - Replaced OpenAI Embeddings (text-embedding-3-large) with Vertex AI
  - Maintained backward compatibility with OpenAI request formats

### Monitoring and Logging
- **Cloud Logging**: Centralized log aggregation for all services
- **Cloud Monitoring**: Infrastructure and application metrics
- **Cloud SQL Insights**: Query performance and optimization
- **Cloud Run Metrics**: Request latency, error rates, instance counts
- **Alerting**: Cloud Monitoring alerts for critical events

### Cost Optimization
- **Cloud Run**: Pay-per-use with scale-to-zero (dev environment)
- **Cloud SQL**: Right-sized instances with disk autoresize
- **Pub/Sub**: Pay only for messages published and delivered
- **Auto-scaling**: Dynamic instance allocation based on traffic
- **Budget Alerts**: Cost tracking and budget notifications

### Migration Guide (AWS/OVH to GCP)

#### Replaced Services
- **AWS S3 → GCP Cloud Storage**: Terraform state backend
- **AWS DynamoDB → GCS Object Locking**: State locking mechanism
- **AWS SQS → GCP Pub/Sub**: Message queuing (inbox/outbox)
- **AWS IAM Users → GCP Service Accounts**: Identity management
- **AWS SSM Parameter Store → GCP Secret Manager**: Secrets storage
- **OVH Database → GCP Cloud SQL**: PostgreSQL hosting
- **OVH WebPaaS → GCP Cloud Run**: Application hosting

#### Setup Requirements
1. **Create GCS Bucket for Terraform State**:
   ```bash
   gsutil mb gs://fos-terraform-state-<project-id>
   gsutil versioning set on gs://fos-terraform-state-<project-id>
   ```

2. **Enable Required GCP APIs**:
   - Cloud Run API
   - Cloud SQL Admin API
   - Compute Engine API
   - VPC Access API
   - Secret Manager API
   - Pub/Sub API
   - Vertex AI API
   - Service Networking API

3. **Initialize Terraform**:
   ```bash
   cd infra/terraform
   terraform init
   terraform workspace new dev  # or prod
   terraform plan
   terraform apply
   ```

4. **Configure Environment Variables**:
   - Update `.env` file with GCP_PROJECT_ID
   - Configure service account credentials
   - Set GCP_REGION (default: us-central1)

## TODOs

### Completed (GCP Migration)
- [x] Migrate Terraform backend from AWS S3 to GCP Cloud Storage
- [x] Replace AWS SQS with GCP Pub/Sub for event processing
- [x] Replace AWS IAM with GCP Service Accounts and IAM policies
- [x] Replace AWS SSM Parameter Store with GCP Secret Manager
- [x] Replace OVH database with GCP Cloud SQL (PostgreSQL 15)
- [x] Replace OVH WebPaaS with GCP Cloud Run
- [x] Replace OpenAI Chat Completions with Vertex AI (Gemini 1.5 Pro)
- [x] Replace OpenAI Embeddings with Vertex AI (text-embedding-004)
- [x] Update backend code to use GCP client libraries
- [x] Add GCP-specific dependencies to package.json

### Pending
- [ ] Set up Cloud Build for CI/CD pipeline
- [ ] Configure Cloud Monitoring alerts and dashboards
- [ ] Implement Cloud Armor for DDoS protection
- [ ] Set up Cloud CDN (optional, if not using Cloudflare)
- [ ] Configure Budget Alerts for cost management
- [ ] Migrate Qdrant to GCP (currently external)
- [ ] Set up multi-region failover (prod environment)
- [ ] Implement automated database backups testing
- [ ] Configure Cloud Logging exports for long-term storage
- [ ] Set up Terraform remote state encryption