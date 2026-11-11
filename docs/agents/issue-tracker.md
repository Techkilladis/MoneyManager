# Issue Tracker: GitHub Issues

Issues are tracked natively using GitHub Issues on `Techkilladis/MoneyManager`.

## CLI Usage

The GitHub CLI (`gh`) is used to read, create, and manage issues:

```bash
# List open issues ready for an agent
gh issue list --label "ready-for-agent"

# View a specific issue
gh issue view <issue-number>

# Create an issue
gh issue create --title "<Title>" --body "<Body>" --label "ready-for-agent"

# Close an issue
gh issue close <issue-number>
```

## Issue Format

```markdown
## What to build

[The end-to-end behaviour this ticket makes work, from the user's perspective]

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by

- #<number> (or "None (can start immediately)")
```

## Triage Labels

- `ready-for-agent`: The issue is fully specified and ready to be worked on by an AI agent or developer.
- `enhancement`: Feature work or improvements.
- `bug`: Defects or unintended behavior.
