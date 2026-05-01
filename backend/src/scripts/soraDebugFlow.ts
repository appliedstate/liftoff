/* eslint-disable no-console */
import axios from 'axios';

/**
 * Debug the complete Sora flow: create → poll → download
 * This script tests each step individually to identify bottlenecks.
 * 
 * Usage: ts-node src/scripts/soraDebugFlow.ts
 */

const BASE = process.env.BACKEND_URL || 'http://localhost:3001';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not set');
  process.exit(1);
}

async function checkOpenAiDirect(jobId: string) {
  console.log(`\n[Direct OpenAI Check] Fetching status directly from OpenAI...`);
  try {
    const resp = await axios.get(
      `https://api.openai.com/v1/videos/${encodeURIComponent(jobId)}`,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        timeout: 30_000,
      }
    );
    console.log('✅ OpenAI response:');
    console.log(JSON.stringify(resp.data, null, 2));
    return resp.data;
  } catch (e: any) {
    console.error('❌ OpenAI direct check failed:');
    console.error('   Status:', e?.response?.status);
    console.error('   Error:', e?.response?.data || e?.message);
    return null;
  }
}

async function checkBackendStatus(jobId: string) {
  console.log(`\n[Backend Check] Fetching status via our backend...`);
  try {
    const resp = await axios.get(
      `${BASE}/api/sora/videos/${encodeURIComponent(jobId)}`,
      { timeout: 30_000 }
    );
    console.log('✅ Backend response:');
    console.log(JSON.stringify(resp.data, null, 2));
    return resp.data;
  } catch (e: any) {
    console.error('❌ Backend check failed:');
    console.error('   Status:', e?.response?.status);
    console.error('   Error:', e?.response?.data || e?.message);
    return null;
  }
}

async function testCreate() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Step A: Test Video Creation');
  console.log('═══════════════════════════════════════════════════════════\n');

  const testPrompt = 'A simple test: a red ball bouncing on a white background, 2 seconds';

  console.log('Prompt:', testPrompt);
  console.log('Creating via backend...\n');

  try {
    const resp = await axios.post(
      `${BASE}/api/sora/videos`,
      {
        prompt: testPrompt,
        model: 'sora-2',
        seconds: 4,
        size: '720x1280',
        autoDownload: false, // Disable auto-download for testing
      },
      { timeout: 60_000 }
    );

    console.log('✅ Create response:');
    console.log(JSON.stringify(resp.data, null, 2));

    const jobId = resp.data?.jobId;
    if (!jobId) {
      throw new Error('No jobId in response');
    }

    return jobId;
  } catch (e: any) {
    console.error('❌ Create failed:');
    console.error('   Status:', e?.response?.status);
    console.error('   Error:', e?.response?.data || e?.message);
    return null;
  }
}

async function testPoll(jobId: string) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Step B: Test Status Polling');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Polling job: ${jobId}`);
  console.log('(Will check both OpenAI directly and via our backend)\n');

  // Check OpenAI directly
  const openAiStatus = await checkOpenAiDirect(jobId);
  
  // Check via backend
  const backendStatus = await checkBackendStatus(jobId);

  // Compare
  console.log('\n[Comparison]');
  if (openAiStatus && backendStatus) {
    const openAiStatusValue = openAiStatus.status;
    const backendStatusValue = backendStatus.status;
    
    if (openAiStatusValue === backendStatusValue) {
      console.log(`✅ Status matches: ${openAiStatusValue}`);
    } else {
      console.log(`⚠️  Status mismatch:`);
      console.log(`   OpenAI: ${openAiStatusValue}`);
      console.log(`   Backend: ${backendStatusValue}`);
    }

    if (openAiStatus.progress !== undefined) {
      console.log(`   Progress: ${openAiStatus.progress}%`);
    }
  }

  return { openAiStatus, backendStatus };
}

async function testDownload(jobId: string) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Step C: Test Download');
  console.log('═══════════════════════════════════════════════════════════\n');

  // First verify it's completed
  const openAiStatus = await checkOpenAiDirect(jobId);
  if (!openAiStatus || openAiStatus.status !== 'completed') {
    console.log(`⚠️  Job not completed (status: ${openAiStatus?.status || 'unknown'}). Skipping download test.`);
    return false;
  }

  // Check expiration
  if (openAiStatus.expires_at) {
    const expiresMs = openAiStatus.expires_at * 1000;
    const nowMs = Date.now();
    if (nowMs > expiresMs) {
      console.log(`❌ Video expired at ${new Date(expiresMs).toISOString()}`);
      return false;
    }
    const minutesLeft = Math.round((expiresMs - nowMs) / 1000 / 60);
    console.log(`✅ Video expires in ${minutesLeft} minutes`);
  }

  console.log('\nTriggering download via backend...');
  try {
    const resp = await axios.post(
      `${BASE}/api/sora/videos/${encodeURIComponent(jobId)}/download`,
      {},
      { timeout: 600_000 } // 10 minutes
    );

    console.log('✅ Download response:');
    console.log(JSON.stringify(resp.data, null, 2));

    if (resp.data?.filePath) {
      console.log(`\n✅ SUCCESS! File saved at: ${resp.data.filePath}`);
      return true;
    }

    return false;
  } catch (e: any) {
    console.error('❌ Download failed:');
    console.error('   Status:', e?.response?.status);
    console.error('   Error:', e?.response?.data || e?.message);
    if (e?.code) console.error('   Code:', e.code);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Sora Flow Debugger');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Backend: ${BASE}`);
  console.log(`OpenAI API Key: ${OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);

  // Test with existing HVAC job first
  const existingJobId = 'video_69714e9fa1b481908c34d00b578ac87d012f1a35f8ab038a';
  
  console.log('\n🔍 Checking existing HVAC job first...');
  const status = await testPoll(existingJobId);

  if (status?.openAiStatus?.status === 'completed') {
    console.log('\n✅ Existing job is completed! Testing download...');
    await testDownload(existingJobId);
  } else {
    console.log(`\n⏳ Existing job status: ${status?.openAiStatus?.status || 'unknown'}`);
    console.log('   (Will create a new test job to verify full flow)\n');
    
    // Create a new test job
    const newJobId = await testCreate();
    if (newJobId) {
      console.log('\n⏳ Waiting 5 seconds, then checking status...');
      await new Promise((r) => setTimeout(r, 5000));
      await testPoll(newJobId);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Debug complete');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
