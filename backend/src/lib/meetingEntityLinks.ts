import { getPgPool } from './pg';
import { OPERATING_CONTRACTS, PLATFORM_ACCOUNTS } from './platformCapacityRegistry';

const BUYER_NAMES = [
  'Andrew Cook',
  'Anastasia Uldanova',
  'Ben',
  'Brianne Hodenfield',
  'Phillip Bennett',
  'TJ Babbel',
  'Mike Angelov',
  'Scott Anderson',
  'Eric Roach',
  'Narbeh Ghazalian',
];

const WORKSTREAM_RULES = [
  {
    key: 'meeting_intelligence',
    label: 'Meeting Intelligence',
    patterns: [/meeting intelligence/i, /operator review/i, /action ownership/i],
  },
  {
    key: 'buyer_scorecards',
    label: 'Buyer Scorecards',
    patterns: [/buyer scorecard/i, /scorecard/i, /execution score/i],
  },
  {
    key: 'opportunity_supply',
    label: 'Opportunity Supply',
    patterns: [/opportunit/i, /sniffing/i, /new category/i, /scale-worthy ideas/i],
  },
  {
    key: 'intent_packets',
    label: 'Intent Packets',
    patterns: [/intent packet/i, /packet/i],
  },
  {
    key: 'platform_capacity',
    label: 'Platform Capacity',
    patterns: [/business manager/i, /\bbm\b/i, /account/i, /capacity/i, /redirect/i],
  },
  {
    key: 'tracking_and_readiness',
    label: 'Tracking And Readiness',
    patterns: [/pixel/i, /tracking/i, /taboola/i, /newsbreak/i, /revenue fire/i],
  },
];

function normalize(value: string | null | undefined): string {
  return String(value || '').trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function collectTextParts(meeting: any): string {
  const parts = [
    normalize(meeting.title),
    normalize(meeting.summary_md),
    normalize(meeting.decision_summary_md),
    normalize(meeting.action_summary_md),
    ...(meeting.decisions || []).map((item: any) => normalize(item.decision_text)),
    ...(meeting.action_items || []).map((item: any) => normalize(item.description)),
    ...(meeting.voice_signals || []).map((item: any) => normalize(item.signal_text)),
    ...(meeting.open_questions || []).map((item: any) => normalize(item.question_text)),
  ];
  return parts.filter(Boolean).join('\n');
}

function detectBuyerLinks(meeting: any, fullText: string): Array<{ buyerName: string; evidence: string }> {
  const hits: Array<{ buyerName: string; evidence: string }> = [];
  for (const buyerName of BUYER_NAMES) {
    const pattern = new RegExp(`\\b${escapeRegex(buyerName)}\\b`, 'i');
    const participantMatch = (meeting.participants || []).some((participant: any) => pattern.test(normalize(participant.display_name)));
    const actionMatch = (meeting.action_items || []).some((action: any) => pattern.test(normalize(action.owner_name)));
    const decisionMatch = (meeting.decisions || []).some((decision: any) => pattern.test(normalize(decision.decision_owner_name)));
    const textMatch = pattern.test(fullText);
    if (participantMatch || actionMatch || decisionMatch || textMatch) {
      hits.push({
        buyerName,
        evidence:
          participantMatch ? 'participant'
          : actionMatch ? 'action_owner'
          : decisionMatch ? 'decision_owner'
          : 'meeting_text',
      });
    }
  }
  return dedupeByKey(hits, (item) => item.buyerName.toLowerCase());
}

function detectWorkstreams(fullText: string): Array<{ workstreamKey: string; workstreamLabel: string }> {
  const hits: Array<{ workstreamKey: string; workstreamLabel: string }> = [];
  for (const rule of WORKSTREAM_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(fullText))) {
      hits.push({
        workstreamKey: rule.key,
        workstreamLabel: rule.label,
      });
    }
  }
  return hits;
}

function detectAccountLinks(fullText: string): Array<{ accountKey: string; accountLabel: string }> {
  const hits: Array<{ accountKey: string; accountLabel: string }> = [];
  for (const account of PLATFORM_ACCOUNTS) {
    const partner = normalize(account.partnerName);
    const label = normalize(account.accountLabel);
    const patterns = [partner, label, account.accountKey]
      .filter(Boolean)
      .map((value) => new RegExp(escapeRegex(value), 'i'));
    if (patterns.some((pattern) => pattern.test(fullText))) {
      hits.push({
        accountKey: account.accountKey,
        accountLabel: account.accountLabel,
      });
    }
  }
  return dedupeByKey(hits, (item) => item.accountKey);
}

