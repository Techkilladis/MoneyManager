# ADR 001: Native Pending-Event Persistence Architecture

## Context

The Money Manager app needs to detect UPI payment notifications on Android and store them for later user classification (Quick Capture). The core challenge is that Android's `NotificationListenerService` can receive notifications at any time — including when the React Native JavaScript runtime is not active (app closed, process killed, device rebooted).

The existing app uses Expo SQLite for transaction storage. We need to decide how to persist pending UPI events detected by the native listener.

## Decision

We will use a **separate native SQLite database** (`moneymanager_notifications.db`) for the pending-event ingestion queue, with a well-defined consumption protocol into the main Expo SQLite transaction database.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Native Layer (Kotlin)                       │
├─────────────────────────────────────────────────────────────────┤
│  NotificationListenerService                                    │
│       ↓                                                         │
│  Normalizer → Parser Registry → Dedupe Engine                   │
│       ↓                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │     PendingEventStore (moneymanager_notifications.db)   │   │
│  │  - PENDING events (not yet classified by user)          │   │
│  │  - CONSUMED events (processed by Quick Capture)         │   │
│  │  - DISMISSED/FAILED events                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│       ↓                                                         │
│  Expo Module Bridge (MoneyManagerNotificationDetectionModule)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     React Native Layer (TS)                     │
├─────────────────────────────────────────────────────────────────┤
│  notificationDetectionService                                   │
│       ↓                                                         │
│  getPendingUpiEvents() → Quick Capture UI                       │
│       ↓                                                         │
│  consumePendingUpiEvent(id) → transactionService.create()      │
│       ↓                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │     Expo SQLite (main app database)                     │   │
│  │  - CONFIRMED transactions (user-classified)             │   │
│  │  - Categories, Members, Merchants, Budgets              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Native Detection**: `NotificationListenerService` receives notification → normalizes → parses → dedupes → stores in native `PendingEventStore` as `PENDING`
2. **Bridge Query**: React Native calls `getPendingUpiEvents()` → native returns list of `PENDING` events
3. **User Classification**: Quick Capture UI shows pending events → user selects category/member/note
4. **Consumption**: React Native calls `consumePendingUpiEvent(id)` → native marks event `CONSUMED` → React Native creates confirmed transaction in Expo SQLite
5. **Cleanup**: Native periodically cleans old `CONSUMED`/`DISMISSED`/`FAILED` events (>30 days)

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Separate native DB | Avoids SQLite locking conflicts between native service (background) and Expo SQLite (foreground); native DB survives process death |
| PENDING → CONSUMED flow | Clear ownership transfer; native owns ingestion, React Native owns confirmed financial data |
| No direct native → Expo SQLite writes | Prevents schema coupling; Expo SQLite is single source of truth for confirmed transactions |
| Dedupe in native layer | Deterministic, survives app restarts; uses transaction reference, amount, merchant, time window |
| Money as integer paise | Consistent with app-wide financial correctness requirement |

## Consequences

### Positive
- **Background reliability**: Native listener works even when React Native is not running
- **No data loss**: Pending events survive app kills, device reboots
- **Clear separation**: Ingestion (native) vs. financial truth (React Native/Expo SQLite)
- **Testable**: Each layer independently testable (parsers, dedupe, store, bridge)
- **No schema migration coupling**: Native DB schema can evolve independently

### Negative
- **Two SQLite databases**: Slightly more complex backup/export (mitigated: only main DB needs user-facing export)
- **Consumption protocol**: Requires correct bridge implementation (mitigated: typed TypeScript/Kotlin interfaces)
- **Storage overhead**: Minimal (pending events are temporary, cleaned after 30 days)

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Native DB corruption | WAL mode, proper transaction handling, periodic integrity checks |
| Bridge version mismatch | Typed interfaces, runtime version check in `initialize()` |
| Orphaned pending events | Cleanup job, UI shows pending count, manual dismiss option |

## Alternatives Considered

### A. Shared SQLite Database
- **Rejected**: SQLite doesn't handle concurrent access from multiple processes well. Native service and React Native could deadlock or corrupt the database.

### B. Write Directly to Expo SQLite from Native
- **Rejected**: Requires JNI access to Expo SQLite internals, creates tight coupling, breaks if Expo SQLite schema changes.

### C. In-Memory Only (No Persistence)
- **Rejected**: Violates requirement that detection works when app is closed. Events would be lost on process death.

### D. Android Room / DataStore
- **Rejected**: Adds unnecessary dependencies. SQLite is sufficient and already in the stack.

## Implementation Notes

- Native module: `modules/notification-detection/`
- Config plugin: `modules/notification-detection/plugin.js` (adds `NotificationListenerService` to manifest)
- React Native bridge: `src/services/notificationDetection.ts`
- Settings UI: `app/(tabs)/settings.tsx` (shows notification access status)
- All monetary values: integer paise (`Long` in Kotlin, `number` in TypeScript)

## References

- [Expo Modules API](https://docs.expo.dev/modules/overview/)
- [Android NotificationListenerService](https://developer.android.com/reference/android/service/notification/NotificationListenerService)
- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)