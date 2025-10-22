import fs from 'fs';
import path from 'path';
import axios from 'axios';

function fileToInlineData(p?: string): { mimeType: string; data: string } | undefined {
  if (!p) return undefined;
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) return undefined;
  const buf = fs.readFileSync(abs);
  // Heuristic MIME
  const mime = abs.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  return { mimeType: mime, data: buf.toString('base64') };
}

export interface GeminiGenerationInput {
  prompt: string;
  sourceImagePath?: string;
  brandImagePath?: string;
  aspectRatio?: string; // e.g., "1:1", "16:9"
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function parseRetryAfter(h?: string): number | undefined {
  if (!h) return undefined;
  const s = Number(h);
  if (!isNaN(s) && s >= 0) return s * 1000;
  const d = Date.parse(h);
  if (!isNaN(d)) return Math.max(0, d - Date.now());
  return undefined;
}

export async function generateImageWithGemini(input: GeminiGenerationInput): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

  const parts: any[] = [{ text: input.prompt }];
  const src = fileToInlineData(input.sourceImagePath);
  if (src) parts.push({ inlineData: src });
  const brand = fileToInlineData(input.brandImagePath);
  if (brand) parts.push({ inlineData: brand });

  const body: any = { contents: [{ parts }] };
  if (input.aspectRatio) {
    body.generationConfig = { imageConfig: { aspectRatio: input.aspectRatio } };
  }

  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await axios.post(url, body, {
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        timeout: 120000
      });
      const candidates = resp.data?.candidates || [];
      for (const cand of candidates) {
        const partsOut = cand?.content?.parts || [];
        for (const p of partsOut) {
          const inline = p.inlineData || p.inline_data;
          if (inline?.data) {
            return Buffer.from(inline.data, 'base64');
          }
        }
      }
      throw new Error('No image data returned from Gemini');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429 || (status >= 500 && status <= 599)) {
        const ra = parseRetryAfter(err?.response?.headers?.['retry-after']);
        const backoff = ra !== undefined ? ra : Math.min(60000, 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500));
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Gemini generation failed after retries');
}


