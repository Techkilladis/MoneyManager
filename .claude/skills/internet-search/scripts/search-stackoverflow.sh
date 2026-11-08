#!/usr/bin/env bash
# Search Stack Overflow for programming questions
# Usage: search-stackoverflow.sh "<query>" [limit]
# Example: search-stackoverflow.sh "expo metro bundler error" 5

set -euo pipefail

QUERY="${1:?Usage: search-stackoverflow.sh '<query>' [limit]}"
LIMIT="${2:-5}"

# URL-encode the query
ENCODED_QUERY=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "$QUERY" 2>/dev/null || echo "$QUERY" | sed 's/ /%20/g')

echo "Searching Stack Overflow for: $QUERY"
echo "---"

# Stack Overflow search URL format
SO_URL="https://stackoverflow.com/search?q=${ENCODED_QUERY}&pagesize=${LIMIT}"

curl -s "$SO_URL" \
  | python3 -c "
import sys, re
html = sys.stdin.read()
# Extract question titles and links from SO search results
pattern = r'<a[^>]*class=[\"'][^\"']*(?:question-hyperlink|Link)[^\"']*?[\"'][^>]*href=[\"']([^\"']+)[\"'][^>]*>([^<]+)</a>'
matches = re.findall(pattern, html)
if not matches:
    # Try alternate pattern
    pattern2 = r'<h3[^>]*><a[^>]*href=[\"']([^\"']+)[\"'][^>]*>([^<]+)</a></h3>'
    matches = re.findall(pattern2, html)

seen = set()
for i, (url, title) in enumerate(matches[:${LIMIT}], 1):
    full_url = url if url.startswith('http') else 'https://stackoverflow.com' + url
    if full_url not in seen:
        print(f'{i}. {title.strip()}')
        print(f'   {full_url}')
        print()
        seen.add(full_url)

if not seen:
    print('No results found.')
    print(f'Try visiting: https://stackoverflow.com/search?q=${ENCODED_QUERY}')
" 2>/dev/null || echo "Failed to parse Stack Overflow response. Try: https://stackoverflow.com/search?q=$QUERY"
