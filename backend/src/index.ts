import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { getLastIngestTimestamps, getLastValidateSummary, getQueryMetrics, getAdminMetrics } from './lib/health';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// In dev, disable CSP so inline scripts on local dev pages (/copilot, /zuck, /elon) work
{
  const helmetOptions: any = {};
  const disableCsp = (process.env.NODE_ENV !== 'production') || (process.env.DISABLE_DEV_CSP === 'true');
  if (disableCsp) helmetOptions.contentSecurityPolicy = false;
  app.use(helmet(helmetOptions));
}
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Backend server is running!' });
});

// Import and mount route modules
import copilotRouter from './routes/copilot';
import elonRouter from './routes/elon';
import metaAdLibraryRouter from './routes/metaAdLibrary';
import strategistRouter from './routes/strategist';
import system1Router from './routes/system1';
import s1Router from './routes/s1';
import decisionEngineRouter from './routes/decisionEngine';
import vectorRouter from './routes/vector';
import campaignFactoryRouter from './routes/campaignFactory';
import opportunityQueueRouter from './routes/opportunityQueue';
import workflowRouter from './routes/workflow';
import analyticsRouter from './routes/analytics';
import monitoringAgentRouter from './routes/monitoringAgent';
import docsRouter from './routes/docs';
import qualityRouter from './routes/quality';
import soraRouter from './routes/sora';
import xaiRouter from './routes/xai';
import metaPolicyRouter from './routes/metaPolicy';
import metaReviewPressureRouter from './routes/metaReviewPressure';
import intentPacketsRouter from './routes/intentPackets';
import googleRsocPolicyRouter from './routes/googleRsocPolicy';
import adLibraryRouter from './routes/adLibrary';
import meetingIntelligenceRouter from './routes/meetingIntelligence';

app.use('/api/copilot', copilotRouter);
app.use('/api/elon', elonRouter);
app.use('/api/meta-ad-library', metaAdLibraryRouter);
app.use('/api/strategist', strategistRouter);
app.use('/api/system1', system1Router);
app.use('/api/s1', s1Router);
app.use('/api/decision-engine', decisionEngineRouter);
app.use('/api/vector', vectorRouter);
app.use('/api/campaign-factory', campaignFactoryRouter);
app.use('/api/opportunities', opportunityQueueRouter);
app.use('/api/workflow', workflowRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/docs', docsRouter);
app.use('/api/monitoring', monitoringAgentRouter);
app.use('/api/quality', qualityRouter);
app.use('/api/sora', soraRouter);
app.use('/api/xai', xaiRouter);
app.use('/api/meta-policy', metaPolicyRouter);
app.use('/api/meta-review-pressure', metaReviewPressureRouter);
app.use('/api/intent-packets', intentPacketsRouter);
app.use('/api/google-rsoc-policy', googleRsocPolicyRouter);
app.use('/api/ad-library', adLibraryRouter);
app.use('/api/meeting-intelligence', meetingIntelligenceRouter);

app.get('/api/health', (req, res) => {
  const last = getLastIngestTimestamps();
  const validate = getLastValidateSummary();
  const query = getQueryMetrics();
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    last_ingest: last,
    last_validate: validate,
    query_metrics: query,
    admin_metrics: getAdminMetrics(),
  });
});

// Protected route example
import { authenticateUser } from './middleware/auth';

app.get('/api/profile', authenticateUser, (req: any, res) => {
  res.json({ 
    message: 'Protected route accessed successfully',
    user: req.user 
  });
});

// Public route that optionally includes user data
import { optionalAuth } from './middleware/auth';

app.get('/api/public', optionalAuth, (req: any, res) => {
  res.json({ 
    message: 'Public route',
    user: req.user || null,
    timestamp: new Date().toISOString()
  });
});

// Routes are already registered above (lines 41-48)

