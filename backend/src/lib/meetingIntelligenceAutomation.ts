import { getLocalMeetingReport, rebuildLocalMeetingReport } from './localMeetingReport';
import { postSlackMessage } from './slackNotifier';
import { getWatchedSlackSources } from './meetingIntelligenceSources';
import { listPrivateConversationSources, markPrivateConversationSourceIngested } from './privateConversationRegistry';
import { buildMeetingSessionFromSlack } from './slackMeetingImport';
import { synthesizeMeetingSession } from './meetingSynthesis';
import { MeetingIntelligenceService } from '../services/meetingIntelligence';

function formatMoney(value: number): string {
  return `${value < 0 ? '-' : ''}$${Math.abs(value).toFixed(2)}`;
}

function buildSlackText(summary: {
  createdNotifications: number;
  totalLiveAlerts: number;
  snapshotCount: number;
  notifications: any[];
  scorecards: any[];
  localReport?: {
    summary: {
      recentMeetingCount: number;
      recentDecisionCount: number;
      recentActionCount: number;
      openActionCount: number;
      overdueActionCount: number;
      heaviestOwner: string | null;
      heaviestOwnerOpenActionCount: number;
      dominantTheme: string | null;
    };
    highPriorityOpenActions: Array<{
      description: string;
      ownerName: string;
      dueAt: string | null;
    }>;
  } | null;
  localReportError?: string | null;
}): string {
  const lines: string[] = [];
  lines.push('*Meeting Intelligence Automation*');
  lines.push(`Alerts synced: ${summary.createdNotifications} new / ${summary.totalLiveAlerts} live`);
  lines.push(`Scorecards snapshotted: ${summary.snapshotCount}`);

  if (summary.notifications.length) {
    lines.push('');
    lines.push('*Top notifications*');
    for (const notification of summary.notifications.slice(0, 5)) {
      lines.push(`• [${String(notification.severity).toUpperCase()}] ${notification.owner_label}: ${notification.message}`);
    }
  }

  if (summary.scorecards.length) {
    lines.push('');
    lines.push('*Top buyer pressure*');
    for (const card of summary.scorecards.slice(0, 5)) {
      lines.push(
        `• ${card.ownerLabel}: band=${card.band}, margin=${formatMoney(card.performance.netMargin)}, exec_score=${Math.round(card.execution.executionScore)}, overdue=${card.execution.overdueActions}`
      );
    }
  }

  if (summary.localReport) {
    lines.push('');
    lines.push('*Local operator report*');
    lines.push(
      `• Recent meetings=${summary.localReport.summary.recentMeetingCount}, decisions=${summary.localReport.summary.recentDecisionCount}, actions=${summary.localReport.summary.recentActionCount}`
    );
    lines.push(
      `• Open actions=${summary.localReport.summary.openActionCount}, overdue=${summary.localReport.summary.overdueActionCount}, dominant theme=${summary.localReport.summary.dominantTheme || 'n/a'}`
    );
    lines.push(
      `• Heaviest queue=${summary.localReport.summary.heaviestOwner || 'n/a'} (${summary.localReport.summary.heaviestOwnerOpenActionCount} open)`
    );

    if (summary.localReport.highPriorityOpenActions.length) {
      lines.push('');
      lines.push('*Top local actions*');
      for (const action of summary.localReport.highPriorityOpenActions.slice(0, 5)) {
        lines.push(`• ${action.description} — ${action.ownerName} — due ${action.dueAt || 'n/a'}`);
      }
    }
  } else if (summary.localReportError) {
    lines.push('');
    lines.push(`*Local operator report:* failed to build (${summary.localReportError})`);
  }

  return lines.join('\n');
}

