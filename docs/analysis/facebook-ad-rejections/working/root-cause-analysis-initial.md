# Root Cause Analysis - Facebook Ad Rejections (Initial Pass)

## Scope

- Analysis window: 2026-01-28 to 2026-02-24 (based on screenshot email timestamps)
- Source set: 21 screenshots
- Total rejection events logged: 23
- Unique normalized reason codes: 6

## Top Rejection Reasons

| Rank | reason_code_normalized | total_rejections | share_of_total |
|---|---|---:|---:|
| 1 | DECEPTIVE_LINK_SPAM | 12 | 52.2% |
| 2 | DISCRIMINATORY_PRACTICES_FIN_SERVICES | 4 | 17.4% |
| 3 | MISLEADING_JOB_OPPORTUNITY | 3 | 13.0% |

## Root Cause Hypotheses

1. **Destination-to-creative mismatch and redirect patterns** are likely driving `DECEPTIVE_LINK_SPAM` volume.
2. **Creative copy enters sensitive verticals** (financial products/services) without policy-safe framing, triggering `DISCRIMINATORY_PRACTICES_FIN_SERVICES`.
3. **Employment/opportunity framing language** triggers fraud/deceptive-practice enforcement for `MISLEADING_JOB_OPPORTUNITY`.

## Policy Mapping

- Standards baseline: https://transparency.fb.com/policies/ad-standards/
- Key areas implicated: Spam, Fraud/Scams/Deceptive Practices, Discriminatory Practices, Human Exploitation.

## Data Gaps To Close

- 6 records do not expose an ad ID in screenshot and should be backfilled from Ads Manager exports.
- Business Manager and Ad Account IDs are mostly not visible in screenshot content and should be joined from account metadata.
- A few screenshot reasons are generic policy text and need policy-subsection lookup from Ads Manager rejection detail panel.

## Immediate Corrective Actions

1. Run URL-level QA on all ads with `DECEPTIVE_LINK_SPAM` before submission.
2. Add preflight copy checks for job-opportunity and financial-services claims language.
3. Create a reject-reason triage process with weekly count trend review by normalized reason code.
