/* eslint-disable no-console */
import axios from 'axios';

/**
 * Poll a specific Sora job until completion and download.
 * 
 * Usage: ts-node src/scripts/soraPollJob.ts <jobId>
 */

const jobId = process.argv[2]?.trim();
if (!jobId) {
  console.error('Usage: ts-node src/scripts/soraPollJob.ts <jobId>');
  process.exit(1);
}

const BASE = process.env.BACKEND_URL || 'http://localhost:3001';

async function main() {
  console.log(`\nPolling job: ${jobId}\n`);

  const maxWaitMs = 20 * 60 * 1000; // 20 minutes
  const pollMs = 10_000; // 10 seconds
  const started = Date.now();
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;

  while (true) {
    try {
      const statusResp = await axios.get(
        `${BASE}/api/sora/videos/${encodeURIComponent(jobId)}`,
        { 
          timeout: 30_000,
          validateStatus: (status) => status < 500,
        }
      );

      if (statusResp.status !== 200) {
        consecutiveErrors++;
        const elapsed = Math.round((Date.now() - started) / 1000);
        console.log(`[${elapsed}s] HTTP ${statusResp.status} - retrying...`);
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.error('Too many errors. Stopping.');
          process.exit(1);
        }
        await new Promise((r) => setTimeout(r, pollMs));
        continue;
      }

      consecutiveErrors = 0;
      const status = statusResp.data?.status;
      const filePath = statusResp.data?.files?.video_mp4;
      const progress = statusResp.data?.raw?.progress;
      const elapsed = Math.round((Date.now() - started) / 1000);
      const progressText = typeof progress === 'number' ? ` (${progress}%)` : '';

      process.stdout.write(`\r[${elapsed}s] ${status}${progressText}${filePath ? ' ✅ FILE READY' : ''}`);

      if (status === 'completed' && filePath) {
        console.log('\n\n✅ SUCCESS!');
        console.log(`📁 File: ${filePath}`);
        console.log(`🌐 View: ${BASE}/api/sora/videos/${encodeURIComponent(jobId)}/file`);
        return;
      }

      if (status === 'failed' || status === 'cancelled') {
        console.log(`\n\n❌ Job ${status}`);
        console.log(JSON.stringify(statusResp.data, null, 2));
        process.exit(1);
      }

      if (Date.now() - started > maxWaitMs) {
        console.log(`\n\n⏱️  Timeout after ${Math.round(maxWaitMs / 1000)}s`);
        console.log('Check manually:', `${BASE}/api/sora/videos/${encodeURIComponent(jobId)}`);
        process.exit(1);
      }

      await new Promise((r) => setTimeout(r, pollMs));
    } catch (e: any) {
      consecutiveErrors++;
      const elapsed = Math.round((Date.now() - started) / 1000);
      const errorMsg = e?.code === 'ECONNABORTED' ? 'timeout' : e?.message || 'error';
      process.stdout.write(`\r[${elapsed}s] ⚠️  ${errorMsg} (${consecutiveErrors}/${maxConsecutiveErrors}) - retrying...`);
      
      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.log('\n\n❌ Too many errors. Job may still be processing.');
        console.log(`Check manually: ${BASE}/api/sora/videos/${encodeURIComponent(jobId)}`);
        process.exit(1);
      }
      
      await new Promise((r) => setTimeout(r, pollMs * 2));
    }
  }
}

main();
