#!/bin/bash

# Script to extract Terraform outputs and set them as GitHub secrets
# Requires GitHub CLI (gh) to be installed and authenticated

set -e

echo "🚀 Setting up GitHub secrets from Terraform outputs..."

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed. Please install it first:"
    echo "   https://cli.github.com/"
    exit 1
fi

# Check if authenticated with GitHub
if ! gh auth status &> /dev/null; then
    echo "❌ Error: Not authenticated with GitHub CLI. Please run 'gh auth login' first."
    exit 1
fi

# Check if in a git repository
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
    echo "❌ Error: Not in a git repository."
    exit 1
fi

# Get the GitHub repository name
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "📍 Repository: $REPO"

# Check if terraform has been applied
if ! terraform show &> /dev/null; then
    echo "❌ Error: No Terraform state found. Please run 'terraform apply' first."
    exit 1
fi

echo "📥 Extracting Terraform outputs..."

# Get AWS region
AWS_REGION=$(terraform output -raw aws_region 2>/dev/null || echo "us-east-1")

# Get SQS Queue URLs
INBOX_QUEUE_URL=$(terraform output -raw inbox_queue_url)
OUTBOX_QUEUE_URL=$(terraform output -raw outbox_queue_url)

# Get Backend AWS Credentials
BACKEND_AWS_ACCESS_KEY_ID=$(terraform output -raw backend_aws_access_key_id)
BACKEND_AWS_SECRET_ACCESS_KEY=$(terraform output -raw backend_aws_secret_access_key)

# Get Event Services AWS Credentials
EVENT_SERVICES_AWS_ACCESS_KEY_ID=$(terraform output -raw event_services_aws_access_key_id)
EVENT_SERVICES_AWS_SECRET_ACCESS_KEY=$(terraform output -raw event_services_aws_secret_access_key)

echo "🔐 Setting GitHub repository secrets..."

# Set common secrets
gh secret set AWS_REGION --body "$AWS_REGION"
gh secret set INBOX_QUEUE_URL --body "$INBOX_QUEUE_URL"
gh secret set OUTBOX_QUEUE_URL --body "$OUTBOX_QUEUE_URL"

# Set Backend service secrets
gh secret set BACKEND_AWS_ACCESS_KEY_ID --body "$BACKEND_AWS_ACCESS_KEY_ID"
gh secret set BACKEND_AWS_SECRET_ACCESS_KEY --body "$BACKEND_AWS_SECRET_ACCESS_KEY"

# Set Event Services secrets
gh secret set EVENT_SERVICES_AWS_ACCESS_KEY_ID --body "$EVENT_SERVICES_AWS_ACCESS_KEY_ID"
gh secret set EVENT_SERVICES_AWS_SECRET_ACCESS_KEY --body "$EVENT_SERVICES_AWS_SECRET_ACCESS_KEY"

echo "✅ GitHub secrets set successfully!"
echo ""
echo "📋 Secrets created:"
echo "   - AWS_REGION"
echo "   - INBOX_QUEUE_URL"
echo "   - OUTBOX_QUEUE_URL"
echo "   - BACKEND_AWS_ACCESS_KEY_ID"
echo "   - BACKEND_AWS_SECRET_ACCESS_KEY"
echo "   - EVENT_SERVICES_AWS_ACCESS_KEY_ID"
echo "   - EVENT_SERVICES_AWS_SECRET_ACCESS_KEY"
echo ""
echo "💡 You may also want to add these platform-specific secrets manually:"
echo "   - WHATSAPP_TOKEN"
echo "   - WHATSAPP_PHONE_NUMBER_ID"
echo "   - WEBHOOK_VERIFY_TOKEN"
echo "   - DISCORD_TOKEN"
echo "   - CLOUDFLARE_TOKEN (if using Cloudflare)"
echo ""
echo "🔗 Manage secrets at: https://github.com/$REPO/settings/secrets/actions"