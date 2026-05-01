import { CAPACITY_CONSTRAINTS, OPERATING_CONTRACTS, PLATFORM_ACCOUNTS } from './platformCapacityRegistry';

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

export async function getPlatformCapacityReport(): Promise<any> {
  const constraints = [...CAPACITY_CONSTRAINTS].sort((a, b) => {
    return severityRank(a.severity) - severityRank(b.severity);
  });

  const activeConstraints = constraints.filter((item) => item.status !== 'resolved');
  const criticalCount = activeConstraints.filter((item) => item.severity === 'critical').length;
  const highCount = activeConstraints.filter((item) => item.severity === 'high').length;

  const accounts = PLATFORM_ACCOUNTS.map((account) => {
    const accountConstraints = activeConstraints.filter(
      (constraint) =>
        constraint.affectedEntityType === 'platform_account' &&
        constraint.affectedEntityKey === account.accountKey
    );
    return {
      ...account,
      activeConstraintCount: accountConstraints.length,
      activeConstraintSeverities: accountConstraints.map((constraint) => constraint.severity),
    };
  }).sort((a, b) => {
    return (
      severityRank(a.policyRiskLevel) - severityRank(b.policyRiskLevel) ||
      b.activeConstraintCount - a.activeConstraintCount
    );
  });

  const contracts = OPERATING_CONTRACTS.map((contract) => {
    const contractConstraints = activeConstraints.filter(
      (constraint) =>
        constraint.affectedEntityType === 'contract' &&
        constraint.affectedEntityKey === contract.contractKey
    );
    return {
      ...contract,
      activeConstraintCount: contractConstraints.length,
    };
  });

  let operatorRead =
    'The dominant capacity constraint is still Meta account safety rather than pure buyer willingness, so the system should treat account surfaces and agreements as real scaling variables.';
  if (criticalCount > 0) {
    operatorRead =
      'Meta account risk is still the binding constraint: Nautilus is degraded enough that allocation logic should treat account surface selection as a first-class decision, not a footnote.';
  } else if (highCount > 0) {
    operatorRead =
      'The system has multiple active high-severity constraints, which means scale depends as much on preserving usable surfaces and agreement boundaries as on finding profitable campaigns.';
  }

  return {
    summary: {
      platformAccountCount: PLATFORM_ACCOUNTS.length,
      operatingContractCount: OPERATING_CONTRACTS.length,
      activeConstraintCount: activeConstraints.length,
      criticalConstraintCount: criticalCount,
      highSeverityConstraintCount: highCount,
      mostConstrainedAccount: accounts[0]?.accountLabel || null,
    },
    platformAccounts: accounts,
    operatingContracts: contracts,
    activeConstraints,
    operatorRead,
  };
}
