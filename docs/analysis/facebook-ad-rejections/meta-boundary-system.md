# Meta Boundary System

## Purpose
This system scores the negative first.

It does not try to predict what will win creative performance-wise. It tries to identify which copy/transcript patterns are most likely to trigger Meta review pressure, rejection pressure, asset bans, or personal-account restrictions.

The generation problem comes after this.

## Physics
### Axiom 1
Meta is not evaluating only literal text. It is evaluating inferred intent from text, asset relationships, landing-page consistency, and behavior.

### Axiom 2
Risk is nonlinear.

A single sensitive word may be survivable. Sensitive-topic copy plus personal-attribute inference plus hype plus urgency is where the cascade starts.

### Axiom 3
The most dangerous failures are not ordinary ad rejections. They are trust failures:

- spam / deceptive-link review
- deceptive or misleading business practices
- misleading job or opportunity enforcement
- discriminatory-practice / special-category enforcement

### Axiom 4
The real boundary is not “what gets approved once.”

The real boundary is “what can be repeated at scale without contaminating the trust graph.”

### Axiom 5
Curiosity is allowed.

Exploitative ambiguity is not.

## What The Rejection Corpus Says
From `meta_rejected_ads_with_copy_2026-01-01_to_2026-04-20.jsonl`:

- top repeated reason: `Spam / deceptive link`
- next repeated reasons: `Fraud, Scams and Deceptive Practices`, `Unacceptable Business Practices`
- other recurring pressure: `financial products and services / discriminatory practices`, `special-category adjacency`, `medical recruitment hype`

Observed reject clusters:

1. Medical-condition targeting plus personal relevance
2. Medical-condition targeting plus hype
3. Job/income promise framing
4. Affordability / vulnerable-status framing
5. Demographic targeting
6. Manipulative or sensational business hooks
7. CTA / landing-page-mismatch signals that correlate with spam review

## Scoring Surfaces
The scorer uses these policy surfaces:

1. `personal_attribute_inference`
2. `medical_claim_hype`
3. `medical_condition_targeting`
4. `economic_vulnerability`
5. `job_income_opportunity`
6. `demographic_targeting`
7. `manipulative_hook`
8. `trust_mismatch_spam`

These are not exact Meta internal labels. They are first-principles surfaces derived from:

- the local rejection corpus
- Meta’s official enforcement posture around scams, cloaking, and evasion
- Meta’s treatment of health status and sensitive ad delivery/protected attributes
- Meta’s special-category rules for employment and financial products

## Bands
### White
Low ambiguity. Descriptive. Factual. No viewer-state inference. No hype. No vulnerable-status pressure.

### Grey
Contains one meaningful policy surface but not enough compounding risk to imply deceptive intent by itself.

### Black
Contains multiple hard-risk surfaces or a high-risk compound:

- health condition + “near you”
- health condition + treatment hype
- health condition + vulnerability framing
- job/income promise + easy-opportunity language
- demographic targeting + financing or eligibility framing
- manipulative hook + spam/trust mismatch cues

## How To Use It
1. Score transcript, primary text, headline, and landing-page copy separately.
2. Review line-level triggers, not just overall band.
3. Remove black lines first.
4. Reduce grey lines until the whole asset can survive repeated use.
5. Only then optimize curiosity, clickthrough, and funnel continuation.

## Design Rule
We are not trying to find “what barely sneaks through.”

We are trying to find the highest-curiosity language that stays outside the compound-risk zones that damage asset trust.
