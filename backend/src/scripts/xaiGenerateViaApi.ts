/* eslint-disable no-console */
import axios from 'axios';

// Usage:
//   npm run xai:generate -- "A prompt..."
// or
//   ts-node src/scripts/xaiGenerateViaApi.ts "A prompt..."

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

      if (attempt >= maxRetries || !isNetworkError) throw err;
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
    console.error('Missing prompt.\n\nExample:\n  npm run xai:generate -- "A cat playing with a ball"');
    process.exit(1);
  }

  const model = process.env.XAI_VIDEO_MODEL || 'grok-imagine-video';
  const duration = process.env.XAI_VIDEO_DURATION ? Number(process.env.XAI_VIDEO_DURATION) : 8;
  const aspect_ratio = process.env.XAI_VIDEO_ASPECT_RATIO || '9:16';
  const resolution = process.env.XAI_VIDEO_RESOLUTION || '720p';

  console.log('Submitting xAI job...');
  let create: any;
  try {
    create = await retryRequest(() =>
      axios.post(
        `${BASE}/api/xai/videos`,
        { prompt, model, duration, aspect_ratio, resolution, autoDownload: true },
        { timeout: 60_000 }
      )
    );
  } catch (err: any) {
    // Print the useful bits of the failure (connection vs HTTP response)
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error('\n[xai:generate] Failed to submit job');
    console.error('BASE:', BASE);
    if (err?.code) console.error('code:', err.code);
    if (typeof status === 'number') console.error('http_status:', status);
    if (data) console.error('response_body:', typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    console.error('message:', err?.message || String(err));
    process.exit(1);
  }

  const requestId = String(create.data?.requestId || '');
  if (!requestId) throw new Error('Backend did not return requestId');

  console.log('requestId:', requestId);
  console.log('Polling until file exists...');

  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;

  while (true) {
    try {
      const status = await retryRequest(() =>
        axios.get(`${BASE}/api/xai/videos/${encodeURIComponent(requestId)}`, { timeout: 60_000 })
      );
      consecutiveErrors = 0;

      const st = status.data?.status;
      const file = status.data?.files?.video_mp4;
      const url = status.data?.resultUrl;
      console.log('status:', st, 'url:', url ? 'yes' : 'no', 'file:', file ? 'yes' : 'no');

      if (st === 'completed' && file) {
        console.log('\n✅ Saved:', file);
        console.log('Open in browser:', `${BASE}/api/xai/videos/${encodeURIComponent(requestId)}/file`);
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

      throw err;
    }
  }
}

main().catch((e) => {
  const status = e?.response?.status;
  const data = e?.response?.data;
  if (typeof status === 'number') console.error('http_status:', status);
  if (data) console.error('response_body:', typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  console.error('Error:', e?.message || e);
  process.exit(1);
});

