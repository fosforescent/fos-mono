# GCP Migration Guide

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

```

### Step 5: Configure Application

1. **Update Backend Environment Variables**

   For local development:

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

   # Update the Cloud Run service:
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
6. Test all API endpoints
7. Migrate production data from OVH to Cloud SQL
8. Set up budget alerts
9. Update DNS records (if needed)
10. Archive old AWS/OVH resources
11. Document new deployment procedures
