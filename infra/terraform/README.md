# Terraform Infrastructure

## Prerequisites

- **Terraform** ~> 1.6.3
- **GitHub CLI** (optional, for automated secret management)

## Deploy

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply
```

Optionally configure GitHub secrets with `./setup-github-secrets.sh`.

## Security

- Never commit cloud credentials to git.
- Terraform state contains sensitive data and must be stored encrypted.
- Follow least privilege: each service should have only the permissions it requires.
- Rotate access keys regularly and store them encrypted.
- Keep production separate from other environments.

## Cleanup

`terraform destroy` deletes all resources and their data; back up anything important first.
