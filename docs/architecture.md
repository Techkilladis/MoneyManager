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
│   ├── Analytics Engine
│   └── Deduplication Engine
├── Data Layer (Local-First)
│   ├── Expo SQLite Database
│   ├── Migrations
│   └── Repository Pattern
└── Native Bridge (Kotlin)
    ├── SmsReceiver + SmsInbox
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
- Android SMS BroadcastReceiver + inbox scan (primary)
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
- SMS access explained & user-controlled; only bank SMS mentioning UPI are parsed
- Debug logging avoids sensitive data

### 6. Analytics-First Design (No AI)
- All analytics computed via SQL aggregation in SQLite
- No on-device ML inference; deterministic merchant memory only
- Charts rendered via react-native-gifted-charts (SVG-based)
- Period comparisons calculated server-side (in SQLite)
- Integer paise preserved throughout computation pipeline

## Data Flow

```
UPI Payment → Bank SMS
    ↓
SmsReceiver (live) / SmsInbox (backfill on app start)
    ↓
SmsUpiParser → Deduplicate → PendingEventStore (native SQLite)
    ↓
CapturePopup (live SMS only): heads-up notification, and opens
moneymanager://quick-capture?sourceEventId=… directly when
"Display over other apps" is allowed
(works after the app is swiped from Recents as long as the phone
still delivers SMS to it: OEM Autostart, Xiaomi background pop-ups
and battery restrictions are walked through in the Settings card;
an inbox scan that finds a payment the receiver never saw is
recorded as "missed" and flagged on Home — see BackgroundAccess.kt)
    ↓
App sync → SQLite Database (pending transaction)
    ↓
Quick Capture review (closing it without confirming keeps it pending)
    ↓
User Classification → CONFIRMED transaction
    ↓
Home / Transactions / Analytics screens
```

## Analytics Data Pipeline

```
Analytics Screen
    ↓
analyticsService.getAnalytics(periodRange)
    ↓
SQL Aggregations (getTotalSpending, getCategorySpending, getMerchantSpending, 
                  getMemberSpending, getDailySpendingTrend, getUncategorizedSpending,
                  getMonthlyComparison, generateInsights)
    ↓
Expo SQLite (confirmed transactions only)
    ↓
Chart Data Transformations
    ↓
react-native-gifted-charts (PieChart, LineChart, BarChart)
```