


resource "digitalocean_domain" "fos" {
  name = local.fos_domain[terraform.workspace]
}



resource "digitalocean_record" "fos_app_record" {
  domain     = digitalocean_domain.fos.name
  type       = "CNAME"
  name       = "www"
  value      = "fos-prod.pages.dev."
  ttl        = 3600
  depends_on = []
}


resource "digitalocean_record" "fos_mail_record" {
  domain     = digitalocean_domain.fos.name
  type       = "MX"
  name       = "@"
  priority   = 10
  value      = "inbound.postmarkapp.com."
  ttl        = 3600
  depends_on = []
}


resource "digitalocean_record" "fos_info_cname_record" {
  domain = digitalocean_domain.fos.name
  type   = "CNAME"
  name   = "info"
  value  = "fosforescent.github.io." # Ensure the value ends with a dot (.)
  ttl    = 3600
}


# resource "digitalocean_record" "fos_api_a_record" {
#   domain = data.digitalocean_domain.fos.name
#   type   = "A"
#   name   = local.fos_api_domain_prefix[terraform.workspace]
#   value  = data.kubernetes_service.nginx_lb.status.0.load_balancer.0.ingress.0.ip
#   ttl    = 3600
#   depends_on = [ ]
# }

# resource "digitalocean_record" "fos_api_a_record" {
#   domain = data.digitalocean_domain.fos.name
#   type   = "A"
#   name   = local.fos_api_domain_prefix[terraform.workspace]
#   value  = data.kubernetes_service.nginx_lb.status.0.load_balancer.0.ingress.0.ip
#   ttl    = 3600
#   depends_on = [ ]
# }



resource "digitalocean_record" "dev_fos_ns_record1" {
  domain     = digitalocean_domain.fos.name
  type       = "NS"
  name       = "dev"
  value      = "ns1.digitalocean.com."
  ttl        = 3600
  depends_on = []
}

resource "digitalocean_record" "dev_fos_ns_record2" {
  domain     = digitalocean_domain.fos.name
  type       = "NS"
  name       = "dev"
  value      = "ns2.digitalocean.com."
  ttl        = 3600
  depends_on = []
}

resource "digitalocean_record" "dev_fos_ns_record3" {
  domain     = digitalocean_domain.fos.name
  type       = "NS"
  name       = "dev"
  value      = "ns3.digitalocean.com."
  ttl        = 3600
  depends_on = []
}




