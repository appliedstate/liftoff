# Quick Start - Slug Connections API

## Navigate to Backend Directory

The project is located in a nested Desktop folder. Use this exact path:

```bash
cd "/Users/ericroach/Desktop/Desktop - Eric's MacBook Air/Liftoff/backend"
```

## Start the Server

```bash
npm run dev
```

The server will start on `http://localhost:3001`

## Test the Slug Connections API

In another terminal, run:

```bash
cd "/Users/ericroach/Desktop/Desktop - Eric's MacBook Air/Liftoff/backend"

curl -X POST http://localhost:3001/api/meta-ad-library/pages/analyze \
  -H "Content-Type: application/json" \
  -d @test_api_example.json | jq '.'
```

Or use the test script:

```bash
cd "/Users/ericroach/Desktop/Desktop - Eric's MacBook Air/Liftoff/backend"
chmod +x test_slug_connections_api.sh
./test_slug_connections_api.sh
```

## What It Does

1. Extracts page IDs from a discovery run (e.g., `2025-10-21_3pages`)
2. Converts CSV keywords/slugs into manual mappings
3. Fetches Facebook ads for those pages
4. Matches ads to System1 slugs using your keyword mappings
5. Returns which pages are running ads matching your high-performing slugs

## Example Request

```json
{
  "discoveryRun": "2025-10-21_3pages",
  "mappingsCsv": "runs/system1/2025-11-07/top_rps_keywords_by_slug_no_leadgen.csv",
  "active_status": "active",
  "platforms": "facebook,instagram"
}
```

## Response Includes

- `ads[]` - All ads with `matching_slugs` field
- `slug_connections[]` - Summary of which slugs are running on which pages
- `counts` - Ad counts by category

