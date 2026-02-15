#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../web"

if [ ! -d "node_modules" ]; then
  echo "node_modules not found — installing dependencies..."
  npm install
fi

echo "Starting dev server (web)..."
npm run dev
