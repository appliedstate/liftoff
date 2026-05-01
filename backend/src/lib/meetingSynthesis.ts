import {
  MeetingActionItemInput,
  MeetingDecisionInput,
  MeetingIdeaInput,
  MeetingOpenQuestionInput,
  PersonVoiceSignalInput,
} from '../services/meetingIntelligence';
import { generateText } from './openai';

const SYNTHESIS_VERSION = 'meeting_synthesis_v1';
const MAX_TRANSCRIPT_SEGMENTS = 180;
const MAX_TRANSCRIPT_CHARS = 32000;

type PromptSegment = {
  index: number;
  id: string;
  speakerLabel: string;
  text: string;
};

type MeetingRecord = {
  id: string;
  title: string;
  meeting_type?: string | null;
  source_type: string;
  occurred_at: string;
  participants?: Array<{ display_name?: string | null; role_at_time?: string | null; participant_type?: string | null }>;
  transcriptSegments?: Array<{ id: string; speaker_label?: string | null; person_name?: string | null; text: string }>;
};

type RawIdea = {
  description: string;
  raisedByName: string;
  problemAddressed: string;
  expectedUpside: string;
  constraintRelieved: string;
  status: string;
  sourceSegmentIndex: number;
  linkedEntities: string[];
};

type RawDecision = {
  decisionText: string;
  decisionOwnerName: string;
  decisionType: string;
  confidenceScore: number;
  sourceSegmentIndex: number;
  linkedEntities: string[];
};

type RawActionItem = {
  description: string;
  ownerName: string;
  backupOwnerName: string;
  status: string;
  priority: string;
  urgency: string;
  dueAt: string;
  sourceSegmentIndex: number;
  linkedEntities: string[];
};

type RawOpenQuestion = {
  questionText: string;
  raisedByName: string;
  ownerName: string;
  status: string;
  sourceSegmentIndex: number;
};

type RawVoiceSignal = {
  personName: string;
  signalType: string;
  signalText: string;
  theme: string;
  confidenceScore: number;
  sourceSegmentIndex: number;
};

type RawSynthesis = {
  summaryMd: string;
  decisionSummaryMd: string;
  actionSummaryMd: string;
  confidenceScore: number;
  ideas: RawIdea[];
  decisions: RawDecision[];
  actionItems: RawActionItem[];
  openQuestions: RawOpenQuestion[];
  voiceSignals: RawVoiceSignal[];
};

export interface MeetingSynthesisResult {
  summaryMd: string;
  decisionSummaryMd: string;
  actionSummaryMd: string;
  confidenceScore: number;
  ideas: MeetingIdeaInput[];
  decisions: MeetingDecisionInput[];
  actionItems: MeetingActionItemInput[];
  openQuestions: MeetingOpenQuestionInput[];
  voiceSignals: PersonVoiceSignalInput[];
  metadata: {
    generation_source: string;
    synthesized_at: string;
    model?: string;
    transcript_truncated: boolean;
    included_segment_count: number;
    total_segment_count: number;
  };
}

