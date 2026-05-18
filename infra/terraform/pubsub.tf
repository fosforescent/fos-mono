# Pub/Sub Topics for event processing

# Inbox Topic
resource "google_pubsub_topic" "inbox_topic" {
  name = "fos-inbox-${var.environment}"

  labels = {
    environment = var.environment
    service     = "event-processing"
    type        = "inbox"
  }

  message_retention_duration = "1209600s" # 14 days
}

# Outbox Topic
resource "google_pubsub_topic" "outbox_topic" {
  name = "fos-outbox-${var.environment}"

  labels = {
    environment = var.environment
    service     = "event-processing"
    type        = "outbox"
  }

  message_retention_duration = "1209600s" # 14 days
}

# Dead Letter Topic for Inbox
resource "google_pubsub_topic" "inbox_dlq_topic" {
  name = "fos-inbox-dlq-${var.environment}"

  labels = {
    environment = var.environment
    service     = "event-processing"
    type        = "inbox-dlq"
  }

  message_retention_duration = "1209600s" # 14 days
}

# Dead Letter Topic for Outbox
resource "google_pubsub_topic" "outbox_dlq_topic" {
  name = "fos-outbox-dlq-${var.environment}"

  labels = {
    environment = var.environment
    service     = "event-processing"
    type        = "outbox-dlq"
  }

  message_retention_duration = "1209600s" # 14 days
}

# Inbox Subscription with Dead Letter Queue
resource "google_pubsub_subscription" "inbox_subscription" {
  name  = "fos-inbox-subscription-${var.environment}"
  topic = google_pubsub_topic.inbox_topic.name

  # Acknowledgment deadline
  ack_deadline_seconds = 20

  # Message retention
  message_retention_duration = "1209600s" # 14 days

  # Dead letter policy
  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.inbox_dlq_topic.id
    max_delivery_attempts = 5
  }

  # Retry policy
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  labels = {
    environment = var.environment
    service     = "event-processing"
    type        = "inbox"
  }
}

# Outbox Subscription with Dead Letter Queue
resource "google_pubsub_subscription" "outbox_subscription" {
  name  = "fos-outbox-subscription-${var.environment}"
  topic = google_pubsub_topic.outbox_topic.name

  # Acknowledgment deadline
  ack_deadline_seconds = 20

  # Message retention
  message_retention_duration = "1209600s" # 14 days

  # Dead letter policy
  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.outbox_dlq_topic.id
    max_delivery_attempts = 5
  }

  # Retry policy
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  labels = {
    environment = var.environment
    service     = "event-processing"
    type        = "outbox"
  }
}

# DLQ Subscriptions for monitoring
resource "google_pubsub_subscription" "inbox_dlq_subscription" {
  name  = "fos-inbox-dlq-subscription-${var.environment}"
  topic = google_pubsub_topic.inbox_dlq_topic.name

  ack_deadline_seconds       = 20
  message_retention_duration = "1209600s"

  labels = {
    environment = var.environment
    service     = "event-processing"
    type        = "inbox-dlq"
  }
}

resource "google_pubsub_subscription" "outbox_dlq_subscription" {
  name  = "fos-outbox-dlq-subscription-${var.environment}"
  topic = google_pubsub_topic.outbox_dlq_topic.name

  ack_deadline_seconds       = 20
  message_retention_duration = "1209600s"

  labels = {
    environment = var.environment
    service     = "event-processing"
    type        = "outbox-dlq"
  }
}

# IAM permissions for DLQ
resource "google_pubsub_topic_iam_member" "inbox_dlq_publisher" {
  topic  = google_pubsub_topic.inbox_dlq_topic.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_subscription_iam_member" "inbox_dlq_subscriber" {
  subscription = google_pubsub_subscription.inbox_dlq_subscription.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_topic_iam_member" "outbox_dlq_publisher" {
  topic  = google_pubsub_topic.outbox_dlq_topic.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_subscription_iam_member" "outbox_dlq_subscriber" {
  subscription = google_pubsub_subscription.outbox_dlq_subscription.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# Project data source for IAM
data "google_project" "project" {
  project_id = var.gcp_project_id
}
