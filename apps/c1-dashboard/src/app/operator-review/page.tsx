"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  buttonGhost,
  buttonPrimary,
  buttonSecondary,
  cardClass,
  pillClass,
  sectionLabel,
  subCardClass,
} from "@/lib/ui";

type MeetingListItem = {
  id: string;
  title: string;
  source_type: string;
  meeting_type?: string | null;
  occurred_at: string;
  summary_md?: string | null;
};

type MeetingDetail = MeetingListItem & {
  decision_summary_md?: string | null;
  action_summary_md?: string | null;
  participants?: Array<{ id: string; display_name?: string | null; role_at_time?: string | null; participant_type?: string | null }>;
  ideas?: Array<{ id: string; description: string; raised_by_name?: string | null; status?: string | null }>;
  decisions?: Array<{ id: string; decision_text: string; decision_owner_name?: string | null; decision_type?: string | null }>;
  actionItems?: Array<{ id: string; description: string; owner_name?: string | null; status?: string | null; priority?: string | null; urgency?: string | null }>;
  openQuestions?: Array<{ id: string; question_text: string; owner_name?: string | null; status?: string | null }>;
  voiceSignals?: Array<{ id: string; person_name?: string | null; signal_type?: string | null; signal_text?: string | null; theme?: string | null }>;
  approvals?: Array<{ id: string; operator_name?: string | null; decision: string; notes_md?: string | null; approved_at: string }>;
  executionEvents?: Array<{
    id: string;
    event_type: string;
    from_status?: string | null;
    to_status?: string | null;
    owner_name?: string | null;
    notes_md?: string | null;
    occurred_at: string;
  }>;
};

type OperatorPacket = {
  recommendationTitle: string;
  whyInSystem: string;
  whyNow: string;
  primaryBottleneck: string;
  expectedUpside: string;
  costOfDelay: string;
  approvalSentence: string;
  boardGuidance: string;
  summary: {
    meeting: string;
    decisions: string;
    actions: string;
  };
  counts: {
    ideas: number;
    decisions: number;
    openActionItems: number;
    openQuestions: number;
    voiceSignals: number;
  };
  evidence: {
    topSignals: Array<{ type: string; personName: string; text: string }>;
    priorityActionItems: Array<{ description: string; ownerName: string; status: string }>;
    decisions: Array<{ text: string; ownerName: string; type: string }>;
  };
};

type OwnerQueue = {
  ownerKey: string;
  ownerLabel: string;
  ownerPersonId?: string | null;
  counts: {
    totalOpen: number;
    approved: number;
    inProgress: number;
    blocked: number;
    needsOwner: number;
    overdue: number;
    atRisk: number;
    inSla: number;
  };
  metrics: {
    avgAgeHours: number;
    oldestAgeHours: number;
    avgHoursToDue: number | null;
  };
  queue: Array<{
    id: string;
    description: string;
    status: string;
    priority: string;
    urgency?: string | null;
    slaState: string;
    queueLane: string;
    ageHours: number;
    hoursRemaining: number;
    ownerName?: string | null;
  }>;
};

type OwnerAlert = {
  ownerKey: string;
  ownerLabel: string;
  severity: "critical" | "high" | "medium" | "low";
  reasons: string[];
  primaryMessage: string;
  recommendedAction: string;
  executionScore: number;
  queuePressure: number;
  netMargin: number;
  lookbackDays: number;
};

type BuyerScorecard = {
  ownerKey: string;
  ownerLabel: string;
  lookbackDays: number;
  performance: {
    spend: number;
    revenue: number;
    netMargin: number;
    roas: number | null;
    marginRate?: number | null;
    sessions?: number;
    clicks?: number;
    conversions?: number;
    rpc?: number | null;
    revenuePerSession?: number | null;
    cpc?: number | null;
    conversionRate?: number | null;
    activeCampaigns: number;
    launchCount: number;
  };
  mix?: {
    topNetworks: Array<{
      label: string;
      spend: number;
      revenue: number;
      netMargin: number;
      roas: number | null;
      activeCampaigns: number;
    }>;
    topSites: Array<{
      label: string;
      spend: number;
      revenue: number;
      netMargin: number;
      roas: number | null;
      activeCampaigns: number;
    }>;
  };
  opportunityMix?: {
    totalOwned: number;
    pending: number;
    approved: number;
    launched: number;
    rejected: number;
    stalePending: number;
    highConfidencePending: number;
    draftBlueprints: number;
    approvedBlueprints: number;
    pendingPredictedDeltaCm: number;
    avgConfidenceScore: number | null;
    topSources: Array<{
      label: string;
      count: number;
      share: number;
    }>;
    topCategories: Array<{
      label: string;
      count: number;
      share: number;
    }>;
    reasons: string[];
  };
  opportunityQuality?: {
    total: number;
    pending: number;
    launched: number;
    rejected: number;
    stalePending: number;
    avgConfidenceScore: number | null;
    pendingPredictedDeltaCm: number;
    blueprintCoverage: number | null;
    launchRate: number | null;
    stalePendingRate: number | null;
    qualityBand: "green" | "yellow" | "red";
    reasons: string[];
  };
  activity?: {
    recentLaunches: number;
    launchDaysActive: number;
    distinctLaunchCategories: number;
    distinctLaunchSources: number;
    topLaunchCategories: Array<{
      label: string;
      count: number;
      share: number;
    }>;
    topLaunchSources: Array<{
      label: string;
      count: number;
      share: number;
    }>;
  };
  throughput?: {
    actionsTouchedRecently: number;
    actionsClosedRecently: number;
    actionsStartedRecently: number;
    opportunitiesReviewedRecently: number;
    opportunitiesApprovedRecently: number;
    opportunitiesLaunchedRecently: number;
    blueprintsCreatedRecently: number;
    approvedBlueprintsCreatedRecently: number;
    actionClosureRate: number | null;
    launchFollowThroughRate: number | null;
    throughputBand: "green" | "yellow" | "red";
    reasons: string[];
  };
  exploreExploit?: {
    estimatedExploreLaunches: number;
    estimatedExploitLaunches: number;
    exploreShare: number | null;
    exploitShare: number | null;
    laneBias: string;
    reasons: string[];
  };
  surfaceExposure?: {
    linkedAccountKeys: string[];
    linkedAccountLabels: string[];
    inferredPlatforms: string[];
    activeConstraintCount: number;
    criticalConstraintCount: number;
    highConstraintCount: number;
    mediumConstraintCount: number;
    dominantConstrainedAccount: string | null;
    unresolvedSurfaceExposure: boolean;
    riskBand: "low" | "medium" | "high" | "critical";
    reasons: string[];
  };
  trend?: {
    daily: Array<{
      date: string;
      spend: number;
      revenue: number;
      netMargin: number;
    }>;
  };
  execution: {
    totalOpenActions: number;
    approvedActions: number;
    inProgressActions: number;
    overdueActions: number;
    atRiskActions: number;
    needsOwner: number;
    executionScore: number;
    queuePressure: number;
    avgAgeHours: number;
    oldestAgeHours: number;
  };
  health?: {
    economicBand: "green" | "yellow" | "red";
    executionBand: "green" | "yellow" | "red";
    dataConfidence: "high" | "medium" | "low";
    dataQuality?: {
      confidence: "high" | "medium" | "low";
      failingEndpointCount: number;
      failureDays: number;
      failingEndpoints: Array<{
        date: string;
        endpoint: string;
        status: string;
        rowCount: number;
        errorMessage: string | null;
      }>;
    };
    reasons: string[];
  };
  attribution?: {
    confidence: "high" | "medium" | "low";
    attributionCoverage: number;
    spendCoverage: number;
    highConfidenceCampaigns: number;
    campaignsWithKnownMonitoringOwner: number;
    mixedOwnerCampaigns: number;
    launchOwnerMismatchCampaigns: number;
    queueOwnerMismatchCampaigns: number;
    launchQueueDisagreementCampaigns: number;
    missingLaunchOwnerCampaigns: number;
    missingQueueOwnerCampaigns: number;
    reasons: string[];
  };
  operatorRead?: string;
  band: "green" | "yellow" | "red";
};

type BuyerAttributionAuditReport = {
  window: {
    lookbackDays: number;
    startDate: string;
    through: string;
  };
  summary: {
    totalCampaigns: number;
    knownMonitoringOwnerCampaigns: number;
    campaignsWithLaunchOwner: number;
    campaignsWithQueueOwner: number;
    mixedMonitoringOwnerCampaigns: number;
    launchOwnerMismatchCampaigns: number;
    queueOwnerMismatchCampaigns: number;
    launchQueueDisagreementCampaigns: number;
    lowConfidenceCampaigns: number;
    unattributedSpend: number;
  };
  owners: Array<{
    ownerKey: string;
    ownerLabel: string;
    spend: number;
    revenue: number;
    netMargin: number;
    activeCampaigns: number;
    campaignsWithKnownMonitoringOwner: number;
    launchCount: number;
    queueCount: number;
    highConfidenceCampaigns: number;
    attributionCoverage: number;
    spendCoverage: number;
    mixedOwnerCampaigns: number;
    launchOwnerMismatchCampaigns: number;
    queueOwnerMismatchCampaigns: number;
    launchQueueDisagreementCampaigns: number;
    missingLaunchOwnerCampaigns: number;
    missingQueueOwnerCampaigns: number;
    attributionConfidence: "high" | "medium" | "low";
    reasons: string[];
  }>;
  ambiguousCampaigns: Array<{
    campaignId: string;
    campaignName: string;
    monitoringOwnerLabel: string;
    launchOwnerLabel: string | null;
    queueOwnerLabel: string | null;
    spend: number;
    revenue: number;
    activeDays: number;
    attributionConfidence: "high" | "medium" | "low";
    issues: string[];
  }>;
  operatorRead: string;
};

type OwnerAlertNotification = {
  id: string;
  owner_key: string;
  owner_label: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  message: string;
  recommended_action?: string | null;
  status: "queued" | "acknowledged" | "dismissed";
  created_at: string;
  acknowledged_at?: string | null;
};

type BuyerScorecardSnapshot = {
  id: string;
  owner_key: string;
  owner_label: string;
  band: "green" | "yellow" | "red";
  net_margin: number;
  execution_score: number;
  overdue_actions: number;
  queue_pressure: number;
  captured_at: string;
};

type LocalMeetingReport = {
  window: {
    since: string;
    through: string;
    days: number;
  };
  summary: {
    recentMeetingCount: number;
    recentDecisionCount: number;
    recentActionCount: number;
    openActionCount: number;
    overdueActionCount: number;
    dueSoonActionCount: number;
    unassignedActionCount: number;
    heaviestOwner: string | null;
    heaviestOwnerOpenActionCount: number;
    dominantTheme: string | null;
  };
  recentMeetings: Array<{
    slug: string;
    meetingDate: string;
    title: string;
    participantCount: number;
    decisionCount: number;
    actionCount: number;
  }>;
  highPriorityOpenActions: Array<{
    slug: string;
    meetingDate: string;
    title: string;
    description: string;
    ownerName: string;
    dueAt: string | null;
    priority: string;
    status: string;
  }>;
  ownerQueues: Array<{
    ownerName: string;
    openActionCount: number;
    highPriorityCount: number;
  }>;
  recurringThemes: Array<{
    theme: string;
    mentionCount: number;
  }>;
  operatorRead: string;
};

type PrivateConversationReport = {
  operatorPersonId: string;
  summary: {
    activeConversations: number;
    conversationsWithNoMeeting: number;
    conversationsWithOpenActions: number;
    conversationsNeedingAttention: number;
    staleConversations: number;
  };
  conversations: Array<{
    sourceKey: string;
    label: string;
    counterpartName: string;
    objective: string | null;
    status: string;
    autoIngest: boolean;
    channelRef: string;
    watchWindow: string | null;
    query: string | null;
    lastIngestedAt: string | null;
    visibilityScope: string;
    lastMeeting: {
      id: string;
      title: string;
      occurredAt: string;
      summaryMd: string | null;
      decisionSummaryMd: string | null;
      actionSummaryMd: string | null;
    } | null;
    openActionCount: number;
    ownerlessActionCount: number;
    blockedActionCount: number;
    highPriorityActionCount: number;
    openQuestionCount: number;
    staleDays: number | null;
  }>;
  operatorRead: string;
};

type OpportunityIntentWorkstreamReport = {
  window: {
    lookbackDays: number;
    startDate: string;
    through: string;
  };
  opportunity: {
    schemaAvailable: boolean;
    lookbackDays: number;
    summary: {
      total: number;
      pending: number;
      approved: number;
      launched: number;
      rejected: number;
      highConfidencePending: number;
      stalePending: number;
      pendingPredictedDeltaCm: number;
      blueprintDraft: number;
      blueprintApproved: number;
      blueprintLaunched: number;
    };
    sources: Array<{
      source: string;
      total: number;
      pending: number;
      launched: number;
      pendingPredictedDeltaCm: number;
    }>;
    categories: Array<{
      category: string;
      total: number;
      pending: number;
      launched: number;
      pendingPredictedDeltaCm: number;
    }>;
    topPending: Array<{
      id: string;
      source: string;
      angle: string;
      category: string | null;
      confidenceScore: number | null;
      predictedDeltaCm: number | null;
      recommendedBudget: number | null;
      status: string;
      blueprintCount: number;
      createdAt: string | null;
      ageDays: number;
    }>;
    gaps: string[];
    operatorRead: string;
  };
  intentPacket: {
    schemaAvailable: boolean;
    lookbackDays: number;
    summary: {
      observationCount: number;
      uniquePackets: number;
      uniqueKeywords: number;
      approvedCount: number;
      rejectedCount: number;
      reviewFlagCount: number;
      revenue: number;
      spend: number;
      netMargin: number;
      approvalRate: number | null;
      reviewFlagRate: number | null;
    };
    sources: Array<{
      source: string;
      observationCount: number;
      approvedCount: number;
      revenue: number;
      spend: number;
      netMargin: number;
      approvalRate: number | null;
    }>;
    topKeywords: Array<{
      keyword: string;
      observationCount: number;
      approvedCount: number;
      revenue: number;
      spend: number;
      netMargin: number;
      approvalRate: number | null;
    }>;
    topNamespaces: Array<{
      namespace: string;
      axiomCount: number;
    }>;
    gaps: string[];
    operatorRead: string;
  };
  operatorRead: string;
};

type ExecutionGapReport = {
  window: {
    lookbackDays: number;
    since: string;
    through: string;
  };
  summary: {
    trackedGapThemes: number;
    repeatedConcernThemes: number;
    ownerlessConcernThemes: number;
    ownerlessActionItems: number;
    unresolvedOpenQuestions: number;
    meetingsWithGaps: number;
  };
  recurringThemes: Array<{
    themeKey: string;
    theme: string;
    mentionCount: number;
    meetingCount: number;
    signalTypes: string[];
    lastSeenAt: string | null;
    openActionCount: number;
    ownerlessActionCount: number;
    openQuestionCount: number;
    ownerCoverage: number;
    distinctOwners: string[];
    status: string;
    examples: Array<{
      meetingTitle: string;
      text: string;
      personName: string;
    }>;
  }>;
  ownerlessActionItems: Array<{
    id: string;
    meetingId: string;
    meetingTitle: string;
    occurredAt: string;
    description: string;
    status: string;
    priority: string;
    urgency: string | null;
    dueAt: string | null;
  }>;
  meetingGaps: Array<{
    meetingId: string;
    title: string;
    occurredAt: string;
    openActionCount: number;
    ownerlessActionCount: number;
    openQuestionCount: number;
    gapSignalCount: number;
    dominantTheme: string | null;
  }>;
  operatorRead: string;
};

type PlatformCapacityReport = {
  summary: {
    platformAccountCount: number;
    operatingContractCount: number;
    activeConstraintCount: number;
    criticalConstraintCount: number;
    highSeverityConstraintCount: number;
    mostConstrainedAccount: string | null;
  };
  platformAccounts: Array<{
    accountKey: string;
    platform: string;
    provider: string;
    partnerName: string | null;
    accountLabel: string;
    status: string;
    policyRiskLevel: string;
    dailyCapacityEstimate: number | null;
    ownerTeam: string | null;
    sourceRef: string;
    notes: string;
    activeConstraintCount: number;
    activeConstraintSeverities: string[];
  }>;
  operatingContracts: Array<{
    contractKey: string;
    agreementType: string;
    contractLabel: string;
    primaryCounterparty: string;
    status: string;
    paymentFlowRole: string;
    executionScope: string;
    sourceRef: string;
    notes: string;
    activeConstraintCount: number;
  }>;
  activeConstraints: Array<{
    constraintKey: string;
    constraintType: string;
    severity: string;
    status: string;
    summary: string;
    affectedEntityType: string;
    affectedEntityKey: string;
    operatorOwner: string | null;
    sourceRef: string;
    notes: string;
    detectedAt: string | null;
    reviewDueAt: string | null;
  }>;
  operatorRead: string;
};

type MeetingEntityLinkReport = {
  window: {
    lookbackDays: number;
    since: string;
    through: string;
  };
  summary: {
    meetingCount: number;
    linkedMeetingCount: number;
    unlinkedMeetingCount: number;
    distinctBuyers: number;
    distinctWorkstreams: number;
    distinctAccounts: number;
    distinctContracts: number;
    weakCoverageMeetings: number;
  };
  meetings: Array<{
    meetingId: string;
    title: string;
    occurredAt: string;
    buyerLinks: Array<{
      buyerName: string;
      evidence: string;
    }>;
    workstreams: Array<{
      workstreamKey: string;
      workstreamLabel: string;
    }>;
    accountLinks: Array<{
      accountKey: string;
      accountLabel: string;
    }>;
    contractLinks: Array<{
      contractKey: string;
      contractLabel: string;
    }>;
    actionCount: number;
    ownerlessActionCount: number;
    signalCount: number;
    linkCoverageScore: number;
    unlinked: boolean;
  }>;
  topBuyers: Array<{
    buyerName: string;
    meetingCount: number;
    strongestEvidence: string;
  }>;
  topWorkstreams: Array<{
    workstreamLabel: string;
    meetingCount: number;
  }>;
  topAccounts: Array<{
    accountLabel: string;
    meetingCount: number;
    policyRiskLevel: string;
  }>;
  topContracts: Array<{
    contractLabel: string;
    meetingCount: number;
    primaryCounterparty: string;
  }>;
  operatorRead: string;
};

type AllocatorGroundingReport = {
  window: {
    lookbackDays: number;
    through: string;
  };
  summary: {
    buyerCount: number;
    postureCounts: {
      protect: number;
      hold: number;
      cautiousGrow: number;
      scale: number;
      observe: number;
    };
    policyActionCounts: {
      blockIncrementalSpend: number;
      holdCurrentAllocation: number;
      allowMeasuredGrowth: number;
      allowScale: number;
      observeOnly: number;
    };
    systemMode: string;
    dominantConstraint: string;
    criticalPlatformConstraints: number;
    ownerlessActionItems: number;
    staleOpportunities: number;
  };
  buyerAllocations: Array<{
    ownerKey: string;
    ownerLabel: string;
    posture: string;
    band: string;
    performance: {
      spend: number;
      revenue: number;
      netMargin: number;
      roas: number | null;
      activeCampaigns: number;
      launchCount: number;
    };
    execution: {
      executionScore: number;
      queuePressure: number;
      overdueActions: number;
      needsOwner: number;
    };
    linkedMeetingCount: number;
    linkedAccountKeys: string[];
    linkedContractKeys: string[];
    linkedConstraintCount: number;
    linkedConstraintSummaries: string[];
    alertSeverity: string | null;
    reasons: string[];
    recommendedAction: string;
    triggerPolicy: {
      version: string;
      policyAction: string;
      triggerState: string;
      blockers: string[];
      promoteWhen: string[];
      spendGuardrail: string;
    };
  }>;
  groundingSignals: {
    scorecardsAvailable: boolean;
    alertsAvailable: boolean;
    platformAvailable: boolean;
    workstreamsAvailable: boolean;
    gapsAvailable: boolean;
    entityLinksAvailable: boolean;
    errors: string[];
  };
  operatorRead: string;
};

