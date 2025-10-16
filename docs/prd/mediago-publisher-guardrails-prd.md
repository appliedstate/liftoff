## PRD: MediaGo/Taboola Publisher Guardrails & Early-Pause Automation (via Terminal)

### Overview
Automate detection and control of low-quality publisher sources on MediaGo (and Taboola parity), emphasizing fast, reversible actions. The system pauses risky publishers at the campaign level first, aggregates by TLD, and supports alias resolution (e.g., Sliide placements), while maintaining a weekly human review loop. All actions are executed by Terminal through CLI/cron jobs and logged for auditability.

### Problem Statement
Recent audits surfaced significant spend on publishers not present in pub reports and on domains with manipulated subdomain patterns. Some sources accumulate >$200 before detection, with high CTR but poor or unknown revenue, harming ROAS. Manual triage is slow and inconsistent.

### Goals
- Reduce wasted spend on bad/new publishers through early detection and automated pauses.
- Default to campaign-level scope to preserve cross-campaign winners; allow account-level escalation when warranted.
- Treat subdomain variations as one entity at the TLD level for decisions and blocking.
- Provide a weekly human review workflow to reinstate profitable publishers and refine rules.

### Non-Goals
- Permanent account-level blacklisting without human confirmation.
- Blocking based solely on CTR. CTR can be misleading and must be paired with outcome metrics or reconciliation backlog status.

### Target Users
- Buyers (Anastasia, Ben, TJ, Dan, Mike): review queue, overrides, and reinstatements.
- Terminal (automation): executes detections, pauses, logs, and compiles weekly summaries.
- Analyst/Operator: maintains alias maps, thresholds, and rule configs.

### Key Principles
- Pause-first, review-later. Avoid irreversible blocks; prioritize reversible pause.
- Campaign-level default; escalate to account-level if repeated offenses across campaigns.
- Aggregate by TLD; support alias/canonical mapping (e.g., `us.sliide.flamingo` → `sliide`).
- Use reconciled revenue/ROAS where available; otherwise, use conservative heuristics with spend caps.

### Functional Requirements

1) Source Normalization
- Extract base domain/TLD from publisher identifiers and collapse subdomains (e.g., `wrapper.bazooka.joe` → `bazooka.joe`).
- Maintain an alias map for vendor-specific placements (e.g., Sliide) to canonical names.
- Persist canonicalized keys for consistent decisions and logs.

2) Early-Pause Heuristics (Campaign-Level)
- New publisher guard: if canonicalized pub not seen in last 30 days and spend ≥ $20 within a day, pause at campaign level and enqueue for review.
- Fast-spend guard: if spend ≥ $100 within a same-day window and no matching revenue in reconciled report by T+1, keep paused until reviewed.
- Low-ROAS guard: if day-level ROAS < 80% and spend ≥ $50 (with reconciled revenue available), pause and enqueue for review.
- High-CTR is not a blocking criterion alone. Only used as a supporting signal in the log.

3) Escalation Rules
- If the same TLD/canonical pub triggers pauses on ≥ 2 campaigns within 7 days, add account-level block recommendation to the review queue.
- If a pub has ≥ 3 pauses in 14 days with no positive review outcomes, propose account-level block.

4) Review Workflow
- Terminal compiles a daily queue of paused pubs with evidence (spend, CTR, ROAS, reconciliation status, impacted campaigns).
- Weekly review export (CSV/Markdown) with actions: reinstate (campaign-level), extend pause, escalate to account block, add to allowlist.
- Undo path: if reinstated, automatically remove from temporary blocklists and track outcome next 72h.

5) TLD-Level Actions
- Pauses and blocks are applied to all observed subdomains for a TLD when triggered.
- Allow mapping exceptions: if a subdomain is allowlisted, do not pause that subdomain even if parent TLD is paused.

6) CLI/Terminal Commands
Terminal exposes commands for non-interactive cron usage and operator actions:

