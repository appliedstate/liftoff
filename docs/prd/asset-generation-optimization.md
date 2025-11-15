# Asset Generation Optimization — Speeding Up Iterate

## Question: How can we speed up asset generation using Veo 3.1 and Nano Banana? How fast is text generation in comparison?

---

## Current State: Sequential Generation

### Image Generation (Nano Banana / Gemini 2.5 Flash)
- **Per Image**: ~30-60 seconds
- **15 Images Sequential**: ~7.5-15 minutes
- **Current**: Sequential loop with 500ms delay between images

### Video Generation (Veo 3.1)
- **Per Video**: ~2-10 minutes (polls every 10 seconds)
- **15 Videos Sequential**: ~30-150 minutes
- **Current**: Sequential, one video at a time

---

## Text Generation Speed (Comparison Baseline)

**Model**: GPT-4 / GPT-4.1-mini (OpenAI)
**Script**: `backend/src/lib/openai.ts`

**Timing**:
- **Per Request**: ~1-3 seconds (typical)
- **15 Requests Sequential**: ~15-45 seconds
- **15 Requests Parallel**: ~1-3 seconds (all at once)

**Why So Fast?**:
- Text generation is lightweight (no image/video rendering)
- API responds quickly (~500ms-2s typical)
- Can handle high concurrency (many parallel requests)

**Comparison**:
| Type | Per Item | 15 Items Sequential | 15 Items Parallel |
|------|----------|---------------------|-------------------|
| **Text** | 1-3 seconds | ~15-45 seconds | ~1-3 seconds |
| **Images** | 30-60 seconds | ~7.5-15 minutes | ~30-60 seconds |
| **Videos** | 2-10 minutes | ~30-150 minutes | ~2-10 minutes |

**Text is 10-20x faster than images, 40-200x faster than videos.**

---

## Optimization Strategy 1: Parallelization

### Current Implementation (Sequential)

```typescript
// backend/src/scripts/generate.ts (current)
for (const r of data) {
  if (produced >= max) break;
  // ... prepare prompt ...
  const buf = await generateImageWithGemini({ ... });
  fs.writeFileSync(outfile, buf);
  await new Promise(r => setTimeout(r, 500)); // 500ms delay
}
```

**Problem**: Each image waits for the previous one to complete.

### Optimized Implementation (Parallel)

```typescript
// Parallel version
const promises = data.slice(0, max).map(async (r) => {
  // ... prepare prompt ...
  try {
    const buf = await generateImageWithGemini({ ... });
    const outfile = path.join(genDir, `${adId}_gen.jpg`);
    fs.writeFileSync(outfile, buf);
    return { success: true, adId };
  } catch (e) {
    return { success: false, adId, error: e.message };
  }
});

const results = await Promise.all(promises);
```

**Speedup**: **15x faster** (from ~7.5-15 minutes → ~30-60 seconds)

---

## Optimization Strategy 2: Batch Processing with Concurrency Limits

### Why Limit Concurrency?

- **API Rate Limits**: Gemini/Veo may limit concurrent requests
- **Memory**: Too many parallel requests can exhaust memory
- **Cost**: Burst of parallel requests may trigger rate limiting

### Recommended Approach: Concurrency Pool

```typescript
// Process in batches of 5 concurrent requests
const CONCURRENCY_LIMIT = 5;

async function generateInBatches(items: any[], concurrency: number) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(item => generateImage(item))
    );
    results.push(...batchResults);
  }
  return results;
}

// For 15 images with concurrency=5:
// Batch 1: 5 images in parallel (~30-60s)
// Batch 2: 5 images in parallel (~30-60s)
// Batch 3: 5 images in parallel (~30-60s)
// Total: ~90-180 seconds (1.5-3 minutes)
```

**Speedup**: **5x faster** (from ~7.5-15 minutes → ~1.5-3 minutes)

---

## Optimization Strategy 3: Remove Unnecessary Delays

### Current: 500ms Delay Between Images

```typescript
await new Promise(r => setTimeout(r, 500)); // Unnecessary!
```

**Problem**: Adds 7.5 seconds total (15 × 500ms) for no reason.

