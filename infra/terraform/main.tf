terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }

    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }

    local = {
      source = "hashicorp/local"
    }

    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  backend "gcs" {
    bucket = "fos-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

provider "google-beta" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# Cloudflare provider removed - using GCP for static hosting
# provider "cloudflare" {
#   api_token = var.CLOUDFLARE_TOKEN
# }
