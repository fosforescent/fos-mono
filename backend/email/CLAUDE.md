# CLAUDE.md

## Directory Summary

Handles email delivery, template management, inbound/outbound email processing, and email-based authentication workflows using Postmark as the email service provider.

### Dependencies
- **postmark**: Postmark email service client
- **crypto**: Node.js crypto for secure token generation
- **express**: HTTP request/response handling
- **@prisma/client**: Database models for email tracking
- **../prismaClient**: Database connection
- **../clientDetails**: Client information capture
- **Environment Variables**: POSTMARK_API_TOKEN, EMAIL_WEBHOOK_PASSWORD

### Data Inputs

#### HTTP Requests
- **POST /contact-message**: Contact form submissions with user messages
- **Email Webhooks**: Postmark webhook events for delivery status

#### Email Templates
- **Template Models**: Dynamic data for email personalization
- **Authentication Emails**: Confirmation and password reset requests
- **Contact Forms**: User-submitted contact messages

#### Database Queries
- **OutboundEmailModel**: Queued emails for delivery
- **InboundEmailModel**: Received emails for processing
- **OutboundDeliveryAttemptModel**: Delivery status tracking

### Data Outputs

#### Email Delivery
- **Outbound Emails**: Templated emails sent via Postmark
- **Inbound Forwarding**: Contact form messages forwarded to support
- **Authentication Emails**: Email confirmations and password resets

#### Database Updates
- **Email Records**: Outbound/inbound email logging
- **Delivery Attempts**: Success/failure tracking with timestamps
- **Token Generation**: Secure tokens for email verification

#### Authentication URLs
- **Confirmation Links**: Email verification URLs with secure tokens
- **Password Reset Links**: Password reset URLs with expiring tokens

### Events Handled
- **Email Confirmation**: User registration email verification
- **Password Reset**: Secure password reset flow via email
- **Contact Messages**: User contact form submissions
- **Delivery Status**: Email delivery success/failure tracking
- **Inbound Processing**: Processing of received emails

### Data Transformations
- **User Data → Email Templates**: User information mapped to Postmark templates
- **Contact Forms → Support Emails**: Contact submissions forwarded to support team
- **Auth Requests → Secure Tokens**: Cryptographic tokens for email verification
- **Delivery Events → Database Records**: Email status tracking and logging
- **Template Models → Personalized Emails**: Dynamic content injection into templates

### Email Templates
- **email-confirmation**: User registration verification emails
- **password-reset**: Password reset emails with secure links
- **Contact Forwarding**: Plain text forwarding of contact form submissions

### Security Features
- **Secure Token Generation**: 48-byte cryptographic tokens for verification
- **Token Expiration**: 3-hour expiration window for email tokens
- **Webhook Authentication**: Password-protected webhook endpoints
- **Client Information Tracking**: OS, browser, IP address logging for security

### Delivery Management
- **Retry Logic**: Automatic retry handling for failed deliveries
- **Status Tracking**: Success/failure logging with detailed error messages
- **Template Validation**: Postmark template alias verification
- **Error Handling**: Graceful handling of delivery failures and API errors

### Configuration
- **Environment Validation**: Required API keys checked at startup
- **Template Aliases**: Predefined Postmark template identifiers
- **URL Generation**: Dynamic action URL creation for email links
- **Client Details**: Browser and system information capture for security auditing

## TODOs