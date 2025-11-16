#!/usr/bin/env bash

set -euo pipefail

echo "=== Liftoff deploy starting ==="

REPO_DIR="/opt/liftoff"

echo "-> cd ${REPO_DIR}"
cd "${REPO_DIR}"

echo "-> git pull origin main"
git pull origin main

echo "-> npm install (backend)"
cd backend
npm install --production=false

echo "-> npm run build (backend)"
npm run build

echo "-> pm2 reload ecosystem.config.js"
pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js

echo "=== Liftoff deploy complete ==="


