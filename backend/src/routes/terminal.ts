import express from 'express';
import fs from 'fs';
import path from 'path';
import { authenticateUser } from '../middleware/auth';
import { latestSnapshotDir, defaultSnapshotsBase, readManifest } from '../lib/snapshots';
import { writeDecisionBatch, Decision, defaultDecisionsBase } from '../lib/decisions';
import { loadCooldowns, saveCooldowns, loadPolicy, savePolicy } from '../lib/state';
import { getLanePolicy } from '../lib/policyConfig';
import { resolveScopeAndAccounts } from '../lib/owners';

// Lazy import to avoid bundling issues if duckdb binary not present in some envs
async function queryDuckDb(sql: string, params: any[] = []): Promise<any[]> {
  const duckdb = await import('duckdb');
  const db = new duckdb.Database(':memory:');
  const conn = db.connect();
  try {
    const rows: any[] = await new Promise((resolve, reject) => {
      conn.all(sql, params, (err: any, res: any[]) => (err ? reject(err) : resolve(res)));
    });
    return rows;
  } finally {
    conn.close();
  }
}

const router = express.Router();

type Level = 'adset' | 'campaign';

router.get('/reconciled', authenticateUser, async (req, res) => {
  try {
    const level = (req.query.level === 'campaign' ? 'campaign' : 'adset') as Level;
    const date = (req.query.date as string) || null; // if null, select all dates under latest snapshot
    const accountIds = ((req.query.account_ids as string) || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const base = defaultSnapshotsBase();
    const snap = latestSnapshotDir(base);
    if (!snap) return res.status(404).json({ code: 'not_found', message: 'No snapshots found' });

    // Accept both parquet and csv parts under hive-style dirs
    const globPath = path.join(snap, `level=${level}`, `date=${date || '*'}`, `*.*`);
    // DuckDB can expand globbing via read_* functions
    const whereParts: string[] = [];
    const params: any[] = [];
    if (date) {
      whereParts.push(`date = ?`);
      params.push(date);
    }
    if (accountIds.length) {
      whereParts.push(`account_id in (${accountIds.map(() => '?').join(',')})`);
      params.push(...accountIds);
    }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const sql = `
      WITH unioned AS (
        SELECT * FROM read_parquet('${globPath}')
        UNION ALL
        SELECT * FROM read_csv_auto('${globPath}', IGNORE_ERRORS=true)
      )
      SELECT * FROM unioned
      ${where}
    `;
    const rows = await queryDuckDb(sql, params);

    return res.status(200).json({ meta: { snapshot_dir: snap, level, date }, data: rows });
  } catch (err) {
    console.error('terminal.reconciled error', err);
    return res.status(500).json({ code: 'internal_error', message: 'Failed to read reconciled data' });
  }
});

// Simple deterministic policy simulator (daily phase): returns intents with reasons
router.post('/simulate', authenticateUser, async (req, res) => {
  try {
    const { rows, policy: policyOverride, mode } = req.body || {};
    if (!Array.isArray(rows)) return res.status(400).json({ code: 'bad_request', message: 'rows[] required' });
    const cfg = Object.assign(
      {
        roas_up: 1.3,
        roas_hold: 1.0,
        roas_down: 0.8,
        step_up: 0.2,
        step_down: -0.2,
        max_step_up: 0.4,
        max_step_down: -0.5,
      },
      policyOverride || {},
    );

    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
    function simulate_simple(r: any) {
      const roas = Number(r.roas || 0);
      const supportsBudget = !!r.supports_budget_change;
      const supportsBid = !!r.supports_bid_cap;
      let action: string = 'hold';
      let delta = 0;
      let reason = '';
      if (roas >= cfg.roas_up) {
        action = 'bump_budget';
        delta = clamp(cfg.step_up, 0.05, cfg.max_step_up);
        reason = `ROAS ${roas.toFixed(2)} ≥ ${cfg.roas_up}`;
      } else if (roas < cfg.roas_down) {
        action = 'trim_budget';
        delta = clamp(cfg.step_down, cfg.max_step_down, -0.05);
        reason = `ROAS ${roas.toFixed(2)} < ${cfg.roas_down}`;
      } else if (roas >= cfg.roas_hold && roas < cfg.roas_up) {
        action = 'hold';
        delta = 0;
        reason = `ROAS ${roas.toFixed(2)} in [${cfg.roas_hold}, ${cfg.roas_up})`;
      } else {
        action = 'hold';
        delta = 0;
        reason = `Ambiguous`;
      }

      if (!supportsBudget && (action === 'bump_budget' || action === 'trim_budget')) {
        action = 'hold';
        delta = 0;
        reason += ' (budget change not supported)';
      }

      // Include a conservative bid cap hint when supported and loser
      let bidHint: number | null = null;
      if (supportsBid && action === 'trim_budget') {
        bidHint = 0.9; // suggest -10% bid cap as a hint
      }

      const id = r.adset_id || r.campaign_id;
      return {
        id,
        level: r.level,
        account_id: r.account_id,
        action,
        budget_multiplier: action === 'hold' ? 1 : 1 + delta,
        bid_cap_multiplier: bidHint,
        reason,
      };
    }

    function simulate_kelly(r: any) {
      // Kelly-lite using ROAS vs 1.0 as edge proxy
      const roas = Number(r.roas || 0);
      const edge = Math.max(-0.5, Math.min(0.5, roas - 1.0));
      const frac = Math.max(-0.5, Math.min(0.5, edge)); // bounded position size
      let action = 'hold';
      let delta = 0;
      if (frac > 0.05) {
        action = 'bump_budget';
        delta = Math.min(cfg.max_step_up, Math.max(cfg.step_up, frac));
      } else if (frac < -0.05) {
        action = 'trim_budget';
        delta = Math.max(cfg.max_step_down, Math.min(cfg.step_down, frac));
      }
      const id = r.adset_id || r.campaign_id;
      return {
        id,
        level: r.level,
        account_id: r.account_id,
        action,
        budget_multiplier: action === 'hold' ? 1 : 1 + delta,
        bid_cap_multiplier: null,
        reason: `kelly-lite edge=${edge.toFixed(3)}`,
      };
    }

    function simulate_ucb(allRows: any[], r: any) {
      // UCB on mean ROAS with a simple count proxy = impressions
      const impressions = Math.max(1, Number(r.impressions || 1));
      const mean = Number(r.roas || 0);
      const t = allRows.reduce((a, x) => a + Math.max(1, Number(x.impressions || 1)), 0);
      const c = 1.5; // exploration weight
      const ucb = mean + Math.sqrt((c * Math.log(t)) / impressions);
      let action = 'hold';
      let delta = 0;
      if (ucb >= cfg.roas_up) {
        action = 'bump_budget';
        delta = cfg.step_up;
      } else if (mean < cfg.roas_down) {
        action = 'trim_budget';
        delta = cfg.step_down;
      }
      const id = r.adset_id || r.campaign_id;
      return {
        id,
        level: r.level,
        account_id: r.account_id,
        action,
        budget_multiplier: action === 'hold' ? 1 : 1 + delta,
        bid_cap_multiplier: null,
        reason: `ucb=${ucb.toFixed(3)} mean=${mean.toFixed(3)}`,
      };
    }

    const cooldowns = loadCooldowns();
    const entityPolicy = loadPolicy();
    const intents = rows.map((r: any) => {
      if (mode === 'kelly') return simulate_kelly(r);
      if (mode === 'ucb') return simulate_ucb(rows, r);
      const sim = simulate_simple(r);
      const id = r.adset_id || r.campaign_id;
      const cd = cooldowns[id];
      const nowIso = new Date().toISOString();
      if (cd && cd.next_eligible_ts && cd.next_eligible_ts > nowIso && sim.action !== 'hold') {
        sim.action = 'hold';
      }
      return sim;
    });

    return res.status(200).json({ intents });
  } catch (err) {
    console.error('terminal.simulate error', err);
    return res.status(500).json({ code: 'internal_error', message: 'Simulation failed' });
  }
});

export default router;
// Portfolio summary (owner-scoped)
router.get('/summary', authenticateUser, async (req, res) => {
  try {
    const level = (req.query.level === 'campaign' ? 'campaign' : 'adset') as Level;
    const date = (req.query.date as string) || new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    const base = defaultSnapshotsBase();
    const snap = latestSnapshotDir(base);
    if (!snap) return res.status(404).json({ code: 'not_found', message: 'No snapshots found' });
    const globPath = path.join(snap, `level=${level}`, `date=${date}`, `*.*`);

    const scope = resolveScopeAndAccounts({ requesterId: (req as any).user?.name || (req as any).user?.id || 'eric', requestedOwner: (req.query.owner as string) || null, platform: 'meta' });
    const params: any[] = [];
    let where = 'WHERE date = ?';
    params.push(date);
    if (scope.accountIds && scope.accountIds.length) {
      where += ` AND account_id in (${scope.accountIds.map(() => '?').join(',')})`;
      params.push(...scope.accountIds);
    }

    const sql = `
      WITH unioned AS (
        SELECT * FROM read_parquet('${globPath}')
        UNION ALL
        SELECT * FROM read_csv_auto('${globPath}', IGNORE_ERRORS=true)
      )
      SELECT 
        '${date}' as date,
        '${level}' as level,
        SUM(spend_usd) as spend_usd,
        SUM(revenue_usd) as revenue_usd,
        SUM(net_margin_usd) as net_margin_usd,
        (CASE WHEN SUM(spend_usd) > 0 THEN SUM(revenue_usd)/SUM(spend_usd) ELSE 0 END) as roas,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(sessions) as sessions,
        SUM(conversions) as conversions
      FROM unioned
      ${where}
    `;
    const rows = await queryDuckDb(sql, params);
    return res.status(200).json({ owner: scope.effectiveOwner, role: scope.role, data: rows[0] || null });
  } catch (err) {
    console.error('terminal.summary error', err);
    return res.status(500).json({ code: 'internal_error', message: 'Summary failed' });
  }
});

// Inspect policy + cooldown state
router.get('/state', authenticateUser, async (req, res) => {
  try {
    const entityPolicy2 = loadPolicy();
    const cooldowns = loadCooldowns();
    return res.status(200).json({ policy: entityPolicy2, cooldowns });
  } catch (err) {
    console.error('terminal.state error', err);
    return res.status(500).json({ code: 'internal_error', message: 'Failed to load state' });
  }
});

// Learn/Evaluator: join previous decisions with reconciled outcomes and update policy state
router.post('/learn', authenticateUser, async (req, res) => {
  try {
    const date = (req.query.date as string) || new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    const level = (req.query.level === 'campaign' ? 'campaign' : 'adset') as Level;
    const base = defaultDecisionsBase();
    const decisionsDir = path.join(base, date);
    if (!fs.existsSync(decisionsDir)) return res.status(404).json({ code: 'not_found', message: `No decisions for ${date}` });

    // Load decisions (aggregate all JSONL files)
    const files = fs.readdirSync(decisionsDir).filter((f) => f.startsWith('decisions_') && f.endsWith('.jsonl'));
    const decisions: Decision[] = [] as any;
    for (const f of files) {
      const text = fs.readFileSync(path.join(decisionsDir, f), 'utf8').trim();
      if (!text) continue;
      for (const line of text.split('\n')) {
        try { decisions.push(JSON.parse(line)); } catch {}
      }
    }
    if (!decisions.length) return res.status(404).json({ code: 'not_found', message: 'No decisions to learn from' });

    // Load reconciled outcomes for date via DuckDB
    const snap = latestSnapshotDir(defaultSnapshotsBase());
    if (!snap) return res.status(404).json({ code: 'not_found', message: 'No snapshots found' });
    const globPath = path.join(snap, `level=${level}`, `date=${date}`, `*.*`);
    // Freshness gate: ensure manifest contains the date and it's past 05:00 local
    const manifest = readManifest(snap);
    const now = new Date();
    const fiveAM = new Date(now);
    fiveAM.setHours(5, 0, 0, 0);
    if (!manifest || !manifest.dates.has(date) || now < fiveAM) {
      return res.status(425).json({ code: 'not_ready', message: 'Reconciled snapshot not ready (manifest/date gate or time < 05:00 local)' });
    }
    const sql = `
      WITH unioned AS (
        SELECT * FROM read_parquet('${globPath}')
        UNION ALL
        SELECT * FROM read_csv_auto('${globPath}', IGNORE_ERRORS=true)
      )
      SELECT * FROM unioned WHERE date = ?
    `;
    const rows = await queryDuckDb(sql, [date]);

    // Index outcomes by id
    const byId = new Map<string, any>();
    for (const r of rows) {
      const id = r.adset_id || r.campaign_id;
      if (id) byId.set(String(id), r);
    }

    // Update policy state: rolling ROAS mean/var with simple Welford and half-life decay
    const entityPolicy = loadPolicy();
    const halfLifeDays = 14;
    const decayFactor = Math.pow(0.5, 1 / halfLifeDays);
    for (const d of decisions) {
      const id = d.id;
      const outcome = byId.get(String(id));
      if (!outcome) continue;
      const roas = Number(outcome.roas || 0);
      const key = String(id);
      const prev = policy[key] || { id: key, level };
      const n = (prev.updates || 0) + 1;
      const meanPrev = prev.roas_mean ?? roas;
      const mean = decayFactor * meanPrev + (1 - decayFactor) * roas;
      const varPrev = prev.roas_var ?? 0;
      const roasVar = decayFactor * varPrev + (1 - decayFactor) * Math.pow(roas - mean, 2);
      policy[key] = { id: key, level, roas_mean: mean, roas_var: roasVar, updates: n, half_life_days: halfLifeDays };
    }
    savePolicy(policy);

    // Emit a brief learn report
    const updated = Object.keys(policy).length;
    return res.status(200).json({ date, level, learned_from: decisions.length, policy_size: updated });
  } catch (err) {
    console.error('terminal.learn error', err);
    return res.status(500).json({ code: 'internal_error', message: 'Learn failed' });
  }
});


// Mark decisions as applied (manual confirmation). Updates cooldown registry.
router.post('/applied', authenticateUser, async (req, res) => {
  try {
    const { decisions, cooldown_hours = 24 } = req.body || {};
    if (!Array.isArray(decisions)) return res.status(400).json({ code: 'bad_request', message: 'decisions[] required' });
    const cooldowns = loadCooldowns();
    const now = new Date();
    const next = new Date(now.getTime() + Number(cooldown_hours) * 3600 * 1000).toISOString();
    // Append to applied log (by decision date)
    const appliedByDate: Record<string, any[]> = {};
    for (const d of decisions) {
      const id = d.id || d.adset_id || d.campaign_id;
      if (!id) continue;
      const key = id as string;
      const prev = cooldowns[key] || { id: key, level: d.level };
      cooldowns[key] = {
        ...prev,
        last_action: d.action,
        last_change_ts: now.toISOString(),
        changes_last_7d: (prev.changes_last_7d || 0) + 1,
        next_eligible_ts: next,
      };
      const date = d.date || now.toISOString().slice(0,10);
      (appliedByDate[date] ||= []).push({
        decision_id: d.decision_id || `${date}:${d.level}:${key}`,
        id: key,
        level: d.level,
        account_id: d.account_id || null,
        action: d.action,
        applied_at: now.toISOString(),
      });
    }
    saveCooldowns(cooldowns);
    // Write applied logs
    for (const [date, rows] of Object.entries(appliedByDate)) {
      const base = path.join(process.cwd(), 'data', 'terminal_state', 'applied', date);
      fs.mkdirSync(base, { recursive: true });
      const f = path.join(base, `applied_${now.toISOString().replace(/[:.]/g,'').slice(0,15)}.jsonl`);
      fs.writeFileSync(f, rows.map((r) => JSON.stringify(r)).join('\n'));
    }
    return res.status(200).json({ updated: decisions.length });
  } catch (err) {
    console.error('terminal.applied error', err);
    return res.status(500).json({ code: 'internal_error', message: 'Failed to update applied decisions' });
  }
});

// Suggest endpoint: fetch rows, simulate, persist decisions and summary
router.post('/suggest', authenticateUser, async (req, res) => {
  try {
    const level = (req.query.level === 'campaign' ? 'campaign' : 'adset') as Level;
    const date = (req.query.date as string) || new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    const mode = (req.query.mode as string) || 'kelly';
    const accountIds = ((req.query.account_ids as string) || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Load rows from latest snapshot
    const base = defaultSnapshotsBase();
    const snap = latestSnapshotDir(base);
    if (!snap) return res.status(404).json({ code: 'not_found', message: 'No snapshots found' });

    const globPath = path.join(snap, `level=${level}`, `date=${date}`, `*.*`);
    // Freshness gate: ensure manifest contains the date and it's past 05:00 local
    const manifest = readManifest(snap);
    const now = new Date();
    const fiveAM = new Date(now);
    fiveAM.setHours(5, 0, 0, 0);
    if (!manifest || !manifest.dates.has(date) || now < fiveAM) {
      return res.status(425).json({ code: 'not_ready', message: 'Reconciled snapshot not ready (manifest/date gate or time < 05:00 local)' });
    }
    const whereParts: string[] = [];
    const params: any[] = [];
    whereParts.push(`date = ?`); params.push(date);
    // Owner scoping and RBAC
    const scope = resolveScopeAndAccounts({ requesterId: (req as any).user?.name || (req as any).user?.id || 'eric', requestedOwner: (req.query.owner as string) || null, platform: 'meta' });
    const scopedAccounts = scope.accountIds || accountIds;
    if (scopedAccounts.length) { whereParts.push(`account_id in (${scopedAccounts.map(() => '?').join(',')})`); params.push(...scopedAccounts); }
    const where = `WHERE ${whereParts.join(' AND ')}`;

    const sql = `
      WITH unioned AS (
        SELECT * FROM read_parquet('${globPath}')
        UNION ALL
        SELECT * FROM read_csv_auto('${globPath}', IGNORE_ERRORS=true)
      )
      SELECT * FROM unioned
      ${where}
    `;
    const rows = await queryDuckDb(sql, params);

    // Simulate intents using existing simulator
    // Lane-specific policy thresholds
    const cfgDefault = { roas_up: 1.3, roas_hold: 1.0, roas_down: 0.8, step_up: 0.2, step_down: -0.2, max_step_up: 0.4, max_step_down: -0.5 };
    const impressionsTotal = rows.reduce((a: number, x: any) => a + Math.max(1, Number(x.impressions || 1)), 0);
    function laneCfg(r: any) { const lane = r.lane || null; const lp = getLanePolicy(lane); return { ...cfgDefault, ...lp }; }
    function simulate_simple(r: any) { const cfg = laneCfg(r); const roas = Number(r.roas || 0); let action = 'hold'; let delta = 0; if (roas >= cfg.roas_up!) { action = 'bump_budget'; delta = cfg.step_up!; } else if (roas < cfg.roas_down!) { action = 'trim_budget'; delta = cfg.step_down!; } return { action, delta, reason: `roas=${roas.toFixed(2)}` }; }
    function simulate_kelly(r: any) { const cfg = laneCfg(r); const roas = Number(r.roas || 0); const edge = Math.max(-0.5, Math.min(0.5, roas - 1.0)); let action='hold', delta=0; if (edge>0.05){action='bump_budget'; delta=Math.min(cfg.max_step_up!, Math.max(cfg.step_up!, edge));} else if (edge<-0.05){action='trim_budget'; delta=Math.max(cfg.max_step_down!, Math.min(cfg.step_down!, edge));} return { action, delta, reason: `kelly edge=${edge.toFixed(3)}`}; }
    function simulate_ucb(r: any) { const cfg = laneCfg(r); const impressions = Math.max(1, Number(r.impressions || 1)); const mean = Number(r.roas || 0); const c=1.5; const ucb = mean + Math.sqrt((c*Math.log(Math.max(1, impressionsTotal)))/impressions); let action='hold', delta=0; if (ucb>=cfg.roas_up!){action='bump_budget'; delta=cfg.step_up!;} else if (mean<cfg.roas_down!){action='trim_budget'; delta=cfg.step_down!;} return { action, delta, reason: `ucb=${ucb.toFixed(3)} mean=${mean.toFixed(3)}`}; }
    const cooldowns = loadCooldowns();
    const entityPolicy2 = loadPolicy();
    const minUpdates = Number(process.env.TERMINAL_MIN_UPDATES ?? '3');
    const maxSigma = Number(process.env.TERMINAL_MAX_SIGMA ?? '0.5');

    const intents = rows.map((r: any) => {
      const sim = mode === 'ucb' ? simulate_ucb(r) : mode === 'kelly' ? simulate_kelly(r) : simulate_simple(r);
      const id = r.adset_id || r.campaign_id;
      // Confidence scaling from policy state (roas_mean/var, updates)
      const st = entityPolicy[String(id)];
      const updates = st?.updates ?? 0;
      const sigma = Math.sqrt(st?.roas_var ?? 0);
      const updatesFactor = Math.min(1, updates / 10);
      const sigmaFactor = 1 / (1 + sigma);
      const stepScale = Math.max(0.3, 0.2 + 0.8 * updatesFactor) * sigmaFactor;
      // Confidence floor gating
      if (updates < minUpdates || sigma > maxSigma) {
        sim.action = 'hold';
        sim.delta = 0;
        sim.reason += ` (low_conf updates=${updates} sigma=${sigma.toFixed(2)})`;
      }
      if (sim.action !== 'hold') {
        sim.delta = sim.delta * stepScale;
        sim.reason += ` (conf_scale=${stepScale.toFixed(2)})`;
      }
      const budget = Number(r.current_budget_usd || r.budget_usd || 0);
      const utilization = Math.max(0, Math.min(1, Number(r.recent_spend_usd || r.spend_usd || 0) / (budget || 1)));
      const spendDelta = sim.action === 'hold' ? 0 : budget * (sim.delta) * utilization;
      // Cooldown gating: if not eligible, force hold
      const cd = cooldowns[id];
      const nowIso = new Date().toISOString();
      if (cd && cd.next_eligible_ts && cd.next_eligible_ts > nowIso && sim.action !== 'hold') {
        sim.action = 'hold';
        sim.delta = 0;
      }

      return {
        decision_id: `${date}:${level}:${id}`,
        id,
        level,
        account_id: r.account_id || null,
        action: sim.action,
        budget_multiplier: sim.action === 'hold' ? 1 : 1 + sim.delta,
        bid_cap_multiplier: null,
        spend_delta_usd: Number.isFinite(spendDelta) ? spendDelta : null,
        reason: sim.reason,
        policy_version: 'v1',
        confidence: null,
        date,
        snapshot_dir: snap,
        created_at: new Date().toISOString(),
      } as Decision;
    });

    // Rank by action and magnitude
    intents.sort((a, b) => {
      const score = (x: Decision) => (x.action === 'hold' ? 0 : Math.abs((x.budget_multiplier || 1) - 1));
      return score(b) - score(a);
    });

    const totals = intents.reduce((a, d) => {
      a.count++;
      if (d.action === 'bump_budget') a.bump++;
      else if (d.action === 'trim_budget') a.trim++;
      else a.hold++;
      a.delta += Number(d.spend_delta_usd || 0);
      return a;
    }, { count: 0, bump: 0, trim: 0, hold: 0, delta: 0 });
    const summary = [
      `Terminal suggestions for ${date} (${level})`,
      `Snapshot: ${snap}`,
      `mode=${mode} total=${totals.count}  bump=${totals.bump}  trim=${totals.trim}  hold=${totals.hold}  est_spend_delta=${totals.delta.toFixed(2)} USD`,
      ...intents.slice(0, 10).map((d) => `- ${d.level}:${d.id} ${d.action} x${(d.budget_multiplier || 1).toFixed(2)} Δ$${(d.spend_delta_usd || 0).toFixed(2)} — ${d.reason}`),
    ].join('\n');

    const paths = writeDecisionBatch(date, intents, summary);
    return res.status(200).json({ meta: { date, level, mode, snapshot_dir: snap }, data: intents, files: paths, summary });
  } catch (err) {
    console.error('terminal.suggest error', err);
    return res.status(500).json({ code: 'internal_error', message: 'Suggest failed' });
  }
});

function toCsvInline(rows: Decision[]): string {
  if (!rows.length) return '';
  const header = ['decision_id','id','level','account_id','action','budget_multiplier','bid_cap_multiplier','spend_delta_usd','reason','policy_version','confidence','date','snapshot_dir','created_at'];
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map((k) => escape((r as any)[k])).join(','));
  return lines.join('\n');
}

// Co-pilot suggest: same as suggest, but also returns inline CSV for immediate use
router.post('/copilot/suggest', authenticateUser, async (req, res) => {
  try {
    const level = (req.query.level === 'campaign' ? 'campaign' : 'adset') as Level;
    const date = (req.query.date as string) || new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    const mode = (req.query.mode as string) || 'kelly';
    const accountIds = ((req.query.account_ids as string) || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const base = defaultSnapshotsBase();
    const snap = latestSnapshotDir(base);
    if (!snap) return res.status(404).json({ code: 'not_found', message: 'No snapshots found' });

    const globPath = path.join(snap, `level=${level}`, `date=${date}`, `*.*`);
    const whereParts: string[] = [];
    const params: any[] = [];
    whereParts.push(`date = ?`); params.push(date);
    const scope = resolveScopeAndAccounts({ requesterId: (req as any).user?.name || (req as any).user?.id || 'eric', requestedOwner: (req.query.owner as string) || null, platform: 'meta' });
    const scopedAccounts = scope.accountIds || accountIds;
    if (scopedAccounts.length) { whereParts.push(`account_id in (${scopedAccounts.map(() => '?').join(',')})`); params.push(...scopedAccounts); }
    const where = `WHERE ${whereParts.join(' AND ')}`;

    const sql = `
      WITH unioned AS (
        SELECT * FROM read_parquet('${globPath}')
        UNION ALL
        SELECT * FROM read_csv_auto('${globPath}', IGNORE_ERRORS=true)
      )
      SELECT * FROM unioned
      ${where}
    `;
    const rows = await queryDuckDb(sql, params);

    const cfgDefault = { roas_up: 1.3, roas_hold: 1.0, roas_down: 0.8, step_up: 0.2, step_down: -0.2, max_step_up: 0.4, max_step_down: -0.5 };
    const impressionsTotal = rows.reduce((a: number, x: any) => a + Math.max(1, Number(x.impressions || 1)), 0);
    function laneCfg(r: any) { const lane = r.lane || null; const lp = getLanePolicy(lane); return { ...cfgDefault, ...lp }; }
    function simulate_simple(r: any) { const cfg = laneCfg(r); const roas = Number(r.roas || 0); let action = 'hold'; let delta = 0; if (roas >= cfg.roas_up!) { action = 'bump_budget'; delta = cfg.step_up!; } else if (roas < cfg.roas_down!) { action = 'trim_budget'; delta = cfg.step_down!; } return { action, delta, reason: `roas=${roas.toFixed(2)}` }; }
    function simulate_kelly(r: any) { const cfg = laneCfg(r); const roas = Number(r.roas || 0); const edge = Math.max(-0.5, Math.min(0.5, roas - 1.0)); let action='hold', delta=0; if (edge>0.05){action='bump_budget'; delta=Math.min(cfg.max_step_up!, Math.max(cfg.step_up!, edge));} else if (edge<-0.05){action='trim_budget'; delta=Math.max(cfg.max_step_down!, Math.min(cfg.step_down!, edge));} return { action, delta, reason: `kelly edge=${edge.toFixed(3)}`}; }
    function simulate_ucb(r: any) { const cfg = laneCfg(r); const impressions = Math.max(1, Number(r.impressions || 1)); const mean = Number(r.roas || 0); const c=1.5; const ucb = mean + Math.sqrt((c*Math.log(Math.max(1, impressionsTotal)))/impressions); let action='hold', delta=0; if (ucb>=cfg.roas_up!){action='bump_budget'; delta=cfg.step_up!;} else if (mean<cfg.roas_down!){action='trim_budget'; delta=cfg.step_down!;} return { action, delta, reason: `ucb=${ucb.toFixed(3)} mean=${mean.toFixed(3)}`}; }
    const cooldowns = loadCooldowns();
    const policy = loadPolicy();
    const minUpdates = Number(process.env.TERMINAL_MIN_UPDATES ?? '3');
    const maxSigma = Number(process.env.TERMINAL_MAX_SIGMA ?? '0.5');

    const intents = rows.map((r: any) => {
      const sim = mode === 'ucb' ? simulate_ucb(r) : mode === 'kelly' ? simulate_kelly(r) : simulate_simple(r);
      const id = r.adset_id || r.campaign_id;
      const st = entityPolicy2[String(id)];
      const updates = st?.updates ?? 0;
      const sigma = Math.sqrt(st?.roas_var ?? 0);
      const updatesFactor = Math.min(1, updates / 10);
      const sigmaFactor = 1 / (1 + sigma);
      const stepScale = Math.max(0.3, 0.2 + 0.8 * updatesFactor) * sigmaFactor;
      if (updates < minUpdates || sigma > maxSigma) {
        sim.action = 'hold';
        sim.delta = 0;
        sim.reason += ` (low_conf updates=${updates} sigma=${sigma.toFixed(2)})`;
      }
      const cd = cooldowns[id];
      const nowIso = new Date().toISOString();
      if (cd && cd.next_eligible_ts && cd.next_eligible_ts > nowIso && sim.action !== 'hold') {
        sim.action = 'hold';
        sim.delta = 0;
      }
      if (sim.action !== 'hold') {
        sim.delta = sim.delta * stepScale;
        sim.reason += ` (conf_scale=${stepScale.toFixed(2)})`;
      }
      return {
        decision_id: `${date}:${level}:${id}`,
        id,
        level,
        account_id: r.account_id || null,
        action: sim.action,
        budget_multiplier: sim.action === 'hold' ? 1 : 1 + sim.delta,
        bid_cap_multiplier: null,
        reason: sim.reason,
        policy_version: 'v1',
        confidence: null,
        date,
        snapshot_dir: snap,
        created_at: new Date().toISOString(),
      } as Decision;
    });

    intents.sort((a, b) => {
      const score = (x: Decision) => (x.action === 'hold' ? 0 : Math.abs((x.budget_multiplier || 1) - 1));
      return score(b) - score(a);
    });

    const summary = [
      `Terminal suggestions for ${date} (${level})`,
      `Snapshot: ${snap}`,
      `mode=${mode} total=${intents.length}`,
      ...intents.slice(0, 10).map((d) => `- ${d.level}:${d.id} ${d.action} x${(d.budget_multiplier || 1).toFixed(2)} — ${d.reason}`),
    ].join('\n');

    const csv = toCsvInline(intents);
    return res.status(200).json({ meta: { date, level, mode, snapshot_dir: snap }, data: intents, summary, csv });
  } catch (err) {
    console.error('terminal.copilot.suggest error', err);
    return res.status(500).json({ code: 'internal_error', message: 'Co-pilot suggest failed' });
  }
});

router.get('/policy-config', authenticateUser, async (req, res) => {
  try {
    const cfg = require('../lib/policyConfig');
    // dynamic import to read current file on each request
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { loadPolicyConfig } = cfg;
    const conf = loadPolicyConfig();
    return res.status(200).json(conf);
  } catch (err) {
    console.error('terminal.policy-config error', err);
    return res.status(500).json({ code: 'internal_error', message: 'Failed to load policy config' });
  }
});

