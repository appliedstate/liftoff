import { CAPACITY_CONSTRAINTS, PLATFORM_ACCOUNTS } from './platformCapacityRegistry';

function severityRank(value: string): number {
  switch (value) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    default:
      return 3;
  }
}

function normalize(value: string | null | undefined): string {
  return String(value || '').trim();
}

export async function getSurfacePreservationCommandLayerReport(): Promise<any> {
  const accountsByKey = new Map(PLATFORM_ACCOUNTS.map((account) => [account.accountKey, account]));
  const activeConstraints = CAPACITY_CONSTRAINTS.filter((constraint) => constraint.status !== 'resolved');

  const commands: any[] = [];

  for (const constraint of activeConstraints) {
    if (constraint.constraintKey === 'nautilus_meta_restrictions') {
      const account = accountsByKey.get(String(constraint.affectedEntityKey));
      commands.push({
        commandKey: 'recover-meta-bm-nautilus',
        priority: 'critical',
        status: 'open',
        commandType: 'surface_recovery',
        surfaceLabel: account?.accountLabel || 'Nautilus Business Manager',
        owner: constraint.operatorOwner || 'Operator',
        objective: 'Stabilize the highest-risk Meta buying surface before additional policy damage compounds.',
        nextStep: 'Drive restoration, cleanliness, and policy-safe relaunch criteria for Nautilus before allowing new risk on that surface.',
        unlockCondition: 'Restricted-account pressure is materially reduced and the surface is no longer the dominant Meta constraint.',
        sourceRef: constraint.sourceRef,
      });
    }

    if (constraint.constraintKey === 'nautilus_dormant_account_auto_close') {
      const account = accountsByKey.get(String(constraint.affectedEntityKey));
      commands.push({
        commandKey: 'preserve-nautilus-dormant-capacity',
        priority: 'high',
        status: 'open',
        commandType: 'capacity_keepalive',
        surfaceLabel: account?.accountLabel || 'Nautilus Business Manager',
        owner: constraint.operatorOwner || 'Operator',
        objective: 'Preserve dormant ad-account capacity before auto-close destroys future launch room.',
        nextStep: 'Publish the at-risk accounts and execute safe keepalive activity only on surfaces that do not add policy risk.',
        unlockCondition: 'Dormant ad accounts are either preserved with safe activity or intentionally written off with explicit decision.',
        sourceRef: constraint.sourceRef,
      });
    }

    if (constraint.constraintKey === 'redirect_rotation_toxicity') {
      commands.push({
        commandKey: 'rotate-redirect-surfaces',
        priority: 'high',
        status: 'open',
        commandType: 'redirect_hygiene',
        surfaceLabel: 'Meta Redirect System',
        owner: constraint.operatorOwner || 'Engineering',
        objective: 'Treat redirect domains as expiring operating assets instead of buyer memory.',
        nextStep: 'Implement scheduled redirect rotation plus immediate retirement when deceptive-ad or spam signals appear.',
        unlockCondition: 'Redirect selection is encoded systemically and burned redirects stop receiving new launches immediately.',
        sourceRef: constraint.sourceRef,
      });
    }

    if (constraint.constraintKey === 'adnet_daily_limit_expansion') {
      const account = accountsByKey.get(String(constraint.affectedEntityKey));
      commands.push({
        commandKey: 'expand-adnet-usable-capacity',
        priority: 'medium',
        status: 'open',
        commandType: 'capacity_expansion',
        surfaceLabel: account?.accountLabel || 'Adnet Business Manager',
        owner: constraint.operatorOwner || 'Operator',
        objective: 'Convert the cleaner Meta surface into usable buyer capacity without overrunning current limits.',
        nextStep: 'Route qualified buyers and launches into Adnet deliberately while respecting current daily-limit and admin-boundary constraints.',
        unlockCondition: 'Adnet onboarding and spend-routing no longer act as a practical bottleneck to safe Meta growth.',
        sourceRef: constraint.sourceRef,
      });
    }
  }

  commands.push(
    {
      commandKey: 'verify-meta-ai-connector-eligibility-nautilus',
      priority: 'medium',
      status: 'open',
      commandType: 'sanctioned_automation_readiness',
      surfaceLabel: 'Nautilus Business Manager',
      owner: 'Operator / Engineering',
      objective: 'Verify whether Nautilus has access to Meta Ads AI Connectors or other sanctioned AI integration lanes.',
      nextStep: 'Resume the documented live check on Nautilus and test whether a supported AI tool exposes a connector authorization flow.',
      unlockCondition: 'Eligibility is confirmed, denied, or documented with the exact missing prerequisite.',
      sourceRef: '/Users/ericroach/code/liftoff/docs/prd/meta-ads-ai-connectors-eligibility-workflow.md',
    },
    {
      commandKey: 'verify-meta-ai-connector-eligibility-adnet',
      priority: 'medium',
      status: 'open',
      commandType: 'sanctioned_automation_readiness',
      surfaceLabel: 'Adnet Business Manager',
      owner: 'Operator / Engineering',
      objective: 'Verify whether Adnet exposes the cleaner sanctioned automation lane before building strategy around it.',
      nextStep: 'Run the unresolved Adnet-specific live check and record whether connector access appears at the business-manager or ad-account level.',
      unlockCondition: 'Adnet eligibility state is explicitly known and recorded.',
      sourceRef: '/Users/ericroach/code/liftoff/docs/prd/meta-ads-ai-connectors-eligibility-workflow.md',
    }
  );

  commands.sort((a, b) => {
    return (
      severityRank(a.priority) - severityRank(b.priority) ||
      normalize(a.surfaceLabel).localeCompare(normalize(b.surfaceLabel)) ||
      normalize(a.commandKey).localeCompare(normalize(b.commandKey))
    );
  });

  const summary = {
    total: commands.length,
    critical: commands.filter((item) => item.priority === 'critical').length,
    high: commands.filter((item) => item.priority === 'high').length,
    medium: commands.filter((item) => item.priority === 'medium').length,
    open: commands.filter((item) => item.status === 'open').length,
  };

  let operatorRead =
    'Surface preservation is now a command problem rather than a registry problem: recover restricted surfaces, preserve dormant capacity, rotate risky redirects, and verify sanctioned automation lanes.';
  if (summary.critical > 0) {
    operatorRead =
      `${summary.critical} critical surface commands are open, so preserving Meta execution capacity should outrank any discretionary scaling work on the same surfaces.`;
  }

  return {
    summary,
    commands,
    operatorRead,
  };
}
