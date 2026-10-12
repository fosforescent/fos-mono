# GCP Cloud SQL for PostgreSQL Database

# Random password for database
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Cloud SQL PostgreSQL Instance
resource "google_sql_database_instance" "postgres" {
  name             = "fos-postgres-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.gcp_region

  settings {
    tier              = "db-f1-micro" # matches the live dev instance (was db-custom-2-7680)
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    disk_type         = "PD_HDD"
    disk_size         = 10
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = var.environment == "prod" ? true : false
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled = true
      # Public IP only: Cloud Run reaches the instance over the Cloud SQL connector socket.
      # The private VPC / peering that used to be here was removed from the project.
      require_ssl = true

      # Authorized networks - Add your IP ranges here
      # authorized_networks {
      #   name  = "office-network"
      #   value = "0.0.0.0/0"  # Replace with your actual IP range
      # }
    }

    # No database_flags: the live instance has none, and changing flags restarts it.

    maintenance_window {
      day          = 7 # Sunday
      hour         = 3
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 1024
      record_application_tags = true
    }
  }

  deletion_protection = var.environment == "prod" ? true : false

}

# Database
resource "google_sql_database" "database" {
  name     = var.db_name
  instance = google_sql_database_instance.postgres.name
}

# Database User
resource "google_sql_user" "user" {
  name     = var.db_user
  instance = google_sql_database_instance.postgres.name
  password = var.db_password != "" ? var.db_password : random_password.db_password.result
}




# Enable pgvector extension (must be done after instance creation)
# Note: This requires the Cloud SQL Admin API to be enabled
resource "null_resource" "enable_pgvector" {
  depends_on = [
    google_sql_database.database,
    google_sql_user.user
  ]

  provisioner "local-exec" {
    command = <<-EOT
      gcloud sql connect ${google_sql_database_instance.postgres.name} \
        --user=${var.db_user} \
        --database=${var.db_name} \
        --quiet \
        <<SQL
      CREATE EXTENSION IF NOT EXISTS vector;
      SQL
    EOT
  }

  triggers = {
    instance_id = google_sql_database_instance.postgres.id
  }
}
