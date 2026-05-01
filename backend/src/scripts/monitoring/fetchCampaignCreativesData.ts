#!/usr/bin/env ts-node

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { createStrategisApiClient } from '../../lib/strategistClient';

function getFlag(name: string): string | undefined {
  const key = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(key));
  if (!arg) return undefined;
  return arg.slice(key.length);
}

function getFlagBool(name: string, def: boolean = false): boolean {
  const v = (getFlag(name) ?? (def ? '1' : '0')).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function safeFilePart(s: string): string {
  return String(s || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

function collectAssetUrls(obj: any, out: Set<string>): void {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const it of obj) collectAssetUrls(it, out);
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      const key = String(k).toLowerCase();
      const looksLikeUrl = /^https?:\/\//i.test(v);
      const looksLikeAssetField =
        key.includes('image') || key.includes('thumbnail') || key.includes('video') || key.endsWith('_url') || key.endsWith('url');
      if (looksLikeUrl && looksLikeAssetField) out.add(v);
    } else if (typeof v === 'object') {
      collectAssetUrls(v, out);
    }
  }
}

async function downloadBinary(url: string, outPath: string): Promise<void> {
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000 });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, resp.data);
}

function extFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const base = u.pathname.split('/').pop() || '';
    const dot = base.lastIndexOf('.');
    if (dot >= 0 && dot < base.length - 1) {
      const ext = base.slice(dot + 1).toLowerCase();
      if (/^[a-z0-9]{1,5}$/.test(ext)) return `.${ext}`;
    }
  } catch {}
  return '';
}

async function main(): Promise<void> {
  const organization = getFlag('organization') || process.env.STRATEGIS_ORGANIZATION || 'Interlincx';
  const status = getFlag('status') || 'active';
  const baseUrl = getFlag('base-url') || process.env.STRATEGIS_STAGING_BASE_URL || 'https://staging-dot-strategis-273115.appspot.com';
  const outDir = getFlag('out') || path.join('.local', 'strategis', 'facebook', 'campaign-creatives-data');
  const downloadAssets = getFlagBool('download-assets', false);
  const authToken = getFlag('auth-token') || process.env.STRATEGIS_AUTH_TOKEN || process.env.STRATEGIST_AUTH_TOKEN;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runId = `${safeFilePart(organization)}__${safeFilePart(status)}__${timestamp}`;
  const runDir = path.resolve(outDir, runId);
  fs.mkdirSync(runDir, { recursive: true });

  const fullUrl = `${baseUrl.replace(/\/$/, '')}/api/facebook/campaign-creatives-data`;

  // If STRATEGIS_AUTH_TOKEN is provided, use it directly (no IX-ID login required).
  // Otherwise, fall back to our existing IX-ID → Bearer token flow.
  const data = authToken
    ? (
        await axios.get(fullUrl, {
          params: { organization, status },
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: 120000,
        })
      ).data
    : await createStrategisApiClient().get<any>(fullUrl, { organization, status });

  fs.writeFileSync(path.join(runDir, 'response.json'), JSON.stringify(data, null, 2));

  const assetUrls = new Set<string>();
  collectAssetUrls(data, assetUrls);
  fs.writeFileSync(path.join(runDir, 'assets_urls.json'), JSON.stringify(Array.from(assetUrls).sort(), null, 2));

  if (downloadAssets && assetUrls.size > 0) {
    const assetsDir = path.join(runDir, 'assets');
    let i = 0;
    for (const url of assetUrls) {
      i++;
      const ext = extFromUrl(url) || '.bin';
      const file = path.join(assetsDir, `${String(i).padStart(5, '0')}${ext}`);
      try {
        // eslint-disable-next-line no-await-in-loop
        await downloadBinary(url, file);
      } catch (e: any) {
        fs.appendFileSync(path.join(runDir, 'asset_download_errors.log'), `${url}\n${String(e?.message || e)}\n\n`);
      }
    }
  }

  console.log(`[campaign-creatives-data] Wrote ${path.join(runDir, 'response.json')}`);
  console.log(`[campaign-creatives-data] Found ${assetUrls.size} asset urls`);
  if (downloadAssets) console.log(`[campaign-creatives-data] Downloaded assets into ${path.join(runDir, 'assets')}`);
}

main().catch((err) => {
  console.error('Error:', err?.message || err);
  process.exit(1);
});

