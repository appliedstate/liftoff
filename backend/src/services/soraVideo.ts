import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Readable } from 'stream';
import FormData from 'form-data';

export type SoraCreateInput = {
  prompt: string;
  model?: string; // e.g. "sora-2"
  seconds?: number; // e.g. 4 | 8 | 12
  size?: string; // e.g. "1280x720"
};

export type SoraJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'unknown';

export type SoraJobRecord = {
  id: string;
  created_at: string;
  prompt: string;
  model: string;
  seconds?: number;
  size?: string;
  status: SoraJobStatus;
  raw?: any;
  files?: {
    video_mp4?: string;
    thumbnail?: string;
    spritesheet?: string;
  };
};

type OpenAiErrorPayload = {
  message?: string;
  type?: string;
  param?: string | null;
  code?: string | null;
};

type OpenAiFailureDetails = {
  status?: number;
  request_id?: string;
  error?: OpenAiErrorPayload;
};

function requireOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY');
  return key;
}

export function soraOutputBaseDir(): string {
  // Default to backend/generated/sora
  const configured = process.env.SORA_OUTPUT_DIR;
  if (configured && configured.trim()) return path.resolve(process.cwd(), configured.trim());
  return path.resolve(process.cwd(), 'generated', 'sora');
}

export function soraJobDir(jobId: string): string {
  // Constrain to a safe folder name
  const safe = String(jobId).replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(soraOutputBaseDir(), safe);
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

function normalizeStatus(rawStatus: any): SoraJobStatus {
  const s = String(rawStatus || '').toLowerCase();
  if (s === 'queued' || s === 'pending') return 'queued';
  if (s === 'running' || s === 'in_progress' || s === 'processing') return 'running';
  if (s === 'completed' || s === 'succeeded' || s === 'done') return 'completed';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  return 'unknown';
}

function openAiAxios() {
  const apiKey = requireOpenAiKey();
  return axios.create({
    baseURL: 'https://api.openai.com/v1',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    // Video generation is async; requests should be fast, but downloads can be larger.
    // Increased timeout for large MP4 downloads (up to 10 minutes)
    timeout: 600_000, // 10 minutes for large video files
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
}


function toOpenAiFailure(e: any): OpenAiFailureDetails {
  const status = e?.response?.status;
  const request_id = e?.response?.headers?.['x-request-id'];
  const err = e?.response?.data?.error;
  return {
    status: typeof status === 'number' ? status : undefined,
    request_id: typeof request_id === 'string' ? request_id : undefined,
    error: err && typeof err === 'object'
      ? {
          message: typeof err.message === 'string' ? err.message : undefined,
          type: typeof err.type === 'string' ? err.type : undefined,
          param: typeof err.param === 'string' || err.param === null ? err.param : undefined,
          code: typeof err.code === 'string' || err.code === null ? err.code : undefined,
        }
      : undefined,
  };
}

function throwOpenAiError(prefix: string, e: any): never {
  const failure = toOpenAiFailure(e);
  const msg =
    failure.error?.message ||
    e?.message ||
    'OpenAI request failed';
  const err: any = new Error(`${prefix}${failure.status ? ` (${failure.status})` : ''}: ${msg}`);
  err.openai = failure;
  throw err;
}

export async function soraCreateJob(input: SoraCreateInput): Promise<SoraJobRecord> {
  const prompt = String(input.prompt || '').trim();
  if (!prompt) throw new Error('prompt is required');

  const model = String(input.model || process.env.SORA_MODEL || 'sora-2').trim();
  const secondsEnv = process.env.SORA_SECONDS ? Number(process.env.SORA_SECONDS) : undefined;
  const sizeEnv = process.env.SORA_SIZE ? String(process.env.SORA_SIZE) : undefined;
  const qualityEnv = process.env.SORA_QUALITY ? String(process.env.SORA_QUALITY) : undefined;
  const seconds = typeof input.seconds === 'number' ? input.seconds : secondsEnv;
  const size = typeof input.size === 'string' ? input.size : sizeEnv;
  const quality = typeof qualityEnv === 'string' && qualityEnv.trim() ? qualityEnv.trim() : undefined;

  const client = openAiAxios();
  // OpenAI video API expects multipart/form-data (see docs curl example).
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  // seconds is enum-like string ("4" | "8" | "12") in the current API
  if (Number.isFinite(seconds)) form.append('seconds', String(seconds));
  if (typeof size === 'string' && size.trim()) form.append('size', size.trim());
  if (quality) form.append('quality', quality);

  let resp: any;
  try {
    resp = await client.post('/videos', form, {
      headers: {
        ...form.getHeaders(),
      },
    });
  } catch (e: any) {
    throwOpenAiError('OpenAI /videos create failed', e);
  }
  const id = String(resp.data?.id || resp.data?.video_id || '');
  if (!id) {
    throw new Error(`OpenAI /videos did not return an id. Response keys: ${Object.keys(resp.data || {}).join(', ')}`);
  }

  const job: SoraJobRecord = {
    id,
    created_at: new Date().toISOString(),
    prompt,
    model,
    seconds: Number.isFinite(seconds) ? seconds : undefined,
    size: typeof size === 'string' && size.trim() ? size.trim() : undefined,
    status: normalizeStatus(resp.data?.status),
    raw: resp.data,
    files: {},
  };

  const dir = soraJobDir(id);
  ensureDir(dir);
  writeJson(path.join(dir, 'request.json'), {
    input: {
      model,
      prompt,
      seconds: Number.isFinite(seconds) ? String(seconds) : undefined,
      size: typeof size === 'string' && size.trim() ? size.trim() : undefined,
      quality,
    },
    created_at: job.created_at,
  });
  writeJson(path.join(dir, 'status.json'), resp.data);
  writeJson(path.join(dir, 'job.json'), job);
  return job;
}

export async function soraRetrieveJob(jobId: string): Promise<SoraJobRecord> {
  const id = String(jobId || '').trim();
  if (!id) throw new Error('jobId is required');

  const client = openAiAxios();
  let resp: any;
  try {
    resp = await client.get(`/videos/${encodeURIComponent(id)}`);
  } catch (e: any) {
    throwOpenAiError('OpenAI /videos retrieve failed', e);
  }

  const dir = soraJobDir(id);
  ensureDir(dir);

  const prior: SoraJobRecord | null = readJsonIfExists(path.join(dir, 'job.json'));
  const next: SoraJobRecord = {
    id,
    created_at: prior?.created_at || new Date().toISOString(),
    prompt: prior?.prompt || '(unknown)',
    model: prior?.model || String(process.env.SORA_MODEL || 'sora-2'),
    seconds: prior?.seconds,
    size: prior?.size,
    status: normalizeStatus(resp.data?.status),
    raw: resp.data,
    files: prior?.files || {},
  };

  writeJson(path.join(dir, 'status.json'), resp.data);
  writeJson(path.join(dir, 'job.json'), next);
  return next;
}

/**
 * Check available disk space (basic check using statfs on Unix-like systems)
 * Returns available space in bytes, or null if check fails
 */
function checkDiskSpace(dirPath: string): number | null {
  try {
    const stats = fs.statSync(dirPath);
    // On macOS/Linux, we'd use statfs, but Node doesn't expose it directly
    // For now, just check if we can write to the directory
    // In production, consider using a library like 'check-disk-space'
    return null; // Indicates check not available, but directory is writable
  } catch {
    return null;
  }
}

/**
 * Verify MP4 file has valid header signature
 */
function verifyMp4File(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(12);
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);
    
    // MP4 files start with ftyp box: 4-byte size (often 00 00 00 XX), then 'ftyp'
    // Check for 'ftyp' at offset 4-8
    const signature = buffer.toString('ascii', 4, 8);
    return signature === 'ftyp';
  } catch {
    return false;
  }
}

/**
 * Stream to file with progress tracking and atomic write
 * Writes to temp file first, then atomically renames to final path
 */
async function streamToFileAtomic(
  stream: Readable,
  finalPath: string,
  expectedSize?: number,
  onProgress?: (bytesWritten: number, totalBytes?: number) => void
): Promise<{ bytesWritten: number; fileSize: number }> {
  const tempPath = finalPath + '.tmp';
  ensureDir(path.dirname(finalPath));

  let bytesWritten = 0;
  let lastProgressLog = 0;
  const progressInterval = 10 * 1024 * 1024; // Log every 10MB

  return new Promise<{ bytesWritten: number; fileSize: number }>((resolve, reject) => {
    const out = fs.createWriteStream(tempPath);
    
    stream.on('data', (chunk: Buffer) => {
      bytesWritten += chunk.length;
      
      // Log progress every 10MB or 10% if expected size known
      if (bytesWritten - lastProgressLog >= progressInterval) {
        const pct = expectedSize ? Math.round((bytesWritten / expectedSize) * 100) : null;
        const mb = (bytesWritten / 1024 / 1024).toFixed(2);
        console.log(`[soraDownloadVariant] Progress: ${mb} MB${pct ? ` (${pct}%)` : ''}`);
        lastProgressLog = bytesWritten;
        if (onProgress) onProgress(bytesWritten, expectedSize);
      }
    });

    stream.pipe(out);

    out.on('finish', () => {
      try {
        const stats = fs.statSync(tempPath);
        const fileSize = stats.size;

        // Verify file size matches expected (if provided)
        if (expectedSize && fileSize !== expectedSize) {
          fs.unlinkSync(tempPath);
          reject(new Error(
            `File size mismatch: expected ${expectedSize} bytes, got ${fileSize} bytes`
          ));
          return;
        }

        // Verify non-zero size
        if (fileSize === 0) {
          fs.unlinkSync(tempPath);
          reject(new Error('Downloaded file is empty (0 bytes)'));
          return;
        }

        // Atomic rename: temp file -> final file
        fs.renameSync(tempPath, finalPath);

        // Final progress log
        if (onProgress) onProgress(bytesWritten, expectedSize);
        const mb = (fileSize / 1024 / 1024).toFixed(2);
        console.log(`[soraDownloadVariant] File written: ${mb} MB (${fileSize} bytes)`);

        resolve({ bytesWritten, fileSize });
      } catch (e: any) {
        // Clean up temp file on error
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {}
        reject(new Error(`Failed to finalize file: ${e?.message || e}`));
      }
    });

    out.on('error', (err) => {
      // Clean up temp file on error
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {}
      reject(err);
    });

    stream.on('error', (err) => {
      // Clean up temp file on error
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {}
      reject(err);
    });
  });
}

export type DownloadResult = {
  filePath: string;
  variant: string;
  bytesWritten: number;
  fileSize: number;
  verified: boolean;
  expectedSize?: number;
};

export async function soraDownloadVariant(params: {
  jobId: string;
  variant?: 'video' | 'thumbnail' | 'spritesheet';
  onProgress?: (bytesWritten: number, totalBytes?: number) => void;
}): Promise<DownloadResult> {
  const id = String(params.jobId || '').trim();
  if (!id) throw new Error('jobId is required');
  const variant = params.variant || 'video';

  const dir = soraJobDir(id);
  ensureDir(dir);

  // Check disk space (basic check - warn if directory not writable)
  const minDiskMb = Number(process.env.SORA_DOWNLOAD_MIN_DISK_MB || '500');
  try {
    // Try to create a test file to verify writability
    const testFile = path.join(dir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (e: any) {
    if (e.code === 'ENOSPC') {
      throw new Error(`Insufficient disk space in ${dir}. Need at least ${minDiskMb}MB free.`);
    }
    if (e.code === 'EACCES') {
      throw new Error(`Permission denied writing to ${dir}. Check directory permissions.`);
    }
    // Other errors are non-fatal, continue
  }

  // Make sure job is completed before downloading
  const job = await soraRetrieveJob(id);
  if (job.status !== 'completed') {
    throw new Error(`Job ${id} is not completed (status=${job.status}).`);
  }

  // Check if video has expired (OpenAI docs say downloads expire after 1 hour)
  const expiresAt = job.raw?.expires_at;
  if (expiresAt && typeof expiresAt === 'number') {
    const expiresMs = expiresAt * 1000;
    const nowMs = Date.now();
    if (nowMs > expiresMs) {
      throw new Error(
        `Video ${id} has expired. Expired at ${new Date(expiresMs).toISOString()}, current time ${new Date(nowMs).toISOString()}. ` +
        `You need to regenerate the video.`
      );
    }
    const timeUntilExpiry = Math.round((expiresMs - nowMs) / 1000 / 60);
    console.log(`[soraDownloadVariant] Video expires in ${timeUntilExpiry} minutes`);
  }

  const ext = variant === 'video' ? 'mp4' : variant === 'thumbnail' ? 'jpg' : 'png';
  const filePath = path.join(dir, `${variant}.${ext}`);

  // Check if file already exists and is valid
  if (fs.existsSync(filePath)) {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > 0) {
        // Verify MP4 if it's a video file
        if (variant === 'video' && !verifyMp4File(filePath)) {
          console.warn(`[soraDownloadVariant] Existing file ${filePath} appears corrupted, re-downloading...`);
          fs.unlinkSync(filePath);
        } else {
          console.log(`[soraDownloadVariant] File already exists: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
          return {
            filePath,
            variant,
            bytesWritten: stats.size,
            fileSize: stats.size,
            verified: variant === 'video' ? verifyMp4File(filePath) : true,
          };
        }
      }
    } catch (e) {
      // File exists but can't read it, try to download again
      console.warn(`[soraDownloadVariant] Cannot read existing file, re-downloading...`);
    }
  }

  // Retry configuration
  const maxRetries = Number(process.env.SORA_DOWNLOAD_RETRIES || '3');
  const initialDelayMs = 1000;
  const maxDelayMs = 10000;

  const client = openAiAxios();
  let resp: any;
  let expectedSize: number | undefined;

  // Download with retry logic using axios (SDK doesn't have videos API yet)
  try {
    console.log(`[soraDownloadVariant] Starting download for job ${id}, variant=${variant} (max retries: ${maxRetries})`);
    
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        resp = await client.get(`/videos/${encodeURIComponent(id)}/content`, {
          params: { variant },
          responseType: 'stream', // Use stream for large files to avoid memory issues
          timeout: 600_000, // 10 minutes for large files
        });

        // Extract Content-Length if available
        const contentLength = resp.headers['content-length'];
        if (contentLength) {
          expectedSize = parseInt(contentLength, 10);
          if (!Number.isNaN(expectedSize) && expectedSize > 0) {
            console.log(`[soraDownloadVariant] Expected file size: ${(expectedSize / 1024 / 1024).toFixed(2)} MB`);
          }
        }

        // Check for 4xx errors (client errors - don't retry)
        if (resp.status >= 400 && resp.status < 500) {
          // Consume stream to get error message
          const errorText = await new Promise<string>((resolve) => {
            let data = '';
            resp.data.on('data', (chunk: Buffer) => { data += chunk.toString(); });
            resp.data.on('end', () => resolve(data));
            resp.data.on('error', () => resolve(''));
          });
          throw new Error(`Client error ${resp.status}: ${errorText || 'Bad request'}`);
        }

        // Success - break out of retry loop
        break;
      } catch (e: any) {
        lastError = e;
        const httpStatus = e?.response?.status;
        const isNetworkError = 
          e?.code === 'ECONNRESET' || 
          e?.code === 'ETIMEDOUT' || 
          e?.code === 'ECONNREFUSED' ||
          e?.message?.includes('socket hang up') ||
          e?.message?.includes('timeout');

        // Don't retry on 4xx errors (client errors)
        if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
          throw e;
        }

        // Don't retry on last attempt
        if (attempt >= maxRetries) {
          break;
        }

        // Retry on network errors or 5xx errors
        const isRetryable = isNetworkError || (httpStatus && httpStatus >= 500) || httpStatus === 429;
        if (!isRetryable) {
          throw e;
        }

        // Exponential backoff
        const delay = Math.min(
          initialDelayMs * Math.pow(2, attempt),
          maxDelayMs
        );

        console.warn(
          `[soraDownloadVariant] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms ` +
          `(${isNetworkError ? 'network error' : `HTTP ${httpStatus || 'unknown'}`})`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // If we exhausted retries, throw the last error
    if (!resp) {
      const httpStatus = lastError?.response?.status;
      const isNetworkError = 
        lastError?.code === 'ECONNRESET' || 
        lastError?.code === 'ETIMEDOUT' || 
        lastError?.message?.includes('socket hang up');

      if (isNetworkError && !httpStatus) {
        console.error(`[soraDownloadVariant] Network error after ${maxRetries} retries: ${lastError?.message || lastError}`);
        throw new Error(`Network error downloading video after ${maxRetries} retries: ${lastError?.message || lastError}. Check your connection and try again.`);
      }

      console.error(`[soraDownloadVariant] Download request failed after ${maxRetries} retries:`, lastError?.message || lastError);
      throwOpenAiError('OpenAI /videos content download failed', lastError);
    }

    console.log(`[soraDownloadVariant] Download stream started, saving to ${filePath}`);
  } catch (e: any) {
    console.error(`[soraDownloadVariant] Download request failed for ${id}:`, e?.message || e);
    throwOpenAiError('OpenAI /videos content download failed', e);
  }

  // Stream to file atomically with progress tracking
  let downloadResult: { bytesWritten: number; fileSize: number };
  try {
    downloadResult = await streamToFileAtomic(
      resp.data as Readable,
      filePath,
      expectedSize,
      params.onProgress
    );
  } catch (e: any) {
    // Clean up any partial temp files
    const tempPath = filePath + '.tmp';
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}

    const errorMsg = e?.message || String(e);
    
    // Provide helpful error messages
    if (errorMsg.includes('ENOSPC') || errorMsg.includes('No space')) {
      throw new Error(`Disk full: Cannot save video to ${dir}. Free up space and try again.`);
    }
    if (errorMsg.includes('EACCES') || errorMsg.includes('permission')) {
      throw new Error(`Permission denied: Cannot write to ${dir}. Check directory permissions.`);
    }
    if (errorMsg.includes('size mismatch')) {
      throw new Error(`Download incomplete: ${errorMsg}. The file may be corrupted. Try downloading again.`);
    }
    if (errorMsg.includes('empty')) {
      throw new Error(`Downloaded file is empty. This may indicate an API error. Check OpenAI status.`);
    }

    console.error(`[soraDownloadVariant] File write failed for ${id}:`, errorMsg);
    throw new Error(`Failed to save downloaded file: ${errorMsg}`);
  }

  // Verify file (especially for MP4s)
  let verified = true;
  if (variant === 'video') {
    verified = verifyMp4File(filePath);
    if (!verified) {
      console.error(`[soraDownloadVariant] WARNING: Downloaded file ${filePath} does not have valid MP4 header`);
      // Don't throw - file might still be usable, but log warning
    } else {
      console.log(`[soraDownloadVariant] MP4 file verified: valid header signature`);
    }
  }

  // Update job.json with file info
  const jobJsonPath = path.join(dir, 'job.json');
  const current: SoraJobRecord | null = readJsonIfExists(jobJsonPath);
  const updated: SoraJobRecord = {
    ...(current || job),
    files: {
      ...(current?.files || job.files || {}),
      ...(variant === 'video' ? { video_mp4: filePath } : {}),
      ...(variant === 'thumbnail' ? { thumbnail: filePath } : {}),
      ...(variant === 'spritesheet' ? { spritesheet: filePath } : {}),
    },
  };
  writeJson(jobJsonPath, updated);

  console.log(`[soraDownloadVariant] ✅ Successfully downloaded ${variant} to ${filePath}`);

  return {
    filePath,
    variant,
    bytesWritten: downloadResult.bytesWritten,
    fileSize: downloadResult.fileSize,
    verified,
    expectedSize,
  };
}

export async function soraWaitForCompletion(params: {
  jobId: string;
  pollMs?: number;
  maxWaitMs?: number;
}): Promise<SoraJobRecord> {
  const id = String(params.jobId || '').trim();
  if (!id) throw new Error('jobId is required');

  const pollMs = Math.max(500, Number(params.pollMs ?? process.env.SORA_POLL_MS ?? 5000));
  const maxWaitMs = Math.max(5_000, Number(params.maxWaitMs ?? process.env.SORA_MAX_WAIT_MS ?? 10 * 60_000));

  const started = Date.now();
  let lastStatus = '';
  let lastProgress = -1;
  
  while (true) {
    const job = await soraRetrieveJob(id);
    const currentStatus = job.status;
    const currentProgress = job.raw?.progress ?? -1;
    
    // Log status changes
    if (currentStatus !== lastStatus || currentProgress !== lastProgress) {
      const elapsed = Math.round((Date.now() - started) / 1000);
      const progressText = currentProgress >= 0 ? ` (${currentProgress}%)` : '';
      console.log(`[soraWaitForCompletion] [${elapsed}s] ${id}: ${currentStatus}${progressText}`);
      lastStatus = currentStatus;
      lastProgress = currentProgress;
    }
    
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return job;
    }
    
    if (Date.now() - started > maxWaitMs) {
      throw new Error(`Timed out waiting for job ${id} after ${Math.round(maxWaitMs / 1000)}s`);
    }
    
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

export type SoraVideoListItem = {
  id: string;
  object: string;
  created_at: number;
  status: string;
  model?: string;
  progress?: number;
  seconds?: string;
  size?: string;
  expires_at?: number;
};

export type SoraListResponse = {
  object: string;
  data: SoraVideoListItem[];
  has_more: boolean;
  first_id?: string;
  last_id?: string;
};

/**
 * List all videos (OpenAI GET /videos endpoint).
 * Useful for checking expiration status and maintaining your library.
 */
export async function soraListVideos(params?: {
  limit?: number;
  after?: string;
  order?: 'asc' | 'desc';
}): Promise<SoraListResponse> {
  const client = openAiAxios();
  const queryParams: any = {};
  if (params?.limit) queryParams.limit = params.limit;
  if (params?.after) queryParams.after = params.after;
  if (params?.order) queryParams.order = params.order;

  let resp: any;
  try {
    resp = await client.get('/videos', { params: queryParams });
  } catch (e: any) {
    throwOpenAiError('OpenAI /videos list failed', e);
  }

  return resp.data;
}

