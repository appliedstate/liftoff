### Liftoff — Hetzner Deployment (Step-by-step)

This guide walks you through moving the full repo to a Hetzner Ubuntu server, syncing with GitHub, and running the backend via PM2 behind Nginx or Caddy with HTTPS.

You will:
- Create a non-root user, lock down SSH, enable firewall
- Install dependencies (git, Node.js, PM2, Nginx or Caddy, optional Docker)
- Add a GitHub deploy key (read-only or read/write)
- Clone this repo onto the server
- Configure environment variables
- Start the backend with PM2 and set up startup on boot
- Configure a reverse proxy with HTTPS

Prereqs:
- Hetzner Cloud Ubuntu 22.04/24.04 instance with a public IP
- A domain or subdomain pointed to the server’s IP (A record)
- Your local SSH access to the server as `root` or an initial user provided by Hetzner

---

### 0) One-time bootstrap (recommended)

SSH into the server as `root` (or your initial user) and run:

```bash
curl -fsSL https://raw.githubusercontent.com/PLACEHOLDER_ORG/PLACEHOLDER_REPO/main/scripts/hetzner/bootstrap_server.sh -o /tmp/bootstrap_server.sh
sudo bash /tmp/bootstrap_server.sh
```

What it does:
- Creates user `liftoff` with sudo
- Installs git, Node.js (NodeSource 20.x), PM2, Nginx, UFW
- Optionally installs Docker + Compose plugin (commented; enable if needed)
- Enables firewall (22/tcp, 80/tcp, 443/tcp)
- Sets PM2 to start on boot for user `liftoff`

Now reconnect as the `liftoff` user:

```bash
ssh liftoff@your.server.ip
```

---

### 1) Configure GitHub deploy key (pull from private repo)

On the server as `liftoff`:

```bash
bash /opt/liftoff/scripts/hetzner/setup_github_deploy_key.sh
```

This generates `~/.ssh/id_ed25519_github` and prints the public key. Copy the printed key and add it in GitHub:
- Repository → Settings → Deploy keys → Add deploy key
- Title: “hetzner-liftoff”
- Key: paste the printed public key
- Permissions: Read-only is sufficient (enable write if you want to push from server)

Test GitHub SSH:

```bash
ssh -T git@github.com
```

You should see a success message like “Hi <user>! You’ve successfully authenticated…”

---

### 2) Clone the repository to the server

Choose a location (default in scripts is `/opt/liftoff`). Create the parent dir first:

```bash
sudo mkdir -p /opt
sudo chown -R liftoff:liftoff /opt
cd /opt
git clone git@github.com:PLACEHOLDER_ORG/PLACEHOLDER_REPO.git liftoff
cd liftoff
```

Tip: Replace `PLACEHOLDER_ORG/PLACEHOLDER_REPO` with your real GitHub org/repo path.

---

### 3) Environment variables

Copy templates and fill in secrets:

```bash
cd /opt/liftoff/backend
cp ENV_TEMPLATE .env
```

Open `.env` and set values:
- `PORT=3001` (or your desired port)
- `SEARCHAPI_API_KEY=<your key>`
- Optional: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PGVECTOR_URL`, and any other service keys used by scripts

If you plan to run local Postgres+pgvector on this box:

```bash
cd /opt/liftoff/backend
docker compose -f docker-compose.pgvector.yml up -d
# Run migration/setup scripts as needed when ready
```

---

### 4) First backend deploy (PM2)

Use the helper deploy script:

```bash
cd /opt/liftoff
bash scripts/hetzner/deploy_backend.sh
```

What it does (idempotent):
- Pulls latest `origin/main`
- Installs backend dependencies
- Builds TypeScript (`npm run build`)
- Starts/Reloads PM2 with `backend/ecosystem.config.js`
- Saves PM2 process list and ensures it starts on reboot

Check status:

```bash
pm2 ls
pm2 logs strategist-backend --lines 100
curl -s http://127.0.0.1:3001/api/health
```

---

### 5) Reverse proxy with HTTPS (choose one)

Option A — Nginx + Certbot
1. Copy the template into place and edit your domain:
   ```bash
   sudo cp /opt/liftoff/scripts/hetzner/nginx_liftoff.conf /etc/nginx/sites-available/liftoff.conf
   sudo nano /etc/nginx/sites-available/liftoff.conf
   ```
   Change `server_name` and any paths if needed.
2. Enable and test:
   ```bash
   sudo ln -s /etc/nginx/sites-available/liftoff.conf /etc/nginx/sites-enabled/liftoff.conf
   sudo nginx -t
   sudo systemctl reload nginx
   ```
3. Issue SSL cert:
   ```bash
   sudo apt-get update
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your.domain.com --non-interactive --agree-tos -m you@yourdomain.com
   ```

Option B — Caddy (simpler automatic HTTPS)
1. Install Caddy:
   ```bash
   sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt-get update && sudo apt-get install -y caddy
   ```
2. Copy the template and edit domain:
   ```bash
   sudo cp /opt/liftoff/scripts/hetzner/Caddyfile /etc/caddy/Caddyfile
   sudo nano /etc/caddy/Caddyfile
   ```
3. Reload:
   ```bash
   sudo systemctl reload caddy
   ```

After either option, hit:
`https://your.domain.com/api/health`

---

### 6) Update workflow

To pull and redeploy:
```bash
cd /opt/liftoff
bash scripts/hetzner/deploy_backend.sh
```

This will:
- `git fetch` and reset to `origin/main` (safe, stateless)
- Reinstall backend deps if `package-lock.json` changed
- Rebuild and restart PM2 (zero-downtime)

---

### 7) Troubleshooting

- PM2 app not starting?
  - `pm2 logs strategist-backend --lines 200`
  - Check `.env` in `/opt/liftoff/backend`
  - Ensure port `3001` is free or adjust `PORT` and proxy

- HTTPS not issuing?
  - DNS must point to this server IP (A record)
  - Port 80 and 443 must be open in UFW and Hetzner firewall (if used)

- Git pull failing?
  - Confirm deploy key is added with correct permissions
  - `ssh -T git@github.com` from server should succeed

---

### 8) Optional: System hardening checklist
- Disable root SSH login once the `liftoff` user works
- Fail2ban (basic SSH jail)
- Keep OS updated: `sudo unattended-upgrades`
- Monitor with Uptime Kuma, Healthchecks, or similar

---

If you share your domain and OS version, you can run these as-is; I can also pre-fill the placeholders and give you exact commands to paste.


