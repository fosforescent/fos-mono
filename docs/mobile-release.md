# Mobile Release Guide (iOS + Android)

Cloud builds run on GitHub Actions (`.github/workflows/mobile-android.yml` and
`.github/workflows/mobile-ios.yml` — one workflow per platform so they can be run
independently). The Tauri app
(`desktop/src-tauri/`) wraps the `web/` frontend and ships to:

- **iOS**: TestFlight via App Store Connect
- **Android**: Google Play internal track

Publishing happens automatically on `v*` tag pushes, or via manual `workflow_dispatch`
(check the `publish` box; unchecked runs build-only and uploads AAB/IPA artifacts).

## GitHub secrets and variables

Set in repo Settings → Secrets and variables → Actions.

### Secrets

| Name | What it is | Where to get it |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` | Upload keystore, base64 | `base64 -w0 upload.keystore` (see keystore generation below) |
| `ANDROID_KEY_ALIAS` | Key alias | Chosen at `keytool` time (e.g. `upload`) |
| `ANDROID_KEY_PASSWORD` | Keystore + key password (single password) | Chosen at `keytool` time |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | GCP service account JSON key (plain text) | GCP console (see Google setup) |
| `APPLE_TEAM_ID` | Apple Developer Team ID | developer.apple.com → Membership |
| `APPLE_API_ISSUER` | App Store Connect API Issuer ID | App Store Connect → Users and Access → Integrations |
| `APPLE_API_KEY_ID` | App Store Connect API Key ID | Same page |
| `APPLE_API_KEY_BASE64` | The `.p8` key, base64 | `base64 -w0 AuthKey_<KEYID>.p8` (downloadable once) |
| `IOS_CERTIFICATE` | Apple Distribution cert + private key (.p12), base64 | Created via ASC API (see iOS signing below) |
| `IOS_CERTIFICATE_PASSWORD` | Password of the .p12 | Chosen when the .p12 was exported |
| `IOS_MOBILE_PROVISION` | App Store provisioning profile, base64 | Created via ASC API (see iOS signing below) |

### Variables (optional)

| Name | Purpose | Default |
|---|---|---|
| `MOBILE_API_URL` | Backend API URL baked into the web build (`VITE_API_URL`) | `https://api.fosforescent.com` |

Must be HTTPS — iOS App Transport Security blocks plain HTTP.

## One-time Apple setup

1. developer.apple.com → Identifiers → register bundle ID `com.fosforescent.app`.
2. App Store Connect → Apps → "+" → New App, bundle ID `com.fosforescent.app`, name "Fosforescent".
3. App Store Connect → Users and Access → Integrations → App Store Connect API → generate a
   **Team key** with **Admin** role (used for signing-asset management via API and the
   TestFlight upload). Record Issuer ID + Key ID, download the `.p8` (one-time download).
4. Create the signing assets (no Mac needed — done via the ASC API with the Admin key):

   ```bash
   # Private key + CSR
   openssl genrsa -out dist.key 2048
   openssl req -new -key dist.key -out dist.csr -subj "/CN=Fosforescent CI Distribution"
   # Submit csrContent via POST /v1/certificates (certificateType DISTRIBUTION),
   # save the returned certificateContent (base64 DER) as dist.cer, then:
   openssl x509 -inform DER -in dist.cer -out dist.pem
   openssl pkcs12 -export -legacy -inkey dist.key -in dist.pem \
     -name "Apple Distribution" -out dist.p12 -passout pass:<PASSWORD>
   # Create the profile via POST /v1/profiles (profileType IOS_APP_STORE,
   # linked to the bundle ID and certificate); save profileContent as .mobileprovision
   ```

   Store as secrets: `IOS_CERTIFICATE` (base64 of dist.p12), `IOS_CERTIFICATE_PASSWORD`,
   `IOS_MOBILE_PROVISION` (base64 of the .mobileprovision). Copies live in the local `.env`.
   The certificate expires after 1 year (current one: 2027-08-19) — repeat this step and
   update the secrets before expiry. Note: Xcode *cloud signing* (`-allowProvisioningUpdates`)
   was tried first and failed with "Cloud signing permission error" despite an Admin key;
   explicit cert+profile signing is used instead.

