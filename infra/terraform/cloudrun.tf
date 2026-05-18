# GCP Cloud Run for Backend Service

# Enable required APIs
resource "google_project_service" "cloudrun_api" {
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "vpcaccess_api" {
  service            = "vpcaccess.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secretmanager_api" {
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "sql_api" {
  service            = "sqladmin.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "compute_api" {
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "servicenetworking_api" {
  service            = "servicenetworking.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "aiplatform_api" {
  service            = "aiplatform.googleapis.com"
  disable_on_destroy = false
}

# VPC Connector for Cloud Run to access Cloud SQL via private IP
resource "google_vpc_access_connector" "connector" {
  name          = "fos-vpc-connector-${var.environment}"
  region        = var.gcp_region
  network       = google_compute_network.vpc_network.name
  ip_cidr_range = "10.8.0.0/28"

  depends_on = [
    google_project_service.vpcaccess_api,
    google_compute_network.vpc_network
  ]
}

# Cloud Run Service for Backend
resource "google_cloud_run_v2_service" "backend" {
  name     = "fos-backend-${var.environment}"
  location = var.gcp_region

  template {
    service_account = google_service_account.fos_cloudrun_sa.email

    scaling {
      min_instance_count = var.environment == "prod" ? 1 : 0
      max_instance_count = var.environment == "prod" ? 10 : 3
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      # Image will be updated by CI/CD pipeline
      image = "gcr.io/${var.gcp_project_id}/fos-backend:latest"

      ports {
        container_port = 80
      }

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      # Environment variables from Secret Manager
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "STRIPE_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.stripe_token.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "STRIPE_WEBHOOK_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.stripe_webhook_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "POSTMARK_API_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.postmark_token.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "EMAIL_WEBHOOK_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.email_webhook_pwd.secret_id
            version = "latest"
          }
        }
      }

      # Direct environment variables
      env {
        name  = "NODE_ENV"
        value = local.node_env[terraform.workspace]
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.gcp_project_id
      }

      env {
        name  = "GCP_REGION"
        value = var.gcp_region
      }

      env {
        name  = "PUBSUB_INBOX_TOPIC"
        value = google_pubsub_topic.inbox_topic.name
      }

      env {
        name  = "PUBSUB_OUTBOX_TOPIC"
        value = google_pubsub_topic.outbox_topic.name
      }

      env {
        name  = "CLOUD_SQL_CONNECTION_NAME"
        value = google_sql_database_instance.postgres.connection_name
      }

      # Qdrant configuration - Disabled for now (external Qdrant not yet configured)
      # env {
      #   name  = "QDRANT_URL"
      #   value = "http://qdrant:6333" # Update if using external Qdrant
      # }
    }

    # Cloud SQL connections
    # Note: This is an alternative to VPC connector for Cloud SQL access
    # volumes {
    #   name = "cloudsql"
    #   cloud_sql_instance {
    #     instances = [google_sql_database_instance.postgres.connection_name]
    #   }
    # }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.cloudrun_api,
    google_sql_database_instance.postgres,
    google_vpc_access_connector.connector
  ]
}

# IAM policy to allow public access (adjust based on your needs)
resource "google_cloud_run_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.backend.location
  service  = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Cloud Run Service for Frontend (optional - can use Cloudflare Pages)
# resource "google_cloud_run_v2_service" "frontend" {
#   name     = "fos-frontend-${var.environment}"
#   location = var.gcp_region
#
#   template {
#     service_account = google_service_account.fos_cloudrun_sa.email
#
#     scaling {
#       min_instance_count = var.environment == "prod" ? 1 : 0
#       max_instance_count = var.environment == "prod" ? 5 : 2
#     }
#
#     containers {
#       image = "gcr.io/${var.gcp_project_id}/fos-frontend:latest"
#
#       ports {
#         container_port = 80
#       }
#
#       resources {
#         limits = {
#           cpu    = "1"
#           memory = "512Mi"
#         }
#       }
#
#       env {
#         name  = "FOS_API_URL"
#         value = google_cloud_run_v2_service.backend.uri
#       }
#     }
#   }
#
#   traffic {
#     type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
#     percent = 100
#   }
# }
