# Money Manager - Architecture

## High-Level Structure

```
Expo React Native Application
├── UI Layer (React Native + TypeScript)
│   ├── Screens (Home, Transactions, Quick Capture, Budgets, Analytics, Settings)
│   ├── Components (Design System, Reusable UI)
│   ├── Navigation (Expo Router)
│   └── State Management (React Context / Zustand)
├── Domain Layer (Business Logic)
│   ├── Transaction Models & State Machine
│   ├── Category System
│   ├── Member System
│   ├── Merchant Memory
│   ├── Budget Logic
│   └── Deduplication Engine
├── Data Layer (Local-First)
│   ├── Expo SQLite Database
│   ├── Migrations
│   └── Repository Pattern
└── Native Bridge (Kotlin)
    ├── NotificationListenerService
    ├── Notification Normalization
    ├── UPI App Detection
    ├── Parser Framework (GooglePay, PhonePe, Paytm, BHIM, Generic)
    ├── Transaction Normalization
    └── Event Bridge to React Native
```

## Key Architectural Decisions

### 1. Expo SDK 52 + Development Build
- Managed workflow with CNG (Continuous Native Generation)
- Native Kotlin code via Expo modules / config plugins
- `expo prebuild` regenerates android/ directory

### 2. Local-First Database
- Expo SQLite for persistence
- Schema: transactions, categories, members, merchants, budgets, settings
- Integer paise for all monetary values
- Explicit transaction states: PENDING, CONFIRMED, EDITED, CANCELLED

### 3. Native UPI Detection
- Android NotificationListenerService (primary)
- Extensible parser architecture per UPI app
- Deterministic deduplication
- Event bridge to React Native via Expo Modules

### 4. State Separation
- React Native handles UI & user interaction
- Kotlin handles notification capture & parsing
- Shared transaction data model via SQLite
- Database logic NOT duplicated across layers

### 5. Security & Privacy
- No cloud backend
- No network requests for financial data
- Least-privilege Android permissions
- Notification access explained & user-controlled
- Debug logging avoids sensitive data

## Data Flow

```
UPI Payment → Android Notification
    ↓
NotificationListenerService (Kotlin)
    ↓
Normalize → Detect UPI App → Parse → Deduplicate
    ↓
SQLite Database (pending transaction)
    ↓
React Native UI (Quick Capture notification)
    ↓
User Classification → CONFIRMED transaction
    ↓
Home / Transactions / Analytics screens
```