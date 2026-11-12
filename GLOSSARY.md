# Glossary

### `APK`

The Android Package Kit binary installed on device for native application upgrades. Related terms: `[Native Rebuild]`, `[Direct APK Download]`.

### `Auto-Detect`

The workflow step inspecting changed files between merge base and head to route to an OTA update or a native rebuild. Related terms: `[CI/CD Pipeline]`, `[OTA Update]`, `[Native Rebuild]`.

### `Automated Version Bumping`

The CI step that automatically increments `android.versionCode` and semantic version in project manifests upon a native rebuild. Related terms: `[Native Rebuild]`, `[GitHub Release]`.

### `CI/CD Pipeline`

The automated GitHub Actions workflow triggered on pull request merge to build either an Over-the-Air update or a native APK. Related terms: `[Pull Request (PR)]`, `[Auto-Detect]`, `[OTA Update]`, `[Native Rebuild]`.

### `Direct APK Download`

A direct HTTPS link to the `.apk` asset in a GitHub Release that triggers immediate file download in the browser. Related terms: `[APK]`, `[GitHub Release]`, `[Native Update Prompt]`.

### `GitHub Release`

A tagged release on GitHub hosting the compiled APK file as a downloadable asset. Related terms: `[Direct APK Download]`, `[APK]`.

### `Main Branch`

The production-ready trunk branch where merged code lives. Related terms: `[Pull Request (PR)]`, `[CI/CD Pipeline]`.

### `Native Rebuild`

A complete Android APK compiled by EAS when native modules or configuration change. Related terms: `[APK]`, `[Automated Version Bumping]`, `[Update Precedence]`.

### `Native Update Prompt`

A modal informing the user that a newer APK release is available, with actions to download immediately in the browser or defer. Related terms: `[Direct APK Download]`, `[Update Precedence]`.

### `OTA Update`

A lightweight JavaScript and asset update published to EAS Update without modifying binary code. Related terms: `[Two-Stage OTA Prompt]`, `[Update Precedence]`.

### `Paced Buffering`

A deliberate minimum display duration (3 seconds) enforced during the OTA download state to provide clear visual feedback and reassurance when small bundles finish downloading almost instantaneously. Related terms: `[Two-Stage OTA Prompt]`, `[OTA Update]`.

### `Pull Request (PR)`

A GitHub pull request whose merge into the main branch initiates the build and release workflow. Related terms: `[Main Branch]`, `[CI/CD Pipeline]`.

### `Two-Stage OTA Prompt`

A user flow that first requests confirmation to download (showing a buffering screen), then prompts to restart now or restart later. Related terms: `[OTA Update]`.

### `Update Precedence`

The rule that native binary updates supersede pending OTA updates, because native binaries already contain all prior JavaScript changes. Related terms: `[Native Rebuild]`, `[OTA Update]`.
