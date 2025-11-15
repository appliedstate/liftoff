#!/usr/bin/env bash
set -euo pipefail

# Setup GitHub Deploy Key for this server (per-repo)
# - Generates ~/.ssh/id_ed25519_github (no passphrase)
# - Configures SSH to use this key for github.com
# - Prints the public key to add in GitHub → Repo → Settings → Deploy keys
#
# Usage (as non-root user e.g., liftoff):
#   bash scripts/hetzner/setup_github_deploy_key.sh

KEY_PATH="${HOME}/.ssh/id_ed25519_github"
SSH_CONFIG="${HOME}/.ssh/config"

mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"

if [[ -f "${KEY_PATH}" ]]; then
  echo "Key already exists at ${KEY_PATH}"
else
  echo "Generating SSH key at ${KEY_PATH}..."
  ssh-keygen -t ed25519 -C "hetzner-liftoff" -f "${KEY_PATH}" -N ""
fi

if ! grep -q "Host github.com" "${SSH_CONFIG}" 2>/dev/null; then
  cat >> "${SSH_CONFIG}" <<EOF
Host github.com
  HostName github.com
  User git
  IdentityFile ${KEY_PATH}
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF
  chmod 600 "${SSH_CONFIG}"
fi

echo
echo "Public key to add as a Deploy Key (GitHub → Repo → Settings → Deploy keys):"
echo "--------------------------------------------------------------------------"
cat "${KEY_PATH}.pub"
echo "--------------------------------------------------------------------------"
echo
echo "After adding the key, test with:"
echo "  ssh -T git@github.com"
echo
echo "Then clone the repo, for example:"
echo "  git clone git@github.com:PLACEHOLDER_ORG/PLACEHOLDER_REPO.git /opt/liftoff"


