# Facebook Hidden Comment Sentiment API Spec

## Purpose

Build a production Facebook ingestion path that lets Liftoff score **all Page-post sentiment**, not just publicly visible comments.

Today our comment sentiment review is incomplete because Facebook Page admins can hide comments. In the Page UI, those comments still appear in moderation views, but our current prototype only scores visible samples. This spec defines the permissions, API integration, data model, and pipeline needed so hidden negative sentiment is included in review-pressure scoring at scale.

## Problem

Current sentiment scoring undercounts negative feedback because:

- Facebook Page admins can hide comments without deleting them.
- Hidden comments remain relevant to trust and enforcement risk.
- Our current pipeline relies on manually sampled visible comments.
- Our review-pressure logic in [backend/src/lib/metaReviewPressure.ts](/Users/ericroach/code/liftoff/backend/src/lib/metaReviewPressure.ts) and [backend/src/lib/commentComplaintClassifier.ts](/Users/ericroach/code/liftoff/backend/src/lib/commentComplaintClassifier.ts) does not distinguish visible from hidden comment sentiment.

In live Page moderation views, we have already confirmed hidden complaint comments exist and are marked by `Unhide` actions in Facebook’s Comments Manager.

## Goal

Produce an API-backed sentiment feed that:

- fetches comments for ad-backed Page posts
- detects whether each comment is hidden
- includes hidden comments in complaint and sentiment scoring
- preserves visibility state so analysts can compare visible vs hidden sentiment
- scales to continuous monitoring across many ads, pages, and posts

## Non-goals

- Replacing the current reaction sentiment logic
- Auto-hiding, unhiding, or deleting comments
- Building a fully automated moderation tool
- Moderating Instagram comments in the first version

## What Meta Documents

The implementation should be based on official Meta APIs:

- The Graph API `Comment` node exposes `is_hidden` and `can_hide`.
- Meta documents `is_hidden` as whether the comment is hidden from everyone except the author and the author’s friends.
- The comments edge for objects/Page posts requires a **Page access token** associated with a person who can perform the `MODERATE` task on the Page and the `pages_manage_engagement` permission.
- The Facebook Pages API docs also list `pages_manage_engagement`, `pages_read_engagement`, and `pages_read_user_engagement` for Page post/comment workflows.
- Meta’s documentation is inconsistent across some pages about read-content scope naming, with some references still mentioning `pages_read_user_content`. Engineering must validate the exact currently-approved scope set during implementation and app review.

Primary references:

- [Comment node](https://developers.facebook.com/docs/graph-api/reference/comment/)
- [Object comments edge](https://developers.facebook.com/docs/graph-api/reference/object/comments/)
- [Facebook Pages API: Posts](https://developers.facebook.com/docs/pages-api/posts/)
- [Facebook Pages API: Comments and @Mentions](https://developers.facebook.com/docs/pages-api/comments-mentions/)

## High-level Design

### Join model

Use the **underlying Page post/story object** as the source of truth for engagement.

Object chain:

`ad_id -> creative.effective_object_story_id -> post_id -> comments/replies/reactions`

We already request `creative.effective_object_story_id` in monitoring exports, so the new system should extend that existing join rather than invent a new one.

Relevant local references:

- [backend/src/scripts/monitoring/analyzeLiveMetaRisk.ts](/Users/ericroach/code/liftoff/backend/src/scripts/monitoring/analyzeLiveMetaRisk.ts)
- [backend/src/scripts/monitoring/exportFacebookCampaignGraph.ts](/Users/ericroach/code/liftoff/backend/src/scripts/monitoring/exportFacebookCampaignGraph.ts)

### Core requirement

For each ad under review:

1. Resolve the backing Page post/story ID.
2. Fetch all comments and replies via Graph API.
3. Capture `is_hidden` per comment.
4. Persist raw comment rows.
5. Produce aggregated sentiment splits:
   - all comments
   - visible comments only
   - hidden comments only
6. Feed all three into review-pressure analytics.

## Required Access

### Page tasks

The Facebook user used to mint the Page token must be able to perform:

- `MODERATE`
- `CREATE_CONTENT`

`MODERATE` is the critical one for hidden-comment visibility and comment management.

### App permissions

Request and verify:

- `pages_manage_engagement`
- `pages_read_engagement`
- `pages_read_user_engagement`

Implementation note:

- During app review and token validation, verify whether Meta still requires or exposes `pages_read_user_content` for this endpoint family. Some docs still mention that older name.

### Token type

Use a **Page access token**.

Do not rely on:

- a pure ad-account token
- a Strategis relay token that only supports ads endpoints
- public unauthenticated post scraping

## Required API Capability Spike

Before building the full pipeline, engineering must run a one-post spike against a Page post that already has known hidden comments.

The spike passes only if the API returns at least one comment with:

- `is_hidden = true`
- comment text matching a known hidden UI comment
- stable pagination over the full comment set

If the Graph comments edge does **not** return hidden comments even with the correct Page token and permissions, stop and escalate. In that case we will need a fallback ingestion strategy, likely based on a first-party moderation export surface rather than the public Graph comments edge.

## Proposed API Requests

### 1. Resolve ads to post/story IDs

Input:

- Facebook ad IDs already tracked in Liftoff

Source:

- existing ad export path using `creative.effective_object_story_id`

Expected fields:

- `ad.id`
- `ad.creative.id`
- `ad.creative.effective_object_story_id`
- `ad.creative.object_story_spec.page_id`

### 2. Fetch comments for the post

Base request:

```http
GET /{post-id}/comments
```

Recommended fields:

```text
id,message,created_time,from,parent{id},comment_count,is_hidden,can_hide,can_remove,like_count
```

Recommended parameters:

```text
order=reverse_chronological
limit=100
```

Notes:

- paginate until exhaustion
- persist raw API payloads for debugging
- if replies are not fully materialized in the first pass, recursively query `/{comment-id}/comments`

### 3. Fetch replies

For any comment with `comment_count > 0`:

```http
GET /{comment-id}/comments
```

Use the same field set as the top-level request.

### 4. Fetch reaction breakdowns

This is already a known gap in the sentiment pipeline and should be formalized alongside comments:

```http
GET /{post-id}/reactions?type=LIKE&summary=total_count&limit=0
GET /{post-id}/reactions?type=LOVE&summary=total_count&limit=0
GET /{post-id}/reactions?type=CARE&summary=total_count&limit=0
GET /{post-id}/reactions?type=HAHA&summary=total_count&limit=0
GET /{post-id}/reactions?type=WOW&summary=total_count&limit=0
GET /{post-id}/reactions?type=SAD&summary=total_count&limit=0
GET /{post-id}/reactions?type=ANGRY&summary=total_count&limit=0
```

This is not required to unlock hidden comments, but it should live in the same engagement ingestion service.

## Data Model

### Raw tables

#### `facebook_post_engagement_targets`

- `ad_id`
- `creative_id`
- `effective_object_story_id`
- `page_id`
- `page_name`
- `campaign_id`
- `account_id`
- `buyer`
- `captured_at`

#### `facebook_post_comments_raw`

- `comment_id`
- `parent_comment_id`
- `post_id`
- `page_id`
- `ad_id`
- `author_id`
- `author_name`
- `message`
- `created_time`
- `is_hidden`
- `can_hide`
- `can_remove`
- `like_count`
- `comment_count`
- `depth`
- `raw_json`
- `captured_at`

Primary key:

- `comment_id`

#### `facebook_post_reaction_breakdowns`

- `post_id`
- `ad_id`
- `page_id`
- `reaction_type`
- `total_count`
- `captured_at`

### Derived table

#### `facebook_post_sentiment_rollups`

- `post_id`
- `ad_id`
- `page_id`
- `captured_at`
- `total_comments`
- `visible_comments`
- `hidden_comments`
- `all_negative_comments`
- `visible_negative_comments`
- `hidden_negative_comments`
- `all_complaint_rate`
- `visible_complaint_rate`
- `hidden_complaint_rate`
- `all_sentiment_score`
- `visible_sentiment_score`
- `hidden_sentiment_score`
- `dominant_visible_label`
- `dominant_hidden_label`
- `dominant_all_label`

## Processing Rules

### Comment classification

Do not build a separate hidden-comment classifier.

Instead:

- run the existing classifier in [backend/src/lib/commentComplaintClassifier.ts](/Users/ericroach/code/liftoff/backend/src/lib/commentComplaintClassifier.ts)
- add visibility-aware wrappers around it
- compute summary metrics for:
  - all comments
  - visible comments where `is_hidden = false`
  - hidden comments where `is_hidden = true`

### Review-pressure integration

Update [backend/src/lib/metaReviewPressure.ts](/Users/ericroach/code/liftoff/backend/src/lib/metaReviewPressure.ts) so complaint scoring uses:

- `all comments` as the main enforcement-risk score
- `visible comments` as the public sentiment view
- `hidden comments` as the suppressed-risk view

Suggested changes:

- add `hiddenComplaintSummary`
- add `allComplaintSummary`
- add `hiddenCommentCount`
- add `hiddenNegativeRate`
- increase complaint pressure when hidden negative comments exist, even if visible comments are positive

### Report integration

Update [backend/src/scripts/monitoring/analyzeMetaReactionSentiment.ts](/Users/ericroach/code/liftoff/backend/src/scripts/monitoring/analyzeMetaReactionSentiment.ts) or add a sibling report that outputs:

- visible comment sentiment
- hidden comment sentiment
- all comment sentiment
- hidden complaint examples

## Service Design

Add a new backend service, for example:

- `backend/src/services/metaPageEngagementService.ts`

Responsibilities:

- fetch comments for post IDs
- fetch replies
- fetch reaction breakdowns
- normalize Graph responses
- write raw records
- emit derived sentiment summaries

Recommended functions:

- `fetchPostComments(postId, pageAccessToken)`
- `fetchCommentReplies(commentId, pageAccessToken)`
- `fetchPostReactionBreakdown(postId, pageAccessToken)`
- `buildPostSentimentRollup(postId)`

## Auth Design

We do not currently have evidence that Liftoff’s existing Facebook integration can do this.

Current repo integrations are ads-oriented:

- [backend/src/services/strategisFacebookClient.ts](/Users/ericroach/code/liftoff/backend/src/services/strategisFacebookClient.ts)
- [backend/src/services/metaAdsService.ts](/Users/ericroach/code/liftoff/backend/src/services/metaAdsService.ts)

Engineering must therefore add one of:

- a Liftoff-managed Facebook Login flow that stores Page access tokens
- a Strategis relay endpoint that can issue the required Page-scoped reads

Minimum auth requirements:

- secure storage for Page access tokens
- token refresh / rotation handling
- per-page permission validation
- explicit check that the token-holder has `MODERATE` on the Page

## Scale Plan

### Initial scope

Run on:

- ads already in the monitoring sample
- posts mapped from `effective_object_story_id`
- daily and hourly refreshes

### Refresh cadence

- `high-spend active ads`: every 30-60 minutes
- `low-spend active ads`: every 4-6 hours
- `inactive historical ads`: once daily or on-demand

### Pagination and rate limiting

- use cursor pagination
- checkpoint by `captured_at` and newest comment timestamp
- avoid refetching unchanged old comments on every run
- backfill replies only when `comment_count` changed
- batch by page and reuse the same Page access token per page job

## Acceptance Criteria

The implementation is complete only if all of the following are true:

1. For a known moderated dental Page post, the API returns comments with `is_hidden = true`.
2. At least one hidden comment in the API matches a comment visible in the Facebook Comments Manager with `Unhide`.
3. The derived rollup shows separate counts for visible and hidden comments.
4. Review-pressure output changes when hidden complaint comments are present.
5. The report can print sample hidden complaint comments without manual browser inspection.
6. Engineering can run the job across multiple Page posts without user interaction.

## Known Risks

- Meta permissions naming is inconsistent across docs and may differ in the app review UI.
- Hidden-comment retrieval may depend on Page task role plus token origin, not permission scope alone.
- Some comments may be stickers or emoji-only; classifiers must not assume plain text.
- Replies may carry the most explicit complaint language and must not be ignored.
- Some posts used by ads may be reels/video posts with different comment behavior than standard feed posts.

## Open Questions

- Does the Graph comments edge return hidden comments directly, or only expose `is_hidden` for comments already returned?
- Do we need a separate reels-specific path for some ad-backed post objects?
- Should hidden comments increase review-pressure more than visible negatives because they indicate the page chose to suppress them?
- Do we want to log moderation actions over time so we can measure hide-rate as a trust-risk signal?

## Recommended First Milestone

Milestone 1 should be a narrow production spike:

- one Page
- one known ad-backed dental post
- one Page access token
- fetch comments and replies
- verify `is_hidden`
- persist raw rows
- produce a three-way sentiment split: `all`, `visible`, `hidden`

Only after that passes should engineering generalize to multi-page scheduled ingestion.
