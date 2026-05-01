import fs from 'fs';
import path from 'path';
import { MeetingParticipantInput, MeetingSessionInput, TranscriptSegmentInput } from '../services/meetingIntelligence';

type FrontmatterMap = Record<string, any>;

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseScalar(value: string): any {
  const stripped = stripQuotes(value);
  if (stripped === 'true') return true;
  if (stripped === 'false') return false;
  if (stripped === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(stripped)) return Number(stripped);
  return stripped;
}

function parseFrontmatter(markdown: string): { frontmatter: FrontmatterMap; body: string } {
  const normalized = markdown.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { frontmatter: {}, body: normalized };
  }

  const closingIndex = normalized.indexOf('\n---\n', 4);
  if (closingIndex === -1) {
    return { frontmatter: {}, body: normalized };
  }

  const rawFrontmatter = normalized.slice(4, closingIndex);
  const body = normalized.slice(closingIndex + 5);
  const lines = rawFrontmatter.split('\n');
  const frontmatter: FrontmatterMap = {};
  let currentArrayKey: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    const arrayItemMatch = line.match(/^\s*-\s+(.*)$/);
    if (arrayItemMatch && currentArrayKey) {
      if (!Array.isArray(frontmatter[currentArrayKey])) frontmatter[currentArrayKey] = [];
      frontmatter[currentArrayKey].push(parseScalar(arrayItemMatch[1]));
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    const rawValue = kvMatch[2];
    if (!rawValue) {
      frontmatter[key] = [];
      currentArrayKey = key;
      continue;
    }

    frontmatter[key] = parseScalar(rawValue);
    currentArrayKey = null;
  }

  return { frontmatter, body: body.trim() };
}

function normalizeParticipants(frontmatter: FrontmatterMap): MeetingParticipantInput[] {
  const rawParticipants = Array.isArray(frontmatter.participants) ? frontmatter.participants : [];
  return rawParticipants
    .map((participant) => String(participant || '').trim())
    .filter(Boolean)
    .map((displayName) => ({
      displayName,
      participantType: null,
      roleAtTime: null,
      attendanceConfidence: 1,
      metadata: {},
    }));
}

function parseTranscriptSegments(body: string): TranscriptSegmentInput[] {
  if (!body.trim()) return [];

  const lines = body.split('\n');
  const segments: TranscriptSegmentInput[] = [];
  let current: TranscriptSegmentInput | null = null;

  const pushCurrent = () => {
    if (!current) return;
    current.text = current.text.trim();
    if (current.text) segments.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (current) current.text += '\n';
      continue;
    }

    const speakerMatch = line.match(/^(?:\*\*)?([A-Za-z0-9 .,'’()&\/-]{2,80})(?:\*\*)?:\s+(.*)$/);
    if (speakerMatch) {
      pushCurrent();
      const speaker = speakerMatch[1].trim();
      const text = speakerMatch[2].trim();
      current = {
        speakerLabel: speaker,
        personName: speaker,
        text,
        sourceType: 'manual_markdown',
        confidenceScore: 1,
        metadata: {},
      };
      continue;
    }

    if (!current) {
      current = {
        speakerLabel: null,
        personName: null,
        text: line,
        sourceType: 'manual_markdown',
        confidenceScore: 1,
        metadata: {},
      };
    } else {
      current.text += `${current.text.endsWith('\n') ? '' : ' '}${line}`;
    }
  }

  pushCurrent();
  return segments;
}

export function buildMeetingSessionFromMarkdown(markdown: string, sourceUri?: string | null): MeetingSessionInput {
  const { frontmatter, body } = parseFrontmatter(markdown);
  const participants = normalizeParticipants(frontmatter);
  const transcriptSegments = parseTranscriptSegments(body);

  const seenNames = new Set(participants.map((participant) => participant.displayName.toLowerCase()));
  for (const segment of transcriptSegments) {
    const personName = String(segment.personName || '').trim();
    if (!personName) continue;
    const lower = personName.toLowerCase();
    if (seenNames.has(lower)) continue;
    participants.push({
      displayName: personName,
      participantType: null,
      roleAtTime: null,
      attendanceConfidence: 0.75,
      metadata: { inferredFromTranscript: true },
    });
    seenNames.add(lower);
  }

  const occurredAt =
    frontmatter.occurred_at ||
    frontmatter.occurredAt ||
    new Date().toISOString();

  return {
    title: frontmatter.title || path.basename(sourceUri || 'manual-transcript.md'),
    meetingType: frontmatter.meeting_type || frontmatter.meetingType || null,
    sourceType: String(frontmatter.source_type || frontmatter.sourceType || 'manual_markdown'),
    sourceUri: sourceUri || null,
    rawTextRef: sourceUri || null,
    rawText: body,
    occurredAt: String(occurredAt),
    endedAt: frontmatter.ended_at || frontmatter.endedAt || null,
    summaryMd: null,
    decisionSummaryMd: null,
    actionSummaryMd: null,
    confidenceScore: 0.65,
    metadata: {
      frontmatter,
      importedFromMarkdown: true,
    },
    participants,
    transcriptSegments,
  };
}

export function readMeetingSessionFromMarkdownFile(filePath: string): MeetingSessionInput {
  const markdown = fs.readFileSync(filePath, 'utf8');
  return buildMeetingSessionFromMarkdown(markdown, filePath);
}
