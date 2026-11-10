# Issue Tracker: Local Markdown

Issues are tracked as markdown files under `.scratch/<feature>/` in this repository.

## Convention

Each issue is a file at `.scratch/<feature>/<number>-<title>.md` where:

- `<feature>` is a category folder (e.g. `sms-detection`, `budgets`, `onboarding`)
- `<number>` is an incrementing integer
- `<title>` is a kebab-case summary

## File template

```markdown
# <Title>

**Status:** backlog | draft | in-progress | done
**Blocking:** [list dependent ticket numbers, or "none"]

## Description

[What needs to be done]

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
```

## Workflow

- Skills like `to-tickets` create `.scratch/` files when generating work items.
- Skills like `triage` read and update the `Status` field.
- Skills like `to-spec` may reference ticket numbers from these files.
