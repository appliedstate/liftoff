import axios from 'axios';
import FormData from 'form-data';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(header?: string): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (!Number.isNaN(seconds) && seconds >= 0) return seconds * 1000;
  const absolute = Date.parse(header);
  if (!Number.isNaN(absolute)) return Math.max(0, absolute - Date.now());
  return undefined;
}

function summarizeError(err: any): string {
  const status = err?.response?.status;
  const statusText = err?.response?.statusText;
  const code = err?.code;
  const message = err?.message;
  const reqId = err?.response?.headers?.['x-request-id'] || err?.response?.headers?.['openai-request-id'];
  return `status=${status || ''} ${statusText || ''} code=${code || ''} msg=${message || ''} req=${reqId || ''}`.trim();
}

export async function transcribeBuffer(buf: Buffer, filename = 'audio.mp4'): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const maxAttempts = 6;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const form = new FormData();
      form.append('file', buf, { filename });
      form.append('model', 'whisper-1');
      const resp = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
        headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
        timeout: 120000,
      });
      return (resp.data?.text as string) || '';
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429 || (status >= 500 && status <= 599)) {
        const retryAfterMs = parseRetryAfter(err?.response?.headers?.['retry-after']);
        const backoff =
          retryAfterMs !== undefined
            ? retryAfterMs
            : Math.min(60000, 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500));
        await sleep(backoff);
        continue;
      }
      throw new Error(summarizeError(err));
    }
  }

  throw new Error('Transcription failed after retries');
}

export async function transcribeVideoUrl(videoUrl: string, filename = 'video.mp4'): Promise<string> {
  const resp = await axios.get(videoUrl, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'liftoff-transcriber/1.0',
    },
  });
  return transcribeBuffer(Buffer.from(resp.data), filename);
}
