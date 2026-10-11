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
├── app/                    # Expo Router screens
├── src/
│   ├── components/         # Reusable UI components
│   ├── design/             # Design system (tokens, primitives)
│   ├── database/           # SQLite schema & repositories
│   ├── domain/             # Business logic & models
│   ├── services/           # App services
│   └── utils/              # Utilities
├── assets/                 # Images, fonts
├── docs/                   # Documentation
│   ├── product-spec.md
│   ├── architecture.md
│   ├── project-status.md
│   └── decisions/
├── modules/
│   └── notification-detection/  # Native Kotlin module
├── android/                # GENERATED - do not edit manually
├── app.json                # Expo config
├── package.json
├── tsconfig.json
├── AGENTS.md
└── README.md
```

## Features
- **Automatic UPI Detection**: Native Android NotificationListenerService captures payments from Google Pay, PhonePe, Paytm, BHIM, and other UPI apps
- **Quick Capture**: Review and categorize pending transactions with merchant memory suggestions
- **Local Analytics**: Comprehensive spending analytics with 6 interactive chart types (donut, line, horizontal bar, vertical bar)
- **Merchant Memory**: Deterministic learning from user confirmations (no AI/ML)
- **Budget Tracking**: Category budgets with progress bars and status indicators
- **Local-First**: All data stored in SQLite on device, no cloud backend

## Screens
- **Home**: Total spending, pending transactions, recent activity
- **Transactions**: Searchable, filterable list with infinite scroll
- **Analytics**: Period selector, spending summary, category distribution, trends, merchant rankings, member breakdown, budget progress
- **Settings**: Data management, permissions, app info, privacy

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