## One-time Google setup

1. Play Console → Create app, package name `com.fosforescent.app`.
2. Generate the upload keystore locally (needs a JDK):

   ```bash
   keytool -genkey -v -keystore upload.keystore -alias upload \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -storepass <PASSWORD> -keypass <PASSWORD>
   base64 -w0 upload.keystore   # -> ANDROID_KEYSTORE_BASE64 secret
   ```

   Use the same password for store and key. Back the keystore up somewhere safe (offline).
   Keep Play App Signing enabled (default) so this is only the *upload* key and Google can
   rotate the real signing key if the upload key is ever lost.
3. GCP console: create a service account, enable the **Google Play Android Developer API**,
   create a JSON key for the service account.
4. Play Console → Users and permissions → invite the service account email; grant access to
   the app with "Release to testing tracks" permission.
5. Complete Play Console mandatory setup before any rollout (privacy policy URL, data
   safety form, content rating questionnaire).
6. **The very first AAB must be uploaded manually** through the Play Console UI — the
   Publishing API rejects the first upload of a new app. Run the workflow with
   `publish` unchecked, download the `android-aab` artifact, and upload it to the
   internal testing track by hand. Subsequent releases go through the API.

## Release procedure

1. Bump `version` in `desktop/src-tauri/tauri.conf.json` (e.g. `0.1.0` → `0.1.1`).
   - Android `versionCode` is derived as `major*1000000 + minor*1000 + patch`.
   - Both Play and TestFlight reject duplicate version codes/build numbers, so every
     submission needs a bump.
2. Commit, then tag and push:

   ```bash
   git tag v0.1.1
   git push origin v0.1.1
   ```

3. The workflow builds both platforms and publishes to Play internal track + TestFlight.
4. First iOS build: answer the export-compliance (encryption) question in App Store
   Connect before the TestFlight build becomes available to testers.
5. Promote to production manually from the Play Console / App Store Connect when ready.

## Signing details

- **Android**: The workflow runs `tauri android init` fresh each build, then
  `.github/scripts/patch-android-signing.sh` writes `keystore.properties` and patches
  the generated `build.gradle.kts` with a release `signingConfig`. The script fails
  loudly if the Tauri CLI template shape changes — an unsigned AAB is never shipped
  silently.
- **iOS**: `tauri ios init` runs fresh each build with `APPLE_DEVELOPMENT_TEAM` set
  job-wide (it is baked into the Xcode project at init time). Signing is explicit:
  the Tauri CLI reads `IOS_CERTIFICATE`/`IOS_CERTIFICATE_PASSWORD`/`IOS_MOBILE_PROVISION`,
  imports the cert into a temporary keychain, and installs the profile. TestFlight
  upload uses `xcrun altool` with the ASC API key.

## Known caveats

- The 1024px `desktop/src-tauri/app-icon.png` is an upscale of the 512px desktop icon —
  replace it with real 1024×1024 artwork before public release (`npx tauri icon` in CI
  regenerates all platform icons from it).
- `web/src/main.ts` has fallback demo credentials (`user1@fosforescent.com`/`user123`).
  Review before external distribution; CI intentionally does not set
  `VITE_API_USERNAME`/`VITE_API_PASSWORD`.
- The Rust crate builds heavy desktop deps (`webrtc`, `rusqlite`, CLI tooling) for mobile
  targets. If cross-compilation fails, gate them under
  `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]`.
- `xcrun altool` is deprecated by Apple but still functional; if removed from runner
  images, switch the upload step to `fastlane pilot`.
- Backend CORS must allow Tauri webview origins (`tauri://localhost`,
  `http://tauri.localhost`) — configured in `backend/index.ts`.
