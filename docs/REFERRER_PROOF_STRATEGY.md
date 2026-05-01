# Physics/First Principles Approach to `referrerAdCreative` Verification

## 1. The "Physics" of the Problem
*   **The Law (Constraint):** Google's November 2025 policy states: *If Traffic Source = Paid, Then `referrerAdCreative` MUST exist.*
*   **The Mechanics:**
    *   **Input:** A URL visiting your site.
    *   **State A (Organic):** User comes from Google/Direct. No proof needed. `referrerAdCreative` = Null is OK.
    *   **State B (Paid/Arbitrage):** User comes from an Ad (FB/Taboola). Proof IS needed. `referrerAdCreative` = Required.
*   **The Failure Mode (Entropy):** If State B exists but the parameter is missing, the system (RSOC) collapses (Strike/Revenue = 0).

## 2. First Principles Implementation Strategy

We cannot just "check if the param exists" because that ignores the **State** of the traffic. A blanket check would flag organic traffic falsely.

We must implement a **Conditional Verification System**:

### Step 1: Detect the State (Traffic Source Physics)
How do we know if the traffic is "Paid" without seeing the ad?
*   **Signal 1 (UTM Params):** `utm_source=facebook`, `utm_medium=cpc`.
*   **Signal 2 (ForceKeys):** If `forceKey` is present, it effectively implies a "Force-Traffic" setup (arbitrage behavior), even if not explicitly paid.
*   **Signal 3 (Known Arbitrage Sources):** `fbclid`, `gclid`, `tblci` (Taboola click ID).

### Step 2: Apply the Force (The Check)
*   **Rule:** `IF (IsPaidSignal OR HasForceKey) AND (Missing referrerAdCreative) THEN Flag_Violation`
*   **Why:** We treat `forceKey` as the proxy for "Arbitrage Intent." If you are forcing keywords, you are playing the arbitrage game, and thus you are subject to the "Arbitrage Tax" (the proof requirement).

## 3. Implementation Logic (The Code Blueprint)

We will modify `articleExtractor.ts` to implement this logic:

1.  **Extract All Params:** Pull `referrerAdCreative`, `utm_source`, `forceKey*`, `fbclid`, etc.
2.  **Determine Traffic State:**
    *   `isArbitrageLikely = (hasForceKeys || hasAdClickIds || isPaidUtm)`
3.  **Verify Conservation of Proof:**
    *   If `isArbitrageLikely` is TRUE, then `referrerAdCreative` MUST be present and non-empty.
    *   If missing: Return a specific **"Critical Policy Failure"** warning in the `PageEvalResult`.

This approach avoids false positives on organic traffic while ruthlessly enforcing the "physics" of the paid traffic policy.




