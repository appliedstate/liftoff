# Session Revenue Data Setup Guide

## Quick Start (Fresh Terminal)

### Step 1: Navigate to Backend Directory
```bash
cd backend
```

### Step 2: Start the Backend Server
```bash
npm run dev
```

The server will start on `http://localhost:3001`

### Step 3: Pull Sample Data (in a new terminal)

Open a new terminal window and run:

```bash
# Pull data for a specific date (use a recent date)
curl "http://localhost:3001/api/system1/session-revenue?date=2025-11-07&filterZero=1&incremental=1&limit=10&output=csv" > sample_data.csv

# View the CSV to see columns
head -5 sample_data.csv
```

Or use a browser:
```
http://localhost:3001/api/system1/session-revenue?date=2025-11-07&filterZero=1&incremental=1&limit=10&output=csv
```

### Step 4: Inspect the Data Structure

```bash
# View first few lines
head -3 sample_data.csv

# Count columns
head -1 sample_data.csv | tr ',' '\n' | nl

# View full structure
cat sample_data.csv | head -20
```

## Optional: PostgreSQL Setup (for Database Storage)

### Prerequisites
- Docker installed (for local PostgreSQL)

### Step 1: Start PostgreSQL with pgvector
```bash
cd backend
docker compose -f docker-compose.pgvector.yml up -d
```

### Step 2: Set Environment Variable
Create or update `backend/.env`:
```bash
PGVECTOR_URL=postgres://postgres:postgres@localhost:5432/liftoff
```

### Step 3: Run Database Setup
```bash
npm run session-revenue:setup
```

### Step 4: Pull Data (will auto-store in DB)
```bash
curl "http://localhost:3001/api/system1/session-revenue?date=2025-11-07&filterZero=1&incremental=1&output=csv"
```

Check the response - it will show `db_rows_inserted` if stored successfully.

### Step 5: Query from Database
```bash
# Query all data for a date
curl "http://localhost:3001/api/system1/session-revenue/db?date=2025-11-07" | jq .

# Daily aggregation
curl "http://localhost:3001/api/system1/session-revenue/db?start_date=2025-11-01&end_date=2025-11-07&aggregate=daily" | jq .
```

## Troubleshooting

### Server won't start
- Make sure you're in the `backend` directory
- Run `npm install` if you haven't already
- Check if port 3001 is already in use

### Database connection fails
- Make sure Docker container is running: `docker ps`
- Check PGVECTOR_URL is set correctly
- Try: `docker compose -f docker-compose.pgvector.yml logs`

### No data returned
- Check the date format (YYYY-MM-DD)
- Try a different date that exists in the source system
- Check server logs for errors



