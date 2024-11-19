resource "digitalocean_app" "fos_app" {
  spec {
    name   = "fosforescent-app"
    region = "sfo3"

    # Source code based service
    service {
      name               = "web"
      instance_size_slug = "basic-xxs"
      instance_count     = 1

      github {
        repo           = "fosforescent/fos-mono"
        branch         = local.do_app_branch[terraform.workspace]
        deploy_on_push = true
      }


      dockerfile_path = "backend/Dockerfile"

      env {

        key   = "DATABASE_URL"
        value = "postgresql://${digitalocean_database_user.fos_user.name}:${digitalocean_database_user.fos_user.password}@${digitalocean_database_cluster.postgres_cluster.host}:${tostring(digitalocean_database_cluster.postgres_cluster.port)}/${digitalocean_database_db.fos_db.name}?connection_limit=5"
      }

      env {
        key   = "STRIPE_TOKEN"
        value = local.stripe_token[terraform.workspace]

      }

      env {
        key   = "JWT_SECRET"
        value = local.jwt_secret[terraform.workspace]
      }

      env {
        key   = "PINECONE_API_KEY"
        value = local.pinecone_api_key[terraform.workspace]
      }

      env {
        key   = "OPENAI_API_KEY"
        value = local.openai_api_key[terraform.workspace]
      }

      env {
        key   = "EMAIL_WEBHOOK_PASSWORD"
        value = local.email_webhook_pwd[terraform.workspace]
      }

      env {
        key   = "POSTMARK_API_TOKEN"
        value = local.postmark_token[terraform.workspace]
      }

      env {
        key   = "NODE_ENV"
        value = local.node_env[terraform.workspace]
      }

      env {
        key   = "STRIPE_TOPUP_PRICE_ID"
        value = local.stripe_topup_price_id[terraform.workspace]
      }

      env {
        key   = "STRIPE_SUBSCRIPTION_PRICE_ID"
        value = local.stripe_subscription_price_id[terraform.workspace]
      }


      health_check {
        http_path       = "/"
        timeout_seconds = 5
      }


    }
  }
}
