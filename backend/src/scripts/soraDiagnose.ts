/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { soraJobDir, soraOutputBaseDir } from '../services/soraVideo';

/**
 * Diagnose Sora download issues - check all jobs and identify bottlenecks.
 * 
 * Usage: ts-node src/scripts/soraDiagnose.ts
 */

function checkJob(jobId: string): {
  jobId: string;
  hasDir: boolean;
  hasStatusJson: boolean;
  hasJobJson: boolean;
  status: string | null;
  isCompleted: boolean;
  hasVideoMp4: boolean;
  hasAutoError: boolean;
  autoError: string | null;
  expiresAt: number | null;
  isExpired: boolean;
  expiresInMinutes: number | null;
} {
  const dir = soraJobDir(jobId);
  const statusPath = path.join(dir, 'status.json');
  const jobPath = path.join(dir, 'job.json');
  const videoPath = path.join(dir, 'video.mp4');
  const errorPath = path.join(dir, 'auto_download_error.txt');

  let status: string | null = null;
  let expiresAt: number | null = null;
  let autoError: string | null = null;

  if (fs.existsSync(statusPath)) {
    try {
      const statusData = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      status = statusData.status || null;
      expiresAt = statusData.expires_at || null;
    } catch {}
  }

  if (fs.existsSync(errorPath)) {
    try {
      autoError = fs.readFileSync(errorPath, 'utf8').trim();
    } catch {}
  }

  const now = Date.now();
  const isExpired = expiresAt ? now > expiresAt * 1000 : false;
  const expiresInMinutes = expiresAt
    ? Math.round((expiresAt * 1000 - now) / 1000 / 60)
    : null;

  return {
    jobId,
    hasDir: fs.existsSync(dir),
    hasStatusJson: fs.existsSync(statusPath),
    hasJobJson: fs.existsSync(jobPath),
    status,
    isCompleted: status === 'completed',
    hasVideoMp4: fs.existsSync(videoPath),
    hasAutoError: fs.existsSync(errorPath),
    autoError,
    expiresAt,
    isExpired,
    expiresInMinutes,
  };
}

function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Sora Download Diagnostics');
  console.log('═══════════════════════════════════════════════════════════\n');

  const baseDir = soraOutputBaseDir();
  console.log(`Output directory: ${baseDir}\n`);

  if (!fs.existsSync(baseDir)) {
    console.log('❌ Output directory does not exist. No jobs found.');
    return;
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const jobDirs = entries.filter((e) => e.isDirectory() && e.name.startsWith('video_')).map((e) => e.name);

  if (jobDirs.length === 0) {
    console.log('✅ Output directory exists but no job directories found.');
    return;
  }

  console.log(`Found ${jobDirs.length} job(s):\n`);

  const diagnostics = jobDirs.map(checkJob);

  // Summary
  const completed = diagnostics.filter((d) => d.isCompleted);
  const downloaded = diagnostics.filter((d) => d.hasVideoMp4);
  const expired = diagnostics.filter((d) => d.isExpired);
  const hasErrors = diagnostics.filter((d) => d.hasAutoError);

  console.log('📊 Summary:');
  console.log(`   Total jobs: ${jobDirs.length}`);
  console.log(`   Completed: ${completed.length}`);
  console.log(`   Downloaded: ${downloaded.length}`);
  console.log(`   Expired: ${expired.length}`);
  console.log(`   With errors: ${hasErrors.length}\n`);

  // Detailed breakdown
  console.log('📋 Job Details:\n');
  diagnostics.forEach((d) => {
    console.log(`Job: ${d.jobId}`);
    console.log(`   Status: ${d.status || 'unknown'}`);
    console.log(`   Directory: ${d.hasDir ? '✅' : '❌'}`);
    console.log(`   Status JSON: ${d.hasStatusJson ? '✅' : '❌'}`);
    console.log(`   Job JSON: ${d.hasJobJson ? '✅' : '❌'}`);
    console.log(`   Video MP4: ${d.hasVideoMp4 ? '✅' : '❌'}`);

    if (d.expiresAt) {
      const expiresDate = new Date(d.expiresAt * 1000).toISOString();
      console.log(`   Expires: ${expiresDate} ${d.isExpired ? '(EXPIRED)' : ''}`);
      if (!d.isExpired && d.expiresInMinutes !== null) {
        console.log(`   Expires in: ${d.expiresInMinutes} minutes`);
      }
    }

    if (d.hasAutoError) {
      console.log(`   ⚠️  Auto-download error:`);
      console.log(`      ${d.autoError?.split('\n').join('\n      ') || 'unknown'}`);
    }

    if (d.isCompleted && !d.hasVideoMp4 && !d.isExpired) {
      console.log(`   💡 Action: Run download manually:`);
      console.log(`      npm run sora:download -- ${d.jobId}`);
    }

    if (d.isExpired && !d.hasVideoMp4) {
      console.log(`   ⚠️  Video expired - must regenerate`);
    }

    console.log('');
  });

  // Bottleneck analysis
  console.log('🔍 Bottleneck Analysis:\n');

  const notDownloaded = completed.filter((d) => !d.hasVideoMp4);
  if (notDownloaded.length > 0) {
    console.log(`❌ ${notDownloaded.length} completed job(s) without MP4:`);
    notDownloaded.forEach((d) => {
      if (d.isExpired) {
        console.log(`   - ${d.jobId}: EXPIRED (regenerate needed)`);
      } else if (d.hasAutoError) {
        console.log(`   - ${d.jobId}: Auto-download failed (check error file)`);
      } else {
        console.log(`   - ${d.jobId}: Auto-download may not have run (server restart?)`);
      }
    });
    console.log('');
  }

  if (expired.length > 0) {
    console.log(`⏰ ${expired.length} expired job(s) (download URLs expired):`);
    expired.forEach((d) => {
      console.log(`   - ${d.jobId}`);
    });
    console.log('');
  }

  if (hasErrors.length > 0) {
    console.log(`⚠️  ${hasErrors.length} job(s) with auto-download errors:`);
    hasErrors.forEach((d) => {
      console.log(`   - ${d.jobId}: ${d.autoError?.split('\n')[0] || 'unknown error'}`);
    });
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
