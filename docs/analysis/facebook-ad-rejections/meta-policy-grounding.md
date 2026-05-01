# Meta Policy Grounding

This system now separates findings into three evidence classes:

- `official`: directly supported by public Meta policy/help documentation
- `historical`: supported by the local rejection corpus and observed review outcomes
- `inferred`: internal interpretation of how Meta review risk behaves in combinations

## What Meta appears to say directly

### 1. Age and location targeting are generally allowed for adults

Meta's audience docs say advertisers can create audiences based on age and location, and Meta's ML help article says advertisers can create audiences based on age and location. That means words like `seniors` or phrases like `near you` are not, by themselves, clearly banned in normal adult advertising.

Sources:

- [Meta ad targeting](https://www.facebook.com/business/ads/ad-targeting)
- [How Facebook ads use machine learning](https://www.facebook.com/help/447278887528796)
- [About Facebook Ads](https://www.facebook.com/help/769828729705201/)

### 2. Meta gives special protection to health-status information

Meta says it does not use information with special protections, such as health status, to show ads. That does not read like a blanket ban on every health term in ad copy, but it does support being careful with language that sounds like the advertiser knows the viewer has a condition.

Sources:

- [How Facebook decides which ads to show you](https://www.facebook.com/help/562973647153813/)
- [About Facebook Ads](https://www.facebook.com/help/769828729705201/)

### 3. Some categories get extra restrictions

Meta explicitly says advertisers must use Special Ad Categories for campaigns related to credit, employment, housing, social issues, elections or politics, and its help materials say audience options are limited for credit, employment and housing.

Sources:

- [How to boost Instagram Reels](https://www.facebook.com/help/instagram/570215404599013)
- [How Facebook ads use machine learning](https://www.facebook.com/help/447278887528796)
- [Create ad campaigns in Meta Ads Manager](https://www.facebook.com/help/messenger-app/621956575422138/)

### 4. Deceptive, evasive and scam-like behavior is a high-enforcement area

Meta's review guide says restrictions can apply when advertisers repeatedly violate policy, evade review, use inauthentic accounts, or manage assets connected to abusive assets. Meta's February 26, 2026 enforcement post also highlights cloaking, deceptive advertisers, and services that help clients evade enforcement systems.

Sources:

- [Ads review policy for businesses](https://www.facebook.com/business/ads/review-policy-guidelines)
- [Meta takes legal action against scam advertisers](https://about.fb.com/news/2026/02/meta-takes-legal-action-against-scam-advertisers/)

## What this means for the scorer

### Seniors

`Seniors` is now treated as `historical`, not `official`.

Interpretation:

- `seniors` alone is not treated as a direct Meta policy violation
- `seniors` becomes riskier when stacked with scam-adjacent or vulnerable framing like `qualify`, `free`, `tap below`, vague program claims, or deceptive destination patterns

### Near you / near me

`near you` is now treated as `inferred`, not `official`.

Interpretation:

- `near you` alone is not modeled as a direct policy ban
- `near you` becomes materially riskier when paired with health-condition language, because the combination can read like the ad knows something sensitive about the viewer

### Paid clinical trial language

Paid-study language is now split from `job_income_opportunity`.

Interpretation:

- `get paid`, `compensation`, `stipend`, or `up to $X` in a research context is modeled as `study_compensation_framing`
- that is softer than true `job_income_opportunity`
- it can still become risky when paired with health-condition targeting, exaggerated treatment claims, or vulnerable framing

This is intended to reduce false positives where a clinical-trial ad is not truly an employment ad, but still may be incentive-forward enough to trigger review sensitivity.

## Highest-risk areas for this system

The highest-risk buckets, combining public Meta materials with observed rejects, are:

1. deceptive or misleading business practices
2. review evasion, cloaking, and abusive account behavior
3. sensitive-health copy that implies personal attributes
4. employment/income/opportunity framing
5. vulnerable-user framing around money, insurance, or qualification
6. risky combinations of the above

## Operational rule

For user-facing review output:

- do not say `Meta policy forbids this` unless the support is `official`
- say `historical reject risk` when the support is empirical
- say `inferred combo risk` when it is our interpretation of how sensitive signals stack
