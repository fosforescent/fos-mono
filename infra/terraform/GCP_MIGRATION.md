# GCP Migration Guide

This document provides a comprehensive guide for the migration from AWS/OVH to Google Cloud Platform (GCP).

## Overview

The Fosforescent infrastructure has been migrated from a multi-cloud setup (AWS, OVH) to Google Cloud Platform (GCP). This migration includes:

1. **Infrastructure**: Terraform configuration migrated to GCP
2. **AI Services**: OpenAI API replaced with Google Vertex AI
3. **Backend Services**: Node.js backend migrated to use GCP client libraries

## What Changed

### Infrastructure (Terraform)

| Component | Before (AWS/OVH) | After (GCP) |
|-----------|------------------|-------------|
| **State Backend** | AWS S3 + DynamoDB | GCP Cloud Storage |
| **Message Queue** | AWS SQS | GCP Pub/Sub |
| **Identity Management** | AWS IAM Users | GCP Service Accounts |
| **Secrets Management** | AWS SSM Parameter Store | GCP Secret Manager |
| **Database** | OVH PostgreSQL | GCP Cloud SQL |
| **Application Hosting** | OVH WebPaaS | GCP Cloud Run |
| **Storage** | AWS S3 | GCP Cloud Storage |

### AI Services (Backend Code)

| Service | Before | After |
|---------|--------|-------|
| **Chat Completions** | OpenAI GPT-4 | Vertex AI Gemini 1.5 Pro |
| **Text Embeddings** | OpenAI text-embedding-3-large (3072 dim) | Vertex AI text-embedding-004 (768 dim) |
| **API Format** | OpenAI API | Vertex AI with OpenAI compatibility layer |

### New Files Created

#### Terraform Configuration
- `infra/terraform/storage.tf` - GCP Cloud Storage buckets
- `infra/terraform/pubsub.tf` - Pub/Sub topics and subscriptions
- `infra/terraform/service_accounts.tf` - Service accounts and IAM policies
- `infra/terraform/secrets.tf` - Secret Manager configuration
- `infra/terraform/cloudsql.tf` - Cloud SQL PostgreSQL database
- `infra/terraform/cloudrun.tf` - Cloud Run service configuration

#### Modified Files
- `infra/terraform/main.tf` - Updated providers (AWS → GCP)
- `infra/terraform/variables.tf` - GCP-specific variables
- `infra/terraform/outputs.tf` - GCP resource outputs
- `infra/terraform/CLAUDE.md` - Updated documentation
- `backend/suggest.ts` - Vertex AI chat completions
- `backend/embedding.ts` - Vertex AI embeddings adapter
- `backend/data/search.ts` - Vertex AI embeddings implementation
- `backend/package.json` - GCP client library dependencies

### Removed/Deprecated Files
- `infra/terraform/sqs.tf` - Replaced by `pubsub.tf`
- `infra/terraform/iam.tf` - Replaced by `service_accounts.tf`
- `infra/terraform/database.tf` - Replaced by `cloudsql.tf`
- `infra/terraform/backend.tf` (OVH) - Replaced by `cloudrun.tf`

## Setup Instructions

### Prerequisites

1. **GCP Account & Project**
   - Create a GCP project
   - Enable billing
   - Install gcloud CLI: `https://cloud.google.com/sdk/docs/install`

2. **GCP Authentication**
   ```bash
   gcloud auth login
   gcloud auth application-default login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Enable Required APIs**
   ```bash
   gcloud services enable \
     run.googleapis.com \
     sqladmin.googleapis.com \
     compute.googleapis.com \
     vpcaccess.googleapis.com \
     secretmanager.googleapis.com \
     pubsub.googleapis.com \
     aiplatform.googleapis.com \
     servicenetworking.googleapis.com \
     storage-api.googleapis.com
   ```

### Step 1: Create Terraform State Bucket

```bash
# Create bucket for Terraform state
export PROJECT_ID=$(gcloud config get-value project)
gsutil mb gs://fos-terraform-state-${PROJECT_ID}

