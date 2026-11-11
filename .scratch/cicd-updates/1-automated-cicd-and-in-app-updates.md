# Automated CI/CD Pipeline and Unified In-App Update Distribution

**Status:** ready-for-agent  
**Blocking:** none  

## Problem Statement

Currently, delivering updates to Money Manager users is prone to friction and manual intervention:
1. When JavaScript-only fixes or features are merged to the main branch, developers must manually verify deployment channels, while users get abrupt reload prompts or lack visibility into download progress.
2. When native modules or configurations change, the app requires a native binary rebuild with incremented Android version codes and manual GitHub release uploads. This cannot be updated over-the-air.
3. Users running older app binaries have no automated mechanism to know that a new native APK is available on GitHub Releases, nor do they have a one-tap direct download link to upgrade without navigating raw GitHub release pages.
4. Older app binaries could receive mismatched or stale OTA updates before upgrading their native binary, leading to wasted bandwidth or runtime incompatibilities.

## Solution

A fully automated CI/CD pipeline paired with a unified, dual-channel in-app update experience:
- On every pull request merge to the main branch, CI automatically detects whether native code or configuration changed.
- For JavaScript-only changes, CI publishes an OTA update to the production channel. The app prompts the user to download with an indeterminate buffering screen, then prompts to restart now or restart later once downloaded.
- For native changes, CI automatically bumps the Android version code and semantic patch version, commits back to the main branch with `[skip ci]`, triggers and waits for the EAS cloud build, downloads the resulting APK, and publishes a tagged GitHub Release with the APK attached.
- When users launch the app, it checks for updates, prioritizing Native APK releases over OTA updates. If a newer native version exists, a modal offers a direct one-tap download that instructs Chrome to fetch the APK directly for straightforward manual installation.

## User Stories

1. As an app user, I want the app to check for updates when I open it, so that I always have access to the latest financial tracking features and bug fixes.
2. As an app user, I want to be notified when a new native APK version is available on GitHub, so that I know when an upgrade with native features is released.
3. As an app user, I want tapping "Download" on a native update notification to immediately start downloading the APK in Chrome, so that I don't have to navigate web pages or hunt for the correct download file.
4. As an app user, I want to be able to tap "Later" on a native update prompt, so that I can finish my immediate transaction tracking without being blocked.
5. As an app user, I want native update checks to fail silently when I am offline or have poor connectivity, so that the app opens quickly without showing annoying error alerts.
6. As an app user, I want to be prompted when a new Over-the-Air (OTA) update is available, so that I have control over when the app downloads new JavaScript changes.
7. As an app user, I want to see a clear downloading/buffering transition while an OTA update is being fetched, so that I know the app is actively working and hasn't frozen.
8. As an app user, I want the app to prevent me from accidentally dismissing or interacting with background screens while an OTA update is actively downloading, so that the download finishes reliably without corruption.
9. As an app user, I want to receive a confirmation prompt once an OTA update has finished downloading with "Restart now" and "Restart later" options, so that I am never booted out of an active workflow unexpectedly.
10. As an app user, I want tapping "Restart now" to immediately restart the app and load the new update, so that I can immediately start using the new improvements.
11. As an app user, I want tapping "Restart later" to close the prompt, so that I can continue using the current session and receive the update on the next normal app start.
12. As an app user, I want native updates to take precedence over older OTA updates, so that I never waste time and mobile data downloading obsolete JavaScript bundles that will be overwritten when I install the new APK.
13. As an app developer, I want the CI/CD pipeline to automatically determine whether a merged pull request is an OTA update or a native rebuild, so that I don't have to configure or select build workflows manually.
14. As an app developer, I want the CI/CD pipeline to automatically increment the Android version code and semantic patch version when native changes merge, so that I never forget to bump versions or create incompatible duplicate builds.
15. As an app developer, I want the automated version bump committed back to the main branch with `[skip ci]`, so that an infinite build loop is prevented.
16. As an app developer, I want CI to wait for the EAS cloud build to finish, download the compiled APK artifact, and attach it to the GitHub Release, so that users always have a valid, downloadable binary file attached to the release tag.
17. As an app developer, I want OTA updates to publish directly to the production EAS channel on PR merge, so that users receive the updates on their next cold start without manual publishing.
18. As an app developer, I want CI/CD checks to run linting and typechecking before publishing OTA updates, so that broken or uncompilable JavaScript bundles are never pushed to users.
19. As an app developer, I want the GitHub release tag to follow a predictable format (e.g. `v{version}`), so that the in-app update checker can reliably parse semantic versions.
20. As an app developer, I want pull request comments to automatically notify the team with update details and links upon successful CI/CD completion, so that release status is visible directly inside GitHub.

