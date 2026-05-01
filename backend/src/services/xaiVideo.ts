import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Readable } from 'stream';
import type { AxiosInstance } from 'axios';

export type XaiVideoAspectRatio = '16:9' | '4:3' | '1:1' | '9:16' | '3:4' | '3:2' | '2:3';
export type XaiVideoResolution = '720p' | '480p';

export type XaiCreateInput = {
  prompt: string;
  model?: string; // e.g. "grok-imagine-video"
  duration?: number; // 1..15 (generations only)
  aspect_ratio?: XaiVideoAspectRatio;
  resolution?: XaiVideoResolution;
  image_url?: string; // optional: image-to-video
  video_url?: string; // optional: edit existing video (forces /videos/edits)
};

export type XaiJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'unknown';

export type XaiJobRecord = {
  id: string; // request_id
  created_at: string;
  prompt: string;
  model: string;
  duration?: number;
  aspect_ratio?: XaiVideoAspectRatio;
  resolution?: XaiVideoResolution;
  status: XaiJobStatus;
  raw?: any;
  result?: {
    url?: string;
  };
  files?: {
    video_mp4?: string;
  };
};

type XaiErrorPayload = {
  message?: string;
  type?: string;
  param?: string | null;
  code?: string | null;
};

type XaiFailureDetails = {
  status?: number;
  request_id?: string;
  error?: XaiErrorPayload;
};

function requireXaiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error('Missing XAI_API_KEY');
  return key;
}

export function xaiOutputBaseDir(): string {
  // Default to backend/generated/xai
  const configured = process.env.XAI_VIDEO_OUTPUT_DIR;
  if (configured && configured.trim()) return path.resolve(process.cwd(), configured.trim());
  return path.resolve(process.cwd(), 'generated', 'xai');
}

export function xaiJobDir(requestId: string): string {
  const safe = String(requestId).replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(xaiOutputBaseDir(), safe);
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: any) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function readJsonIfExists(filePath: string): any | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function toXaiFailure(e: any): XaiFailureDetails {
  const status = e?.response?.status;
  const request_id = e?.response?.headers?.['x-request-id'];
  const err = e?.response?.data?.error;
  return {
    status: typeof status === 'number' ? status : undefined,
    request_id: typeof request_id === 'string' ? request_id : undefined,
    error:
      err && typeof err === 'object'
        ? {
            message: typeof err.message === 'string' ? err.message : undefined,
            type: typeof err.type === 'string' ? err.type : undefined,
            param: typeof err.param === 'string' || err.param === null ? err.param : undefined,
            code: typeof err.code === 'string' || err.code === null ? err.code : undefined,
          }
        : undefined,
  };
}

function throwXaiError(prefix: string, e: any): never {
  const failure = toXaiFailure(e);
  const msg = failure.error?.message || e?.message || 'xAI request failed';
  const err: any = new Error(`${prefix}${failure.status ? ` (${failure.status})` : ''}: ${msg}`);
  err.xai = failure;
  throw err;
}

function xaiAxios(): AxiosInstance {
  const apiKey = requireXaiKey();
  return axios.create({
    baseURL: 'https://api.x.ai/v1',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 60_000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
}

function extractVideoUrl(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null;

  const directCandidates = [
    payload.url,
    payload.video_url,
    payload.videoUrl,
    payload.result?.url,
    payload.video?.url,
    payload.output?.url,
  ];
  for (const v of directCandidates) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }

  const arrCandidates: any[] = [
    payload.video_result,
    payload.videoResult,
    payload.results,
    payload.data,
  ];
  for (const arr of arrCandidates) {
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const first = arr[0];
    const maybe = first?.url || first?.video_url || first?.videoUrl || first?.video?.url;
    if (typeof maybe === 'string' && maybe.trim()) return maybe.trim();
  }

  return null;
}

function normalizeStatus(rawStatus: any, videoUrl?: string | null, rawPayload?: any): XaiJobStatus {
  if (videoUrl) return 'completed';
  if (rawPayload?.error) return 'failed';

  const s = String(rawStatus || '').toLowerCase();
  if (!s) return 'unknown';
  if (s === 'queued' || s === 'pending') return 'queued';
  if (s === 'running' || s === 'processing' || s === 'in_progress') return 'running';
  if (s === 'completed' || s === 'succeeded' || s === 'done' || s === 'success') return 'completed';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  return 'unknown';
}

function verifyMp4File(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(12);
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);
    return buffer.toString('ascii', 4, 8) === 'ftyp';
  } catch {
    return false;
  }
}

