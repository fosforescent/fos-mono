# Terraform AWS Infrastructure

This Terraform configuration sets up the AWS infrastructure for the Fosforescent project, including SQS queues, IAM users, and service accounts for the backend and event services.

## Architecture

### AWS Resources
- **SQS Queues**: Inbox and outbox queues for message processing
- **Dead Letter Queues**: For failed message handling
- **IAM Users**: Separate service accounts for backend and event services
- **IAM Policies**: Least-privilege access policies
- **SSM Parameters**: Encrypted credential storage

### State Management
- **S3 Backend**: Remote state storage with versioning and encryption
- **DynamoDB**: State locking to prevent concurrent modifications
- **Automated Setup**: Script to create backend resources if needed

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

This script will:
- Create S3 bucket `fos-terraform-state` if it doesn't exist
- Create DynamoDB table `terraform-locks` if it doesn't exist
- Configure bucket encryption, versioning, and public access blocking

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

This will extract Terraform outputs and set them as GitHub repository secrets.

## Created Resources

### SQS Queues
- `fos-inbox-{environment}` - Incoming messages from external services
- `fos-outbox-{environment}` - Outgoing messages to external services
- Dead letter queues for both inbox and outbox

### IAM Users and Policies

#### Backend Service User (`fos-backend-{environment}`)
- Full SQS access to all queues
- S3 access for application data storage
- Broader permissions for application functionality

#### Event Services User (`fos-event-services-{environment}`)
- Limited SQS access (send/receive messages only)
- Minimal permissions following least-privilege principle

### Security Features
- **Encrypted Credentials**: Access keys stored in SSM Parameter Store
- **Least Privilege**: Each service has minimal required permissions
- **Dead Letter Queues**: Failed message handling
- **Bucket Encryption**: S3 state storage with server-side encryption

## Environment Variables

The following variables will be available after deployment:

### For Backend Service
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=${BACKEND_AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${BACKEND_AWS_SECRET_ACCESS_KEY}
INBOX_QUEUE_URL=${INBOX_QUEUE_URL}
OUTBOX_QUEUE_URL=${OUTBOX_QUEUE_URL}
```

### For Event Services
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=${EVENT_SERVICES_AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${EVENT_SERVICES_AWS_SECRET_ACCESS_KEY}
INBOX_QUEUE_URL=${INBOX_QUEUE_URL}
OUTBOX_QUEUE_URL=${OUTBOX_QUEUE_URL}
```

## GitHub Integration

### GitHub Secrets
The following secrets will be created:
- `AWS_REGION`
- `INBOX_QUEUE_URL` 
- `OUTBOX_QUEUE_URL`
- `BACKEND_AWS_ACCESS_KEY_ID`
- `BACKEND_AWS_SECRET_ACCESS_KEY`
- `EVENT_SERVICES_AWS_ACCESS_KEY_ID`
- `EVENT_SERVICES_AWS_SECRET_ACCESS_KEY`

### GitHub Actions Workflows
- `deploy-infrastructure.yml` - Deploys Terraform infrastructure
- `deploy-event-services.yml` - Builds and deploys event services

## Security Considerations

1. **Credentials**: Never commit AWS credentials to git
2. **State Files**: Terraform state contains sensitive data - stored encrypted in S3
3. **IAM Policies**: Follow least-privilege principle
4. **Access Keys**: Rotate regularly, stored encrypted in SSM
5. **Environment Separation**: Use different AWS accounts/regions for prod

## Monitoring

### CloudWatch Metrics
- SQS queue metrics (message counts, age, etc.)
- IAM user activity
- S3 bucket access patterns

### Alarms (To Be Implemented)
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

## Cost Optimization

- SQS: Pay per request (first 1M requests/month free)
- DynamoDB: On-demand billing for state locking
- S3: Minimal storage costs for state files
- IAM: No additional charges

Estimated monthly cost: < $5 for development environment