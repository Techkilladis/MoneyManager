# Money Manager

Privacy-first personal finance application for Android focused on automatically capturing UPI transactions.

## Stack
- **Expo SDK**: 52.x
- **React Native**: 0.76.x
- **React**: 18.3.x
- **TypeScript**: 5.5.x
- **Database**: Expo SQLite (local-first)
- **Native**: Kotlin (NotificationListenerService)

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
├── app/                    # Expo Router screens (to be created)
├── src/
│   ├── components/         # Reusable UI components
│   ├── screens/            # Screen components
│   ├── navigation/         # Navigation config
│   ├── domain/             # Business logic & models
│   ├── database/           # SQLite schema & repositories
│   ├── services/           # App services
│   ├── state/              # State management
│   ├── utils/              # Utilities
│   └── types/              # TypeScript types
├── assets/                 # Images, fonts
├── docs/                   # Documentation
│   ├── product-spec.md
│   ├── architecture.md
│   ├── project-status.md
│   └── decisions/
├── plugins/                # Expo config plugins
├── android/                # GENERATED - do not edit manually
├── app.json                # Expo config
├── package.json
├── tsconfig.json
├── AGENTS.md
└── README.md
```

## Development Phases
See `docs/project-status.md` for current phase and progress.

## Key Principles
- Local-first + Privacy-first + Financial data correctness
- Money stored as integer paise (₹125.50 = 12550)
- No cloud backend for MVP
- Native Kotlin NotificationListenerService for UPI detection
- Expo Development Build (not Expo Go)

## Documentation
- [Product Specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Project Status](docs/project-status.md)