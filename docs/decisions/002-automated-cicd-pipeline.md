# 002. Automated CI/CD Pipeline and In-App Update Distribution

**Status:** accepted  
**Date:** 2026-11-11  

## Context
Money Manager is a personal finance app distributed to close friends. The app uses Expo SDK 52 with EAS, contains custom native Android code (`modules/notification-detection/`), and uses `expo-updates` for OTA delivery. Changes merged to `main` must automatically publish either an OTA update or a native Android APK on GitHub Releases. When users launch the app, they must be cleanly guided through updating, whether via OTA or via downloading the new APK.

## Decision
We implement an end-to-end automated pipeline and in-app update management workflow:

```
PR Merged to main
    │
    ├── Auto-detect changed files
    │       │
    │       ├── JS/TS/Assets only (OTA)
    │       │       ├── eas update --channel production
    │       │       └── Users receive Two-Stage OTA Prompt in-app
    │       │
    │       └── Native module / config modified (Native Rebuild)
    │               ├── Increment android.versionCode (+1) & bump patch version in app.json / package.json
    │               ├── Commit version bump back to main with [skip ci]
    │               ├── eas build --platform android --profile production --wait --json
    │               ├── Download APK artifact from EAS CDN to GitHub runner
    │               ├── Create GitHub Release tagged v{version} with direct .apk attachment
    │               └── Users receive Native Update Prompt in-app
```

### Key Design Choices

1. **Automated Version Bumping in CI**:
   When native changes are merged, CI automatically increments `android.versionCode` by 1 and bumps the semantic patch version in `app.json` and `package.json`, then commits back to `main` with `[skip ci]`. This guarantees Android treats the new APK as an upgrade without requiring manual developer intervention.

2. **Wait for EAS Build & Direct APK Attachment**:
   CI triggers `eas build --platform android --profile production --non-interactive --wait --json`. It parses the resulting artifact URL, curls the `.apk` file into the runner workspace, and attaches it directly to the GitHub Release tagged `v{version}`.

3. **In-App Update Precedence (Native over OTA)**:
   On cold startup, the app first queries `https://api.github.com/repos/Techkilladis/MoneyManager/releases/latest`. If a newer native version is available with an attached `.apk`, the **Native Update Prompt** is displayed, suppressing older OTA prompts. Because the new APK already bundles all prior JavaScript changes, installing the APK supersedes older OTA updates.

4. **Direct Browser APK Download**:
   When the user taps "Download" on the Native Update prompt, the app delegates to the browser via `Linking.openURL(asset.browser_download_url)`. Chrome immediately starts downloading the APK in the background. Once downloaded, the user taps the file to install the in-place upgrade.

5. **Two-Stage OTA Update Experience & Paced Buffering**:
   When only JavaScript updates are available, the app shows:
   - *Stage 1*: Modal asking the user if they want to update now or later.
   - *Downloading State (Paced Buffering)*: Buffering/progress indicator stating *"Downloading update... Please do not close the app"* with dismiss actions disabled. To prevent user confusion when lightweight bundles (e.g. ~2 KB) complete near-instantaneously, a deliberate minimum buffer duration of 3 seconds is enforced before transitioning.
   - *Stage 2*: Once `Updates.fetchUpdateAsync()` succeeds and the minimum duration has elapsed, modal transitions to *"Update ready"*, offering *"Restart now"* (invoking `Updates.reloadAsync()`) or *"Restart later"*.

6. **Startup Check Resilience**:
   Update checks occur on app launch with silent error handling. Offline states or GitHub API rate limits do not disrupt app functionality or surface intrusive error banners.

## Consequences

### Positive
- **Fully Hands-Off**: No manual version bumps, no manual artifact downloads, and no manual release uploads required.
- **Accurate Precedence**: Users never download stale OTA updates when a native rebuild has already occurred.
- **Immediate Downloads**: Direct APK asset link prevents confusing GitHub release web page navigation.
- **Controlled Restarts**: Two-stage OTA prompt ensures users aren't abruptly kicked out of the app during downloads.

### Negative
- **EAS Build Time in Actions**: Waiting for EAS Android cloud builds (`--wait`) takes ~5–10 minutes on GitHub Actions runners, consuming free GitHub Actions build minutes.
- **Manual APK Installation**: Android security sandboxing requires users to manually tap the completed browser download to trigger package installation.
