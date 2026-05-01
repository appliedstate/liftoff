/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { soraJobDir } from '../services/soraVideo';

/**
 * Validation script to check if MP4 file exists for a Sora job.
 * 
 * Usage: ts-node src/scripts/soraValidateFile.ts <jobId>
 * 
 * Expected file location per our implementation:
 *   backend/generated/sora/<jobId>/video.mp4
 * 
 * This matches OpenAI API spec:
 *   GET /videos/{video_id}/content?variant=video
 *   (downloads MP4, saved as video.mp4 in job directory)
 */

const jobId = process.argv[2]?.trim();
if (!jobId) {
  console.error('Usage: ts-node src/scripts/soraValidateFile.ts <jobId>');
  console.error('\nExample:');
  console.error('  ts-node src/scripts/soraValidateFile.ts video_696ec7ed063881989e9fd222177617ee00e2336e88f0a0d6');
  process.exit(1);
}

const dir = soraJobDir(jobId);
const expectedVideoPath = path.join(dir, 'video.mp4');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('Sora Video File Validation');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`Job ID: ${jobId}`);
console.log(`Job Directory: ${dir}`);
console.log(`Expected MP4 Path: ${expectedVideoPath}\n`);

// Step 1: Check if directory exists
if (!fs.existsSync(dir)) {
  console.log('❌ STEP 1: Directory does not exist');
  console.log(`   Path: ${dir}`);
  console.log('\n💡 This means the job was never created or directory was deleted.');
  process.exit(1);
}
console.log('✅ STEP 1: Directory exists');

// Step 2: List all files in directory
const files = fs.readdirSync(dir);
console.log(`\n✅ STEP 2: Found ${files.length} file(s) in directory:`);
if (files.length === 0) {
  console.log('   (directory is empty)');
} else {
  files.forEach((f) => {
    const fullPath = path.join(dir, f);
    try {
      const stat = fs.statSync(fullPath);
      const size = stat.isFile() 
        ? `${(stat.size / 1024).toFixed(2)} KB` 
        : 'DIR';
      const type = stat.isFile() ? 'file' : 'dir';
      console.log(`   - ${f} (${type}, ${size})`);
    } catch (e) {
      console.log(`   - ${f} (error reading)`);
    }
  });
}

// Step 3: Check for video.mp4 specifically
console.log(`\n🔍 STEP 3: Checking for video.mp4...`);
if (fs.existsSync(expectedVideoPath)) {
  const stat = fs.statSync(expectedVideoPath);
  const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
  const sizeKB = (stat.size / 1024).toFixed(2);
  
  console.log('✅ STEP 3: MP4 FILE EXISTS!');
  console.log(`   Full Path: ${expectedVideoPath}`);
  console.log(`   Size: ${sizeMB} MB (${sizeKB} KB)`);
  console.log(`   Modified: ${stat.mtime.toISOString()}`);
  console.log(`   Created: ${stat.birthtime.toISOString()}`);
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ VALIDATION PASSED: Video file is ready');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('📁 File Details:');
  console.log(`   Filename: video.mp4`);
  console.log(`   Location: ${expectedVideoPath}`);
  console.log(`   Size: ${sizeMB} MB`);
  
  console.log('\n🌐 Access URLs (if backend running on localhost:3001):');
  console.log(`   Status: http://localhost:3001/api/sora/videos/${encodeURIComponent(jobId)}`);
  console.log(`   Download: http://localhost:3001/api/sora/videos/${encodeURIComponent(jobId)}/download`);
  console.log(`   File: http://localhost:3001/api/sora/videos/${encodeURIComponent(jobId)}/file`);
  
} else {
  console.log('❌ STEP 3: MP4 FILE NOT FOUND');
  console.log(`   Expected: ${expectedVideoPath}`);
  
  // Check for any .mp4 files with different names
  const mp4Files = files.filter((f) => f.toLowerCase().endsWith('.mp4'));
  if (mp4Files.length > 0) {
    console.log(`\n⚠️  Found ${mp4Files.length} other .mp4 file(s):`);
    mp4Files.forEach((f) => {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      console.log(`   - ${f} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
    });
    console.log('\n💡 These files exist but are not named "video.mp4"');
  } else {
    console.log('\n💡 No .mp4 files found in directory.');
    console.log('   This means the download step (Step C) has not completed yet.');
    console.log('   Run: POST /api/sora/videos/<jobId>/download to trigger download.');
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('❌ VALIDATION FAILED: Video file not found');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Check job.json to see status
  const jobJsonPath = path.join(dir, 'job.json');
  if (fs.existsSync(jobJsonPath)) {
    try {
      const jobData = JSON.parse(fs.readFileSync(jobJsonPath, 'utf8'));
      console.log('📋 Job Status (from job.json):');
      console.log(`   Status: ${jobData.status || 'unknown'}`);
      console.log(`   Model: ${jobData.model || 'unknown'}`);
      console.log(`   Files tracked: ${Object.keys(jobData.files || {}).length}`);
      if (jobData.files && Object.keys(jobData.files).length > 0) {
        console.log(`   File paths in job.json:`);
        Object.entries(jobData.files).forEach(([key, value]) => {
          console.log(`     - ${key}: ${value}`);
        });
      }
    } catch (e) {
      console.log('   (Could not read job.json)');
    }
  }
  
  process.exit(1);
}
