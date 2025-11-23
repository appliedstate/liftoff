# Timezone Handling in Monitoring System

## Critical Issue: UTC vs PST Mismatch

**Problem**: Strategis API uses UTC timezone, but query scripts were using PST dates, causing data mismatches.

## How Data is Stored

### `campaign_index` Table
- **Date Source**: Strategis API with `timezone: 'UTC'` parameter
- **Date Format**: UTC dates (YYYY-MM-DD)
- **Example**: If it's Nov 22 PST 8am, the API returns data for Nov 22 UTC (which is Nov 21 PST 11pm - Nov 22 PST 11pm)

### `campaign_launches` Table
- **Date Source**: `trackCampaignLaunches` script
- **Current Issue**: Uses PST dates for `first_seen_date`
- **Problem**: Mismatch with `campaign_index` which uses UTC dates

## How Dates Are Handled

### Data Ingestion (`ingestCampaignIndex.ts`)
```typescript
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10); // UTC date
}
```
- Uses UTC dates when calling Strategis API
- Stores UTC dates in `campaign_index.date`

### Query Scripts (FIXED)
- **Input**: Accept PST dates (user-friendly)
- **Conversion**: Convert PST → UTC before querying
- **Display**: Show both PST and UTC dates in output

Example:
```typescript
const pstDate = '2025-11-22'; // User input (PST)
const utcDate = pstDateToUtcForQuery(pstDate); // '2025-11-22' or '2025-11-23'
// Query: WHERE ci.date = '${utcDate}'
```

## Conversion Logic

PST is UTC-8, so:
- Nov 22 PST 00:00 = Nov 22 UTC 08:00
- Most data for "Nov 22 PST" will be in "Nov 22 UTC"
- But some early morning PST data (before 8am PST) might be in "Nov 21 UTC"

Current conversion:
```typescript
function pstDateToUtcForQuery(pstDate: string): string {
  const [year, month, day] = pstDate.split('-').map(Number);
  const pstMidnight = new Date(Date.UTC(year, month - 1, day, 8, 0, 0));
  return pstMidnight.toISOString().slice(0, 10);
}
```

This maps PST dates to the UTC date that contains most of that PST day's data.

## Fixed Scripts

✅ `reportDailyPL.ts` - Converts PST → UTC for queries
✅ `queryDateLaunches.ts` - Converts PST → UTC for queries

## Remaining Issues

⚠️ **`campaign_launches.first_seen_date`**: Currently stores PST dates, but should store UTC dates to match `campaign_index`

**Impact**: When querying `campaign_launches` with UTC dates, we might miss records that were stored with PST dates.

**Fix Needed**: Update `trackCampaignLaunches.ts` to:
1. Convert PST input dates to UTC before storing
2. Or store both PST and UTC dates
3. Or standardize on UTC dates throughout

## Best Practices

1. **Always use UTC for storage** - Match Strategis API timezone
2. **Accept PST for user input** - More user-friendly
3. **Convert PST → UTC for queries** - Before querying database
4. **Display both timezones** - Show PST (user-friendly) and UTC (technical) in output

## Example

User asks: "What was revenue yesterday?" (yesterday = Nov 22 PST)

1. Script converts: Nov 22 PST → Nov 22 UTC (or Nov 23 UTC depending on time)
2. Queries: `WHERE ci.date = '2025-11-22'` (UTC)
3. Returns: Data for Nov 22 UTC (which is Nov 21 4pm PST - Nov 22 4pm PST)
4. Displays: "Revenue for Nov 22 PST (querying UTC date: 2025-11-22)"

## Testing

To verify timezone handling:
1. Check what UTC date corresponds to "yesterday PST"
2. Verify data exists in `campaign_index` for that UTC date
3. Run query script and verify it finds the data
4. Check that displayed dates make sense

