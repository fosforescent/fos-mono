locals {
  env_vars = { for tuple in regexall("(.*)=(.*)", file("../.env")) : tuple[0] => tuple[1] }

  gcp_project = {
    dev  = local.env_vars["GCP_PROJECT"]
    prod = local.env_vars["GCP_PROJECT"]
  }

  stripe_token = {
    dev  = local.env_vars["DEV_STRIPE_TOKEN"]
    prod = local.env_vars["PROD_STRIPE_TOKEN"]
  }

  stripe_subscription_price_id = {
    dev  = local.env_vars["DEV_STRIPE_SUBSCRIPTION_PRICE_ID"]
    prod = local.env_vars["PROD_STRIPE_SUBSCRIPTION_PRICE_ID"]
  }

  stripe_topup_price_id = {
    dev  = local.env_vars["DEV_STRIPE_TOPUP_PRICE_ID"]
    prod = local.env_vars["PROD_STRIPE_TOPUP_PRICE_ID"]
  }

  postmark_token = {
    dev  = local.env_vars["POSTMARK_API_TOKEN"]
    prod = local.env_vars["POSTMARK_API_TOKEN"]
  }

  email_webhook_pwd = {
    dev  = local.env_vars["EMAIL_WEBHOOK_PASSWORD"]
    prod = local.env_vars["EMAIL_WEBHOOK_PASSWORD"]
  }

  openai_api_key = {
    dev  = local.env_vars["OPENAI_API_KEY"]
    prod = local.env_vars["OPENAI_API_KEY"]
  }

  pinecone_api_key = {
    dev  = local.env_vars["PINECONE_API_KEY"]
    prod = local.env_vars["PINECONE_API_KEY"]
  }

  jwt_secret = {
    dev  = local.env_vars["DEV_JWT_SECRET"]
    prod = local.env_vars["PROD_JWT_SECRET"]
  }

  node_env = {
    dev  = "development"
    prod = "production"
  }

  env = terraform.workspace

  fos_domain = {
    dev  = "dev.fosforescent.com"
    prod = "fosforescent.com"
  }

  db_cluster_version = {
    dev  = "15"
    prod = "15"
  }

  db_cluster_name = {
    dev  = "dev-fos-postgres-cluster"
    prod = "fos-postgres-cluster"
  }

  db_cluster_region = {
    dev  = "nyc1"
    prod = "nyc1"
  }


  db_cluster_size = {
    dev  = "db-s-1vcpu-1gb"
    prod = "db-s-1vcpu-1gb"
  }

  db_cluster_node_count = {
    dev  = 1
    prod = 1
  }

  fos_db_name = {
    dev  = "dev-fos-web-backend"
    prod = "fos-web-backend"
  }

  fos_db_user_name = {
    dev  = "dev-fos-web-backend-user"
    prod = "fos-web-backend-user"
  }

  cf_pages_name = {
    dev  = "fos-dev"
    prod = "fos-prod"
  }

  cf_pages_branch = {
    dev  = "dev"
    prod = "main"
  }


  do_app_branch = {
    dev  = "dev"
    prod = "main"
  }

  fos_api_domain_prefix = {
    dev  = "dev-api"
    prod = "api"
  }

  fos_web_domain_prefix = {
    dev  = "dev-api"
    prod = "api"
  }

}

