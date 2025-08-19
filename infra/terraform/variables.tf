
variable "aws_region" {
  type        = string
  description = "AWS region for resources"
  default     = "us-east-1"
}

variable "CLOUDFLARE_TOKEN" {
  type        = string
  description = "Cloudflare API token"
  sensitive   = true
}

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
  default     = "dev"
}
