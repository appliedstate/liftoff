/* eslint-disable no-console */
import axios from 'axios';

/**
 * Test the complete Sora flow end-to-end:
 * 1. Create video with prompt
 * 2. Poll until completed (should be ~2 minutes)
 * 3. Download immediately when completed
 * 
 * This ensures we can retrieve videos within the 1-hour window.
 * 
 * Usage: ts-node src/scripts/soraTestFullFlow.ts
 */

const BASE = process.env.BACKEND_URL || 'http://localhost:3001';

const testPrompt = 'A simple test video: a red ball bouncing on a white background, smooth motion, 2 seconds';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Sora Full Flow Test');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Prompt:', testPrompt);
  console.log('Model: sora-2');
  console.log('Duration: 4 seconds');
  console.log('Size: 720x1280 (9:16)\n');

  // Step A: Create
  console.log('[Step A] Creating video job...');
  let jobId: string;
  try {
    const createResp = await axios.post(
      `${BASE}/api/sora/videos`,
      {
        prompt: testPrompt,
        model: 'sora-2',
        seconds: 4,
        size: '720x1280',
        autoDownload: true, // Enable auto-download
      },
      { timeout: 60_000 }
    );

    jobId = createResp.data?.jobId;
    if (!jobId) {
      throw new Error('No jobId returned');
    }

    console.log(`✅ Job created: ${jobId}`);
    console.log(`   Status: ${createResp.data?.status || 'unknown'}`);
  } catch (e: any) {
    console.error('❌ Create failed:', e?.response?.data || e?.message);
    process.exit(1);
  }

  // Step B: Poll until completed
  console.log('\n[Step B] Polling until completion...');
  console.log('   (Expected: ~2 minutes for sora-2)\n');

  const maxWaitMs = 10 * 60 * 1000; // 10 minutes max
  const pollMs = 5_000; // 5 seconds
  const started = Date.now();

  while (true) {
    try {
      const statusResp = await axios.get(
        `${BASE}/api/sora/videos/${encodeURIComponent(jobId)}`,
        { timeout: 30_000 }
      );

      const status = statusResp.data?.status;
      const progress = statusResp.data?.raw?.progress;
      const elapsed = Math.round((Date.now() - started) / 1000);
      const progressText = typeof progress === 'number' ? ` (${progress}%)` : '';
      
      process.stdout.write(`\r   [${elapsed}s] ${status}${progressText}`);

      if (status === 'completed') {
        console.log('\n\n✅ Video completed!');
        break;
      }

      if (status === 'failed' || status === 'cancelled') {
        console.log(`\n\n❌ Video ${status}`);
        console.log(JSON.stringify(statusResp.data, null, 2));
        process.exit(1);
      }

      if (Date.now() - started > maxWaitMs) {
        console.log(`\n\n⏱️  Timeout after ${Math.round(maxWaitMs / 1000)}s`);
        process.exit(1);
      }

      await new Promise((r) => setTimeout(r, pollMs));
    } catch (e: any) {
      const elapsed = Math.round((Date.now() - started) / 1000);
      console.log(`\n   [${elapsed}s] Poll error: ${e?.message || e} - retrying...`);
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }

  // Step C: Download immediately
  console.log('\n[Step C] Downloading immediately (within 1-hour window)...');
  
  try {
    const downloadResp = await axios.post(
      `${BASE}/api/sora/videos/${encodeURIComponent(jobId)}/download`,
      {},
      { timeout: 600_000 } // 10 minutes
    );

    const filePath = downloadResp.data?.filePath;
    if (filePath) {
      console.log(`✅ Download successful!`);
      console.log(`   File: ${filePath}`);
      console.log(`   View: ${BASE}/api/sora/videos/${encodeURIComponent(jobId)}/file`);
      
      // Verify file exists
      const validateResp = await axios.get(
        `${BASE}/api/sora/videos/${encodeURIComponent(jobId)}`,
        { timeout: 30_000 }
      );
      
      if (validateResp.data?.files?.video_mp4) {
        console.log(`\n✅ Verification: MP4 file confirmed in job record`);
      } else {
        console.log(`\n⚠️  Warning: File downloaded but not in job record`);
      }
    } else {
      console.log('⚠️  Download reported success but no file path');
    }
  } catch (e: any) {
    console.error('❌ Download failed:');
    console.error('   Status:', e?.response?.status);
    console.error('   Error:', e?.response?.data || e?.message);
    
    // Check if expired
    if (e?.response?.data?.error?.includes('expired')) {
      console.error('\n⚠️  Video expired! This means:');
      console.error('   1. Video completed successfully ✅');
      console.error('   2. But download was attempted >1 hour after completion ❌');
      console.error('   3. Solution: Download immediately after completion (within 1 hour)');
    }
    
    process.exit(1);
  }

  const totalTime = Math.round((Date.now() - started) / 1000);
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`✅ Full flow test complete in ${totalTime}s`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
