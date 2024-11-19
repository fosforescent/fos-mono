


resource "ovh_cloud_project_database" "db" {
  service_name = var.ovh_project_id
  description  = "Fosforescent Database"
  engine       = "postgresql"
  version      = "15"
  plan         = "essential" # Or "business" for more features
  nodes {
    region = "GRA" # OVH region (e.g., GRA for Gravelines, France)
  }
  flavor = "db1-4" # Instance size
}

resource "ovh_cloud_project_database_user" "user" {
  service_name = var.ovh_project_id
  engine       = "postgresql"
  cluster_id   = ovh_cloud_project_database.db.id
  name         = local.fos_db_user_name[terraform.workspace]
  password     = random_password.db_password.result
}

resource "ovh_cloud_project_database_database" "database" {
  service_name = var.ovh_project_id
  engine       = "postgresql"
  cluster_id   = ovh_cloud_project_database.db.id
  name         = local.fos_db_name[terraform.workspace]
}
