# # Domain zone configuration
resource "ovh_domain_zone_record" "www" {
  zone      = "fosforescent.com" # Your domain
  subdomain = "www"
  fieldtype = "CNAME"
  target    = "fos-prod.pages.dev." # Your Cloudflare Pages target
  ttl       = 3600
}

# MX Record for mail
resource "ovh_domain_zone_record" "mail" {
  zone      = "fosforescent.com"
  subdomain = "@"
  fieldtype = "MX"
  target    = "10 inbound.postmarkapp.com."
  ttl       = 3600
}

# API subdomain
resource "ovh_domain_zone_record" "api" {
  zone      = "fosforescent.com"
  subdomain = "api"
  fieldtype = "A"
  target    = ovh_cloud_project_database.db.endpoints[0].ip # Or your API endpoint
  ttl       = 3600
}

# Info subdomain for GitHub pages
resource "ovh_domain_zone_record" "info" {
  zone      = "fosforescent.com"
  subdomain = "info"
  fieldtype = "CNAME"
  target    = "fosforescent.github.io."
  ttl       = 3600
}
