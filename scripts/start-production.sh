#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3000}"
HOSTNAME="${HOSTNAME:-0.0.0.0}"

cd "$APP_DIR"

if [ ! -d ".next" ]; then
  echo "Production build not found. Running npm run build first."
  npm run build
fi

echo "Starting ARENA FC on http://${HOSTNAME}:${PORT}"
PORT="$PORT" HOSTNAME="$HOSTNAME" npm run start
