# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users
The creator (solo developer) as the primary user for personal finance tracking; friends as secondary users who may receive the open-source build.

## Product Purpose
A local-first personal finance app that automatically captures UPI payments from bank SMS on Android, lets the user confirm or dismiss them in a quick-review queue, and provides spending insights, budgets, recurring payment tracking, and split-expense management — all without a cloud backend.

## Positioning
Zero data leaves the device. No account, no cloud, no tracking. Deterministic parsing only — no AI/ML on device. UPI-native: built around the Indian payment ecosystem (bank SMS, UPI app names, INR paise accounting).

## Operating Context
- Android device with UPI payments via apps like GPay, PhonePe, Paytm.
- Bank SMS alerts arrive for every UPI transaction; a native Kotlin receiver + inbox scanner extracts them.
- Transactions land in a pending review queue; the user confirms, edits, or dismisses them.
- Everything stored in SQLite on-device via Expo SQLite.
- Requires an Expo Development Build (not Expo Go) due to native modules.
- Open-source distribution: no Play Store, no monetization.

## Capabilities and Constraints
**Capabilities:**
- Automatic UPI capture from bank SMS (receiver + inbox scan).
- Quick-review queue for pending captures.
- Manual entry with big-number amount input, merchant suggestions, category grid, date/time picker.
- History with search, period chips, category/person filters, grouped by day.
- Insights: trend bars, category donut, top merchants, people split.
- Recurring monthly budgets per category with progress tracking.
- Custom categories (emoji + colour) and people/members.
- Split expenses with UPI pay-me-back links.
- Recurring payment detection and reminders.
- Monthly recap.
- CSV export and JSON backup/restore.
- App lock (Face ID / fingerprint).
- Dark mode.
- Android home-screen widget.
- Voice capture.

**Constraints:**
- Android only (iOS not targeted).
- Requires Expo Development Build.
- No cloud sync or cross-device data sharing.
- SMS inbox permission required on Android (may need user interaction for restricted SMS on Android 14+).
- Deterministic algorithms only — no on-device ML.
- Money stored as integer paise (₹125.50 = 12550).
- English language only.

## Brand Commitments
- **Design system**: "Paper & Ink" — calm and editorial. Warm paper canvas (#F6F5F1 light / #12120F dark), flat white cards, hairline borders, deep ink text, single emerald accent (#0E7A5F light / #3CC79A dark). No gradients, no drop shadows (except toast). Category colours live only in small icon badges and charts.
- **Font**: Inter (400 Regular, 600 SemiBold).
- **Currency**: Indian Rupee (₹), en-IN locale formatting.
- **App name**: "Money Manager".
- **Splash**: Emerald rounded-square wallet icon on paper background.

## Evidence on Hand
- Full source code at project root.
- Database schema with seed data (11 expense categories, 5 members, 6 income categories).
- Design tokens, theme, and UI component library in `src/design/` and `src/components/ui/`.
- Project documentation in `docs/`: product-spec, architecture, project-status.
- Test suite: Jest for services (in-memory SQLite), Kotlin for native UPI parser.
- No external brand assets beyond the app icon and splash screen in `assets/`.

## Product Principles
1. **Local-first**: every byte of financial data stays on the device. No sync, no cloud, no compromise.
2. **Privacy by default**: no accounts, no telemetry, no network calls for app functionality.
3. **Deterministic over clever**: predictable parsing, no black-box AI. Users understand exactly how their data is classified.
4. **Speed over features**: the app should feel instant. UPI captures sync every 20 seconds in foreground; review queue is the primary interaction pattern.
5. **Open source**: the code is free to inspect, fork, and run. No hidden features, no paywalls.

## Accessibility & Inclusion
- Dark mode paired with light mode (system-following).
- Haptic feedback on interactions (expo-haptics).
- Speech support (expo-speech) for accessibility output.
- No explicit accessibility audit or WCAG target has been set; future work should evaluate contrast ratios and touch target sizes against the "Paper & Ink" palette.
