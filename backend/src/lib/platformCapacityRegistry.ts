type PlatformAccount = {
  accountKey: string;
  platform: string;
  provider: string;
  partnerName: string | null;
  accountLabel: string;
  status: 'active' | 'degraded' | 'restricted' | 'expanding' | 'watch';
  policyRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  dailyCapacityEstimate: number | null;
  ownerTeam: string | null;
  sourceRef: string;
  notes: string;
  metadata?: Record<string, any>;
};

type OperatingContract = {
  contractKey: string;
  agreementType: string;
  contractLabel: string;
  primaryCounterparty: string;
  status: 'active' | 'draft' | 'watch';
  paymentFlowRole: string;
  executionScope: string;
  sourceRef: string;
  notes: string;
  metadata?: Record<string, any>;
};

type CapacityConstraint = {
  constraintKey: string;
  constraintType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'watch' | 'mitigating' | 'resolved';
  summary: string;
  affectedEntityType: 'platform_account' | 'contract' | 'workflow';
  affectedEntityKey: string;
  operatorOwner: string | null;
  sourceRef: string;
  notes: string;
  detectedAt: string | null;
  reviewDueAt: string | null;
  metadata?: Record<string, any>;
};

export const PLATFORM_ACCOUNTS: PlatformAccount[] = [
  {
    accountKey: 'meta_bm_nautilus',
    platform: 'facebook_business_manager',
    provider: 'Meta',
    partnerName: 'Nautilus',
    accountLabel: 'Nautilus Business Manager',
    status: 'restricted',
    policyRiskLevel: 'critical',
    dailyCapacityEstimate: null,
    ownerTeam: 'Media Buying',
    sourceRef:
      '/Users/ericroach/code/liftoff/docs/operations/meetings/2026/2026-04-29-team-media-buying-facebook-ops-sync/outcomes.md',
    notes:
      'The team recorded three restricted ad accounts inside Nautilus and treated the environment as higher-risk while restoration and redirect hygiene play out.',
    metadata: {
      restricted_ad_accounts_reported: 3,
      key_risks: ['account_restrictions', 'redirect_toxicity', 'trust_score_decay'],
    },
  },
  {
    accountKey: 'meta_bm_adnet',
    platform: 'facebook_business_manager',
    provider: 'Meta',
    partnerName: 'Adnet',
    accountLabel: 'Adnet Business Manager',
    status: 'expanding',
    policyRiskLevel: 'medium',
    dailyCapacityEstimate: 10000,
    ownerTeam: 'Media Buying',
    sourceRef:
      '/Users/ericroach/code/liftoff/docs/operations/meetings/2026/2026-04-29-team-media-buying-facebook-ops-sync/outcomes.md',
    notes:
      'Adnet is the cleaner Meta surface for near-term scaling while Nautilus remains under heavier restriction pressure.',
    metadata: {
      previous_daily_limit: 5000,
      expanded_daily_limit: 10000,
      current_focus: ['onboarding_bri', 'onboarding_mike'],
    },
  },
  {
    accountKey: 'newsbreak_buying',
    platform: 'newsbreak',
    provider: 'NewsBreak',
    partnerName: null,
    accountLabel: 'NewsBreak Buying Surface',
    status: 'active',
    policyRiskLevel: 'medium',
    dailyCapacityEstimate: null,
    ownerTeam: 'Media Buying',
    sourceRef:
      '/Users/ericroach/code/liftoff/docs/operations/meetings/2026/2026-04-29-team-media-buying-facebook-ops-sync/outcomes.md',
    notes:
      'NewsBreak remained one of the practical fallback buying surfaces while Meta restrictions persisted.',
  },
  {
    accountKey: 'system1_rsoc_org',
    platform: 'monetization',
    provider: 'System1',
    partnerName: 'Interlincx',
    accountLabel: 'System1 RSOC Revenue Surface',
    status: 'active',
    policyRiskLevel: 'medium',
    dailyCapacityEstimate: null,
    ownerTeam: 'Monetization / Finance',
    sourceRef:
      '/Users/ericroach/code/liftoff/docs/private/agreements/interlincx-naudilus-arbitrage-agreement.md',
    notes:
      'Interlincx is the contract holder and upstream revenue recipient for the RSOC program; this is a core commercial dependency rather than a buyer-controlled account.',
  },
  {
    accountKey: 'msn_account_adnet',
    platform: 'microsoft_advertising',
    provider: 'Microsoft',
    partnerName: 'Adnet',
    accountLabel: 'Adnet MSN Account',
    status: 'active',
    policyRiskLevel: 'medium',
    dailyCapacityEstimate: null,
    ownerTeam: 'Media Buying',
    sourceRef:
      '/Users/ericroach/code/liftoff/docs/private/agreements/naudilus-adnet-arbitrage-agreement.md',
    notes:
      'Adnet maintains ultimate administrative control and can impose account-safety controls, so execution capacity here is shared rather than solely internal.',
  },
];

