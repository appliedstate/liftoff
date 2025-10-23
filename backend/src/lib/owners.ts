import fs from 'fs';
import path from 'path';

export type Role = 'admin' | 'manager' | 'buyer';

export type OwnerAccounts = {
  meta_account_ids?: string[]; // Facebook/Meta Ad Accounts
  google_account_ids?: string[];
  taboola_account_ids?: string[];
};

export type OwnersFile = {
  roles: Record<string, Role>;
  owners: Record<string, OwnerAccounts>;
};

const DEFAULT_OWNERS: OwnersFile = {
  roles: { eric: 'admin', ben: 'manager' },
  owners: {
    ben: { meta_account_ids: ['act_123', 'act_456'] },
  },
};

export function defaultOwnersPath(): string {
  return process.env.TERMINAL_OWNERS_PATH || path.join(process.cwd(), 'data', 'terminal_state', 'owners.json');
}

export function loadOwners(): OwnersFile {
  const p = defaultOwnersPath();
  try {
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as OwnersFile;
      // Merge defaults conservatively
      return {
        roles: { ...DEFAULT_OWNERS.roles, ...(raw.roles || {}) },
        owners: { ...DEFAULT_OWNERS.owners, ...(raw.owners || {}) },
      };
    }
  } catch {}
  return DEFAULT_OWNERS;
}

export function getRole(userIdOrName?: string | null): Role {
  const id = (userIdOrName || '').toString().toLowerCase();
  const cfg = loadOwners();
  return (cfg.roles[id] as Role) || 'buyer';
}

export function getOwnerAccounts(owner: string): OwnerAccounts | undefined {
  const cfg = loadOwners();
  return cfg.owners[(owner || '').toLowerCase()];
}

export function resolveScopeAndAccounts(args: {
  requesterId?: string | null;
  requestedOwner?: string | null;
  platform?: 'meta' | 'google' | 'taboola';
}): { effectiveOwner: string; role: Role; accountIds: string[] | null } {
  const platform = args.platform || 'meta';
  const requester = (args.requesterId || '').toString().toLowerCase() || 'eric';
  const requested = (args.requestedOwner || '').toString().toLowerCase();
  const role = getRole(requester);
  // Determine effective owner
  let effectiveOwner = requester;
  if (requested === 'all') {
    effectiveOwner = role === 'admin' || role === 'manager' ? 'all' : requester;
  } else if (requested) {
    effectiveOwner = requested;
  }
  // Resolve account IDs
  let accountIds: string[] | null = null;
  if (effectiveOwner !== 'all') {
    const acct = getOwnerAccounts(effectiveOwner);
    const field = platform === 'meta' ? 'meta_account_ids' : platform === 'google' ? 'google_account_ids' : 'taboola_account_ids';
    accountIds = (acct && (acct as any)[field]) || null;
  }
  return { effectiveOwner, role, accountIds };
}