function synthesisSchema() {
  return {
    type: 'json_schema',
    name: 'meeting_intelligence_synthesis',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        summaryMd: { type: 'string' },
        decisionSummaryMd: { type: 'string' },
        actionSummaryMd: { type: 'string' },
        confidenceScore: { type: 'number' },
        ideas: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              description: { type: 'string' },
              raisedByName: { type: 'string' },
              problemAddressed: { type: 'string' },
              expectedUpside: { type: 'string' },
              constraintRelieved: { type: 'string' },
              status: { type: 'string' },
              sourceSegmentIndex: { type: 'integer' },
              linkedEntities: { type: 'array', items: { type: 'string' } },
            },
            required: [
              'description',
              'raisedByName',
              'problemAddressed',
              'expectedUpside',
              'constraintRelieved',
              'status',
              'sourceSegmentIndex',
              'linkedEntities',
            ],
          },
        },
        decisions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              decisionText: { type: 'string' },
              decisionOwnerName: { type: 'string' },
              decisionType: { type: 'string' },
              confidenceScore: { type: 'number' },
              sourceSegmentIndex: { type: 'integer' },
              linkedEntities: { type: 'array', items: { type: 'string' } },
            },
            required: [
              'decisionText',
              'decisionOwnerName',
              'decisionType',
              'confidenceScore',
              'sourceSegmentIndex',
              'linkedEntities',
            ],
          },
        },
        actionItems: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              description: { type: 'string' },
              ownerName: { type: 'string' },
              backupOwnerName: { type: 'string' },
              status: { type: 'string' },
              priority: { type: 'string' },
              urgency: { type: 'string' },
              dueAt: { type: 'string' },
              sourceSegmentIndex: { type: 'integer' },
              linkedEntities: { type: 'array', items: { type: 'string' } },
            },
            required: [
              'description',
              'ownerName',
              'backupOwnerName',
              'status',
              'priority',
              'urgency',
              'dueAt',
              'sourceSegmentIndex',
              'linkedEntities',
            ],
          },
        },
        openQuestions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              questionText: { type: 'string' },
              raisedByName: { type: 'string' },
              ownerName: { type: 'string' },
              status: { type: 'string' },
              sourceSegmentIndex: { type: 'integer' },
            },
            required: ['questionText', 'raisedByName', 'ownerName', 'status', 'sourceSegmentIndex'],
          },
        },
        voiceSignals: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              personName: { type: 'string' },
              signalType: { type: 'string' },
              signalText: { type: 'string' },
              theme: { type: 'string' },
              confidenceScore: { type: 'number' },
              sourceSegmentIndex: { type: 'integer' },
            },
            required: [
              'personName',
              'signalType',
              'signalText',
              'theme',
              'confidenceScore',
              'sourceSegmentIndex',
            ],
          },
        },
      },
      required: [
        'summaryMd',
        'decisionSummaryMd',
        'actionSummaryMd',
        'confidenceScore',
        'ideas',
        'decisions',
        'actionItems',
        'openQuestions',
        'voiceSignals',
      ],
    },
  };
}

function asLinkedEntities(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, 8);
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function sanitizeStatus(value: string, fallback: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  return normalized || fallback;
}

function sanitizePriority(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (['critical', 'high', 'medium', 'low'].includes(normalized)) return normalized;
  return 'medium';
}

function sanitizeUrgency(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (['today', 'this_week', 'this_month', 'backlog', 'monitor'].includes(normalized)) return normalized;
  return normalized || 'this_week';
}

function sanitizeSignalType(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  if (
    [
      'founder_concern',
      'operator_concern',
      'execution_gap',
      'opportunity_gap',
      'intent_packet_gap',
      'buyer_bias',
      'tracking_gap',
      'scaling_constraint',
      'account_risk',
      'system_gap',
      'positive_signal',
    ].includes(normalized)
  ) {
    return normalized;
  }
  return 'system_gap';
}

function buildPromptSegments(meeting: MeetingRecord): { segments: PromptSegment[]; transcriptTruncated: boolean } {
  const rawSegments = (meeting.transcriptSegments || []).filter((segment) => String(segment.text || '').trim());
  const promptSegments: PromptSegment[] = [];
  let totalChars = 0;

  for (let index = 0; index < rawSegments.length; index += 1) {
    const segment = rawSegments[index];
    const speakerLabel = String(segment.person_name || segment.speaker_label || 'Unknown').trim();
    const text = String(segment.text || '').trim();
    if (!text) continue;

    const serialized = `[${promptSegments.length + 1}] ${speakerLabel}: ${text}`;
    if (promptSegments.length >= MAX_TRANSCRIPT_SEGMENTS || totalChars + serialized.length > MAX_TRANSCRIPT_CHARS) {
      return { segments: promptSegments, transcriptTruncated: true };
    }

    promptSegments.push({
      index: promptSegments.length + 1,
      id: segment.id,
      speakerLabel,
      text,
    });
    totalChars += serialized.length;
  }

  return { segments: promptSegments, transcriptTruncated: rawSegments.length > promptSegments.length };
}

