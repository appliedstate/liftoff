import path from 'path';
import { readMeetingSessionFromMarkdownFile } from '../lib/meetingMarkdown';
import { closePgPool } from '../lib/pg';
import { MeetingIntelligenceService } from '../services/meetingIntelligence';

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    throw new Error('Usage: ts-node src/scripts/ingestMeetingMarkdown.ts <path-to-markdown>');
  }

  const absPath = path.resolve(process.cwd(), fileArg);
  const input = readMeetingSessionFromMarkdownFile(absPath);
  const service = new MeetingIntelligenceService();
  const created = await service.createMeetingSession(input);

  console.log(JSON.stringify({
    meetingId: created.id,
    title: created.title,
    sourceType: created.source_type,
    occurredAt: created.occurred_at,
    participants: created.participants?.length || 0,
    transcriptSegments: created.transcriptSegments?.length || 0,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePgPool();
  });