**Fix**: Remove delay when parallelizing.

**Speedup**: **+7.5 seconds** (minor but free)

---

## Optimization Strategy 4: Optimize Veo Polling

### Current: Poll Every 10 Seconds

```typescript
// backend/src/scripts/generateVeo.ts (current)
for (let i = 0; i < 60; i++) { // up to ~10 minutes @10s
  await new Promise(r => setTimeout(r, 10000)); // 10 second poll
  const poll = await axios.get(`${BASE_URL}/${opName}`, ...);
  if (statusResp?.done) { done = true; break; }
}
```

### Optimized: Adaptive Polling

```typescript
// Start with shorter intervals, increase if needed
let pollInterval = 2000; // Start at 2 seconds
for (let i = 0; i < 300; i++) { // 10 minutes max
  await new Promise(r => setTimeout(r, pollInterval));
  const poll = await axios.get(`${BASE_URL}/${opName}`, ...);
  if (statusResp?.done) { done = true; break; }
  // Increase interval if still processing (backoff)
  if (i > 10) pollInterval = Math.min(10000, pollInterval * 1.1);
}
```

**Speedup**: **~2-4 minutes faster** (detect completion sooner)

---

## Optimization Strategy 5: Parallel Veo Operations

### Current: Sequential Video Generation

```typescript
// One video at a time
for (const video of videos) {
  await generateVeo(video); // Wait for each to complete
}
```

### Optimized: Parallel Video Generation

```typescript
// Start all videos in parallel, poll all operations
const operations = await Promise.all(
  videos.map(video => startVeoOperation(video))
);

// Poll all operations concurrently
const results = await Promise.all(
  operations.map(op => pollUntilComplete(op))
);
```

**Speedup**: **15x faster** (from ~30-150 minutes → ~2-10 minutes)

**Note**: Veo 3.1 supports concurrent operations (check API limits).

---

## Optimization Strategy 6: Pre-Generate Assets

### Strategy: Generate Assets Ahead of Time

**Workflow**:
1. **Daily Batch**: Generate 50-100 assets overnight
2. **Asset Library**: Store in database with metadata
3. **Campaign Launch**: Select from library (instant)

**Speedup**: **Instant** (0 seconds) — assets already exist

**Trade-off**: 
- ✅ Zero wait time for campaign launch
- ❌ May generate unused assets
- ✅ Can reuse assets across campaigns

---

## Optimization Strategy 7: Use Faster Models

### Image Generation Options

| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| **Gemini 2.5 Flash Image** | ~30-60s | High | Medium |
| **Nano Banana** | ~30-60s | High | Low |
| **DALL-E 3** | ~10-20s | High | High |
| **Midjourney** | ~30-60s | Very High | Medium |

**Recommendation**: Gemini 2.5 Flash is already fast. Consider DALL-E 3 if speed is critical.

### Video Generation Options

| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| **Veo 3.1** | ~2-10 min | Very High | High |
| **Runway Gen-3** | ~1-5 min | High | Medium |
| **Pika** | ~1-3 min | Medium | Low |

**Recommendation**: Veo 3.1 is best quality. Consider Runway if speed is critical.

---

## Complete Optimization Roadmap

### Phase 1: Quick Wins (1-2 hours)

1. ✅ **Remove 500ms delay** between images
   - **Speedup**: +7.5 seconds
   - **Effort**: 5 minutes

2. ✅ **Parallelize image generation** (concurrency=5)
   - **Speedup**: 5x faster (~7.5-15 min → ~1.5-3 min)
   - **Effort**: 30 minutes

3. ✅ **Optimize Veo polling** (adaptive intervals)
   - **Speedup**: ~2-4 minutes faster per video
   - **Effort**: 30 minutes

**Total Speedup**: **~5x faster** for images, **~20% faster** for videos

---

### Phase 2: Advanced Parallelization (2-4 hours)

1. ✅ **Full parallel image generation** (all 15 at once)
   - **Speedup**: 15x faster (~7.5-15 min → ~30-60s)
   - **Effort**: 1 hour
   - **Risk**: May hit API rate limits

