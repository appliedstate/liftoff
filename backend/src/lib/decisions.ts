import fs from 'fs';
import path from 'path';

export type Decision = {
  decision_id: string;
  id: string;
  level: 'adset' | 'campaign';
  account_id: string | null;
  action: 'bump_budget' | 'trim_budget' | 'hold';
  budget_multiplier: number | null;
  bid_cap_multiplier: number | null;
  spend_delta_usd?: number | null;
  reason: string;
  policy_version?: string;
  confidence?: number | null;
  date: string;
  snapshot_dir: string;
  created_at: string;
};

export function defaultDecisionsBase(): string {
  return process.env.DECISIONS_BASE || path.join(process.cwd(), 'data', 'decisions');
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeJsonl(filePath: string, rows: Record<string, any>[]): void {
  const lines = rows.map((r) => JSON.stringify(r));
  fs.writeFileSync(filePath, lines.join('\n'));
}

export function writeCsv(filePath: string, header: string[], rows: Record<string, any>[]): void {
  const escape = (v: any): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines: string[] = [];
  lines.push(header.join(','));
  for (const r of rows) lines.push(header.map((k) => escape(r[k])).join(','));
  fs.writeFileSync(filePath, lines.join('\n'));
}

export function writeDecisionBatch(date: string, data: Decision[], summary: string) {
  const base = defaultDecisionsBase();
  const dayDir = path.join(base, date);
  ensureDir(dayDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const jsonlPath = path.join(dayDir, `decisions_${ts}.jsonl`);
  const csvPath = path.join(dayDir, `decisions_${ts}.csv`);
  const summaryPath = path.join(dayDir, `summary_${ts}.txt`);

  writeJsonl(jsonlPath, data);
  writeCsv(
    csvPath,
    ['decision_id','id','level','account_id','action','budget_multiplier','bid_cap_multiplier','spend_delta_usd','reason','policy_version','confidence','date','snapshot_dir','created_at'],
    data as any[],
  );
  fs.writeFileSync(summaryPath, summary);
  return { jsonlPath, csvPath, summaryPath };
}


