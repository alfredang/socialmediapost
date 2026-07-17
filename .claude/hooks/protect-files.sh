#!/bin/bash
# PreToolUse hook: blocks accidental edits to protected files
# (.env secrets, applied Prisma migrations, the SQLite db, third-party skills).
input=$(cat)
file_path=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)

case "$file_path" in
  *"/prisma/migrations/"*|*"/prisma/dev.db"|*".env"|*".env.local")
    echo "Blocked: $file_path is protected (applied migrations, database file, or env secrets). Create a new migration or edit .env manually." >&2
    exit 2
    ;;
  *"/.claude/skills/"*)
    echo "Blocked: $file_path is an installed third-party skill; do not modify it. Customizations belong in design-system/ or CLAUDE.md." >&2
    exit 2
    ;;
esac
exit 0