2. ✅ **Parallel Veo operations** (all 15 at once)
   - **Speedup**: 15x faster (~30-150 min → ~2-10 min)
   - **Effort**: 2 hours
   - **Risk**: May hit API rate limits

**Total Speedup**: **~15x faster** for both images and videos

---

### Phase 3: Pre-Generation Pipeline (1-2 days)

1. ✅ **Build asset library system**
   - Generate assets ahead of time
   - Store in database with metadata
   - Tag by category, hook, brand

2. ✅ **Asset selection API**
   - Query library by criteria
   - Return ready-to-use assets

**Total Speedup**: **Instant** (0 seconds) — assets pre-generated

---

## Expected Performance After Optimization

### Current (Sequential)

| Asset Type | 15 Assets | Time |
|------------|-----------|------|
| **Images** | Sequential | ~7.5-15 minutes |
| **Videos** | Sequential | ~30-150 minutes |
| **Text** | Sequential | ~15-45 seconds |

### After Phase 1 (Concurrency=5)

| Asset Type | 15 Assets | Time | Speedup |
|------------|-----------|------|---------|
| **Images** | Batched (5 concurrent) | ~1.5-3 minutes | **5x** |
| **Videos** | Batched (5 concurrent) | ~6-30 minutes | **5x** |
| **Text** | Parallel | ~1-3 seconds | **15x** |

### After Phase 2 (Full Parallel)

| Asset Type | 15 Assets | Time | Speedup |
|------------|-----------|------|---------|
| **Images** | All parallel | ~30-60 seconds | **15x** |
| **Videos** | All parallel | ~2-10 minutes | **15x** |
| **Text** | All parallel | ~1-3 seconds | **15x** |

### After Phase 3 (Pre-Generated)

| Asset Type | 15 Assets | Time | Speedup |
|------------|-----------|------|---------|
| **Images** | From library | **0 seconds** | **∞** |
| **Videos** | From library | **0 seconds** | **∞** |
| **Text** | From library | **0 seconds** | **∞** |

---

## Comparison: Text vs Image vs Video

| Metric | Text | Images | Videos |
|--------|------|--------|--------|
| **Per Item** | 1-3 seconds | 30-60 seconds | 2-10 minutes |
| **15 Items Sequential** | ~15-45 seconds | ~7.5-15 minutes | ~30-150 minutes |
| **15 Items Parallel** | ~1-3 seconds | ~30-60 seconds | ~2-10 minutes |
| **Speed vs Text** | 1x (baseline) | 10-20x slower | 40-200x slower |
| **Can Parallelize?** | ✅ Yes (unlimited) | ✅ Yes (5-15 concurrent) | ✅ Yes (5-15 concurrent) |
| **API Rate Limits** | High (1000s/min) | Medium (10s/min) | Low (5-10/min) |

**Key Insight**: Text generation is **10-20x faster** than images, **40-200x faster** than videos. All can be parallelized, but videos have the most room for improvement.

---

## Recommended Implementation Order

1. **Week 1**: Phase 1 (Quick Wins)
   - Remove delays
   - Add concurrency=5 for images
   - Optimize Veo polling
   - **Result**: 5x faster images, 20% faster videos

2. **Week 2**: Phase 2 (Full Parallel)
   - Test API rate limits
   - Implement full parallelization
   - **Result**: 15x faster for both

3. **Week 3-4**: Phase 3 (Pre-Generation)
   - Build asset library
   - Set up nightly batch jobs
   - **Result**: Instant asset selection

---

## Summary

**Answer**: 
- **Text generation**: **1-3 seconds** per item (10-20x faster than images)
- **Optimization**: Parallelize with concurrency limits (5-15 concurrent)
- **Speedup**: **5-15x faster** depending on parallelization level
- **Best Strategy**: Pre-generate assets ahead of time (instant selection)

**Expected Timeline After Optimization**:
- **Images**: ~30-60 seconds (15 parallel) or **0 seconds** (pre-generated)
- **Videos**: ~2-10 minutes (15 parallel) or **0 seconds** (pre-generated)
- **Text**: ~1-3 seconds (15 parallel) or **0 seconds** (pre-generated)



