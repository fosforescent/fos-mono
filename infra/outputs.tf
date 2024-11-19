output "db_info" {

  sensitive = true

  value = {
    username = digitalocean_database_user.fos_user.name
    password = digitalocean_database_user.fos_user.password
    host     = digitalocean_database_cluster.postgres_cluster.host
    port     = tostring(digitalocean_database_cluster.postgres_cluster.port)
    dbname   = digitalocean_database_db.fos_db.name
    url      = "postgresql://${digitalocean_database_user.fos_user.name}:${digitalocean_database_user.fos_user.password}@${digitalocean_database_cluster.postgres_cluster.host}:${tostring(digitalocean_database_cluster.postgres_cluster.port)}/${digitalocean_database_db.fos_db.name}?connection_limit=5"
  }
}
