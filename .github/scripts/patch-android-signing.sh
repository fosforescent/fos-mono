#!/usr/bin/env bash
# Configures release signing for the Tauri-generated Android project.
#
# Must run AFTER `tauri android init` and BEFORE `tauri android build`.
# The generated Gradle project has no release signingConfig, so without this
# the AAB would be unsigned and rejected by Google Play.
#
# Required env vars:
#   ANDROID_KEYSTORE_BASE64 - base64-encoded upload keystore
#   ANDROID_KEY_ALIAS       - key alias in the keystore
#   ANDROID_KEY_PASSWORD    - password for both store and key
set -euo pipefail

: "${ANDROID_KEYSTORE_BASE64:?missing}"
: "${ANDROID_KEY_ALIAS:?missing}"
: "${ANDROID_KEY_PASSWORD:?missing}"

GEN="desktop/src-tauri/gen/android"
GRADLE="$GEN/app/build.gradle.kts"
KEYSTORE="${RUNNER_TEMP:-/tmp}/release.keystore"

[ -f "$GRADLE" ] || { echo "ERROR: $GRADLE not found - run 'tauri android init' first"; exit 1; }

echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > "$KEYSTORE"

cat > "$GEN/keystore.properties" <<EOF
keyAlias=$ANDROID_KEY_ALIAS
password=$ANDROID_KEY_PASSWORD
storeFile=$KEYSTORE
EOF

# Ensure required imports exist (idempotent)
grep -q 'import java.io.FileInputStream' "$GRADLE" || sed -i '1i import java.io.FileInputStream' "$GRADLE"
grep -q 'import java.util.Properties' "$GRADLE" || sed -i '1i import java.util.Properties' "$GRADLE"

python3 - "$GRADLE" <<'PY'
import sys

path = sys.argv[1]
s = open(path).read()

if 'signingConfigs' in s:
    print("signingConfigs already present; skipping patch")
    sys.exit(0)

loader = '''val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

'''

signing = '''    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["password"] as String
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["password"] as String
        }
    }
'''

# Fail loudly if the Tauri CLI template changed shape - never ship unsigned.
assert 'android {' in s, "unexpected build.gradle.kts layout: missing 'android {'"
assert 'getByName("release") {' in s, "unexpected build.gradle.kts layout: missing release buildType"

s = s.replace('android {', loader + 'android {\n' + signing, 1)
s = s.replace(
    'getByName("release") {',
    'getByName("release") {\n            signingConfig = signingConfigs.getByName("release")',
    1,
)
open(path, 'w').write(s)
print(f"patched {path} with release signingConfig")
PY

echo "Android release signing configured."