function detectContractLinks(fullText: string): Array<{ contractKey: string; contractLabel: string }> {
  const hits: Array<{ contractKey: string; contractLabel: string }> = [];
  for (const contract of OPERATING_CONTRACTS) {
    const patterns = [
      contract.contractLabel,
      contract.primaryCounterparty,
      contract.contractKey,
      contract.agreementType,
    ]
      .filter(Boolean)
      .map((value) => new RegExp(escapeRegex(String(value)), 'i'));
    if (patterns.some((pattern) => pattern.test(fullText))) {
      hits.push({
        contractKey: contract.contractKey,
        contractLabel: contract.contractLabel,
      });
    }
  }
  return dedupeByKey(hits, (item) => item.contractKey);
}

function evidenceRank(value: string): number {
  switch (value) {
    case 'participant':
      return 0;
    case 'action_owner':
      return 1;
    case 'decision_owner':
      return 2;
    default:
      return 3;
  }
}

function riskRank(value: string): number {
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

function isMissingRelationError(error: any): boolean {
  const text = String(error?.message || error || '').toLowerCase();
  return text.includes('does not exist') || text.includes('relation') || text.includes('no such table');
}

export async function getMeetingEntityLinkReport(options: { lookbackDays?: number; limitMeetings?: number } = {}): Promise<any> {
  const lookbackDays = options.lookbackDays || 30;
  const limitMeetings = options.limitMeetings || 12;
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - (lookbackDays - 1));
  startDate.setUTCHours(0, 0, 0, 0);

  const pool = getPgPool();
  try {
    const result = await pool.query(
      `
      SELECT
        ms.id,
        ms.title,
        ms.occurred_at,
        ms.summary_md,
        ms.decision_summary_md,
        ms.action_summary_md,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'display_name', mp.display_name,
            'role_at_time', mp.role_at_time,
            'participant_type', mp.participant_type
          )) FILTER (WHERE mp.id IS NOT NULL),
          '[]'::json
        ) AS participants,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'decision_text', md.decision_text,
            'decision_owner_name', md.decision_owner_name
          )) FILTER (WHERE md.id IS NOT NULL),
          '[]'::json
        ) AS decisions,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'description', mai.description,
            'owner_name', mai.owner_name,
            'status', mai.status
          )) FILTER (WHERE mai.id IS NOT NULL),
          '[]'::json
        ) AS action_items,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'signal_type', pvs.signal_type,
            'signal_text', pvs.signal_text,
            'theme', pvs.theme
          )) FILTER (WHERE pvs.id IS NOT NULL),
          '[]'::json
        ) AS voice_signals,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'question_text', moq.question_text,
            'owner_name', moq.owner_name,
            'status', moq.status
          )) FILTER (WHERE moq.id IS NOT NULL),
          '[]'::json
        ) AS open_questions
      FROM meeting_sessions ms
      LEFT JOIN meeting_participants mp
        ON mp.meeting_id = ms.id
      LEFT JOIN meeting_decisions md
        ON md.meeting_id = ms.id
      LEFT JOIN meeting_action_items mai
        ON mai.meeting_id = ms.id
      LEFT JOIN person_voice_signals pvs
        ON pvs.meeting_id = ms.id
      LEFT JOIN meeting_open_questions moq
        ON moq.meeting_id = ms.id
      WHERE ms.occurred_at >= $1
        AND COALESCE(ms.visibility_scope, 'shared') = 'shared'
      GROUP BY ms.id
      ORDER BY ms.occurred_at DESC
      LIMIT $2
    `,
      [startDate.toISOString(), limitMeetings]
    );

    const meetings = result.rows.map((meeting) => {
      const fullText = collectTextParts(meeting);
      const buyerLinks = detectBuyerLinks(meeting, fullText);
      const workstreams = detectWorkstreams(fullText);
      const accountLinks = detectAccountLinks(fullText);
      const contractLinks = detectContractLinks(fullText);
      const ownerlessActionCount = Array.isArray(meeting.action_items)
        ? meeting.action_items.filter((item: any) => !normalize(item.owner_name)).length
        : 0;
      const linkCoverageScore = (
        (buyerLinks.length > 0 ? 1 : 0) +
        (workstreams.length > 0 ? 1 : 0) +
        (accountLinks.length > 0 || contractLinks.length > 0 ? 1 : 0)
      ) / 3;

      return {
        meetingId: String(meeting.id),
        title: normalize(meeting.title),
        occurredAt: meeting.occurred_at,
        buyerLinks,
        workstreams,
        accountLinks,
        contractLinks,
        actionCount: Array.isArray(meeting.action_items) ? meeting.action_items.length : 0,
        ownerlessActionCount,
        signalCount: Array.isArray(meeting.voice_signals) ? meeting.voice_signals.length : 0,
        linkCoverageScore,
        unlinked:
          buyerLinks.length === 0 &&
          workstreams.length === 0 &&
          accountLinks.length === 0 &&
          contractLinks.length === 0,
      };
    });

    const buyerMap = new Map<string, { buyerName: string; meetingCount: number; strongestEvidence: string }>();
    const workstreamMap = new Map<string, { workstreamLabel: string; meetingCount: number }>();
    const accountMap = new Map<string, { accountLabel: string; meetingCount: number; policyRiskLevel: string }>();
    const contractMap = new Map<string, { contractLabel: string; meetingCount: number; primaryCounterparty: string }>();

    for (const meeting of meetings) {
      for (const buyer of meeting.buyerLinks) {
        const current = buyerMap.get(buyer.buyerName) || {
          buyerName: buyer.buyerName,
          meetingCount: 0,
          strongestEvidence: buyer.evidence,
        };
        current.meetingCount += 1;
        if (evidenceRank(buyer.evidence) < evidenceRank(current.strongestEvidence)) {
          current.strongestEvidence = buyer.evidence;
        }
        buyerMap.set(buyer.buyerName, current);
      }
      for (const workstream of meeting.workstreams) {
        const current = workstreamMap.get(workstream.workstreamKey) || {
          workstreamLabel: workstream.workstreamLabel,
          meetingCount: 0,
        };
        current.meetingCount += 1;
        workstreamMap.set(workstream.workstreamKey, current);
      }
      for (const account of meeting.accountLinks) {
        const registry = PLATFORM_ACCOUNTS.find((item) => item.accountKey === account.accountKey);
        const current = accountMap.get(account.accountKey) || {
          accountLabel: account.accountLabel,
          meetingCount: 0,
          policyRiskLevel: registry?.policyRiskLevel || 'low',
        };
        current.meetingCount += 1;
        accountMap.set(account.accountKey, current);
      }
      for (const contract of meeting.contractLinks) {
        const registry = OPERATING_CONTRACTS.find((item) => item.contractKey === contract.contractKey);
        const current = contractMap.get(contract.contractKey) || {
          contractLabel: contract.contractLabel,
          meetingCount: 0,
          primaryCounterparty: registry?.primaryCounterparty || 'Unknown',
        };
        current.meetingCount += 1;
        contractMap.set(contract.contractKey, current);
      }
    }
    let operatorRead =
      'Recent meetings are now linkable to real buyers, workstreams, and account surfaces, which is the minimum needed for the system to stop treating conversation as detached context.';
    const unlinkedCount = meetings.filter((meeting) => meeting.unlinked).length;
    const weakCoverageCount = meetings.filter((meeting) => meeting.linkCoverageScore < 0.67).length;
    if (unlinkedCount > 0) {
      operatorRead =
        `${unlinkedCount} recent meetings still do not map cleanly to buyers, workstreams, or account surfaces, which means the next risk is entity drift rather than missing meeting capture.`;
    } else if (weakCoverageCount > 0) {
      operatorRead =
        `${weakCoverageCount} recent meetings only partially link to the operating graph, so the current bottleneck is not capture but incomplete attachment to buyers, workstreams, and constrained surfaces.`;
    }

    return {
      window: {
        lookbackDays,
        since: startDate.toISOString().slice(0, 10),
        through: new Date().toISOString().slice(0, 10),
      },
      summary: {
        meetingCount: meetings.length,
        linkedMeetingCount: meetings.length - unlinkedCount,
        unlinkedMeetingCount: unlinkedCount,
        distinctBuyers: buyerMap.size,
        distinctWorkstreams: workstreamMap.size,
        distinctAccounts: accountMap.size,
        distinctContracts: contractMap.size,
        weakCoverageMeetings: weakCoverageCount,
      },
      meetings: meetings.sort((a, b) => {
        return (
          a.linkCoverageScore - b.linkCoverageScore ||
          b.ownerlessActionCount - a.ownerlessActionCount ||
          String(b.occurredAt).localeCompare(String(a.occurredAt))
        );
      }),
      topBuyers: Array.from(buyerMap.values()).sort((a, b) => b.meetingCount - a.meetingCount),
      topWorkstreams: Array.from(workstreamMap.values()).sort((a, b) => b.meetingCount - a.meetingCount),
      topAccounts: Array.from(accountMap.values()).sort((a, b) => {
        return riskRank(a.policyRiskLevel) - riskRank(b.policyRiskLevel) || b.meetingCount - a.meetingCount;
      }),
      topContracts: Array.from(contractMap.values()).sort((a, b) => b.meetingCount - a.meetingCount),
      operatorRead,
    };
  } catch (error: any) {
    if (!isMissingRelationError(error)) throw error;
    return {
      window: {
        lookbackDays,
        since: startDate.toISOString().slice(0, 10),
        through: new Date().toISOString().slice(0, 10),
      },
      summary: {
        meetingCount: 0,
        linkedMeetingCount: 0,
        unlinkedMeetingCount: 0,
        distinctBuyers: 0,
        distinctWorkstreams: 0,
        distinctAccounts: 0,
        distinctContracts: 0,
        weakCoverageMeetings: 0,
      },
      meetings: [],
      topBuyers: [],
      topWorkstreams: [],
      topAccounts: [],
      topContracts: [],
      operatorRead:
        'The meeting-intelligence schema is not available in this environment yet, so entity linking cannot be computed from live meetings here.',
    };
  }
}
