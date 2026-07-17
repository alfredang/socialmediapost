#!/bin/bash
# PostToolUse hook: auto-fix lint on any edited TS/TSX file (fast, per-file).
input=$(cat)
file_path=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)

case "$file_path" in
  */src/*.ts|*/src/*.tsx)
    cd "$(dirname "$0")/../.." || exit 0
    npx eslint --fix "$file_path" >/dev/null 2>&1
    ;;
esac
exit 0
