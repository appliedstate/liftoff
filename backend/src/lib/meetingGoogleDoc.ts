import fs from 'fs';
import path from 'path';
import { MeetingParticipantInput, MeetingSessionInput, TranscriptSegmentInput } from '../services/meetingIntelligence';

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function parseOccurredAt(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function inferTitle(sourceUri?: string | null): string {
  if (!sourceUri) return 'Google Meet Transcript';
  try {
    const url = new URL(sourceUri);
    if (url.hostname.includes('docs.google.com')) {
      return 'Google Meet Transcript Import';
    }
  } catch {
    // ignore
  }
  return path.basename(sourceUri);
}

function normalizeParticipants(segments: TranscriptSegmentInput[]): MeetingParticipantInput[] {
  const seen = new Set<string>();
  const participants: MeetingParticipantInput[] = [];
  for (const segment of segments) {
    const displayName = String(segment.personName || segment.speakerLabel || '').trim();
    if (!displayName) continue;
    const key = displayName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    participants.push({
      displayName,
      participantType: null,
      roleAtTime: null,
      attendanceConfidence: 0.9,
      metadata: {
        inferredFromTranscript: true,
        source: 'google_doc',
      },
    });
  }
  return participants;
}

function parseTranscriptSegments(content: string): TranscriptSegmentInput[] {
  const lines = normalizeLineEndings(content).split('\n');
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
      if (current && !current.text.endsWith('\n')) current.text += '\n';
      continue;
    }

    // Common Google Meet transcript patterns:
    // "Speaker Name 10:34 AM"
    // "Speaker Name (Company) 10:34 AM"
    // "Speaker Name: text"
    const timestampHeaderMatch = line.match(/^([A-Za-z0-9 .,'’()&\/-]{2,120})\s+(\d{1,2}:\d{2}\s?(?:AM|PM))$/i);
    if (timestampHeaderMatch) {
      pushCurrent();
      const speaker = timestampHeaderMatch[1].trim();
      current = {
        speakerLabel: speaker,
        personName: speaker,
        text: '',
        sourceType: 'google_doc',
        confidenceScore: 0.95,
        metadata: {
          transcriptTimestamp: timestampHeaderMatch[2].trim(),
          source: 'google_meet_doc',
        },
      };
      continue;
    }

    const colonMatch = line.match(/^(?:\*\*)?([A-Za-z0-9 .,'’()&\/-]{2,120})(?:\*\*)?:\s+(.*)$/);
    if (colonMatch) {
      pushCurrent();
      const speaker = colonMatch[1].trim();
      current = {
        speakerLabel: speaker,
        personName: speaker,
        text: colonMatch[2].trim(),
        sourceType: 'google_doc',
        confidenceScore: 0.9,
        metadata: {
          source: 'google_meet_doc',
        },
      };
      continue;
    }

    if (!current) {
      current = {
        speakerLabel: null,
        personName: null,
        text: line,
        sourceType: 'google_doc',
        confidenceScore: 0.7,
        metadata: {
          source: 'google_meet_doc',
        },
      };
    } else {
      current.text += `${current.text.endsWith('\n') || !current.text ? '' : ' '}${line}`;
    }
  }

  pushCurrent();
  return segments;
}

export function buildMeetingSessionFromGoogleDocTranscript(input: {
  content: string;
  sourceUri?: string | null;
  title?: string | null;
  occurredAt?: string | null;
  meetingType?: string | null;
}): MeetingSessionInput {
  const content = normalizeLineEndings(String(input.content || '')).trim();
  if (!content) {
    throw new Error('Google Doc transcript content is empty');
  }

  const transcriptSegments = parseTranscriptSegments(content);
  const participants = normalizeParticipants(transcriptSegments);
  const occurredAt = parseOccurredAt(input.occurredAt) || new Date().toISOString();

  return {
    title: String(input.title || inferTitle(input.sourceUri)).trim(),
    meetingType: input.meetingType || 'google_meet_transcript',
    sourceType: 'google_doc',
    sourceUri: input.sourceUri || null,
    rawTextRef: input.sourceUri || null,
    rawText: content,
    occurredAt,
    endedAt: null,
    summaryMd: null,
    decisionSummaryMd: null,
    actionSummaryMd: null,
    confidenceScore: 0.7,
    metadata: {
      importedFromGoogleDoc: true,
      sourceUri: input.sourceUri || null,
    },
    participants,
    transcriptSegments,
  };
}

export function readMeetingSessionFromGoogleDocFile(filePath: string, sourceUri?: string | null): MeetingSessionInput {
  const content = fs.readFileSync(filePath, 'utf8');
  return buildMeetingSessionFromGoogleDocTranscript({
    content,
    sourceUri: sourceUri || filePath,
    title: path.basename(filePath),
  });
}