```bash
# Detect and propose actions (dry-run supported)
terminal pubs detect --platform mediago --window 1d --dry-run=false

# Apply campaign-level pauses from last detect pass
terminal pubs apply --platform mediago --scope campaign --reason early_pause

# Export review queue (CSV + md summary)
terminal pubs export-review --platform mediago --out ./reports/pubs_$(date +%F)

# Escalate repeated offenders to account-level blocklist (requires confirmation flag)
terminal pubs escalate --platform mediago --threshold 2 --confirm

# Manage alias map (e.g., Sliide placements)
terminal pubs alias import ./config/publisher_aliases.yaml
terminal pubs alias list --filter sliide

# Reinstate items after review (supports TLD and subdomain exceptions)
terminal pubs reinstate --platform mediago --pub est3lm.com --scope campaign --campaign-id <id>
terminal pubs allowlist add --platform mediago --pub bubbles.bazooka.joe
```

7) Data Inputs
- Platform spend and pub identifiers (MediaGo API; Taboola parity phase).
- Reconciled revenue (Strateg.is or daily CSV) with pub matching.
- Alias map file `config/publisher_aliases.yaml` for canonicalization.
- Historical seen-publisher registry with last-seen timestamps.

8) Outputs & Logging
- Action log with correlation IDs: detection → decision → applied change.
- Review queue artifacts: CSV and Markdown digest with evidence and links.
- Weekly summary metrics: paused pubs, reinstatements, escalations, net ROAS lift estimate.

### Technical Requirements

- Deterministic rules as code; configurable thresholds via YAML:
  - `new_publisher_spend_threshold: 20`
  - `low_roas_threshold: 0.80`
  - `fast_spend_threshold: 100`
  - `new_pub_lookback_days: 30`
  - `campaign_escalation_threshold: 2`
  - `repeated_offense_threshold: 3`
- Default `dryRun=true` for first 7 days; logs decisions without applying.
- Cooldown: do not re-evaluate the same pub/campaign pair more than once per 6h unless spend increases ≥ $50.
- Safe-guards: never pause all active prospecting campaigns simultaneously.
- Idempotent CLI: repeated runs apply the same net state.

### Acceptance Criteria
- Early-pause triggers when a new publisher hits $20 spend in a day, pausing at campaign level and adding to the review queue.
- TLD aggregation: three subdomains under the same TLD count as one entity for decisions.
- Alias resolution: a Sliide placement reported as `flamingo.net` is normalized to `sliide` if present in alias map.
- Weekly export generated with counts: total paused, reinstated, escalated; includes evidence columns.
- Reinstatement command removes temporary blocks and resumes delivery; action visible in logs.
- No pauses occur based solely on CTR without spend/revenue rules being met.

### Success Metrics
- ≥ 50% reduction in spend on pubs with ROAS < 80% over 14 days.
- ≤ 5% false-positive reinstatements (paused then reinstated and profitable within 72h).
- < 15 minutes median time-to-pause from first $20 spend for new pubs.
- Weekly operator review time ≤ 30 minutes.

### Risks & Mitigations
- Incomplete reconciliation delays: use pause-first with auto-expiry if revenue later appears (auto-unpause option off by default; human review preferred).
- Mislabeling/alias drift: maintain alias map and vendor-specific corrections; add telemetry checks for sudden mapping changes.
- Over-blocking at account level: require repeated-offense thresholds and explicit confirmation flags.

### Implementation Plan
1. Build canonicalization (TLD + alias map) and seen-registry.
2. Implement detection heuristics and dry-run reporting.
3. Add CLI commands and wire to Terminal executor for campaign-level pauses.
4. Implement review queue export and reinstatement/allowlist flows.
5. Add escalation workflow and account-level block integration.
6. Run 7-day dry-run; calibrate thresholds with buyers; then enable writes.

### Config Artifacts
```yaml
# config/publisher_guardrails.yaml
new_publisher_spend_threshold: 20
low_roas_threshold: 0.80
fast_spend_threshold: 100
new_pub_lookback_days: 30
campaign_escalation_threshold: 2
repeated_offense_threshold: 3
dryRun: true
```

```yaml
# config/publisher_aliases.yaml
aliases:
  - match: "*.sliide.*"
    canonical: "sliide"
  - match: "us.sliide.*"
    canonical: "sliide"
  - match: "flamingo.net"
    canonical: "sliide"
```


