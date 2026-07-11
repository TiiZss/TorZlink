#!/usr/bin/env bash
# Copy versioned Cursor rules into .cursor/rules/ (gitignored locally).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/docs/cursor-rules"
DEST="$ROOT/.cursor/rules"

mkdir -p "$DEST"
for f in workflow-session-orchestration.mdc workflow-release-pipeline.mdc; do
  cp "$SRC/$f" "$DEST/$f"
  echo "installed $f"
done

echo "Done. Restart Cursor or reload rules if needed."
