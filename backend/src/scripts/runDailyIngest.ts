import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function isoYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function main() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  const start = process.env.DAY_START_DATE || isoYmd(yesterday);
  const end = process.env.DAY_END_DATE || start;
  const levels = process.env.DAY_LEVELS || 'adset,campaign';

  const args = ['src/scripts/ingestDay.ts', `--start=${start}`, `--end=${end}`, `--levels=${levels}`];
  const { stdout, stderr } = await execFileAsync('ts-node', args, { cwd: process.cwd(), timeout: 30 * 60_000 });
  // eslint-disable-next-line no-console
  console.log(stdout);
  if (stderr) console.error(stderr);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


