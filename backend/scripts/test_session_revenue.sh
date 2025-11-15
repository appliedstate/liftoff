#!/bin/bash
# Quick test script to pull session revenue data and inspect columns

echo "=== Session Revenue Data Inspector ==="
echo ""

# Default date (yesterday)
DATE=${1:-$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d)}

echo "Pulling data for date: $DATE"
echo ""

# Pull a small sample (10 rows) to inspect structure
curl -s "http://localhost:3001/api/system1/session-revenue?date=$DATE&filterZero=1&incremental=1&limit=10&output=csv" > /tmp/session_revenue_sample.csv

if [ ! -s /tmp/session_revenue_sample.csv ]; then
    echo "❌ Error: No data returned. Check:"
    echo "   1. Is the server running? (npm run dev)"
    echo "   2. Is the date valid? (tried: $DATE)"
    echo "   3. Check server logs for errors"
    exit 1
fi

echo "✅ Data retrieved successfully!"
echo ""
echo "=== CSV Header (Column Names) ==="
head -1 /tmp/session_revenue_sample.csv | tr ',' '\n' | nl
echo ""
echo "=== First 3 Data Rows ==="
head -4 /tmp/session_revenue_sample.csv
echo ""
echo "=== Row Count ==="
wc -l /tmp/session_revenue_sample.csv
echo ""
echo "=== Full file saved to: /tmp/session_revenue_sample.csv ==="
echo ""
echo "To view full file: cat /tmp/session_revenue_sample.csv"



