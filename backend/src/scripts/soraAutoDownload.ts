/* eslint-disable no-console */
import axios from 'axios';
import { soraListVideos } from '../services/soraVideo';

/**
 * Auto-download all completed, non-expired videos that don't have MP4s yet.
 * Useful for recovering from server restarts or missed auto-downloads.
 * 
 * Usage: ts-node src/scripts/soraAutoDownload.ts
 */

const BASE = process.env.BACKEND_URL || 'http://localhost:3001';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Sora Auto-Download Recovery');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Get all videos from OpenAI
    console.log('[Step 1] Fetching video list from OpenAI...');
    const videos = await soraListVideos({ limit: 100, order: 'desc' });
    
    const now = Date.now();
    const eligible = videos.data.filter((video) => {
      if (video.status !== 'completed') return false;
      if (!video.expires_at) return true; // No expiry info, assume valid
      return now < video.expires_at * 1000; // Not expired
    });

    console.log(`   Found ${videos.data.length} total videos`);
    console.log(`   ${eligible.length} eligible (completed + not expired)\n`);

    if (eligible.length === 0) {
      console.log('✅ No eligible videos to download.');
      return;
    }

    console.log('[Step 2] Checking which need downloads...\n');

    let downloaded = 0;
    let failed = 0;
    let alreadyExists = 0;

    for (const video of eligible) {
      const jobId = video.id;
      
      try {
        // Check current status (includes file presence)
        const statusResp = await axios.get(
          `${BASE}/api/sora/videos/${encodeURIComponent(jobId)}`,
          { timeout: 30_000 }
        );

        const hasFile = statusResp.data?.files?.video_mp4;
        if (hasFile) {
          console.log(`✅ ${jobId}: Already downloaded`);
          alreadyExists++;
          continue;
        }

        // Trigger download
        console.log(`⬇️  ${jobId}: Downloading...`);
        const downloadResp = await axios.post(
          `${BASE}/api/sora/videos/${encodeURIComponent(jobId)}/download`,
          {},
          { timeout: 600_000 } // 10 minutes
        );

        if (downloadResp.data?.filePath) {
          console.log(`   ✅ Saved: ${downloadResp.data.filePath}`);
          downloaded++;
        } else {
          console.log(`   ⚠️  Download reported success but no file path`);
          failed++;
        }
      } catch (e: any) {
        const msg = e?.response?.data?.error || e?.message || 'unknown error';
        console.log(`   ❌ Failed: ${msg}`);
        failed++;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Summary:');
    console.log(`   Already downloaded: ${alreadyExists}`);
    console.log(`   Newly downloaded: ${downloaded}`);
    console.log(`   Failed: ${failed}`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (e: any) {
    console.error('❌ Error:', e?.response?.data || e?.message || e);
    process.exit(1);
  }
}

main();
