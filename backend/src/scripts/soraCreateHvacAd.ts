/* eslint-disable no-console */
import axios from 'axios';

/**
 * Create a new Sora video for HVAC delivery driver recruitment ad.
 * 
 * Usage: ts-node src/scripts/soraCreateHvacAd.ts
 */

const BASE = process.env.BACKEND_URL || 'http://localhost:3001';

const prompt = `Here's a tight 14-second video ad transcript tailored for HVAC delivery service drivers—clear, fast, and relatable:

[Scene: Driver loading HVAC equipment into a truck]
VO: "You deliver more than equipment—you deliver comfort."

[Scene: Smooth route, easy drop-off]
VO: "With steady routes, reliable schedules, and local deliveries…"

[Scene: Driver smiling, heading home]
VO: "Join a team that keeps you moving—and gets you home."

On-screen text: Now hiring HVAC delivery drivers`;

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Creating Sora Video: HVAC Delivery Driver Recruitment Ad');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Prompt:');
  console.log(prompt);
  console.log('\nParameters:');
  console.log('  Model: sora-2');
  console.log('  Duration: 8 seconds (closest to 14s available)');
  console.log('  Size: 720x1280 (9:16 vertical for social media)');
  console.log('  Auto-download: true\n');

  try {
    console.log('[Step A] Creating video job...');
    const createResp = await axios.post(
      `${BASE}/api/sora/videos`,
      {
        prompt,
        model: 'sora-2',
        seconds: 8,
        size: '720x1280',
        autoDownload: true,
      },
      { timeout: 60_000 }
    );

    const jobId = createResp.data?.jobId;
    if (!jobId) {
      throw new Error('No jobId returned from backend');
    }

    console.log('✅ Job created successfully!');
    console.log(`   Job ID: ${jobId}`);
    console.log(`   Status: ${createResp.data?.status || 'unknown'}`);
    console.log(`   Job Directory: ${createResp.data?.jobDir || 'unknown'}`);
    console.log('\n📋 Endpoints:');
    console.log(`   Status: ${BASE}/api/sora/videos/${encodeURIComponent(jobId)}`);
    console.log(`   Download: ${BASE}/api/sora/videos/${encodeURIComponent(jobId)}/download`);
    console.log(`   File: ${BASE}/api/sora/videos/${encodeURIComponent(jobId)}/file`);

    console.log('\n[Step B] Polling for completion...');
    console.log('   (Auto-download is enabled - file will download automatically when ready)');
    console.log('   (Polling every 10 seconds, max 20 minutes)...\n');

    const maxWaitMs = 20 * 60 * 1000; // 20 minutes
    const pollMs = 10_000; // 10 seconds
    const started = Date.now();
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;

    while (true) {
      let statusResp: any;
      try {
        statusResp = await axios.get(
          `${BASE}/api/sora/videos/${encodeURIComponent(jobId)}`,
          { 
            timeout: 30_000, // 30 seconds per request
            validateStatus: (status) => status < 500, // Don't throw on 4xx/5xx
          }
        );
        consecutiveErrors = 0; // Reset error counter on success
      } catch (e: any) {
        consecutiveErrors++;
        const elapsed = Math.round((Date.now() - started) / 1000);
        const errorMsg = e?.code === 'ECONNABORTED' ? 'timeout' : e?.message || 'connection error';
        process.stdout.write(`\r   [${elapsed}s] ⚠️  Poll error (${consecutiveErrors}/${maxConsecutiveErrors}): ${errorMsg} - retrying...`);
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.log(`\n\n❌ Too many consecutive errors (${consecutiveErrors}). Stopping polling.`);
          console.log('\n💡 The job is still processing. Check status manually:');
          console.log(`   GET ${BASE}/api/sora/videos/${encodeURIComponent(jobId)}`);
          console.log('\n💡 Or wait a few minutes and run:');
          console.log(`   npm run sora:download -- ${jobId}`);
          process.exit(1);
        }
        
        // Wait a bit longer before retrying after errors
        await new Promise((r) => setTimeout(r, pollMs * 2));
        continue;
      }

      if (!statusResp || statusResp.status !== 200) {
        consecutiveErrors++;
        const elapsed = Math.round((Date.now() - started) / 1000);
        process.stdout.write(`\r   [${elapsed}s] ⚠️  HTTP ${statusResp?.status || 'unknown'} - retrying...`);
        await new Promise((r) => setTimeout(r, pollMs));
        continue;
      }

      const status = statusResp.data?.status;
      const filePath = statusResp.data?.files?.video_mp4;

      const elapsed = Math.round((Date.now() - started) / 1000);
      const progress = statusResp.data?.raw?.progress;
      const progressText = typeof progress === 'number' ? ` (${progress}%)` : '';
      process.stdout.write(`\r   [${elapsed}s] Status: ${status}${progressText}${filePath ? ' | File: ✅' : ' | File: ⏳'}`);

      if (status === 'completed' && filePath) {
        console.log('\n\n✅ SUCCESS! Video completed and downloaded.');
        console.log(`\n📁 File saved at: ${filePath}`);
        console.log(`🌐 View at: ${BASE}/api/sora/videos/${encodeURIComponent(jobId)}/file`);
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('✅ Video creation complete!');
        console.log('═══════════════════════════════════════════════════════════\n');
        return;
      }

      if (status === 'failed' || status === 'cancelled') {
        console.log(`\n\n❌ Video generation ${status}`);
        console.log('Response:', JSON.stringify(statusResp.data, null, 2));
        process.exit(1);
      }

      if (Date.now() - started > maxWaitMs) {
        console.log(`\n\n⏱️  Timeout after ${Math.round(maxWaitMs / 1000)}s`);
        console.log('Last status:', JSON.stringify(statusResp.data, null, 2));
        console.log('\n💡 Video may still be processing. Check status manually:');
        console.log(`   GET ${BASE}/api/sora/videos/${encodeURIComponent(jobId)}`);
        process.exit(1);
      }

      await new Promise((r) => setTimeout(r, pollMs));
    }
  } catch (e: any) {
    console.error('\n❌ Error:', e?.response?.data || e?.message || e);
    if (e?.response?.status) {
      console.error(`   HTTP ${e.response.status}`);
    }
    process.exit(1);
  }
}

main();
