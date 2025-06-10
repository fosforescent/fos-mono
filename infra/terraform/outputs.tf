# output "db_info" {
#   sensitive = true

#   value = {
#     username = google_sql_user.fos_user.name
#     password = random_password.db_password.result
#     host     = google_sql_database_instance.postgres_cluster.private_ip_address
#     port     = "5432" # GCP PostgreSQL default port
#     dbname   = google_sql_database.fos_db.name
#     url      = "postgresql://${google_sql_user.fos_user.name}:${random_password.db_password.result}@${google_sql_database_instance.postgres_cluster.private_ip_address}:5432/${google_sql_database.fos_db.name}?connection_limit=5"

#     # Additional useful information
#     public_ip_address = google_sql_database_instance.postgres_cluster.public_ip_address
#     connection_name   = google_sql_database_instance.postgres_cluster.connection_name

#     # For development/testing with public IP (if enabled)
#     public_url = "postgresql://${google_sql_user.fos_user.name}:${random_password.db_password.result}@${google_sql_database_instance.postgres_cluster.public_ip_address}:5432/${google_sql_database.fos_db.name}?connection_limit=5"
#   }
# }

# # # Optional: Separate output for Secret Manager reference
# # output "db_password_secret" {
# #   value = google_secret_manager_secret.db_password.name
# # }

# # Optional: Output for Cloud SQL instance connection name
# output "instance_connection_name" {
#   value       = google_sql_database_instance.postgres_cluster.connection_name
#   description = "The connection name of the instance to be used in connection strings"
# }
# output "nameservers" {
#   value = google_dns_managed_zone.fos.name_servers
# }
