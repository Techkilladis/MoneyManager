---
name: internet-search
description: >
  Search the internet for diagnosing bugs, solving problems, debugging issues,
  and finding solutions when stuck. Use when Claude encounters unknown errors,
  needs to find documentation, stack overflow answers, GitHub issues, or Expo/
  React Native solutions. Triggers on error messages, stack traces, "I'm stuck",
  "how to fix", debugging requests, or any technical problem requiring web research.
---

# Internet Search for Diagnostics

Search the web to diagnose errors, find solutions, and unblock development.

## When to Use

- Encountering an unknown error message or stack trace
- React Native / Expo API behavior differs from expectations
- Build failures (EAS, metro, babel, gradle, xcode)
- Runtime crashes with no obvious cause
- Performance regressions or memory issues
- "I'm stuck" or "what's the best approach" moments
- Need to verify current documentation for a library version

## Search Strategy

### 1. Extract the Error Signal

From the error, identify:
- Package name and version (from `package.json` or error message)
- Error code or message substring (exact match in quotes)
- Platform context (iOS/Android/web, Expo Go/dev build, Node version)
- Recent changes that introduced the regression

### 2. Construct Targeted Queries

Prioritize searches in this order:

**Priority A — Exact error messages:**
```
"<exact error message>" site:github.com
"<exact error message>" site:stackoverflow.com
"<exact error message>" expo
```

**Priority B — Package-specific issues:**
```
"<package-name>" "<keyword>" expo router
"react-native" "<error>" sdk-51
```

**Priority C — Documentation verification:**
```
"<package>" "<api>" docs
expo "version number" migration guide
```

### 3. Trusted Source Hierarchy

Search results should be evaluated by trust level:

| Tier | Source | Trust Level |
|------|--------|-------------|
| 1 | Official docs (docs.expo.dev, reactnative.dev) | Highest |
| 2 | GitHub issues with maintainer responses | High |
| 3 | Stack Overflow answers with accepted solution | Medium |
| 4 | Blog posts from recognized authors | Medium-Low |
| 5 | Forum threads, Discord logs | Low |

Always cite the source tier when presenting a found solution.

## Diagnostic Workflows

### Error Diagnosis Flow

```
Error encountered
    ├── Extract error code/message
    ├── Search exact error + package name
    │   ├── Found matching issue? → Check for workaround/fix
    │   ├── Found docs update? → Verify version compatibility
    │   └── No direct match? → Broaden search terms
    ├── Check package changelog for breaking changes
    ├── Review recent git diff for引入 changes
    └── Propose fix with source citation
```

### Stuck Rescue Flow

```
Stuck on problem for >15 min
    ├── Write down what has been tried (list all attempts)
    ├── Search for the underlying pattern, not exact error
    │   Example: Instead of "expo build failed 0x89"
    │   Search: "react-native code-signing entitlements mismatch"
    ├── Look for alternative approaches in docs
    ├── Check if a newer package version exists
    └── Present 2-3 alternative approaches with tradeoffs
```

### Debugging Flow

```
Bug reported by user
    ├── Reproduce: Ask what steps trigger it
    ├── Isolate: Narrow scope (component, hook, service)
    ├── Instrument: Add logging or use debugger
    ├── Search: Look for known issues with that pattern
    └── Fix: Implement minimal change + regression test
```

## Search Tools

### Primary: Exa MCP Server (Recommended)

The `exa` MCP server provides semantic web search — it understands intent and returns
high-quality, relevant results. This is the preferred search method.

**Search for documentation and solutions:**
```
Tool call: exa_search
Query: "<package-name> <error-message> expo react-native"
NumResults: 5
```

**Search for GitHub issues specifically:**
```
Tool call: exa_search
Query: "<error message>" site:github.com/expo/expo/issues
NumResults: 5
```

**Search Stack Overflow answers:**
```
Tool call: exa_search
Query: "<error message>" site:stackoverflow.com
NumResults: 5
```

**Find best practices and tutorials:**
```
Tool call: exa_search
Query: "expo router navigation best practices 2024"
NumResults: 5
```

### Fallback: execute_command (When MCP is unavailable)

If the Exa MCP server is not connected, use shell commands:

```bash
# Search GitHub issues API
curl -s "https://api.github.com/search/issues?q=<query>+repo:<owner>/<repo>" | python3 -c "import json,sys; data=json.load(sys.stdin); [print(f'{i}. {item[\"title\"]}\n   {item[\"html_url\"]}') for i,item in enumerate(data.get('items',[])[:5],1)]"

# Fetch specific documentation
curl -sL "https://docs.expo.dev/versions/v51.0.0/<path>" | head -200
```

### Fallback: read_file for Documentation

When a specific docs URL is found, fetch it:

```bash
curl -sL "https://docs.expo.dev/versions/v51.0.0/<path>" | head -500
```

## Query Templates

Copy these patterns and fill in the blanks:

```
# Expo SDK issues
"<error>" site:docs.expo.dev
"expo install <package>" sdk-51

# React Native issues
"react-native" "<error>" site:github.com/facebook/react-native/issues

# General troubleshooting
"<error message>" site:stackoverflow.com
"<package>" "<feature>" best practice 2024

# Migration issues
"expo sdk-50 to sdk-51" "<breaking change>"
```

## Exa-Specific Query Patterns

Exa excels at semantic search. Use these patterns for best results:

### Error Diagnosis Queries
```
"<error message>" expo react-native site:github.com
"metro bundler error" sdk-51 fix
"native module not found" android build
```

### Documentation Verification Queries
```
expo router navigation API docs 2024
react-native "useeffect" cleanup best practice
eas build configuration guide
```

### Solution Discovery Queries
```
"expo" "white screen" crash fix react-native
expo install incompatible packages solution
hermes compilation error windows
```

### Semantic Search (Exa's strength)
Instead of exact matches, describe the problem:
```
"React component re-rendering too frequently causing performance issues"
"Expo development build not detecting native module changes"
"TypeScript type inference broken after package upgrade"
```

## Best Practices

1. **Always include version numbers** — Expo SDK 51 APIs differ from SDK 50
2. **Cite your source** — Tell the user which tier the solution came from
3. **Verify before applying** — Don't blindly copy solutions; check compatibility
4. **Check package.json first** — Know what versions are installed before searching
5. **Prefer official docs over blog posts** — Blogs may be outdated
6. **Search GitHub issues before Stack Overflow** — Library bugs get fixed faster on GitHub
7. **Use Exa's semantic understanding** — Describe problems naturally rather than keyword-stuffing
8. **Limit results to 5** — More results waste context window tokens

## Quick Reference: Common Expo Search URLs

| Purpose | URL Pattern |
|---------|-------------|
| Expo docs | `https://docs.expo.dev/versions/v<major>.0.0/<path>` |
| Expo docs index | `https://docs.expo.dev/llms.txt` |
| React Native docs | `https://reactnative.dev/docs/<component>` |
| GitHub issues | `https://github.com/expo/expo/issues?q=<query>` |
| Stack Overflow | `https://stackoverflow.com/search?q=<encoded+query>` |
