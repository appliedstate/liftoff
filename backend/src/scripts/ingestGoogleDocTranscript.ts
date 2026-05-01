import path from 'path';
import { readMeetingSessionFromGoogleDocFile } from '../lib/meetingGoogleDoc';
import { synthesizeMeetingSession } from '../lib/meetingSynthesis';
import { closePgPool } from '../lib/pg';
import { MeetingIntelligenceService } from '../services/meetingIntelligence';

async function main() {
  const fileArg = process.argv[2];
  const sourceUriArg = process.argv[3];
  if (!fileArg) {
    throw new Error(
      'Usage: ts-node src/scripts/ingestGoogleDocTranscript.ts <path-to-exported-transcript> [google-doc-url]'
    );
  }

  const absPath = path.resolve(process.cwd(), fileArg);
  const input = readMeetingSessionFromGoogleDocFile(absPath, sourceUriArg || absPath);
  const service = new MeetingIntelligenceService();
  const created = await service.createMeetingSession(input);
  const synthesis = await synthesizeMeetingSession(created);
  const updated = await service.applyMeetingSynthesis(created.id, synthesis);

  console.log(JSON.stringify({
    meetingId: updated?.id,
    title: updated?.title,
    sourceType: updated?.source_type,
    occurredAt: updated?.occurred_at,
    participants: updated?.participants?.length || 0,
    transcriptSegments: updated?.transcriptSegments?.length || 0,
    ideas: updated?.ideas?.length || 0,
    decisions: updated?.decisions?.length || 0,
    actionItems: updated?.actionItems?.length || 0,
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
