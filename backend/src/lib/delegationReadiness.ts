type DelegationBoundaryInput = {
  priority?: string | null;
  capitalPriority?: string | null;
  triggerState?: string | null;
  policyAction?: string | null;
  blockers?: Array<string | null | undefined>;
  blockerToClear?: string | null;
  supplyQualityBand?: string | null;
  supplyLaunchRate?: number | null;
  supplyBlueprintCoverage?: number | null;
  activeConstraintCount?: number | null;
  firstAction?: string | null;
  todayAskCount?: number | null;
  operatorState?: string | null;
  movementStatus?: string | null;
  previewOnly?: boolean;
};

type DelegationBoundaryStatus = 'ready' | 'needs_operator_work' | 'blocked';

type DelegationBoundaryReport = {
  status: DelegationBoundaryStatus;
  safeToDelegate: boolean;
  reasons: string[];
  hardStops: string[];
  softStops: string[];
  becomesReadyWhen: string[];
  override: {
    allowed: boolean;
    mode: 'preview_only' | 'none';
    guidance: string;
    riskLevel: 'low' | 'medium' | 'high';
    requiredBeforeOverride: string[];
  };
  cleanliness: {
    firstActionDefined: boolean;
    blockerFree: boolean;
    supplyQualified: boolean;
    operatorTouched: boolean;
    capitalClear: boolean;
  };
};

function normalize(value: string | null | undefined): string {
  return String(value || '').trim();
}

function lower(value: string | null | undefined): string {
  return normalize(value).toLowerCase();
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => normalize(value)).filter(Boolean)));
}

