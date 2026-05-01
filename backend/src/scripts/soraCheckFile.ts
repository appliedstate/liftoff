/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { soraJobDir } from '../services/soraVideo';

// Usage: ts-node src/scripts/soraCheckFile.ts <jobId>

const jobId = process.argv[2]?.trim();
if (!jobId) {
  console.error('Usage: ts-node src/scripts/soraCheckFile.ts <jobId>');
  process.exit(1);
}

const dir = soraJobDir(jobId);
const expectedVideoPath = path.join(dir, 'video.mp4');
const expectedVideoPathAlt = path.join(dir, 'video.mp4');

console.log(`\n[Validation] Checking for MP4 file for job: ${jobId}`);
console.log(`Job directory: ${dir}`);
console.log(`Expected video path: ${expectedVideoPath}`);

// Check if directory exists
if (!fs.existsSync(dir)) {
  console.log(`❌ Directory does not exist: ${dir}`);
  process.exit(1);
}

console.log(`✅ Directory exists: ${dir}`);

// List all files in directory
const files = fs.readdirSync(dir);
console.log(`\nFiles in directory (${files.length} total):`);
files.forEach((f) => {
  const fullPath = path.join(dir, f);
  const stat = fs.statSync(fullPath);
  const size = stat.isFile() ? `${(stat.size / 1024).toFixed(2)} KB` : 'DIR';
  console.log(`  - ${f} (${stat.isFile() ? 'file' : 'dir'}, ${size})`);
});

// Check for video.mp4 specifically
if (fs.existsSync(expectedVideoPath)) {
  const stat = fs.statSync(expectedVideoPath);
  console.log(`\n✅ MP4 FILE EXISTS: ${expectedVideoPath}`);
  console.log(`   Size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Modified: ${stat.mtime.toISOString()}`);
} else {
  console.log(`\n❌ MP4 FILE NOT FOUND: ${expectedVideoPath}`);
  
  // Check for any .mp4 files
  const mp4Files = files.filter((f) => f.toLowerCase().endsWith('.mp4'));
  if (mp4Files.length > 0) {
    console.log(`\n⚠️  Found other .mp4 files:`);
    mp4Files.forEach((f) => {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      console.log(`   - ${f} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
    });
  } else {
    console.log(`   No .mp4 files found in directory.`);
  }
}