export const OPERATING_CONTRACTS: OperatingContract[] = [
  {
    contractKey: 'interlincx_naudilus_arbitrage',
    agreementType: 'arbitrage_services',
    contractLabel: 'Interlincx × Naudilus Arbitrage Agreement',
    primaryCounterparty: 'Naudilus LLC',
    status: 'active',
    paymentFlowRole: 'Interlincx receives System1 funds, then remits to Naudilus on pay-as-paid terms.',
    executionScope: 'financial intermediary and downstream distribution for arbitrage program',
    sourceRef:
      '/Users/ericroach/code/liftoff/docs/private/agreements/interlincx-naudilus-arbitrage-agreement.md',
    notes:
      'This agreement makes upstream adjustments, clawbacks, and invalid-activity deductions explicit constraints on downstream cash movement.',
  },
  {
    contractKey: 'naudilus_adnet_account_access',
    agreementType: 'account_access_and_arbitrage',
    contractLabel: 'Naudilus × Adnet Account Access Agreement',
    primaryCounterparty: 'Adnet LLC',
    status: 'active',
    paymentFlowRole: 'Naudilus pays Adnet on a pay-as-paid basis after receiving funds from Interlincx.',
    executionScope: 'MSN account access, media buying direction, account safety controls',
    sourceRef:
      '/Users/ericroach/code/liftoff/docs/private/agreements/naudilus-adnet-arbitrage-agreement.md',
    notes:
      'Adnet retains ultimate administrative control and can suspend or constrain use to protect account standing.',
  },
  {
    contractKey: 'interlincx_adnet_sla',
    agreementType: 'service_level_agreement',
    contractLabel: 'Interlincx × Adnet Service Level Agreement',
    primaryCounterparty: 'Adnet LLC',
    status: 'active',
    paymentFlowRole: 'Defines service quality and operations; payment mechanics defer to Naudilus chain.',
    executionScope: 'media buying, product support, incident response, service levels',
    sourceRef:
      '/Users/ericroach/code/liftoff/docs/private/agreements/interlincx-adnet-sla-arbitrage-agreement.md',
    notes:
      'This agreement clarifies the order of precedence: Naudilus payment agreements control payment mechanics, while the SLA controls operating expectations.',
  },
];

