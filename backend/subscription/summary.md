# Backend Subscription Directory Summary

## Purpose
Handles Stripe payment integration including subscriptions, checkout sessions, customer portals, and webhook processing for the Fosforescent billing system.

## Dependencies
- **stripe**: Stripe SDK for payment processing (API version 2024-10-28.acacia)
- **express**: HTTP request/response handling
- **../prismaClient**: Database access layer
- **Environment Variables**: STRIPE_TOKEN, STRIPE_WEBHOOK_SECRET, JWT_SECRET

## Data Inputs

### HTTP Requests
- **POST /checkout-session**: User subscription requests with pricing information
- **POST /portal-session**: Customer portal access requests
- **POST /connect-session**: Stripe Connect onboarding requests
- **POST /subscription-webhook**: Stripe webhook events with signatures

### Stripe Webhooks
- **checkout.session.completed**: Successful payment completion
- **invoice.payment_succeeded**: Recurring payment success
- **invoice.payment_failed**: Payment failure events
- **customer.subscription.updated**: Subscription status changes
- **customer.subscription.deleted**: Subscription cancellations

### Database Queries
- **UserModel**: User account data for subscription linking
- **Customer Records**: Stripe customer ID associations

## Data Outputs

### HTTP Responses
- **Checkout URLs**: Stripe-hosted payment page URLs
- **Portal URLs**: Customer portal session URLs for subscription management
- **Connect URLs**: Stripe Connect onboarding URLs
- **Webhook Confirmations**: 200 status responses to Stripe

### Database Updates
- **Subscription Status**: Updated user subscription states (active, inactive, canceled)
- **Customer IDs**: Stripe customer ID associations with user accounts
- **Payment Records**: Transaction history and payment status
- **API Usage Limits**: Updated API call quotas based on subscription tier

### Stripe Operations
- **Customer Creation**: New Stripe customers for first-time subscribers
- **Session Creation**: Checkout, portal, and Connect session generation
- **Subscription Management**: Tier changes and cancellations

## Events Handled
- **Payment Success**: Updates user to active subscription status
- **Payment Failure**: Handles failed payments and retry logic
- **Subscription Changes**: Processes tier upgrades/downgrades
- **Account Cancellation**: Handles subscription termination
- **Connect Onboarding**: Stripe Connect account setup for marketplace features

## Data Transformations
- **User Accounts → Stripe Customers**: User data mapped to Stripe customer records
- **Subscription Tiers → Pricing**: Product configurations mapped to Stripe price IDs
- **Webhook Events → Database Updates**: Stripe events converted to user status changes
- **Session Requests → Stripe URLs**: User requests transformed into Stripe-hosted page URLs

## Security Features
- **Webhook Signature Verification**: Cryptographic validation of Stripe webhook authenticity
- **Environment Variable Validation**: Required secrets checked at startup
- **User Authentication**: JWT validation for authenticated requests
- **Error Handling**: Graceful handling of payment failures and network issues

## Payment Flow Management
- **Checkout Process**: Redirect to Stripe-hosted payment pages
- **Success/Cancel URLs**: Post-payment redirect handling
- **Subscription Lifecycle**: Active monitoring of subscription status changes
- **Usage Tracking**: API call limits based on subscription tier
- **Portal Access**: Self-service subscription management for customers