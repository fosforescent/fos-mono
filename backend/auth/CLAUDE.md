# CLAUDE.md

## Directory Summary

Handles user authentication, registration, and account management functionality.

### Dependencies
- **express**: HTTP request/response handling
- **bcrypt**: Password hashing and verification
- **jsonwebtoken**: JWT token generation and verification
- **@fosforescent/shared/types**: Shared type definitions (InfoState, LoginResult)
- **@fosforescent/shared/dag-implementation/store**: Graph store initialization for new users
- **../prismaClient**: Database access layer
- **../email/email**: Email confirmation services
- **../util**: Data validation utilities

### Data Inputs

#### HTTP Requests
- **POST /login**: `{username: string, password: string}`
- **POST /register**: `{username, password, confirmPassword, email? | phone?, accepted_terms, cookies}` → 201 `{username, pending: 'email'|'phone', destination}`; the account stays `approved: false` until confirmed (`confirmation.ts`)
- **POST /confirm**: `{username, code}` (the six digits sent to the email or phone) or `{token}` (the emailed one-click link) → approves the account; a phone confirmation also links the number as the `phone` integration connection
- **POST /confirm/resend**: `{username}` → a fresh code to the same place (always 200 for unknown names)
- **GET /verify-jwt**: JWT token in Authorization header
- **POST /update-password**: `{currentPassword: string, newPassword: string}`
- **POST /update-email**: `{newEmail: string}`
- **POST /reset-password**: `{token: string, newPassword: string}`
- **POST /check-username**: `{username: string}`

#### Database Queries
- **UserModel**: User account data from PostgreSQL
- **FosNodeModel**: Graph nodes for user initialization
- **UserEventModel**: Authentication event logging

### Data Outputs

#### HTTP Responses
- **Login Success**: `LoginResult` object with JWT token, user profile, subscription status
- **Registration Success**: User object without password field
- **Error Responses**: JSON error messages with appropriate HTTP status codes

#### Database Updates
- **New Users**: Created in UserModel with hashed passwords
- **New Graph Stores**: Initialize FosStore and nodes for new users
- **Access Links**: FosNodeUserAccessLinkModel entries for user permissions
- **Email Tokens**: Confirmation and reset tokens with expiration

#### External Services
- **Email Confirmations**: Sent via email service with verification tokens

### Events Handled
- **User Registration**: validates (`validateRegistration`: matching passwords, one of email/phone), creates the unapproved account and its graph store, sends the confirmation code (Postmark `sendConfirmationCodeEmail`, or the SMS channel)
- **User Login**: validates credentials; an unconfirmed account gets 403 `{code: 'unconfirmed', channel, destination}` so the web app shows the code step; then JWT and session data
- **Password Updates**: Validates current password, hashes new password
- **Email Updates**: Generates verification token, sends confirmation email
- **Password Reset**: Token-based password reset flow
- **Account Deletion**: Removes user and associated data

### Data Transformations
- **Password Hashing**: Plain text passwords → bcrypt hashes (salt rounds: 10)
- **JWT Generation**: User claims → signed JWT tokens (72h expiration)
- **User Profile Mapping**: Database UserModel → LoginResult with subscription info
- **Graph Initialization**: New users → Default FosStore with root node
- **Validation**: Username/password requirements, email format validation
- **Error Standardization**: Various error conditions → Consistent JSON error responses

### Security Features
- **Password Requirements**: Minimum 8 characters, uppercase letter, number
- **Token Expiration**: JWT tokens expire after 72 hours
- **Email Verification**: Required for account activation
- **Rate Limiting**: Implied through middleware (not implemented in this directory)
- **Credential Validation**: Username uniqueness, password strength

## TODOs