export interface WatchedSlackSource {
  key: string;
  label: string;
  channel: string;
  window?: string;
  meetingType?: string;
  query?: string;
}

const DEFAULT_WATCHED_SOURCES: WatchedSlackSource[] = [
  {
    key: 'engineering',
    label: 'Engineering Chat',
    channel: 'https://lincx.slack.com/archives/C01361VE6E6',
    window: '2d',
    meetingType: 'slack_engineering_channel',
  },
  {
    key: 'media_buying',
    label: 'Media Buying Team Chat',
    channel: 'https://lincx.slack.com/archives/C03SCRX2350',
    window: '2d',
    meetingType: 'slack_media_buying_channel',
  },
  {
    key: 'facebook_specific',
    label: 'Facebook Specific Chat',
    channel: 'https://lincx.slack.com/archives/C08S6KBCCHE',
    window: '5d',
    meetingType: 'slack_facebook_specific_channel',
  },
  {
    key: 'system1',
    label: 'System 1 Chat',
    channel: 'https://lincx.slack.com/archives/C08J79X7W3E',
    window: '3d',
    meetingType: 'slack_system1_channel',
  },
  {
    key: 'facebook_consultant',
    label: 'Facebook Consultant Chat',
    channel: 'https://lincx.slack.com/archives/C0AMQ03R6LB',
    window: '7d',
    meetingType: 'slack_facebook_consultant_channel',
  },
];

function parseJsonSources(raw: string): WatchedSlackSource[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const normalized = parsed
      .map((item: any, index: number) => ({
        key: String(item?.key || `source_${index + 1}`),
        label: String(item?.label || item?.channel || item?.url || `Source ${index + 1}`),
        channel: String(item?.channel || item?.url || '').trim(),
        window: item?.window ? String(item.window) : undefined,
        meetingType: item?.meetingType ? String(item.meetingType) : undefined,
        query: item?.query ? String(item.query) : undefined,
      }))
      .filter((item) => item.channel);
    return normalized.length ? normalized : null;
  } catch {
    return null;
  }
}

function parseDelimitedSources(raw: string): WatchedSlackSource[] {
  return raw
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((channel, index) => ({
      key: `source_${index + 1}`,
      label: channel,
      channel,
      window: '2d',
      meetingType: 'slack_channel_watch',
    }));
}

export function getWatchedSlackSources(): WatchedSlackSource[] {
  const raw = String(process.env.MEETING_INTEL_WATCH_CHANNELS || '').trim();
  if (!raw) {
    return DEFAULT_WATCHED_SOURCES;
  }

  return parseJsonSources(raw) || parseDelimitedSources(raw);
}
