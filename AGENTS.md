This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npm run check               # ALWAYS run before declaring done: typecheck + lint + jest
npm run test:native         # run native Android unit tests for notification-detection
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Always run `npm run check` before declaring any task done or merging PRs. Note: in Windows PowerShell, chain sequential commands with `;` rather than `&&`.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `app/` (in `src/`).
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building & Releases

- **Native Android Builds**: Native Android APKs are compiled directly on GitHub Actions runners via Gradle with Continuous Native Generation (`expo prebuild --clean`) and declarative release signing (`plugins/withReleaseSigning.js`) per ADR-005.
- **EAS Services**: Use EAS to ship over-the-air JavaScript and asset updates (`eas update`) and submit builds to app stores (`eas submit`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples. Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Coding standards

UI component prop contracts, theming rules, hook constraints, and component boundaries live in `CODING_STANDARDS.md`. Consult before writing or reviewing JSX.

## Subagent delegation

- **Multi-ticket implementations**: When executing multi-ticket features or specs, dispatch an **implementer subagent** for each ticket with a fresh context window. Do not implement large, multi-phase feature specs inline in a single context.
- **Code reviews**: Run code review in a dedicated **reviewer subagent** before merging.
- **Legwork & exploration**: Delegate broad codebase exploration or background investigations to subagents to preserve coordinator context.

## Agent skills

### Issue tracker

Issues are tracked using **GitHub Issues** on `Techkilladis/MoneyManager`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout: one `GLOSSARY.md` at the repo root and ADRs in `docs/decisions/`. See `docs/agents/domain.md`.
