# Mobile Release Guide (iOS + Android)

The Tauri app (`desktop/src-tauri/`) wraps the `web/` frontend and ships to:

- **iOS**: TestFlight via App Store Connect
- **Android**: Google Play internal track

Publish by pushing a `v*` tag, or by manual `workflow_dispatch` of
`.github/workflows/mobile-android.yml` / `mobile-ios.yml` with the `publish` box
checked (unchecked = build only, AAB/IPA kept as artifacts). Each platform has its
own workflow so they can be run independently.

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

### Variables (optional)

| Name | Purpose | Default |
|---|---|---|
| `MOBILE_API_URL` | Backend API URL baked into the web build (`VITE_API_URL`) | `https://api.fosforescent.com` |

Must be HTTPS — iOS App Transport Security blocks plain HTTP.

## One-time Apple setup

1. developer.apple.com → Identifiers → register bundle ID `com.fosforescent.app`.
2. App Store Connect → Apps → "+" → New App, bundle ID `com.fosforescent.app`, name "Fosforescent".
3. App Store Connect → Users and Access → Integrations → App Store Connect API → generate a
   **Team key** with the **Admin** role (required for Xcode cloud signing). Record Issuer ID +
   Key ID, download the `.p8` (one-time download).
4. Signing should use Xcode cloud signing with the API key, so no certificate or
   provisioning profile is managed by hand.

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
6. If the Publishing API rejects a first upload with "package not found", upload the
   `android-aab` artifact manually through the Play Console UI.

## Release procedure

1. Bump `version` in `desktop/src-tauri/tauri.conf.json`, the same version in
   `desktop/src-tauri/Cargo.toml` and the package.json files, and the build numbers by
   one: `bundle.android.versionCode` and `bundle.iOS.bundleVersion`.
   - Build numbers are set explicitly, not derived from `version`, and must grow with
     every submission: Play and TestFlight reject duplicate or lower ones.
   - If App Store Connect refuses (ITMS-90062) a marketing version lower than a
     previously approved one, set a higher `version` in `src-tauri/tauri.ios.conf.json`
     (merged for iOS builds only).
2. Commit, then tag and push:

   ```bash
   git tag v0.1.1
   git push origin v0.1.1
   ```

3. First iOS build: answer the export-compliance (encryption) question in App Store
   Connect before the TestFlight build becomes available to testers.
4. Promote to production manually from the Play Console / App Store Connect when ready.

## Signing rules

- An unsigned AAB must never ship silently: the Android signing step must fail loudly if
  it cannot apply the release signing config.

## Before public release

- Replace `desktop/src-tauri/app-icon.png` with real 1024×1024 artwork (`npx tauri icon`
  regenerates all platform icons from it).
- Review fallback demo credentials in the web app before external distribution; CI must
  not set `VITE_API_USERNAME`/`VITE_API_PASSWORD`.
- If cross-compilation of desktop-only Rust dependencies fails for mobile targets, gate them
  under `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]`.
- If `xcrun altool` is removed from runner images, switch the upload step to `fastlane pilot`.
- Backend CORS must allow Tauri webview origins (`tauri://localhost`,
  `http://tauri.localhost`).

## Desktop (macOS, Windows, Linux)

Pushing a `v*` tag runs `.github/workflows/desktop-release.yml`, which should attach the
`fos` binary's installers (dmg, msi/nsis exe, deb/rpm/AppImage) and a bare
`fos-<os>.tar.gz`/`.zip` of the executable to the GitHub Release for that tag.
`workflow_dispatch` builds only. Set `DESKTOP_API_URL` (repository variable, falls back to
`MOBILE_API_URL`) to choose the API URL baked into the web bundle.

To sign: macOS needs `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`,
`APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`; Windows needs a
code-signing certificate configured under `bundle.windows.certificateThumbprint` in
`tauri.conf.json`. To open an unsigned macOS build: right-click → Open, or
`xattr -d com.apple.quarantine Fosforescent.app`.