type AllocationExecutionEngineReport = {
  window: {
    lookbackDays: number;
    through: string;
  };
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    blocked: number;
    fired: number;
  };
  queue: Array<{
    queueKey: string;
    ownerKey: string;
    ownerLabel: string;
    priority: string;
    policyAction: string;
    triggerState: string;
    posture: string;
    band: string;
    recommendedAction: string;
    spendGuardrail: string | null;
    blockers: string[];
    promoteWhen: string[];
    linkedConstraintCount: number;
    netMargin: number;
    executionScore: number;
    nextStep: string;
  }>;
  operatorRead: string;
};

type BuyerDailyCommandPacketReport = {
  window: {
    lookbackDays: number;
    through: string;
  };
  mode: {
    phase: string;
    outboundMessagingEnabled: boolean;
    sendTargetsEnabled: boolean;
  };
  summary: {
    totalBuyers: number;
    critical: number;
    high: number;
    previewOnly: boolean;
    outboundMessagingEnabled: boolean;
    readyToDelegate: number;
    overrideOnly: number;
    hardBlockedForDelegation: number;
    buyersNeedingExplore: number;
    buyersNeedingFollowThrough: number;
    buyersWithSurfaceWork: number;
    buyersWithWeakSupplyQuality: number;
    actFirstCount: number;
  };
  packets: Array<{
    packetKey: string;
    sequenceIndex: number;
    ownerKey: string;
    ownerLabel: string;
    priority: string;
    posture: string;
    policyAction: string;
    triggerState: string;
    commandScore: number;
    previewOnly: boolean;
    outboundMessagingEnabled: boolean;
    topFocus: string;
    whyNow: string;
    orderingReasons: string[];
    firstAction: string | null;
    draftPreview: string;
    delegationBoundary: {
      status: "ready" | "needs_operator_work" | "blocked";
      safeToDelegate: boolean;
      reasons: string[];
      hardStops: string[];
      softStops: string[];
      becomesReadyWhen: string[];
      override: {
        allowed: boolean;
        mode: "preview_only" | "none";
        guidance: string;
        riskLevel: "low" | "medium" | "high";
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
    metrics: {
      netMargin: number;
      executionScore: number;
      recentLaunches: number;
      stalePendingOpportunities: number;
      activeConstraintCount: number;
      supplyQualityBand: string;
      supplyLaunchRate: number;
      supplyBlueprintCoverage: number;
    };
    todayAsks: string[];
    blockers: string[];
    exploreTasks: string[];
    exploitTasks: string[];
    followThroughTasks: string[];
    surfaceCommands: Array<{
      commandKey: string;
      priority: string;
      surfaceLabel: string;
      nextStep: string;
      objective: string;
    }>;
    upstream: {
      quality: {
        qualityBand: string;
        launchRate: number | null;
        stalePendingRate: number | null;
        blueprintCoverage: number | null;
        reasons: string[];
      };
      opportunities: Array<{
        opportunityId: string;
        angle: string;
        queueStatus: string;
        priority: string;
        ageDays: number;
        predictedDeltaCm: number | null;
      }>;
      intentPackets: Array<{
        queueKey: string;
        packetName: string;
        queueStatus: string;
        priority: string;
        netMargin: number;
      }>;
    };
  }>;
  operatorRead: string;
};

type OperatorCommandQueueReport = {
  window: {
    lookbackDays: number;
    through: string;
  };
  summary: {
    total: number;
    actNow: number;
    critical: number;
    blocked: number;
    weakSupply: number;
    readyToDelegate: number;
    overrideOnly: number;
    blockedForDelegation: number;
    meaningfulSinceYesterday: number;
    validatedSinceYesterday: number;
    cosmeticTouchesSinceYesterday: number;
    queued: number;
    seen: number;
    inProgress: number;
    cleared: number;
    promoted: number;
  };
  queue: Array<{
    commandKey: string;
    sequenceIndex: number;
    ownerKey: string;
    ownerLabel: string;
    priority: string;
    capitalPriority: string;
    actionScore: number;
    topFocus: string;
    whyNow: string;
    firstAction: string | null;
    capitalAction: string;
    policyAction: string;
    triggerState: string;
    blockerToClear: string | null;
    promotionCondition: string | null;
    supplyQualityBand: string;
    posture: string;
    state: "queued" | "seen" | "in_progress" | "cleared" | "promoted" | "deferred";
    stateChangedAt: string | null;
    stateNote: string | null;
    delegationReadiness: "ready" | "needs_operator_work" | "blocked";
    delegationReadinessReasons: string[];
    delegationBoundary: {
      status: "ready" | "needs_operator_work" | "blocked";
      safeToDelegate: boolean;
      reasons: string[];
      hardStops: string[];
      softStops: string[];
      becomesReadyWhen: string[];
      override: {
        allowed: boolean;
        mode: "preview_only" | "none";
        guidance: string;
        riskLevel: "low" | "medium" | "high";
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
    movementStatus: string | null;
    movementMeaningful: boolean;
    movementState: string | null;
    movementHeadline: string | null;
    movementChangedAt: string | null;
    movementPositiveSignals: string[];
    movementNegativeSignals: string[];
    orderingReasons: string[];
    spendGuardrail: string | null;
    draftPreview: string;
    explainability: {
      buyerDriver: string;
      capitalDriver: string;
      blockerDriver: string | null;
      promotionDriver: string | null;
    };
  }>;
  operatorRead: string;
};

type OvernightSprintScorecardReport = {
  generatedAt: string;
  summary: {
    activeSprint: string;
    activeNorthStar: string;
    activeCurrentValue: number | null;
    activeTrendDirection: string | null;
  };
  sprints: Array<{
    sprintKey: string;
    sprintLabel: string;
    status: string;
    northStar: {
      metricKey: string;
      label: string;
      value: number | null;
      unit: string;
      definition: string;
    };
    diagnostics: {
      candidateCommands?: number;
      closedCommands?: number;
      avgTimeToFirstTouchHours?: number | null;
      avgTimeToResolutionHours?: number | null;
      stuckOver24h?: number;
      noStateChangeRate?: number | null;
      blocker?: string;
    };
    trend: {
      current: number | null;
      rolling7: number | null;
      previous: number | null;
      delta: number | null;
      direction: string;
      averageDailyDelta: number | null;
    };
    operatorRead: string;
  }>;
};

type CommandOutcomeTelemetryReport = {
  generatedAt: string;
  summary: {
    resolvedCount: number;
    validated: number;
    worsened: number;
    mixed: number;
    noSignal: number;
    notEnoughHistory: number;
    validatedRate: number;
    avgHoursSinceResolution: number | null;
  };
  nextMorning: {
    lookbackHours: number;
    changedCount: number;
    meaningfulMovementCount: number;
    validatedImprovementCount: number;
    advancedButUnvalidatedCount: number;
    cosmeticTouchCount: number;
    worsenedCount: number;
    deferredCount: number;
    operatorRead: string;
  };
  items: Array<{
    commandKey: string;
    ownerKey: string;
    ownerLabel: string;
    state: string;
    stateChangedAt: string | null;
    hoursSinceResolution: number | null;
    outcomeStatus: "validated" | "mixed" | "no_signal" | "worsened" | "not_enough_history";
    positiveSignals: string[];
    negativeSignals: string[];
    metrics: {
      netMarginDelta: number | null;
      executionScoreDelta: number | null;
      queuePressureImprovement: number | null;
      overdueActionImprovement: number | null;
      bandBefore: string | null;
      bandAfter: string | null;
      surfaceRiskBefore: string | null;
      surfaceRiskAfter: string | null;
    };
  }>;
  recentMovement: Array<{
    commandKey: string;
    ownerKey: string;
    ownerLabel: string;
    state: string;
    movementState: string;
    movementChangedAt: string | null;
    hoursSinceMovement: number | null;
    outcomeStatus: "validated" | "mixed" | "no_signal" | "worsened" | "not_enough_history";
    movementStatus: string;
    meaningfulMovement: boolean;
    headline: string;
    positiveSignals: string[];
    negativeSignals: string[];
    metrics: {
      executionScoreDelta: number | null;
      queuePressureImprovement: number | null;
      overdueActionImprovement: number | null;
      bandBefore: string | null;
      bandAfter: string | null;
      surfaceRiskBefore: string | null;
      surfaceRiskAfter: string | null;
    };
  }>;
  operatorRead: string;
};

type MorningOperatorPacketReport = {
  generatedAt: string;
  summary: {
    topOwner: string | null;
    actNowCount: number;
    criticalCount: number;
    blockedCount: number;
    escalationCount: number;
    validatedOutcomeRate: number;
    meaningfulMovementCount: number;
    cosmeticTouchCount: number;
    activeSprint: string | null;
    activeSprintMetric: string | null;
  };
  opening: string;
  actFirst: {
    ownerLabel: string;
    firstAction: string | null;
    capitalAction: string;
    blockerToClear: string | null;
    promotionCondition: string | null;
    orderingReasons: string[];
  } | null;
  sprint: {
    label: string;
    metricLabel: string | null;
    metricValue: number | null;
    trendDirection: string | null;
    operatorRead: string | null;
  } | null;
  validatedOutcomes: Array<{
    ownerLabel: string;
    outcomeStatus: string;
    positiveSignals: string[];
    negativeSignals: string[];
  }>;
  nextMorningMovement: {
    summary: {
      lookbackHours: number;
      changedCount: number;
      meaningfulMovementCount: number;
      validatedImprovementCount: number;
      advancedButUnvalidatedCount: number;
      cosmeticTouchCount: number;
      worsenedCount: number;
      deferredCount: number;
      operatorRead: string;
    };
    items: Array<{
      commandKey: string;
      ownerLabel: string;
      movementState: string;
      movementStatus: string;
      movementChangedAt: string | null;
      hoursSinceMovement: number | null;
      headline: string;
      positiveSignals: string[];
      negativeSignals: string[];
    }>;
  };
  stateRollup: {
    generatedAt: string;
    summary: {
      lookbackHours: number;
      changedCount: number;
      seen: number;
      inProgress: number;
      cleared: number;
      promoted: number;
      deferred: number;
    };
    changes: Array<{
      commandKey: string;
      ownerKey: string;
      ownerLabel: string;
      status: string;
      noteMd: string | null;
      changedAt: string | null;
      hoursSinceChange: number | null;
    }>;
    operatorRead: string;
  };
  escalations: Array<{
    commandKey: string;
    ownerLabel: string;
    state: string;
    severity: string;
    triggerState: string;
    hoursStale: number | null;
    blockerToClear: string | null;
    priority: string;
    recommendedTouch: string;
    reasons: string[];
  }>;
  followThroughToday: string[];
  escalationRead?: string;
  operatorRead: string;
};

type PacketLineageGraphReport = {
  summary: {
    totalFamilies: number;
    crossBuyerReuseFamilies: number;
    selfReuseFamilies: number;
    originalOnlyFamilies: number;
    ownerlessFamilies: number;
    launchedFamilies: number;
  };
  packets: Array<{
    familyKey: string;
    packetLabel: string;
    source: string;
    category: string;
    firstSeenAt: string | null;
    originOwner: string;
    currentOwners: string[];
    reuseOwners: string[];
    ownerCount: number;
    opportunityCount: number;
    launchedOpportunityCount: number;
    blueprintCount: number;
    approvedBlueprintCount: number;
    launchedBlueprintCount: number;
    reuseState: string;
    reasons: string[];
  }>;
  operatorRead: string;
};

type SurfacePreservationCommandLayerReport = {
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    open: number;
  };
  commands: Array<{
    commandKey: string;
    priority: string;
    status: string;
    commandType: string;
    surfaceLabel: string;
    owner: string;
    objective: string;
    nextStep: string;
    unlockCondition: string;
    sourceRef: string;
  }>;
  operatorRead: string;
};

type OpportunityOwnershipReport = {
  summary: {
    total: number;
    pending: number;
    ownerless: number;
    ungoverned: number;
    overdueNextSteps: number;
    stalePending: number;
    draftBlueprints: number;
    approvedBlueprints: number;
  };
  queueStatusCounts: Record<string, number>;
  queue: Array<{
    opportunityId: string;
    source: string;
    angle: string;
    category: string | null;
    status: string;
    confidenceScore: number | null;
    predictedDeltaCm: number | null;
    recommendedBudget: number | null;
    createdAt: string | null;
    ageDays: number;
    ownerName: string | null;
    queueStatus: string;
    priority: string;
    nextStep: string | null;
    nextStepDueAt: string | null;
    blockerSummary: string | null;
    lastReviewedAt: string | null;
    blueprintCount: number;
    approvedBlueprintCount: number;
  }>;
  operatorRead: string;
};

type OpportunitySupplyQualityLoopReport = {
  summary: {
    total: number;
    pending: number;
    launched: number;
    rejected: number;
    stalePending: number;
    blueprintBacked: number;
    approvedBlueprintBacked: number;
    avgConfidenceScore: number | null;
    pendingPredictedDeltaCm: number;
    launchRate: number | null;
    stalePendingRate: number | null;
    blueprintCoverage: number | null;
    closedLoopRate: number | null;
  };
  owners: Array<{
    ownerLabel: string;
    total: number;
    pending: number;
    launched: number;
    rejected: number;
    stalePending: number;
    avgConfidenceScore: number | null;
    pendingPredictedDeltaCm: number;
    blueprintCoverage: number | null;
    launchRate: number | null;
    stalePendingRate: number | null;
    qualityBand: "green" | "yellow" | "red";
    reasons: string[];
  }>;
  sources: Array<{
    source: string;
    total: number;
    pending: number;
    launched: number;
    rejected: number;
    stalePending: number;
    avgConfidenceScore: number | null;
    pendingPredictedDeltaCm: number;
    blueprintCoverage: number | null;
    launchRate: number | null;
    stalePendingRate: number | null;
    qualityBand: "green" | "yellow" | "red";
    reasons: string[];
  }>;
  categories: Array<{
    category: string;
    total: number;
    pending: number;
    launched: number;
    rejected: number;
    stalePending: number;
    avgConfidenceScore: number | null;
    pendingPredictedDeltaCm: number;
    blueprintCoverage: number | null;
    launchRate: number | null;
    stalePendingRate: number | null;
    qualityBand: "green" | "yellow" | "red";
    reasons: string[];
  }>;
  systemicIssues: string[];
  operatorRead: string;
};

type IntentPacketOwnershipReport = {
  window: {
    lookbackDays: number;
    since: string;
    through: string;
  };
  summary: {
    total: number;
    ownerless: number;
    reviewDue: number;
    staleLearning: number;
    positiveSignalPackets: number;
  };
  queueStatusCounts: Record<string, number>;
  queue: Array<{
    queueKey: string;
    primaryKeyword: string;
    packetName: string | null;
    market: string | null;
    ownerName: string | null;
    queueStatus: string;
    priority: string;
    nextStep: string | null;
    nextReviewAt: string | null;
    blockerSummary: string | null;
    lastObservedAt: string | null;
    observationCount: number;
    revenue: number;
    spend: number;
    netMargin: number;
    approvedCount: number;
    rejectedCount: number;
    reviewFlagCount: number;
  }>;
  operatorRead: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function prettyLabel(value: string | null | undefined) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatMoney(value: number | null | undefined) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null | undefined, digits: number = 0) {
  if (value == null) return "N/A";
  return Number(value).toFixed(digits);
}

export default function OperatorReviewPage() {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [packet, setPacket] = useState<OperatorPacket | null>(null);
  const [ownerQueues, setOwnerQueues] = useState<OwnerQueue[]>([]);
  const [ownerAlerts, setOwnerAlerts] = useState<OwnerAlert[]>([]);
  const [buyerScorecards, setBuyerScorecards] = useState<BuyerScorecard[]>([]);
  const [buyerAttributionAudit, setBuyerAttributionAudit] = useState<BuyerAttributionAuditReport | null>(null);
  const [alertNotifications, setAlertNotifications] = useState<OwnerAlertNotification[]>([]);
  const [scorecardHistory, setScorecardHistory] = useState<BuyerScorecardSnapshot[]>([]);
  const [localReport, setLocalReport] = useState<LocalMeetingReport | null>(null);
  const [privateConversationReport, setPrivateConversationReport] = useState<PrivateConversationReport | null>(null);
  const [workstreamReport, setWorkstreamReport] = useState<OpportunityIntentWorkstreamReport | null>(null);
  const [executionGapReport, setExecutionGapReport] = useState<ExecutionGapReport | null>(null);
  const [platformCapacityReport, setPlatformCapacityReport] = useState<PlatformCapacityReport | null>(null);
  const [entityLinkReport, setEntityLinkReport] = useState<MeetingEntityLinkReport | null>(null);
  const [allocatorGroundingReport, setAllocatorGroundingReport] = useState<AllocatorGroundingReport | null>(null);
  const [allocationExecutionEngineReport, setAllocationExecutionEngineReport] = useState<AllocationExecutionEngineReport | null>(null);
  const [buyerDailyCommandPacketReport, setBuyerDailyCommandPacketReport] = useState<BuyerDailyCommandPacketReport | null>(null);
  const [operatorCommandQueueReport, setOperatorCommandQueueReport] = useState<OperatorCommandQueueReport | null>(null);
  const [overnightSprintScorecardReport, setOvernightSprintScorecardReport] = useState<OvernightSprintScorecardReport | null>(null);
  const [commandOutcomeTelemetryReport, setCommandOutcomeTelemetryReport] = useState<CommandOutcomeTelemetryReport | null>(null);
  const [morningOperatorPacketReport, setMorningOperatorPacketReport] = useState<MorningOperatorPacketReport | null>(null);
  const [packetLineageGraphReport, setPacketLineageGraphReport] = useState<PacketLineageGraphReport | null>(null);
  const [surfacePreservationCommandLayerReport, setSurfacePreservationCommandLayerReport] = useState<SurfacePreservationCommandLayerReport | null>(null);
  const [opportunityOwnershipReport, setOpportunityOwnershipReport] = useState<OpportunityOwnershipReport | null>(null);
  const [opportunitySupplyQualityLoopReport, setOpportunitySupplyQualityLoopReport] = useState<OpportunitySupplyQualityLoopReport | null>(null);
  const [intentPacketOwnershipReport, setIntentPacketOwnershipReport] = useState<IntentPacketOwnershipReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [syncingAlerts, setSyncingAlerts] = useState(false);
  const [snapshottingScorecards, setSnapshottingScorecards] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [rebuildingLocalReport, setRebuildingLocalReport] = useState(false);
  const [updatingCommandKey, setUpdatingCommandKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [operatorName, setOperatorName] = useState("Eric");

  async function loadMeetings(preferredId?: string | null) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/meeting-intelligence/meetings?limit=30", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const rows = (await response.json()) as MeetingListItem[];
      setMeetings(rows);
      const nextId = preferredId && rows.some((row) => row.id === preferredId) ? preferredId : rows[0]?.id || null;
      setSelectedId(nextId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadOwnerQueues() {
    try {
      const response = await fetch("/api/meeting-intelligence/owner-queues?limitOwners=8", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setOwnerQueues((await response.json()) as OwnerQueue[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadOwnerAlerts() {
    try {
      const response = await fetch("/api/meeting-intelligence/owner-alerts?limit=8", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setOwnerAlerts((await response.json()) as OwnerAlert[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadBuyerScorecards() {
    try {
      const response = await fetch("/api/meeting-intelligence/buyer-scorecards?lookbackDays=7&limit=10", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setBuyerScorecards((await response.json()) as BuyerScorecard[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadBuyerAttributionAudit() {
    try {
      const response = await fetch("/api/meeting-intelligence/buyer-scorecards/attribution-audit?lookbackDays=7&limitAmbiguousCampaigns=10", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setBuyerAttributionAudit((await response.json()) as BuyerAttributionAuditReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadAlertNotifications() {
    try {
      const response = await fetch("/api/meeting-intelligence/owner-alert-notifications?limit=12", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setAlertNotifications((await response.json()) as OwnerAlertNotification[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadScorecardHistory() {
    try {
      const response = await fetch("/api/meeting-intelligence/buyer-scorecards/history?limit=20", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setScorecardHistory((await response.json()) as BuyerScorecardSnapshot[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadLocalReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/local-report?days=30&limitActions=12&limitOwners=8&limitThemes=8", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setLocalReport((await response.json()) as LocalMeetingReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadPrivateConversationReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/private-conversations/report?operatorPersonId=eric&limit=12", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setPrivateConversationReport((await response.json()) as PrivateConversationReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadWorkstreamReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/workstreams/opportunity-intent?lookbackDays=14&limit=5", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setWorkstreamReport((await response.json()) as OpportunityIntentWorkstreamReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadExecutionGapReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/execution-gaps?lookbackDays=30&limitThemes=8&limitMeetings=8&limitActions=10", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setExecutionGapReport((await response.json()) as ExecutionGapReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadPlatformCapacityReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/platform-capacity", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setPlatformCapacityReport((await response.json()) as PlatformCapacityReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadEntityLinkReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/entity-links?lookbackDays=30&limitMeetings=12", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setEntityLinkReport((await response.json()) as MeetingEntityLinkReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadAllocatorGroundingReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/allocator-grounding?lookbackDays=7&limitBuyers=8", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setAllocatorGroundingReport((await response.json()) as AllocatorGroundingReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadAllocationExecutionEngineReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/allocation-execution-engine?lookbackDays=7&limitBuyers=8", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setAllocationExecutionEngineReport((await response.json()) as AllocationExecutionEngineReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadBuyerDailyCommandPacketReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/buyer-daily-command-packets?lookbackDays=7&limitBuyers=8", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setBuyerDailyCommandPacketReport((await response.json()) as BuyerDailyCommandPacketReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadOperatorCommandQueueReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/operator-command-queue?lookbackDays=7&limitBuyers=8", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setOperatorCommandQueueReport((await response.json()) as OperatorCommandQueueReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadOvernightSprintScorecardReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/overnight-sprint-scorecards", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setOvernightSprintScorecardReport((await response.json()) as OvernightSprintScorecardReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadCommandOutcomeTelemetryReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/command-outcomes?lookbackDays=7&limit=12", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setCommandOutcomeTelemetryReport((await response.json()) as CommandOutcomeTelemetryReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadMorningOperatorPacketReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/morning-operator-packet", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setMorningOperatorPacketReport((await response.json()) as MorningOperatorPacketReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadPacketLineageGraphReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/packet-lineage-graph?limit=10", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setPacketLineageGraphReport((await response.json()) as PacketLineageGraphReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadSurfacePreservationCommandLayerReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/surface-preservation-command-layer", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setSurfacePreservationCommandLayerReport((await response.json()) as SurfacePreservationCommandLayerReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadOpportunityOwnershipReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/upstream/opportunities?limit=10", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setOpportunityOwnershipReport((await response.json()) as OpportunityOwnershipReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadOpportunitySupplyQualityLoopReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/upstream/opportunity-supply-quality?limit=8", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setOpportunitySupplyQualityLoopReport((await response.json()) as OpportunitySupplyQualityLoopReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadIntentPacketOwnershipReport() {
    try {
      const response = await fetch("/api/meeting-intelligence/upstream/intent-packets?lookbackDays=14&limit=10", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setIntentPacketOwnershipReport((await response.json()) as IntentPacketOwnershipReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadMeetingDetail(id: string) {
    setDetailLoading(true);
    setError(null);
    try {
      const [meetingResponse, packetResponse] = await Promise.all([
        fetch(`/api/meeting-intelligence/meetings/${id}`, { cache: "no-store" }),
        fetch(`/api/meeting-intelligence/meetings/${id}/operator-packet`, { cache: "no-store" }),
      ]);
      if (!meetingResponse.ok) throw new Error(await meetingResponse.text());
      if (!packetResponse.ok) throw new Error(await packetResponse.text());
      setMeeting((await meetingResponse.json()) as MeetingDetail);
      setPacket((await packetResponse.json()) as OperatorPacket);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadMeetings();
    void loadOwnerQueues();
    void loadOwnerAlerts();
    void loadBuyerScorecards();
    void loadBuyerAttributionAudit();
    void loadAlertNotifications();
    void loadScorecardHistory();
    void loadLocalReport();
    void loadPrivateConversationReport();
    void loadWorkstreamReport();
    void loadExecutionGapReport();
    void loadPlatformCapacityReport();
    void loadEntityLinkReport();
      void loadAllocatorGroundingReport();
      void loadAllocationExecutionEngineReport();
      void loadBuyerDailyCommandPacketReport();
      void loadOperatorCommandQueueReport();
      void loadOvernightSprintScorecardReport();
      void loadCommandOutcomeTelemetryReport();
      void loadMorningOperatorPacketReport();
      void loadPacketLineageGraphReport();
      void loadSurfacePreservationCommandLayerReport();
      void loadOpportunityOwnershipReport();
      void loadOpportunitySupplyQualityLoopReport();
    void loadIntentPacketOwnershipReport();
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadMeetingDetail(selectedId);
    } else {
      setMeeting(null);
      setPacket(null);
    }
  }, [selectedId]);

  async function synthesizeSelectedMeeting() {
    if (!selectedId) return;
    setSynthesizing(true);
    setError(null);
    try {
      const response = await fetch(`/api/meeting-intelligence/meetings/${selectedId}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      await loadMeetingDetail(selectedId);
      await loadMeetings(selectedId);
      await loadOwnerQueues();
      await loadOwnerAlerts();
      await loadBuyerScorecards();
      await loadBuyerAttributionAudit();
      await loadAlertNotifications();
      await loadScorecardHistory();
      await loadWorkstreamReport();
      await loadPrivateConversationReport();
      await loadExecutionGapReport();
      await loadPlatformCapacityReport();
      await loadEntityLinkReport();
      await loadAllocatorGroundingReport();
      await loadBuyerDailyCommandPacketReport();
      await loadOpportunityOwnershipReport();
      await loadOpportunitySupplyQualityLoopReport();
      await loadIntentPacketOwnershipReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSynthesizing(false);
    }
  }

  async function createApproval(decision: "approved" | "rejected" | "deferred") {
    if (!selectedId || !packet) return;
    setApproving(true);
    setError(null);
    try {
      const response = await fetch(`/api/meeting-intelligence/meetings/${selectedId}/operator-approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          operatorName: operatorName.trim() || "Operator",
          notesMd: approvalNotes.trim() || null,
          packetSnapshot: packet,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setApprovalNotes("");
      await loadMeetingDetail(selectedId);
      await loadMeetings(selectedId);
      await loadOwnerQueues();
      await loadOwnerAlerts();
      await loadBuyerScorecards();
      await loadBuyerAttributionAudit();
      await loadAlertNotifications();
      await loadScorecardHistory();
      await loadWorkstreamReport();
      await loadExecutionGapReport();
      await loadPlatformCapacityReport();
      await loadEntityLinkReport();
      await loadAllocatorGroundingReport();
      await loadOpportunityOwnershipReport();
      await loadIntentPacketOwnershipReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApproving(false);
    }
  }

  async function syncAlertNotifications() {
    setSyncingAlerts(true);
    setError(null);
    try {
      const response = await fetch("/api/meeting-intelligence/owner-alerts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 8 }),
      });
      if (!response.ok) throw new Error(await response.text());
      await loadOwnerAlerts();
      await loadAlertNotifications();
      await loadBuyerAttributionAudit();
      await loadWorkstreamReport();
      await loadExecutionGapReport();
      await loadPlatformCapacityReport();
      await loadEntityLinkReport();
      await loadAllocatorGroundingReport();
      await loadOpportunityOwnershipReport();
      await loadIntentPacketOwnershipReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncingAlerts(false);
    }
  }

  async function snapshotBuyerScorecards() {
    setSnapshottingScorecards(true);
    setError(null);
    try {
      const response = await fetch("/api/meeting-intelligence/buyer-scorecards/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookbackDays: 7, limit: 10 }),
      });
      if (!response.ok) throw new Error(await response.text());
      await loadBuyerScorecards();
      await loadBuyerAttributionAudit();
      await loadScorecardHistory();
      await loadWorkstreamReport();
      await loadExecutionGapReport();
      await loadPlatformCapacityReport();
      await loadEntityLinkReport();
      await loadAllocatorGroundingReport();
      await loadOpportunityOwnershipReport();
      await loadIntentPacketOwnershipReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSnapshottingScorecards(false);
    }
  }

  async function updateAlertNotification(id: string, status: "acknowledged" | "dismissed") {
    setError(null);
    try {
      const response = await fetch(`/api/meeting-intelligence/owner-alert-notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await response.text());
      await loadAlertNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runAutomationCycle() {
    setRunningAutomation(true);
    setError(null);
    try {
      const response = await fetch("/api/meeting-intelligence/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertLimit: 8, scorecardLimit: 10, lookbackDays: 7 }),
      });
      if (!response.ok) throw new Error(await response.text());
      await loadOwnerAlerts();
      await loadAlertNotifications();
      await loadBuyerScorecards();
      await loadBuyerAttributionAudit();
      await loadScorecardHistory();
      await loadWorkstreamReport();
      await loadExecutionGapReport();
      await loadPlatformCapacityReport();
      await loadEntityLinkReport();
      await loadAllocatorGroundingReport();
      await loadOpportunityOwnershipReport();
      await loadIntentPacketOwnershipReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningAutomation(false);
    }
  }

  async function updateOperatorCommandState(
    item: OperatorCommandQueueReport["queue"][number],
    status: "seen" | "in_progress" | "cleared" | "promoted"
  ) {
    setUpdatingCommandKey(item.commandKey);
    setError(null);
    try {
      const response = await fetch(`/api/meeting-intelligence/operator-command-queue/${encodeURIComponent(item.commandKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerKey: item.ownerKey,
          ownerLabel: item.ownerLabel,
          status,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      await loadOperatorCommandQueueReport();
      await loadOvernightSprintScorecardReport();
      await loadCommandOutcomeTelemetryReport();
      await loadMorningOperatorPacketReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingCommandKey(null);
    }
  }

  async function rebuildLocalReport() {
    setRebuildingLocalReport(true);
    setError(null);
    try {
      const response = await fetch("/api/meeting-intelligence/local-report/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 30, limitActions: 12, limitOwners: 8, limitThemes: 8 }),
      });
      if (!response.ok) throw new Error(await response.text());
      const payload = (await response.json()) as { report: LocalMeetingReport };
      setLocalReport(payload.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRebuildingLocalReport(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className={pillClass}>Prime Directive Control Loop</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Operator Review</h1>
            <p className="mt-2 max-w-3xl text-sm text-neutral-600 dark:text-neutral-300">
              Review synthesized meetings as approval packets. Each packet is framed around why it belongs in the system,
              why now, the bottleneck it relieves, the expected upside, the cost of delay, and the approval ask.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/home" className={buttonGhost}>Home</Link>
            <button
              type="button"
              onClick={() => void runAutomationCycle()}
              className={buttonSecondary}
              disabled={runningAutomation}
            >
              {runningAutomation ? "Running automation..." : "Run automation"}
            </button>
            <button
              type="button"
              onClick={() => void loadMeetings(selectedId)}
              className={buttonPrimary}
              disabled={loading}
            >
              Refresh meetings
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className={`${cardClass} p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className={sectionLabel}>Meeting Queue</h2>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{meetings.length} loaded</span>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
                ))}
              </div>
            ) : meetings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                No meetings found yet. Import a Slack thread or markdown transcript first.
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map((row) => {
                  const active = row.id === selectedId;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-[#0071e3] bg-[#0071e3]/[0.08] dark:bg-[#0071e3]/[0.16]"
                          : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700"
                      }`}
                    >
                      <div className="text-sm font-semibold">{row.title}</div>
                      <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        {prettyLabel(row.source_type)} · {formatDate(row.occurred_at)}
                      </div>
                      <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                        {row.summary_md ? "Synthesized" : "Needs synthesis"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <main className="space-y-6">
            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Morning Operator Packet</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    This is the condensed morning control brief: who to start with, what to clear, what the sprint metric says, and what is escalating.
                  </p>
                </div>
                <button type="button" onClick={() => void loadMorningOperatorPacketReport()} className={buttonGhost}>
                  Refresh morning packet
                </button>
              </div>

              {morningOperatorPacketReport ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {morningOperatorPacketReport.operatorRead}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Start Here</div>
                      <div className="mt-2 text-lg font-semibold">{morningOperatorPacketReport.summary.topOwner || "N/A"}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">top operator lane</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Act Now</div>
                      <div className="mt-2 text-2xl font-semibold">{morningOperatorPacketReport.summary.actNowCount}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">urgent command lanes</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Critical</div>
                      <div className="mt-2 text-2xl font-semibold">{morningOperatorPacketReport.summary.criticalCount}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">repair-first lanes</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Blocked</div>
                      <div className="mt-2 text-2xl font-semibold">{morningOperatorPacketReport.summary.blockedCount}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">still carrying hard blockers</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Sprint 02 Rate</div>
                      <div className="mt-2 text-2xl font-semibold">{formatPercent(morningOperatorPacketReport.summary.validatedOutcomeRate)}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">validated outcome rate</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Meaningful Moves</div>
                      <div className="mt-2 text-2xl font-semibold">{morningOperatorPacketReport.summary.meaningfulMovementCount}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">yesterday work with real movement</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Cosmetic Touches</div>
                      <div className="mt-2 text-2xl font-semibold">{morningOperatorPacketReport.summary.cosmeticTouchCount}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">acknowledged, not yet meaningful</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 dark:border-neutral-700 dark:bg-neutral-900">
                    <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Opening</div>
                    <div className="mt-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">{morningOperatorPacketReport.opening}</div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-sm font-semibold">Act First</div>
                      {morningOperatorPacketReport.actFirst ? (
                        <div className="mt-3 space-y-3 text-sm text-neutral-700 dark:text-neutral-200">
                          <div><span className="font-medium">Owner:</span> {morningOperatorPacketReport.actFirst.ownerLabel}</div>
                          <div><span className="font-medium">First action:</span> {morningOperatorPacketReport.actFirst.firstAction || "N/A"}</div>
                          <div><span className="font-medium">Capital action:</span> {morningOperatorPacketReport.actFirst.capitalAction}</div>
                          <div><span className="font-medium">Blocker:</span> {morningOperatorPacketReport.actFirst.blockerToClear || "None recorded"}</div>
                          <div><span className="font-medium">Promote when:</span> {morningOperatorPacketReport.actFirst.promotionCondition || "None recorded"}</div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {morningOperatorPacketReport.actFirst.orderingReasons.map((reason) => (
                              <span key={reason} className={pillClass}>{reason}</span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">No act-first lane generated yet.</div>
                      )}
                    </div>

                    <div className={subCardClass + " p-4"}>
                      <div className="text-sm font-semibold">Sprint Read</div>
                      {morningOperatorPacketReport.sprint ? (
                        <div className="mt-3 space-y-3 text-sm text-neutral-700 dark:text-neutral-200">
                          <div><span className="font-medium">{morningOperatorPacketReport.sprint.label}</span></div>
                          <div><span className="font-medium">{morningOperatorPacketReport.sprint.metricLabel}:</span> {morningOperatorPacketReport.sprint.metricValue == null ? "N/A" : formatPercent(morningOperatorPacketReport.sprint.metricValue)}</div>
                          <div><span className="font-medium">Trend:</span> {prettyLabel(morningOperatorPacketReport.sprint.trendDirection)}</div>
                          <div>{morningOperatorPacketReport.sprint.operatorRead}</div>
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">No sprint summary generated yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-sm font-semibold">Yesterday → This Morning</div>
                      <div className="mt-2 text-sm text-neutral-700 dark:text-neutral-200">
                        {morningOperatorPacketReport.nextMorningMovement.summary.operatorRead}
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Validated</div>
                          <div className="mt-2 text-2xl font-semibold">{morningOperatorPacketReport.nextMorningMovement.summary.validatedImprovementCount}</div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Advanced</div>
                          <div className="mt-2 text-2xl font-semibold">{morningOperatorPacketReport.nextMorningMovement.summary.advancedButUnvalidatedCount}</div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Worsened</div>
                          <div className="mt-2 text-2xl font-semibold">{morningOperatorPacketReport.nextMorningMovement.summary.worsenedCount}</div>
                        </div>
                      </div>
                      <div className="mt-3 space-y-3 text-sm text-neutral-700 dark:text-neutral-200">
                        {morningOperatorPacketReport.nextMorningMovement.items.length ? morningOperatorPacketReport.nextMorningMovement.items.map((item) => (
                          <div key={`${item.commandKey}:${item.movementChangedAt || "movement"}`}>
                            <div className="font-medium">{item.ownerLabel}</div>
                            <div>{item.headline}</div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {prettyLabel(item.movementStatus)} · {prettyLabel(item.movementState)}{item.movementChangedAt ? ` · ${formatDate(item.movementChangedAt)}` : ""}
                            </div>
                            {item.positiveSignals[0] ? <div className="mt-1 text-xs text-neutral-700 dark:text-neutral-200">Positive: {item.positiveSignals[0]}</div> : null}
                            {item.negativeSignals[0] ? <div className="mt-1 text-xs text-neutral-700 dark:text-neutral-200">Negative: {item.negativeSignals[0]}</div> : null}
                          </div>
                        )) : <div>No next-morning movement recorded yet.</div>}
                      </div>
                      {morningOperatorPacketReport.validatedOutcomes.length ? (
                        <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Best Validated Outcomes</div>
                          <div className="mt-2 space-y-2 text-sm text-neutral-700 dark:text-neutral-200">
                            {morningOperatorPacketReport.validatedOutcomes.map((item) => (
                              <div key={`${item.ownerLabel}:${item.outcomeStatus}`}>
                                <span className="font-medium">{item.ownerLabel}</span>: {item.positiveSignals[0] || "Validated improvement recorded."}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className={subCardClass + " p-4"}>
                      <div className="text-sm font-semibold">Escalations</div>
                      <div className="mt-2 text-sm text-neutral-700 dark:text-neutral-200">
                        {morningOperatorPacketReport.escalationRead || "Escalations summarize blocked or stale command lanes that now need explicit operator intervention."}
                      </div>
                      <div className="mt-3 space-y-3 text-sm text-neutral-700 dark:text-neutral-200">
                        {morningOperatorPacketReport.escalations.length ? morningOperatorPacketReport.escalations.map((item) => (
                          <div key={item.commandKey}>
                            <div className="font-medium">{item.ownerLabel}</div>
                            <div>{prettyLabel(item.severity)} escalation · {prettyLabel(item.priority)} priority · {prettyLabel(item.state)} · {prettyLabel(item.triggerState)}</div>
                            <div>{item.blockerToClear || "No blocker recorded."}</div>
                            <div>Touch next: {item.recommendedTouch}</div>
                            {item.hoursStale != null ? <div>Stale for {formatNumber(item.hoursStale, 1)}h</div> : null}
                            <div className="mt-2 flex flex-wrap gap-2">
                              {item.reasons.map((reason) => (
                                <span key={reason} className={pillClass}>{reason}</span>
                              ))}
                            </div>
                          </div>
                        )) : <div>No escalations generated yet.</div>}
                      </div>
                    </div>
                  </div>

                  <div className={subCardClass + " p-4"}>
                    <div className="text-sm font-semibold">State Changes In Last {morningOperatorPacketReport.stateRollup.summary.lookbackHours}h</div>
                    <div className="mt-2 text-sm text-neutral-700 dark:text-neutral-200">{morningOperatorPacketReport.stateRollup.operatorRead}</div>
                    <div className="mt-3 grid gap-3 md:grid-cols-5">
                      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Changed</div>
                        <div className="mt-2 text-2xl font-semibold">{morningOperatorPacketReport.stateRollup.summary.changedCount}</div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Seen</div>
                        <div className="mt-2 text-2xl font-semibold">{morningOperatorPacketReport.stateRollup.summary.seen}</div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">In Progress</div>
                        <div className="mt-2 text-2xl font-semibold">{morningOperatorPacketReport.stateRollup.summary.inProgress}</div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Cleared</div>
                        <div className="mt-2 text-2xl font-semibold">{morningOperatorPacketReport.stateRollup.summary.cleared}</div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Promoted</div>
                        <div className="mt-2 text-2xl font-semibold">{morningOperatorPacketReport.stateRollup.summary.promoted}</div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-200">
                      {morningOperatorPacketReport.stateRollup.changes.length ? morningOperatorPacketReport.stateRollup.changes.map((item) => (
                        <div key={item.commandKey}>
                          <span className="font-medium">{item.ownerLabel}</span>: {prettyLabel(item.status)}{item.changedAt ? ` · ${formatDate(item.changedAt)}` : ""}{item.noteMd ? ` · ${item.noteMd}` : ""}
                        </div>
                      )) : <div>No state changes recorded yet.</div>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 dark:border-neutral-700 dark:bg-neutral-950">
                    <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Follow Through Today</div>
                    <div className="mt-2 space-y-1 text-sm text-neutral-700 dark:text-neutral-200">
                      {morningOperatorPacketReport.followThroughToday.length ? morningOperatorPacketReport.followThroughToday.map((entry) => (
                        <div key={entry}>{entry}</div>
                      )) : <div>No explicit follow-through items generated yet.</div>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Morning operator packet not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Command Outcome Telemetry</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    This is the first real Sprint 02 proof layer: it tests whether cleared or promoted commands actually improved buyer posture, queue pressure, or surface conditions.
                  </p>
                </div>
                <button type="button" onClick={() => void loadCommandOutcomeTelemetryReport()} className={buttonGhost}>
                  Refresh command outcomes
                </button>
              </div>

              {commandOutcomeTelemetryReport ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {commandOutcomeTelemetryReport.operatorRead}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Validated</div>
                      <div className="mt-2 text-2xl font-semibold">{commandOutcomeTelemetryReport.summary.validated}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">resolved commands with positive proof</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Validated Rate</div>
                      <div className="mt-2 text-2xl font-semibold">{formatPercent(commandOutcomeTelemetryReport.summary.validatedRate)}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Sprint 02 north-star</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Mixed</div>
                      <div className="mt-2 text-2xl font-semibold">{commandOutcomeTelemetryReport.summary.mixed}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">some positive, some negative</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Worsened</div>
                      <div className="mt-2 text-2xl font-semibold">{commandOutcomeTelemetryReport.summary.worsened}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">resolved commands with negative drift</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">No Signal</div>
                      <div className="mt-2 text-2xl font-semibold">{commandOutcomeTelemetryReport.summary.noSignal}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">resolved but no measured shift</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Avg Hours Since Resolution</div>
                      <div className="mt-2 text-2xl font-semibold">{commandOutcomeTelemetryReport.summary.avgHoursSinceResolution == null ? "N/A" : commandOutcomeTelemetryReport.summary.avgHoursSinceResolution}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">aging of measured outcomes</div>
                    </div>
                  </div>

                  <div className={subCardClass + " p-4"}>
                    <div className="text-sm font-semibold">Next-Morning Movement Read</div>
                    <div className="mt-2 text-sm text-neutral-700 dark:text-neutral-200">
                      {commandOutcomeTelemetryReport.nextMorning.operatorRead}
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Changed</div>
                        <div className="mt-2 text-2xl font-semibold">{commandOutcomeTelemetryReport.nextMorning.changedCount}</div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Meaningful</div>
                        <div className="mt-2 text-2xl font-semibold">{commandOutcomeTelemetryReport.nextMorning.meaningfulMovementCount}</div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Advanced</div>
                        <div className="mt-2 text-2xl font-semibold">{commandOutcomeTelemetryReport.nextMorning.advancedButUnvalidatedCount}</div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Cosmetic</div>
                        <div className="mt-2 text-2xl font-semibold">{commandOutcomeTelemetryReport.nextMorning.cosmeticTouchCount}</div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Deferred</div>
                        <div className="mt-2 text-2xl font-semibold">{commandOutcomeTelemetryReport.nextMorning.deferredCount}</div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-3 text-sm text-neutral-700 dark:text-neutral-200">
                      {commandOutcomeTelemetryReport.recentMovement.length ? commandOutcomeTelemetryReport.recentMovement.slice(0, 4).map((item) => (
                        <div key={`${item.commandKey}:${item.movementChangedAt || "recent"}`}>
                          <span className="font-medium">{item.ownerLabel}</span>: {item.headline}
                        </div>
                      )) : <div>No recent next-morning movement recorded yet.</div>}
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {commandOutcomeTelemetryReport.items.length ? commandOutcomeTelemetryReport.items.map((item) => (
                      <div key={item.commandKey} className={subCardClass + " p-4"}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{item.ownerLabel}</div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {prettyLabel(item.state)} · {item.stateChangedAt ? formatDate(item.stateChangedAt) : "no state change timestamp"} · {item.hoursSinceResolution == null ? "N/A" : `${item.hoursSinceResolution}h`} since resolution
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <span className={pillClass}>{prettyLabel(item.outcomeStatus)}</span>
                            {item.metrics.bandAfter ? <span className={pillClass}>{item.metrics.bandBefore || "unknown"} → {item.metrics.bandAfter}</span> : null}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Positive Signals</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              {item.positiveSignals.length ? item.positiveSignals.map((signal) => (
                                <div key={signal}>{signal}</div>
                              )) : <div>No positive signal recorded yet.</div>}
                            </div>
                          </div>
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Negative Signals</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              {item.negativeSignals.length ? item.negativeSignals.map((signal) => (
                                <div key={signal}>{signal}</div>
                              )) : <div>No negative signal recorded.</div>}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Buyer Deltas</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              <div>Net margin Δ: {item.metrics.netMarginDelta == null ? "N/A" : formatMoney(item.metrics.netMarginDelta)}</div>
                              <div>Execution Δ: {item.metrics.executionScoreDelta == null ? "N/A" : item.metrics.executionScoreDelta}</div>
                              <div>Queue pressure improvement: {item.metrics.queuePressureImprovement == null ? "N/A" : item.metrics.queuePressureImprovement}</div>
                              <div>Overdue improvement: {item.metrics.overdueActionImprovement == null ? "N/A" : item.metrics.overdueActionImprovement}</div>
                            </div>
                          </div>
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Surface / Band</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              <div>Band: {item.metrics.bandBefore || "N/A"} → {item.metrics.bandAfter || "N/A"}</div>
                              <div>Surface risk: {item.metrics.surfaceRiskBefore || "N/A"} → {item.metrics.surfaceRiskAfter || "N/A"}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">No resolved command outcomes recorded yet.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Command outcome telemetry not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Overnight Sprint Scorecards</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    One north-star metric per sprint, with trend and speed, so the overnight builds are judged by outcome rather than volume of work.
                  </p>
                </div>
                <button type="button" onClick={() => void loadOvernightSprintScorecardReport()} className={buttonGhost}>
                  Refresh sprint scorecards
                </button>
              </div>

              {overnightSprintScorecardReport ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    Active sprint: {overnightSprintScorecardReport.summary.activeSprint} · north-star {overnightSprintScorecardReport.summary.activeNorthStar} · current {formatPercent(overnightSprintScorecardReport.summary.activeCurrentValue)} · trend {prettyLabel(overnightSprintScorecardReport.summary.activeTrendDirection)}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    {overnightSprintScorecardReport.sprints.map((sprint) => (
                      <div key={sprint.sprintKey} className={subCardClass + " p-4"}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{sprint.sprintLabel}</div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{prettyLabel(sprint.status)}</div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <span className={pillClass}>{sprint.northStar.label}</span>
                            <span className={pillClass}>{prettyLabel(sprint.trend.direction)}</span>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">North-Star</div>
                          <div className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
                            {sprint.northStar.value == null ? "N/A" : formatPercent(sprint.northStar.value)}
                          </div>
                          <div className="mt-2 text-xs text-neutral-700 dark:text-neutral-200">{sprint.northStar.definition}</div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Trend</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              <div>Current: {sprint.trend.current == null ? "N/A" : formatPercent(sprint.trend.current)}</div>
                              <div>7-day avg: {sprint.trend.rolling7 == null ? "N/A" : formatPercent(sprint.trend.rolling7)}</div>
                              <div>Delta: {sprint.trend.delta == null ? "N/A" : formatPercent(sprint.trend.delta)}</div>
                              <div>Speed: {sprint.trend.averageDailyDelta == null ? "N/A" : formatPercent(sprint.trend.averageDailyDelta)} / day</div>
                            </div>
                          </div>
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Diagnostics</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              {typeof sprint.diagnostics.candidateCommands === "number" ? <div>Candidates: {sprint.diagnostics.candidateCommands}</div> : null}
                              {typeof sprint.diagnostics.closedCommands === "number" ? <div>Closed: {sprint.diagnostics.closedCommands}</div> : null}
                              {typeof sprint.diagnostics.avgTimeToFirstTouchHours === "number" ? <div>First touch: {sprint.diagnostics.avgTimeToFirstTouchHours}h</div> : null}
                              {typeof sprint.diagnostics.avgTimeToResolutionHours === "number" ? <div>Resolution: {sprint.diagnostics.avgTimeToResolutionHours}h</div> : null}
                              {typeof sprint.diagnostics.stuckOver24h === "number" ? <div>Stuck &gt;24h: {sprint.diagnostics.stuckOver24h}</div> : null}
                              {typeof sprint.diagnostics.noStateChangeRate === "number" ? <div>No state change: {formatPercent(sprint.diagnostics.noStateChangeRate)}</div> : null}
                              {sprint.diagnostics.blocker ? <div>{sprint.diagnostics.blocker}</div> : null}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 text-sm text-neutral-700 dark:text-neutral-200">{sprint.operatorRead}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Overnight sprint scorecards not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Unified Operator Command Queue</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    This is the merged control surface: buyer steering order, capital action, blocker to clear, and promotion condition in one ranked queue.
                  </p>
                </div>
                <button type="button" onClick={() => void loadOperatorCommandQueueReport()} className={buttonGhost}>
                  Refresh unified queue
                </button>
              </div>

              {operatorCommandQueueReport ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {operatorCommandQueueReport.operatorRead}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Act Now</div>
                      <div className="mt-2 text-2xl font-semibold">{operatorCommandQueueReport.summary.actNow}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">top-ranked intervention lanes</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Critical</div>
                      <div className="mt-2 text-2xl font-semibold">{operatorCommandQueueReport.summary.critical}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">capital or buyer-critical lanes</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Blocked</div>
                      <div className="mt-2 text-2xl font-semibold">{operatorCommandQueueReport.summary.blocked}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">blocked by current trigger state</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Weak Supply</div>
                      <div className="mt-2 text-2xl font-semibold">{operatorCommandQueueReport.summary.weakSupply}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">red upstream quality lanes</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Ready To Delegate</div>
                      <div className="mt-2 text-2xl font-semibold">{operatorCommandQueueReport.summary.readyToDelegate}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">preview-only buyer-ready lanes</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Override Only</div>
                      <div className="mt-2 text-2xl font-semibold">{operatorCommandQueueReport.summary.overrideOnly}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">supervised exception lanes</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Meaningful Since Yesterday</div>
                      <div className="mt-2 text-2xl font-semibold">{operatorCommandQueueReport.summary.meaningfulSinceYesterday}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">lanes with real next-morning movement</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Cosmetic Touches</div>
                      <div className="mt-2 text-2xl font-semibold">{operatorCommandQueueReport.summary.cosmeticTouchesSinceYesterday}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">acknowledged but not yet proving out</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Queue Size</div>
                      <div className="mt-2 text-2xl font-semibold">{operatorCommandQueueReport.summary.total}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">merged operator commands</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">In Progress</div>
                      <div className="mt-2 text-2xl font-semibold">{operatorCommandQueueReport.summary.inProgress}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">commands actively being worked</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Cleared</div>
                      <div className="mt-2 text-2xl font-semibold">{operatorCommandQueueReport.summary.cleared}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">commands moved out of blockage</div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {operatorCommandQueueReport.queue.length ? operatorCommandQueueReport.queue.map((item) => (
                      <div key={item.commandKey} className={subCardClass + " p-4"}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">#{item.sequenceIndex} in operator queue</div>
                            <div className="mt-1 text-sm font-semibold">{item.ownerLabel}</div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              Score {Math.round(item.actionScore)} · buyer {prettyLabel(item.priority)} · capital {prettyLabel(item.capitalPriority)} · state {prettyLabel(item.state)}
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <span className={pillClass}>{prettyLabel(item.policyAction)}</span>
                            <span className={pillClass}>{prettyLabel(item.triggerState)}</span>
                            <span className={pillClass}>supply {prettyLabel(item.supplyQualityBand)}</span>
                            <span className={pillClass}>delegation {prettyLabel(item.delegationReadiness)}</span>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-3 py-3 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12]">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">First Action</div>
                          <div className="mt-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">
                            {item.firstAction || "No first action generated yet."}
                          </div>
                        </div>

                        {item.movementHeadline ? (
                          <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Next-Morning Movement</div>
                            <div className="mt-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">{item.movementHeadline}</div>
                            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                              {prettyLabel(item.movementStatus || "unknown")} · {prettyLabel(item.movementState || "unknown")}
                              {item.movementChangedAt ? ` · ${formatDate(item.movementChangedAt)}` : ""}
                            </div>
                            {item.movementPositiveSignals.length ? (
                              <div className="mt-2 text-xs text-neutral-700 dark:text-neutral-200">
                                Positive: {item.movementPositiveSignals[0]}
                              </div>
                            ) : null}
                            {item.movementNegativeSignals.length ? (
                              <div className="mt-1 text-xs text-neutral-700 dark:text-neutral-200">
                                Negative: {item.movementNegativeSignals[0]}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" disabled={updatingCommandKey === item.commandKey} onClick={() => void updateOperatorCommandState(item, "seen")} className={buttonGhost}>
                            Mark seen
                          </button>
                          <button type="button" disabled={updatingCommandKey === item.commandKey} onClick={() => void updateOperatorCommandState(item, "in_progress")} className={buttonGhost}>
                            Mark in progress
                          </button>
                          <button type="button" disabled={updatingCommandKey === item.commandKey} onClick={() => void updateOperatorCommandState(item, "cleared")} className={buttonGhost}>
                            Mark cleared
                          </button>
                          <button type="button" disabled={updatingCommandKey === item.commandKey} onClick={() => void updateOperatorCommandState(item, "promoted")} className={buttonGhost}>
                            Mark promoted
                          </button>
                        </div>

                        <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Why Now</div>
                          <div className="mt-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">{item.topFocus}</div>
                          <div className="mt-2 text-sm text-neutral-700 dark:text-neutral-200">{item.whyNow}</div>
                        </div>

                        <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Delegation Readiness</div>
                          <div className="mt-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">{prettyLabel(item.delegationReadiness)}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.delegationReadinessReasons.map((reason) => (
                              <span key={reason} className={pillClass}>{reason}</span>
                            ))}
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Hard Stops</div>
                              <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                                {item.delegationBoundary.hardStops.length ? item.delegationBoundary.hardStops.map((stop) => (
                                  <div key={stop}>{stop}</div>
                                )) : <div>No hard boundary is active.</div>}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Becomes Buyer-Ready When</div>
                              <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                                {item.delegationBoundary.becomesReadyWhen.length ? item.delegationBoundary.becomesReadyWhen.map((condition) => (
                                  <div key={condition}>{condition}</div>
                                )) : <div>No additional work required.</div>}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-3 dark:border-neutral-700 dark:bg-neutral-950">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Preview-Only Override</div>
                            <div className="mt-2 text-xs text-neutral-700 dark:text-neutral-200">{item.delegationBoundary.override.guidance}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className={pillClass}>risk {prettyLabel(item.delegationBoundary.override.riskLevel)}</span>
                              <span className={pillClass}>{item.delegationBoundary.override.allowed ? "override allowed" : "override blocked"}</span>
                            </div>
                            {item.delegationBoundary.override.requiredBeforeOverride.length ? (
                              <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                                {item.delegationBoundary.override.requiredBeforeOverride.map((step) => (
                                  <div key={step}>{step}</div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Capital Action</div>
                            <div className="mt-2 text-xs text-neutral-700 dark:text-neutral-200">{item.capitalAction}</div>
                            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                              {item.spendGuardrail || "No explicit spend guardrail recorded."}
                            </div>
                          </div>
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Blocker To Clear</div>
                            <div className="mt-2 text-xs text-neutral-700 dark:text-neutral-200">{item.blockerToClear || "No primary blocker recorded."}</div>
                            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                              Promote when: {item.promotionCondition || "No promotion condition recorded."}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Explainability</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              <div><span className="font-medium">Buyer:</span> {item.explainability.buyerDriver}</div>
                              <div><span className="font-medium">Capital:</span> {item.explainability.capitalDriver}</div>
                              <div><span className="font-medium">Blocker:</span> {item.explainability.blockerDriver || "None recorded"}</div>
                              <div><span className="font-medium">Promote:</span> {item.explainability.promotionDriver || "None recorded"}</div>
                            </div>
                          </div>
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">State</div>
                            <div className="mt-2 text-xs text-neutral-700 dark:text-neutral-200">
                              {prettyLabel(item.state)}
                            </div>
                            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                              {item.stateChangedAt ? `Changed ${formatDate(item.stateChangedAt)}` : "No state transition recorded yet."}
                            </div>
                            {item.stateNote ? (
                              <div className="mt-2 text-xs text-neutral-700 dark:text-neutral-200">{item.stateNote}</div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {item.orderingReasons.length ? item.orderingReasons.map((reason) => (
                            <span key={reason} className={pillClass}>{reason}</span>
                          )) : <span className={pillClass}>No ordering reasons generated yet</span>}
                        </div>
                      </div>
                    )) : (
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">Unified operator command queue has no rows in this environment yet.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Unified operator command queue not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Platform Accounts, Contracts, And Capacity</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    This is the first canonical registry of the external account surfaces, agreement boundaries, and active capacity constraints that are binding scale right now.
                  </p>
                </div>
                <button type="button" onClick={() => void loadPlatformCapacityReport()} className={buttonGhost}>
                  Refresh capacity
                </button>
              </div>

              {platformCapacityReport ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {platformCapacityReport.operatorRead}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Platform Accounts</div>
                      <div className="mt-2 text-2xl font-semibold">{platformCapacityReport.summary.platformAccountCount}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        tracked execution surfaces
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Contracts</div>
                      <div className="mt-2 text-2xl font-semibold">{platformCapacityReport.summary.operatingContractCount}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        active commercial / operating agreements
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Active Constraints</div>
                      <div className="mt-2 text-2xl font-semibold">{platformCapacityReport.summary.activeConstraintCount}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        {platformCapacityReport.summary.criticalConstraintCount} critical · {platformCapacityReport.summary.highSeverityConstraintCount} high
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Most Constrained</div>
                      <div className="mt-2 text-lg font-semibold">{platformCapacityReport.summary.mostConstrainedAccount || "n/a"}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        highest-risk current surface
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-sm font-semibold">Platform Accounts</div>
                      <div className="mt-3 space-y-3">
                        {platformCapacityReport.platformAccounts.map((account) => (
                          <div key={account.accountKey} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">{account.accountLabel}</div>
                                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  {prettyLabel(account.platform)} · risk {prettyLabel(account.policyRiskLevel)} · {prettyLabel(account.status)}
                                </div>
                              </div>
                              <span className={pillClass}>{account.activeConstraintCount} constraints</span>
                            </div>
                            <div className="mt-3 text-sm text-neutral-700 dark:text-neutral-200">
                              {account.notes}
                            </div>
                            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                              Capacity: {account.dailyCapacityEstimate != null ? formatMoney(account.dailyCapacityEstimate) + "/day" : "not modeled"} · Owner team: {account.ownerTeam || "n/a"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className={subCardClass + " p-4"}>
                        <div className="text-sm font-semibold">Active Constraints</div>
                        <div className="mt-3 space-y-3">
                          {platformCapacityReport.activeConstraints.map((constraint) => (
                            <div key={constraint.constraintKey} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium">{constraint.summary}</div>
                                  <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                    {prettyLabel(constraint.severity)} · {prettyLabel(constraint.status)} · owner {constraint.operatorOwner || "n/a"}
                                  </div>
                                </div>
                                <span className={pillClass}>{prettyLabel(constraint.constraintType)}</span>
                              </div>
                              <div className="mt-3 text-sm text-neutral-700 dark:text-neutral-200">
                                {constraint.notes}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={subCardClass + " p-4"}>
                        <div className="text-sm font-semibold">Agreement Boundaries</div>
                        <div className="mt-3 space-y-3">
                          {platformCapacityReport.operatingContracts.map((contract) => (
                            <div key={contract.contractKey} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                              <div className="text-sm font-medium">{contract.contractLabel}</div>
                              <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                {prettyLabel(contract.agreementType)} · {contract.primaryCounterparty}
                              </div>
                              <div className="mt-3 text-sm text-neutral-700 dark:text-neutral-200">
                                {contract.notes}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Platform capacity report not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Execution Gaps</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    This surface turns repeated concerns, ownerless actions, and unresolved questions into an explicit execution-risk queue instead of leaving them buried in transcripts.
                  </p>
                </div>
                <button type="button" onClick={() => void loadExecutionGapReport()} className={buttonGhost}>
                  Refresh gaps
                </button>
              </div>

              {executionGapReport ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {executionGapReport.operatorRead}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Gap Themes</div>
                      <div className="mt-2 text-2xl font-semibold">{executionGapReport.summary.trackedGapThemes}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        {executionGapReport.summary.repeatedConcernThemes} repeated
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Ownerless</div>
                      <div className="mt-2 text-2xl font-semibold">{executionGapReport.summary.ownerlessActionItems}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        {executionGapReport.summary.ownerlessConcernThemes} ownerless themes
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Open Questions</div>
                      <div className="mt-2 text-2xl font-semibold">{executionGapReport.summary.unresolvedOpenQuestions}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        unresolved in current window
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Meetings With Gaps</div>
                      <div className="mt-2 text-2xl font-semibold">{executionGapReport.summary.meetingsWithGaps}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        window: {executionGapReport.window.since} to {executionGapReport.window.through}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-sm font-semibold">Recurring Gap Themes</div>
                      <div className="mt-3 space-y-3">
                        {executionGapReport.recurringThemes.length ? executionGapReport.recurringThemes.map((theme) => (
                          <div key={theme.themeKey} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">{theme.theme}</div>
                                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  {theme.mentionCount} mentions · {theme.meetingCount} meetings · owner coverage {formatPercent(theme.ownerCoverage)}
                                </div>
                              </div>
                              <span className={pillClass}>{prettyLabel(theme.status)}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              {theme.signalTypes.map((signalType) => (
                                <span key={signalType} className={pillClass}>{prettyLabel(signalType)}</span>
                              ))}
                            </div>
                            {theme.examples[0] ? (
                              <div className="mt-3 text-sm text-neutral-700 dark:text-neutral-200">
                                {theme.examples[0].text}
                              </div>
                            ) : null}
                          </div>
                        )) : (
                          <div className="text-sm text-neutral-500 dark:text-neutral-400">No recurring execution-gap themes surfaced yet.</div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className={subCardClass + " p-4"}>
                        <div className="text-sm font-semibold">Ownerless Action Items</div>
                        <div className="mt-3 space-y-3">
                          {executionGapReport.ownerlessActionItems.length ? executionGapReport.ownerlessActionItems.map((item) => (
                            <div key={item.id} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                              <div className="text-sm font-medium">{item.description}</div>
                              <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                {item.meetingTitle} · {prettyLabel(item.priority)} · {prettyLabel(item.status)}
                              </div>
                            </div>
                          )) : (
                            <div className="text-sm text-neutral-500 dark:text-neutral-400">No ownerless action items in the current window.</div>
                          )}
                        </div>
                      </div>

                      <div className={subCardClass + " p-4"}>
                        <div className="text-sm font-semibold">Meetings Carrying Gaps</div>
                        <div className="mt-3 space-y-2">
                          {executionGapReport.meetingGaps.length ? executionGapReport.meetingGaps.map((meetingGap) => (
                            <div key={meetingGap.meetingId} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                              <div>
                                <div>{meetingGap.title}</div>
                                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  {meetingGap.dominantTheme || "No dominant theme"}
                                </div>
                              </div>
                              <div className="text-right text-xs text-neutral-500 dark:text-neutral-400">
                                <div>{meetingGap.ownerlessActionCount} ownerless</div>
                                <div>{meetingGap.openQuestionCount} open questions</div>
                              </div>
                            </div>
                          )) : (
                            <div className="text-sm text-neutral-500 dark:text-neutral-400">No meetings with tracked gaps yet.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Execution gap report not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Meeting Entity Links</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    This layer attaches recent meetings to real buyers, workstreams, account surfaces, and agreement boundaries so the meeting corpus becomes part of the operating graph instead of a detached memory archive.
                  </p>
                </div>
                <button type="button" onClick={() => void loadEntityLinkReport()} className={buttonGhost}>
                  Refresh links
                </button>
              </div>

              {entityLinkReport ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {entityLinkReport.operatorRead}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Meetings</div>
                      <div className="mt-2 text-2xl font-semibold">{entityLinkReport.summary.meetingCount}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        {entityLinkReport.summary.linkedMeetingCount} linked
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Buyers</div>
                      <div className="mt-2 text-2xl font-semibold">{entityLinkReport.summary.distinctBuyers}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        buyer surfaces touched
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Workstreams</div>
                      <div className="mt-2 text-2xl font-semibold">{entityLinkReport.summary.distinctWorkstreams}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        linked operating threads
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Accounts</div>
                      <div className="mt-2 text-2xl font-semibold">{entityLinkReport.summary.distinctAccounts}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        platform surfaces referenced
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Weak Coverage</div>
                      <div className="mt-2 text-2xl font-semibold">{entityLinkReport.summary.weakCoverageMeetings}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        {entityLinkReport.summary.unlinkedMeetingCount} fully unlinked
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-4">
                      <div className={subCardClass + " p-4"}>
                        <div className="text-sm font-semibold">Top Buyers And Workstreams</div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            {entityLinkReport.topBuyers.length ? entityLinkReport.topBuyers.map((buyer) => (
                              <div key={buyer.buyerName} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                                <div className="text-sm font-medium">{buyer.buyerName}</div>
                                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  {buyer.meetingCount} meetings · strongest evidence {prettyLabel(buyer.strongestEvidence)}
                                </div>
                              </div>
                            )) : (
                              <div className="text-sm text-neutral-500 dark:text-neutral-400">No buyer links surfaced yet.</div>
                            )}
                          </div>
                          <div className="space-y-2">
                            {entityLinkReport.topWorkstreams.length ? entityLinkReport.topWorkstreams.map((workstream) => (
                              <div key={workstream.workstreamLabel} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                                <div className="text-sm font-medium">{workstream.workstreamLabel}</div>
                                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  {workstream.meetingCount} linked meetings
                                </div>
                              </div>
                            )) : (
                              <div className="text-sm text-neutral-500 dark:text-neutral-400">No workstream links surfaced yet.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={subCardClass + " p-4"}>
                        <div className="text-sm font-semibold">Platform And Contract Surfaces</div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            {entityLinkReport.topAccounts.length ? entityLinkReport.topAccounts.map((account) => (
                              <div key={account.accountLabel} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                                <div className="text-sm font-medium">{account.accountLabel}</div>
                                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  {account.meetingCount} meetings · risk {prettyLabel(account.policyRiskLevel)}
                                </div>
                              </div>
                            )) : (
                              <div className="text-sm text-neutral-500 dark:text-neutral-400">No account links surfaced yet.</div>
                            )}
                          </div>
                          <div className="space-y-2">
                            {entityLinkReport.topContracts.length ? entityLinkReport.topContracts.map((contract) => (
                              <div key={contract.contractLabel} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                                <div className="text-sm font-medium">{contract.contractLabel}</div>
                                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  {contract.meetingCount} meetings · {contract.primaryCounterparty}
                                </div>
                              </div>
                            )) : (
                              <div className="text-sm text-neutral-500 dark:text-neutral-400">No contract links surfaced yet.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={subCardClass + " p-4"}>
                      <div className="text-sm font-semibold">Recent Meetings And Link Coverage</div>
                      <div className="mt-3 space-y-3">
                        {entityLinkReport.meetings.length ? entityLinkReport.meetings.map((item) => (
                          <div key={item.meetingId} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">{item.title}</div>
                                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  {formatDate(item.occurredAt)} · coverage {formatPercent(item.linkCoverageScore)}
                                </div>
                              </div>
                              <span className={pillClass}>{item.unlinked ? "Unlinked" : "Linked"}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              {item.buyerLinks.map((buyer) => (
                                <span key={buyer.buyerName} className={pillClass}>{buyer.buyerName}</span>
                              ))}
                              {item.workstreams.map((workstream) => (
                                <span key={workstream.workstreamKey} className={pillClass}>{workstream.workstreamLabel}</span>
                              ))}
                              {item.accountLinks.map((account) => (
                                <span key={account.accountKey} className={pillClass}>{account.accountLabel}</span>
                              ))}
                              {item.contractLinks.map((contract) => (
                                <span key={contract.contractKey} className={pillClass}>{contract.contractLabel}</span>
                              ))}
                            </div>
                            <div className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                              {item.actionCount} actions · {item.ownerlessActionCount} ownerless · {item.signalCount} signals
                            </div>
                          </div>
                        )) : (
                          <div className="text-sm text-neutral-500 dark:text-neutral-400">No recent meetings available for linking yet.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Meeting entity link report not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Opportunity Supply Quality Loop</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    This layer scores whether upstream opportunity supply is actually converting into blueprint-backed and launch-proven work, instead of only measuring how much inventory exists.
                  </p>
                </div>
                <button type="button" onClick={() => void loadOpportunitySupplyQualityLoopReport()} className={buttonGhost}>
                  Refresh quality loop
                </button>
              </div>

              {opportunitySupplyQualityLoopReport ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {opportunitySupplyQualityLoopReport.operatorRead}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Launch Rate</div>
                      <div className="mt-2 text-2xl font-semibold">{formatPercent(opportunitySupplyQualityLoopReport.summary.launchRate)}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        {opportunitySupplyQualityLoopReport.summary.launched} launched of {opportunitySupplyQualityLoopReport.summary.total}
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Blueprint Coverage</div>
                      <div className="mt-2 text-2xl font-semibold">{formatPercent(opportunitySupplyQualityLoopReport.summary.blueprintCoverage)}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        {opportunitySupplyQualityLoopReport.summary.blueprintBacked} blueprint-backed
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Closed Loop</div>
                      <div className="mt-2 text-2xl font-semibold">{formatPercent(opportunitySupplyQualityLoopReport.summary.closedLoopRate)}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        launched or rejected
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Stale Pending</div>
                      <div className="mt-2 text-2xl font-semibold">{opportunitySupplyQualityLoopReport.summary.stalePending}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        {formatPercent(opportunitySupplyQualityLoopReport.summary.stalePendingRate)} of pending
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Pending ΔCM</div>
                      <div className="mt-2 text-2xl font-semibold">{formatMoney(opportunitySupplyQualityLoopReport.summary.pendingPredictedDeltaCm)}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        upside still in queue
                      </div>
                    </div>
                  </div>

                  <div className={subCardClass + " p-4"}>
                    <div className="text-sm font-semibold">Systemic Issues</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {opportunitySupplyQualityLoopReport.systemicIssues.map((issue) => (
                        <span key={issue} className={pillClass}>{issue}</span>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-sm font-semibold">By Owner</div>
                      <div className="mt-3 space-y-3">
                        {opportunitySupplyQualityLoopReport.owners.length ? opportunitySupplyQualityLoopReport.owners.map((item) => (
                          <div key={item.ownerLabel} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">{item.ownerLabel}</div>
                                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  {item.total} total · {item.pending} pending · {item.launched} launched
                                </div>
                              </div>
                              <span className={pillClass}>{prettyLabel(item.qualityBand)}</span>
                            </div>
                            <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                              launch {formatPercent(item.launchRate)} · stale {formatPercent(item.stalePendingRate)} · blueprint {formatPercent(item.blueprintCoverage)}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              {item.reasons.map((reason) => (
                                <span key={reason} className={pillClass}>{reason}</span>
                              ))}
                            </div>
                          </div>
                        )) : (
                          <div className="text-sm text-neutral-500 dark:text-neutral-400">No owner quality rows yet.</div>
                        )}
                      </div>
                    </div>

                    <div className={subCardClass + " p-4"}>
                      <div className="text-sm font-semibold">By Source</div>
                      <div className="mt-3 space-y-3">
                        {opportunitySupplyQualityLoopReport.sources.length ? opportunitySupplyQualityLoopReport.sources.map((item) => (
                          <div key={item.source} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">{item.source}</div>
                                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  {item.total} total · {item.pending} pending · {item.launched} launched
                                </div>
                              </div>
                              <span className={pillClass}>{prettyLabel(item.qualityBand)}</span>
                            </div>
                            <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                              launch {formatPercent(item.launchRate)} · stale {formatPercent(item.stalePendingRate)} · blueprint {formatPercent(item.blueprintCoverage)}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              {item.reasons.map((reason) => (
                                <span key={reason} className={pillClass}>{reason}</span>
                              ))}
                            </div>
                          </div>
                        )) : (
                          <div className="text-sm text-neutral-500 dark:text-neutral-400">No source quality rows yet.</div>
                        )}
                      </div>
                    </div>

                    <div className={subCardClass + " p-4"}>
                      <div className="text-sm font-semibold">By Category</div>
                      <div className="mt-3 space-y-3">
                        {opportunitySupplyQualityLoopReport.categories.length ? opportunitySupplyQualityLoopReport.categories.map((item) => (
                          <div key={item.category} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">{item.category}</div>
                                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  {item.total} total · {item.pending} pending · {item.launched} launched
                                </div>
                              </div>
                              <span className={pillClass}>{prettyLabel(item.qualityBand)}</span>
                            </div>
                            <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                              launch {formatPercent(item.launchRate)} · stale {formatPercent(item.stalePendingRate)} · blueprint {formatPercent(item.blueprintCoverage)}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              {item.reasons.map((reason) => (
                                <span key={reason} className={pillClass}>{reason}</span>
                              ))}
                            </div>
                          </div>
                        )) : (
                          <div className="text-sm text-neutral-500 dark:text-neutral-400">No category quality rows yet.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Opportunity supply quality loop not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Opportunity + Intent-Packet Workstreams</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    This is the upstream exploration surface the board asked for: opportunity supply on one side, intent-packet learning on the other, with the missing ownership gaps made explicit.
                  </p>
                </div>
                <button type="button" onClick={() => void loadWorkstreamReport()} className={buttonGhost}>
                  Refresh workstreams
                </button>
              </div>

              {workstreamReport ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {workstreamReport.operatorRead}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className={subCardClass + " p-4"}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Opportunity Supply</div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {workstreamReport.window.lookbackDays}d window · queue and blueprint funnel
                          </div>
                        </div>
                        <span className={pillClass}>
                          {workstreamReport.opportunity.schemaAvailable ? "Schema live" : "Schema missing"}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Queue</div>
                          <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                            {workstreamReport.opportunity.summary.pending} pending · {workstreamReport.opportunity.summary.stalePending} stale
                          </div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {formatMoney(workstreamReport.opportunity.summary.pendingPredictedDeltaCm)} pending ΔCM
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Blueprints</div>
                          <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                            {workstreamReport.opportunity.summary.blueprintDraft} draft · {workstreamReport.opportunity.summary.blueprintApproved} approved
                          </div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {workstreamReport.opportunity.summary.blueprintLaunched} launched
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 text-sm text-neutral-700 dark:text-neutral-200">
                        {workstreamReport.opportunity.operatorRead}
                      </div>

                      <div className="mt-4 space-y-2">
                        {workstreamReport.opportunity.topPending.length ? workstreamReport.opportunity.topPending.map((item) => (
                          <div key={item.id} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-sm font-medium">{item.angle}</div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {item.source} · {item.category || "uncategorized"} · age {item.ageDays}d · blueprints {item.blueprintCount}
                            </div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              ΔCM {formatMoney(item.predictedDeltaCm)} · confidence {item.confidenceScore != null ? item.confidenceScore.toFixed(2) : "N/A"}
                            </div>
                          </div>
                        )) : (
                          <div className="text-sm text-neutral-500 dark:text-neutral-400">No pending opportunities surfaced.</div>
                        )}
                      </div>
                    </div>

                    <div className={subCardClass + " p-4"}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Intent-Packet Exploration</div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {workstreamReport.window.lookbackDays}d window · learning observations
                          </div>
                        </div>
                        <span className={pillClass}>
                          {workstreamReport.intentPacket.summary.observationCount} observations
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Learning Health</div>
                          <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                            {workstreamReport.intentPacket.summary.uniquePackets} packets · {workstreamReport.intentPacket.summary.uniqueKeywords} keywords
                          </div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            approval {formatPercent(workstreamReport.intentPacket.summary.approvalRate)} · review flags {formatPercent(workstreamReport.intentPacket.summary.reviewFlagRate)}
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Economics</div>
                          <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                            Margin {formatMoney(workstreamReport.intentPacket.summary.netMargin)}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            Revenue {formatMoney(workstreamReport.intentPacket.summary.revenue)} · Spend {formatMoney(workstreamReport.intentPacket.summary.spend)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 text-sm text-neutral-700 dark:text-neutral-200">
                        {workstreamReport.intentPacket.operatorRead}
                      </div>

                      <div className="mt-4 space-y-2">
                        {workstreamReport.intentPacket.topKeywords.length ? workstreamReport.intentPacket.topKeywords.map((item) => (
                          <div key={item.keyword} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-sm font-medium">{item.keyword}</div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {item.observationCount} observations · approval {formatPercent(item.approvalRate)}
                            </div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              Margin {formatMoney(item.netMargin)} · Revenue {formatMoney(item.revenue)}
                            </div>
                          </div>
                        )) : (
                          <div className="text-sm text-neutral-500 dark:text-neutral-400">No intent-packet observations surfaced.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Workstream report not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Upstream Ownership Layer</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    This is the queue-and-cadence mechanism the board asked for: one lane for opportunity conversion ownership, one lane for intent-packet exploration ownership.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void loadOpportunityOwnershipReport()} className={buttonGhost}>
                    Refresh opportunities
                  </button>
                  <button type="button" onClick={() => void loadIntentPacketOwnershipReport()} className={buttonGhost}>
                    Refresh packets
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {opportunityOwnershipReport?.operatorRead || "Opportunity ownership report not loaded yet."}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Opportunity Queue</div>
                      <div className="mt-2 text-2xl font-semibold">{opportunityOwnershipReport?.summary.pending || 0}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        pending · {opportunityOwnershipReport?.summary.stalePending || 0} stale
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Ownership Gaps</div>
                      <div className="mt-2 text-2xl font-semibold">{opportunityOwnershipReport?.summary.ownerless || 0}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        ownerless · {opportunityOwnershipReport?.summary.overdueNextSteps || 0} overdue
                      </div>
                    </div>
                  </div>

                  <div className={subCardClass + " p-4"}>
                    <div className="text-sm font-semibold">Opportunity Conversion Queue</div>
                    <div className="mt-3 space-y-3">
                      {opportunityOwnershipReport?.queue.length ? opportunityOwnershipReport.queue.map((item) => (
                        <div key={item.opportunityId} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium">{item.angle}</div>
                              <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                {item.source} · {item.category || "uncategorized"} · age {item.ageDays}d
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={pillClass}>{prettyLabel(item.queueStatus)}</span>
                              <span className={pillClass}>{prettyLabel(item.priority)}</span>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                            owner {item.ownerName || "unassigned"} · ΔCM {formatMoney(item.predictedDeltaCm)} · blueprints {item.blueprintCount}/{item.approvedBlueprintCount} approved
                          </div>
                          {item.nextStep ? (
                            <div className="mt-3 text-sm text-neutral-700 dark:text-neutral-200">
                              Next: {item.nextStep}
                            </div>
                          ) : null}
                          {item.blockerSummary ? (
                            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                              Blocker: {item.blockerSummary}
                            </div>
                          ) : null}
                        </div>
                      )) : (
                        <div className="text-sm text-neutral-500 dark:text-neutral-400">No opportunity ownership queue rows surfaced yet.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {intentPacketOwnershipReport?.operatorRead || "Intent-packet ownership report not loaded yet."}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Packet Queue</div>
                      <div className="mt-2 text-2xl font-semibold">{intentPacketOwnershipReport?.summary.total || 0}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        {intentPacketOwnershipReport?.summary.positiveSignalPackets || 0} positive signal
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Cadence Gaps</div>
                      <div className="mt-2 text-2xl font-semibold">{intentPacketOwnershipReport?.summary.ownerless || 0}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        ownerless · {intentPacketOwnershipReport?.summary.reviewDue || 0} review due
                      </div>
                    </div>
                  </div>

                  <div className={subCardClass + " p-4"}>
                    <div className="text-sm font-semibold">Intent-Packet Exploration Queue</div>
                    <div className="mt-3 space-y-3">
                      {intentPacketOwnershipReport?.queue.length ? intentPacketOwnershipReport.queue.map((item) => (
                        <div key={item.queueKey} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium">{item.packetName || item.primaryKeyword}</div>
                              <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                {item.primaryKeyword} · {item.market || "unknown market"} · observations {item.observationCount}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={pillClass}>{prettyLabel(item.queueStatus)}</span>
                              <span className={pillClass}>{prettyLabel(item.priority)}</span>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                            owner {item.ownerName || "unassigned"} · margin {formatMoney(item.netMargin)} · approved {item.approvedCount} · review flags {item.reviewFlagCount}
                          </div>
                          {item.nextStep ? (
                            <div className="mt-3 text-sm text-neutral-700 dark:text-neutral-200">
                              Next: {item.nextStep}
                            </div>
                          ) : null}
                          {item.blockerSummary ? (
                            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                              Blocker: {item.blockerSummary}
                            </div>
                          ) : null}
                        </div>
                      )) : (
                        <div className="text-sm text-neutral-500 dark:text-neutral-400">No intent-packet ownership queue rows surfaced yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Local Intelligence Report</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Grounded summary from the local meeting-intelligence SQLite seed. This is the fastest view of what recent meetings are demanding from the system right now.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void loadLocalReport()} className={buttonGhost}>
                    Refresh report
                  </button>
                  <button
                    type="button"
                    onClick={() => void rebuildLocalReport()}
                    className={buttonSecondary}
                    disabled={rebuildingLocalReport}
                  >
                    {rebuildingLocalReport ? "Rebuilding..." : "Rebuild local DB"}
                  </button>
                </div>
              </div>

              {localReport ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Recent Meetings</div>
                      <div className="mt-2 text-2xl font-semibold">{localReport.summary.recentMeetingCount}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        {localReport.summary.recentDecisionCount} decisions · {localReport.summary.recentActionCount} actions
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Open Actions</div>
                      <div className="mt-2 text-2xl font-semibold">{localReport.summary.openActionCount}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        {localReport.summary.overdueActionCount} overdue · {localReport.summary.dueSoonActionCount} due soon
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Heaviest Queue</div>
                      <div className="mt-2 text-lg font-semibold">{localReport.summary.heaviestOwner || "n/a"}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        {localReport.summary.heaviestOwnerOpenActionCount} open actions
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Dominant Theme</div>
                      <div className="mt-2 text-lg font-semibold">{localReport.summary.dominantTheme || "n/a"}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        Window: {localReport.window.since} to {localReport.window.through}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {localReport.operatorRead}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-sm font-semibold">High-Priority Open Actions</div>
                      <div className="mt-3 space-y-3">
                        {localReport.highPriorityOpenActions.length ? localReport.highPriorityOpenActions.map((action) => (
                          <div key={`${action.slug}-${action.description}`} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-sm font-medium">{action.description}</div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              Owner: {action.ownerName} · Due: {action.dueAt || "n/a"}
                            </div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              From: {action.title}
                            </div>
                          </div>
                        )) : (
                          <div className="text-sm text-neutral-500 dark:text-neutral-400">No high-priority open actions in the current window.</div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className={subCardClass + " p-4"}>
                        <div className="text-sm font-semibold">Owner Queues</div>
                        <div className="mt-3 space-y-2">
                          {localReport.ownerQueues.length ? localReport.ownerQueues.map((owner) => (
                            <div key={owner.ownerName} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
                              <div>{owner.ownerName}</div>
                              <div className="text-neutral-500 dark:text-neutral-400">
                                {owner.openActionCount} open · {owner.highPriorityCount} high
                              </div>
                            </div>
                          )) : (
                            <div className="text-sm text-neutral-500 dark:text-neutral-400">No owner queue data.</div>
                          )}
                        </div>
                      </div>

                      <div className={subCardClass + " p-4"}>
                        <div className="text-sm font-semibold">Recurring Themes</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {localReport.recurringThemes.length ? localReport.recurringThemes.map((theme) => (
                            <div key={theme.theme} className={pillClass}>
                              {theme.theme} · {theme.mentionCount}
                            </div>
                          )) : (
                            <div className="text-sm text-neutral-500 dark:text-neutral-400">No recurring themes yet.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Local report not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Founder Private Lanes</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Private Slack channels and threads between you and individual team members stay private by default here, so you can track what each person needs to achieve without leaking it into shared operator telemetry.
                  </p>
                </div>
                <button type="button" onClick={() => void loadPrivateConversationReport()} className={buttonGhost}>
                  Refresh private lanes
                </button>
              </div>

              {privateConversationReport ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {privateConversationReport.operatorRead}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Active Lanes</div>
                      <div className="mt-2 text-2xl font-semibold">{privateConversationReport.summary.activeConversations}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        private founder channels tracked
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Need Attention</div>
                      <div className="mt-2 text-2xl font-semibold">{privateConversationReport.summary.conversationsNeedingAttention}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        blocked, stale, or unresolved
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Open Actions</div>
                      <div className="mt-2 text-2xl font-semibold">{privateConversationReport.summary.conversationsWithOpenActions}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        lanes carrying follow-through
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">No Meeting Yet</div>
                      <div className="mt-2 text-2xl font-semibold">{privateConversationReport.summary.conversationsWithNoMeeting}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        registered but not yet ingested
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Stale Lanes</div>
                      <div className="mt-2 text-2xl font-semibold">{privateConversationReport.summary.staleConversations}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        3+ days since last movement
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {privateConversationReport.conversations.length ? privateConversationReport.conversations.map((conversation) => (
                      <div key={conversation.sourceKey} className={subCardClass + " p-4"}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{conversation.counterpartName}</div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {conversation.label} · {prettyLabel(conversation.status)} · {conversation.watchWindow || "n/a"}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className={pillClass}>{prettyLabel(conversation.visibilityScope)}</span>
                            {conversation.autoIngest ? <span className={pillClass}>Auto Ingest</span> : null}
                          </div>
                        </div>

                        {conversation.objective ? (
                          <div className="mt-3 text-sm text-neutral-700 dark:text-neutral-200">
                            Objective: {conversation.objective}
                          </div>
                        ) : null}

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Latest Movement</div>
                            <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                              {conversation.lastMeeting ? formatDate(conversation.lastMeeting.occurredAt) : "No ingest yet"}
                            </div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              stale {conversation.staleDays == null ? "n/a" : `${conversation.staleDays}d`}
                            </div>
                          </div>
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Follow-Through</div>
                            <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                              {conversation.openActionCount} open · {conversation.openQuestionCount} open questions
                            </div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {conversation.ownerlessActionCount} ownerless · {conversation.blockedActionCount} blocked
                            </div>
                          </div>
                        </div>

                        {conversation.lastMeeting ? (
                          <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-sm font-medium">{conversation.lastMeeting.title}</div>
                            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                              {conversation.lastMeeting.summaryMd || conversation.lastMeeting.actionSummaryMd || conversation.lastMeeting.decisionSummaryMd || "No summary captured yet."}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 rounded-xl border border-dashed border-neutral-300 px-3 py-3 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                            This lane is registered but has not been ingested into the intelligence system yet.
                          </div>
                        )}
                      </div>
                    )) : (
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">No founder-private lanes are registered yet.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Private-lane report not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Owner Alerts</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Alerts tie execution pressure to recent buyer performance so follow-through starts affecting who should receive more capital or intervention.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void syncAlertNotifications()} className={buttonSecondary} disabled={syncingAlerts}>
                    {syncingAlerts ? "Syncing..." : "Sync notifications"}
                  </button>
                  <button type="button" onClick={() => { void loadOwnerAlerts(); void loadBuyerScorecards(); }} className={buttonGhost}>
                    Refresh scorecards
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {ownerAlerts.length ? ownerAlerts.map((alert) => (
                  <div key={`${alert.ownerKey}-${alert.severity}`} className={subCardClass + " p-4"}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{alert.ownerLabel}</div>
                        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {prettyLabel(alert.severity)} · execution score {Math.round(alert.executionScore)}
                        </div>
                      </div>
                      <div className={`${pillClass} ${
                        alert.severity === "critical"
                          ? "!bg-red-500/10 !text-red-600 dark:!bg-red-500/20 dark:!text-red-300"
                          : alert.severity === "high"
                            ? "!bg-orange-500/10 !text-orange-600 dark:!bg-orange-500/20 dark:!text-orange-300"
                            : "!bg-yellow-500/10 !text-yellow-700 dark:!bg-yellow-500/20 dark:!text-yellow-300"
                      }`}>
                        {prettyLabel(alert.severity)}
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-neutral-800 dark:text-neutral-200">{alert.primaryMessage}</div>
                    <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      Net margin: ${alert.netMargin.toFixed(2)} · queue pressure {alert.queuePressure}
                    </div>
                    <div className="mt-3 rounded-lg border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                      {alert.recommendedAction}
                    </div>
                  </div>
                )) : (
                  <div className="text-sm text-neutral-500 dark:text-neutral-400">No active owner alerts right now.</div>
                )}
              </div>
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Alert Notifications</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Durable alert records show which owner alerts were queued, acknowledged, or dismissed.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {alertNotifications.length ? alertNotifications.map((notification) => (
                  <div key={notification.id} className={subCardClass + " p-4"}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{notification.owner_label}</div>
                        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {prettyLabel(notification.severity)} · {prettyLabel(notification.status)} · {formatDate(notification.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-neutral-800 dark:text-neutral-200">{notification.message}</div>
                    {notification.recommended_action ? (
                      <div className="mt-3 rounded-lg border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                        {notification.recommended_action}
                      </div>
                    ) : null}
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={() => void updateAlertNotification(notification.id, "acknowledged")} className={buttonGhost}>
                        Acknowledge
                      </button>
                      <button type="button" onClick={() => void updateAlertNotification(notification.id, "dismissed")} className={buttonGhost}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="text-sm text-neutral-500 dark:text-neutral-400">No alert notifications recorded yet.</div>
                )}
              </div>
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Surface Preservation And Recovery Command Layer</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    This layer runs the fragile surfaces directly: recovery, keepalive, redirect hygiene, and sanctioned-automation readiness.
                  </p>
                </div>
                <button type="button" onClick={() => void loadSurfacePreservationCommandLayerReport()} className={buttonGhost}>
                  Refresh preservation queue
                </button>
              </div>

              {surfacePreservationCommandLayerReport ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {surfacePreservationCommandLayerReport.operatorRead}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Total</div>
                      <div className="mt-2 text-2xl font-semibold">{surfacePreservationCommandLayerReport.summary.total}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">surface commands</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Critical</div>
                      <div className="mt-2 text-2xl font-semibold">{surfacePreservationCommandLayerReport.summary.critical}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">repair-first items</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">High</div>
                      <div className="mt-2 text-2xl font-semibold">{surfacePreservationCommandLayerReport.summary.high}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">preserve capacity / hygiene</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Open</div>
                      <div className="mt-2 text-2xl font-semibold">{surfacePreservationCommandLayerReport.summary.open}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">active preservation work</div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {surfacePreservationCommandLayerReport.commands.length ? surfacePreservationCommandLayerReport.commands.map((command) => (
                      <div key={command.commandKey} className={subCardClass + " p-4"}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{command.surfaceLabel}</div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {prettyLabel(command.commandType)} · owner {command.owner}
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <span className={pillClass}>{prettyLabel(command.priority)}</span>
                            <span className={pillClass}>{prettyLabel(command.status)}</span>
                          </div>
                        </div>

                        <div className="mt-3 text-sm text-neutral-700 dark:text-neutral-200">
                          {command.objective}
                        </div>

                        <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Next Step</div>
                          <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">{command.nextStep}</div>
                        </div>

                        <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Unlock Condition</div>
                          <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">{command.unlockCondition}</div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">Surface preservation command layer has no rows in this environment yet.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Surface preservation command layer not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Packet Lineage And Reuse Graph</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    This layer maps packet families to origin owner, current owners, and reuse state so the system can separate invention from self-reuse and cross-buyer copying.
                  </p>
                </div>
                <button type="button" onClick={() => void loadPacketLineageGraphReport()} className={buttonGhost}>
                  Refresh lineage graph
                </button>
              </div>

              {packetLineageGraphReport ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {packetLineageGraphReport.operatorRead}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Families</div>
                      <div className="mt-2 text-2xl font-semibold">{packetLineageGraphReport.summary.totalFamilies}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">packet families tracked</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Cross-Buyer</div>
                      <div className="mt-2 text-2xl font-semibold">{packetLineageGraphReport.summary.crossBuyerReuseFamilies}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">reuse across buyers</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Self Reuse</div>
                      <div className="mt-2 text-2xl font-semibold">{packetLineageGraphReport.summary.selfReuseFamilies}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">same-owner reuse</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Original Only</div>
                      <div className="mt-2 text-2xl font-semibold">{packetLineageGraphReport.summary.originalOnlyFamilies}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">not yet spreading</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Launched</div>
                      <div className="mt-2 text-2xl font-semibold">{packetLineageGraphReport.summary.launchedFamilies}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">families with launched blueprints</div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {packetLineageGraphReport.packets.length ? packetLineageGraphReport.packets.map((packet) => (
                      <div key={packet.familyKey} className={subCardClass + " p-4"}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{packet.packetLabel}</div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              origin {packet.originOwner} · owners {packet.ownerCount} · opps {packet.opportunityCount}
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <span className={pillClass}>{prettyLabel(packet.reuseState)}</span>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Blueprints</div>
                            <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                              {packet.blueprintCount} total · {packet.launchedBlueprintCount} launched
                            </div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              approved {packet.approvedBlueprintCount} · launched opps {packet.launchedOpportunityCount}
                            </div>
                          </div>
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Ownership Spread</div>
                            <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                              current {packet.currentOwners.join(", ") || "none"}
                            </div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              reuse {packet.reuseOwners.join(", ") || "none"}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {packet.reasons.map((reason) => (
                            <span key={reason} className={pillClass}>{reason}</span>
                          ))}
                        </div>
                      </div>
                    )) : (
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">Packet lineage graph has no rows in this environment yet.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Packet lineage graph not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Buyer Daily Command Packets</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Phase 1 is operator-only: these packets condense scorecards, allocation policy, upstream queues, and surface work into a daily buyer plan without sending anything to the buyers.
                  </p>
                </div>
                <button type="button" onClick={() => void loadBuyerDailyCommandPacketReport()} className={buttonGhost}>
                  Refresh packets
                </button>
              </div>

              {buyerDailyCommandPacketReport ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {buyerDailyCommandPacketReport.operatorRead}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Mode</div>
                      <div className="mt-2 text-lg font-semibold">Preview Only</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        no buyer messages
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Critical</div>
                      <div className="mt-2 text-2xl font-semibold">{buyerDailyCommandPacketReport.summary.critical}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        immediate repair packets
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Explore Work</div>
                      <div className="mt-2 text-2xl font-semibold">{buyerDailyCommandPacketReport.summary.buyersNeedingExplore}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        buyers with upstream asks
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Follow-Through</div>
                      <div className="mt-2 text-2xl font-semibold">{buyerDailyCommandPacketReport.summary.buyersNeedingFollowThrough}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        buyers carrying open loops
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Surface Work</div>
                      <div className="mt-2 text-2xl font-semibold">{buyerDailyCommandPacketReport.summary.buyersWithSurfaceWork}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        packets linked to surface commands
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Act First</div>
                      <div className="mt-2 text-2xl font-semibold">{buyerDailyCommandPacketReport.summary.actFirstCount}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        packets above the act-now threshold
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Weak Supply</div>
                      <div className="mt-2 text-2xl font-semibold">{buyerDailyCommandPacketReport.summary.buyersWithWeakSupplyQuality}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        packets with red supply quality
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Buyer-Ready</div>
                      <div className="mt-2 text-2xl font-semibold">{buyerDailyCommandPacketReport.summary.readyToDelegate}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        clean preview-only packets
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Override Only</div>
                      <div className="mt-2 text-2xl font-semibold">{buyerDailyCommandPacketReport.summary.overrideOnly}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        supervised exception packets
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Hard Stop</div>
                      <div className="mt-2 text-2xl font-semibold">{buyerDailyCommandPacketReport.summary.hardBlockedForDelegation}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        not safe to delegate yet
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {buyerDailyCommandPacketReport.packets.length ? buyerDailyCommandPacketReport.packets.map((item) => (
                      <div key={item.packetKey} className={subCardClass + " p-4"}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">#{item.sequenceIndex} in operator queue</div>
                            <div className="mt-1 text-sm font-semibold">{item.ownerLabel}</div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              Score {Math.round(item.commandScore)} · margin {formatMoney(item.metrics.netMargin)} · exec {Math.round(item.metrics.executionScore)} · launches {item.metrics.recentLaunches}
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <span className={pillClass}>{prettyLabel(item.priority)}</span>
                            <span className={pillClass}>{prettyLabel(item.policyAction)}</span>
                            <span className={pillClass}>supply {prettyLabel(item.metrics.supplyQualityBand)}</span>
                            <span className={pillClass}>Preview only</span>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-3 py-3 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12]">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Act First Because</div>
                          <div className="mt-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">
                            {item.firstAction || "No first action generated yet."}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {item.orderingReasons.length ? item.orderingReasons.map((reason) => (
                              <span key={reason} className={pillClass}>{reason}</span>
                            )) : <span className={pillClass}>No ordering reasons generated yet</span>}
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Top Focus</div>
                          <div className="mt-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">{item.topFocus}</div>
                          <div className="mt-2 text-sm text-neutral-700 dark:text-neutral-200">{item.whyNow}</div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Today Asks</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              {item.todayAsks.length ? item.todayAsks.map((ask) => (
                                <div key={ask}>{ask}</div>
                              )) : <div>No explicit asks generated yet.</div>}
                            </div>
                          </div>
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Blockers</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              {item.blockers.length ? item.blockers.map((blocker) => (
                                <div key={blocker}>{blocker}</div>
                              )) : <div>No active blockers recorded.</div>}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Supply Quality</div>
                          <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                            {prettyLabel(item.upstream.quality.qualityBand)} · launch {formatPercent(item.upstream.quality.launchRate)} · blueprint {formatPercent(item.upstream.quality.blueprintCoverage)}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {item.upstream.quality.reasons.length ? item.upstream.quality.reasons.map((reason) => (
                              <span key={reason} className={pillClass}>{reason}</span>
                            )) : <span className={pillClass}>No quality signal yet</span>}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Explore</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              {item.exploreTasks.length ? item.exploreTasks.map((task) => (
                                <div key={task}>{task}</div>
                              )) : <div>No explore task generated.</div>}
                            </div>
                          </div>
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Exploit</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              {item.exploitTasks.length ? item.exploitTasks.map((task) => (
                                <div key={task}>{task}</div>
                              )) : <div>No exploit task generated.</div>}
                            </div>
                          </div>
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Follow-Through</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              {item.followThroughTasks.length ? item.followThroughTasks.map((task) => (
                                <div key={task}>{task}</div>
                              )) : <div>No follow-through task generated.</div>}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-3 dark:border-neutral-700 dark:bg-neutral-950">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Draft Preview For Operator Review</div>
                          <div className="mt-2 text-sm text-neutral-700 dark:text-neutral-200">{item.draftPreview}</div>
                        </div>

                        <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Delegation Boundary</div>
                              <div className="mt-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">{prettyLabel(item.delegationBoundary.status)}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={pillClass}>preview only</span>
                              <span className={pillClass}>{item.delegationBoundary.override.allowed ? "override allowed" : "override blocked"}</span>
                              <span className={pillClass}>risk {prettyLabel(item.delegationBoundary.override.riskLevel)}</span>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Why Not Safe Yet</div>
                              <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                                {item.delegationBoundary.reasons.length ? item.delegationBoundary.reasons.map((reason) => (
                                  <div key={reason}>{reason}</div>
                                )) : <div>No active delegation boundary.</div>}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">What Must Change</div>
                              <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                                {item.delegationBoundary.becomesReadyWhen.length ? item.delegationBoundary.becomesReadyWhen.map((condition) => (
                                  <div key={condition}>{condition}</div>
                                )) : <div>This lane is already clean enough for preview-only delegation.</div>}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-3 dark:border-neutral-700 dark:bg-neutral-950">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Operator Override Semantics</div>
                            <div className="mt-2 text-xs text-neutral-700 dark:text-neutral-200">{item.delegationBoundary.override.guidance}</div>
                            {item.delegationBoundary.override.requiredBeforeOverride.length ? (
                              <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                                {item.delegationBoundary.override.requiredBeforeOverride.map((step) => (
                                  <div key={step}>{step}</div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {item.surfaceCommands.length || item.upstream.opportunities.length || item.upstream.intentPackets.length ? (
                          <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                              <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Surface Commands</div>
                              <div className="mt-2 space-y-2 text-xs text-neutral-700 dark:text-neutral-200">
                                {item.surfaceCommands.length ? item.surfaceCommands.map((command) => (
                                  <div key={command.commandKey}>
                                    <div className="font-medium">{command.surfaceLabel}</div>
                                    <div>{command.nextStep}</div>
                                  </div>
                                )) : <div>No linked surface commands.</div>}
                              </div>
                            </div>
                            <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                              <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Owned Opportunities</div>
                              <div className="mt-2 space-y-2 text-xs text-neutral-700 dark:text-neutral-200">
                                {item.upstream.opportunities.length ? item.upstream.opportunities.map((opportunity) => (
                                  <div key={opportunity.opportunityId}>
                                    <div className="font-medium">{opportunity.angle}</div>
                                    <div>{prettyLabel(opportunity.queueStatus)} · age {opportunity.ageDays}d</div>
                                  </div>
                                )) : <div>No owned opportunities in the preview window.</div>}
                              </div>
                            </div>
                            <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                              <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Intent Packets</div>
                              <div className="mt-2 space-y-2 text-xs text-neutral-700 dark:text-neutral-200">
                                {item.upstream.intentPackets.length ? item.upstream.intentPackets.map((packet) => (
                                  <div key={packet.queueKey}>
                                    <div className="font-medium">{packet.packetName}</div>
                                    <div>{prettyLabel(packet.queueStatus)} · margin {formatMoney(packet.netMargin)}</div>
                                  </div>
                                )) : <div>No owned packet queue items in the preview window.</div>}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )) : (
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">Buyer daily command packets have no rows in this environment yet.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Buyer daily command packets not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Allocation Execution Engine</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    This layer turns allocation trigger policy into a concrete queue of capital-control actions, blockers, and next moves.
                  </p>
                </div>
                <button type="button" onClick={() => void loadAllocationExecutionEngineReport()} className={buttonGhost}>
                  Refresh execution queue
                </button>
              </div>

              {allocationExecutionEngineReport ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {allocationExecutionEngineReport.operatorRead}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Critical</div>
                      <div className="mt-2 text-2xl font-semibold">{allocationExecutionEngineReport.summary.critical}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">repair-first lanes</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Blocked</div>
                      <div className="mt-2 text-2xl font-semibold">{allocationExecutionEngineReport.summary.blocked}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">cannot take more budget</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Fired</div>
                      <div className="mt-2 text-2xl font-semibold">{allocationExecutionEngineReport.summary.fired}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">ready for growth action</div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Queue Size</div>
                      <div className="mt-2 text-2xl font-semibold">{allocationExecutionEngineReport.summary.total}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">buyer policy tasks</div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {allocationExecutionEngineReport.queue.length ? allocationExecutionEngineReport.queue.map((item) => (
                      <div key={item.queueKey} className={subCardClass + " p-4"}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{item.ownerLabel}</div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              Margin {formatMoney(item.netMargin)} · exec {Math.round(item.executionScore)} · linked constraints {item.linkedConstraintCount}
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <span className={pillClass}>{prettyLabel(item.priority)}</span>
                            <span className={pillClass}>{prettyLabel(item.policyAction)}</span>
                            <span className={pillClass}>{prettyLabel(item.triggerState)}</span>
                          </div>
                        </div>

                        <div className="mt-3 text-sm text-neutral-700 dark:text-neutral-200">
                          {item.nextStep}
                        </div>

                        <div className="mt-3 rounded-lg border border-neutral-200 bg-white px-3 py-3 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                          {item.spendGuardrail || item.recommendedAction}
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Blockers</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              {item.blockers.length ? item.blockers.map((entry) => (
                                <div key={entry}>{entry}</div>
                              )) : <div>No active blockers recorded.</div>}
                            </div>
                          </div>
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Promote When</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              {item.promoteWhen.length ? item.promoteWhen.map((entry) => (
                                <div key={entry}>{entry}</div>
                              )) : <div>No promotion conditions recorded.</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">Allocation execution queue has no rows in this environment yet.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Allocation execution engine not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Allocator Grounding</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    This layer converts scorecards, execution pressure, platform constraints, and meeting-linked context into an explicit allocation posture instead of leaving the allocator to infer it from isolated metrics.
                  </p>
                </div>
                <button type="button" onClick={() => void loadAllocatorGroundingReport()} className={buttonGhost}>
                  Refresh allocator view
                </button>
              </div>

              {allocatorGroundingReport ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {allocatorGroundingReport.operatorRead}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">System Mode</div>
                      <div className="mt-2 text-lg font-semibold">{prettyLabel(allocatorGroundingReport.summary.systemMode)}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        allocator control stance
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Protect</div>
                      <div className="mt-2 text-2xl font-semibold">{allocatorGroundingReport.summary.postureCounts.protect}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        buyers to shield from new spend
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Grow / Scale</div>
                      <div className="mt-2 text-2xl font-semibold">
                        {allocatorGroundingReport.summary.policyActionCounts.allowMeasuredGrowth + allocatorGroundingReport.summary.policyActionCounts.allowScale}
                      </div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        buyers that can absorb capital
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Critical Constraints</div>
                      <div className="mt-2 text-2xl font-semibold">{allocatorGroundingReport.summary.criticalPlatformConstraints}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        platform blockers
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Follow-Through Debt</div>
                      <div className="mt-2 text-2xl font-semibold">{allocatorGroundingReport.summary.ownerlessActionItems}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        ownerless · {allocatorGroundingReport.summary.staleOpportunities} stale opps
                      </div>
                    </div>
                  </div>

                  <div className={subCardClass + " p-4"}>
                    <div className="text-sm font-semibold">Dominant Constraint</div>
                    <div className="mt-2 text-sm text-neutral-700 dark:text-neutral-200">
                      {allocatorGroundingReport.summary.dominantConstraint}
                    </div>
                    <div className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                      {allocatorGroundingReport.groundingSignals.errors.length
                        ? `Partial grounding: ${allocatorGroundingReport.groundingSignals.errors.join(" | ")}`
                        : "Grounded across scorecards, alerts, platform constraints, workstreams, execution gaps, and meeting entity links."}
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {allocatorGroundingReport.buyerAllocations.length ? allocatorGroundingReport.buyerAllocations.map((buyer) => (
                      <div key={buyer.ownerKey} className={subCardClass + " p-4"}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{buyer.ownerLabel}</div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              Margin {formatMoney(buyer.performance.netMargin)} · exec {Math.round(buyer.execution.executionScore)} · linked meetings {buyer.linkedMeetingCount}
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <span className={pillClass}>{prettyLabel(buyer.triggerPolicy.policyAction)}</span>
                            <span className={pillClass}>{prettyLabel(buyer.posture)}</span>
                            <span className={pillClass}>{prettyLabel(buyer.band)}</span>
                            {buyer.alertSeverity ? <span className={pillClass}>{prettyLabel(buyer.alertSeverity)}</span> : null}
                          </div>
                        </div>

                        <div className="mt-3 text-sm text-neutral-700 dark:text-neutral-200">
                          {buyer.recommendedAction}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {buyer.reasons.map((reason) => (
                            <span key={reason} className={pillClass}>{reason}</span>
                          ))}
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Execution</div>
                            <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                              {buyer.execution.overdueActions} overdue · {buyer.execution.needsOwner} ownerless
                            </div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              Queue pressure {Math.round(buyer.execution.queuePressure)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Linked Constraints</div>
                            <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                              {buyer.linkedConstraintCount} surfaced
                            </div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {buyer.linkedAccountKeys.length} accounts · {buyer.linkedContractKeys.length} contracts
                            </div>
                          </div>
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Policy Guardrail</div>
                            <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                              {prettyLabel(buyer.triggerPolicy.triggerState)} · {prettyLabel(buyer.triggerPolicy.policyAction)}
                            </div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {buyer.triggerPolicy.spendGuardrail}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Blockers</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              {buyer.triggerPolicy.blockers.length ? buyer.triggerPolicy.blockers.map((item) => (
                                <div key={item}>{item}</div>
                              )) : <div>No active blockers recorded.</div>}
                            </div>
                          </div>
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Promote When</div>
                            <div className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-200">
                              {buyer.triggerPolicy.promoteWhen.length ? buyer.triggerPolicy.promoteWhen.map((item) => (
                                <div key={item}>{item}</div>
                              )) : <div>No promotion conditions recorded.</div>}
                            </div>
                          </div>
                        </div>

                        {buyer.linkedConstraintSummaries.length ? (
                          <div className="mt-3 space-y-2">
                            {buyer.linkedConstraintSummaries.map((summary) => (
                              <div key={summary} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                                {summary}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )) : (
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">Allocator grounding report has no buyer rows in this environment yet.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Allocator grounding report not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Buyer Attribution Audit</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    This layer audits whether buyer scorecard economics are actually attached to the right buyer by comparing monitoring ownership against launch and assignment ownership.
                  </p>
                </div>
                <button type="button" onClick={() => void loadBuyerAttributionAudit()} className={buttonGhost}>
                  Refresh attribution
                </button>
              </div>

              {buyerAttributionAudit ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-4 py-4 text-sm text-neutral-800 dark:border-[#0071e3]/30 dark:bg-[#0071e3]/[0.12] dark:text-neutral-100">
                    {buyerAttributionAudit.operatorRead}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Campaigns</div>
                      <div className="mt-2 text-2xl font-semibold">{buyerAttributionAudit.summary.totalCampaigns}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        {buyerAttributionAudit.summary.knownMonitoringOwnerCampaigns} with monitoring owner
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Low Confidence</div>
                      <div className="mt-2 text-2xl font-semibold">{buyerAttributionAudit.summary.lowConfidenceCampaigns}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        campaigns needing human caution
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Launch Mismatches</div>
                      <div className="mt-2 text-2xl font-semibold">{buyerAttributionAudit.summary.launchOwnerMismatchCampaigns}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        vs launch ownership
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Queue Mismatches</div>
                      <div className="mt-2 text-2xl font-semibold">{buyerAttributionAudit.summary.queueOwnerMismatchCampaigns}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        vs assignment queue
                      </div>
                    </div>
                    <div className={subCardClass + " p-4"}>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Unattributed Spend</div>
                      <div className="mt-2 text-2xl font-semibold">{formatMoney(buyerAttributionAudit.summary.unattributedSpend)}</div>
                      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        monitoring owner missing
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className={subCardClass + " p-4"}>
                      <div className="text-sm font-semibold">Buyer-Level Attribution Confidence</div>
                      <div className="mt-3 space-y-3">
                        {buyerAttributionAudit.owners.length ? buyerAttributionAudit.owners.slice(0, 6).map((owner) => (
                          <div key={owner.ownerKey} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">{owner.ownerLabel}</div>
                                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  Coverage {formatPercent(owner.attributionCoverage)} · spend coverage {formatPercent(owner.spendCoverage)}
                                </div>
                              </div>
                              <span className={pillClass}>{prettyLabel(owner.attributionConfidence)}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              {owner.reasons.slice(0, 2).map((reason) => (
                                <span key={reason} className={pillClass}>{reason}</span>
                              ))}
                            </div>
                          </div>
                        )) : (
                          <div className="text-sm text-neutral-500 dark:text-neutral-400">No attribution audit rows are available in this window yet.</div>
                        )}
                      </div>
                    </div>

                    <div className={subCardClass + " p-4"}>
                      <div className="text-sm font-semibold">Ambiguous Campaigns</div>
                      <div className="mt-3 space-y-3">
                        {buyerAttributionAudit.ambiguousCampaigns.length ? buyerAttributionAudit.ambiguousCampaigns.map((campaign) => (
                          <div key={campaign.campaignId} className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">{campaign.campaignName}</div>
                                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  {campaign.monitoringOwnerLabel} · launch {campaign.launchOwnerLabel || "n/a"} · queue {campaign.queueOwnerLabel || "n/a"}
                                </div>
                              </div>
                              <span className={pillClass}>{prettyLabel(campaign.attributionConfidence)}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              {campaign.issues.map((issue) => (
                                <span key={issue} className={pillClass}>{issue}</span>
                              ))}
                            </div>
                            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                              Spend {formatMoney(campaign.spend)} · Revenue {formatMoney(campaign.revenue)} · {campaign.activeDays} active days
                            </div>
                          </div>
                        )) : (
                          <div className="text-sm text-neutral-500 dark:text-neutral-400">No ambiguous campaigns surfaced in the current lookback window.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Buyer attribution audit not loaded yet.
                </div>
              )}
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Canonical Buyer Scorecards</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Canonical buyer economics now run on a deduplicated campaign-day grain from monitoring, then get merged with execution pressure from meetings and approvals.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void loadBuyerScorecards()} className={buttonGhost}>
                    Refresh scorecards
                  </button>
                  <button type="button" onClick={() => void snapshotBuyerScorecards()} className={buttonSecondary} disabled={snapshottingScorecards}>
                    {snapshottingScorecards ? "Snapshotting..." : "Record snapshot"}
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {buyerScorecards.slice(0, 4).map((card) => {
                  const topNetwork = card.mix?.topNetworks?.[0] || null;
                  const topSite = card.mix?.topSites?.[0] || null;
                  const topOpportunitySource = card.opportunityMix?.topSources?.[0] || null;
                  const topOpportunityCategory = card.opportunityMix?.topCategories?.[0] || null;
                  const topLaunchCategory = card.activity?.topLaunchCategories?.[0] || null;
                  const topLaunchSource = card.activity?.topLaunchSources?.[0] || null;
                  const topSurfaceAccount = card.surfaceExposure?.linkedAccountLabels?.[0] || card.surfaceExposure?.dominantConstrainedAccount || null;
                  return (
                    <div key={`${card.ownerKey}-detail`} className={subCardClass + " p-4"}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{card.ownerLabel}</div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {card.lookbackDays}d window · {card.performance.activeCampaigns} active campaigns · {card.performance.launchCount} launches
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <span className={pillClass}>{prettyLabel(card.band)}</span>
                          <span className={pillClass}>econ {prettyLabel(card.health?.economicBand)}</span>
                          <span className={pillClass}>exec {prettyLabel(card.health?.executionBand)}</span>
                          <span className={pillClass}>data {prettyLabel(card.health?.dataConfidence)}</span>
                          <span className={pillClass}>attr {prettyLabel(card.attribution?.confidence)}</span>
                          <span className={pillClass}>supply {prettyLabel(card.opportunityQuality?.qualityBand)}</span>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Economics</div>
                          <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                            Margin {formatMoney(card.performance.netMargin)} · ROAS {formatPercent(card.performance.roas)}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            Spend {formatMoney(card.performance.spend)} · Revenue {formatMoney(card.performance.revenue)}
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Execution</div>
                          <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                            Score {Math.round(card.execution.executionScore)} · {card.execution.overdueActions} overdue
                          </div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {card.execution.totalOpenActions} open · pressure {Math.round(card.execution.queuePressure)}
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Opportunity Mix</div>
                          <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                            {card.opportunityMix?.totalOwned || 0} owned · {card.opportunityMix?.pending || 0} pending
                          </div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            stale {card.opportunityMix?.stalePending || 0} · pending ΔCM {formatMoney(card.opportunityMix?.pendingPredictedDeltaCm)}
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Launch Activity</div>
                          <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                            {card.activity?.recentLaunches || 0} recent launches · {card.activity?.launchDaysActive || 0} active days
                          </div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {card.activity?.distinctLaunchCategories || 0} categories · {card.activity?.distinctLaunchSources || 0} sources
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Supply Quality</div>
                          <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                            {prettyLabel(card.opportunityQuality?.qualityBand)} · launch {formatPercent(card.opportunityQuality?.launchRate)}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            blueprint {formatPercent(card.opportunityQuality?.blueprintCoverage)} · stale {formatPercent(card.opportunityQuality?.stalePendingRate)}
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Surface Risk</div>
                          <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                            {prettyLabel(card.surfaceExposure?.riskBand)} · {card.surfaceExposure?.activeConstraintCount || 0} active constraints
                          </div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {topSurfaceAccount || "No linked surface"} · {card.surfaceExposure?.unresolvedSurfaceExposure ? "platform visible, account unresolved" : "surface grounded"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Throughput</div>
                          <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                            {prettyLabel(card.throughput?.throughputBand)} · {card.throughput?.actionsClosedRecently || 0} closures
                          </div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {card.throughput?.opportunitiesReviewedRecently || 0} opp reviews · {card.throughput?.opportunitiesLaunchedRecently || 0} launch conversions
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Attribution</div>
                        <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-100">
                          Confidence {prettyLabel(card.attribution?.confidence)} · coverage {formatPercent(card.attribution?.attributionCoverage)}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {card.attribution?.launchOwnerMismatchCampaigns || 0} launch mismatches · {card.attribution?.queueOwnerMismatchCampaigns || 0} queue mismatches
                        </div>
                      </div>
                      <div className="mt-4 text-sm text-neutral-700 dark:text-neutral-200">
                        {card.operatorRead || "No operator read available."}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {(card.health?.reasons || []).slice(0, 3).map((reason) => (
                          <span key={reason} className={pillClass}>{reason}</span>
                        ))}
                        {(card.attribution?.reasons || []).slice(0, 2).map((reason) => (
                          <span key={`attr-${reason}`} className={pillClass}>{reason}</span>
                        ))}
                        {(card.opportunityMix?.reasons || []).slice(0, 2).map((reason) => (
                          <span key={`opp-${reason}`} className={pillClass}>{reason}</span>
                        ))}
                        {(card.opportunityQuality?.reasons || []).slice(0, 2).map((reason) => (
                          <span key={`supply-${reason}`} className={pillClass}>{reason}</span>
                        ))}
                        {(card.exploreExploit?.reasons || []).slice(0, 2).map((reason) => (
                          <span key={`lane-${reason}`} className={pillClass}>{reason}</span>
                        ))}
                        {(card.surfaceExposure?.reasons || []).slice(0, 2).map((reason) => (
                          <span key={`surface-${reason}`} className={pillClass}>{reason}</span>
                        ))}
                        {(card.throughput?.reasons || []).slice(0, 2).map((reason) => (
                          <span key={`throughput-${reason}`} className={pillClass}>{reason}</span>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Top Network</div>
                          <div className="mt-2 text-sm font-medium">{topNetwork?.label || "N/A"}</div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            Margin {formatMoney(topNetwork?.netMargin)} · ROAS {formatPercent(topNetwork?.roas)}
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Top Site</div>
                          <div className="mt-2 text-sm font-medium">{topSite?.label || "N/A"}</div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            Margin {formatMoney(topSite?.netMargin)} · ROAS {formatPercent(topSite?.roas)}
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Top Opportunity Source</div>
                          <div className="mt-2 text-sm font-medium">{topOpportunitySource?.label || "N/A"}</div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {topOpportunitySource ? `${topOpportunitySource.count} opportunities · ${formatPercent(topOpportunitySource.share)}` : "No owned source mix yet"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Top Opportunity Category</div>
                          <div className="mt-2 text-sm font-medium">{topOpportunityCategory?.label || "N/A"}</div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {topOpportunityCategory ? `${topOpportunityCategory.count} opportunities · ${formatPercent(topOpportunityCategory.share)}` : "No owned category mix yet"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Explore Vs Exploit</div>
                          <div className="mt-2 text-sm font-medium">
                            explore {card.exploreExploit?.estimatedExploreLaunches || 0} · exploit {card.exploreExploit?.estimatedExploitLaunches || 0}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            bias {prettyLabel(card.exploreExploit?.laneBias)} · explore share {formatPercent(card.exploreExploit?.exploreShare)}
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Top Launch Category / Source</div>
                          <div className="mt-2 text-sm font-medium">
                            {topLaunchCategory?.label || "N/A"} · {topLaunchSource?.label || "N/A"}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {topLaunchCategory ? `${topLaunchCategory.count} launches` : "No launch category mix"} · {topLaunchSource ? `${topLaunchSource.count} launches` : "No launch source mix"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Constrained Surface</div>
                          <div className="mt-2 text-sm font-medium">{topSurfaceAccount || "N/A"}</div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            critical {card.surfaceExposure?.criticalConstraintCount || 0} · high {card.surfaceExposure?.highConstraintCount || 0} · inferred {(card.surfaceExposure?.inferredPlatforms || []).join(", ") || "none"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Follow-Through</div>
                          <div className="mt-2 text-sm font-medium">
                            closure {formatPercent(card.throughput?.actionClosureRate)} · launch through {formatPercent(card.throughput?.launchFollowThroughRate)}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {card.throughput?.actionsStartedRecently || 0} starts · {card.throughput?.approvedBlueprintsCreatedRecently || 0} approved blueprints recently
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                    <tr>
                      <th className="pb-3 pr-4">Buyer</th>
                      <th className="pb-3 pr-4">Band</th>
                      <th className="pb-3 pr-4">Data</th>
                      <th className="pb-3 pr-4">Attr</th>
                      <th className="pb-3 pr-4">Margin</th>
                      <th className="pb-3 pr-4">ROAS</th>
                      <th className="pb-3 pr-4">Active</th>
                      <th className="pb-3 pr-4">Launches</th>
                      <th className="pb-3 pr-4">Owned Opps</th>
                        <th className="pb-3 pr-4">Pending Opps</th>
                        <th className="pb-3 pr-4">Supply Quality</th>
                        <th className="pb-3 pr-4">Explore / Exploit</th>
                      <th className="pb-3 pr-4">Surface</th>
                      <th className="pb-3 pr-4">Throughput</th>
                      <th className="pb-3 pr-4">Open Actions</th>
                      <th className="pb-3 pr-4">Overdue</th>
                      <th className="pb-3 pr-4">Exec Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyerScorecards.map((card) => (
                      <tr key={card.ownerKey} className="border-t border-neutral-200/80 dark:border-neutral-800">
                        <td className="py-3 pr-4 font-medium">{card.ownerLabel}</td>
                        <td className="py-3 pr-4">
                          <span className={`${pillClass} ${
                            card.band === "red"
                              ? "!bg-red-500/10 !text-red-600 dark:!bg-red-500/20 dark:!text-red-300"
                              : card.band === "yellow"
                                ? "!bg-yellow-500/10 !text-yellow-700 dark:!bg-yellow-500/20 dark:!text-yellow-300"
                                : "!bg-green-500/10 !text-green-700 dark:!bg-green-500/20 dark:!text-green-300"
                          }`}>
                            {prettyLabel(card.band)}
                          </span>
                        </td>
                        <td className="py-3 pr-4">{prettyLabel(card.health?.dataConfidence)}</td>
                        <td className="py-3 pr-4">
                          {prettyLabel(card.attribution?.confidence)} · {formatPercent(card.attribution?.attributionCoverage)}
                        </td>
                        <td className="py-3 pr-4">{formatMoney(card.performance.netMargin)}</td>
                        <td className="py-3 pr-4">{formatPercent(card.performance.roas)}</td>
                        <td className="py-3 pr-4">{card.performance.activeCampaigns}</td>
                        <td className="py-3 pr-4">{card.performance.launchCount}</td>
                        <td className="py-3 pr-4">{card.opportunityMix?.totalOwned || 0}</td>
                        <td className="py-3 pr-4">{card.opportunityMix?.pending || 0}</td>
                        <td className="py-3 pr-4">
                          {prettyLabel(card.opportunityQuality?.qualityBand)} · {formatPercent(card.opportunityQuality?.launchRate)}
                        </td>
                        <td className="py-3 pr-4">
                          {card.exploreExploit?.estimatedExploreLaunches || 0} / {card.exploreExploit?.estimatedExploitLaunches || 0}
                        </td>
                        <td className="py-3 pr-4">
                          {prettyLabel(card.surfaceExposure?.riskBand)} · {card.surfaceExposure?.activeConstraintCount || 0}
                        </td>
                        <td className="py-3 pr-4">
                          {prettyLabel(card.throughput?.throughputBand)} · {card.throughput?.actionsClosedRecently || 0}
                        </td>
                        <td className="py-3 pr-4">{card.execution.totalOpenActions}</td>
                        <td className="py-3 pr-4">{card.execution.overdueActions}</td>
                        <td className="py-3 pr-4">{Math.round(card.execution.executionScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Scorecard History</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Recent snapshots make it possible to see whether execution discipline is improving or decaying over time.
                  </p>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                    <tr>
                      <th className="pb-3 pr-4">Captured</th>
                      <th className="pb-3 pr-4">Buyer</th>
                      <th className="pb-3 pr-4">Band</th>
                      <th className="pb-3 pr-4">Margin</th>
                      <th className="pb-3 pr-4">Exec Score</th>
                      <th className="pb-3 pr-4">Overdue</th>
                      <th className="pb-3 pr-4">Queue Pressure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scorecardHistory.map((snapshot) => (
                      <tr key={snapshot.id} className="border-t border-neutral-200/80 dark:border-neutral-800">
                        <td className="py-3 pr-4">{formatDate(snapshot.captured_at)}</td>
                        <td className="py-3 pr-4 font-medium">{snapshot.owner_label}</td>
                        <td className="py-3 pr-4">{prettyLabel(snapshot.band)}</td>
                        <td className="py-3 pr-4">${Number(snapshot.net_margin || 0).toFixed(2)}</td>
                        <td className="py-3 pr-4">{Math.round(Number(snapshot.execution_score || 0))}</td>
                        <td className="py-3 pr-4">{snapshot.overdue_actions}</td>
                        <td className="py-3 pr-4">{Math.round(Number(snapshot.queue_pressure || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={`${cardClass} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={sectionLabel}>Owner Execution Queues</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    The next bottleneck after approval is owner throughput. This queue shows who is carrying breached or at-risk work right now.
                  </p>
                </div>
                <button type="button" onClick={() => void loadOwnerQueues()} className={buttonGhost}>
                  Refresh queues
                </button>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {ownerQueues.length ? ownerQueues.map((owner) => (
                  <div key={owner.ownerKey} className={subCardClass + " p-4"}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{owner.ownerLabel}</div>
                        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {owner.counts.totalOpen} open · {owner.counts.overdue} breached · {owner.counts.atRisk} at risk
                        </div>
                      </div>
                      <div className="text-right text-xs text-neutral-500 dark:text-neutral-400">
                        <div>Oldest: {owner.metrics.oldestAgeHours}h</div>
                        <div>Avg age: {owner.metrics.avgAgeHours}h</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className={pillClass}>Approved {owner.counts.approved}</span>
                      <span className={pillClass}>In Progress {owner.counts.inProgress}</span>
                      <span className={pillClass}>Blocked {owner.counts.blocked}</span>
                      <span className={pillClass}>Needs Owner {owner.counts.needsOwner}</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {owner.queue.slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-lg border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                          <div className="text-sm font-medium">{item.description}</div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {prettyLabel(item.status)} · {prettyLabel(item.priority)} · {prettyLabel(item.slaState)} · {item.ageHours}h age
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )) : (
                  <div className="text-sm text-neutral-500 dark:text-neutral-400">No open owner queues yet.</div>
                )}
              </div>
            </section>

            {!selectedId ? (
              <div className={`${cardClass} p-8 text-sm text-neutral-500 dark:text-neutral-400`}>
                Select a meeting to review.
              </div>
            ) : detailLoading || !meeting || !packet ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className={`${cardClass} h-32 animate-pulse`} />
                ))}
              </div>
            ) : (
              <>
                <section className={`${cardClass} overflow-hidden`}>
                  <div className="border-b border-neutral-200/80 px-6 py-5 dark:border-neutral-800">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className={pillClass}>{prettyLabel(meeting.source_type)}</div>
                        <h2 className="mt-3 text-2xl font-semibold tracking-tight">{packet.recommendationTitle}</h2>
                        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                          {formatDate(meeting.occurred_at)} · {prettyLabel(meeting.meeting_type || "meeting")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void synthesizeSelectedMeeting()}
                        className={buttonSecondary}
                        disabled={synthesizing}
                      >
                        {synthesizing ? "Synthesizing..." : meeting.summary_md ? "Re-synthesize" : "Synthesize now"}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.4fr)_320px]">
                    <div className="space-y-5">
                      <div className={subCardClass + " p-4"}>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Why In System</div>
                        <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-neutral-200">{packet.whyInSystem}</p>
                      </div>
                      <div className={subCardClass + " p-4"}>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Why Now</div>
                        <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-neutral-200">{packet.whyNow}</p>
                      </div>
                      <div className={subCardClass + " p-4"}>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Primary Bottleneck</div>
                        <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-neutral-200">{packet.primaryBottleneck}</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className={subCardClass + " p-4"}>
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Expected Upside</div>
                          <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-neutral-200">{packet.expectedUpside}</p>
                        </div>
                        <div className={subCardClass + " p-4"}>
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Cost Of Delay</div>
                          <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-neutral-200">{packet.costOfDelay}</p>
                        </div>
                      </div>
                      <div className="rounded-xl bg-neutral-950 px-5 py-4 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950">
                        {packet.approvalSentence}
                      </div>
                      <div className={subCardClass + " p-4"}>
                        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                          <div>
                            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Operator</div>
                            <input
                              value={operatorName}
                              onChange={(event) => setOperatorName(event.target.value)}
                              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[#0071e3] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50"
                              placeholder="Operator name"
                            />
                          </div>
                          <div>
                            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Approval Notes (Optional)</div>
                            <textarea
                              value={approvalNotes}
                              onChange={(event) => setApprovalNotes(event.target.value)}
                              className="min-h-24 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[#0071e3] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50"
                              placeholder="Add a note if you want the approval call to carry extra context."
                            />
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void createApproval("approved")}
                            className={buttonSecondary}
                            disabled={approving}
                          >
                            {approving ? "Saving..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void createApproval("deferred")}
                            className={buttonGhost}
                            disabled={approving}
                          >
                            Defer
                          </button>
                          <button
                            type="button"
                            onClick={() => void createApproval("rejected")}
                            className={buttonGhost}
                            disabled={approving}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className={subCardClass + " p-4"}>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Board Guidance</div>
                        <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-neutral-200">{packet.boardGuidance}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        {[
                          ["Ideas", packet.counts.ideas],
                          ["Decisions", packet.counts.decisions],
                          ["Open Actions", packet.counts.openActionItems],
                          ["Open Questions", packet.counts.openQuestions],
                          ["Voice Signals", packet.counts.voiceSignals],
                        ].map(([label, value]) => (
                          <div key={label} className={subCardClass + " p-4"}>
                            <div className="text-xs uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">{label}</div>
                            <div className="mt-2 text-2xl font-semibold">{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className={`${cardClass} p-6`}>
                    <h3 className={sectionLabel}>Synthesized Summary</h3>
                    <div className="mt-4 space-y-4 text-sm leading-6 text-neutral-800 dark:text-neutral-200">
                      <div>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Meeting</div>
                        <div className="whitespace-pre-wrap">{packet.summary.meeting}</div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Decisions</div>
                        <div className="whitespace-pre-wrap">{packet.summary.decisions}</div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Actions</div>
                        <div className="whitespace-pre-wrap">{packet.summary.actions}</div>
                      </div>
                    </div>
                  </div>

                  <div className={`${cardClass} p-6`}>
                    <h3 className={sectionLabel}>Priority Evidence</h3>
                    <div className="mt-4 space-y-5">
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Signals</div>
                        <div className="space-y-3">
                          {packet.evidence.topSignals.length ? packet.evidence.topSignals.map((signal, index) => (
                            <div key={`${signal.type}-${index}`} className={subCardClass + " p-3"}>
                              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                                {prettyLabel(signal.type)} · {signal.personName}
                              </div>
                              <div className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">{signal.text}</div>
                            </div>
                          )) : (
                            <div className="text-sm text-neutral-500 dark:text-neutral-400">No voice signals captured yet.</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">Priority Action Items</div>
                        <div className="space-y-3">
                          {packet.evidence.priorityActionItems.length ? packet.evidence.priorityActionItems.map((action, index) => (
                            <div key={`${action.description}-${index}`} className={subCardClass + " p-3"}>
                              <div className="text-sm font-medium">{action.description}</div>
                              <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                {action.ownerName} · {prettyLabel(action.status)}
                              </div>
                            </div>
                          )) : (
                            <div className="text-sm text-neutral-500 dark:text-neutral-400">No open action items captured yet.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-3">
                  <div className={`${cardClass} p-6`}>
                    <h3 className={sectionLabel}>Approval History</h3>
                    <div className="mt-4 space-y-3">
                      {meeting.approvals?.length ? meeting.approvals.map((approval) => (
                        <div key={approval.id} className={subCardClass + " p-3"}>
                          <div className="text-sm font-medium">{prettyLabel(approval.decision)}</div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {(approval.operator_name || "Operator")} · {formatDate(approval.approved_at)}
                          </div>
                          {approval.notes_md ? (
                            <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-200">{approval.notes_md}</div>
                          ) : null}
                        </div>
                      )) : (
                        <div className="text-sm text-neutral-500 dark:text-neutral-400">No approval decisions recorded yet.</div>
                      )}
                    </div>
                  </div>

                  <div className={`${cardClass} p-6`}>
                    <h3 className={sectionLabel}>Execution Events</h3>
                    <div className="mt-4 space-y-3">
                      {meeting.executionEvents?.length ? meeting.executionEvents.slice(0, 8).map((event) => (
                        <div key={event.id} className={subCardClass + " p-3"}>
                          <div className="text-sm font-medium">{prettyLabel(event.event_type)}</div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {event.owner_name || "System"} · {formatDate(event.occurred_at)}
                          </div>
                          {(event.from_status || event.to_status) ? (
                            <div className="mt-2 text-sm text-neutral-800 dark:text-neutral-200">
                              {prettyLabel(event.from_status || "none")} → {prettyLabel(event.to_status || "none")}
                            </div>
                          ) : null}
                        </div>
                      )) : (
                        <div className="text-sm text-neutral-500 dark:text-neutral-400">No execution events recorded yet.</div>
                      )}
                    </div>
                  </div>

                  <div className={`${cardClass} p-6`}>
                    <h3 className={sectionLabel}>Decisions</h3>
                    <div className="mt-4 space-y-3">
                      {meeting.decisions?.length ? meeting.decisions.map((decision) => (
                        <div key={decision.id} className={subCardClass + " p-3"}>
                          <div className="text-sm font-medium">{decision.decision_text}</div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {decision.decision_owner_name || "Unassigned"} · {prettyLabel(decision.decision_type)}
                          </div>
                        </div>
                      )) : (
                        <div className="text-sm text-neutral-500 dark:text-neutral-400">No decisions captured yet.</div>
                      )}
                    </div>
                  </div>

                  <div className={`${cardClass} p-6`}>
                    <h3 className={sectionLabel}>Action Items</h3>
                    <div className="mt-4 space-y-3">
                      {meeting.actionItems?.length ? meeting.actionItems.map((action) => (
                        <div key={action.id} className={subCardClass + " p-3"}>
                          <div className="text-sm font-medium">{action.description}</div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {action.owner_name || "Unassigned"} · {prettyLabel(action.status)} · {prettyLabel(action.priority)}
                          </div>
                        </div>
                      )) : (
                        <div className="text-sm text-neutral-500 dark:text-neutral-400">No action items captured yet.</div>
                      )}
                    </div>
                  </div>

                  <div className={`${cardClass} p-6`}>
                    <h3 className={sectionLabel}>Open Questions</h3>
                    <div className="mt-4 space-y-3">
                      {meeting.openQuestions?.length ? meeting.openQuestions.map((question) => (
                        <div key={question.id} className={subCardClass + " p-3"}>
                          <div className="text-sm font-medium">{question.question_text}</div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {question.owner_name || "Unassigned"} · {prettyLabel(question.status)}
                          </div>
                        </div>
                      )) : (
                        <div className="text-sm text-neutral-500 dark:text-neutral-400">No open questions captured yet.</div>
                      )}
                    </div>
                  </div>
                </section>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