function buildPrompt(meeting: MeetingRecord, segments: PromptSegment[], transcriptTruncated: boolean): string {
  const participants = (meeting.participants || [])
    .map((participant) => {
      const name = String(participant.display_name || '').trim();
      if (!name) return null;
      const role = participant.role_at_time || participant.participant_type || 'participant';
      return `- ${name} (${role})`;
    })
    .filter(Boolean)
    .join('\n');

  const transcript = segments
    .map((segment) => `[${segment.index}] ${segment.speakerLabel}: ${segment.text}`)
    .join('\n');

  return [
    `Meeting title: ${meeting.title}`,
    `Meeting type: ${meeting.meeting_type || 'unspecified'}`,
    `Source type: ${meeting.source_type}`,
    `Occurred at: ${meeting.occurred_at}`,
    '',
    'Prime directive context:',
    'Maximize durable net profit growth per unit of constrained company capacity, while never allowing projected monthly net profit to fall below the configured floor.',
    '',
    'Extraction rules:',
    '- Extract only facts, ideas, decisions, and action items that are supported by the transcript.',
    '- Treat meetings as operating inputs for a media-buying and Google RSoC business.',
    '- Distinguish ideas from decisions. A decision means someone actually chose a course of action.',
    '- Action items should be concrete enough to assign to an owner. If the owner is unclear, leave ownerName empty.',
    '- Capture founder/operator concerns, execution gaps, opportunity gaps, intent-packet gaps, and buyer bias as voice signals when they appear.',
    '- Use participant names exactly when they appear in the participant list or transcript.',
    '- Use sourceSegmentIndex = 0 only if there is no single supporting segment.',
    '- Keep summaries concise and high-signal Markdown.',
    `- The transcript ${transcriptTruncated ? 'was truncated to fit the model context window' : 'was fully included'}.`,
    '',
    'Allowed voice signal types:',
    '- founder_concern',
    '- operator_concern',
    '- execution_gap',
    '- opportunity_gap',
    '- intent_packet_gap',
    '- buyer_bias',
    '- tracking_gap',
    '- scaling_constraint',
    '- account_risk',
    '- system_gap',
    '- positive_signal',
    '',
    'Participants:',
    participants || '- none provided',
    '',
    'Transcript:',
    transcript || '(no transcript available)',
  ].join('\n');
}

