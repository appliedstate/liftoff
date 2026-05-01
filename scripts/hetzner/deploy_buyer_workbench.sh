#!/usr/bin/env bash
set -euo pipefail

# Liftoff buyer workbench deploy script.
#
# Pulls main from GitHub, installs deps, builds, and reloads PM2.
# Run as the `deploy` user on the Hetzner server.
#
# Usage (on the server):
#   bash /opt/liftoff-git/scripts/hetzner/deploy_buyer_workbench.sh
#
# Or from your laptop:
#   ssh hetzner 'bash /opt/liftoff-git/scripts/hetzner/deploy_buyer_workbench.sh'

ROOT="/opt/liftoff-git"
BACKEND_DIR="${ROOT}/backend"
DASHBOARD_DIR="${ROOT}/apps/c1-dashboard"
BRANCH="${DEPLOY_BRANCH:-main}"

if [[ ! -d "${ROOT}/.git" ]]; then
  echo "Repository not found at ${ROOT}." >&2
  echo "Clone it first:" >&2
  echo "  sudo git clone git@github.com:appliedstate/liftoff.git ${ROOT}" >&2
  echo "  sudo chown -R deploy:deploy ${ROOT}" >&2
  exit 1
fi

cd "${ROOT}"
echo "==> Fetching ${BRANCH} from origin"
git fetch --prune origin "${BRANCH}"

# Refuse to deploy if working tree is dirty — we want git to be source of truth.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree at ${ROOT} is dirty. Refusing to deploy." >&2
  echo "Inspect with: cd ${ROOT} && git status" >&2
  exit 2
fi

echo "==> Resetting to origin/${BRANCH}"
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"

echo "==> Installing dashboard deps"
cd "${DASHBOARD_DIR}"
npm ci

echo "==> Building dashboard"
npm run build

echo "==> Installing backend deps"
cd "${BACKEND_DIR}"
# backend uses npm install (no committed lockfile guarantees) — keep in sync.
if [[ -f package-lock.json ]]; then
  npm ci || npm install
else
  npm install
fi

# If backend has a build step, run it; otherwise skip.
if npm run | grep -qE '^\s+build$'; then
  echo "==> Building backend"
  npm run build || true
fi

echo "==> Reloading PM2 dashboard process"
cd "${DASHBOARD_DIR}"
pm2 reload ecosystem.config.cjs --update-env

echo "==> Saving PM2 process list"
pm2 save

echo "==> Health check"
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3002/ben-launch || echo "000")
if [[ "${HTTP_CODE}" =~ ^(200|307|302)$ ]]; then
  echo "OK — http://127.0.0.1:3002/ben-launch returned ${HTTP_CODE}"
else
  echo "WARN — http://127.0.0.1:3002/ben-launch returned ${HTTP_CODE}" >&2
  exit 3
fi

echo "==> PM2 status"
pm2 ls
