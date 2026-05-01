import express from 'express';
import fs from 'fs';
import path from 'path';
import {
  soraCreateJob,
  soraDownloadVariant,
  soraJobDir,
  soraListVideos,
  soraRetrieveJob,
  soraWaitForCompletion,
  type DownloadResult,
} from '../services/soraVideo';

const router = express.Router();

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * POST /api/sora/videos
 * Body: { prompt: string, model?: string, seconds?: number, size?: string, autoDownload?: boolean }
 *
 * Starts a Sora job. If autoDownload=true (default), we kick off a background poll+download
 * that saves `video.mp4` into `backend/generated/sora/<jobId>/video.mp4`.
 */
router.post('/videos', async (req, res) => {
  try {
    const { prompt, model, seconds, size, autoDownload } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'prompt is required (string)' });
    }

    const job = await soraCreateJob({
      prompt,
      model: typeof model === 'string' ? model : undefined,
      seconds: typeof seconds === 'number' ? seconds : undefined,
      size: typeof size === 'string' ? size : undefined,
    });

    const shouldAuto =
      typeof autoDownload === 'boolean'
        ? autoDownload
        : String(process.env.SORA_AUTODOWNLOAD || 'true').toLowerCase() === 'true';

    if (shouldAuto) {
      // Improved auto-download: Check if already completed, download immediately if so
      // Otherwise, start background worker to poll and download when ready
      (async () => {
        const workerStart = Date.now();
        console.log(`[sora/auto-download] Starting auto-download for job ${job.id}`);
        
        try {
          // First, check current status - might already be completed
          let currentJob = await soraRetrieveJob(job.id);
          
          if (currentJob.status === 'completed') {
            // Already completed! Download immediately
            console.log(`[sora/auto-download] Job ${job.id} already completed, downloading immediately...`);
            try {
              const downloadResult = await soraDownloadVariant({ jobId: job.id, variant: 'video' });
              const elapsed = Math.round((Date.now() - workerStart) / 1000);
              console.log(`[sora/auto-download] ✅ Immediately downloaded ${job.id} in ${elapsed}s: ${downloadResult.filePath}`);
              return;
            } catch (downloadErr: any) {
              // If download fails (e.g., expired), log but don't throw - might still be processing
              console.error(`[sora/auto-download] Immediate download failed:`, downloadErr?.message || downloadErr);
              // Fall through to polling in case status was stale
            }
          }

          // Not completed yet, or immediate download failed - poll until completion
          console.log(`[sora/auto-download] Job ${job.id} status: ${currentJob.status}, polling until completion...`);
          const final = await soraWaitForCompletion({ 
            jobId: job.id,
            pollMs: 5_000, // Poll every 5 seconds (faster to catch completion)
            maxWaitMs: 20 * 60 * 1000, // Max 20 minutes wait
          });
          
          if (final.status === 'completed') {
            console.log(`[sora/auto-download] Job ${job.id} completed, starting download...`);
            const downloadResult = await soraDownloadVariant({ jobId: job.id, variant: 'video' });
            const elapsed = Math.round((Date.now() - workerStart) / 1000);
            console.log(`[sora/auto-download] ✅ Successfully downloaded ${job.id} in ${elapsed}s: ${downloadResult.filePath}`);
          } else {
            console.log(`[sora/auto-download] Job ${job.id} ended with status: ${final.status}`);
          }
        } catch (e: any) {
          const elapsed = Math.round((Date.now() - workerStart) / 1000);
          console.error(`[sora/auto-download] ❌ Failed for job ${job.id} after ${elapsed}s:`, e?.message || e);
          
          // Persist error to job folder for easy debugging
          try {
            const dir = soraJobDir(job.id);
            fs.mkdirSync(dir, { recursive: true });
            const errorText = [
              `Error: ${e?.message || String(e)}`,
              `Time: ${new Date().toISOString()}`,
              `Elapsed: ${elapsed}s`,
              `Stack: ${e?.stack || 'N/A'}`,
            ].join('\n');
            fs.writeFileSync(
              path.join(dir, 'auto_download_error.txt'),
              errorText,
              'utf8'
            );
          } catch (writeErr) {
            console.error('[sora/auto-download] Failed to write error file:', writeErr);
          }
        }
      })();
    }

    return res.status(200).json({
      jobId: job.id,
      status: job.status,
      jobDir: soraJobDir(job.id),
      endpoints: {
        status: `/api/sora/videos/${encodeURIComponent(job.id)}`,
        download: `/api/sora/videos/${encodeURIComponent(job.id)}/download`,
        file: `/api/sora/videos/${encodeURIComponent(job.id)}/file`,
      },
    });
  } catch (err: any) {
    const msg = err?.message || 'Sora create failed';
    const openai = err?.openai;
    if (openai) {
      console.error('[sora] create OpenAI error', openai);
      return res.status(502).json({ error: msg, openai });
    }
    console.error('[sora] create error', msg);
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/sora/videos/:id
 * Returns latest status and file presence.
 */
router.get('/videos/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id is required' });

    const job = await soraRetrieveJob(id);
    const dir = soraJobDir(id);
    const videoPath = path.join(dir, 'video.mp4');

    return res.status(200).json({
      jobId: id,
      status: job.status,
      jobDir: dir,
      files: {
        video_mp4: fileExists(videoPath) ? videoPath : null,
      },
    });
  } catch (err: any) {
    const msg = err?.message || 'Sora status failed';
    const openai = err?.openai;
    if (openai) {
      console.error('[sora] status OpenAI error', openai);
      return res.status(502).json({ error: msg, openai });
    }
    console.error('[sora] status error', msg);
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/sora/videos/:id/download
 * Forces download after completion (no-op if already downloaded).
 * 
 * Note: Large video files may take several minutes to download.
 * This endpoint has an extended timeout (10 minutes) to handle large MP4s.
 */
router.post('/videos/:id/download', async (req, res) => {
  // Set extended timeout for large video downloads (10 minutes)
  req.setTimeout(600_000);
  res.setTimeout(600_000);

  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id is required' });

    console.log(`[sora/download] Starting download for job ${id}`);

    const dir = soraJobDir(id);
    const videoPath = path.join(dir, 'video.mp4');
    if (fileExists(videoPath)) {
      const stats = fs.statSync(videoPath);
      // Verify MP4 if it exists
      const verified = (() => {
        try {
          const fd = fs.openSync(videoPath, 'r');
          const buffer = Buffer.alloc(12);
          fs.readSync(fd, buffer, 0, 12, 0);
          fs.closeSync(fd);
          return buffer.toString('ascii', 4, 8) === 'ftyp';
        } catch {
          return false;
        }
      })();
      
      console.log(`[sora/download] File already exists: ${videoPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB, verified: ${verified})`);
      return res.status(200).json({ 
        jobId: id, 
        ok: true, 
        filePath: videoPath, 
        cached: true,
        fileSize: stats.size,
        verified,
      });
    }

    console.log(`[sora/download] File not found, triggering download...`);
    const result = await soraDownloadVariant({ 
      jobId: id, 
      variant: 'video',
      onProgress: (bytesWritten, totalBytes) => {
        // Progress callback - could emit SSE or log
        if (totalBytes) {
          const pct = Math.round((bytesWritten / totalBytes) * 100);
          const mb = (bytesWritten / 1024 / 1024).toFixed(2);
          console.log(`[sora/download] Progress: ${mb} MB (${pct}%)`);
        }
      },
    });

    // Rename to a stable filename for the UI (if needed)
    if (result.filePath !== videoPath) {
      console.log(`[sora/download] Renaming ${result.filePath} to ${videoPath}`);
      fs.copyFileSync(result.filePath, videoPath);
      try {
        fs.unlinkSync(result.filePath);
      } catch {}
    }

    console.log(`[sora/download] Download completed: ${videoPath}`);
    return res.status(200).json({ 
      jobId: id, 
      ok: true, 
      filePath: videoPath, 
      cached: false,
      fileSize: result.fileSize,
      bytesWritten: result.bytesWritten,
      verified: result.verified,
      expectedSize: result.expectedSize,
    });
  } catch (err: any) {
    const msg = err?.message || 'Sora download failed';
    const openai = err?.openai;
    console.error(`[sora/download] Error for job ${req.params.id}:`, msg);
    if (openai) {
      console.error('[sora/download] OpenAI error details:', openai);
      return res.status(502).json({ error: msg, openai });
    }
    console.error('[sora/download] General error:', err);
    return res.status(500).json({ error: msg, details: String(err) });
  }
});

