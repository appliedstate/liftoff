#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_DIR="$ROOT/server/meta-policy-api"
REMOTE_HOST="${REMOTE_HOST:-maverick}"
REMOTE_DIR="${REMOTE_DIR:-/srv/meta-policy-api}"

ssh "$REMOTE_HOST" "bash -lc 'mkdir -p ${REMOTE_DIR} && chown -R deploy:deploy ${REMOTE_DIR}'"

rsync -avz --delete \
  --exclude node_modules \
  --exclude .env \
  "$SERVICE_DIR/" "${REMOTE_HOST}:${REMOTE_DIR}/"

ssh "$REMOTE_HOST" "bash -lc '
  chown -R deploy:deploy ${REMOTE_DIR}
  su - deploy -c \"cd ${REMOTE_DIR} && npm install --omit=dev && pm2 startOrReload ecosystem.config.cjs && pm2 save\"
'"
