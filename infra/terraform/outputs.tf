# Pub/Sub Topic outputs
output "inbox_topic_name" {
  description = "Name of the inbox Pub/Sub topic"
  value       = google_pubsub_topic.inbox_topic.name
}

output "outbox_topic_name" {
  description = "Name of the outbox Pub/Sub topic"
  value       = google_pubsub_topic.outbox_topic.name
}

output "inbox_subscription_name" {
  description = "Name of the inbox Pub/Sub subscription"
  value       = google_pubsub_subscription.inbox_subscription.name
}

output "outbox_subscription_name" {
  description = "Name of the outbox Pub/Sub subscription"
  value       = google_pubsub_subscription.outbox_subscription.name
}

# Service Account outputs
output "backend_service_account_email" {
  description = "Email of the backend service account"
  value       = google_service_account.fos_backend_sa.email
}

output "event_services_service_account_email" {
  description = "Email of the event services service account"
  value       = google_service_account.fos_event_services_sa.email
}

output "cloudrun_service_account_email" {
  description = "Email of the Cloud Run service account"
  value       = google_service_account.fos_cloudrun_sa.email
}

# Cloud SQL outputs
output "database_instance_name" {
  description = "Name of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.name
}

output "database_connection_name" {
  description = "Connection name for Cloud SQL instance"
  value       = google_sql_database_instance.postgres.connection_name
}

output "database_private_ip" {
  description = "Private IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.private_ip_address
  sensitive   = true
}

output "database_public_ip" {
  description = "Public IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.public_ip_address
}

# Cloud Run outputs
output "backend_service_url" {
  description = "URL of the backend Cloud Run service"
  value       = google_cloud_run_v2_service.backend.uri
}

# Secret Manager outputs
output "secret_ids" {
  description = "IDs of created secrets in Secret Manager"
  value = {
    database_url        = google_secret_manager_secret.database_url.secret_id
    jwt_secret          = google_secret_manager_secret.jwt_secret.secret_id
    stripe_token        = google_secret_manager_secret.stripe_token.secret_id
    openai_api_key      = google_secret_manager_secret.openai_api_key.secret_id
    postmark_token      = google_secret_manager_secret.postmark_token.secret_id
    email_webhook_pwd   = google_secret_manager_secret.email_webhook_pwd.secret_id
    backend_sa_key      = google_secret_manager_secret.backend_sa_key.secret_id
    event_services_sa_key = google_secret_manager_secret.event_services_sa_key.secret_id
  }
}

# Storage outputs
output "app_data_bucket_name" {
  description = "Name of the application data storage bucket"
  value       = google_storage_bucket.app_data.name
}

# VPC outputs
output "vpc_network_name" {
  description = "Name of the VPC network"
  value       = google_compute_network.vpc_network.name
}

output "vpc_connector_name" {
  description = "Name of the VPC connector for Cloud Run"
  value       = google_vpc_access_connector.connector.name
}

# Service Account Keys (sensitive)
output "backend_service_account_key" {
  description = "Private key for backend service account (base64 encoded)"
  value       = google_service_account_key.backend_key.private_key
  sensitive   = true
}

output "event_services_service_account_key" {
  description = "Private key for event services service account (base64 encoded)"
  value       = google_service_account_key.event_services_key.private_key
  sensitive   = true
}
