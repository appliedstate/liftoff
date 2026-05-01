import express from 'express';
import { getAllocatorGroundingReport } from '../lib/allocatorGroundingReport';
import { getAllocationExecutionEngineReport } from '../lib/allocationExecutionEngine';
import { getBuyerDailyCommandPacketReport } from '../lib/buyerDailyCommandPacket';
import { getPacketLineageGraphReport } from '../lib/packetLineageGraph';
import { getSurfacePreservationCommandLayerReport } from '../lib/surfacePreservationCommandLayer';
import { getBuyerScorecardAttributionAudit } from '../lib/buyerScorecardAttributionAudit';
import { getCommandOutcomeTelemetryReport } from '../lib/commandOutcomeTelemetry';
import {
  BoardDecisionReviewInput,
  BoardSessionInput,
  MeetingIntelligenceService,
  MeetingSessionInput,
} from '../services/meetingIntelligence';
import { buildMeetingSessionFromGoogleDocTranscript } from '../lib/meetingGoogleDoc';
import { getMeetingEntityLinkReport } from '../lib/meetingEntityLinks';
import { getExecutionGapReport } from '../lib/executionGapTracker';
import { getIntentPacketOwnershipReport } from '../lib/intentPacketOwnershipQueue';
import { getLocalMeetingReport, rebuildLocalMeetingReport } from '../lib/localMeetingReport';
import { getOperatorEscalationReport } from '../lib/operatorEscalationEngine';
import { getMorningOperatorPacketReport } from '../lib/morningOperatorPacket';
import { getOperatorStateRollupReport } from '../lib/operatorStateRollup';
import { getOpportunityOwnershipReport } from '../lib/opportunityOwnershipQueue';
import { getOperatorCommandQueueReport } from '../lib/operatorCommandQueue';
import { updateOperatorCommandQueueState } from '../lib/operatorCommandQueueState';
import { getOvernightSprintScorecardReport, snapshotOvernightSprintScorecards } from '../lib/overnightSprintScorecard';
import { getOpportunitySupplyQualityLoopReport } from '../lib/opportunitySupplyQualityLoop';
import { buildMeetingSessionFromMarkdown } from '../lib/meetingMarkdown';
import { runMeetingIntelligenceAutomation } from '../lib/meetingIntelligenceAutomation';
import { buildMeetingOperatorPacket } from '../lib/meetingOperatorPacket';
import { getPrivateConversationReport } from '../lib/privateConversationReport';
import {
  getPrivateConversationSource,
  listPrivateConversationSources,
  markPrivateConversationSourceIngested,
  upsertPrivateConversationSource,
} from '../lib/privateConversationRegistry';
import { getPlatformCapacityReport } from '../lib/platformCapacityReport';
import { synthesizeMeetingSession } from '../lib/meetingSynthesis';
import { buildMeetingSessionFromSlack } from '../lib/slackMeetingImport';
import { getOpportunityIntentWorkstreamScoreboard } from '../lib/workstreamScoreboards';

const router = express.Router();
const service = new MeetingIntelligenceService();

