

resource "ovh_webpaas_project" "fos_app" {
  name    = "fosforescent"
  region  = "US"
  plan_id = "development" # €15/month plan

  environment {
    name = "production"
    type = "production"

    variables = {
      DATABASE_URL     = "postgresql://${var.db_user}:${var.db_password}@${var.db_host}:5432/${var.db_name}"
      STRIPE_TOKEN     = local.stripe_token[terraform.workspace]
      JWT_SECRET       = local.jwt_secret[terraform.workspace]
      PINECONE_API_KEY = local.pinecone_api_key[terraform.workspace]
      OPENAI_API_KEY   = local.openai_api_key[terraform.workspace]
      NODE_ENV         = local.node_env[terraform.workspace]
    }
  }

  service {
    name = "app"
    type = "nodejs:18"
    size = "S"
    disk = 2048

    build {
      flavor  = "none"
      command = "npm run build:backend"
    }

    web {
      command = "node dist/backend/index.js"
      port    = 3000
    }
  }

  service {
    name = "db"
    type = "postgresql:15"
    size = "S"
    disk = 2048
  }
}

resource "ovh_webpaas_domain" "fos_domain" {
  project_id = ovh_webpaas_project.fos_app.id
  domain     = "api.fosforescent.com"
}
