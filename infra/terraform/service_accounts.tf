# Service Accounts for Backend Service

# Backend Service Account
resource "google_service_account" "fos_backend_sa" {
  account_id   = "fos-backend-${var.environment}"
  display_name = "FOS Backend Service Account (${var.environment})"
  description  = "Service account for FOS backend service with Pub/Sub, Cloud SQL, and Storage access"
}

# Event Services Service Account
resource "google_service_account" "fos_event_services_sa" {
  account_id   = "fos-event-services-${var.environment}"
  display_name = "FOS Event Services Service Account (${var.environment})"
  description  = "Service account for FOS event services with Pub/Sub access"
}

# Cloud Run Service Account (for backend deployment)
resource "google_service_account" "fos_cloudrun_sa" {
  account_id   = "fos-cloudrun-${var.environment}"
  display_name = "FOS Cloud Run Service Account (${var.environment})"
  description  = "Service account for Cloud Run service with necessary permissions"
}

# IAM Roles for Backend Service Account

# Pub/Sub Publisher
resource "google_project_iam_member" "backend_pubsub_publisher" {
  project = var.gcp_project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.fos_backend_sa.email}"
}

# Pub/Sub Subscriber
resource "google_project_iam_member" "backend_pubsub_subscriber" {
  project = var.gcp_project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.fos_backend_sa.email}"
}

# Cloud SQL Client
resource "google_project_iam_member" "backend_cloudsql_client" {
  project = var.gcp_project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.fos_backend_sa.email}"
}

# Storage Object Admin (for app data bucket)
resource "google_storage_bucket_iam_member" "backend_storage_admin" {
  bucket = google_storage_bucket.app_data.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.fos_backend_sa.email}"
}

# Secret Manager Secret Accessor
resource "google_project_iam_member" "backend_secret_accessor" {
  project = var.gcp_project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.fos_backend_sa.email}"
}

# Vertex AI User (for AI/ML operations)
resource "google_project_iam_member" "backend_vertex_user" {
  project = var.gcp_project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.fos_backend_sa.email}"
}

# IAM Roles for Event Services Service Account

# Pub/Sub Publisher
resource "google_project_iam_member" "event_services_pubsub_publisher" {
  project = var.gcp_project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.fos_event_services_sa.email}"
}

# Pub/Sub Subscriber
resource "google_project_iam_member" "event_services_pubsub_subscriber" {
  project = var.gcp_project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.fos_event_services_sa.email}"
}

# IAM Roles for Cloud Run Service Account

# Cloud SQL Client
resource "google_project_iam_member" "cloudrun_cloudsql_client" {
  project = var.gcp_project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.fos_cloudrun_sa.email}"
}

# Secret Manager Secret Accessor
resource "google_project_iam_member" "cloudrun_secret_accessor" {
  project = var.gcp_project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.fos_cloudrun_sa.email}"
}

# Pub/Sub Publisher
resource "google_project_iam_member" "cloudrun_pubsub_publisher" {
  project = var.gcp_project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.fos_cloudrun_sa.email}"
}

# Storage Object Viewer (for app data bucket)
resource "google_storage_bucket_iam_member" "cloudrun_storage_viewer" {
  bucket = google_storage_bucket.app_data.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.fos_cloudrun_sa.email}"
}

# Vertex AI User
resource "google_project_iam_member" "cloudrun_vertex_user" {
  project = var.gcp_project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.fos_cloudrun_sa.email}"
}

# Service Account Keys (for local development and external access)
resource "google_service_account_key" "backend_key" {
  service_account_id = google_service_account.fos_backend_sa.name
}

resource "google_service_account_key" "event_services_key" {
  service_account_id = google_service_account.fos_event_services_sa.name
}
