# GCP Secret Manager for application secrets

# Database connection string
resource "google_secret_manager_secret" "database_url" {
  secret_id = "fos-database-url-${var.environment}"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgresql://${var.db_user}:${urlencode(var.db_password)}@localhost/${var.db_name}?host=/cloudsql/${google_sql_database_instance.postgres.connection_name}"
}

# JWT Secret
resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "fos-jwt-secret-${var.environment}"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = local.jwt_secret[terraform.workspace]
}

# Stripe API Token
resource "google_secret_manager_secret" "stripe_token" {
  secret_id = "fos-stripe-token-${var.environment}"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_secret_manager_secret_version" "stripe_token" {
  secret      = google_secret_manager_secret.stripe_token.id
  secret_data = local.stripe_token[terraform.workspace]
}

# Stripe Webhook Secret
resource "google_secret_manager_secret" "stripe_webhook_secret" {
  secret_id = "fos-stripe-webhook-secret-${var.environment}"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_secret_manager_secret_version" "stripe_webhook_secret" {
  secret      = google_secret_manager_secret.stripe_webhook_secret.id
  secret_data = local.stripe_webhook_secret[terraform.workspace]
}

# OpenAI API Key (for backward compatibility, will be replaced with Vertex AI)
resource "google_secret_manager_secret" "openai_api_key" {
  secret_id = "fos-openai-api-key-${var.environment}"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_secret_manager_secret_version" "openai_api_key" {
  secret      = google_secret_manager_secret.openai_api_key.id
  secret_data = local.openai_api_key[terraform.workspace]
}

# Postmark API Token
resource "google_secret_manager_secret" "postmark_token" {
  secret_id = "fos-postmark-token-${var.environment}"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_secret_manager_secret_version" "postmark_token" {
  secret      = google_secret_manager_secret.postmark_token.id
  secret_data = local.postmark_token[terraform.workspace]
}

# Email Webhook Password
resource "google_secret_manager_secret" "email_webhook_pwd" {
  secret_id = "fos-email-webhook-pwd-${var.environment}"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_secret_manager_secret_version" "email_webhook_pwd" {
  secret      = google_secret_manager_secret.email_webhook_pwd.id
  secret_data = local.email_webhook_pwd[terraform.workspace]
}

# Backend Service Account Key
resource "google_secret_manager_secret" "backend_sa_key" {
  secret_id = "fos-backend-sa-key-${var.environment}"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
    purpose     = "service-account-key"
  }
}

resource "google_secret_manager_secret_version" "backend_sa_key" {
  secret      = google_secret_manager_secret.backend_sa_key.id
  secret_data = base64decode(google_service_account_key.backend_key.private_key)
}

# Event Services Service Account Key
resource "google_secret_manager_secret" "event_services_sa_key" {
  secret_id = "fos-event-services-sa-key-${var.environment}"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
    purpose     = "service-account-key"
  }
}

resource "google_secret_manager_secret_version" "event_services_sa_key" {
  secret      = google_secret_manager_secret.event_services_sa_key.id
  secret_data = base64decode(google_service_account_key.event_services_key.private_key)
}

# IAM bindings for secret access
resource "google_secret_manager_secret_iam_member" "backend_database_url" {
  secret_id  = google_secret_manager_secret.database_url.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_backend_sa.email}"
  depends_on = [google_secret_manager_secret.database_url]
}

resource "google_secret_manager_secret_iam_member" "backend_jwt_secret" {
  secret_id  = google_secret_manager_secret.jwt_secret.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_backend_sa.email}"
  depends_on = [google_secret_manager_secret.jwt_secret]
}

resource "google_secret_manager_secret_iam_member" "backend_stripe_token" {
  secret_id  = google_secret_manager_secret.stripe_token.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_backend_sa.email}"
  depends_on = [google_secret_manager_secret.stripe_token]
}

resource "google_secret_manager_secret_iam_member" "backend_stripe_webhook_secret" {
  secret_id  = google_secret_manager_secret.stripe_webhook_secret.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_backend_sa.email}"
  depends_on = [google_secret_manager_secret.stripe_webhook_secret]
}

