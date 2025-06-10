
variable "DO_TOKEN" {
  type = string
}

variable "CLOUDFLARE_TOKEN" {
  type = string
}

variable "SSH_FINGERPRINT" {
  type = string
}

variable "ovh_application_key" {
  type      = string
  sensitive = true
}

variable "ovh_application_secret" {
  type      = string
  sensitive = true
}

variable "ovh_consumer_key" {
  type      = string
  sensitive = true
}

variable "ovh_project_id" {
  type        = string
  description = "Your OVH Public Cloud Project ID"
}

variable "ovh_region" {
  type    = string
  default = "GRA" # Gravelines, France - or choose another region
}
