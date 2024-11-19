

data "cloudflare_accounts" "accounts" {
}



import {
  to = cloudflare_pages_project.fos_pages_project
  id = "${data.cloudflare_accounts.accounts.accounts[0].id}/${local.cf_pages_name["prod"]}"
}


resource "cloudflare_pages_project" "fos_pages_project" {
  account_id        = data.cloudflare_accounts.accounts.accounts[0].id
  name              = local.cf_pages_name["prod"]
  production_branch = local.cf_pages_branch["prod"]



  source {
    type = "github"
    config {
      owner                         = "fosforescent"
      repo_name                     = "fos-mono"
      production_branch             = local.cf_pages_branch["prod"]
      pr_comments_enabled           = true
      deployments_enabled           = true
      production_deployment_enabled = true
      preview_deployment_setting    = "all"
      preview_branch_includes       = ["dev", "staging/*"]
      preview_branch_excludes       = ["main"]
    }
  }

  build_config {
    build_command   = "make build-frontend"
    destination_dir = "dist/frontend"
    root_dir        = ""
  }

  deployment_configs {
    preview {
      environment_variables = {
        FOS_API_URL = "https://api.${local.fos_domain["dev"]}"

        NODE_VERSION = "18.17.1"
        NODE_ENV     = "production"
      }
      fail_open   = true
      usage_model = "standard"
    }
    production {
      environment_variables = {
        FOS_API_URL = "https://api.${local.fos_domain["prod"]}"

        NODE_VERSION = "18.17.1"
        NODE_ENV     = "production"
      }
      fail_open   = true
      usage_model = "standard"
    }
  }
}

resource "cloudflare_pages_domain" "fos_pages_domain" {
  account_id   = cloudflare_pages_project.fos_pages_project.account_id
  project_name = local.cf_pages_name["prod"]
  domain       = "www.fosforescent.com"
}
