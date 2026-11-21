# 004. Idempotent Rerun Scan and In-Place Account Re-link

**Status:** accepted  
**Date:** 2026-11-21  

## Context

Following ADR 003, Money Manager introduced the `Account` domain model and multi-rail bank SMS ingestion. However:
1. Users who had previously recorded transactions prior to account creation or who received payments while accounts were unconfigured ended up with transactions assigned to the default `Cash` account (`accountId = 'account-cash'`) or empty `accountId`.
2. The initial account backfill mechanism was restricted by a one-time completion flag (`hasRunAccountBackfill`), preventing users from re-running backfill after configuring new accounts.
3. The native `SmsInbox.scan()` routine only queried messages newer than `LAST_SCAN - 1 hour`, making it impossible to perform an on-demand catch-up scan across older SMS inbox messages to recover missed payments.
4. Users need a persistent, explicit **"Rerun scan"** action accessible from Settings (under Auto-capture) and Accounts that can execute either an incremental or a complete deep inbox scan, guaranteeing strict idempotency (no duplicate transactions) and updating existing cash-labeled transactions in place.

## Decision

We introduce an on-demand, idempotent **Rerun Scan** and **In-Place Account Re-link** mechanism across the native module and React Native application layers.

```
User taps "Rerun scan" in Settings (under Auto-capture) or Accounts
    │
    ├── Choose Scan Mode:
    │     ├── "Incremental scan" (since last scan)
    │     └── "Complete scan" (deep scan of all inbox messages)
    │
    ├── Native Ingestion (SmsInbox.scan / rescan)
    │     └── Idempotent deduplication against PendingEventStore & transactions
    │
    ├── SQLite Sync & In-Place Re-link
    │     ├── Found duplicate matching existing transaction:
    │     │     └── If existing is 'account-cash' or empty -> update accountId in place
    │     └── Found new payment -> create as pending capture transaction
    │
    └── Account Discovery & Backfill
          ├── Existing accounts match -> auto-link unlinked/cash transactions
          └── New account mask discovered -> present AccountDiscoveryModal
                └── User confirms type (Savings/Current/Credit Card) -> saves & updates all matching
```

### Key Design Choices

1. **Persistent UI Entry Points**:
   - Add a dedicated **"Rerun scan"** row in Settings (`app/(tabs)/settings.tsx`) positioned immediately below the Auto-capture section.
   - Also provide a rerun/rescan button in the Accounts screen (`app/accounts.tsx`).
   - Triggering the action presents a choice between **Incremental scan** (messages since last scan) and **Complete scan** (deep inbox scan).

2. **Native SMS Deep Scan Support**:
   - Extend `SmsInbox` and `MoneyManagerNotificationDetectionModule` to accept a `fullScan: Boolean` flag (or `days: Int`).
   - In full scan mode, the timestamp filter ignores the `LAST_SCAN` timestamp and scans all inbox messages up to a safe safety limit (e.g. 2,000 messages or past 90 days), with `PendingEventStore.isKnownSms` deduplication ensuring no duplicate pending events.

3. **Strict Idempotency & In-Place Cash Replacement**:
   - In `transactionRepository.createWithIdempotency` and `syncPendingNativeEvents`:
     - When an incoming bank SMS or pending event matches an existing transaction (by `sourceEventId`, `notificationId`, or matching amount, merchant, and timestamp within 5 minutes):
     - If the existing transaction has `accountId = 'account-cash'` or `accountId IS NULL`, but the scanned SMS contains a bank name or account mask, the existing transaction is updated **in place** with the newly resolved account and metadata.
     - No new transaction row is created (`isNew: false`).

4. **Iterative Account Discovery via Modal**:
   - If unconfigured account masks are detected during the rerun, the app surfaces the existing `AccountDiscoveryModal`.
   - The modal pre-fills the discovered bank name and mask, defaulting to `SAVINGS`, and prompts the user to select the account type.
   - Upon saving, `accountBackfillService.completeBackfillForAccount` immediately updates all matching transactions in place.

5. **Toast Feedback**:
   - At the conclusion of the rerun scan, show a summary toast informing the user of the outcome (e.g. *"Rerun complete: 2 new payments found, 5 transactions linked to accounts"*).

## Consequences

### Positive
- Users can safely recover missed payments and fix miscategorized cash transactions at any time with a single tap.
- Full idempotency guarantees zero duplicate transactions.
- Smooth discovery for new bank accounts with minimal manual data entry.

### Neutral / Trade-offs
- Complete scans of large SMS inboxes may take a few seconds, requiring clear loading indicators during execution.
