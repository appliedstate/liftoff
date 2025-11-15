#!/usr/bin/env bash
set -euo pipefail

# Liftoff Hetzner Bootstrap Script
# - Creates 'liftoff' user with sudo
# - Installs git, curl, Node.js 20.x, pm2, nginx, ufw
# - Opens firewall for SSH/HTTP/HTTPS
# - (Optional) Installs Docker + Compose plugin (commented)
# - Configures PM2 startup on boot for 'liftoff'
#
# Usage (as root):
#   bash bootstrap_server.sh

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Please run as root (sudo bash bootstrap_server.sh)."
  exit 1
fi

USER_NAME="liftoff"
USER_HOME="/home/${USER_NAME}"

echo "Creating user '${USER_NAME}' if not exists..."
if ! id -u "${USER_NAME}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${USER_NAME}"
  usermod -aG sudo "${USER_NAME}"
fi

echo "Updating apt and installing base packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y git curl ca-certificates gnupg ufw nginx

echo "Installing Node.js 20.x (NodeSource)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
corepack enable || true
npm install -g pm2

# Optional: Docker + Compose plugin (uncomment if you need it)
# echo "Installing Docker + Docker Compose plugin..."
# apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
# install -m 0755 -d /etc/apt/keyrings
# curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
# chmod a+r /etc/apt/keyrings/docker.gpg
# echo \
#   "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
#   $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
#   tee /etc/apt/sources.list.d/docker.list > /dev/null
# apt-get update -y
# apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
# usermod -aG docker "${USER_NAME}"

echo "Configuring UFW firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable || true
ufw status

echo "Preparing /opt directory for app..."
mkdir -p /opt
chown -R "${USER_NAME}:${USER_NAME}" /opt

echo "Configuring PM2 startup for '${USER_NAME}'..."
sudo -u "${USER_NAME}" -H bash -lc "pm2 startup systemd -u ${USER_NAME} --hp ${USER_HOME}" || true

echo "Bootstrap complete."
echo "Next steps:"
echo "1) SSH as '${USER_NAME}': ssh ${USER_NAME}@your.server.ip"
echo "2) Clone repo to /opt/liftoff and run deploy scripts per docs/infra/hetzner-deploy.md"