async function streamToFileAtomic(
  stream: Readable,
  finalPath: string
): Promise<{ bytesWritten: number; fileSize: number }> {
  const tempPath = finalPath + '.tmp';
  ensureDir(path.dirname(finalPath));
  let bytesWritten = 0;

  return new Promise<{ bytesWritten: number; fileSize: number }>((resolve, reject) => {
    const out = fs.createWriteStream(tempPath);

    stream.on('data', (chunk: Buffer) => {
      bytesWritten += chunk.length;
    });

    stream.pipe(out);

    out.on('finish', () => {
      try {
        const stats = fs.statSync(tempPath);
        const fileSize = stats.size;
        if (fileSize === 0) {
          fs.unlinkSync(tempPath);
          reject(new Error('Downloaded file is empty (0 bytes)'));
          return;
        }
        fs.renameSync(tempPath, finalPath);
        resolve({ bytesWritten, fileSize });
      } catch (e: any) {
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {}
        reject(new Error(`Failed to finalize file: ${e?.message || e}`));
      }
    });

    out.on('error', (err) => {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {}
      reject(err);
    });

    stream.on('error', (err) => {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {}
      reject(err);
    });
  });
}

export async function xaiCreateJob(input: XaiCreateInput): Promise<XaiJobRecord> {
  const prompt = String(input.prompt || '').trim();
  if (!prompt) throw new Error('prompt is required');

  const model = String(input.model || process.env.XAI_VIDEO_MODEL || 'grok-imagine-video').trim();
  const duration = typeof input.duration === 'number' ? input.duration : undefined;
  const aspect_ratio = input.aspect_ratio;
  const resolution = input.resolution;
  const image_url = typeof input.image_url === 'string' && input.image_url.trim() ? input.image_url.trim() : undefined;
  const video_url = typeof input.video_url === 'string' && input.video_url.trim() ? input.video_url.trim() : undefined;

  const client = xaiAxios();
  const endpoint = video_url ? '/videos/edits' : '/videos/generations';

  const body: any = { prompt, model };
  if (!video_url && typeof duration === 'number') body.duration = duration;
  if (typeof aspect_ratio === 'string') body.aspect_ratio = aspect_ratio;
  if (typeof resolution === 'string') body.resolution = resolution;
  if (image_url) body.image = { url: image_url };
  if (video_url) body.video = { url: video_url };

  let resp: any;
  try {
    resp = await client.post(endpoint, body);
  } catch (e: any) {
    throwXaiError(`xAI ${endpoint} create failed`, e);
  }

  const request_id = String(resp.data?.request_id || '');
  if (!request_id) {
    throw new Error(
      `xAI ${endpoint} did not return request_id. Response keys: ${Object.keys(resp.data || {}).join(', ')}`
    );
  }

  const dir = xaiJobDir(request_id);
  ensureDir(dir);
  writeJson(path.join(dir, 'request.json'), {
    input: { prompt, model, duration, aspect_ratio, resolution, image_url, video_url },
    created_at: new Date().toISOString(),
    endpoint,
  });

  // Create response is minimal ({request_id}), but persist anyway for provenance.
  writeJson(path.join(dir, 'status.json'), resp.data);

  const job: XaiJobRecord = {
    id: request_id,
    created_at: new Date().toISOString(),
    prompt,
    model,
    duration,
    aspect_ratio,
    resolution,
    status: 'queued',
    raw: resp.data,
    result: {},
    files: {},
  };
  writeJson(path.join(dir, 'job.json'), job);
  return job;
}