## Implementation Decisions

### Published Tickets
This spec has been broken down and published as native GitHub Issues:
- [#15: In-App Update Detection Service with Version Precedence & Tests](https://github.com/Techkilladis/MoneyManager/issues/15)
- [#16: Unified In-App Update Modal UI (Two-Stage OTA & Direct Chrome Native Download)](https://github.com/Techkilladis/MoneyManager/issues/16)
- [#17: CI/CD Automated Version Bumping & Change Detection Routing](https://github.com/Techkilladis/MoneyManager/issues/17)
- [#18: CI/CD Native Build Wait, APK Download & GitHub Release Publishing](https://github.com/Techkilladis/MoneyManager/issues/18)

- **Two-Tier Update Architecture**: Native update checks and OTA update checks are unified in a dedicated update checking service. Native binary updates always supersede pending OTA updates because the native APK bundle already compiles all recent code from the main branch.
- **GitHub Releases API for Native Detection**: The update checker queries the public GitHub Releases endpoint for the repository on app cold start. It compares the semantic release tag against the installed application version and confirms the presence of an `.apk` asset in the release payload.
- **Direct Asset Download Trigger**: The native prompt extracts the `browser_download_url` directly from the GitHub Release `.apk` asset metadata and passes it to the platform URL opener, immediately launching the device's default web browser with a direct file download stream.
- **Two-Stage State Machine for OTA Updates**: The OTA update flow is structured as a explicit state machine:
  1. *Idle / Available*: Displays prompt to start download or defer.
  2. *Downloading*: Disables actions, displays animated progress/buffering feedback, and invokes the updates fetch routine.
  3. *Ready to Restart*: Prompts the user to restart now or restart later.
- **Automated Manifest Versioning in CI**: For merged PRs with native changes, the workflow script parses and increments `android.versionCode` by 1 and bumps the semantic patch version in both the app configuration manifest and the project package manifest. Changes are committed to the trunk branch using Git credentials with `[skip ci]`.
- **Synchronous EAS Build Retrieval**: The native build CI job triggers EAS cloud build with non-interactive, wait, and JSON-output flags. It extracts the generated artifact URL, downloads the `.apk` file into the runner workspace, and passes the file to the GitHub release publisher action.
- **Silent Startup Resilience**: All network operations in the update checker catch and swallow network timeouts, offline states, and HTTP rate limits (such as GitHub unauthenticated API limits), ensuring the user interface mounts instantly and unhindered on launch.

## Testing Decisions

- **Good Test Principle**: Tests must verify the public observable behavior and state transitions of the update service and user interface components, rather than internal implementation details or private variables.
- **Update Checker Service Tests**:
  - Test semantic version comparison logic (release version greater than, equal to, or lower than installed version).
  - Test asset filtering (correctly identifies and extracts `.apk` asset URL, ignores releases with no `.apk` asset).
  - Test precedence logic (when both native and OTA updates are available, native update descriptor is returned).
  - Test resilience (ensures network rejections or HTTP 403 / 404 responses resolve cleanly to a 'no update' outcome without throwing).
- **Update Prompt Component Tests**:
  - Test transition from initial detection to "Update available" UI.
  - Test transition to downloading/buffering state when "Update now" is pressed, verifying that user dismiss interactions are blocked during active download.
  - Test transition to "Restart ready" state once download completes, verifying that "Restart now" triggers the reload routine and "Restart later" dismisses the modal.
  - Test native prompt actions: tapping "Download" invokes URL opening with the exact APK URL and closes the modal; tapping "Later" dismisses the modal.
- **Prior Art**: Follows patterns established in the project's existing service test suites (`src/services/__tests__/`), using Jest test suites with mocked platform modules (`expo-updates`, `expo-application`, `Linking`).

## Out of Scope

- Automated in-app installation of the APK file without user intervention (Android platform security requires user confirmation to install third-party APKs).
- iOS native distribution or TestFlight integration (the application's native module and distribution setup is currently Android-focused).
- Rolling back native APK installations via in-app UI (downgrading requires manual uninstallation on Android).
- In-app byte-level progress reporting for OTA downloads (the Expo Updates client protocol does not stream byte counters for bundle asset downloads; indeterminate buffering indicators are used instead).

## Further Notes

- The project's EAS configuration uses `runtimeVersion.policy: "appVersion"`, ensuring that OTA updates published under a specific version code will never mistakenly apply to incompatible native shells.
- All terms used in this spec adhere to the project's canonical glossary (`GLOSSARY.md`) and Architectural Decision Record (`docs/decisions/002-automated-cicd-pipeline.md`).
