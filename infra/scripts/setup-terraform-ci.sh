#!/usr/bin/env bash
# One-time setup for .github/workflows/deploy-infrastructure.yml (Terraform on push to main):
#   GCP_TERRAFORM_SA_KEY  JSON key of the terraform-admin service account (project owner)
#   TF_DOTENV             the repo-root .env, which infra/terraform/locals.tf reads secret values from
#   CLOUDFLARE_ACCOUNT_ID the Cloudflare account that hosts the Pages project (also used by deploy-backend.yml)
# Re-run to rotate the key or refresh TF_DOTENV after editing .env. Needs gcloud (owner) and gh (repo admin).
set -euo pipefail
PROJECT=${GCP_PROJECT:-fosforescent}
SA="terraform-admin@$PROJECT.iam.gserviceaccount.com"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$ROOT/.env" ] || { echo "no .env at $ROOT" >&2; exit 1; }

KEY=$(mktemp); trap 'rm -f "$KEY"' EXIT
gcloud iam service-accounts keys create "$KEY" --iam-account "$SA" --project "$PROJECT" --quiet
gh secret set GCP_TERRAFORM_SA_KEY < "$KEY"
echo "GCP_TERRAFORM_SA_KEY set ($SA)"
gh secret set TF_DOTENV < "$ROOT/.env"
echo "TF_DOTENV set ($(grep -c '^[A-Z_0-9]*=' "$ROOT/.env") entries)"
ACCOUNT_ID=$(grep -E '^CLOUDFLARE_ACCOUNT_ID=' "$ROOT/.env" | cut -d= -f2- | tr -d '"' || true)
ACCOUNT_ID=${ACCOUNT_ID:-${CLOUDFLARE_ACCOUNT_ID:-}}
if [ -n "$ACCOUNT_ID" ]; then gh secret set CLOUDFLARE_ACCOUNT_ID --body "$ACCOUNT_ID"; echo "CLOUDFLARE_ACCOUNT_ID set"; else echo "CLOUDFLARE_ACCOUNT_ID not found in .env; set it with: gh secret set CLOUDFLARE_ACCOUNT_ID --body <id>"; fi
echo "still needed by hand: gh secret set CLOUDFLARE_API_TOKEN   (API token with 'Cloudflare Pages: Edit')"
