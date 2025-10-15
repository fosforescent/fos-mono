# SQS Queue outputs
output "inbox_queue_url" {
  description = "URL of the inbox SQS queue"
  value       = aws_sqs_queue.inbox_queue.url
}

output "outbox_queue_url" {
  description = "URL of the outbox SQS queue"
  value       = aws_sqs_queue.outbox_queue.url
}

output "inbox_queue_arn" {
  description = "ARN of the inbox SQS queue"
  value       = aws_sqs_queue.inbox_queue.arn
}

output "outbox_queue_arn" {
  description = "ARN of the outbox SQS queue"
  value       = aws_sqs_queue.outbox_queue.arn
}

output "event_services_role_arn" {
  description = "ARN of the IAM role for event services"
  value       = aws_iam_role.event_services_role.arn
}

# IAM User outputs
output "backend_user_arn" {
  description = "ARN of the backend service IAM user"
  value       = aws_iam_user.fos_backend_user.arn
}

output "event_services_user_arn" {
  description = "ARN of the event services IAM user" 
  value       = aws_iam_user.fos_event_services_user.arn
}

# AWS Credentials for Backend Service (sensitive)
output "backend_aws_access_key_id" {
  description = "AWS Access Key ID for backend service"
  value       = aws_iam_access_key.fos_backend_access_key.id
  sensitive   = true
}

output "backend_aws_secret_access_key" {
  description = "AWS Secret Access Key for backend service"
  value       = aws_iam_access_key.fos_backend_access_key.secret
  sensitive   = true
}

# AWS Credentials for Event Services (sensitive)
output "event_services_aws_access_key_id" {
  description = "AWS Access Key ID for event services"
  value       = aws_iam_access_key.fos_event_services_access_key.id
  sensitive   = true
}

output "event_services_aws_secret_access_key" {
  description = "AWS Secret Access Key for event services"
  value       = aws_iam_access_key.fos_event_services_access_key.secret
  sensitive   = true
}

# SSM Parameter names for accessing credentials
output "backend_credentials_ssm_paths" {
  description = "SSM Parameter paths for backend credentials"
  value = {
    access_key_id     = aws_ssm_parameter.backend_access_key_id.name
    secret_access_key = aws_ssm_parameter.backend_secret_access_key.name
  }
}

output "event_services_credentials_ssm_paths" {
  description = "SSM Parameter paths for event services credentials"
  value = {
    access_key_id     = aws_ssm_parameter.event_services_access_key_id.name
    secret_access_key = aws_ssm_parameter.event_services_secret_access_key.name
  }
}
