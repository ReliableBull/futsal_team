#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_MAJOR="${NODE_MAJOR:-20}"
PORT="${PORT:-3000}"

cd "$APP_DIR"

echo "== ARENA FC setup for Raspberry Pi / Jetson Nano =="
echo "App directory: $APP_DIR"

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script expects a Debian/Ubuntu based OS with apt-get."
  exit 1
fi

echo "== Installing system packages =="
sudo apt-get update
sudo apt-get install -y ca-certificates curl git build-essential openssl

if ! command -v node >/dev/null 2>&1 || ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= ${NODE_MAJOR} ? 0 : 1)"; then
  echo "== Installing Node.js ${NODE_MAJOR}.x =="
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "== Node.js is already installed: $(node --version) =="
fi

echo "== Runtime versions =="
node --version
npm --version

if [ ! -f .env ]; then
  echo "== Creating .env from .env.example =="
  cp .env.example .env
  AUTH_SECRET_VALUE="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  sed -i "s|AUTH_SECRET=\"change-this-local-secret\"|AUTH_SECRET=\"${AUTH_SECRET_VALUE}\"|g" .env
else
  echo "== Existing .env found. Keeping it unchanged. =="
fi

echo "== Installing npm dependencies =="
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "== Applying database migrations =="
npx prisma migrate deploy

if [ "${SEED_DB:-0}" = "1" ]; then
  echo "== Seeding database =="
  npm run seed
else
  echo "== Skipping seed. Set SEED_DB=1 to seed initial data. =="
fi

echo "== Building production app =="
npm run build

echo
echo "Setup complete."
echo "Start manually with:"
echo "  PORT=${PORT} HOSTNAME=0.0.0.0 npm run start"
echo
echo "Open from another device on the same network:"
echo "  http://<board-ip>:${PORT}"
