# App Store Deployment Guide

## Overview

This guide covers deploying Fosforescent to iOS App Store and Google Play Store using GitHub Actions CI/CD - **no Mac required**.

## GitHub Secrets Required

Add these in: GitHub Repo → Settings → Secrets and variables → Actions

### For Android (Google Play)

| Secret | Description |
|--------|-------------|
| `ANDROID_KEYSTORE_BASE64` | Your signing keystore, base64 encoded |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias (e.g., `fosforescent`) |
| `ANDROID_KEY_PASSWORD` | Key password |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Service account JSON for Play Store API |

### For iOS (App Store)

| Secret | Description |
|--------|-------------|
| `APPLE_TEAM_ID` | Your 10-character Team ID |
| `APPLE_CERTIFICATE_BASE64` | Distribution certificate (.p12), base64 encoded |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password |
| `APPLE_PROVISIONING_PROFILE_BASE64` | App Store provisioning profile, base64 encoded |
| `APPLE_API_KEY_ID` | App Store Connect API Key ID |
| `APPLE_API_KEY_ISSUER` | API Key Issuer ID |
| `APPLE_API_KEY_BASE64` | API Key (.p8 file), base64 encoded |
| `KEYCHAIN_PASSWORD` | Any random string (temporary use in CI)

## Part 1: Apple App Store

### Step 1: Apple Developer Account ($99/year)

1. Go to https://developer.apple.com/programs/enroll/
2. Sign in with your Apple ID (or create one)
3. Enroll as Individual or Organization
4. Pay $99/year fee
5. Wait for approval (usually 24-48 hours)

### Step 2: Create App ID & Provisioning Profile

Once enrolled, go to https://developer.apple.com/account/

1. **Register App ID:**
   - Certificates, IDs & Profiles → Identifiers → + button
   - Select "App IDs" → Continue
   - Select "App" → Continue
   - Description: "Fosforescent"
   - Bundle ID: `com.fosforescent.app` (must match tauri.conf.json identifier)
   - Enable capabilities: Push Notifications (optional), Associated Domains (for deep links)
   - Continue → Register

2. **Create Distribution Certificate:**
   - Certificates → + button
   - Select "Apple Distribution" → Continue
   - Follow instructions to create CSR (Certificate Signing Request)
   - Upload CSR → Continue → Download certificate

3. **Create Provisioning Profile:**
   - Profiles → + button
   - Select "App Store Connect" → Continue
   - Select your App ID → Continue
   - Select your Distribution Certificate → Continue
   - Name: "Fosforescent App Store"
   - Generate → Download

### Step 3: Create App in App Store Connect

1. Go to https://appstoreconnect.apple.com/
2. My Apps → + → New App
3. Fill in:
   - Platform: iOS
   - Name: Fosforescent
   - Primary Language: English
   - Bundle ID: Select `com.fosforescent.app`
   - SKU: `fosforescent-ios-001`
4. Create

### Step 4: Create App Store Connect API Key

1. Go to https://appstoreconnect.apple.com/access/api
2. Click "+" to create new key
3. Name: "GitHub Actions"
4. Access: "App Manager" role
5. Download the .p8 file (only available once!)
6. Note the Key ID and Issuer ID shown on the page

### Step 5: Configure GitHub Secrets

In your GitHub repo: Settings → Secrets and variables → Actions → New repository secret