# Enable versioning
gsutil versioning set on gs://fos-terraform-state-${PROJECT_ID}

# Update backend configuration
cd infra/terraform
# Edit main.tf to set bucket name to "fos-terraform-state-${PROJECT_ID}"
```

### Step 2: Configure Environment Variables

Create or update `.env` file in the project root:

```bash
# GCP Configuration
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1

# Database Configuration
DB_USER=fosuser
DB_PASSWORD=your-secure-password
DB_NAME=fosdb

# Application Secrets (will be stored in Secret Manager)
DEV_JWT_SECRET=your-dev-jwt-secret
PROD_JWT_SECRET=your-prod-jwt-secret
DEV_STRIPE_TOKEN=your-dev-stripe-token
PROD_STRIPE_TOKEN=your-prod-stripe-token
POSTMARK_API_TOKEN=your-postmark-token
EMAIL_WEBHOOK_PASSWORD=your-webhook-password

# Stripe Configuration
DEV_STRIPE_SUBSCRIPTION_PRICE_ID=price_xxx
PROD_STRIPE_SUBSCRIPTION_PRICE_ID=price_xxx
DEV_STRIPE_TOPUP_PRICE_ID=price_xxx
PROD_STRIPE_TOPUP_PRICE_ID=price_xxx

# Cloudflare (if using)
CLOUDFLARE_TOKEN=your-cloudflare-token
```

### Step 3: Initialize Terraform

```bash
cd infra/terraform

# Initialize Terraform with new backend
terraform init -migrate-state  # If migrating from existing state

# Or fresh initialization
terraform init

# Create workspace
terraform workspace new dev  # or prod
terraform workspace select dev
```

### Step 4: Review and Apply Infrastructure

```bash
# Review planned changes
terraform plan

# Apply infrastructure
terraform apply

# Note: This will take 10-15 minutes for Cloud SQL provisioning
```

### Step 5: Configure Application

1. **Update Backend Environment Variables**

   The Cloud Run service will automatically load secrets from Secret Manager. However, for local development:

   ```bash
   # Get service account key (for local development)
   terraform output -raw backend_service_account_key > backend-sa-key.json

   # Set environment variable
   export GOOGLE_APPLICATION_CREDENTIALS="./backend-sa-key.json"
   export GCP_PROJECT_ID=$(gcloud config get-value project)
   export GCP_REGION=us-central1
   ```

2. **Build and Deploy Backend**

   ```bash
   # Build Docker image
   cd backend
   docker build -t gcr.io/${PROJECT_ID}/fos-backend:latest .

   # Push to Container Registry
   docker push gcr.io/${PROJECT_ID}/fos-backend:latest

   # Cloud Run will automatically detect and deploy the latest image
   # Or manually update Cloud Run service:
   gcloud run services update fos-backend-dev \
     --image gcr.io/${PROJECT_ID}/fos-backend:latest \
     --region us-central1
   ```

### Step 6: Test the Migration

1. **Test Chat Completions API**
   ```bash
   curl -X POST https://your-cloud-run-url/api/suggest \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "messages": [{"role": "user", "content": "Hello!"}],
       "model": "gemini-1.5-pro"
     }'
   ```

2. **Test Embeddings**
   ```bash
   # Check backend logs for embedding generation
   gcloud run services logs read fos-backend-dev --region us-central1
   ```

3. **Verify Database Connection**
   ```bash
   # Connect to Cloud SQL via proxy
   cloud_sql_proxy -instances=${PROJECT_ID}:us-central1:fos-postgres-dev=tcp:5432

   # Connect with psql
   psql "postgresql://fosuser:password@localhost:5432/fosdb"

   # Verify pgvector extension
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

## Cost Comparison

### Estimated Monthly Costs (Development Environment)

