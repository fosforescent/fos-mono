terraform {
  required_version = "~> 1.6.3"

  required_providers {



    local = {
      source = "hashicorp/local"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    # digitalocean = {
    #   source  = "digitalocean/digitalocean"
    #   version = ">=2.34.0"
    # }

  }


  # backend "s3" {
  #   endpoints = {
  #     s3 = "https://sfo3.digitaloceanspaces.com/"
  #   }
  #   region                      = "us-west-1"
  #   key                         = "tfstate/fos/terraform.tfstate"
  #   bucket                      = "dmn-infra"
  #   skip_credentials_validation = true
  #   skip_metadata_api_check     = true
  #   skip_requesting_account_id  = true
  #   skip_s3_checksum            = true
  #   skip_region_validation      = true
  # }
}

terraform {
  required_providers {
    ovh = {
      source  = "ovh/ovh"
      version = "~> 0.34.0"
    }
  }
}

provider "ovh" {
  endpoint           = "ovh-eu" # Use appropriate endpoint for your region
  application_key    = var.ovh_application_key
  application_secret = var.ovh_application_secret
  consumer_key       = var.ovh_consumer_key
}



provider "cloudflare" {
  api_token = var.CLOUDFLARE_TOKEN
}

# provider "digitalocean" {
#   token = var.DO_TOKEN

# }