resource "google_secret_manager_secret_iam_member" "backend_openai_api_key" {
  secret_id  = google_secret_manager_secret.openai_api_key.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_backend_sa.email}"
  depends_on = [google_secret_manager_secret.openai_api_key]
}

resource "google_secret_manager_secret_iam_member" "backend_postmark_token" {
  secret_id  = google_secret_manager_secret.postmark_token.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_backend_sa.email}"
  depends_on = [google_secret_manager_secret.postmark_token]
}

resource "google_secret_manager_secret_iam_member" "backend_email_webhook_pwd" {
  secret_id  = google_secret_manager_secret.email_webhook_pwd.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_backend_sa.email}"
  depends_on = [google_secret_manager_secret.email_webhook_pwd]
}

# Cloud Run service account access
resource "google_secret_manager_secret_iam_member" "cloudrun_database_url" {
  secret_id  = google_secret_manager_secret.database_url.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_cloudrun_sa.email}"
  depends_on = [google_secret_manager_secret.database_url]
}

resource "google_secret_manager_secret_iam_member" "cloudrun_jwt_secret" {
  secret_id  = google_secret_manager_secret.jwt_secret.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_cloudrun_sa.email}"
  depends_on = [google_secret_manager_secret.jwt_secret]
}

resource "google_secret_manager_secret_iam_member" "cloudrun_stripe_token" {
  secret_id  = google_secret_manager_secret.stripe_token.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_cloudrun_sa.email}"
  depends_on = [google_secret_manager_secret.stripe_token]
}

resource "google_secret_manager_secret_iam_member" "cloudrun_stripe_webhook_secret" {
  secret_id  = google_secret_manager_secret.stripe_webhook_secret.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_cloudrun_sa.email}"
  depends_on = [google_secret_manager_secret.stripe_webhook_secret]
}

resource "google_secret_manager_secret_iam_member" "cloudrun_openai_api_key" {
  secret_id  = google_secret_manager_secret.openai_api_key.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_cloudrun_sa.email}"
  depends_on = [google_secret_manager_secret.openai_api_key]
}

resource "google_secret_manager_secret_iam_member" "cloudrun_postmark_token" {
  secret_id  = google_secret_manager_secret.postmark_token.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_cloudrun_sa.email}"
  depends_on = [google_secret_manager_secret.postmark_token]
}

resource "google_secret_manager_secret_iam_member" "cloudrun_email_webhook_pwd" {
  secret_id  = google_secret_manager_secret.email_webhook_pwd.id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_cloudrun_sa.email}"
  depends_on = [google_secret_manager_secret.email_webhook_pwd]
}

# Integration peers (backend/integrations/): the token-encryption secret, OAuth client credentials and Twilio.
# Values come from .env (TF_DOTENV in CI); a key missing or empty there creates no secret and no env var, and
# the app shows that provider as "not configured" rather than failing.
locals {
  integration_keys = [
    "INTEGRATION_SECRET",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM",
  ]
  integration_env = { for k in local.integration_keys : k => lookup(local.env_vars, k, "") if lookup(local.env_vars, k, "") != "" }
}

resource "google_secret_manager_secret" "integration" {
  for_each  = local.integration_env
  secret_id = "fos-${lower(replace(each.key, "_", "-"))}-${var.environment}"

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_secret_manager_secret_version" "integration" {
  for_each    = local.integration_env
  secret      = google_secret_manager_secret.integration[each.key].id
  secret_data = each.value
}

resource "google_secret_manager_secret_iam_member" "backend_integration" {
  for_each   = local.integration_env
  secret_id  = google_secret_manager_secret.integration[each.key].id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_backend_sa.email}"
  depends_on = [google_secret_manager_secret.integration]
}

resource "google_secret_manager_secret_iam_member" "cloudrun_integration" {
  for_each   = local.integration_env
  secret_id  = google_secret_manager_secret.integration[each.key].id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.fos_cloudrun_sa.email}"
  depends_on = [google_secret_manager_secret.integration]
}
