import { closePgPool } from '../lib/pg';
import { buildMeetingSessionFromSlack } from '../lib/slackMeetingImport';
import { MeetingIntelligenceService } from '../services/meetingIntelligence';

function parseArgs() {
  const [,, channelArg, windowArg, threadTsArg] = process.argv;
  if (!channelArg) {
    throw new Error(
      'Usage: ts-node src/scripts/ingestSlackMeeting.ts <channel-id|#channel-name> [window] [threadTs]'
    );
  }
  return {
    channel: channelArg,
    window: windowArg || '2d',
    threadTs: threadTsArg || null,
  };
}

async function main() {
  const { channel, window, threadTs } = parseArgs();
  const service = new MeetingIntelligenceService();
  const input = await buildMeetingSessionFromSlack({
    channel,
    window,
    threadTs,
  });
  const created = await service.createMeetingSession(input);

  console.log(JSON.stringify({
    meetingId: created.id,
    title: created.title,
    sourceType: created.source_type,
    occurredAt: created.occurred_at,
    endedAt: created.ended_at,
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
