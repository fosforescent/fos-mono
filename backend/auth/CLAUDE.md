# CLAUDE.md

## Directory Summary

Handles user authentication, registration, and account management.

## Requirements
- An account stays unapproved until it is confirmed with the code sent to its email or phone; email verification is required for account activation.
- Registration requires matching passwords, one of email or phone, and explicit terms acceptance.
- Resending a confirmation code answers the same for unknown names (no account enumeration).
- Passwords: minimum 8 characters, an uppercase letter and a number; stored only as bcrypt hashes.
- Usernames are unique.
- Changing a password requires the current password.
