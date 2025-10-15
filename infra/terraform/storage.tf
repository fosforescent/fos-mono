# GCS Bucket for Terraform State (created manually before terraform init)
# This file documents the expected state bucket configuration
# Bucket already created: gs://fos-terraform-state
# Not managed by Terraform to avoid circular dependency with backend

# resource "google_storage_bucket" "terraform_state" {
#   name          = "fos-terraform-state"
#   location      = var.gcp_region
#   force_destroy = false
#
#   uniform_bucket_level_access = true
#
#   versioning {
#     enabled = true
#   }
#
#   lifecycle_rule {
#     condition {
#       num_newer_versions = 3
#     }
#     action {
#       type = "Delete"
#     }
#   }
#
#   labels = {
#     environment = var.environment
#     managed_by  = "terraform"
#     purpose     = "state-storage"
#   }
# }

# GCS Bucket for application data
resource "google_storage_bucket" "app_data" {
  name          = "fos-app-data-${var.environment}-${var.gcp_project_id}"
  location      = var.gcp_region
  force_destroy = false

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
    purpose     = "application-data"
  }
}
