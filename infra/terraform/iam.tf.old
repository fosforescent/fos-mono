# IAM User for Backend Service
resource "aws_iam_user" "fos_backend_user" {
  name = "fos-backend-${var.environment}"
  path = "/services/"

  tags = {
    Environment = var.environment
    Service     = "backend"
    ManagedBy   = "terraform"
  }
}

# IAM User for Event Services
resource "aws_iam_user" "fos_event_services_user" {
  name = "fos-event-services-${var.environment}"
  path = "/services/"

  tags = {
    Environment = var.environment
    Service     = "event-services"
    ManagedBy   = "terraform"
  }
}

# Access Keys for Backend Service
resource "aws_iam_access_key" "fos_backend_access_key" {
  user = aws_iam_user.fos_backend_user.name
}

# Access Keys for Event Services
resource "aws_iam_access_key" "fos_event_services_access_key" {
  user = aws_iam_user.fos_event_services_user.name
}

# Policy for Backend Service (broader access)
resource "aws_iam_policy" "fos_backend_policy" {
  name        = "fos-backend-policy-${var.environment}"
  description = "Policy for FOS backend service with SQS and additional AWS service access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
          "sqs:ListQueues",
          "sqs:PurgeQueue"
        ]
        Resource = [
          aws_sqs_queue.inbox_queue.arn,
          aws_sqs_queue.outbox_queue.arn,
          aws_sqs_queue.inbox_dlq.arn,
          aws_sqs_queue.outbox_dlq.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "arn:aws:s3:::fos-${var.environment}-*/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::fos-${var.environment}-*"
        ]
      }
    ]
  })

  tags = {
    Environment = var.environment
    Service     = "backend"
  }
}

# Policy for Event Services (SQS only)
resource "aws_iam_policy" "fos_event_services_policy" {
  name        = "fos-event-services-policy-${var.environment}"
  description = "Policy for FOS event services with SQS access only"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl"
        ]
        Resource = [
          aws_sqs_queue.inbox_queue.arn,
          aws_sqs_queue.outbox_queue.arn,
          aws_sqs_queue.inbox_dlq.arn,
          aws_sqs_queue.outbox_dlq.arn
        ]
      }
    ]
  })

  tags = {
    Environment = var.environment
    Service     = "event-services"
  }
}

# Attach policies to users
resource "aws_iam_user_policy_attachment" "fos_backend_policy_attachment" {
  user       = aws_iam_user.fos_backend_user.name
  policy_arn = aws_iam_policy.fos_backend_policy.arn
}

resource "aws_iam_user_policy_attachment" "fos_event_services_policy_attachment" {
  user       = aws_iam_user.fos_event_services_user.name
  policy_arn = aws_iam_policy.fos_event_services_policy.arn
}

# Store credentials in AWS Systems Manager Parameter Store (encrypted)
resource "aws_ssm_parameter" "backend_access_key_id" {
  name  = "/fos/${var.environment}/backend/aws-access-key-id"
  type  = "SecureString"
  value = aws_iam_access_key.fos_backend_access_key.id

  tags = {
    Environment = var.environment
    Service     = "backend"
  }
}

resource "aws_ssm_parameter" "backend_secret_access_key" {
  name  = "/fos/${var.environment}/backend/aws-secret-access-key"
  type  = "SecureString"
  value = aws_iam_access_key.fos_backend_access_key.secret

  tags = {
    Environment = var.environment
    Service     = "backend"
  }
}

resource "aws_ssm_parameter" "event_services_access_key_id" {
  name  = "/fos/${var.environment}/event-services/aws-access-key-id"
  type  = "SecureString"
  value = aws_iam_access_key.fos_event_services_access_key.id

  tags = {
    Environment = var.environment
    Service     = "event-services"
  }
}

resource "aws_ssm_parameter" "event_services_secret_access_key" {
  name  = "/fos/${var.environment}/event-services/aws-secret-access-key"
  type  = "SecureString"
  value = aws_iam_access_key.fos_event_services_access_key.secret

  tags = {
    Environment = var.environment
    Service     = "event-services"
  }
}