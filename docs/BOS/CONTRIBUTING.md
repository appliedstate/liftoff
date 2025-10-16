---
title: BOS Contribution Guide
---
# BOS Contribution Guide

Purpose
- Enable humans and AI agents to evolve BOS docs safely, consistently, and programmatically.

Frontmatter fields (required where applicable)
- `title`: Clean nav label (string)
- `owners`: Array of owner names or handles (e.g., ["Eric Roach", "Narbeh Ghazalian"]) 
- `status`: draft | in_review | approved
- `last_reviewed`: YYYY-MM-DD
- `links`: Array of related slugs or URLs

Authoring rules
- Keep sections concise and operational; link to PRDs and runbooks.
- Prefer numbered, testable lists over prose when defining rules or SLAs.
- For non‑reversible/approval topics, include an explicit “Approvals” subsection.

Change workflow
1) Edit the markdown and update frontmatter (`status` to in_review, `last_reviewed` = today).
2) Add evidence links (dashboards, PRs) in the body when changing rules/SLAs.
3) Request owner review; on approval, set `status` to approved.

Agent update contract
- Agents must:
  - Only modify sections within their mandate; never change owners.
  - Update `last_reviewed`; keep a “Changelog” bullet at bottom with date and summary.
  - Respect approval gates: if changes touch approvals/security/policy, set `status: in_review` and stop.

Changelog (append newest first)
- YYYY-MM-DD: Created contribution guide.


