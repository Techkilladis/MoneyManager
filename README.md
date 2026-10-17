# Money Manager

Privacy-first personal finance application for Android focused on automatically capturing UPI transactions and providing powerful local analytics.

## Stack
- **Expo SDK**: 52.x
- **React Native**: 0.76.x
- **React**: 18.3.x
- **TypeScript**: 5.5.x
- **Database**: Expo SQLite (local-first)
- **Native**: Kotlin (NotificationListenerService)
- **Charts**: react-native-gifted-charts (SVG-based)

## Quick Start

```bash
# Install dependencies
npm install

# Validate project
npx expo-doctor

# Generate native Android project
npx expo prebuild --clean

# Run on Android (requires device/emulator)
npx expo run:android
```

## Project Structure
```
MoneyManagerExpo52/
├── app/                        # Expo Router screens (every file is a route)
│   ├── (tabs)/                 # Home, History, Insights, Settings + custom tab bar
│   ├── transaction/[id].tsx    # Expense detail
│   ├── transactions/           # Add / edit expense
│   ├── quick-capture.tsx       # Review queue for auto-captured UPI payments
│   ├── budgets.tsx, categories.tsx, members.tsx
│   └── _layout.tsx             # DB init, foreground UPI sync, toasts
├── src/
│   ├── components/
│   │   ├── ui/                 # Design-system kit (Text, Button, Card, Sheet, Toast, Icon…)
│   │   ├── TransactionForm.tsx, TransactionRow.tsx, Pickers.tsx
│   │   ├── DateTimeSheet.tsx   # Pure-JS calendar + time picker
│   │   └── Charts.tsx          # Bar, donut and stacked-bar charts (react-native-svg)
│   ├── design/tokens.ts        # Colours, type scale, spacing, radii, shadows
│   ├── hooks/useScreenData.ts  # Focus-aware loader that refreshes on data changes
│   ├── database/               # SQLite schema & repositories
│   ├── domain/                 # Models, category glyphs
│   ├── services/               # Ledger queries, budgets, analytics, classification, native bridge
│   └── utils/format.ts         # INR / date formatting
├── modules/notification-detection/  # Native Kotlin NotificationListenerService
├── android/                    # GENERATED - do not edit manually
└── docs/
```

## Features
- **Automatic UPI capture**: a native NotificationListenerService detects payments from Google Pay, PhonePe, Paytm, BHIM and more; they wait in a review queue
- **Quick review**: confirm or ignore captured payments one after another, with categories pre-filled from merchant memory
- **Manual entry**: big-number amount entry, recent-merchant suggestions, category grid, people, date/time picker, notes
- **History**: search, period chips, category/person filters, grouped by day with daily totals
- **Insights**: week / month / 3-month / year views with period navigation, trend bars, category donut, top merchants, people split, highlights
- **Recurring monthly budgets** per category, with progress shown on Home and Insights
- **Custom categories (emoji + colour) and people**
- **CSV export** via the system share sheet, and a full data reset
- **Local-first**: everything stays in SQLite on the device

## Development Phases
See `docs/project-status.md` for current phase and progress.

## Key Principles
- Local-first + Privacy-first + Financial data correctness
- Money stored as integer paise (₹125.50 = 12550)
- No cloud backend for MVP
- Native Kotlin NotificationListenerService for UPI detection
- Expo Development Build (not Expo Go)
- **No AI/ML on device** — deterministic algorithms only

## Documentation
- [Product Specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Project Status](docs/project-status.md)