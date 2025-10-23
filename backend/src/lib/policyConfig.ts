import fs from 'fs';
import path from 'path';

export type Lane = 'ASC' | 'LAL_1' | 'LAL_2_5' | 'Contextual' | 'Sandbox' | 'Warm' | 'Default';

export type LanePolicy = {
  roas_up?: number;
  roas_hold?: number;
  roas_down?: number;
  step_up?: number;
  step_down?: number;
  max_step_up?: number;
  max_step_down?: number;
};

export type PolicyConfig = {
  lanes: Record<Lane, LanePolicy>;
};

const defaultConfig: PolicyConfig = {
  lanes: {
    Default: { roas_up: 1.3, roas_hold: 1.0, roas_down: 0.8, step_up: 0.2, step_down: -0.2, max_step_up: 0.4, max_step_down: -0.5 },
    ASC: { roas_up: 1.3, roas_hold: 1.0, roas_down: 0.8, step_up: 0.25, step_down: -0.2, max_step_up: 0.5, max_step_down: -0.5 },
    LAL_1: { roas_up: 1.3, roas_hold: 1.0, roas_down: 0.85, step_up: 0.2, step_down: -0.15, max_step_up: 0.4, max_step_down: -0.4 },
    LAL_2_5: { roas_up: 1.3, roas_hold: 1.0, roas_down: 0.85, step_up: 0.2, step_down: -0.15, max_step_up: 0.4, max_step_down: -0.4 },
    Contextual: { roas_up: 1.25, roas_hold: 1.0, roas_down: 0.85, step_up: 0.2, step_down: -0.2, max_step_up: 0.4, max_step_down: -0.5 },
    Sandbox: { roas_up: 1.4, roas_hold: 1.05, roas_down: 0.9, step_up: 0.15, step_down: -0.2, max_step_up: 0.3, max_step_down: -0.5 },
    Warm: { roas_up: 1.2, roas_hold: 1.0, roas_down: 0.9, step_up: 0.15, step_down: -0.15, max_step_up: 0.3, max_step_down: -0.4 },
  },
};

export function defaultPolicyConfigPath(): string {
  return process.env.TERMINAL_POLICY_CONFIG || path.join(process.cwd(), 'data', 'terminal_state', 'policy_config.json');
}

export function loadPolicyConfig(): PolicyConfig {
  const p = defaultPolicyConfigPath();
  try {
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as PolicyConfig;
      return { ...defaultConfig, ...raw, lanes: { ...defaultConfig.lanes, ...(raw.lanes || {}) } };
    }
  } catch {}
  return defaultConfig;
}

export function getLanePolicy(lane?: string | null): LanePolicy {
  const cfg = loadPolicyConfig();
  const key = (lane as Lane) || 'Default';
  return cfg.lanes[key] || cfg.lanes['Default'];
}


