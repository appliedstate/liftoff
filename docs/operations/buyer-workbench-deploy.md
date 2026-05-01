# Buyer Workbench Deploy (Hetzner)

How to ship code changes to `https://api.str4t3g1s.com` (the buyer workbench /
ben-launch dashboard).

## Architecture

- **Server:** Hetzner VM `maverick-ash-1` (`178.156.134.243`)
- **Source of truth:** `/opt/liftoff-git/` — a `git clone` of `appliedstate/liftoff` `main`
- **Process manager:** PM2 process `liftoff-buyer-dashboard` (port 3002)
- **Reverse proxy:** Caddy → 127.0.0.1:3002, fronted by Cloudflare
- **PM2 cwd:** `/opt/liftoff-git/apps/c1-dashboard`

## Day-to-day deploy flow

1. Make changes locally on a branch, commit, push to GitHub.
2. Merge to `main` (PR or fast-forward).
3. From your laptop:
   ```bash
   ssh hetzner 'bash /opt/liftoff-git/scripts/hetzner/deploy_buyer_workbench.sh'
   ```
   The script: pulls `origin/main`, refuses if working tree is dirty, runs
   `npm ci` + `npm run build` for the dashboard, optionally builds backend,
   `pm2 reload`s the dashboard, runs a health check, and prints PM2 status.
4. Verify the change at `https://api.str4t3g1s.com/...`.

If the deploy script reports a non-2xx/3xx HTTP code, the previous build
in `.next/` keeps serving traffic until the next reload, so you have a
window to roll back (`git reset --hard <prev-sha>` and re-run the script).

## Hot fixes (when you must edit on the server)

Don't. If you absolutely must:
1. Make the edit in `/opt/liftoff-git/...`.
2. Immediately commit it on the server, push to GitHub, and merge to `main`.
3. Re-run the deploy script so the working tree is clean.

The deploy script refuses to run with a dirty tree, which is the guardrail
against drift between server and GitHub.

## Migration history

- **Pre-2026-05-01:** Production code lived at `/opt/liftoff/` (not a git repo).
  Edits arrived via direct rsync/SSH-as-root from local Macs. Caused
  significant drift between local repos, GitHub, and the live server.
- **2026-05-01:** Cloned `main` to `/opt/liftoff-git/`, repointed PM2,
  introduced this script. The old `/opt/liftoff/` directory is kept as a
  read-only fallback for ~1 week.
- **Planned (~2026-05-08):** Delete `/opt/liftoff/` and rename
  `/opt/liftoff-git/` → `/opt/liftoff/`. PM2 cwd needs to be updated:
  ```bash
  pm2 stop liftoff-buyer-dashboard
  pm2 delete liftoff-buyer-dashboard
  sudo rm -rf /opt/liftoff
  sudo mv /opt/liftoff-git /opt/liftoff
  cd /opt/liftoff/apps/c1-dashboard
  pm2 start ecosystem.config.cjs
  pm2 save
  ```
  Also update `ROOT` in `scripts/hetzner/deploy_buyer_workbench.sh` from
  `/opt/liftoff-git` back to `/opt/liftoff`, commit, push.

## Useful commands

```bash
# Tail logs
ssh hetzner 'pm2 logs liftoff-buyer-dashboard'

# Inspect process
ssh hetzner 'pm2 describe liftoff-buyer-dashboard'

# Manual rollback to previous main
ssh hetzner 'cd /opt/liftoff-git && git log --oneline -5'
ssh hetzner 'cd /opt/liftoff-git && git reset --hard <sha> && bash scripts/hetzner/deploy_buyer_workbench.sh'
```

## Secrets

- `apps/c1-dashboard/.env.local` and `backend/.env` are gitignored. They
  live on the server only. When provisioning a new server or path, copy
  these from a trusted backup before running the build.
