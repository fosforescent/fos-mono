terraform {
  required_version = "~> 1.6.3"

  required_providers {

    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = ">=2.34.0"
    }

    local = {
      source = "hashicorp/local"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }


  }


  backend "s3" {
    endpoints = {
      s3 = "https://sfo3.digitaloceanspaces.com/"
    }
    region                      = "us-west-1"
    key                         = "tfstate/fos/terraform.tfstate"
    bucket                      = "dmn-infra"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    skip_region_validation      = true
  }
}

# resource "random_id" "cluster_name" {
#   byte_length = 5
# }


provider "digitalocean" {
  token = var.DO_TOKEN
}

provider "cloudflare" {
  api_token = var.CLOUDFLARE_TOKEN
}



