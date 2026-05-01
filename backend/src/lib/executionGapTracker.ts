import { getPgPool } from './pg';

type ExecutionGapOptions = {
  lookbackDays?: number;
  limitThemes?: number;
  limitMeetings?: number;
  limitActions?: number;
};

const GAP_SIGNAL_TYPES = new Set([
  'execution_gap',
  'tracking_gap',
  'account_risk',
  'founder_concern',
  'operator_concern',
  'system_gap',
]);

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim();
}

function toNumber(value: any): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function startDateForLookback(days: number): string {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

function themeKey(signal: { theme?: string | null; signal_text?: string | null; signal_type?: string | null }): string {
  const theme = normalizeText(signal.theme).toLowerCase();
  if (theme) return theme;
  const type = normalizeText(signal.signal_type).toLowerCase();
  if (type) return type;
  const text = normalizeText(signal.signal_text).toLowerCase();
  return text.slice(0, 80) || 'unknown';
}

function prettyTheme(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function statusRank(status: string): number {
  switch (status) {
    case 'ownerless':
      return 0;
    case 'breached':
      return 1;
    case 'at_risk':
      return 2;
    case 'owned':
      return 3;
    default:
      return 4;
  }
}

export async function getExecutionGapReport(options: ExecutionGapOptions = {}): Promise<any> {
  const lookbackDays = options.lookbackDays || 30;
  const limitThemes = options.limitThemes || 8;
  const limitMeetings = options.limitMeetings || 8;
  const limitActions = options.limitActions || 10;
  const startDate = startDateForLookback(lookbackDays);

  const pool = getPgPool();
  const [signalsResult, actionsResult, meetingsResult, questionsResult] = await Promise.all([
    pool.query(
      `
        SELECT
          pvs.id,
          pvs.meeting_id,
          pvs.person_name,
          pvs.signal_type,
          pvs.signal_text,
          pvs.theme,
          pvs.confidence_score,
          ms.title AS meeting_title,
          ms.occurred_at
        FROM person_voice_signals pvs
        JOIN meeting_sessions ms
          ON ms.id = pvs.meeting_id
        WHERE ms.occurred_at >= $1
          AND COALESCE(ms.visibility_scope, 'shared') = 'shared'
        ORDER BY ms.occurred_at DESC, pvs.created_at DESC
      `,
      [startDate]
    ),
    pool.query(
      `
        SELECT
          mai.id,
          mai.meeting_id,
          mai.description,
          mai.owner_name,
          mai.status,
          mai.priority,
          mai.urgency,
          mai.due_at,
          mai.created_at,
          mai.updated_at,
          ms.title AS meeting_title,
          ms.occurred_at
        FROM meeting_action_items mai
        JOIN meeting_sessions ms
          ON ms.id = mai.meeting_id
        WHERE ms.occurred_at >= $1
          AND COALESCE(ms.visibility_scope, 'shared') = 'shared'
          AND mai.status NOT IN ('done', 'completed', 'resolved', 'cancelled', 'superseded')
        ORDER BY ms.occurred_at DESC, mai.updated_at DESC
      `,
      [startDate]
    ),
    pool.query(
      `
        SELECT
          ms.id,
          ms.title,
          ms.occurred_at,
          COUNT(DISTINCT mai.id) FILTER (
            WHERE mai.status NOT IN ('done', 'completed', 'resolved', 'cancelled', 'superseded')
          ) AS open_action_count,
          COUNT(DISTINCT mai.id) FILTER (
            WHERE mai.status NOT IN ('done', 'completed', 'resolved', 'cancelled', 'superseded')
              AND COALESCE(NULLIF(mai.owner_name, ''), '') = ''
          ) AS ownerless_action_count,
          COUNT(DISTINCT moq.id) FILTER (
            WHERE moq.status NOT IN ('resolved', 'closed', 'cancelled')
          ) AS open_question_count
        FROM meeting_sessions ms
        LEFT JOIN meeting_action_items mai
          ON mai.meeting_id = ms.id
        LEFT JOIN meeting_open_questions moq
          ON moq.meeting_id = ms.id
        WHERE ms.occurred_at >= $1
          AND COALESCE(ms.visibility_scope, 'shared') = 'shared'
        GROUP BY ms.id
        ORDER BY ms.occurred_at DESC
      `,
      [startDate]
    ),
    pool.query(
      `
        SELECT
          moq.id,
          moq.meeting_id,
          moq.question_text,
          moq.owner_name,
          moq.status,
          ms.title AS meeting_title,
          ms.occurred_at
        FROM meeting_open_questions moq
        JOIN meeting_sessions ms
          ON ms.id = moq.meeting_id
        WHERE ms.occurred_at >= $1
          AND COALESCE(ms.visibility_scope, 'shared') = 'shared'
          AND moq.status NOT IN ('resolved', 'closed', 'cancelled')
        ORDER BY ms.occurred_at DESC, moq.created_at DESC
      `,
      [startDate]
    ),
  ]);

  const actionsByMeeting = new Map<string, any[]>();
  for (const row of actionsResult.rows) {
    const current = actionsByMeeting.get(String(row.meeting_id)) || [];
    current.push(row);
    actionsByMeeting.set(String(row.meeting_id), current);
  }

  const questionsByMeeting = new Map<string, any[]>();
  for (const row of questionsResult.rows) {
    const current = questionsByMeeting.get(String(row.meeting_id)) || [];
    current.push(row);
    questionsByMeeting.set(String(row.meeting_id), current);
  }

  const themeMap = new Map<string, any>();
  for (const row of signalsResult.rows) {
    const signalType = normalizeText(row.signal_type).toLowerCase();
    if (!GAP_SIGNAL_TYPES.has(signalType)) continue;

    const key = themeKey(row);
    const current = themeMap.get(key) || {
      themeKey: key,
      theme: prettyTheme(key),
      mentionCount: 0,
      meetings: new Set<string>(),
      signalTypes: new Set<string>(),
      lastSeenAt: null as string | null,
      openActionCount: 0,
      ownerlessActionCount: 0,
      openQuestionCount: 0,
      owners: new Set<string>(),
      examples: [] as Array<{ meetingTitle: string; text: string; personName: string }>,
    };

    current.mentionCount += 1;
    current.meetings.add(String(row.meeting_id));
    current.signalTypes.add(signalType);
    current.lastSeenAt = current.lastSeenAt && current.lastSeenAt > row.occurred_at ? current.lastSeenAt : row.occurred_at;
    const meetingActions = actionsByMeeting.get(String(row.meeting_id)) || [];
    const meetingQuestions = questionsByMeeting.get(String(row.meeting_id)) || [];
    current.openActionCount += meetingActions.length;
    current.ownerlessActionCount += meetingActions.filter((item) => !normalizeText(item.owner_name)).length;
    current.openQuestionCount += meetingQuestions.length;
    for (const action of meetingActions) {
      if (normalizeText(action.owner_name)) current.owners.add(normalizeText(action.owner_name));
    }
    if (current.examples.length < 3) {
      current.examples.push({
        meetingTitle: normalizeText(row.meeting_title),
        text: normalizeText(row.signal_text),
        personName: normalizeText(row.person_name) || 'Unknown',
      });
    }
    themeMap.set(key, current);
  }

  const recurringThemes = Array.from(themeMap.values()).map((theme) => {
    const ownerCoverage = theme.openActionCount > 0
      ? 1 - (theme.ownerlessActionCount / theme.openActionCount)
      : 0;
    const status =
      theme.ownerlessActionCount > 0 ? 'ownerless'
      : theme.openQuestionCount > 0 ? 'at_risk'
      : theme.openActionCount > 0 ? 'owned'
      : 'watch';

    return {
      themeKey: theme.themeKey,
      theme: theme.theme,
      mentionCount: theme.mentionCount,
      meetingCount: theme.meetings.size,
      signalTypes: Array.from(theme.signalTypes).sort(),
      lastSeenAt: theme.lastSeenAt,
      openActionCount: theme.openActionCount,
      ownerlessActionCount: theme.ownerlessActionCount,
      openQuestionCount: theme.openQuestionCount,
      ownerCoverage,
      distinctOwners: Array.from(theme.owners).sort(),
      status,
      examples: theme.examples,
    };
  });

  recurringThemes.sort((a, b) => {
    return (
      statusRank(a.status) - statusRank(b.status) ||
      b.ownerlessActionCount - a.ownerlessActionCount ||
      b.mentionCount - a.mentionCount
    );
  });

  const ownerlessActionItems = actionsResult.rows
    .filter((row) => !normalizeText(row.owner_name))
    .sort((a, b) => {
      const priority = (value: string) => {
        switch (normalizeText(value).toLowerCase()) {
          case 'critical': return 0;
          case 'high': return 1;
          case 'medium': return 2;
          default: return 3;
        }
      };
      return (
        priority(String(a.priority || '')) - priority(String(b.priority || '')) ||
        Date.parse(String(b.updated_at || b.created_at || 0)) - Date.parse(String(a.updated_at || a.created_at || 0))
      );
    })
    .slice(0, limitActions)
    .map((row) => ({
      id: String(row.id),
      meetingId: String(row.meeting_id),
      meetingTitle: normalizeText(row.meeting_title),
      occurredAt: row.occurred_at,
      description: normalizeText(row.description),
      status: normalizeText(row.status) || 'open',
      priority: normalizeText(row.priority) || 'unset',
      urgency: normalizeText(row.urgency) || null,
      dueAt: row.due_at || null,
    }));

  const meetingGaps = meetingsResult.rows
    .map((row) => {
      const meetingSignals = signalsResult.rows.filter(
        (signal) =>
          String(signal.meeting_id) === String(row.id) &&
          GAP_SIGNAL_TYPES.has(normalizeText(signal.signal_type).toLowerCase())
      );
      const dominantTheme = meetingSignals.length ? prettyTheme(themeKey(meetingSignals[0])) : null;
      return {
        meetingId: String(row.id),
        title: normalizeText(row.title),
        occurredAt: row.occurred_at,
        openActionCount: toNumber(row.open_action_count),
        ownerlessActionCount: toNumber(row.ownerless_action_count),
        openQuestionCount: toNumber(row.open_question_count),
        gapSignalCount: meetingSignals.length,
        dominantTheme,
      };
    })
    .sort((a, b) => {
      return (
        b.ownerlessActionCount - a.ownerlessActionCount ||
        b.openQuestionCount - a.openQuestionCount ||
        b.gapSignalCount - a.gapSignalCount ||
        Date.parse(String(b.occurredAt)) - Date.parse(String(a.occurredAt))
      );
    })
    .slice(0, limitMeetings);

  const ownerlessConcernCount = recurringThemes.filter((theme) => theme.status === 'ownerless').length;
  const unresolvedConcernCount = recurringThemes.filter((theme) => theme.openQuestionCount > 0).length;
  const repeatedConcernCount = recurringThemes.filter((theme) => theme.meetingCount > 1).length;

  let operatorRead = 'Execution gaps are visible, but the main question is whether repeated concerns are getting owners before they age into institutional drag.';
  if (ownerlessActionItems.length > 0) {
    operatorRead = `There are ${ownerlessActionItems.length} ownerless open action items in the current window, so the immediate failure mode is still assignment, not execution speed.`;
  } else if (repeatedConcernCount > 0) {
    operatorRead = `The system is surfacing ${repeatedConcernCount} repeated concern themes across meetings, which means follow-through quality can now be reviewed as a recurring operating pattern instead of an anecdote.`;
  } else if (recurringThemes.length === 0) {
    operatorRead = 'No execution-gap themes surfaced in the current window, which usually means the signal layer is still too thin rather than the business having no gaps.';
  }

  return {
    window: {
      lookbackDays,
      since: startDate.slice(0, 10),
      through: new Date().toISOString().slice(0, 10),
    },
    summary: {
      trackedGapThemes: recurringThemes.length,
      repeatedConcernThemes: repeatedConcernCount,
      ownerlessConcernThemes: ownerlessConcernCount,
      ownerlessActionItems: ownerlessActionItems.length,
      unresolvedOpenQuestions: questionsResult.rows.length,
      meetingsWithGaps: meetingGaps.filter((meeting) => meeting.gapSignalCount > 0 || meeting.ownerlessActionCount > 0 || meeting.openQuestionCount > 0).length,
    },
    recurringThemes: recurringThemes.slice(0, limitThemes),
    ownerlessActionItems,
    meetingGaps,
    operatorRead,
  };
}
