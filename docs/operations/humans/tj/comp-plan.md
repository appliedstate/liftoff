# TJ — Compensation Plan (Proposed)

Status: proposed for adoption; private details in `docs/private/comp/tj.yaml` (SOPS‑encrypted).

## Components

- Base salary: current biweekly base; payroll on‑costs accounted for via employer multiplier (M).
- Portfolio margin share (monthly): tiered payout on TJ’s portfolio net margin (P).
- Guardrails: ROI floor; no payout on negative months.
- Quality multipliers: cadence/compliance adjustments (±10%).
- Cross‑team impact bonus: formalized “idea bonus” on attributable wins for others.

## Monthly Payout Formula

Let:
- P = TJ portfolio net margin for the month (USD, reconciled)
- Base_monthly = TJ base salary for the month (USD)
- M = employer on‑cost multiplier (e.g., 1.10–1.15)
- Bonus_tiered(P):
  - 5% on first $10,000
  - 10% on $10,001–$30,000
  - 12% on any amount > $30,000
- QualityMultiplier in {0.9, 1.0, 1.1}

Compute:
- GrossBonus = Bonus_tiered(P) × QualityMultiplier
- EmployerROI = (P − GrossBonus) / (Base_monthly × M)
- Guardrails:
  - If EmployerROI < 1.0 → payout = $0
  - Else if EmployerROI < 2.0 → payout = 0.5 × GrossBonus
  - Else → payout = GrossBonus

Cross‑team impact bonus (separate line):
- 2% of incremental margin attributable to a documented initiative (Impact Filter) realized by other buyers, for 14 days.

## Example (Illustrative)

Inputs:
- P = $20,167 (reconciled portfolio margin)
- Base_monthly ≈ $4,960
- M = 1.12
- QualityMultiplier = 1.0

Steps:
- Bonus_tiered = $10,000×5% + $10,167×10% = $1,516.70
- GrossBonus = $1,516.70
- EmployerROI = (20,167 − 1,516.70) / (4,960×1.12) ≈ 3.3×
- Guardrails → pass (≥2.0) → payout = $1,516.70

## Administration

- Source of truth (private): `docs/private/comp/tj.yaml` (SOPS‑encrypted; includes base, M, and tier config).
- Derived signals (public): `docs/operations/derived/comp-signals.json` (no private numbers; includes tier schedule and multipliers for AI/ops).
- Reviews: quarterly checkpoint against team ROI and market rates.
- Changes: require Impact Filter and approval by CEO + Finance.
