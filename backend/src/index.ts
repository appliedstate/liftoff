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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});