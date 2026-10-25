# CLAUDE.md

## Directory Summary

Handles email delivery, templates, inbound/outbound email processing, and email-based authentication workflows, using Postmark.

## Requirements
- Verification and password-reset tokens must be cryptographically secure and expire.
- Webhook endpoints must be authenticated.
- Required API keys are checked at startup.
- Environment: `POSTMARK_API_TOKEN`, `EMAIL_WEBHOOK_PASSWORD`.
