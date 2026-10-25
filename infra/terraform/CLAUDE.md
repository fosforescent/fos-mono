# CLAUDE.md

## Directory Summary

Terraform infrastructure as code for deploying the Fosforescent application on Google Cloud Platform (GCP), with Cloudflare for CDN and DNS.

## Setup

1. Create the GCS bucket for Terraform state:
   ```bash
   gsutil mb gs://fos-terraform-state-<project-id>
   gsutil versioning set on gs://fos-terraform-state-<project-id>
   ```

2. Enable the required GCP APIs: Cloud Run, Cloud SQL Admin, Compute Engine, Secret Manager, Pub/Sub, Vertex AI.

3. Initialize Terraform:
   ```bash
   cd infra/terraform
   terraform init
   terraform workspace new dev  # or prod
   terraform plan
   terraform apply
   ```

4. Configure environment variables: set `GCP_PROJECT_ID` and `GCP_REGION` in `.env` and configure the service account credentials.

## TODOs

- Set up a CI/CD pipeline for infrastructure changes
- Configure Cloud Monitoring alerts and dashboards
- Implement Cloud Armor for DDoS protection
- Set up Cloud CDN (optional, if not using Cloudflare)
- Configure budget alerts for cost management
- Set up multi-region failover (prod environment)
- Test database backups automatically
- Configure Cloud Logging exports for long-term storage
- Encrypt Terraform remote state