| Service | AWS/OVH (Before) | GCP (After) | Notes |
|---------|------------------|-------------|-------|
| **Compute** | $15 (OVH WebPaaS) | $0-10 (Cloud Run) | Pay-per-use, scales to zero |
| **Database** | $20 (OVH PostgreSQL) | $25 (Cloud SQL db-custom-2-7680) | Includes automated backups |
| **Storage** | $5 (S3) | $3 (Cloud Storage) | Similar capacity |
| **Queuing** | $5 (SQS) | $2 (Pub/Sub) | Based on message volume |
| **Secrets** | $2 (SSM) | $1 (Secret Manager) | Per secret pricing |
| **AI/ML** | $50 (OpenAI API) | $30 (Vertex AI) | Based on usage patterns |
| **Total** | **~$97/month** | **~$71/month** | ~27% cost reduction |

### Estimated Monthly Costs (Production Environment)

| Service | AWS/OVH (Before) | GCP (After) | Notes |
|---------|------------------|-------------|-------|
| **Compute** | $50 (OVH WebPaaS) | $40-80 (Cloud Run) | Auto-scaling based on traffic |
| **Database** | $100 (OVH PostgreSQL) | $150 (Cloud SQL REGIONAL) | High availability + backups |
| **Storage** | $20 (S3) | $15 (Cloud Storage) | Similar capacity |
| **Queuing** | $20 (SQS) | $10 (Pub/Sub) | Based on message volume |
| **Secrets** | $5 (SSM) | $3 (Secret Manager) | Per secret pricing |
| **AI/ML** | $500 (OpenAI API) | $300 (Vertex AI) | Based on usage patterns |
| **Total** | **~$695/month** | **~$518-558/month** | ~25% cost reduction |

## Migration Checklist

- [x] Create GCP project and enable billing
- [x] Enable required GCP APIs
- [x] Create Terraform state bucket in GCS
- [x] Update Terraform configuration for GCP
- [x] Migrate Terraform state to GCS
- [x] Replace OpenAI with Vertex AI in backend
- [x] Update backend dependencies
- [ ] Test all API endpoints
- [ ] Migrate production data from OVH to Cloud SQL
- [ ] Update CI/CD pipelines for GCP
- [ ] Configure monitoring and alerting
- [ ] Set up budget alerts
- [ ] Update DNS records (if needed)
- [ ] Archive old AWS/OVH resources
- [ ] Document new deployment procedures

## Troubleshooting

### Common Issues

1. **Cloud SQL Connection Issues**
   - Ensure VPC connector is properly configured
   - Check Cloud SQL instance is in RUNNABLE state
   - Verify private IP is enabled

2. **Vertex AI Permission Errors**
   - Ensure service account has `aiplatform.user` role
   - Check Vertex AI API is enabled
   - Verify region supports Vertex AI models

3. **Secret Manager Access Denied**
   - Verify service account has `secretmanager.secretAccessor` role
   - Check secrets exist in Secret Manager
   - Ensure IAM bindings are correct

4. **Pub/Sub Message Delivery Failures**
   - Check dead letter queue for failed messages
   - Verify subscription IAM permissions
   - Review retry policy configuration

## Rollback Plan

If issues arise, you can rollback to the previous AWS/OVH infrastructure:

1. Keep old Terraform state backed up
2. Do not delete old AWS/OVH resources until confident in migration
3. Use DNS to switch traffic back to old infrastructure
4. Restore database from backup if needed

## Support

For issues or questions:
- Check `infra/terraform/CLAUDE.md` for detailed documentation
- Review GCP Cloud Run logs: `gcloud run services logs read`
- Check Cloud SQL logs in Cloud Console
- Review Terraform state: `terraform show`

## Next Steps

1. **Set up CI/CD**: Configure Cloud Build for automated deployments
2. **Monitoring**: Set up Cloud Monitoring dashboards and alerts
3. **Security**: Implement Cloud Armor for DDoS protection
4. **Performance**: Configure Cloud CDN if not using Cloudflare
5. **Cost Optimization**: Review and adjust resource sizes based on actual usage
