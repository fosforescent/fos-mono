# Mobile Development Setup

Fosforescent supports iOS and Android via Tauri 2.0 mobile.

## iOS Setup (macOS only)

### Prerequisites
- macOS with Xcode 15+ installed
- iOS Simulator or physical device
- Apple Developer account (for device testing/App Store)

### Initialize iOS Project
```bash
cd desktop
npm run ios:init
```

This creates the Xcode project in `src-tauri/gen/apple/`.

### Development
```bash
npm run ios:dev              # Run in iOS Simulator
npm run ios:dev -- --open    # Open in Xcode
```

### Build for Release
```bash
npm run ios:build
```

### Configuration
Edit `src-tauri/tauri.conf.json`:
```json
{
  "bundle": {
    "iOS": {
      "developmentTeam": "YOUR_TEAM_ID",
      "minimumSystemVersion": "13.0"
    }
  }
}
```

Find your Team ID in Xcode: Preferences → Accounts → select team → View Details.

## Android Setup

### Prerequisites
- Android Studio with SDK installed
- Android SDK Platform 24+ (Android 7.0)
- Java JDK 17+
- Android emulator or physical device

### Environment Variables
Add to your shell profile:
```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk | tail -1)"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

### Install Rust Android Targets
```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

### Initialize Android Project
```bash
cd desktop
npm run android:init
```

This creates the Android project in `src-tauri/gen/android/`.

### Development
```bash
npm run android:dev              # Run on connected device/emulator
npm run android:dev -- --open    # Open in Android Studio
```

### Build for Release
```bash
npm run android:build
```

### Configuration
Edit `src-tauri/tauri.conf.json`:
```json
{
  "bundle": {
    "android": {
      "minSdkVersion": 24
    }
  }
}
```

## Mobile-Specific Considerations

### WebRTC / Peer Connection
WebRTC works on mobile but may require:
- Camera/microphone permissions (if using media)
- Network permissions
- STUN/TURN server configuration for NAT traversal

### File System Access
Mobile has different file system constraints:
- iOS: App sandbox, no direct filesystem access
- Android: Scoped storage on Android 10+

### Deep Linking
The app is configured for `fosforescent://` URL scheme for authentication callbacks.

## Troubleshooting

### iOS: "No development team" error
Set your `developmentTeam` in `tauri.conf.json` or sign in to Xcode with your Apple ID.

### Android: NDK not found
Ensure `NDK_HOME` points to a valid NDK installation. Install NDK via Android Studio: SDK Manager → SDK Tools → NDK.

### Build fails with Rust errors
Update Rust toolchain:
```bash
rustup update stable
```