// Minimal unauthenticated CoPilot chat UI for local/dev usage
app.get('/copilot', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Facebook CoPilot (Dev)</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 20px; }
      textarea { width: 100%; min-height: 120px; font-family: inherit; font-size: 14px; }
      pre { background: #111; color: #eee; padding: 12px; border-radius: 6px; overflow: auto; white-space: pre-wrap; }
      .row { display: flex; gap: 12px; align-items: center; }
      .row > * { flex: 1; }
      button { padding: 10px 16px; border-radius: 6px; border: 1px solid #ccc; background: #1f6feb; color: white; cursor: pointer; }
    </style>
  </head>
  <body>
    <h1>Facebook CoPilot (Dev)</h1>
    <p>Auth is disabled for this page in dev. Provide a prompt and press Send.</p>
    <div>
      <label>Prompt</label>
      <textarea id="prompt">Summarize yesterday performance and suggest next actions.</textarea>
    </div>
    <div class="row">
      <button id="send">Send</button>
      <label>Temperature <input id="temp" type="number" min="0" max="2" step="0.1" value="0.2" style="width: 80px;" /></label>
      <label>Max Tokens <input id="max" type="number" step="50" value="500" style="width: 100px;" /></label>
    </div>
    <h3>Response</h3>
    <pre id="out"></pre>
    <script>
      const BASE = (location.port === '3001') ? location.origin : (location.protocol + '//' + location.hostname + ':3001');
      async function post(path, body) {
        const url = path.startsWith('http') ? path : (BASE + path);
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok) throw new Error(await res.text());
        return ct.includes('application/json') ? res.json() : res.text();
      }
      document.getElementById('send').addEventListener('click', async () => {
        const prompt = document.getElementById('prompt').value;
        const temperature = parseFloat(document.getElementById('temp').value) || 0.2;
        const maxTokens = parseInt(document.getElementById('max').value, 10) || undefined;
        const out = document.getElementById('out');
        out.textContent = 'Loading...';
        try {
          const resp = await post('/api/strategist/chat', { prompt, temperature, maxTokens });
          out.textContent = typeof resp === 'string' ? resp : (resp.output || JSON.stringify(resp, null, 2));
        } catch (e) {
          out.textContent = 'Error: ' + (e.message || e);
        }
      });
    </script>
  </body>
</html>`);
});

// Minimal unauthenticated Zuck Co-Pilot dev page
app.get('/zuck', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Zuck Co-Pilot (Dev)</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 20px; }
      textarea { width: 100%; min-height: 120px; font-family: inherit; font-size: 14px; }
      pre { background: #111; color: #eee; padding: 12px; border-radius: 6px; overflow: auto; white-space: pre-wrap; }
      .row { display: flex; gap: 12px; align-items: center; }
      .row > * { flex: 1; }
      button { padding: 10px 16px; border-radius: 6px; border: 1px solid #ccc; background: #1f6feb; color: white; cursor: pointer; }
    </style>
  </head>
  <body>
    <h1>Zuck Co-Pilot (Dev)</h1>
    <p>Auth is disabled for this page in dev. Provide a prompt and press Send.</p>
    <div>
      <label>Prompt</label>
      <textarea id="prompt">Design a product experiment loop to improve signal quality.</textarea>
    </div>
    <div class="row">
      <button id="send">Send</button>
      <label>Temperature <input id="temp" type="number" min="0" max="2" step="0.1" value="0.2" style="width: 80px;" /></label>
      <label>Max Tokens <input id="max" type="number" step="50" value="500" style="width: 100px;" /></label>
    </div>
    <h3>Response</h3>
    <pre id="out"></pre>
    <script>
      const BASE = (location.port === '3001') ? location.origin : (location.protocol + '//' + location.hostname + ':3001');
      async function post(path, body) {
        const url = path.startsWith('http') ? path : (BASE + path);
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok) throw new Error(await res.text());
        return ct.includes('application/json') ? res.json() : res.text();
      }
      document.getElementById('send').addEventListener('click', async () => {
        const prompt = document.getElementById('prompt').value;
        const temperature = parseFloat(document.getElementById('temp').value) || 0.2;
        const maxTokens = parseInt(document.getElementById('max').value, 10) || undefined;
        const out = document.getElementById('out');
        out.textContent = 'Loading...';
        try {
          const resp = await post('/api/copilot/chat', { prompt, temperature, maxTokens });
          out.textContent = typeof resp === 'string' ? resp : (resp.output || JSON.stringify(resp, null, 2));
        } catch (e) {
          out.textContent = 'Error: ' + (e.message || e);
        }
      });
    </script>
  </body>
</html>`);
});

