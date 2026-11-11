# Automated CI/CD Pipeline

The pipeline and in-app update mechanism that manages Over-the-Air updates and native Android releases.

## Core Concepts

**CI/CD Pipeline**:
The automated GitHub Actions workflow triggered on pull request merge to build either an Over-the-Air update or a native APK.
_Avoid_: Build script, deployment runner

**Pull Request (PR)**:
A GitHub pull request whose merge into the main branch initiates the build and release workflow.
_Avoid_: Patch, commit trigger

**Main Branch**:
The production-ready trunk branch where merged code lives.
_Avoid_: Master, develop branch

**Auto-Detect**:
The workflow step inspecting changed files between merge base and head to route to an OTA update or a native rebuild.
_Avoid_: Change listener, manual build selector

## Build Types

**OTA Update**:
A lightweight JavaScript and asset update published to EAS Update without modifying binary code.
_Avoid_: Hot reload, live patch

**Native Rebuild**:
A complete Android APK compiled by EAS when native modules or configuration change.
_Avoid_: App store build, binary release

**Automated Version Bumping**:
The CI step that increments `android.versionCode` and semantic version in project manifests upon a native rebuild.
_Avoid_: Manual versioning, tag bumping

## Distribution

**GitHub Release**:
A tagged release on GitHub hosting the compiled APK file as a downloadable asset.
_Avoid_: Release page link, artifact upload

**Direct APK Download**:
A direct HTTPS link to the `.apk` asset in a GitHub Release that triggers immediate file download in the browser.
_Avoid_: Release page redirection, manual asset picker

**APK**:
The Android Package Kit binary installed on device for native upgrades.
_Avoid_: Installer bundle, setup file

## In-App Update Experience

**Two-Stage OTA Prompt**:
A user flow that first requests confirmation to download (showing a buffering screen), then prompts to restart now or restart later.
_Avoid_: Silent auto-restart, single-prompt reload

**Native Update Prompt**:
A modal informing the user that a newer APK release is available, with actions to download immediately in the browser or defer.
_Avoid_: Store redirect prompt, forced update screen

**Update Precedence**:
The rule that native binary updates supersede pending OTA updates, because native binaries already contain all prior JavaScript changes.
_Avoid_: Sequential patch stacking, blind OTA applying
