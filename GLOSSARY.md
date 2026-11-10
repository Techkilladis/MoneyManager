# Glossary — Automated CI/CD Pipeline

## Core Concepts

**CI/CD Pipeline** — The automated workflow that converts a merged GitHub Pull Request into either an Over-the-Air (OTA) update or a full native Android build, depending on whether only JavaScript/TypeScript code changed or native module code was modified.

**Pull Request (PR)** — A GitHub feature where proposed changes are reviewed before merging. The CI/CD pipeline is triggered when a PR is **merged** into the `main` branch, not on every push or commit.

**Main Branch** — The default protection branch (`main`) that holds production-ready code. Only merged PRs trigger builds; direct pushes to `main` do not.

## Build Types

**OTA Update (Over-the-Air)** — A lightweight update that only applies to JavaScript and asset changes. Published via Expo Updates to the production channel. No download or installation required; the app receives the update on next launch and prompts the user to restart.

**Native Rebuild (Full Build)** — A complete Android APK build triggered when the native module (`modules/notification-detection/`) is modified. Produces an APK file attached to a GitHub Release. Users install by tapping the APK from the notification link.

**Auto-Detect** — The CI workflow's logic that inspects which files changed in the merged PR. If only `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.json` (non-native) files changed → OTA. If any file under `modules/notification-detection/` or native Android files (`*.kt`, `*.java`, `*.xml` in native directories) changed → Native Rebuild.

## Channels and Versions

**Production Channel** — The EAS channel where OTA updates are published. Friends receive updates directly on this channel via the `expo-updates` runtime configured with `runtimeVersion.policy: "appVersion"`.

**Preview Channel** — An EAS channel in `eas.json` reserved for development builds and internal testing. Not used for friend-facing updates in this pipeline.

**Development Build** — An EAS build profile with `developmentClient: true`, used locally during development (`expo run:android`). Not part of the CI/CD pipeline to friends.

## Distribution

**GitHub Release** — A tagged release on GitHub that contains the APK artifact from a native rebuild. Auto-created by the CI workflow with a tag like `native-v1.0.1`. The notification to friends includes a deep link to this release page where they can download and install the APK.

**APK (Android Package Kit)** — The installable Android application package produced by a native rebuild. Friends receive a notification with a link to the GitHub Release containing the APK, then manually install it like any Android app update.

**Update Notification** — A runtime check performed when the app launches. For OTA updates: displays "Update available — restart now?" dialog (unless auto-update setting is enabled). For native rebuilds: displays a notification with a deep link to the GitHub Release APK download.

## Authentication and Secrets

**EAS API Key** — A dedicated authentication token created specifically for the CI/CD workflow. Stored as a GitHub repository secret (`EAS_ACCESS_TOKEN`). Can be revoked independently without affecting the user's personal EAS account access.

**GitHub Secret** — Encrypted environment variables stored in the repository settings (Settings → Secrets and variables → Actions). Used to store sensitive values like `EAS_ACCESS_TOKEN` that the CI workflow needs for authentication.

## Quota Management

**Daily Native Build Cap** — A safeguard that limits native APK rebuilds to one per calendar day, even if multiple PRs merge on the same day requiring native builds. Protects the EAS Free plan quota (50 builds/month).

**EAS Build Quota** — The monthly limit on EAS cloud builds. Free tier provides 50 builds/month. OTA updates do not consume this quota. Native rebuilds consume one build each.

## User Control

**Update Preference Setting** — A user-configurable setting (stored in app preferences) that controls update behavior:
- **Auto-background-update**: App silently downloads and applies OTA updates without prompting.
- **Manual prompt**: App displays "Update available — restart now?" dialog before applying updates.

**EAS Project** — The Expo Application Services project identified by `794dc62b-...` under owner `zenova1109`. Contains all build configuration, channel definitions, and OTA update metadata.
