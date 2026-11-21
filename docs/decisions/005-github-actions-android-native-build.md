# 005. Direct Android Compilation on GitHub Actions Runners

**Status:** accepted  
**Date:** 2026-11-21  

## Context
Money Manager previously delegated native Android APK builds to EAS Cloud (`eas build --platform android --profile production --wait`). While effective, EAS free tier enforces a strict 15 builds/month limit and incurs queue latency during peak hours. In contrast, GitHub Actions runners (ubuntu-latest) provide generous or unlimited compute minutes, have the Android SDK and Java environments available, and can assemble and sign the release APK directly using Gradle.

At the same time, JavaScript/asset-only updates continue to rely on Expo EAS Update (OTA), which requires zero binary recompilation and remains fast and lightweight.

## Decision
We transition the native Android build pipeline from EAS Cloud to direct local compilation on GitHub Actions runners while preserving EAS Update for OTA:

1. **Continuous Native Generation (CNG) via Expo Prebuild**:
   The GitHub runner installs Java 17 and Node 20, runs `npm ci`, and executes `npx expo prebuild --platform android --clean` to generate `android/` dynamically from `app.json` and custom local modules (`modules/notification-detection`).

2. **Declarative Release Signing via Config Plugin**:
   Implement `plugins/withReleaseSigning.js` using `@expo/config-plugins` (`withAppBuildGradle`). The plugin configures `android.signingConfigs.release` in `android/app/build.gradle` to consume signing credentials passed via environment variables or Gradle properties (`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`).

3. **Keystore Handling & Strict Production Enforcement**:
   - The production signing keystore is stored as a base64 string in GitHub Repository Secrets (`ANDROID_KEYSTORE_BASE64`), along with its passwords and key alias.
   - For release builds (triggered by version tags or native PR merges), CI verifies the presence of these secrets. If missing, CI halts with an actionable error message detailing how to export the keystore from EAS and populate GitHub Secrets.
   - For manual non-release diagnostic runs without secrets, a debug keystore fallback is permitted.

4. **Direct Gradle Compilation & Dependency Caching**:
   - Use `gradle/actions/setup-gradle@v4` to cache Gradle dependencies, wrapper distributions, and build outputs.
   - Compile via `./gradlew assembleRelease --no-daemon`.

5. **Direct Artifact Verification and Release Upload**:
   - Verify the compiled APK at `android/app/build/outputs/apk/release/app-release.apk` using `scripts/download-build-artifact.js` (adapted for local filesystem artifacts).
   - Copy to `MoneyManager-v{version}.apk`.
   - Attach directly to GitHub Release and comment on the merged PR with a 1-tap browser download link.

6. **EAS Update (OTA) Unchanged**:
   The `ota-update` job in `.github/workflows/ci-cd.yml` remains untouched, continuing to publish Over-the-Air updates via `eas update --auto --channel production`.

## Consequences

### Positive
- **Eliminates EAS Cloud Build Limit**: Unlimited Android APK builds without hitting the 15-builds/month ceiling.
- **Fast Build Times**: Gradle caching on GitHub runners provides 2–4 minute builds without cloud queue wait times.
- **Preserved In-Place Upgrades**: Reusing the EAS release keystore ensures existing installed applications upgrade smoothly without signature mismatches.
- **Zero Cost**: Runs entirely within GitHub Actions compute allowance.

### Negative
- **Keystore Secret Management**: Requires storing base64 keystore and passwords as GitHub Repository Secrets.