export async function xaiRetrieveJob(requestId: string): Promise<XaiJobRecord> {
  const id = String(requestId || '').trim();
  if (!id) throw new Error('requestId is required');

  const client = xaiAxios();
  let resp: any;
  try {
    resp = await client.get(`/videos/${encodeURIComponent(id)}`);
  } catch (e: any) {
    throwXaiError('xAI /videos/{request_id} retrieve failed', e);
  }

  const payload = resp.data;
  const videoUrl = extractVideoUrl(payload);
  const rawStatus = payload?.status ?? payload?.task_status ?? payload?.state;

  const dir = xaiJobDir(id);
  ensureDir(dir);
  writeJson(path.join(dir, 'status.json'), payload);

  const prior: XaiJobRecord | null = readJsonIfExists(path.join(dir, 'job.json'));
  const next: XaiJobRecord = {
    id,
    created_at: prior?.created_at || new Date().toISOString(),
    prompt: prior?.prompt || '(unknown)',
    model: prior?.model || String(process.env.XAI_VIDEO_MODEL || 'grok-imagine-video'),
    duration: prior?.duration,
    aspect_ratio: prior?.aspect_ratio,
    resolution: prior?.resolution,
    status: normalizeStatus(rawStatus, videoUrl, payload),
    raw: payload,
    result: { url: videoUrl || undefined },
    files: prior?.files || {},
  };

  writeJson(path.join(dir, 'job.json'), next);
  return next;
}

export async function xaiWaitForCompletion(params: {
  requestId: string;
  pollMs?: number;
  maxWaitMs?: number;
}): Promise<XaiJobRecord> {
  const id = String(params.requestId || '').trim();
  if (!id) throw new Error('requestId is required');

  const pollMs = Math.max(500, Number(params.pollMs ?? process.env.XAI_VIDEO_POLL_MS ?? 5000));
  const maxWaitMs = Math.max(5_000, Number(params.maxWaitMs ?? process.env.XAI_VIDEO_MAX_WAIT_MS ?? 15 * 60_000));

  const started = Date.now();
  let lastStatus = '';

  while (true) {
    const job = await xaiRetrieveJob(id);
    if (job.status !== lastStatus) {
      const elapsed = Math.round((Date.now() - started) / 1000);
      // eslint-disable-next-line no-console
      console.log(`[xaiWaitForCompletion] [${elapsed}s] ${id}: ${job.status}`);
      lastStatus = job.status;
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return job;
    }

    if (Date.now() - started > maxWaitMs) {
      throw new Error(`Timed out waiting for xAI job ${id} after ${Math.round(maxWaitMs / 1000)}s`);
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }
}

export type XaiDownloadResult = {
  filePath: string;
  bytesWritten: number;
  fileSize: number;
  verified: boolean;
  url: string;
};

export async function xaiDownloadResult(params: { requestId: string }): Promise<XaiDownloadResult> {
  const id = String(params.requestId || '').trim();
  if (!id) throw new Error('requestId is required');

  const dir = xaiJobDir(id);
  ensureDir(dir);

  const job = await xaiRetrieveJob(id);
  const url = job.result?.url;
  if (job.status !== 'completed' || !url) {
    throw new Error(`Job ${id} is not completed or has no URL (status=${job.status}).`);
  }

  const filePath = path.join(dir, 'video.mp4');
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    if (stats.size > 0 && verifyMp4File(filePath)) {
      return { filePath, bytesWritten: stats.size, fileSize: stats.size, verified: true, url };
    }
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }

  // Download (try without auth first; fall back to Bearer if needed)
  let downloadResp: any;
  try {
    downloadResp = await axios.get(url, { responseType: 'stream', timeout: 600_000, maxRedirects: 5 });
  } catch (e1: any) {
    try {
      const apiKey = requireXaiKey();
      downloadResp = await axios.get(url, {
        responseType: 'stream',
        timeout: 600_000,
        maxRedirects: 5,
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch (e2: any) {
      throwXaiError('xAI video download failed', e2);
    }
  }

  const { bytesWritten, fileSize } = await streamToFileAtomic(downloadResp.data as Readable, filePath);
  const verified = verifyMp4File(filePath);

  const jobJsonPath = path.join(dir, 'job.json');
  const current: XaiJobRecord | null = readJsonIfExists(jobJsonPath);
  const updated: XaiJobRecord = {
    ...(current || job),
    files: {
      ...(current?.files || job.files || {}),
      video_mp4: filePath,
    },
  };
  writeJson(jobJsonPath, updated);

  return { filePath, bytesWritten, fileSize, verified, url };
}

