#!/bin/bash

# Test the slug connections API endpoint
# Usage: ./test_slug_connections_api.sh [discovery_run] [csv_path]

DISCOVERY_RUN=${1:-"2025-10-21_3pages"}
CSV_PATH=${2:-"runs/system1/2025-11-07/top_rps_keywords_by_slug_no_leadgen.csv"}

echo "Testing Slug Connections API"
echo "Discovery Run: $DISCOVERY_RUN"
echo "CSV Path: $CSV_PATH"
echo ""

# Create JSON payload
PAYLOAD=$(cat <<EOF
{
  "discoveryRun": "$DISCOVERY_RUN",
  "mappingsCsv": "$CSV_PATH",
  "active_status": "active",
  "platforms": "facebook,instagram"
}
EOF
)

echo "Making API request..."
echo ""

curl -X POST http://localhost:3001/api/meta-ad-library/pages/analyze \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  | jq '.' 2>/dev/null || curl -X POST http://localhost:3001/api/meta-ad-library/pages/analyze \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
