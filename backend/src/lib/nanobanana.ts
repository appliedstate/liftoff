import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

export interface BananaGenerationInput {
  prompt: string;
  sourceImagePath?: string;
  brandImagePath?: string;
  seed?: number;
}

export async function generateImageWithNanoBanana(input: BananaGenerationInput): Promise<Buffer> {
  const apiUrl = process.env.NANO_BANANA_URL;
  const apiKey = process.env.NANO_BANANA_API_KEY;
  if (!apiUrl || !apiKey) throw new Error('Missing NANO_BANANA_URL or NANO_BANANA_API_KEY');

  const form = new FormData();
  form.append('prompt', input.prompt);
  if (typeof input.seed === 'number') form.append('seed', String(input.seed));
  if (input.sourceImagePath && fs.existsSync(input.sourceImagePath)) {
    form.append('source_image', fs.createReadStream(path.resolve(input.sourceImagePath)));
  }
  if (input.brandImagePath && fs.existsSync(input.brandImagePath)) {
    form.append('brand_image', fs.createReadStream(path.resolve(input.brandImagePath)));
  }

  const resp = await axios.post(apiUrl, form, {
    headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
    responseType: 'arraybuffer',
    timeout: 120000
  });

  const ct = String(resp.headers['content-type'] || '');
  if (ct.startsWith('image/')) {
    return Buffer.from(resp.data);
  }

  try {
    const json = JSON.parse(Buffer.from(resp.data).toString('utf-8')) as any;
    if (json?.image_base64) return Buffer.from(json.image_base64, 'base64');
  } catch {}
  throw new Error('Unexpected Nano Banana response (no image content)');
}


