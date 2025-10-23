import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { chromium } from 'playwright';
import readline from 'readline';

dotenv.config();
if (!process.env.STORAGE_STATE_PATH) {
  dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
}

function readEnv() {
  const loginUrl = process.env.LOGIN_URL || process.env.REPORT_URL || process.env.REPORT_URL_TEMPLATE || '';
  if (!loginUrl) throw new Error('Set LOGIN_URL or REPORT_URL (or REPORT_URL_TEMPLATE) to open the site.');
  const storagePath = process.env.STORAGE_STATE_PATH || path.resolve(process.cwd(), '.auth/storage-state.json');
  const headless = (process.env.HEADLESS ?? 'false').toLowerCase() === 'true' ? true : false; // default headful for this helper
  return { loginUrl, storagePath, headless };
}

async function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

function waitForEnter(promptMsg: string): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(promptMsg, () => {
      rl.close();
      resolve();
    });
  });
}

async function run() {
  const { loginUrl, storagePath, headless } = readEnv();
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the site so the user can log in manually (MFA-friendly)
  await page.goto(String(loginUrl), { waitUntil: 'domcontentloaded' });

  // eslint-disable-next-line no-console
  console.log('\nA Chromium window has opened. Please log in completely (including MFA).');
  // eslint-disable-next-line no-console
  console.log('When the report page shows data, return here and press Enter to save auth.');
  await waitForEnter('Press Enter here to save and exit... ');

  await ensureDir(storagePath);
  await context.storageState({ path: storagePath });
  // eslint-disable-next-line no-console
  console.log(`\nSaved storage state to: ${storagePath}`);

  await browser.close();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


