# CLAUDE.md

## Directory Summary

Handles Stripe payment integration: subscriptions, checkout sessions, customer portals, Connect onboarding and webhook processing.

## Requirements
- Stripe webhooks must be signature-verified.
- Required secrets (`STRIPE_TOKEN`, `STRIPE_WEBHOOK_SECRET`, `JWT_SECRET`) are checked at startup.
- Authenticated requests require JWT validation.

## Payments for `-$` requirements
- A money requirement is paid through Stripe Checkout to the payee's connected account; the webhook settles the requirement and resumes the evaluation that waited on it.
- Payments go only to payees with payouts enabled.
- Settlement is idempotent: redelivered webhooks change nothing, token purchases are credited once, and a repeated fos points effect never pays twice.
- Environment: `FOS_PAYMENT_FEE_PERCENT` keeps a platform fee (default 0).