/**
 * GET /api/sora/videos
 * List all videos from OpenAI (useful for checking expiration, maintaining library).
 * Query params: limit, after, order
 */
router.get('/videos', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const after = req.query.after ? String(req.query.after) : undefined;
    const order = req.query.order === 'asc' || req.query.order === 'desc' ? req.query.order : undefined;

    const result = await soraListVideos({ limit, after, order });

    // Add expiration status to each video
    const now = Date.now();
    const enriched = result.data.map((video: any) => {
      const expiresAt = video.expires_at;
      const isExpired = expiresAt && now > expiresAt * 1000;
      const expiresInMinutes = expiresAt
        ? Math.round((expiresAt * 1000 - now) / 1000 / 60)
        : null;

      return {
        ...video,
        expires_at_iso: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
        is_expired: isExpired,
        expires_in_minutes: expiresInMinutes,
        can_download: video.status === 'completed' && !isExpired,
      };
    });

    return res.status(200).json({
      ...result,
      data: enriched,
    });
  } catch (err: any) {
    const msg = err?.message || 'Sora list failed';
    const openai = err?.openai;
    if (openai) {
      console.error('[sora] list OpenAI error', openai);
      return res.status(502).json({ error: msg, openai });
    }
    console.error('[sora] list error', msg);
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/sora/videos/:id/file
 * Streams the locally stored MP4 back to the browser.
 */
router.get('/videos/:id/file', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).send('Missing id');

    const dir = soraJobDir(id);
    const videoPath = path.join(dir, 'video.mp4');
    if (!fileExists(videoPath)) {
      return res.status(404).send('Video file not found. Try polling status or POST /download.');
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(videoPath);
  } catch (err: any) {
    const msg = err?.message || 'Failed to serve file';
    const openai = err?.openai;
    if (openai) console.error('[sora] file OpenAI error', openai);
    else console.error('[sora] file error', msg);
    return res.status(500).send(msg);
  }
});

export default router;

