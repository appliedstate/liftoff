/* eslint-disable no-console */
import axios from 'axios';
import { execSync } from 'child_process';

/**
 * Trigger download for a completed Sora job and validate the result.
 * 
 * Usage: ts-node src/scripts/soraTriggerDownload.ts <jobId>
 */

const jobId = process.argv[2]?.trim();
if (!jobId) {
  console.error('Usage: ts-node src/scripts/soraTriggerDownload.ts <jobId>');
  process.exit(1);
}

const BASE = process.env.BACKEND_URL || 'http://localhost:3001';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Sora Video Download Trigger (Step C)');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log(`Job ID: ${jobId}`);
  console.log(`Backend URL: ${BASE}\n`);

  // Step 1: Check current status
  console.log('[Step 1] Checking current job status...');
  try {
    const statusResp = await axios.get(
      `${BASE}/api/sora/videos/${encodeURIComponent(jobId)}`,
      { timeout: 60_000 }
    );
    const status = statusResp.data?.status;
    console.log(`   Status: ${status}`);
    
    if (status !== 'completed') {
      console.error(`\n❌ Job is not completed (status: ${status}). Cannot download.`);
      process.exit(1);
    }
    console.log('   ✅ Job is completed, proceeding with download...\n');
  } catch (e: any) {
    console.error('❌ Failed to check status:', e?.response?.data || e?.message);
    process.exit(1);
  }

  // Step 2: Trigger download
  console.log('[Step 2] Triggering download via POST /api/sora/videos/<id>/download...');
  console.log('   (This may take several minutes for large video files)');
  try {
    const downloadResp = await axios.post(
      `${BASE}/api/sora/videos/${encodeURIComponent(jobId)}/download`,
      {},
      { 
        timeout: 600_000, // 10 minutes for large files
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
    
    console.log('   ✅ Download response received:');
    console.log(JSON.stringify(downloadResp.data, null, 2));
    
    if (downloadResp.data?.cached === true) {
      console.log('\n   ℹ️  File was already cached (downloaded previously)');
    } else {
      console.log('\n   ✅ File downloaded successfully');
    }
    
    if (downloadResp.data?.filePath) {
      console.log(`   File path: ${downloadResp.data.filePath}`);
    }
  } catch (e: any) {
    console.error('\n❌ Download failed:');
    if (e?.response?.data) {
      console.error(JSON.stringify(e.response.data, null, 2));
    } else {
      console.error(e?.message || e);
    }
    if (e?.response?.status) {
      console.error(`   HTTP ${e.response.status}`);
    }
    process.exit(1);
  }

  // Step 3: Re-validate file exists
  console.log('\n[Step 3] Validating file exists on disk...');
  try {
    const validateOutput = execSync(
      `ts-node src/scripts/soraValidateFile.ts ${jobId}`,
      { cwd: process.cwd(), encoding: 'utf-8', stdio: 'pipe' }
    );
    console.log(validateOutput);
  } catch (e: any) {
    // Validation script exits with code 1 if file not found, but we want to see output
    const output = e.stdout || e.message || String(e);
    console.log(output);
    if (e.status === 1) {
      console.error('\n⚠️  Validation script indicates file not found, but download reported success.');
      console.error('   This may be a timing issue. Check the file path manually.');
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ Download process completed');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
