import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function getArg(name: string, def?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return def;
}

function isoYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function main() {
  const start = getArg('start');
  const end = getArg('end');
  const levels = getArg('levels', process.env.DAY_LEVELS || 'adset,campaign')!;

  let startDate = start;
  let endDate = end;
  if (!startDate || !endDate) {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
    startDate = startDate || isoYmd(yesterday);
    endDate = endDate || startDate;
  }

  const args = ['src/scripts/ingestDay.ts', `--start=${startDate}`, `--end=${endDate}`, `--levels=${levels}`];
  const { stdout, stderr } = await execFileAsync('ts-node', args, { cwd: process.cwd(), timeout: 60 * 60_000 });
  // eslint-disable-next-line no-console
  console.log(stdout);
  if (stderr) console.error(stderr);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


