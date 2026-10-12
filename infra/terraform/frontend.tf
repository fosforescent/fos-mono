# GCP Static Website Hosting for Frontend
# Uses Cloud Storage + Cloud Load Balancer + Cloud CDN

# Storage bucket for frontend static files
resource "google_storage_bucket" "frontend" {
  name          = "fos-frontend-${var.environment}-${var.gcp_project_id}"
  location      = "US"
  force_destroy = false

  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html" # SPA routing
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
    purpose     = "frontend-hosting"
  }
}

# Make bucket publicly readable
resource "google_storage_bucket_iam_member" "frontend_public" {
  bucket = google_storage_bucket.frontend.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# The HTTPS load balancer in front of this bucket was removed; fosforescent.com is served by
# Cloudflare Pages (.github/workflows/deploy-backend.yml). The bucket stays for static assets.

output "frontend_bucket_name" {
  description = "Name of the frontend storage bucket"
  value       = google_storage_bucket.frontend.name
}
