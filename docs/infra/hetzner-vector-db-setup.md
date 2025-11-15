# Moving Vector DB to Hetzner Server

This guide helps you move your SERP keyword+slug vector database from your local machine to a Hetzner server.

## Server Requirements

**Minimum (may be tight):**
- **CPX31**: 8 vCPU, 16GB RAM, 240GB SSD (~€20/month)

**Recommended:**
- **CPX41**: 8 vCPU, 32GB RAM, 360GB SSD (~€40/month)
- **CCX33**: 8 vCPU, 32GB RAM, 240GB SSD (dedicated, ~€50/month)

**Why these specs:**
- **CPU**: 8+ cores for parallel embedding API calls
- **RAM**: 32GB+ for Postgres + vector indexes + working memory
- **Disk**: 500GB+ NVMe SSD (embeddings are ~2-3GB per million rows × 2 embeddings)

## Step 1: Create Hetzner Server

1. Go to Hetzner Cloud Console
2. Create new server:
   - **Image**: Ubuntu 22.04 or 24.04
   - **Type**: CPX41 (recommended) or CCX33
   - **Location**: Choose closest to you
   - **SSH Keys**: Add your public key
3. Note the server IP address

## Step 2: Bootstrap Server

SSH into the server as `root`:

```bash
ssh root@your.server.ip
```

Run the bootstrap script (installs Node.js, PM2, etc.):

```bash
# If you have the repo cloned locally, upload bootstrap_server.sh first
# Or download it directly:
curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/YOUR_REPO/main/scripts/hetzner/bootstrap_server.sh -o /tmp/bootstrap.sh
bash /tmp/bootstrap.sh
```

Reconnect as `liftoff` user:

```bash
ssh liftoff@your.server.ip
```

## Step 3: Install Postgres + pgvector

On the server as `liftoff` (or root):

```bash
# Upload the setup script or download it
sudo bash /opt/liftoff/scripts/hetzner/setup_postgres_vector.sh
```

This will:
- Install Postgres 16
- Install pgvector extension
- Create `liftoff` database
- Create `liftoff_user` (you'll need to set a secure password)

**Set a secure password:**

```bash
sudo -u postgres psql -c "ALTER USER liftoff_user WITH PASSWORD 'your_secure_password_here';"
```

## Step 4: Clone Repo and Configure

As `liftoff` user:

```bash
cd /opt
git clone git@github.com:YOUR_ORG/YOUR_REPO.git liftoff
cd liftoff/backend
cp ENV_TEMPLATE .env
```

Edit `.env` and set:

```env
PGVECTOR_URL=postgres://liftoff_user:your_secure_password_here@localhost:5432/liftoff
OPENAI_API_KEY=your_openai_key_here
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_VERSION=v1
EMBEDDING_BATCH_SIZE=128
EMBEDDING_CONCURRENCY=4
```

## Step 5: Create Tables

```bash
cd /opt/liftoff/backend
npm install
npm run vector:setup-serp
```

## Step 6: Transfer CSV Files

You have two options:

### Option A: Upload CSVs to Server

```bash
# From your local machine
cd "/Users/ericroach/Desktop/serp_csvs_2025-10-29_to_2025-11-11"
scp -r *.csv liftoff@your.server.ip:/tmp/serp_csvs/
```

### Option B: Re-download from Source

If you have the CSVs in cloud storage, download them directly on the server.

## Step 7: Run Embedding Job

On the server:

```bash
cd /opt/liftoff/backend
npm run vector:embed-serp -- --runDate=2025-11-11 --dir="/tmp/serp_csvs"
```

Monitor progress:

```bash
# In another terminal
watch -n 30 'psql $PGVECTOR_URL -c "SELECT count(*) FROM serp_keyword_slug_embeddings WHERE run_date='\''2025-11-11'\'';"'
```

## Step 8: Verify Data

```bash
psql $PGVECTOR_URL -c "
SELECT 
  count(*) AS total_rows,
  count(DISTINCT serp_keyword) AS unique_keywords,
  count(DISTINCT content_slug) AS unique_slugs,
  count(DISTINCT region_code) AS unique_regions,
  SUM(est_net_revenue) AS total_revenue
FROM serp_keyword_slug_embeddings
WHERE run_date = '2025-11-11';
"
```

## Optional: Transfer Existing Data

If you want to transfer the ~1.96M rows you already embedded locally:

### On Local Machine:

```bash
# Export data (excluding embeddings to save space, re-embed on server)
pg_dump -h localhost -U postgres -d liftoff \
  --table=serp_keyword_slug_embeddings \
  --data-only \
  --column-inserts \
  > /tmp/serp_data.sql

# Or use pg_dump binary format (faster, smaller)
pg_dump -h localhost -U postgres -d liftoff \
  --table=serp_keyword_slug_embeddings \
  --format=custom \
  --file=/tmp/serp_data.dump
```

### On Server:

```bash
# Upload the dump
scp /tmp/serp_data.dump liftoff@your.server.ip:/tmp/

# On server, restore (without embeddings, will re-embed)
pg_restore -d liftoff -t serp_keyword_slug_embeddings /tmp/serp_data.dump

# Then re-run embedding job (it will skip existing rows by hash_key)
npm run vector:embed-serp -- --runDate=2025-11-11 --dir="/tmp/serp_csvs"
```

## Performance Tips

1. **Increase Postgres shared_buffers** if you have 32GB+ RAM:
   ```bash
   sudo nano /etc/postgresql/16/main/postgresql.conf
   # Set: shared_buffers = 8GB
   # Set: effective_cache_size = 24GB
   sudo systemctl restart postgresql
   ```

2. **Monitor disk space:**
   ```bash
   df -h
   du -sh /var/lib/postgresql/16/main
   ```

3. **Check Postgres activity:**
   ```bash
   psql $PGVECTOR_URL -c "SELECT pid, state, query FROM pg_stat_activity WHERE state <> 'idle';"
   ```

## Troubleshooting

- **Out of disk space**: Upgrade server or add volume
- **Slow embeddings**: Increase `EMBEDDING_CONCURRENCY` (but watch API rate limits)
- **Connection errors**: Check Postgres is running: `sudo systemctl status postgresql`
- **Permission errors**: Ensure `liftoff_user` has proper grants

