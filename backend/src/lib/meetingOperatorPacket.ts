type MeetingActionItem = {
  description?: string | null;
  owner_name?: string | null;
  status?: string | null;
  priority?: string | null;
  urgency?: string | null;
};

type MeetingDecision = {
  decision_text?: string | null;
  decision_owner_name?: string | null;
  decision_type?: string | null;
};

type VoiceSignal = {
  person_name?: string | null;
  signal_type?: string | null;
  signal_text?: string | null;
  theme?: string | null;
  confidence_score?: number | null;
};

type MeetingRecord = {
  id: string;
  title: string;
  source_type?: string | null;
  meeting_type?: string | null;
  occurred_at: string;
  summary_md?: string | null;
  decision_summary_md?: string | null;
  action_summary_md?: string | null;
  confidence_score?: number | null;
  ideas?: any[];
  decisions?: MeetingDecision[];
  actionItems?: MeetingActionItem[];
  openQuestions?: any[];
  voiceSignals?: VoiceSignal[];
};

type OperatorPacket = {
  meetingId: string;
  title: string;
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

const SIGNAL_PRIORITY = [
  'execution_gap',
  'opportunity_gap',
  'intent_packet_gap',
  'buyer_bias',
  'tracking_gap',
  'scaling_constraint',
  'account_risk',
  'founder_concern',
  'operator_concern',
  'system_gap',
  'positive_signal',
] as const;

const BOTTLENECK_COPY: Record<string, string> = {
  execution_gap: 'execution follow-through between observation, ownership, and completion',
  opportunity_gap: 'opportunity discovery throughput and the supply of scale-worthy ideas',
  intent_packet_gap: 'intent-packet exploration and the production of new exploitable demand packets',
  buyer_bias: 'buyer attention being pulled toward easy launches instead of highest-upside launches',
  tracking_gap: 'tracking and learning quality, which degrades downstream capital allocation',
  scaling_constraint: 'practical scale capacity across buyers, systems, or account surfaces',
  account_risk: 'platform and account fragility that can interrupt profitable deployment',
  founder_concern: 'founder-observed drift between what matters and what is actually getting done',
  operator_concern: 'operator-observed execution uncertainty in a critical workstream',
  system_gap: 'missing system infrastructure needed to turn repeated work into a durable mechanism',
  positive_signal: 'a positive operating signal that still needs to be converted into a repeatable mechanism',
};

function normalizeSignalType(value: string | null | undefined): string {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || 'system_gap';
}

function pickPrimarySignal(signals: VoiceSignal[]): string {
  const scores = new Map<string, number>();
  for (const signal of signals) {
    const type = normalizeSignalType(signal.signal_type);
    const base = signal.confidence_score && Number.isFinite(signal.confidence_score) ? Number(signal.confidence_score) : 0.5;
    scores.set(type, (scores.get(type) || 0) + base);
  }

  for (const type of SIGNAL_PRIORITY) {
    if ((scores.get(type) || 0) > 0) return type;
  }

  return signals.length ? normalizeSignalType(signals[0].signal_type) : 'execution_gap';
}

function buildWhyInSystem(meeting: MeetingRecord, counts: OperatorPacket['counts'], primarySignal: string): string {
  return [
    `This meeting belongs in the operating system because it contains ${counts.decisions} decisions, ${counts.openActionItems} open action items, and ${counts.voiceSignals} voice signals that change how the business should allocate attention or capital.`,
    `The dominant signal is ${BOTTLENECK_COPY[primarySignal] || 'an operating bottleneck'}, which directly affects the prime directive of durable net profit growth.`,
  ].join(' ');
}

function buildWhyNow(counts: OperatorPacket['counts'], primarySignal: string): string {
  if (primarySignal === 'tracking_gap' || primarySignal === 'account_risk') {
    return 'This needs attention now because delayed correction degrades learning quality immediately and raises the odds of making the next allocation decision on corrupted or incomplete information.';
  }
  if (primarySignal === 'opportunity_gap' || primarySignal === 'intent_packet_gap' || primarySignal === 'buyer_bias') {
    return 'This is higher priority than adjacent work because it constrains the supply of new profitable launches, which is upstream of both scale and compounding.';
  }
  return `This needs attention now because ${counts.openActionItems} open action items are still waiting to move from conversation into owned execution, which keeps the company in a learn-without-closing-the-loop state.`;
}

function buildExpectedUpside(primarySignal: string, actions: MeetingActionItem[]): string {
  const topOwners = Array.from(
    new Set(
      actions
        .map((action) => String(action.owner_name || '').trim())
        .filter(Boolean)
    )
  ).slice(0, 3);

  if (primarySignal === 'opportunity_gap' || primarySignal === 'intent_packet_gap') {
    return 'The expected upside is a larger pipeline of testable opportunities and faster discovery of profitable packets that buyers can scale.';
  }
  if (primarySignal === 'tracking_gap') {
    return 'The expected upside is cleaner feedback loops, better buyer evaluation, and less capital allocated on false signals.';
  }
  if (primarySignal === 'buyer_bias') {
    return 'The expected upside is shifting constrained buyer attention toward launches with higher expected value instead of lower-friction launches.';
  }
  return `The expected upside is tighter execution against already-identified work, especially across ${topOwners.length ? topOwners.join(', ') : 'the current owners'}, which should raise completion velocity and reduce value leakage.`;
}

function buildCostOfDelay(primarySignal: string): string {
  if (primarySignal === 'account_risk') {
    return 'The cost of delay is that a preventable account or policy issue can interrupt profitable spend before the system has time to respond.';
  }
  if (primarySignal === 'tracking_gap') {
    return 'The cost of delay is compounded measurement debt, which makes every downstream scorecard, forecast, and allocation decision less trustworthy.';
  }
  if (primarySignal === 'opportunity_gap' || primarySignal === 'intent_packet_gap') {
    return 'The cost of delay is missed launch windows and fewer high-upside packets entering the system, which reduces future compounding.';
  }
  return 'The cost of delay is that known work stays unowned or incomplete, so meetings generate context but not mechanism.';
}

function trimLine(value: string | null | undefined): string {
  return String(value || '').trim();
}

export function buildMeetingOperatorPacket(meeting: MeetingRecord): OperatorPacket {
  const decisions = meeting.decisions || [];
  const actionItems = meeting.actionItems || [];
  const voiceSignals = meeting.voiceSignals || [];
  const openActionItems = actionItems.filter((action) => !['done', 'closed', 'resolved', 'complete', 'completed'].includes(String(action.status || '').toLowerCase()));
  const priorityActionItems = [...openActionItems].sort((a, b) => {
    const rank = (value: string | null | undefined) => {
      switch (String(value || '').toLowerCase()) {
        case 'critical':
          return 0;
        case 'high':
          return 1;
        case 'medium':
          return 2;
        default:
          return 3;
      }
    };
    return rank(a.priority) - rank(b.priority);
  });
  const primarySignal = pickPrimarySignal(voiceSignals);

  const counts = {
    ideas: meeting.ideas?.length || 0,
    decisions: decisions.length,
    openActionItems: openActionItems.length,
    openQuestions: meeting.openQuestions?.length || 0,
    voiceSignals: voiceSignals.length,
  };

  return {
    meetingId: meeting.id,
    title: meeting.title,
    recommendationTitle: `Approve the operating response for "${meeting.title}"`,
    whyInSystem: buildWhyInSystem(meeting, counts, primarySignal),
    whyNow: buildWhyNow(counts, primarySignal),
    primaryBottleneck: BOTTLENECK_COPY[primarySignal] || BOTTLENECK_COPY.execution_gap,
    expectedUpside: buildExpectedUpside(primarySignal, priorityActionItems),
    costOfDelay: buildCostOfDelay(primarySignal),
    approvalSentence: 'If you agree, all you need to do is approve.',
    boardGuidance: 'The board doctrine is to convert observations into owned actions that relieve the tightest bottleneck against the prime directive.',
    summary: {
      meeting: trimLine(meeting.summary_md) || 'No synthesized meeting summary yet.',
      decisions: trimLine(meeting.decision_summary_md) || 'No synthesized decision summary yet.',
      actions: trimLine(meeting.action_summary_md) || 'No synthesized action summary yet.',
    },
    counts,
    evidence: {
      topSignals: voiceSignals.slice(0, 4).map((signal) => ({
        type: normalizeSignalType(signal.signal_type),
        personName: trimLine(signal.person_name) || 'Unknown',
        text: trimLine(signal.signal_text),
      })),
      priorityActionItems: priorityActionItems.slice(0, 6).map((action) => ({
        description: trimLine(action.description),
        ownerName: trimLine(action.owner_name) || 'Unassigned',
        status: trimLine(action.status) || 'open',
      })),
      decisions: decisions.slice(0, 5).map((decision) => ({
        text: trimLine(decision.decision_text),
        ownerName: trimLine(decision.decision_owner_name) || 'Unassigned',
        type: trimLine(decision.decision_type) || 'decision',
      })),
    },
  };
}

export type { OperatorPacket };