// Minimal unauthenticated Elon Co-Pilot dev page
app.get('/elon', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Elon Co-Pilot (Dev)</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 20px; }
      textarea { width: 100%; min-height: 120px; font-family: inherit; font-size: 14px; }
      pre { background: #111; color: #eee; padding: 12px; border-radius: 6px; overflow: auto; white-space: pre-wrap; }
      .row { display: flex; gap: 12px; align-items: center; }
      .row > * { flex: 1; }
      button { padding: 10px 16px; border-radius: 6px; border: 1px solid #ccc; background: #1f6feb; color: white; cursor: pointer; }
    </style>
  </head>
  <body>
    <h1>Elon Co-Pilot (Dev)</h1>
    <p>Auth is disabled for this page in dev. Provide a prompt and press Send.</p>
    <div>
      <label>Prompt</label>
      <textarea id="prompt">Identify constraints and propose a first-principles simplification plan.</textarea>
    </div>
    <div class="row">
      <button id="send">Send</button>
      <label>Temperature <input id="temp" type="number" min="0" max="2" step="0.1" value="0.2" style="width: 80px;" /></label>
      <label>Max Tokens <input id="max" type="number" step="50" value="500" style="width: 100px;" /></label>
    </div>
    <h3>Response</h3>
    <pre id="out"></pre>
    <script>
      const BASE = (location.port === '3001') ? location.origin : (location.protocol + '//' + location.hostname + ':3001');
      async function post(path, body) {
        const url = path.startsWith('http') ? path : (BASE + path);
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok) throw new Error(await res.text());
        return ct.includes('application/json') ? res.json() : res.text();
      }
      document.getElementById('send').addEventListener('click', async () => {
        const prompt = document.getElementById('prompt').value;
        const temperature = parseFloat(document.getElementById('temp').value) || 0.2;
        const maxTokens = parseInt(document.getElementById('max').value, 10) || undefined;
        const out = document.getElementById('out');
        out.textContent = 'Loading...';
        try {
          const resp = await post('/api/elon/chat', { prompt, temperature, maxTokens });
          out.textContent = typeof resp === 'string' ? resp : (resp.output || JSON.stringify(resp, null, 2));
        } catch (e) {
          out.textContent = 'Error: ' + (e.message || e);
        }
      });
    </script>
  </body>
</html>`);
});

// Minimal unauthenticated Sora dev page (local alpha)
app.get('/sora', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sora (Dev)</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 20px; }
      textarea { width: 100%; min-height: 120px; font-family: inherit; font-size: 14px; }
      input { font-family: inherit; font-size: 14px; }
      pre { background: #111; color: #eee; padding: 12px; border-radius: 6px; overflow: auto; white-space: pre-wrap; }
      .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin: 10px 0; }
      .row > * { flex: 1; min-width: 160px; }
      button { padding: 10px 16px; border-radius: 6px; border: 1px solid #ccc; background: #1f6feb; color: white; cursor: pointer; }
      a { color: #1f6feb; }
      .muted { color: #555; font-size: 13px; }
    </style>
  </head>
  <body>
    <h1>Sora (Dev)</h1>
    <p class="muted">Local alpha UI. This calls <code>/api/sora</code> on the backend and saves output under <code>backend/generated/sora/</code>.</p>
    <div>
      <label><strong>Prompt</strong></label>
      <textarea id="prompt">A cinematic close-up of a hummingbird hovering over a bright flower, shallow depth of field, natural lighting.</textarea>
    </div>
    <div class="row">
      <label>Model <input id="model" value="sora-2" /></label>
      <label>Seconds <input id="seconds" type="number" min="1" step="1" value="8" /></label>
      <label>Size <input id="size" value="1280x720" /></label>
      <label>Auto-download <input id="auto" type="checkbox" checked /></label>
    </div>
    <div class="row">
      <button id="send">Generate</button>
      <button id="stop" disabled>Stop polling</button>
    </div>
    <h3>Status</h3>
    <pre id="out"></pre>
    <div id="links"></div>
    <script>
      const BASE = (location.port === '3001') ? location.origin : (location.protocol + '//' + location.hostname + ':3001');
      const out = document.getElementById('out');
      const links = document.getElementById('links');
      const btnStop = document.getElementById('stop');
      let pollTimer = null;
      let currentJobId = null;

      function setText(s) { out.textContent = String(s || ''); }

      async function post(path, body) {
        const url = path.startsWith('http') ? path : (BASE + path);
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok) throw new Error(await res.text());
        return ct.includes('application/json') ? res.json() : res.text();
      }

      async function get(path) {
        const url = path.startsWith('http') ? path : (BASE + path);
        const res = await fetch(url);
        const ct = res.headers.get('content-type') || '';
        if (!res.ok) throw new Error(await res.text());
        return ct.includes('application/json') ? res.json() : res.text();
      }

      function renderLinks(jobId, status, fileUrl) {
        const parts = [];
        parts.push('<p><strong>Job:</strong> <code>' + jobId + '</code> (<code>' + status + '</code>)</p>');
        parts.push('<ul>');
        parts.push('<li><a href="' + (BASE + '/api/sora/videos/' + encodeURIComponent(jobId) ) + '" target="_blank">Open status JSON</a></li>');
        parts.push('<li><a href="' + (BASE + '/api/sora/videos/' + encodeURIComponent(jobId) + '/download') + '" target="_blank">Force download (POST required)</a> <span class="muted">(use button below)</span></li>');
        if (fileUrl) parts.push('<li><a href="' + fileUrl + '" target="_blank">Open video file</a></li>');
        parts.push('</ul>');
        parts.push('<div class="row"><button id="forceDl">Force download now</button></div>');
        links.innerHTML = parts.join('');
        const btn = document.getElementById('forceDl');
        if (btn) btn.addEventListener('click', async () => {
          try {
            setText('Forcing download...');
            await post('/api/sora/videos/' + encodeURIComponent(jobId) + '/download', {});
            await pollOnce();
          } catch (e) {
            setText('Error: ' + (e.message || e));
          }
        });
      }

      async function pollOnce() {
        if (!currentJobId) return;
        const data = await get('/api/sora/videos/' + encodeURIComponent(currentJobId));
        const filePath = data && data.files && data.files.video_mp4 ? data.files.video_mp4 : null;
        const fileUrl = filePath ? (BASE + '/api/sora/videos/' + encodeURIComponent(currentJobId) + '/file') : null;
        setText(JSON.stringify(data, null, 2));
        renderLinks(currentJobId, data.status || 'unknown', fileUrl);
        if (data.status === 'completed' && filePath) {
          // stop polling when we have the file
          if (pollTimer) clearInterval(pollTimer);
          pollTimer = null;
          btnStop.disabled = true;
        }
      }

      function startPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(() => pollOnce().catch((e) => setText('Error: ' + (e.message || e))), 5000);
        btnStop.disabled = false;
      }

      document.getElementById('send').addEventListener('click', async () => {
        const prompt = document.getElementById('prompt').value;
        const model = document.getElementById('model').value;
        const seconds = parseInt(document.getElementById('seconds').value, 10);
        const size = document.getElementById('size').value;
        const autoDownload = !!document.getElementById('auto').checked;
        setText('Submitting job...');
        links.innerHTML = '';
        try {
          const resp = await post('/api/sora/videos', { prompt, model, seconds, size, autoDownload });
          currentJobId = resp.jobId;
          setText(JSON.stringify(resp, null, 2));
          renderLinks(currentJobId, resp.status || 'unknown', null);
          startPolling();
          await pollOnce();
        } catch (e) {
          setText('Error: ' + (e.message || e));
        }
      });

      btnStop.addEventListener('click', () => {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
        btnStop.disabled = true;
      });
    </script>
  </body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
