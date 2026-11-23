# 006. Usage-Driven Category Ranking (Freshiency)

**Status:** accepted  
**Date:** 2026-11-23  

## Context

In transaction review (Quick Capture) and manual entry forms, categories were previously displayed in static creation/seed order (`sortOrder ASC, name ASC`). With the visible chip limit set to 6, rarely used default categories (such as Health at sortOrder 6) occupied prime visible slots, while frequently used categories (such as Education at sortOrder 7 or user-created categories) were relegated behind the "More" overflow modal. This introduced repetitive friction for daily transaction logging.

Evaluating ranking strategies revealed clear trade-offs:
- **Pure LRU (Least Recently Used)**: Over-rotates on one-off edge-case transactions (e.g., an occasional hospital visit under Health pushes out habitual categories on subsequent entries).
- **Pure All-Time Frequency**: Fails to adapt when user habits or life stages evolve, keeping early categories permanently ahead.
- **Hybrid Recent-Frequency ("Freshiency")**: Ranks categories by frequency within a rolling 90-day window, resolving ties via the most recent transaction timestamp. Out-of-window or unused categories fall back to all-time counts, followed by default catalog `sortOrder`.

## Decision

1. **Contextual Recommendation in Slot 1**: If a merchant suggestion (from `classificationService`) or a user-selected category exists, it occupies the primary slot in `CategoryChips`.
2. **Recent-Frequency (Freshiency) for Remaining Slots**: Order the remaining categories based on confirmed transaction activity in a 90-day rolling window (`usageCount DESC, lastUsedAt DESC`), with all-time count and catalog `sortOrder` as tie-breakers.
3. **Partitioning by Transaction Kind**: Aggregate usage strictly partitioned by transaction kind (`EXPENSE` vs `INCOME`).
4. **Scope**: Apply dynamic ordering to `CategoryChips` (Quick Capture, Transaction Form) and the full `CategoryGrid` sheet. Keep the Settings category management screen (`app/categories.tsx`) in static catalog order to prevent disorientation while editing or reordering categories.
5. **On-the-Fly Aggregation**: Execute a lightweight SQLite aggregation query in `categoryRepository` without introducing extra persistent cache tables, triggers, or synchronization overhead.

## Consequences

- Habitual categories (like Education, Food, Travel) automatically appear in the top quick chips without manual configuration.
- Outlier one-off transactions do not permanently disrupt the quick selection bar.
- Category management remains predictable in settings.
- Zero database schema migrations or state sync complexity.
