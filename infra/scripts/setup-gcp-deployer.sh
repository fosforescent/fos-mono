#!/usr/bin/env bash
# One-time setup for .github/workflows/deploy-backend.yml:
# creates the github-deployer service account with the minimum roles to push the
# backend image, sync the schema, roll Cloud Run and upload the web bucket, then
# stores its JSON key in the GCP_SA_KEY GitHub secret. Idempotent; re-run to
# rotate the key. Needs: gcloud (project owner), gh (repo admin).
set -euo pipefail
PROJECT=${GCP_PROJECT:-fosforescent}
REGION=${GCP_REGION:-us-central1}
SA_NAME=github-deployer
SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"
RUNTIME_SA=${RUNTIME_SA:-fos-cloudrun-dev@$PROJECT.iam.gserviceaccount.com}
WEB_BUCKET=${WEB_BUCKET:-fos-frontend-dev-$PROJECT}
DB_SECRET=${DB_SECRET:-fos-database-url-dev}

if ! gcloud iam service-accounts describe "$SA" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT" --display-name "GitHub Actions deployer"
fi
# a freshly created service account takes a few seconds to become bindable
bind() {
  local n=0
  until gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" --role "$1" --condition=None --quiet >/dev/null 2>&1; do
    n=$((n+1)); [ "$n" -ge 10 ] && { echo "could not bind $1" >&2; return 1; }; sleep 3
  done
  echo "  project role $1"
}
bind roles/run.admin                 # create Cloud Run revisions
bind roles/artifactregistry.writer   # push to gcr.io (hosted on Artifact Registry)
bind roles/cloudsql.client           # cloud-sql-proxy for prisma db push
# deploy revisions that run as the runtime service account
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --project "$PROJECT" --member "serviceAccount:$SA" --role roles/iam.serviceAccountUser --quiet >/dev/null && echo "  actAs $RUNTIME_SA"
# read the database url, write the web bucket
gcloud secrets add-iam-policy-binding "$DB_SECRET" --project "$PROJECT" --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor --quiet >/dev/null && echo "  read secret $DB_SECRET"
gcloud storage buckets add-iam-policy-binding "gs://$WEB_BUCKET" --member "serviceAccount:$SA" --role roles/storage.objectAdmin --quiet >/dev/null && echo "  write gs://$WEB_BUCKET"

KEY=$(mktemp)
trap 'rm -f "$KEY"' EXIT
gcloud iam service-accounts keys create "$KEY" --iam-account "$SA" --project "$PROJECT" --quiet
gh secret set GCP_SA_KEY < "$KEY"
echo "GCP_SA_KEY secret set for $SA"
# keep at most the two newest keys (rotation)
gcloud iam service-accounts keys list --iam-account "$SA" --project "$PROJECT" --managed-by user --format "value(name)" --sort-by ~validAfterTime | tail -n +3 | while read -r k; do gcloud iam service-accounts keys delete "$k" --iam-account "$SA" --project "$PROJECT" --quiet; done
