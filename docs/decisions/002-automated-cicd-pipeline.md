# ADR-002: Automated CI/CD Pipeline for Money Manager

## Status
Accepted

## Context
The Money Manager app is a personal project distributed to ~10 friends. Currently, every code change requires manual steps: running `eas build`, downloading the APK, and installing it on each friend's device. This is tedious and doesn't scale. The app uses Expo SDK 52 with EAS, has a custom native Android module (`modules/notification-detection/`), and is configured with `expo-updates` for OTA capability.

## Decision
We implement a **GitHub Actions-based CI/CD pipeline** that triggers on PR merge to `main`. The pipeline auto-detects whether changes are JS-only or include native code, then routes to the appropriate build path:

```
PR Merged to main
    │
    ├── GitHub Actions workflow triggered
    │       │
    │       ├── Auto-detect changed files
    │       │       │
    │       │       ├── JS/TS/Assets only → OTA Update (expo-updates)
    │       │       │                       → eas update --channel production
    │       │       │                       → Friends get "Update available" prompt
    │       │       │
    │       │       └── Native module changed → Full Native Build
    │       │                               → eas build --platform android --profile preview
    │       │                               → Upload APK to GitHub Release
    │       │                               → Notify friends via PR comment
    │       │
    │       └── Daily Native Build Cap
    │               → Only 1 native build per calendar day
    │               → Protects EAS Free plan quota (50/month)
```

### Key Design Choices

1. **PR Merge Trigger, Not Push**: Builds only trigger on merge to `main`, not on every push. This protects EAS build quota and ensures only reviewed code is distributed.

2. **Production Channel for OTA**: Updates go directly to the production channel (not preview), since friends receive production builds. The app's `runtimeVersion.policy: "appVersion"` ensures compatibility.

3. **Dedicated EAS API Key**: CI uses a dedicated EAS API token stored as a GitHub secret (`EAS_ACCESS_TOKEN`), revocable independently of the user's personal account.

4. **Auto-Created GitHub Releases**: Native rebuilds auto-create a GitHub Release (e.g., `native-v1.0.1`) with the APK attached. Friends receive a deep link in the PR comment/notification.

5. **Daily Native Build Cap**: At most 1 native rebuild per calendar day. If multiple PRs merge on the same day requiring native builds, only the first triggers a build. Subsequent merges that day get OTA-only (or wait until next day).

6. **User Update Preference**: A setting in the app lets users choose between:
   - Auto-background update (silent)
   - Manual prompt ("Update available — restart now?")
   Default is manual prompt for transparency and trust.

7. **Public Repository**: The repo is public so anyone can see the code. This enables free GitHub Actions minutes and full transparency.

## Consequences

### Positive
- **Zero manual effort**: Friends never need to build, download, or install manually.
- **Instant updates**: OTA updates are applied on next app launch.
- **Quota protection**: Daily cap prevents accidental EAS quota exhaustion.
- **Transparency**: Users control update behavior via setting.
- **Audit trail**: Every release is tracked as a GitHub Release with APK attached.

### Negative
- **Native rebuilds still consume quota**: 1 native build/day = max 30/month, within the 50/month Free tier limit.
- **GitHub Actions minutes**: Public repo gets free minutes, but heavy use could deplete them faster than EAS builds.
- **No iOS support yet**: The native module is Android-only; iOS would require separate implementation.
- **APK installation friction**: Native rebuilds still require manual APK install by friends (though the link makes it one-click).

## Related Decisions
- [ADR-001](./001-native-pending-event-persistence.md): Native event persistence design
- `app.json`: EAS project configuration (`794dc62b-...`)
- `eas.json`: Build profiles and channel definitions
