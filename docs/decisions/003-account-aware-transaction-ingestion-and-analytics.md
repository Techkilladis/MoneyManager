# 003. Account-Aware Transaction Ingestion and Analytics

**Status:** accepted  
**Date:** 2026-11-20  

## Context

Money Manager users conduct financial transactions across multiple banking accounts (e.g. ICICI Bank, Indian Bank) and cash. Bank SMS alerts arrive for debits and credits across multiple rails—including UPI, NEFT, IMPS, ACH, and ATM withdrawals.

Previously, the app had no concept of an Account:
1. `SmsUpiParser.kt` discarded any bank SMS lacking explicit UPI tokens (`UPI`, `VPA`, 12-digit RRN), ignoring non-UPI credits (such as salary/ACH credits) and debits.
2. Transactions had no association with funding sources, preventing users from seeing where money was spent or filtering transactions by bank account.
3. The Analytics screen presented only a single global category donut chart without account-level breakdown.

## Decision

We introduce a first-class `Account` domain entity, expand native SMS parsing to multi-rail bank alerts with anti-spam filtering, enable in-flight account discovery during Quick Capture, support automatic historical backfill, and implement an account-segmented analytics carousel.

```
Incoming SMS Alert (UPI / NEFT / IMPS / ACH / ATM)
    │
    ├── Anti-Spam & Triad Verification (Kotlin)
    │     ├── Reject: Promotional keywords (loan, pre-approved, offer, etc.)
    │     └── Verify: Action verb + Valid INR amount + Account/Card mask
    │
    ├── Native Store (moneymanager_notifications.db v3)
    │     └── Store event with bankName & accountMask
    │
    ├── Bridge to React Native (getPendingUpiEvents)
    │
    └── Quick Capture Review Queue
          ├── Known Account -> Auto-linked to transaction
          └── Unknown Account -> "New Account Discovered" setup sheet
                └── Save Account -> Auto-assigns to current & pending transactions
```

### Key Design Choices

1. **Unified `Account` Entity**:
   Standardize on `Account` across native and React Native layers. Attributes include `id`, `name`, `bankName`, `mask`, `type` (`SAVINGS`, `CURRENT`, `CREDIT_CARD`, `CASH`), `color`, and `icon`. A system-default `Cash` account (`id: 'account-cash'`) is provided for physical cash transactions.

2. **Broadened Native Bank SMS Parser**:
   Extend native parsing beyond pure UPI to ingest all bank debit and credit transaction messages containing:
   - Debit/Credit verb (`debited`, `credited`, `sent`, `paid`, `withdrawn`, etc.).
   - Parseable INR amount.
   - Account identifier (e.g. `Acct XX172`, `A/c *1224`, `Card ending 1234`).
   - Anti-spam gate rejecting promotional keywords (`loan`, `pre-approved`, `apply`, `congratulations`, `won`, `reward points`, `insurance`, `discount`, `coupon`).

3. **Native Database Migration (v2 → v3)**:
   Add `accountMask TEXT` and `bankName TEXT` columns to `pending_upi_events` in `moneymanager_notifications.db`. Expose both fields across the Expo bridge.

4. **App Database Migration (v6 → v7)**:
   - Create `accounts` table in Expo SQLite.
   - Seed default `Cash` account.
   - Add `accountId TEXT` column and index to `transactions`.

5. **In-Flight Discovery in Quick Capture**:
   When opening Quick Capture, if any queued transaction contains an unrecognized account mask, the app presents a "New Account Discovered" sheet pre-filled with the parsed bank name and mask. Once the user selects the account type and saves, the account is created and auto-assigned to all pending transactions from that account.

6. **Automatic One-Time Historical Backfill**:
   On app launch after upgrading to v7:
   - Existing confirmed transactions are scanned in the background using their stored `rawNotification`.
   - Discovered accounts prompt the setup sheet for the user to configure once.
   - Past transactions are silently linked to their corresponding `accountId` without re-entering the review queue.

7. **Swipeable "Where It Went" Analytics Carousel**:
   In `app/(tabs)/analytics.tsx`, convert the static category Donut card into a horizontal swipeable carousel:
   - **Slide 1**: "All Accounts" (overall total spend + Donut chart of all categories + full category breakdown).
   - **Slide 2..N**: Per-account cards (for every account with spending in the period, including Cash), displaying account badge, total spent, % of total spend, account-filtered Donut chart, and category breakdown list.

8. **Filtering & Management**:
   - Add an Account filter chip to the Transactions History screen (`app/(tabs)/transactions.tsx`).
   - Add an `/accounts` management screen under Settings to add, rename, and customize accounts.
   - Update `TransactionForm.tsx` to include an Account selector defaulting to the last-used account.

## Consequences

### Positive
- Captures salary and ACH bank credits alongside UPI expenses.
- Eliminates promotional spam while remaining resilient to changing bank SMS sender IDs.
- Provides clear visibility into spending per bank account in both History and Analytics.
- Smooth onboarding of new accounts without manual database setup.

### Neutral / Trade-offs
- Native module changes require building a new Android development binary (EAS build / APK).
- Historical transactions with no raw notification text remain unassigned.
