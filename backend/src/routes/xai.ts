import express from 'express';
import fs from 'fs';
import path from 'path';
import {
  xaiCreateJob,
  xaiDownloadResult,
  xaiJobDir,
  xaiRetrieveJob,
  xaiWaitForCompletion,
  type XaiVideoAspectRatio,
  type XaiVideoResolution,
} from '../services/xaiVideo';

const router = express.Router();

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * POST /api/xai/videos
 * Body: { prompt: string, model?: string, duration?: number, aspect_ratio?: string, resolution?: string, image_url?: string, video_url?: string, autoDownload?: boolean }
 *
 * Starts an xAI video generation/edit job. If autoDownload=true (default), a background worker
 * polls until completion and downloads `video.mp4` into `backend/generated/xai/<requestId>/video.mp4`.
 */
router.post('/videos', async (req, res) => {
  try {
    const { prompt, model, duration, aspect_ratio, resolution, image_url, video_url, autoDownload } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'prompt is required (string)' });
    }

    const job = await xaiCreateJob({
      prompt,
      model: typeof model === 'string' ? model : undefined,
      duration: typeof duration === 'number' ? duration : undefined,
      aspect_ratio: typeof aspect_ratio === 'string' ? (aspect_ratio as XaiVideoAspectRatio) : undefined,
      resolution: typeof resolution === 'string' ? (resolution as XaiVideoResolution) : undefined,
      image_url: typeof image_url === 'string' ? image_url : undefined,
      video_url: typeof video_url === 'string' ? video_url : undefined,
    });

    const shouldAuto =
      typeof autoDownload === 'boolean'
        ? autoDownload
        : String(process.env.XAI_VIDEO_AUTODOWNLOAD || 'true').toLowerCase() === 'true';

    if (shouldAuto) {
      (async () => {
        const workerStart = Date.now();
        // eslint-disable-next-line no-console
        console.log(`[xai/auto-download] Starting auto-download for job ${job.id}`);

        try {
          // First check status; if completed already, download immediately.
          let current = await xaiRetrieveJob(job.id);
          if (current.status === 'completed') {
            try {
              const dl = await xaiDownloadResult({ requestId: job.id });
              const elapsed = Math.round((Date.now() - workerStart) / 1000);
              // eslint-disable-next-line no-console
              console.log(`[xai/auto-download] ✅ Immediately downloaded ${job.id} in ${elapsed}s: ${dl.filePath}`);
              return;
            } catch (e: any) {
              // eslint-disable-next-line no-console
              console.error('[xai/auto-download] Immediate download failed:', e?.message || e);
            }
          }

          // Poll and download when ready.
          // eslint-disable-next-line no-console
          console.log(`[xai/auto-download] Job ${job.id} status: ${current.status}, polling until completion...`);
          const final = await xaiWaitForCompletion({
            requestId: job.id,
            pollMs: 5_000,
            maxWaitMs: 20 * 60 * 1000,
          });

          if (final.status === 'completed') {
            // eslint-disable-next-line no-console
            console.log(`[xai/auto-download] Job ${job.id} completed, starting download...`);
            const dl = await xaiDownloadResult({ requestId: job.id });
            const elapsed = Math.round((Date.now() - workerStart) / 1000);
            // eslint-disable-next-line no-console
            console.log(`[xai/auto-download] ✅ Successfully downloaded ${job.id} in ${elapsed}s: ${dl.filePath}`);
          } else {
            // eslint-disable-next-line no-console
            console.log(`[xai/auto-download] Job ${job.id} ended with status: ${final.status}`);
          }
        } catch (e: any) {
          const elapsed = Math.round((Date.now() - workerStart) / 1000);
          // eslint-disable-next-line no-console
          console.error(`[xai/auto-download] ❌ Failed for job ${job.id} after ${elapsed}s:`, e?.message || e);

          // Persist error to job folder for easy debugging
          try {
            const dir = xaiJobDir(job.id);
            fs.mkdirSync(dir, { recursive: true });
            const errorText = [
              `Error: ${e?.message || String(e)}`,
              `Time: ${new Date().toISOString()}`,
              `Elapsed: ${elapsed}s`,
              `Stack: ${e?.stack || 'N/A'}`,
            ].join('\n');
            fs.writeFileSync(path.join(dir, 'auto_download_error.txt'), errorText, 'utf8');
          } catch (writeErr) {
            // eslint-disable-next-line no-console
            console.error('[xai/auto-download] Failed to write error file:', writeErr);
          }
        }
      })();
    }

    return res.status(200).json({
      requestId: job.id,
      status: job.status,
      jobDir: xaiJobDir(job.id),
      endpoints: {
        status: `/api/xai/videos/${encodeURIComponent(job.id)}`,
        download: `/api/xai/videos/${encodeURIComponent(job.id)}/download`,
        file: `/api/xai/videos/${encodeURIComponent(job.id)}/file`,
      },
    });
  } catch (err: any) {
    const msg = err?.message || 'xAI create failed';
    const xai = err?.xai;
    if (xai) {
      // eslint-disable-next-line no-console
      console.error('[xai] create error', xai);
      return res.status(502).json({ error: msg, xai });
    }
    // eslint-disable-next-line no-console
    console.error('[xai] create error', msg);
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/xai/videos/:id
 * Returns latest status and file presence.
 */
router.get('/videos/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id is required' });

    const job = await xaiRetrieveJob(id);
    const dir = xaiJobDir(id);
    const videoPath = path.join(dir, 'video.mp4');

    return res.status(200).json({
      requestId: id,
      status: job.status,
      jobDir: dir,
      resultUrl: job.result?.url || null,
      files: {
        video_mp4: fileExists(videoPath) ? videoPath : null,
      },
    });
  } catch (err: any) {
    const msg = err?.message || 'xAI status failed';
    const xai = err?.xai;
    if (xai) {
      // eslint-disable-next-line no-console
      console.error('[xai] status error', xai);
      return res.status(502).json({ error: msg, xai });
    }
    // eslint-disable-next-line no-console
    console.error('[xai] status error', msg);
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/xai/videos/:id/download
 * Forces download after completion (no-op if already downloaded).
 */
router.post('/videos/:id/download', async (req, res) => {
  // Downloads can be large; allow plenty of time.
  req.setTimeout(600_000);
  res.setTimeout(600_000);

  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id is required' });

    const dir = xaiJobDir(id);
    const videoPath = path.join(dir, 'video.mp4');
    if (fileExists(videoPath)) {
      const stats = fs.statSync(videoPath);
      return res.status(200).json({
        requestId: id,
        ok: true,
        filePath: videoPath,
        cached: true,
        fileSize: stats.size,
      });
    }

    const result = await xaiDownloadResult({ requestId: id });
    return res.status(200).json({
      requestId: id,
      ok: true,
      filePath: result.filePath,
      cached: false,
      fileSize: result.fileSize,
      bytesWritten: result.bytesWritten,
      verified: result.verified,
      url: result.url,
    });
  } catch (err: any) {
    const msg = err?.message || 'xAI download failed';
    const xai = err?.xai;
    if (xai) return res.status(502).json({ error: msg, xai });
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/xai/videos/:id/file
 * Streams the locally stored MP4 back to the browser.
 */
router.get('/videos/:id/file', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).send('Missing id');

    const dir = xaiJobDir(id);
    const videoPath = path.join(dir, 'video.mp4');
    if (!fileExists(videoPath)) {
      return res.status(404).send('Video file not found. Try polling status or POST /download.');
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(videoPath);
  } catch (err: any) {
    return res.status(500).send(err?.message || 'Failed to serve file');
  }
});

export default router;

