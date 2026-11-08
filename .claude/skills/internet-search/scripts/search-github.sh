#!/usr/bin/env bash
# Search GitHub issues for Expo/React Native problems
# Usage: search-github.sh "<query>" [repo] [limit]
# Example: search-github.sh "metro bundler failed to compile" expo/expo 5

set -euo pipefail

QUERY="${1:?Usage: search-github.sh '<query>' [repo] [limit]}"
REPO="${2:-expo/expo}"
LIMIT="${3:-5}"

# URL-encode the query
ENCODED_QUERY=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "$QUERY" 2>/dev/null || echo "$QUERY" | sed 's/ /%20/g')

echo "Searching GitHub issues for: $QUERY"
echo "Repository: $REPO"
echo "---"

curl -s "https://api.github.com/search/issues?q=${ENCODED_QUERY}+repo:${REPO}&per_page=${LIMIT}" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
items = data.get('items', [])
if not items:
    print('No results found.')
    sys.exit(0)
for i, item in enumerate(items, 1):
    title = item.get('title', 'N/A')
    url = item.get('html_url', 'N/A')
    state = item.get('state', 'N/A').upper()
    comments = item.get('comments', 0)
    created = item.get('created_at', 'N/A')[:10]
    print(f'{i}. [{state}] {title}')
    print(f'   {url}')
    print(f'   Comments: {comments} | Created: {created}')
    print()
" 2>/dev/null || echo "Failed to parse GitHub API response. Check your internet connection."