export async function runMeetingIntelligenceAutomation(options: {
  alertLimit?: number;
  scorecardLimit?: number;
  lookbackDays?: number;
  localReportDays?: number;
  slackChannel?: string | null;
  ingestWatchedSources?: boolean;
} = {}): Promise<any> {
  const service = new MeetingIntelligenceService();
  const alertLimit = options.alertLimit || Number(process.env.MEETING_INTEL_ALERT_LIMIT || '8');
  const scorecardLimit = options.scorecardLimit || Number(process.env.MEETING_INTEL_SCORECARD_LIMIT || '10');
  const lookbackDays = options.lookbackDays || Number(process.env.MEETING_INTEL_LOOKBACK_DAYS || '7');
  const localReportDays = options.localReportDays || Number(process.env.MEETING_INTEL_LOCAL_REPORT_DAYS || '30');
  const slackChannel = options.slackChannel || process.env.MEETING_INTEL_SLACK_CHANNEL || '';
  const ingestWatchedSources = options.ingestWatchedSources ?? true;

  const ingestedMeetings: Array<{ sourceKey: string; meetingId: string; title: string }> = [];
  if (ingestWatchedSources) {
    for (const source of getWatchedSlackSources()) {
      const input = await buildMeetingSessionFromSlack({
        channel: source.channel,
        window: source.window || '2d',
        query: source.query,
        title: `${source.label} — auto ingest`,
      });
      input.meetingType = source.meetingType || input.meetingType || 'slack_channel_window';
      input.metadata = {
        ...(input.metadata || {}),
        watchSourceKey: source.key,
        watchSourceLabel: source.label,
        autoIngested: true,
      };

      const created = await service.createMeetingSession(input);
      const synthesis = await synthesizeMeetingSession(created);
      const updated = await service.applyMeetingSynthesis(created.id, synthesis);
      if (updated) {
        ingestedMeetings.push({
          sourceKey: source.key,
          meetingId: updated.id,
          title: updated.title,
        });
      }
    }

    for (const source of await listPrivateConversationSources({ status: 'active', autoIngestOnly: true })) {
      const input = await buildMeetingSessionFromSlack({
        channel: source.channel_ref,
        window: source.watch_window || '2d',
        threadTs: source.slack_thread_ts || undefined,
        query: source.query || undefined,
        title: `${source.label} — private auto ingest`,
      });
      input.meetingType = source.meeting_type || input.meetingType || 'slack_private_conversation';
      input.visibilityScope = source.visibility_scope || 'private_operator';
      input.operatorPersonId = source.operator_person_id || 'eric';
      input.operatorName = source.operator_name || 'Eric Roach';
      input.visibilityGroupKey = source.source_key;
      input.metadata = {
        ...(input.metadata || {}),
        privateConversationSourceKey: source.source_key,
        privateConversationLabel: source.label,
        counterpartName: source.counterpart_name,
        objective: source.objective || null,
        autoIngested: true,
        privateConversation: true,
      };

      const created = await service.createMeetingSession(input);
      const synthesis = await synthesizeMeetingSession(created);
      const updated = await service.applyMeetingSynthesis(created.id, synthesis);
      const finalMeeting = updated || created;
      await markPrivateConversationSourceIngested(String(source.source_key), {
        meetingId: finalMeeting.id,
        slackChannelId: finalMeeting.metadata?.channelId || null,
        slackChannelName: finalMeeting.metadata?.channelName || null,
        occurredAt: finalMeeting.occurred_at || finalMeeting.occurredAt || new Date().toISOString(),
      });
      ingestedMeetings.push({
        sourceKey: source.source_key,
        meetingId: finalMeeting.id,
        title: finalMeeting.title,
      });
    }
  }

  const syncResult = await service.syncOwnerAlertNotifications(alertLimit);
  const snapshotResult = await service.snapshotBuyerExecutionScorecards({
    lookbackDays,
    limit: scorecardLimit,
  });
  const notifications = await service.listOwnerAlertNotifications({ status: 'queued', limit: alertLimit });
  const scorecards = await service.listBuyerExecutionScorecards({ lookbackDays, limit: scorecardLimit });

  let localReport: any = null;
  let localBootstrap: any = null;
  let localReportError: string | null = null;
  try {
    const rebuilt = await rebuildLocalMeetingReport({
      days: localReportDays,
      limitActions: 12,
      limitOwners: 8,
      limitThemes: 8,
    });
    localBootstrap = rebuilt.bootstrap;
    localReport = rebuilt.report;
  } catch (error) {
    localReportError = error instanceof Error ? error.message : String(error);
    try {
      localReport = await getLocalMeetingReport({
        days: localReportDays,
        limitActions: 12,
        limitOwners: 8,
        limitThemes: 8,
      });
    } catch (secondaryError) {
      if (!localReportError) {
        localReportError = secondaryError instanceof Error ? secondaryError.message : String(secondaryError);
      }
    }
  }

  const summary = {
    createdNotifications: Number(syncResult.created || 0),
    totalLiveAlerts: Number(syncResult.totalAlerts || 0),
    snapshotCount: Number(snapshotResult.count || 0),
    notifications,
    scorecards,
    ingestedMeetings,
    localBootstrap,
    localReport,
    localReportError,
    postedToSlack: false,
    slackChannel: slackChannel || null,
    slackTs: null as string | null,
  };

  if (slackChannel) {
    const slack = await postSlackMessage({
      channel: slackChannel,
      text: buildSlackText(summary),
    });
    const deliveredIds = notifications.map((notification: any) => String(notification.id));
    await service.markOwnerAlertNotificationsDelivered(deliveredIds, {
      deliveredAt: new Date().toISOString(),
      channel: slack.channelId,
      messageTs: slack.ts,
    });
    summary.postedToSlack = true;
    summary.slackChannel = slack.channelId;
    summary.slackTs = slack.ts;
  }

  return summary;
}
