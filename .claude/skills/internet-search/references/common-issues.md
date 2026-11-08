---
name: Common Expo/React Native Issues Reference
---

# Common Expo/React Native Issues and Search Patterns

## Metro Bundler Errors

| Symptom | Search Query |
|---------|-------------|
| `Metro Bundler failed to compile` | `"metro bundler failed to compile" site:github.com/expo/expo/issues` |
| `Module does not exist` | `"module does not exist" metro expo site:stackoverflow.com` |
| `TransformError` | `"transform error" metro babel site:github.com/expo/expo/issues` |
| Port already in use | `metro port already in use expo` |

## Build Errors

| Symptom | Search Query |
|---------|-------------|
| EAS build failed | `eas build failed error code site:docs.expo.dev` |
| Android gradle sync error | `android gradle sync failed expo site:github.com/expo/expo/issues` |
| iOS code signing error | `ios code signing failed expo eas site:stackoverflow.com` |
| Native module not found | `"native module not found" expo react-native site:github.com` |

## Expo Router Issues

| Symptom | Search Query |
|---------|-------------|
| Route not loading | `"expo-router" route not loading site:github.com/expo/router/issues` |
| Navigation state lost | `"expo-router" navigation state lost site:stackoverflow.com` |
| Link component error | `"expo-router/link" error site:github.com/expo/router/issues` |
| Layout issues | `"expo-router" layout _layout.tsx not working site:github.com` |

## Dependency Conflicts

| Symptom | Search Query |
|---------|-------------|
| Incompatible packages | `expo install --fix incompatible packages` |
| Native module mismatch | `"native module" version mismatch expo sdk site:github.com` |
| Peer dependency error | `npm peer dependency conflict expo react-native` |

## Runtime Errors

| Symptom | Search Query |
|---------|-------------|
| White screen on launch | `react-native white screen on launch expo site:stackoverflow.com` |
| Black screen Android | `"black screen" android expo react-native site:github.com` |
| Memory overflow | `react-native memory overflow js bundle site:github.com` |
| Hermes compilation error | `hermes compilation error expo site:github.com/expo/expo/issues` |

## Search Tips for These Issues

1. **Always include the SDK version** in your search — e.g., `"expo sdk-51" "<error>"`
2. **Check the Expo GitHub issues first** — Most library bugs are tracked there
3. **Look for pinned/closed issues** — These often have confirmed solutions
4. **Check the issue's comments** — Workarounds are frequently added after the original report
