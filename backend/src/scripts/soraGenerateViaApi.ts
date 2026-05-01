/* eslint-disable no-console */
import axios from 'axios';

// Usage:
//   npm run sora:generate -- "A prompt..."
// or
//   ts-node src/scripts/soraGenerateViaApi.ts "A prompt..."

const BASE = process.env.BACKEND_URL || 'http://localhost:3001';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Retry an axios request with exponential backoff for network errors
 */
async function retryRequest<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 1000
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isNetworkError =
        err?.code === 'ECONNRESET' ||
        err?.code === 'ETIMEDOUT' ||
        err?.code === 'ECONNREFUSED' ||
        err?.message?.includes('socket hang up') ||
        err?.message?.includes('timeout');

      // Don't retry on last attempt or non-network errors
      if (attempt >= maxRetries || !isNetworkError) {
        throw err;
      }

      const delay = initialDelayMs * Math.pow(2, attempt);
      console.warn(`[retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw lastError || new Error('Retry exhausted');
}

async function main() {
  const prompt = (process.argv.slice(2).join(' ') || '').trim();
  if (!prompt) {
    console.error('Missing prompt.\n\nExample:\n  npm run sora:generate -- "A cinematic shot of..."');
    process.exit(1);
  }

  const model = process.env.SORA_MODEL || 'sora-2';
  const seconds = process.env.SORA_SECONDS ? Number(process.env.SORA_SECONDS) : 8;
  const size = process.env.SORA_SIZE || '1280x720';

  console.log('Submitting job...');
  const create = await retryRequest(() =>
    axios.post(
      `${BASE}/api/sora/videos`,
      { prompt, model, seconds, size, autoDownload: true },
      { timeout: 60_000 }
    )
  );

  const jobId = String(create.data?.jobId || '');
  if (!jobId) throw new Error('Backend did not return jobId');
  console.log('jobId:', jobId);
  console.log('Polling until file exists...');

  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;

  while (true) {
    try {
      const status = await retryRequest(() =>
        axios.get(`${BASE}/api/sora/videos/${encodeURIComponent(jobId)}`, { timeout: 60_000 })
      );
      consecutiveErrors = 0; // Reset on success

      const st = status.data?.status;
      const file = status.data?.files?.video_mp4;
      console.log('status:', st, 'file:', file ? 'yes' : 'no');
      
      if (st === 'completed' && file) {
        console.log('\n✅ Saved:', file);
        console.log('Open in browser:', `${BASE}/api/sora/videos/${encodeURIComponent(jobId)}/file`);
        return;
      }
      if (st === 'failed' || st === 'cancelled') {
        throw new Error(`Job ended with status=${st}`);
      }
      
      await sleep(5000);
    } catch (err: any) {
      consecutiveErrors++;
      const isNetworkError =
        err?.code === 'ECONNRESET' ||
        err?.code === 'ETIMEDOUT' ||
        err?.code === 'ECONNREFUSED' ||
        err?.message?.includes('socket hang up');

      if (isNetworkError && consecutiveErrors < maxConsecutiveErrors) {
        console.warn(`[poll] Network error (${consecutiveErrors}/${maxConsecutiveErrors}), retrying...`);
        await sleep(5000);
        continue;
      }

      // If we've exhausted retries or it's not a network error, throw
      throw err;
    }
  }
}

main().catch((e) => {
  console.error('Error:', e?.message || e);
  process.exit(1);
});

