#!/usr/bin/env bash
# Declares the microphone permission the voice-note button needs in the Tauri-generated mobile projects.
#
# Must run AFTER `tauri ios init` / `tauri android init`; the generated projects are not checked in.
# Usage: patch-mobile-permissions.sh ios|android
set -euo pipefail

GEN="desktop/src-tauri/gen"
MIC_REASON="Fos records voice notes and turns them into notes."

case "${1:?ios|android}" in
  ios)
    found=0
    while IFS= read -r plist; do
      found=1
      /usr/libexec/PlistBuddy -c "Delete :NSMicrophoneUsageDescription" "$plist" 2>/dev/null || true
      /usr/libexec/PlistBuddy -c "Add :NSMicrophoneUsageDescription string $MIC_REASON" "$plist"
      echo "patched $plist"
    done < <(find "$GEN/apple" -name Info.plist -path '*_iOS*' -not -path '*/build/*')
    [ "$found" = 1 ] || { echo "ERROR: no iOS Info.plist under $GEN/apple - run 'tauri ios init' first"; exit 1; }
    ;;
  android)
    MANIFEST="$GEN/android/app/src/main/AndroidManifest.xml"
    [ -f "$MANIFEST" ] || { echo "ERROR: $MANIFEST not found - run 'tauri android init' first"; exit 1; }
    for perm in android.permission.RECORD_AUDIO android.permission.MODIFY_AUDIO_SETTINGS; do
      grep -q "\"$perm\"" "$MANIFEST" || sed -i "s|<application|<uses-permission android:name=\"$perm\" />\n    <application|" "$MANIFEST"
    done
    echo "patched $MANIFEST"
    ;;
  *) echo "usage: $0 ios|android"; exit 1 ;;
esac
