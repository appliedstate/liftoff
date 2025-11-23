# Taboola 502 Test Results

## Test Date: 2025-11-16 (Historical Date)

## Summary
**All 6 parameter variations failed with HTTP 502: Bad Gateway**

This confirms Devin's assessment: **This is NOT a parameter issue** - it's an upstream Taboola API issue or Strategis application error.

## Test Results

| Variation | Parameters | Result |
|-----------|-----------|--------|
| Current: dimension (singular) | `dateStart`, `dateEnd`, `organization`, `adSource`, `dimension` | ❌ HTTP 502 |
| Try: dimensions (plural) | `dateStart`, `dateEnd`, `organization`, `adSource`, `dimensions` | ❌ HTTP 502 |
| Try: without adSource | `dateStart`, `dateEnd`, `organization`, `dimension` | ❌ HTTP 502 |
| Try: with dbSource=ch | `dateStart`, `dateEnd`, `organization`, `adSource`, `dimension`, `dbSource=ch` | ❌ HTTP 502 |
| Try: with dbSource=level | `dateStart`, `dateEnd`, `organization`, `adSource`, `dimension`, `dbSource=level` | ❌ HTTP 502 |
| Try: minimal params | `dateStart`, `dateEnd`, `organization` | ❌ HTTP 502 |

## Key Findings

1. **Parameter variations don't matter** - All combinations fail identically
2. **Not date-specific** - Failed for both 2025-11-23 (current) and 2025-11-16 (historical)
3. **Consistent failure** - 502 Bad Gateway across all parameter combinations
4. **Other endpoints work** - Outbrain, MediaGo, NewsBreak all return data successfully

## Conclusion

This is **definitely an upstream issue**:
- **Most likely**: Taboola upstream API is down, rate-limited, or timing out
- **Alternative**: Strategis application error specific to Taboola endpoint handler
- **Unlikely**: Parameter validation, authentication, or data availability

## Next Steps

### Immediate Actions (Priority Order)

1. **Check Strategis Application Logs** (HIGHEST PRIORITY)
   - Look for errors around `/api/taboola/report` requests
   - Check for stack traces, timeout errors, or upstream connection failures
   - This will reveal if it's Strategis internal error or Taboola upstream issue

2. **Check Taboola Upstream API Status**
   - Verify if Taboola's API is operational
   - Check for rate limiting or authentication issues
   - Verify if Strategis has valid Taboola API credentials

3. **Contact Strategis Support**
   - Escalate with these test results showing all parameter variations fail
   - Request investigation of `/api/taboola/report` endpoint
   - Ask for ETA on fix

4. **Contact Taboola Support** (if Strategis logs show upstream 502)
   - Verify Taboola API status
   - Check if Strategis account has access issues

## Impact Assessment

- **Pipeline Status**: ✅ Ingestion continues (Taboola is optional)
- **Revenue Data**: ✅ Captured via S1 reports (includes Taboola revenue)
- **Spend Data**: ❌ Missing Taboola spend (affects ROAS calculations)
- **Business Impact**: ⚠️ Cannot calculate accurate ROAS for Taboola campaigns

## Mitigation

Current mitigation is working correctly:
- Pipeline treats Taboola as optional and continues
- Revenue data is captured (via S1)
- `endpoint_completeness` table tracks the failure
- Once fixed, we can backfill missing dates

## Test Command Used

```bash
npm run monitor:test-taboola -- 2025-11-16
```

## Related Documentation

- `docs/monitoring/questions-taboola-502.md` - Original questions for Devin
- `docs/monitoring/taboola-backfill-strategy.md` - Backfill plan once fixed