export function evaluateDelegationBoundary(input: DelegationBoundaryInput): DelegationBoundaryReport {
  const blockers = uniqueStrings([...(input.blockers || []), input.blockerToClear]);
  const hardStops: string[] = [];
  const softStops: string[] = [];
  const becomesReadyWhen: string[] = [];
  const triggerState = lower(input.triggerState);
  const policyAction = lower(input.policyAction);
  const supplyBand = lower(input.supplyQualityBand);
  const operatorState = lower(input.operatorState);
  const movementStatus = lower(input.movementStatus);
  const hasFirstAction = Boolean(normalize(input.firstAction));
  const hasTodayAsks = Number(input.todayAskCount || 0) > 0;
  const activeConstraintCount = Number(input.activeConstraintCount || 0);
  const launchRate = input.supplyLaunchRate ?? null;
  const blueprintCoverage = input.supplyBlueprintCoverage ?? null;
  const priority = lower(input.priority);
  const capitalPriority = lower(input.capitalPriority);

  if (triggerState === 'blocked') {
    hardStops.push('Trigger state is blocked, so the lane is not safe to delegate.');
    becomesReadyWhen.push('Move the lane out of blocked trigger state before handing any work outward.');
  }

  if (policyAction === 'block_incremental_spend') {
    hardStops.push('Capital policy is blocking incremental spend on this lane.');
    becomesReadyWhen.push('Clear the capital blocker or shift policy off blocked spend before delegation.');
  }

  if (blockers.length > 0) {
    hardStops.push(`An unresolved blocker is still active: ${blockers[0]}.`);
    becomesReadyWhen.push('Resolve the primary blocker so the buyer is not handed structurally blocked work.');
  }

  if (!hasFirstAction || !hasTodayAsks) {
    hardStops.push('The lane does not yet have a concrete first action that is clean enough to hand off.');
    becomesReadyWhen.push('Define one concrete first action and keep the daily ask list specific and finite.');
  }

  if (supplyBand === 'red') {
    hardStops.push('Upstream supply quality is red, so delegation would amplify weak inputs.');
    becomesReadyWhen.push('Raise supply quality out of red by improving launch conversion, blueprint coverage, or stale-pending pressure.');
  }

  if (priority === 'critical' || capitalPriority === 'critical') {
    hardStops.push('Critical lanes stay under operator control until the pressure drops.');
    becomesReadyWhen.push('Reduce the lane from critical to high or below before treating it as buyer-ready.');
  }

  if (operatorState === 'queued') {
    softStops.push('The operator has not yet touched this lane, so delegation would be premature.');
    becomesReadyWhen.push('Touch the lane first so the buyer does not become the first layer of triage.');
  } else if (operatorState === 'seen') {
    softStops.push('The lane has only been acknowledged, not actively worked.');
    becomesReadyWhen.push('Move the lane into active operator work or clear enough of it to justify delegation.');
  }

  if (supplyBand === 'yellow') {
    softStops.push('Supply quality is only yellow, so delegation should stay supervised.');
    becomesReadyWhen.push('Improve launch rate or blueprint coverage enough that supply quality is decisively clean.');
  }

  if (activeConstraintCount > 0) {
    softStops.push(`The lane still carries ${activeConstraintCount} active execution surface constraint${activeConstraintCount === 1 ? '' : 's'}.`);
    becomesReadyWhen.push('Reduce surface pressure so the buyer is not asked to operate through hidden surface drag.');
  }

  if (movementStatus === 'acknowledged' || movementStatus === 'deferred') {
    softStops.push('Recent movement is only cosmetic or deferred, not yet validated.');
    becomesReadyWhen.push('Show validated or at least advanced next-morning movement before calling this lane buyer-ready.');
  } else if (movementStatus === 'worsened') {
    hardStops.push('Recent movement worsened the lane, so delegation would hand off active deterioration.');
    becomesReadyWhen.push('Reverse the deterioration and show stable next-morning movement before delegation.');
  }

  if (launchRate != null && launchRate < 0.15 && supplyBand !== 'green') {
    softStops.push(`Launch conversion is still weak at ${Math.round(launchRate * 100)}%.`);
  }
  if (blueprintCoverage != null && blueprintCoverage < 0.5 && supplyBand !== 'green') {
    softStops.push(`Blueprint coverage is still thin at ${Math.round(blueprintCoverage * 100)}%.`);
  }

  const status: DelegationBoundaryStatus =
    hardStops.length > 0 ? 'blocked' : softStops.length > 0 ? 'needs_operator_work' : 'ready';

  const cleanliness = {
    firstActionDefined: hasFirstAction,
    blockerFree: blockers.length === 0,
    supplyQualified: supplyBand === 'green',
    operatorTouched: operatorState !== 'queued',
    capitalClear: policyAction !== 'block_incremental_spend' && triggerState !== 'blocked',
  };

  const requiredBeforeOverride = uniqueStrings([
    status === 'blocked' ? hardStops[0] : null,
    operatorState === 'queued' ? 'Operator must touch the lane first.' : null,
    supplyBand === 'yellow' ? 'Operator must keep delegation supervised and reversible.' : null,
    activeConstraintCount > 0 ? 'Operator must acknowledge live surface pressure before any exception.' : null,
  ]);

  const overrideAllowed = status === 'needs_operator_work';
  const overrideRisk =
    status === 'ready' ? 'low' :
    status === 'needs_operator_work' ? 'medium' :
    'high';

  let overrideGuidance = 'No override is needed; this lane is already clean enough for preview-only delegation.';
  if (status === 'blocked') {
    overrideGuidance =
      'Do not override this lane into buyer delegation. Clear the hard boundary first and keep the work under operator control.';
  } else if (status === 'needs_operator_work') {
    overrideGuidance =
      'Preview-only override is allowed only as a supervised exception: the operator should take first touch, state the boundary conditions, and keep the lane reversible.';
  }

  return {
    status,
    safeToDelegate: status === 'ready',
    reasons: uniqueStrings([...hardStops, ...softStops]).slice(0, 6),
    hardStops: uniqueStrings(hardStops).slice(0, 4),
    softStops: uniqueStrings(softStops).slice(0, 4),
    becomesReadyWhen: uniqueStrings(becomesReadyWhen).slice(0, 5),
    override: {
      allowed: overrideAllowed,
      mode: input.previewOnly === false ? 'none' : 'preview_only',
      guidance: overrideGuidance,
      riskLevel: overrideRisk,
      requiredBeforeOverride: requiredBeforeOverride.slice(0, 4),
    },
    cleanliness,
  };
}
