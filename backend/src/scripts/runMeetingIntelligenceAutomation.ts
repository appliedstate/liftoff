import { closePgPool } from '../lib/pg';
import { runMeetingIntelligenceAutomation } from '../lib/meetingIntelligenceAutomation';

async function main() {
  const alertLimit = Number(process.env.MEETING_INTEL_ALERT_LIMIT || '8');
  const scorecardLimit = Number(process.env.MEETING_INTEL_SCORECARD_LIMIT || '10');
  const lookbackDays = Number(process.env.MEETING_INTEL_LOOKBACK_DAYS || '7');
  const localReportDays = Number(process.env.MEETING_INTEL_LOCAL_REPORT_DAYS || '30');
  const slackChannel = process.env.MEETING_INTEL_SLACK_CHANNEL || '';
  const ingestWatchedSources = process.env.MEETING_INTEL_SKIP_WATCH_INGEST === 'true' ? false : true;

  const output = await runMeetingIntelligenceAutomation({
    alertLimit,
    scorecardLimit,
    lookbackDays,
    localReportDays,
    slackChannel,
    ingestWatchedSources,
  });

  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePgPool();
  });
