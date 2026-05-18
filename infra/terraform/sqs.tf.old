# SQS Queues for event processing
resource "aws_sqs_queue" "inbox_queue" {
  name                      = "fos-inbox-${var.environment}"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 1209600  # 14 days
  receive_wait_time_seconds = 10       # Long polling
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.inbox_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Environment = var.environment
    Service     = "event-processing"
    Type        = "inbox"
  }
}

resource "aws_sqs_queue" "outbox_queue" {
  name                      = "fos-outbox-${var.environment}"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 1209600  # 14 days
  receive_wait_time_seconds = 10       # Long polling
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.outbox_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Environment = var.environment
    Service     = "event-processing"
    Type        = "outbox"
  }
}

# Dead Letter Queues
resource "aws_sqs_queue" "inbox_dlq" {
  name                      = "fos-inbox-dlq-${var.environment}"
  message_retention_seconds = 1209600  # 14 days

  tags = {
    Environment = var.environment
    Service     = "event-processing"
    Type        = "inbox-dlq"
  }
}

resource "aws_sqs_queue" "outbox_dlq" {
  name                      = "fos-outbox-dlq-${var.environment}"
  message_retention_seconds = 1209600  # 14 days

  tags = {
    Environment = var.environment
    Service     = "event-processing"
    Type        = "outbox-dlq"
  }
}

# IAM Role for SQS access by event services
resource "aws_iam_role" "event_services_role" {
  name = "fos-event-services-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = ["ecs-tasks.amazonaws.com", "ec2.amazonaws.com"]
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Service     = "event-processing"
  }
}

# IAM Policy for SQS queue access
resource "aws_iam_policy" "event_services_sqs_policy" {
  name        = "fos-event-services-sqs-${var.environment}"
  description = "Policy for event services to access SQS queues"

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
}

# Attach policy to role
resource "aws_iam_role_policy_attachment" "event_services_sqs_policy_attachment" {
  role       = aws_iam_role.event_services_role.name
  policy_arn = aws_iam_policy.event_services_sqs_policy.arn
}