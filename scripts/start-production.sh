#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3000}"
ARENA_BIND_HOST="${ARENA_BIND_HOST:-0.0.0.0}"
ARENA_BUILD_DIR="${NEXT_DIST_DIR:-.next}"

cd "$APP_DIR"

if [ ! -f "$ARENA_BUILD_DIR/BUILD_ID" ]; then
  echo "Production build not found. Running npm run build first."
  npm run build
fi

echo "Starting ARENA FC on http://${ARENA_BIND_HOST}:${PORT}"
exec npm run start -- --hostname "$ARENA_BIND_HOST" --port "$PORT"
