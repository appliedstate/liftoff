---
id: edge-initial-launch
version: 0.1.0
owner: growth-ops
title: Edge — Initial Campaign Launch Checklist
purpose: Don’t miss steps; keep launches consistent and debuggable.
---

## Pre-flight (before touching Ads Manager)

- [ ] Confirm **ad account** (name + ID) is recorded in `docs/edge/meta-accounts.md`
- [ ] Confirm **pixel/dataset** + **domain** + **CAPI** health (if applicable)
- [ ] Confirm **URL parameters / click IDs** + destination QA
- [ ] Confirm **naming convention** (campaign/ad set/ad)
- [ ] Confirm **creative pack** ready (formats, variants, filenames)

## Build (entity creation)

- [ ] Create campaign with correct objective/optimization (document it)
- [ ] Create ad sets (audience/placement/bid/budget) with minimal variance
- [ ] Create ads (creative, copy, destination) + verify previews
- [ ] Ensure any exclusions / retarget windows are correct

## Launch (first 48–72h)

- [ ] Record launch timestamp + budgets
- [ ] Avoid edits unless there is a tracking/emergency issue
- [ ] Check delivery + basic signal health (spend, impressions, clicks, events)
- [ ] Log anomalies (CPM spikes, rejected ads, broken links)

## Post-launch log (required)

- [ ] Add a campaign note file in `docs/edge/campaigns/` (template: what we launched + why + links)

