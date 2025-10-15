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

# Reserve static IP for load balancer
resource "google_compute_global_address" "frontend_ip" {
  name = "fos-frontend-ip-${var.environment}"
}

# Backend bucket for load balancer
resource "google_compute_backend_bucket" "frontend" {
  name        = "fos-frontend-backend-${var.environment}"
  bucket_name = google_storage_bucket.frontend.name
  enable_cdn  = true

  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    client_ttl        = 3600
    default_ttl       = 3600
    max_ttl           = 86400
    negative_caching  = true
    serve_while_stale = 86400
  }
}

# URL map for load balancer
resource "google_compute_url_map" "frontend" {
  name            = "fos-frontend-url-map-${var.environment}"
  default_service = google_compute_backend_bucket.frontend.id
}

# HTTP proxy
resource "google_compute_target_http_proxy" "frontend" {
  name    = "fos-frontend-http-proxy-${var.environment}"
  url_map = google_compute_url_map.frontend.id
}

# Global forwarding rule (HTTP)
resource "google_compute_global_forwarding_rule" "frontend_http" {
  name       = "fos-frontend-http-${var.environment}"
  target     = google_compute_target_http_proxy.frontend.id
  port_range = "80"
  ip_address = google_compute_global_address.frontend_ip.address
}

# HTTPS configuration (requires SSL certificate)
resource "google_compute_managed_ssl_certificate" "frontend" {
  name = "fos-frontend-cert-${var.environment}"

  managed {
    domains = [
      var.environment == "prod" ? "fosforescent.com" : "dev.fosforescent.com",
      var.environment == "prod" ? "www.fosforescent.com" : "www.dev.fosforescent.com"
    ]
  }
}

# HTTPS proxy
resource "google_compute_target_https_proxy" "frontend" {
  name             = "fos-frontend-https-proxy-${var.environment}"
  url_map          = google_compute_url_map.frontend.id
  ssl_certificates = [google_compute_managed_ssl_certificate.frontend.id]
}

# Global forwarding rule (HTTPS)
resource "google_compute_global_forwarding_rule" "frontend_https" {
  name       = "fos-frontend-https-${var.environment}"
  target     = google_compute_target_https_proxy.frontend.id
  port_range = "443"
  ip_address = google_compute_global_address.frontend_ip.address
}

# Output frontend URL and IP
output "frontend_bucket_name" {
  description = "Name of the frontend storage bucket"
  value       = google_storage_bucket.frontend.name
}

output "frontend_ip_address" {
  description = "IP address for the frontend load balancer"
  value       = google_compute_global_address.frontend_ip.address
}

output "frontend_url" {
  description = "Frontend URL"
  value       = var.environment == "prod" ? "https://fosforescent.com" : "https://dev.fosforescent.com"
}
