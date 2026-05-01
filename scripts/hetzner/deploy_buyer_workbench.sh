#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/liftoff"
BACKEND_DIR="${ROOT}/backend"
DASHBOARD_DIR="${ROOT}/apps/c1-dashboard"

if [[ ! -d "${ROOT}/.git" ]]; then
  echo "Repository not found at ${ROOT}. Clone it first:"
  echo "  git clone git@github.com:appliedstate/liftoff.git ${ROOT}"
  exit 1
fi

cd "${ROOT}"
echo "Fetching latest changes..."
git fetch --all --prune
git reset --hard origin/main

echo "Deploying backend..."
cd "${BACKEND_DIR}"
npm ci
npm run build
pm2 startOrReload ecosystem.config.js

echo "Deploying buyer dashboard..."
cd "${DASHBOARD_DIR}"
npm ci
npm run build
pm2 startOrReload ecosystem.config.cjs

echo "Saving PM2 process list..."
pm2 save
pm2 ls

