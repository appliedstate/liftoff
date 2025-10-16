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

## 2024–2025 Compensation Actuals (from TJ 2025 Earnings sheet)

Summary (USD):
- Annual Salary: $55,000
- Monthly Salary: $4,583.33
- Avg Monthly Bonus: 2024 $1,472.75 → 2025 $963.44 (−34.58%)
- Avg Monthly Compensation: 2024 $6,056.08 → 2025 $5,546.78 (−8.41%)
- Benefits Monthly Avg: 2024 $350.66 → 2025 $462.03 (+31.76%)
- Comp + Benefits Monthly Avg: 2024 $6,406.75 → 2025 $6,008.81 (−6.21%)

Notes:
- Monthly breakdowns (salary, bonus, total) are tracked in the source sheet; use these for month-by-month reconciliation against the formula and guardrails above.
- Source: [TJ 2025 Earnings — Google Sheet](https://docs.google.com/spreadsheets/d/1aHEPwINLIEfyKL5jwpRfDGey_2JOJjNAk-si21osoqc/edit?usp=sharing)

## Administration

- Source of truth (private): `docs/private/comp/tj.yaml` (SOPS‑encrypted; includes base, M, and tier config).
- Derived signals (public): `docs/operations/derived/comp-signals.json` (no private numbers; includes tier schedule and multipliers for AI/ops).
- Reviews: quarterly checkpoint against team ROI and market rates.
- Changes: require Impact Filter and approval by CEO + Finance.
