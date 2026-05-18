
variable "gcp_project_id" {
  type        = string
  description = "GCP project ID"
}

variable "gcp_region" {
  type        = string
  description = "GCP region for resources"
  default     = "us-central1"
}

variable "gcp_zone" {
  type        = string
  description = "GCP zone for resources"
  default     = "us-central1-a"
}

# Cloudflare no longer needed - using GCP for static hosting
# variable "CLOUDFLARE_TOKEN" {
#   type        = string
#   description = "Cloudflare API token"
#   sensitive   = true
# }

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
  default     = "dev"
}

variable "db_user" {
  type        = string
  description = "Database user"
  default     = "fosuser"
}

variable "db_password" {
  type        = string
  description = "Database password"
  sensitive   = true
}

variable "db_name" {
  type        = string
  description = "Database name"
  default     = "fosdb"
}
