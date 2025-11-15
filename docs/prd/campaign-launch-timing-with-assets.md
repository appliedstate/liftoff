# Campaign Launch Timing — Including Asset Generation

## Question: How long from start to finish to launch Facebook campaigns with 3 ad sets and 5 ads per ad set?

**Answer**: **~5-10 minutes** (asset generation) + **~4-6 seconds** (campaign launch) = **~5-10 minutes total**

---

## Two-Phase Process

### Phase 1: Asset Generation (Iterate) — BEFORE Launch
**Time**: ~5-10 minutes per creative

### Phase 2: Campaign Launch (Campaign Factory) — AFTER Assets Ready
**Time**: ~4-6 seconds

---

## Phase 1: Asset Generation via Iterate

### Image Generation

**Script**: `backend/src/scripts/generate.ts`
**Model**: Gemini 2.5 Flash Image or Nano Banana
**Timeout**: 120 seconds (2 minutes) per image

**Timing**:
- **Per Image**: ~30-60 seconds (typical) | up to 2 minutes (timeout)
- **15 Images** (3 ad sets × 5 ads):
  - **Sequential**: ~7.5-15 minutes (15 × 30-60s)
  - **Parallel** (if supported): ~30-60 seconds (all at once)

**Current Implementation**:
- Sequential generation with 500ms delay between images
- Processes up to 10 images by default (configurable)

**From PRD** (`docs/prd/iterate.md`):
- **Target**: ≤ 5 minutes per image (end-to-end)
- **Success Metric**: Time-to-first draft creative ≤ 5 minutes

---

### Video Generation

**Script**: `backend/src/scripts/generateVeo.ts`
**Model**: Veo 3.1 (Google)
**Process**: Long-running operation with polling

**Timing**:
- **Per Video**: ~2-10 minutes (polls every 10 seconds, up to 60 polls = 10 minutes max)
- **15 Videos** (3 ad sets × 5 ads):
  - **Sequential**: ~30-150 minutes (15 × 2-10 minutes)
  - **Parallel** (if supported): ~2-10 minutes (all at once)

**Current Implementation**:
- Starts long-running operation
- Polls every 10 seconds
- Up to 60 polls (10 minutes total)
- Downloads video when complete (5 minute timeout)

---

## Phase 2: Campaign Launch (After Assets Ready)

**Time**: ~4-6 seconds (as calculated in `campaign-launch-timing-estimate.md`)

**Operations**:
1. Create Facebook campaign: ~300ms
2. Create 3 ad sets: ~900ms (parallel) or ~2,700ms (sequential)
3. Create 15 ads: ~900ms (parallel) or ~6,000ms (sequential)
4. Create 3 Strategis campaigns: ~600ms (parallel) or ~1,800ms (sequential)
5. Database operations: ~30ms

**Total**: ~2.7 seconds (parallel) to ~8.5 seconds (sequential)

---

## Complete Timeline: Asset Generation → Campaign Launch

### Scenario: 15 Image Ads

**Asset Generation** (Iterate):
- **Sequential**: ~7.5-15 minutes (15 images × 30-60s each)
- **Parallel** (if implemented): ~30-60 seconds (all at once)

**Campaign Launch** (Campaign Factory):
- **Parallel**: ~4-6 seconds
- **Sequential**: ~8-10 seconds

**Total Time**:
- **Best Case** (parallel assets + parallel launch): **~35-70 seconds**
- **Typical** (sequential assets + parallel launch): **~8-16 minutes**
- **Worst Case** (sequential everything): **~15-25 minutes**

---

### Scenario: 15 Video Ads

**Asset Generation** (Iterate):
- **Sequential**: ~30-150 minutes (15 videos × 2-10 minutes each)
- **Parallel** (if implemented): ~2-10 minutes (all at once)

**Campaign Launch** (Campaign Factory):
- **Parallel**: ~4-6 seconds
- **Sequential**: ~8-10 seconds

**Total Time**:
- **Best Case** (parallel assets + parallel launch): **~2-10 minutes**
- **Typical** (sequential assets + parallel launch): **~30-150 minutes**
- **Worst Case** (sequential everything): **~30-150 minutes**

---

## Breakdown by Asset Type

| Asset Type | Generation Time (Per Asset) | 15 Assets Sequential | 15 Assets Parallel | Campaign Launch |
|------------|----------------------------|----------------------|-------------------|-----------------|
| **Images** | 30-60 seconds | ~7.5-15 minutes | ~30-60 seconds | ~4-6 seconds |
| **Videos** | 2-10 minutes | ~30-150 minutes | ~2-10 minutes | ~4-6 seconds |

---

## Current State

### ✅ What Exists

1. **Iterate System**:
   - ✅ Image generation (`generate.ts`)
   - ✅ Video generation (`generateVeo.ts`)
   - ✅ Scripts exist and work

2. **Campaign Factory**:
   - ✅ Campaign creation
   - ✅ Ad set creation
   - ❌ **Ad creation NOT YET IMPLEMENTED** (but ready to add)

### ❌ What's Missing

1. **Integration**:
   - ❌ Iterate → Campaign Factory (no automatic flow)
   - ❌ Asset upload to Facebook (creatives need to be uploaded first)
   - ❌ Creative → Ad linking

2. **Parallelization**:
   - ❌ Parallel image generation (currently sequential)
   - ❌ Parallel video generation (currently sequential)

---

## Realistic Timeline

### For 1 Campaign, 3 Ad Sets, 5 Ads Per Ad Set (15 Total)

**If Using Pre-Generated Assets** (assets already exist):
- **Campaign Launch Only**: **~4-6 seconds**

**If Generating Assets First**:
- **Images**: **~8-16 minutes** (sequential) or **~35-70 seconds** (parallel)
- **Videos**: **~30-150 minutes** (sequential) or **~2-10 minutes** (parallel)

**Total** (Asset Generation + Launch):
- **Images**: **~8-16 minutes** (typical)
- **Videos**: **~30-150 minutes** (typical)

---

## Key Insight

**Asset generation is the bottleneck**, not campaign launch.

- **Campaign launch**: ~4-6 seconds (fast)
- **Asset generation**: ~8-16 minutes (images) or ~30-150 minutes (videos) (slow)

**To speed up**:
1. ✅ Pre-generate assets (run Iterate ahead of time)
2. ✅ Parallelize asset generation (generate all 15 at once)
3. ✅ Use existing assets (reuse creatives across campaigns)

---

## Summary

**Answer**: 
- **Asset Generation** (Iterate): **~8-16 minutes** for 15 images, **~30-150 minutes** for 15 videos
- **Campaign Launch** (Campaign Factory): **~4-6 seconds** once assets are ready
- **Total**: **~8-16 minutes** (images) or **~30-150 minutes** (videos)

**The bottleneck is asset generation, not campaign launch.**