router.post('/meetings', async (req, res) => {
  try {
    const input: MeetingSessionInput = req.body;
    if (!input?.title || !input?.sourceType || !input?.occurredAt) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['title', 'sourceType', 'occurredAt'],
      });
    }
    const result = await service.createMeetingSession(input);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating meeting session:', error);
    return res.status(500).json({
      error: 'Failed to create meeting session',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/meetings/import-markdown', async (req, res) => {
  try {
    const markdown = String(req.body?.markdown || '').trim();
    const sourceUri = req.body?.sourceUri ? String(req.body.sourceUri) : null;

    if (!markdown) {
      return res.status(400).json({
        error: 'markdown is required',
      });
    }

    const parsed = buildMeetingSessionFromMarkdown(markdown, sourceUri);
    const result = await service.createMeetingSession(parsed);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error importing markdown meeting:', error);
    return res.status(500).json({
      error: 'Failed to import markdown meeting',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/meetings/import-slack', async (req, res) => {
  try {
    const channel = String(req.body?.channel || '').trim();
    const window = req.body?.window ? String(req.body.window) : undefined;
    const threadTs = req.body?.threadTs ? String(req.body.threadTs) : null;
    const title = req.body?.title ? String(req.body.title) : undefined;
    const query = req.body?.query ? String(req.body.query) : undefined;

    if (!channel) {
      return res.status(400).json({
        error: 'channel is required',
      });
    }

    const parsed = await buildMeetingSessionFromSlack({
      channel,
      window,
      threadTs,
      title,
      query,
    });
    parsed.visibilityScope = req.body?.visibilityScope ? String(req.body.visibilityScope) : parsed.visibilityScope;
    parsed.operatorPersonId = req.body?.operatorPersonId ? String(req.body.operatorPersonId) : parsed.operatorPersonId;
    parsed.operatorName = req.body?.operatorName ? String(req.body.operatorName) : parsed.operatorName;
    parsed.visibilityGroupKey = req.body?.visibilityGroupKey ? String(req.body.visibilityGroupKey) : parsed.visibilityGroupKey;
    parsed.metadata = {
      ...(parsed.metadata || {}),
      counterpartName: req.body?.counterpartName ? String(req.body.counterpartName) : undefined,
      privateConversation: req.body?.visibilityScope === 'private_operator' || req.body?.privateConversation === true,
    };
    const result = await service.createMeetingSession(parsed);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error importing Slack meeting:', error);
    return res.status(500).json({
      error: 'Failed to import Slack meeting',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/meetings/import-google-doc', async (req, res) => {
  try {
    const content = String(req.body?.content || '').trim();
    const sourceUri = req.body?.sourceUri ? String(req.body.sourceUri) : null;
    const title = req.body?.title ? String(req.body.title) : null;
    const occurredAt = req.body?.occurredAt ? String(req.body.occurredAt) : null;
    const meetingType = req.body?.meetingType ? String(req.body.meetingType) : null;
    const autoSynthesize = req.body?.autoSynthesize !== false;

    if (!content) {
      return res.status(400).json({
        error: 'content is required',
      });
    }

    const parsed = buildMeetingSessionFromGoogleDocTranscript({
      content,
      sourceUri,
      title,
      occurredAt,
      meetingType,
    });
    const created = await service.createMeetingSession(parsed);

    if (!autoSynthesize) {
      return res.status(201).json(created);
    }

    const synthesis = await synthesizeMeetingSession(created);
    const updated = await service.applyMeetingSynthesis(created.id, synthesis);
    return res.status(201).json(updated);
  } catch (error) {
    console.error('Error importing Google Doc meeting:', error);
    return res.status(500).json({
      error: 'Failed to import Google Doc meeting',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/meetings', async (req, res) => {
  try {
    const result = await service.listMeetingSessions({
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      sourceType: req.query.sourceType ? String(req.query.sourceType) : undefined,
      meetingType: req.query.meetingType ? String(req.query.meetingType) : undefined,
      visibilityScope: req.query.visibilityScope ? String(req.query.visibilityScope) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error listing meetings:', error);
    return res.status(500).json({
      error: 'Failed to list meetings',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/private-conversations/sources', async (req, res) => {
  try {
    const result = await listPrivateConversationSources({
      status: req.query.status ? String(req.query.status) : undefined,
      autoIngestOnly: req.query.autoIngestOnly === 'true',
    });
    return res.json(result);
  } catch (error) {
    console.error('Error listing private conversation sources:', error);
    return res.status(500).json({
      error: 'Failed to list private conversation sources',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/private-conversations/sources', async (req, res) => {
  try {
    const channelRef = String(req.body?.channelRef || req.body?.channel || '').trim();
    const counterpartName = String(req.body?.counterpartName || '').trim();
    const sourceKey = String(req.body?.sourceKey || '').trim();
    const label = String(req.body?.label || counterpartName || sourceKey).trim();

    if (!sourceKey || !channelRef || !counterpartName) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['sourceKey', 'channelRef', 'counterpartName'],
      });
    }

    const result = await upsertPrivateConversationSource({
      sourceKey,
      label,
      channelRef,
      slackThreadTs: req.body?.slackThreadTs ? String(req.body.slackThreadTs) : null,
      watchWindow: req.body?.watchWindow ? String(req.body.watchWindow) : null,
      meetingType: req.body?.meetingType ? String(req.body.meetingType) : 'slack_private_conversation',
      query: req.body?.query ? String(req.body.query) : null,
      visibilityScope: 'private_operator',
      operatorPersonId: req.body?.operatorPersonId ? String(req.body.operatorPersonId) : 'eric',
      operatorName: req.body?.operatorName ? String(req.body.operatorName) : 'Eric Roach',
      counterpartPersonId: req.body?.counterpartPersonId ? String(req.body.counterpartPersonId) : null,
      counterpartName,
      objective: req.body?.objective ? String(req.body.objective) : null,
      status: req.body?.status ? String(req.body.status) : 'active',
      autoIngest: typeof req.body?.autoIngest === 'boolean' ? req.body.autoIngest : true,
      metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {},
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error upserting private conversation source:', error);
    return res.status(500).json({
      error: 'Failed to upsert private conversation source',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/private-conversations/sources/:sourceKey/ingest', async (req, res) => {
  try {
    const source = await getPrivateConversationSource(req.params.sourceKey);
    if (!source) {
      return res.status(404).json({ error: 'Private conversation source not found' });
    }

    const parsed = await buildMeetingSessionFromSlack({
      channel: String(source.channel_ref),
      window: req.body?.window ? String(req.body.window) : String(source.watch_window || '2d'),
      threadTs: req.body?.threadTs ? String(req.body.threadTs) : (source.slack_thread_ts || null),
      title: req.body?.title ? String(req.body.title) : `${source.label} — private conversation`,
      query: req.body?.query ? String(req.body.query) : (source.query || undefined),
    });
    parsed.meetingType = String(source.meeting_type || parsed.meetingType || 'slack_private_conversation');
    parsed.visibilityScope = String(source.visibility_scope || 'private_operator');
    parsed.operatorPersonId = source.operator_person_id || 'eric';
    parsed.operatorName = source.operator_name || 'Eric Roach';
    parsed.visibilityGroupKey = String(source.source_key);
    parsed.metadata = {
      ...(parsed.metadata || {}),
      privateConversationSourceKey: String(source.source_key),
      privateConversationLabel: String(source.label),
      counterpartName: String(source.counterpart_name),
      objective: source.objective || null,
      privateConversation: true,
    };

    const created = await service.createMeetingSession(parsed);
    await markPrivateConversationSourceIngested(String(source.source_key), {
      meetingId: created.id,
      slackChannelId: created.metadata?.channelId || null,
      slackChannelName: created.metadata?.channelName || null,
      occurredAt: created.occurred_at || created.occurredAt || new Date().toISOString(),
    });
    return res.status(201).json(created);
  } catch (error) {
    console.error('Error ingesting private conversation source:', error);
    return res.status(500).json({
      error: 'Failed to ingest private conversation source',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/private-conversations/report', async (req, res) => {
  try {
    const result = await getPrivateConversationReport({
      operatorPersonId: req.query.operatorPersonId ? String(req.query.operatorPersonId) : 'eric',
      status: req.query.status ? String(req.query.status) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building private conversation report:', error);
    return res.status(500).json({
      error: 'Failed to build private conversation report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/automation/run', async (req, res) => {
  try {
    const result = await runMeetingIntelligenceAutomation({
      alertLimit: req.body?.alertLimit ? Number(req.body.alertLimit) : undefined,
      scorecardLimit: req.body?.scorecardLimit ? Number(req.body.scorecardLimit) : undefined,
      lookbackDays: req.body?.lookbackDays ? Number(req.body.lookbackDays) : undefined,
      localReportDays: req.body?.localReportDays ? Number(req.body.localReportDays) : undefined,
      slackChannel: req.body?.slackChannel ? String(req.body.slackChannel) : undefined,
      ingestWatchedSources: typeof req.body?.ingestWatchedSources === 'boolean' ? req.body.ingestWatchedSources : undefined,
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error running meeting intelligence automation:', error);
    return res.status(500).json({
      error: 'Failed to run meeting intelligence automation',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/local-report', async (req, res) => {
  try {
    const result = await getLocalMeetingReport({
      days: req.query.days ? Number(req.query.days) : undefined,
      limitActions: req.query.limitActions ? Number(req.query.limitActions) : undefined,
      limitOwners: req.query.limitOwners ? Number(req.query.limitOwners) : undefined,
      limitThemes: req.query.limitThemes ? Number(req.query.limitThemes) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building local meeting report:', error);
    return res.status(500).json({
      error: 'Failed to build local meeting report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/local-report/rebuild', async (req, res) => {
  try {
    const result = await rebuildLocalMeetingReport({
      days: req.body?.days ? Number(req.body.days) : undefined,
      limitActions: req.body?.limitActions ? Number(req.body.limitActions) : undefined,
      limitOwners: req.body?.limitOwners ? Number(req.body.limitOwners) : undefined,
      limitThemes: req.body?.limitThemes ? Number(req.body.limitThemes) : undefined,
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error rebuilding local meeting report:', error);
    return res.status(500).json({
      error: 'Failed to rebuild local meeting report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/workstreams/opportunity-intent', async (req, res) => {
  try {
    const result = await getOpportunityIntentWorkstreamScoreboard({
      lookbackDays: req.query.lookbackDays ? Number(req.query.lookbackDays) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building opportunity/intent workstream scoreboard:', error);
    return res.status(500).json({
      error: 'Failed to build opportunity/intent workstream scoreboard',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/execution-gaps', async (req, res) => {
  try {
    const result = await getExecutionGapReport({
      lookbackDays: req.query.lookbackDays ? Number(req.query.lookbackDays) : undefined,
      limitThemes: req.query.limitThemes ? Number(req.query.limitThemes) : undefined,
      limitMeetings: req.query.limitMeetings ? Number(req.query.limitMeetings) : undefined,
      limitActions: req.query.limitActions ? Number(req.query.limitActions) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building execution gap report:', error);
    return res.status(500).json({
      error: 'Failed to build execution gap report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/platform-capacity', async (_req, res) => {
  try {
    const result = await getPlatformCapacityReport();
    return res.json(result);
  } catch (error) {
    console.error('Error building platform capacity report:', error);
    return res.status(500).json({
      error: 'Failed to build platform capacity report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/entity-links', async (req, res) => {
  try {
    const result = await getMeetingEntityLinkReport({
      lookbackDays: req.query.lookbackDays ? Number(req.query.lookbackDays) : undefined,
      limitMeetings: req.query.limitMeetings ? Number(req.query.limitMeetings) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building meeting entity link report:', error);
    return res.status(500).json({
      error: 'Failed to build meeting entity link report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/allocator-grounding', async (req, res) => {
  try {
    const result = await getAllocatorGroundingReport({
      lookbackDays: req.query.lookbackDays ? Number(req.query.lookbackDays) : undefined,
      limitBuyers: req.query.limitBuyers ? Number(req.query.limitBuyers) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building allocator grounding report:', error);
    return res.status(500).json({
      error: 'Failed to build allocator grounding report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/allocation-execution-engine', async (req, res) => {
  try {
    const result = await getAllocationExecutionEngineReport({
      lookbackDays: req.query.lookbackDays ? Number(req.query.lookbackDays) : undefined,
      limitBuyers: req.query.limitBuyers ? Number(req.query.limitBuyers) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building allocation execution engine report:', error);
    return res.status(500).json({
      error: 'Failed to build allocation execution engine report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/buyer-daily-command-packets', async (req, res) => {
  try {
    const result = await getBuyerDailyCommandPacketReport({
      lookbackDays: req.query.lookbackDays ? Number(req.query.lookbackDays) : undefined,
      limitBuyers: req.query.limitBuyers ? Number(req.query.limitBuyers) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building buyer daily command packet report:', error);
    return res.status(500).json({
      error: 'Failed to build buyer daily command packet report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/operator-command-queue', async (req, res) => {
  try {
    const result = await getOperatorCommandQueueReport({
      lookbackDays: req.query.lookbackDays ? Number(req.query.lookbackDays) : undefined,
      limitBuyers: req.query.limitBuyers ? Number(req.query.limitBuyers) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building operator command queue report:', error);
    return res.status(500).json({
      error: 'Failed to build operator command queue report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.patch('/operator-command-queue/:commandKey', async (req, res) => {
  try {
    const status = String(req.body?.status || '').trim();
    if (!['queued', 'seen', 'in_progress', 'cleared', 'promoted', 'deferred'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        allowed: ['queued', 'seen', 'in_progress', 'cleared', 'promoted', 'deferred'],
      });
    }

    const commandKey = decodeURIComponent(String(req.params.commandKey || ''));
    const ownerKey = String(req.body?.ownerKey || '').trim();
    if (!commandKey || !ownerKey) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['ownerKey'],
      });
    }

    const result = await updateOperatorCommandQueueState({
      commandKey,
      ownerKey,
      ownerLabel: req.body?.ownerLabel ? String(req.body.ownerLabel) : null,
      status: status as any,
      noteMd: req.body?.noteMd ? String(req.body.noteMd) : null,
      metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error updating operator command queue state:', error);
    return res.status(500).json({
      error: 'Failed to update operator command queue state',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/overnight-sprint-scorecards', async (_req, res) => {
  try {
    const result = await getOvernightSprintScorecardReport();
    return res.json(result);
  } catch (error) {
    console.error('Error building overnight sprint scorecards:', error);
    return res.status(500).json({
      error: 'Failed to build overnight sprint scorecards',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/overnight-sprint-scorecards/snapshots', async (req, res) => {
  try {
    const result = await snapshotOvernightSprintScorecards({
      capturedAt: req.body?.capturedAt ? String(req.body.capturedAt) : undefined,
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error snapshotting overnight sprint scorecards:', error);
    return res.status(500).json({
      error: 'Failed to snapshot overnight sprint scorecards',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/command-outcomes', async (req, res) => {
  try {
    const result = await getCommandOutcomeTelemetryReport({
      lookbackDays: req.query.lookbackDays ? Number(req.query.lookbackDays) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building command outcome telemetry report:', error);
    return res.status(500).json({
      error: 'Failed to build command outcome telemetry report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/morning-operator-packet', async (_req, res) => {
  try {
    const result = await getMorningOperatorPacketReport();
    return res.json(result);
  } catch (error) {
    console.error('Error building morning operator packet:', error);
    return res.status(500).json({
      error: 'Failed to build morning operator packet',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/operator-state-rollup', async (req, res) => {
  try {
    const result = await getOperatorStateRollupReport({
      lookbackHours: req.query.lookbackHours ? Number(req.query.lookbackHours) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building operator state rollup:', error);
    return res.status(500).json({
      error: 'Failed to build operator state rollup',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/operator-escalations', async (req, res) => {
  try {
    const result = await getOperatorEscalationReport({
      lookbackDays: req.query.lookbackDays ? Number(req.query.lookbackDays) : undefined,
      limitBuyers: req.query.limitBuyers ? Number(req.query.limitBuyers) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building operator escalation report:', error);
    return res.status(500).json({
      error: 'Failed to build operator escalation report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/operator-escalation-alerts', async (req, res) => {
  try {
    const result = await service.listOperatorEscalationAlerts(
      req.query.limit ? Number(req.query.limit) : undefined
    );
    return res.json(result);
  } catch (error) {
    console.error('Error listing operator escalation alerts:', error);
    return res.status(500).json({
      error: 'Failed to list operator escalation alerts',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/operator-escalation-alerts/sync', async (req, res) => {
  try {
    const result = await service.syncOperatorEscalationNotifications(
      req.body?.limit ? Number(req.body.limit) : undefined
    );
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error syncing operator escalation alerts:', error);
    return res.status(500).json({
      error: 'Failed to sync operator escalation alerts',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/packet-lineage-graph', async (req, res) => {
  try {
    const result = await getPacketLineageGraphReport({
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building packet lineage graph report:', error);
    return res.status(500).json({
      error: 'Failed to build packet lineage graph report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/surface-preservation-command-layer', async (_req, res) => {
  try {
    const result = await getSurfacePreservationCommandLayerReport();
    return res.json(result);
  } catch (error) {
    console.error('Error building surface preservation command layer report:', error);
    return res.status(500).json({
      error: 'Failed to build surface preservation command layer report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/upstream/opportunities', async (req, res) => {
  try {
    const result = await getOpportunityOwnershipReport({
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building opportunity ownership report:', error);
    return res.status(500).json({
      error: 'Failed to build opportunity ownership report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/upstream/opportunity-supply-quality', async (req, res) => {
  try {
    const result = await getOpportunitySupplyQualityLoopReport({
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building opportunity supply quality loop report:', error);
    return res.status(500).json({
      error: 'Failed to build opportunity supply quality loop report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/upstream/intent-packets', async (req, res) => {
  try {
    const result = await getIntentPacketOwnershipReport({
      lookbackDays: req.query.lookbackDays ? Number(req.query.lookbackDays) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building intent packet ownership report:', error);
    return res.status(500).json({
      error: 'Failed to build intent packet ownership report',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/owner-queues', async (req, res) => {
  try {
    const result = await service.listOwnerExecutionQueues({
      limitOwners: req.query.limitOwners ? Number(req.query.limitOwners) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error listing owner queues:', error);
    return res.status(500).json({
      error: 'Failed to list owner queues',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/owner-alerts', async (req, res) => {
  try {
    const result = await service.listOwnerExecutionAlerts(
      req.query.limit ? Number(req.query.limit) : undefined
    );
    return res.json(result);
  } catch (error) {
    console.error('Error listing owner alerts:', error);
    return res.status(500).json({
      error: 'Failed to list owner alerts',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/owner-alerts/sync', async (req, res) => {
  try {
    const result = await service.syncOwnerAlertNotifications(
      req.body?.limit ? Number(req.body.limit) : undefined
    );
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error syncing owner alerts:', error);
    return res.status(500).json({
      error: 'Failed to sync owner alerts',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/owner-alert-notifications', async (req, res) => {
  try {
    const result = await service.listOwnerAlertNotifications({
      status: req.query.status ? String(req.query.status) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      alertType: req.query.alertType
        ? String(req.query.alertType)
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error listing owner alert notifications:', error);
    return res.status(500).json({
      error: 'Failed to list owner alert notifications',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/owner-alert-notifications/control-loop-summary', async (req, res) => {
  try {
    const result = await service.getOwnerAlertNotificationControlLoopSummary({
      lookbackHours: req.query.lookbackHours ? Number(req.query.lookbackHours) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      operatorEscalationsOnly: req.query.operatorEscalationsOnly === 'true',
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building owner alert control loop summary:', error);
    return res.status(500).json({
      error: 'Failed to build owner alert control loop summary',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/operator-escalation-alerts/control-loop', async (req, res) => {
  try {
    const result = await service.getOwnerAlertNotificationControlLoopSummary({
      lookbackHours: req.query.lookbackHours ? Number(req.query.lookbackHours) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      operatorEscalationsOnly: true,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building operator escalation control loop summary:', error);
    return res.status(500).json({
      error: 'Failed to build operator escalation control loop summary',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.patch('/owner-alert-notifications/:id', async (req, res) => {
  try {
    const status = String(req.body?.status || '').trim().toLowerCase();
    if (!['acknowledged', 'dismissed'].includes(status)) {
      return res.status(400).json({
        error: 'status is required',
        allowed: ['acknowledged', 'dismissed'],
      });
    }
    const result = await service.updateOwnerAlertNotification(req.params.id, {
      status: status as 'acknowledged' | 'dismissed',
      acknowledgedAt: req.body?.acknowledgedAt ? String(req.body.acknowledgedAt) : null,
    });
    if (!result) {
      return res.status(404).json({ error: 'Owner alert notification not found' });
    }
    return res.json(result);
  } catch (error) {
    console.error('Error updating owner alert notification:', error);
    return res.status(500).json({
      error: 'Failed to update owner alert notification',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/buyer-scorecards', async (req, res) => {
  try {
    const result = await service.listBuyerExecutionScorecards({
      lookbackDays: req.query.lookbackDays ? Number(req.query.lookbackDays) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error listing buyer scorecards:', error);
    return res.status(500).json({
      error: 'Failed to list buyer scorecards',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/buyer-scorecards/attribution-audit', async (req, res) => {
  try {
    const result = await getBuyerScorecardAttributionAudit({
      lookbackDays: req.query.lookbackDays ? Number(req.query.lookbackDays) : undefined,
      limitAmbiguousCampaigns: req.query.limitAmbiguousCampaigns ? Number(req.query.limitAmbiguousCampaigns) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error building buyer scorecard attribution audit:', error);
    return res.status(500).json({
      error: 'Failed to build buyer scorecard attribution audit',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/buyer-scorecards/snapshots', async (req, res) => {
  try {
    const result = await service.snapshotBuyerExecutionScorecards({
      lookbackDays: req.body?.lookbackDays ? Number(req.body.lookbackDays) : undefined,
      limit: req.body?.limit ? Number(req.body.limit) : undefined,
      capturedAt: req.body?.capturedAt ? String(req.body.capturedAt) : undefined,
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error snapshotting buyer scorecards:', error);
    return res.status(500).json({
      error: 'Failed to snapshot buyer scorecards',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/buyer-scorecards/history', async (req, res) => {
  try {
    const result = await service.listBuyerExecutionScorecardHistory({
      ownerKey: req.query.ownerKey ? String(req.query.ownerKey) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error listing buyer scorecard history:', error);
    return res.status(500).json({
      error: 'Failed to list buyer scorecard history',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/meetings/:id', async (req, res) => {
  try {
    const result = await service.getMeetingSession(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    return res.json(result);
  } catch (error) {
    console.error('Error getting meeting:', error);
    return res.status(500).json({
      error: 'Failed to get meeting',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.patch('/meetings/:id/visibility', async (req, res) => {
  try {
    const visibilityScope = String(req.body?.visibilityScope || '').trim();
    if (!visibilityScope) {
      return res.status(400).json({
        error: 'visibilityScope is required',
      });
    }
    const result = await service.updateMeetingVisibility(req.params.id, {
      visibilityScope,
      operatorPersonId: req.body?.operatorPersonId ? String(req.body.operatorPersonId) : undefined,
      operatorName: req.body?.operatorName ? String(req.body.operatorName) : undefined,
      visibilityGroupKey: req.body?.visibilityGroupKey ? String(req.body.visibilityGroupKey) : undefined,
    });
    if (!result) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    return res.json(result);
  } catch (error) {
    console.error('Error updating meeting visibility:', error);
    return res.status(500).json({
      error: 'Failed to update meeting visibility',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/meetings/:id/operator-packet', async (req, res) => {
  try {
    const meeting = await service.getMeetingSession(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    return res.json(buildMeetingOperatorPacket(meeting));
  } catch (error) {
    console.error('Error building operator packet:', error);
    return res.status(500).json({
      error: 'Failed to build operator packet',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/meetings/:id/operator-approvals', async (req, res) => {
  try {
    const meeting = await service.getMeetingSession(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const decision = String(req.body?.decision || '').trim().toLowerCase();
    if (!['approved', 'rejected', 'deferred'].includes(decision)) {
      return res.status(400).json({
        error: 'decision is required',
        allowed: ['approved', 'rejected', 'deferred'],
      });
    }

    const packetSnapshot = req.body?.packetSnapshot && typeof req.body.packetSnapshot === 'object'
      ? req.body.packetSnapshot
      : buildMeetingOperatorPacket(meeting);

    const result = await service.createMeetingOperatorApproval(req.params.id, {
      operatorPersonId: req.body?.operatorPersonId ? String(req.body.operatorPersonId) : null,
      operatorName: req.body?.operatorName ? String(req.body.operatorName) : null,
      decision: decision as 'approved' | 'rejected' | 'deferred',
      notesMd: req.body?.notesMd ? String(req.body.notesMd) : null,
      packetSnapshot,
      approvedAt: req.body?.approvedAt ? String(req.body.approvedAt) : undefined,
      metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : undefined,
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating operator approval:', error);
    return res.status(500).json({
      error: 'Failed to create operator approval',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/meetings/:id/synthesize', async (req, res) => {
  try {
    const meeting = await service.getMeetingSession(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const synthesis = await synthesizeMeetingSession(meeting, {
      model: req.body?.model ? String(req.body.model) : undefined,
    });
    const result = await service.applyMeetingSynthesis(req.params.id, synthesis);
    return res.json({
      meeting: result,
      synthesis: {
        confidenceScore: synthesis.confidenceScore,
        ideaCount: synthesis.ideas.length,
        decisionCount: synthesis.decisions.length,
        actionItemCount: synthesis.actionItems.length,
        openQuestionCount: synthesis.openQuestions.length,
        voiceSignalCount: synthesis.voiceSignals.length,
        metadata: synthesis.metadata,
      },
    });
  } catch (error) {
    console.error('Error synthesizing meeting:', error);
    return res.status(500).json({
      error: 'Failed to synthesize meeting',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.patch('/action-items/:id/status', async (req, res) => {
  try {
    const { status, ownerPersonId, ownerName, dueAt, completionNotes, resolvedAt } = req.body || {};
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    const result = await service.updateActionItemStatus(req.params.id, {
      status: String(status),
      ownerPersonId: ownerPersonId ? String(ownerPersonId) : null,
      ownerName: ownerName ? String(ownerName) : null,
      dueAt: dueAt ? String(dueAt) : null,
      completionNotes: completionNotes ? String(completionNotes) : null,
      resolvedAt: resolvedAt ? String(resolvedAt) : null,
    });
    if (!result) {
      return res.status(404).json({ error: 'Action item not found' });
    }
    return res.json(result);
  } catch (error) {
    console.error('Error updating action item:', error);
    return res.status(500).json({
      error: 'Failed to update action item',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/board-sessions', async (req, res) => {
  try {
    const input: BoardSessionInput = req.body;
    if (!input?.title || !input?.openedAt) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['title', 'openedAt'],
      });
    }
    const result = await service.createBoardSession(input);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating board session:', error);
    return res.status(500).json({
      error: 'Failed to create board session',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/board-sessions/:id', async (req, res) => {
  try {
    const result = await service.getBoardSession(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Board session not found' });
    }
    return res.json(result);
  } catch (error) {
    console.error('Error getting board session:', error);
    return res.status(500).json({
      error: 'Failed to get board session',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/board-decisions', async (req, res) => {
  try {
    const result = await service.listBoardDecisions({
      decisionState: req.query.decisionState ? String(req.query.decisionState) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error listing board decisions:', error);
    return res.status(500).json({
      error: 'Failed to list board decisions',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/board-decisions/:id/reviews', async (req, res) => {
  try {
    const input: BoardDecisionReviewInput = req.body;
    if (!input?.decisionQuality || !input?.reviewedAt) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['decisionQuality', 'reviewedAt'],
      });
    }
    const result = await service.createBoardDecisionReview(req.params.id, input);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating board decision review:', error);
    return res.status(500).json({
      error: 'Failed to create board decision review',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