function coerceSynthesis(raw: RawSynthesis): Omit<MeetingSynthesisResult, 'metadata'> {
  return {
    summaryMd: String(raw.summaryMd || '').trim(),
    decisionSummaryMd: String(raw.decisionSummaryMd || '').trim(),
    actionSummaryMd: String(raw.actionSummaryMd || '').trim(),
    confidenceScore: clampConfidence(raw.confidenceScore),
    ideas: (raw.ideas || [])
      .filter((idea) => String(idea.description || '').trim())
      .slice(0, 12)
      .map((idea) => ({
        description: idea.description.trim(),
        raisedByName: idea.raisedByName.trim() || null,
        problemAddressed: idea.problemAddressed.trim() || null,
        expectedUpside: idea.expectedUpside.trim() || null,
        constraintRelieved: idea.constraintRelieved.trim() || null,
        status: sanitizeStatus(idea.status, 'candidate'),
        sourceSegmentId: idea.sourceSegmentIndex > 0 ? String(idea.sourceSegmentIndex) : null,
        linkedEntities: asLinkedEntities(idea.linkedEntities || []),
        metadata: { generation_source: SYNTHESIS_VERSION },
      })),
    decisions: (raw.decisions || [])
      .filter((decision) => String(decision.decisionText || '').trim())
      .slice(0, 12)
      .map((decision) => ({
        decisionText: decision.decisionText.trim(),
        decisionOwnerName: decision.decisionOwnerName.trim() || null,
        decisionType: sanitizeStatus(decision.decisionType, 'decision'),
        confidenceScore: clampConfidence(decision.confidenceScore),
        sourceSegmentId: decision.sourceSegmentIndex > 0 ? String(decision.sourceSegmentIndex) : null,
        linkedEntities: asLinkedEntities(decision.linkedEntities || []),
        metadata: { generation_source: SYNTHESIS_VERSION },
      })),
    actionItems: (raw.actionItems || [])
      .filter((actionItem) => String(actionItem.description || '').trim())
      .slice(0, 20)
      .map((actionItem) => ({
        description: actionItem.description.trim(),
        ownerName: actionItem.ownerName.trim() || null,
        backupOwnerName: actionItem.backupOwnerName.trim() || null,
        status: sanitizeStatus(actionItem.status, 'open'),
        priority: sanitizePriority(actionItem.priority || ''),
        urgency: sanitizeUrgency(actionItem.urgency || ''),
        dueAt: actionItem.dueAt.trim() || null,
        sourceSegmentId: actionItem.sourceSegmentIndex > 0 ? String(actionItem.sourceSegmentIndex) : null,
        sourceType: 'meeting_synthesis',
        linkedEntities: asLinkedEntities(actionItem.linkedEntities || []),
        metadata: { generation_source: SYNTHESIS_VERSION },
      })),
    openQuestions: (raw.openQuestions || [])
      .filter((question) => String(question.questionText || '').trim())
      .slice(0, 12)
      .map((question) => ({
        questionText: question.questionText.trim(),
        raisedByName: question.raisedByName.trim() || null,
        ownerName: question.ownerName.trim() || null,
        status: sanitizeStatus(question.status, 'open'),
        sourceSegmentId: question.sourceSegmentIndex > 0 ? String(question.sourceSegmentIndex) : null,
        metadata: { generation_source: SYNTHESIS_VERSION },
      })),
    voiceSignals: (raw.voiceSignals || [])
      .filter((signal) => String(signal.personName || '').trim() && String(signal.signalText || '').trim())
      .slice(0, 20)
      .map((signal) => ({
        personName: signal.personName.trim(),
        signalType: sanitizeSignalType(signal.signalType),
        signalText: signal.signalText.trim(),
        theme: signal.theme.trim() || null,
        confidenceScore: clampConfidence(signal.confidenceScore),
        sourceSegmentId: signal.sourceSegmentIndex > 0 ? String(signal.sourceSegmentIndex) : null,
        metadata: { generation_source: SYNTHESIS_VERSION },
      })),
  };
}

export async function synthesizeMeetingSession(
  meeting: MeetingRecord,
  options: { model?: string } = {}
): Promise<MeetingSynthesisResult> {
  const { segments, transcriptTruncated } = buildPromptSegments(meeting);
  if (!segments.length) {
    throw new Error(`Meeting ${meeting.id} has no transcript segments to synthesize`);
  }

  const system = [
    'You are an operating analyst turning transcripts into durable company state.',
    'You work for a capital allocation and media-buying operating system.',
    'Return only strict JSON that matches the schema.',
    'Do not hallucinate owners, deadlines, or decisions that are not supported by the transcript.',
  ].join(' ');

  const prompt = buildPrompt(meeting, segments, transcriptTruncated);
  const raw = await generateText({
    system,
    prompt,
    temperature: 0,
    maxTokens: 3200,
    model: options.model,
    textFormat: synthesisSchema(),
  });

  const parsed = JSON.parse(raw) as RawSynthesis;
  const coerced = coerceSynthesis(parsed);

  return {
    ...coerced,
    metadata: {
      generation_source: SYNTHESIS_VERSION,
      synthesized_at: new Date().toISOString(),
      model: options.model,
      transcript_truncated: transcriptTruncated,
      included_segment_count: segments.length,
      total_segment_count: meeting.transcriptSegments?.length || 0,
    },
  };
}

export { SYNTHESIS_VERSION };
