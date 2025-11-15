#!/usr/bin/env bash
set -euo pipefail

# Idempotent backend deploy script
# - Pulls latest main
# - Installs deps if needed, builds TS
# - Starts/reloads PM2 using backend/ecosystem.config.js
#
# Usage:
#   bash scripts/hetzner/deploy_backend.sh
#
# Assumes repo is at /opt/liftoff (change ROOT if different)

ROOT="/opt/liftoff"
BACKEND_DIR="${ROOT}/backend"

if [[ ! -d "${ROOT}/.git" ]]; then
  echo "Repository not found at ${ROOT}. Clone it first:"
  echo "  git clone git@github.com:PLACEHOLDER_ORG/PLACEHOLDER_REPO.git ${ROOT}"
  exit 1
fi

cd "${ROOT}"
echo "Fetching latest changes..."
git fetch --all --prune
git reset --hard origin/main

echo "Deploying backend..."
cd "${BACKEND_DIR}"

if [[ ! -f "package-lock.json" ]]; then
  echo "package-lock.json missing; ensure you're in the correct directory."
  exit 1
fi

echo "Installing dependencies (npm ci)..."
npm ci

echo "Building TypeScript (npm run build)..."
npm run build

echo "Starting/updating PM2 processes..."
pm2 startOrReload ecosystem.config.js
pm2 save

echo "Deployment complete."
pm2 ls


