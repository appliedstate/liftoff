/* eslint-disable no-console */
import axios from 'axios';

// Usage: ts-node src/scripts/soraDebugDownload.ts <jobId>

const jobId = process.argv[2]?.trim();
if (!jobId) {
  console.error('Usage: ts-node src/scripts/soraDebugDownload.ts <jobId>');
  process.exit(1);
}

const BASE = process.env.BACKEND_URL || 'http://localhost:3001';

async function main() {
  console.log(`[Step C] Triggering download for job: ${jobId}`);
  
  try {
    const resp = await axios.post(
      `${BASE}/api/sora/videos/${encodeURIComponent(jobId)}/download`,
      {},
      { timeout: 300_000 }
    );
    
    console.log('✅ Download response:');
    console.log(JSON.stringify(resp.data, null, 2));
    
    console.log('\n[Step D] Checking status after download...');
    const statusResp = await axios.get(
      `${BASE}/api/sora/videos/${encodeURIComponent(jobId)}`,
      { timeout: 60_000 }
    );
    
    console.log('✅ Status response:');
    console.log(JSON.stringify(statusResp.data, null, 2));
    
    const filePath = statusResp.data?.files?.video_mp4;
    if (filePath) {
      console.log(`\n✅ SUCCESS: MP4 saved at: ${filePath}`);
      console.log(`   View at: ${BASE}/api/sora/videos/${encodeURIComponent(jobId)}/file`);
    } else {
      console.log('\n❌ WARNING: No video_mp4 path in status response');
    }
  } catch (e: any) {
    console.error('❌ Error:', e?.response?.data || e?.message || e);
    if (e?.response?.status) {
      console.error(`   HTTP ${e.response.status}`);
    }
    process.exit(1);
  }
}

main();