export const CAPACITY_CONSTRAINTS: CapacityConstraint[] = [
  {
    constraintKey: 'nautilus_meta_restrictions',
    constraintType: 'policy_risk',
    severity: 'critical',
    status: 'active',
    summary: 'Nautilus is carrying multiple restricted ad accounts and is currently the highest-risk Meta execution surface.',
    affectedEntityType: 'platform_account',
    affectedEntityKey: 'meta_bm_nautilus',
    operatorOwner: 'Eric / Narbeh Ghazalian',
    sourceRef:
      '/Users/ericroach/code/liftoff/docs/operations/meetings/2026/2026-04-29-team-media-buying-facebook-ops-sync/outcomes.md',
    notes:
      'The team explicitly recorded three restricted ad accounts and treated restoration, cleanliness, and redirect hygiene as immediate operating priorities.',
    detectedAt: '2026-04-29',
    reviewDueAt: '2026-05-01',
  },
  {
    constraintKey: 'nautilus_dormant_account_auto_close',
    constraintType: 'capacity_decay',
    severity: 'high',
    status: 'active',
    summary: 'Dormant ad accounts risk automatic closure if safe keepalive activity is not executed in time.',
    affectedEntityType: 'platform_account',
    affectedEntityKey: 'meta_bm_nautilus',
    operatorOwner: 'Eric',
    sourceRef:
      '/Users/ericroach/code/liftoff/docs/operations/meetings/2026/2026-04-29-team-media-buying-facebook-ops-sync/outcomes.md',
    notes:
      'Unused account capacity is being treated as a scarce asset that must be preserved before it disappears.',
    detectedAt: '2026-04-29',
    reviewDueAt: '2026-04-30',
  },
  {
    constraintKey: 'redirect_rotation_toxicity',
    constraintType: 'platform_hygiene',
    severity: 'high',
    status: 'mitigating',
    summary: 'Redirect URLs behave like expiring operating assets and need scheduled rotation plus early retirement when deceptive-ad signals appear.',
    affectedEntityType: 'workflow',
    affectedEntityKey: 'meta_redirect_system',
    operatorOwner: 'Scott Anderson / Engineering',
    sourceRef:
      '/Users/ericroach/code/liftoff/docs/operations/meetings/2026/2026-04-29-team-media-buying-facebook-ops-sync/outcomes.md',
    notes:
      'The meeting made redirect hygiene a first-class scaling constraint rather than a buyer-memory problem.',
    detectedAt: '2026-04-29',
    reviewDueAt: '2026-05-01',
  },
  {
    constraintKey: 'adnet_daily_limit_expansion',
    constraintType: 'daily_spend_capacity',
    severity: 'medium',
    status: 'mitigating',
    summary: 'Adnet has more available Meta capacity than Nautilus, but the daily limit and onboarding flow still determine how quickly buyers can shift there.',
    affectedEntityType: 'platform_account',
    affectedEntityKey: 'meta_bm_adnet',
    operatorOwner: 'Ben / Narbeh Ghazalian',
    sourceRef:
      '/Users/ericroach/code/liftoff/docs/operations/meetings/2026/2026-04-29-team-media-buying-facebook-ops-sync/outcomes.md',
    notes:
      'The limit moved from 5k/day to 10k/day, but that is still a finite capacity surface that must be managed.',
    detectedAt: '2026-04-29',
    reviewDueAt: '2026-05-02',
  },
  {
    constraintKey: 'system1_pay_as_paid_adjustments',
    constraintType: 'working_capital_and_reconciliation',
    severity: 'medium',
    status: 'active',
    summary: 'Upstream RSOC cash flow remains subject to pay-as-paid timing and later adjustments, which constrains how aggressively downstream commitments can be treated as final.',
    affectedEntityType: 'contract',
    affectedEntityKey: 'interlincx_naudilus_arbitrage',
    operatorOwner: 'Finance / Operator',
    sourceRef:
      '/Users/ericroach/code/liftoff/docs/private/agreements/interlincx-naudilus-arbitrage-agreement.md',
    notes:
      'Clawbacks, invalid-activity deductions, and timing delays are explicitly part of the contract chain and therefore part of real scaling capacity.',
    detectedAt: null,
    reviewDueAt: null,
  },
  {
    constraintKey: 'adnet_admin_control_boundary',
    constraintType: 'admin_control',
    severity: 'medium',
    status: 'active',
    summary: 'Some buying surfaces are usable but not fully controlled internally because account administration and safety controls sit with Adnet.',
    affectedEntityType: 'contract',
    affectedEntityKey: 'naudilus_adnet_account_access',
    operatorOwner: 'Operator / Adnet',
    sourceRef:
      '/Users/ericroach/code/liftoff/docs/private/agreements/naudilus-adnet-arbitrage-agreement.md',
    notes:
      'This is not necessarily bad, but it is a real execution boundary the allocator and operator need to understand.',
    detectedAt: null,
    reviewDueAt: null,
  },
];
