# Glossary

### `Account`

A financial funding source (such as a bank savings account, current account, credit card, or cash) associated with transaction debits and credits. Identified by bank name, account number mask (last digits), and account type (`SAVINGS`, `CURRENT`, `CREDIT_CARD`, `CASH`). _Avoid_: `Card`, `Bank`, `Wallet`.

### `APK`

The Android Package Kit binary installed on device for native application upgrades. Related terms: `[Native Rebuild]`, `[Direct APK Download]`.

### `Auto-Detect`

The workflow step inspecting changed files between merge base and head to route to an OTA update or a native rebuild. Related terms: `[CI/CD Pipeline]`, `[OTA Update]`, `[Native Rebuild]`.

### `Automated Version Bumping`

The CI step that automatically increments `android.versionCode` and semantic version in project manifests upon a native rebuild. Related terms: `[Native Rebuild]`, `[GitHub Release]`.

### `CI/CD Pipeline`

The automated GitHub Actions workflow triggered on pull request merge to build either an Over-the-Air update or a native APK. Related terms: `[Pull Request (PR)]`, `[Auto-Detect]`, `[OTA Update]`, `[Native Rebuild]`.

### `Complete Scan`

A deep inbox SMS scan mode that evaluates all available messages in the device inbox regardless of previous scan timestamps, safely deduplicating against existing records. Related terms: `[Rerun Scan]`, `[In-Place Account Re-link]`.

### `Direct APK Download`

A direct HTTPS link to the `.apk` asset in a GitHub Release that triggers immediate file download in the browser. Related terms: `[APK]`, `[GitHub Release]`, `[Native Update Prompt]`.

### `GitHub Actions Android Build`

Direct compilation of the Android APK binary on a GitHub Actions runner using Gradle and the Android SDK, eliminating cloud build queue limits. Related terms: `[Native Rebuild]`, `[Release Signing Plugin]`, `[Keystore Secret]`.

### `GitHub Release`

A tagged release on GitHub hosting the compiled APK file as a downloadable asset. Related terms: `[Direct APK Download]`, `[APK]`.

### `In-Place Account Re-link`

The process of updating an existing transaction's `accountId` in SQLite (upgrading `'account-cash'` or empty accounts with the detected bank account) based on parsed SMS metadata without creating duplicate records. Related terms: `[Account]`, `[Rerun Scan]`.

### `Keystore Secret`

The base64-encoded Android release signing keystore and accompanying credentials stored securely in GitHub Repository Secrets. Related terms: `[Release Signing Plugin]`, `[GitHub Actions Android Build]`.

### `Main Branch`

The production-ready trunk branch where merged code lives. Related terms: `[Pull Request (PR)]`, `[CI/CD Pipeline]`.

### `Native Rebuild`

A complete Android APK compiled directly on GitHub Actions runners when native modules or configuration change. Related terms: `[APK]`, `[Automated Version Bumping]`, `[GitHub Actions Android Build]`, `[Update Precedence]`.

### `Native Update Prompt`

A modal informing the user that a newer APK release is available, with actions to download immediately in the browser or defer. Related terms: `[Direct APK Download]`, `[Update Precedence]`.

### `OTA Update`

A lightweight JavaScript and asset update published to EAS Update without modifying binary code. Related terms: `[Two-Stage OTA Prompt]`, `[Update Precedence]`.

### `Paced Buffering`

A deliberate minimum display duration (3 seconds) enforced during the OTA download state to provide clear visual feedback and reassurance when small bundles finish downloading almost instantaneously. Related terms: `[Two-Stage OTA Prompt]`, `[OTA Update]`.

### `Pull Request (PR)`

A GitHub pull request whose merge into the main branch initiates the build and release workflow. Related terms: `[Main Branch]`, `[CI/CD Pipeline]`.

### `Rerun Scan`

An on-demand action in Settings and Accounts that re-evaluates the SMS inbox (either incrementally or via a complete scan) to ingest previously missed bank payments and update existing cash-assigned transactions in place with their detected bank accounts. Related terms: `[Complete Scan]`, `[In-Place Account Re-link]`, `[Account]`.

### `Release Signing Plugin`

The Expo config plugin (`plugins/withReleaseSigning.js`) that injects release keystore signing configurations into the generated Android Gradle project during `expo prebuild`. Related terms: `[GitHub Actions Android Build]`, `[Keystore Secret]`.

### `Two-Stage OTA Prompt`

A user flow that first requests confirmation to download (showing a buffering screen), then prompts to restart now or restart later. Related terms: `[OTA Update]`.

### `Update Precedence`

The rule that native binary updates supersede pending OTA updates, because native binaries already contain all prior JavaScript changes. Related terms: `[Native Rebuild]`, `[OTA Update]`.
