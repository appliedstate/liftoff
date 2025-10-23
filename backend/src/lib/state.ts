import fs from 'fs';
import path from 'path';

export type CooldownRecord = {
  id: string; // adset_id or campaign_id
  level: 'adset' | 'campaign';
  last_action?: 'bump_budget' | 'trim_budget' | 'hold';
  last_change_ts?: string; // ISO
  changes_last_7d?: number;
  next_eligible_ts?: string; // ISO
};

export type PolicyState = {
  id: string;
  level: 'adset' | 'campaign';
  roas_mean?: number;
  roas_var?: number;
  updates?: number;
  half_life_days?: number;
};

export function defaultStateBase(): string {
  return process.env.TERMINAL_STATE_BASE || path.join(process.cwd(), 'data', 'terminal_state');
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJson<T>(p: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) as T; } catch { return fallback; }
}

export function writeJson(p: string, obj: any): void {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

export function loadCooldowns(): Record<string, CooldownRecord> {
  const base = defaultStateBase();
  const p = path.join(base, 'cooldowns.json');
  return readJson<Record<string, CooldownRecord>>(p, {});
}

export function saveCooldowns(map: Record<string, CooldownRecord>): void {
  const base = defaultStateBase();
  const p = path.join(base, 'cooldowns.json');
  writeJson(p, map);
}

export function loadPolicy(): Record<string, PolicyState> {
  const base = defaultStateBase();
  const p = path.join(base, 'policy_state.json');
  return readJson<Record<string, PolicyState>>(p, {});
}

export function savePolicy(map: Record<string, PolicyState>): void {
  const base = defaultStateBase();
  const p = path.join(base, 'policy_state.json');
  writeJson(p, map);
}


