import fs from 'fs';
import path from 'path';

// Extract unique page IDs from discovery run directories
// Looks in runs/*/ads.csv files for page_id column
export function getPageIdsFromDiscoveryRuns(runDir?: string): string[] {
  const runsBase = path.resolve(process.cwd(), 'runs');
  if (!fs.existsSync(runsBase)) {
    return [];
  }

  const pageIds = new Set<string>();

  if (runDir) {
    // Specific run directory
    const fullPath = path.isAbsolute(runDir) 
      ? runDir 
      : path.resolve(runsBase, runDir);
    
    if (fs.existsSync(fullPath)) {
      extractPageIdsFromRun(fullPath, pageIds);
    }
  } else {
    // All run directories
    const dirs = fs.readdirSync(runsBase, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(runsBase, d.name));

    for (const dir of dirs) {
      extractPageIdsFromRun(dir, pageIds);
    }
  }

  return Array.from(pageIds).sort();
}

function extractPageIdsFromRun(runDir: string, pageIds: Set<string>): void {
  const adsCsv = path.join(runDir, 'ads.csv');
  if (!fs.existsSync(adsCsv)) {
    return;
  }

  try {
    const content = fs.readFileSync(adsCsv, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length === 0) return;

    // Parse header to find page_id column
    const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const pageIdIdx = header.indexOf('page_id');
    
    if (pageIdIdx === -1) return;

    // Extract page IDs from rows
    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i]);
      const pageId = (row[pageIdIdx] || '').trim().replace(/^"|"$/g, '');
      if (pageId) {
        pageIds.add(pageId);
      }
    }
  } catch (error: any) {
    console.warn(`[discoveryPageIndex] Error reading ${adsCsv}:`, error.message);
  }
}

function parseCsvLine(line: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (c === ',' && !inQ) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

// Get list of available discovery runs
export function listDiscoveryRuns(): Array<{ name: string; path: string; pageCount: number }> {
  const runsBase = path.resolve(process.cwd(), 'runs');
  if (!fs.existsSync(runsBase)) {
    return [];
  }

  const runs: Array<{ name: string; path: string; pageCount: number }> = [];

  const dirs = fs.readdirSync(runsBase, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => ({ name: d.name, path: path.join(runsBase, d.name) }));

  for (const dir of dirs) {
    const pageIds = new Set<string>();
    extractPageIdsFromRun(dir.path, pageIds);
    if (pageIds.size > 0) {
      runs.push({
        name: dir.name,
        path: dir.path,
        pageCount: pageIds.size
      });
    }
  }

  return runs.sort((a, b) => b.pageCount - a.pageCount);
}

