resource "digitalocean_database_cluster" "postgres_cluster" {
  name       = local.db_cluster_name[terraform.workspace]
  engine     = "pg"
  version    = local.db_cluster_version[terraform.workspace]
  size       = local.db_cluster_size[terraform.workspace]
  region     = local.db_cluster_region[terraform.workspace]
  node_count = local.db_cluster_node_count[terraform.workspace]
}

resource "digitalocean_database_db" "fos_db" {
  cluster_id = digitalocean_database_cluster.postgres_cluster.id
  name       = local.fos_db_name[terraform.workspace]
  depends_on = [digitalocean_database_cluster.postgres_cluster]
}


resource "digitalocean_database_user" "fos_user" {
  cluster_id = digitalocean_database_cluster.postgres_cluster.id
  name       = local.fos_db_user_name[terraform.workspace]
  depends_on = [digitalocean_database_db.fos_db]
}

