# Cloud DNS for fosforescent.com domain management

# DNS Managed Zone for fosforescent.com
resource "google_dns_managed_zone" "fosforescent" {
  name        = "fosforescent-zone"
  dns_name    = "fosforescent.com."
  description = "DNS zone for fosforescent.com"

  dnssec_config {
    state = "on"
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

# A record for root domain (pointing to frontend load balancer)
resource "google_dns_record_set" "root" {
  name         = google_dns_managed_zone.fosforescent.dns_name
  managed_zone = google_dns_managed_zone.fosforescent.name
  type         = "A"
  ttl          = 300

  rrdatas = [google_compute_global_address.frontend_ip.address]
}

# A record for www subdomain (pointing to frontend load balancer)
resource "google_dns_record_set" "www" {
  name         = "www.${google_dns_managed_zone.fosforescent.dns_name}"
  managed_zone = google_dns_managed_zone.fosforescent.name
  type         = "A"
  ttl          = 300

  rrdatas = [google_compute_global_address.frontend_ip.address]
}

# A record for dev subdomain (frontend)
resource "google_dns_record_set" "dev" {
  name         = "dev.${google_dns_managed_zone.fosforescent.dns_name}"
  managed_zone = google_dns_managed_zone.fosforescent.name
  type         = "A"
  ttl          = 300

  rrdatas = [google_compute_global_address.frontend_ip.address]
}

# A record for www.dev subdomain (frontend)
resource "google_dns_record_set" "www_dev" {
  name         = "www.dev.${google_dns_managed_zone.fosforescent.dns_name}"
  managed_zone = google_dns_managed_zone.fosforescent.name
  type         = "A"
  ttl          = 300

  rrdatas = [google_compute_global_address.frontend_ip.address]
}

# A record for API subdomain (pointing to Cloud Run backend)
resource "google_dns_record_set" "api" {
  name         = "api.${google_dns_managed_zone.fosforescent.dns_name}"
  managed_zone = google_dns_managed_zone.fosforescent.name
  type         = "CNAME"
  ttl          = 300

  # Point to Cloud Run service URL (will be created after apply)
  rrdatas = ["ghs.googlehosted.com."]
}

# A record for dev API subdomain (pointing to Cloud Run backend)
resource "google_dns_record_set" "dev_api" {
  name         = "dev-api.${google_dns_managed_zone.fosforescent.dns_name}"
  managed_zone = google_dns_managed_zone.fosforescent.name
  type         = "CNAME"
  ttl          = 300

  # Point to Cloud Run service URL
  rrdatas = ["ghs.googlehosted.com."]
}

# MX records for email (if using Google Workspace or similar)
# resource "google_dns_record_set" "mx" {
#   name         = google_dns_managed_zone.fosforescent.dns_name
#   managed_zone = google_dns_managed_zone.fosforescent.name
#   type         = "MX"
#   ttl          = 3600
#
#   rrdatas = [
#     "1 aspmx.l.google.com.",
#     "5 alt1.aspmx.l.google.com.",
#     "5 alt2.aspmx.l.google.com.",
#     "10 alt3.aspmx.l.google.com.",
#     "10 alt4.aspmx.l.google.com.",
#   ]
# }

# TXT record for domain verification
# resource "google_dns_record_set" "verification" {
#   name         = google_dns_managed_zone.fosforescent.dns_name
#   managed_zone = google_dns_managed_zone.fosforescent.name
#   type         = "TXT"
#   ttl          = 300
#
#   rrdatas = [
#     "\"v=spf1 include:_spf.google.com ~all\"",
#   ]
# }

# Output nameservers for domain registrar configuration
output "nameservers" {
  description = "Nameservers to configure at your domain registrar"
  value       = google_dns_managed_zone.fosforescent.name_servers
}

output "dns_zone_name" {
  description = "Cloud DNS zone name"
  value       = google_dns_managed_zone.fosforescent.name
}
