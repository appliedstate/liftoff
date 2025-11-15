#!/usr/bin/env bash
set -euo pipefail

# Setup Postgres 16 + pgvector on Hetzner Ubuntu
# Run as root or with sudo
#
# Usage:
#   sudo bash setup_postgres_vector.sh

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Please run as root (sudo bash setup_postgres_vector.sh)."
  exit 1
fi

echo "Installing Postgres 16 + pgvector..."

export DEBIAN_FRONTEND=noninteractive

# Add Postgres APT repo
apt-get update -y
apt-get install -y wget ca-certificates
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list

# Install Postgres 16
apt-get update -y
apt-get install -y postgresql-16 postgresql-contrib-16

# Install pgvector extension
apt-get install -y postgresql-16-pgvector

# Configure Postgres
PG_VERSION="16"
PG_DATA="/var/lib/postgresql/${PG_VERSION}/main"
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

# Tune Postgres for vector workloads (adjust based on RAM)
TOTAL_RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
SHARED_BUFFERS=$((TOTAL_RAM_GB / 4))
EFFECTIVE_CACHE_SIZE=$((TOTAL_RAM_GB * 3 / 4))

echo "Configuring Postgres (RAM: ${TOTAL_RAM_GB}GB, shared_buffers: ${SHARED_BUFFERS}GB, effective_cache_size: ${EFFECTIVE_CACHE_SIZE}GB)..."

# Basic performance tuning
sed -i "s/#shared_buffers = 128MB/shared_buffers = ${SHARED_BUFFERS}GB/" "$PG_CONF" || \
  echo "shared_buffers = ${SHARED_BUFFERS}GB" >> "$PG_CONF"

sed -i "s/#effective_cache_size = 4GB/effective_cache_size = ${EFFECTIVE_CACHE_SIZE}GB/" "$PG_CONF" || \
  echo "effective_cache_size = ${EFFECTIVE_CACHE_SIZE}GB" >> "$PG_CONF"

# Enable pgvector
sed -i "s/#shared_preload_libraries = ''/shared_preload_libraries = 'vector'/" "$PG_CONF" || \
  echo "shared_preload_libraries = 'vector'" >> "$PG_CONF"

# Restart Postgres
systemctl restart postgresql

# Create database and enable extension
sudo -u postgres psql <<EOF
-- Create database
CREATE DATABASE liftoff;

-- Create user (adjust password as needed)
CREATE USER liftoff_user WITH PASSWORD 'CHANGE_ME_IN_PROD';
ALTER USER liftoff_user CREATEDB;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE liftoff TO liftoff_user;

-- Connect and enable extensions
\c liftoff
CREATE EXTENSION IF NOT EXISTS vector;
EOF

echo ""
echo "Postgres + pgvector setup complete!"
echo ""
echo "Connection string (update password in backend/.env):"
echo "  PGVECTOR_URL=postgres://liftoff_user:CHANGE_ME_IN_PROD@localhost:5432/liftoff"
echo ""
echo "Next steps:"
echo "1) Update password: sudo -u postgres psql -c \"ALTER USER liftoff_user WITH PASSWORD 'your_secure_password';\""
echo "2) Update backend/.env with the connection string"
echo "3) Run: cd /opt/liftoff/backend && npm run vector:setup-serp"

