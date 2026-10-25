# Terraform Infrastructure

## Prerequisites

1. **AWS CLI** installed and configured with administrative access
2. **Terraform** ~> 1.6.3
3. **GitHub CLI** (optional, for automated secret management)

## Setup Process

### 1. Initialize Backend Infrastructure

```bash
cd infra/terraform
./setup-backend.sh
```

### 2. Configure Terraform Variables

Create a `terraform.tfvars` file:

```hcl
aws_region         = "us-east-1"
environment        = "dev"
CLOUDFLARE_TOKEN   = "your-cloudflare-token"
```

### 3. Deploy Infrastructure

```bash
terraform init
terraform plan
terraform apply
```

### 4. Configure GitHub Secrets (Optional)

```bash
./setup-github-secrets.sh
```

## Security Considerations

1. **Credentials**: Never commit AWS credentials to git
2. **State Files**: Terraform state contains sensitive data and must be stored encrypted
3. **IAM Policies**: Follow least-privilege principle; each service should have only the permissions it requires
4. **Access Keys**: Rotate regularly and store encrypted
5. **Environment Separation**: Use different AWS accounts/regions for prod

## Monitoring

### Alarms
- High message age in queues
- Dead letter queue activity
- Failed authentication attempts

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will delete all queues, users, and data. Make sure to backup any important information first.

## Troubleshooting

### Common Issues

1. **Backend Setup Fails**
   - Check AWS credentials and permissions
   - Ensure S3 bucket name is globally unique
   - Verify region settings

2. **Access Denied Errors**
   - Verify IAM policies are attached correctly
   - Check that access keys are configured properly
   - Confirm queue URLs are correct

3. **State Lock Issues**
   - Check DynamoDB table exists
   - Verify DynamoDB permissions
   - Force unlock if needed: `terraform force-unlock LOCK_ID`

### Useful Commands

```bash
# View current state
terraform show

# List resources
terraform state list

# Get specific output
terraform output inbox_queue_url

# Refresh state
terraform refresh

# Import existing resource
terraform import aws_sqs_queue.inbox_queue QUEUE_URL
```
