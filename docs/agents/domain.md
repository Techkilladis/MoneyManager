# Domain Docs

## Layout: Single-context

This repo uses a single-context domain model. There is one `GLOSSARY.md` at the repo root and ADRs live in `docs/decisions/`.

### Glossary

- **File:** `GLOSSARY.md` at the repo root (not yet created — skills should create it on first domain-term recording if it does not exist).
- **Purpose:** Project-specific terminology, domain terms, and abbreviations.

### ADRs

- **Directory:** `docs/decisions/` (already exists, contains `001-native-pending-event-persistence.md`).
- **Naming convention:** `<number>-<title>.md` (e.g., `002-sqlite-vs-realm.md`).

## Consumer Rules

### Reading a glossary term

1. Open `GLOSSARY.md` at the repo root.
2. Look up the term in alphabetical order.
3. If the term is absent, record it (see "Recording a new term" below).

### Recording a new term

Append an entry to `GLOSSARY.md`:

```markdown
### `<term>`

Definition in one sentence. Related terms: `[other-term]`.
```

### Reading an ADR

1. Open the file under `docs/decisions/` matching the ADR number.
2. ADRs follow this structure:

```markdown
# <number>. <Title>

**Status:** proposed | accepted | deprecated | superseded
**Date:** YYYY-MM-DD

## Context
## Decision
## Consequences
```

### Recording a new ADR

Create `docs/decisions/<next-number>-<title>.md` using the template above. Increment the number from the highest existing number.