| Secret Name | How to Get It |
|-------------|---------------|
| `APPLE_TEAM_ID` | Developer account → Membership → Team ID |
| `APPLE_CERTIFICATE_BASE64` | Export .p12 from Keychain, then `base64 -w 0 cert.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Password you set when exporting .p12 |
| `APPLE_PROVISIONING_PROFILE_BASE64` | `base64 -w 0 profile.mobileprovision` |
| `APPLE_API_KEY_ID` | Key ID from App Store Connect API page |
| `APPLE_API_KEY_ISSUER` | Issuer ID from App Store Connect API page |
| `APPLE_API_KEY_BASE64` | `base64 -w 0 AuthKey_XXXXXX.p8` |
| `KEYCHAIN_PASSWORD` | Any random password (used temporarily in CI) |

### Step 5: Update tauri.conf.json

```json
{
  "bundle": {
    "iOS": {
      "developmentTeam": "YOUR_TEAM_ID_HERE",
      "minimumSystemVersion": "13.0"
    }
  }
}
```

### Step 6: Trigger Build

```bash
git tag v0.1.0
git push origin v0.1.0
```

This triggers the signed iOS build which uploads to App Store Connect.

### Step 7: Submit for Review

1. Go to App Store Connect → Your App
2. Fill in app metadata:
   - Screenshots (required for each device size)
   - Description
   - Keywords
   - Support URL
   - Privacy Policy URL
3. Select the build (uploaded by CI)
4. Submit for Review

**Review typically takes 24-48 hours.** First submissions may take longer.

---

## Part 2: Google Play Store

### Step 1: Google Play Developer Account ($25 one-time)

1. Go to https://play.google.com/console/signup
2. Sign in with Google account
3. Pay $25 fee
4. Complete account setup

### Step 2: Create App in Play Console

1. All apps → Create app
2. Fill in:
   - App name: Fosforescent
   - Default language: English
   - App or game: App
   - Free or paid: Free
3. Create app

### Step 3: Create Signing Keystore

```bash
keytool -genkey -v -keystore fosforescent.keystore \
  -alias fosforescent -keyalg RSA -keysize 2048 -validity 10000
```

Then base64 encode it:
```bash
base64 -w 0 fosforescent.keystore > keystore.txt
```

### Step 4: Create Service Account for API Access

1. Go to Play Console → Setup → API access
2. Click "Create new service account"
3. Follow link to Google Cloud Console
4. Create service account with "Service Account User" role
5. Create JSON key → Download
6. Back in Play Console, grant "Release manager" permission to the service account

### Step 5: GitHub Secrets for Android

| Secret Name | Value |
|-------------|-------|
| `ANDROID_KEYSTORE_BASE64` | Contents of keystore.txt |
| `ANDROID_KEYSTORE_PASSWORD` | Your keystore password |
| `ANDROID_KEY_ALIAS` | `fosforescent` |
| `ANDROID_KEY_PASSWORD` | Your key password |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Entire contents of service account JSON file |

### Step 5: Build & Upload

The GitHub Action builds an APK/AAB automatically. For signed release:

1. Download the AAB artifact from GitHub Actions
2. Upload to Play Console → Release → Production → Create new release
3. Or use the Play Developer API for automatic upload

### Step 6: Submit for Review

1. Complete store listing:
   - Short description
   - Full description
   - Screenshots
   - Feature graphic
   - App icon
2. Complete content rating questionnaire
3. Set up pricing & distribution
4. Submit for review

**Google review typically takes a few hours to a few days.**

---

## Quick Start Checklist

### For iOS:
- [ ] Pay $99 Apple Developer fee
- [ ] Create App ID with bundle `com.fosforescent.app`
- [ ] Create Distribution Certificate
- [ ] Create App Store Provisioning Profile
- [ ] Create app in App Store Connect
- [ ] Add GitHub secrets
- [ ] Update `developmentTeam` in tauri.conf.json
- [ ] Push a version tag to trigger build
- [ ] Fill in App Store metadata & submit

### For Android:
- [ ] Pay $25 Google Play fee
- [ ] Create app in Play Console
- [ ] Configure app signing
- [ ] Add GitHub secrets (if using own keystore)
- [ ] Push to trigger build
- [ ] Upload AAB to Play Console
- [ ] Fill in store listing & submit

---

## Proof of Concept / Beta Testing

### iOS TestFlight (before public release)
- Can invite up to 10,000 external testers
- Less strict review than App Store
- Good for proof of concept

### Google Play Testing Tracks
- **Internal testing**: Up to 100 testers, no review
- **Closed testing**: Invite-only, light review
- **Open testing**: Anyone can join, light review

These are great for getting early feedback without full App Store requirements.

---

## Common Issues

### "No matching provisioning profile"
- Ensure Bundle ID matches exactly
- Re-download provisioning profile after any changes

### "Code signing error"
- Certificate may be expired
- Provisioning profile may not include the certificate

### Build fails on CI
- Check that all secrets are set correctly
- Ensure base64 encoding doesn't have newlines: `base64 -w 0`

### App rejected
- Read rejection reason carefully
- Common: missing privacy policy, crashes, incomplete functionality
- For "proof of concept" - use TestFlight/Internal testing instead
