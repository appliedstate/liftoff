import { closePgPool } from '../lib/pg';
import { synthesizeMeetingSession } from '../lib/meetingSynthesis';
import { MeetingIntelligenceService } from '../services/meetingIntelligence';

async function main() {
  const meetingId = process.argv[2];
  const model = process.argv[3];
  if (!meetingId) {
    throw new Error('Usage: ts-node src/scripts/synthesizeMeeting.ts <meeting-id> [model]');
  }

  const service = new MeetingIntelligenceService();
  const meeting = await service.getMeetingSession(meetingId);
  if (!meeting) {
    throw new Error(`Meeting not found: ${meetingId}`);
  }

  const synthesis = await synthesizeMeetingSession(meeting, { model });
  const updated = await service.applyMeetingSynthesis(meetingId, synthesis);

  console.log(JSON.stringify({
    meetingId,
    title: updated?.title,
    confidenceScore: synthesis.confidenceScore,
    ideas: synthesis.ideas.length,
    decisions: synthesis.decisions.length,
    actionItems: synthesis.actionItems.length,
    openQuestions: synthesis.openQuestions.length,
    voiceSignals: synthesis.voiceSignals.length,
    transcriptTruncated: synthesis.metadata.transcript_truncated,
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
