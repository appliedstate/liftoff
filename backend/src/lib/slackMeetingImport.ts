import axios from 'axios';
import { MeetingParticipantInput, MeetingSessionInput, TranscriptSegmentInput } from '../services/meetingIntelligence';

type SlackMessage = {
  ts: string;
  text?: string;
  user?: string;
  subtype?: string;
  thread_ts?: string;
  reply_count?: number;
};

type SlackReference = {
  channel: string;
  threadTs?: string | null;
};

function fail(message: string): never {
  throw new Error(message);
}

function secondsFromWindow(window: string): number {
  const match = window.match(/^(\d+)([dhm])$/i);
  if (!match) return 2 * 24 * 60 * 60;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'd') return value * 24 * 60 * 60;
  if (unit === 'h') return value * 60 * 60;
  if (unit === 'm') return value * 60;
  return 2 * 24 * 60 * 60;
}

async function resolveChannelId(token: string, input: string): Promise<string> {
  if (/^[CGD][A-Z0-9]+$/.test(input)) return input;
  const name = input.replace(/^#/, '');
  let cursor: string | undefined = undefined;
  do {
    const res: any = await axios.get('https://slack.com/api/conversations.list', {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 200, types: 'public_channel,private_channel', cursor },
    });
    if (!res.data.ok) fail(`Slack error (conversations.list): ${res.data.error}`);
    const found = (res.data.channels as any[]).find((channel) => channel.name === name);
    if (found) return found.id as string;
    cursor = res.data.response_metadata?.next_cursor || undefined;
  } while (cursor);
  fail(`Channel not found by name: ${input}`);
}

function parseSlackArchiveUrl(input: string): SlackReference | null {
  try {
    const url = new URL(input);
    if (!/slack\.com$/i.test(url.hostname)) return null;
    const match = url.pathname.match(/\/archives\/([A-Z0-9]+)(?:\/p(\d{16}))?/i);
    if (!match) return null;
    const channel = match[1];
    const compactTs = match[2];
    const threadTs = compactTs ? `${compactTs.slice(0, 10)}.${compactTs.slice(10)}` : null;
    return { channel, threadTs };
  } catch {
    return null;
  }
}

export function normalizeSlackReference(input: string, threadTs?: string | null): SlackReference {
  const parsed = parseSlackArchiveUrl(String(input || '').trim());
  if (parsed) {
    return {
      channel: parsed.channel,
      threadTs: threadTs || parsed.threadTs || null,
    };
  }
  return {
    channel: String(input || '').trim(),
    threadTs: threadTs || null,
  };
}

async function fetchChannelInfo(token: string, channel: string): Promise<{ id: string; name: string }> {
  const res: any = await axios.get('https://slack.com/api/conversations.info', {
    headers: { Authorization: `Bearer ${token}` },
    params: { channel },
  });
  if (!res.data.ok) fail(`Slack error (conversations.info): ${res.data.error}`);
  return {
    id: channel,
    name: res.data.channel?.name || channel,
  };
}

async function fetchMessages(token: string, channel: string, oldestTs: string, latestTs: string): Promise<SlackMessage[]> {
  const all: SlackMessage[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res: any = await axios.get('https://slack.com/api/conversations.history', {
      headers: { Authorization: `Bearer ${token}` },
      params: { channel, oldest: oldestTs, latest: latestTs, inclusive: true, limit: 1000, cursor },
    });
    if (!res.data.ok) fail(`Slack error (conversations.history): ${res.data.error}`);
    all.push(...(res.data.messages || []));
    cursor = res.data.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return all.filter((message) => !message.subtype).sort((a, b) => Number(a.ts) - Number(b.ts));
}

async function fetchThreadReplies(token: string, channel: string, threadTs: string): Promise<SlackMessage[]> {
  const thread: SlackMessage[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res: any = await axios.get('https://slack.com/api/conversations.replies', {
      headers: { Authorization: `Bearer ${token}` },
      params: { channel, ts: threadTs, limit: 200, cursor },
    });
    if (!res.data.ok) fail(`Slack error (conversations.replies): ${res.data.error}`);
    thread.push(...(res.data.messages || []));
    cursor = res.data.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return thread.filter((message) => !message.subtype).sort((a, b) => Number(a.ts) - Number(b.ts));
}

async function buildUserMap(token: string, userIds: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, string>();
  for (const user of unique) {
    try {
      const res: any = await axios.get('https://slack.com/api/users.info', {
        headers: { Authorization: `Bearer ${token}` },
        params: { user },
      });
      if (res.data.ok) {
        const profile = res.data.user.profile;
        const name = profile.display_name || profile.real_name || res.data.user.name || user;
        map.set(user, name);
      } else {
        map.set(user, user);
      }
    } catch {
      map.set(user, user);
    }
  }
  return map;
}

function normalizeText(text: string | undefined): string {
  return String(text || '').replace(/<@([A-Z0-9]+)>/g, '@$1').trim();
}

function buildParticipants(messages: SlackMessage[], threadMap: Map<string, SlackMessage[]>, userNameMap: Map<string, string>): MeetingParticipantInput[] {
  const seen = new Set<string>();
  const participants: MeetingParticipantInput[] = [];
  const addUser = (userId?: string) => {
    if (!userId || seen.has(userId)) return;
    seen.add(userId);
    participants.push({
      personId: userId,
      displayName: userNameMap.get(userId) || userId,
      participantType: null,
      roleAtTime: null,
      attendanceConfidence: 1,
      metadata: { source: 'slack' },
    });
  };

  for (const message of messages) {
    addUser(message.user);
    const replies = threadMap.get(message.ts) || [];
    for (const reply of replies) addUser(reply.user);
  }
  return participants;
}

function buildSegments(messages: SlackMessage[], threadMap: Map<string, SlackMessage[]>, userNameMap: Map<string, string>): TranscriptSegmentInput[] {
  const segments: TranscriptSegmentInput[] = [];
  for (const message of messages) {
    segments.push({
      speakerLabel: message.user ? (userNameMap.get(message.user) || message.user) : 'user',
      personId: message.user || null,
      personName: message.user ? (userNameMap.get(message.user) || message.user) : null,
      startedAtOffsetSeconds: 0,
      endedAtOffsetSeconds: 0,
      text: normalizeText(message.text),
      sourceType: 'slack',
      confidenceScore: 1,
      metadata: {
        ts: message.ts,
        threadTs: message.thread_ts || null,
        isThreadParent: message.thread_ts === message.ts,
      },
    });

    const replies = threadMap.get(message.ts) || [];
    const replyStartIndex = replies.length > 0 && replies[0].ts === message.ts ? 1 : 0;
    for (let i = replyStartIndex; i < replies.length; i += 1) {
      const reply = replies[i];
      segments.push({
        speakerLabel: reply.user ? (userNameMap.get(reply.user) || reply.user) : 'user',
        personId: reply.user || null,
        personName: reply.user ? (userNameMap.get(reply.user) || reply.user) : null,
        startedAtOffsetSeconds: 0,
        endedAtOffsetSeconds: 0,
        text: normalizeText(reply.text),
        sourceType: 'slack',
        confidenceScore: 1,
        metadata: {
          ts: reply.ts,
          threadTs: message.ts,
          isThreadReply: true,
        },
      });
    }
  }
  return segments;
}

export interface SlackMeetingImportOptions {
  channel: string;
  window?: string;
  title?: string;
  threadTs?: string | null;
  query?: string;
}

export async function buildMeetingSessionFromSlack(options: SlackMeetingImportOptions): Promise<MeetingSessionInput> {
  const slackToken = process.env.SLACK_BOT_TOKEN;
  if (!slackToken) fail('Missing SLACK_BOT_TOKEN in environment.');

  const normalized = normalizeSlackReference(options.channel, options.threadTs);
  const channelId = await resolveChannelId(slackToken, normalized.channel);
  const channelInfo = await fetchChannelInfo(slackToken, channelId);

  let messages: SlackMessage[] = [];
  const threadMap = new Map<string, SlackMessage[]>();
  let occurredAt = new Date().toISOString();

  if (normalized.threadTs) {
    const threadMessages = await fetchThreadReplies(slackToken, channelId, normalized.threadTs);
    if (!threadMessages.length) fail(`No Slack thread found for ts ${normalized.threadTs}`);
    const parent = threadMessages[0];
    messages = [parent];
    threadMap.set(parent.ts, threadMessages);
    occurredAt = new Date(Number(parent.ts) * 1000).toISOString();
  } else {
    const seconds = secondsFromWindow(options.window || '2d');
    const latest = Math.floor(Date.now() / 1000);
    const oldest = latest - seconds;
    messages = await fetchMessages(slackToken, channelId, String(oldest), String(latest));

    for (const message of messages) {
      const isThreadParent = message.thread_ts === message.ts && (message.reply_count || 0) > 0;
      if (isThreadParent) {
        const replies = await fetchThreadReplies(slackToken, channelId, message.ts);
        threadMap.set(message.ts, replies);
      }
    }

    if (options.query) {
      const q = options.query.toLowerCase();
      messages = messages.filter((message) => {
        const textMatch = normalizeText(message.text).toLowerCase().includes(q);
        const replies = threadMap.get(message.ts) || [];
        const replyMatch = replies.some((reply) => normalizeText(reply.text).toLowerCase().includes(q));
        return textMatch || replyMatch;
      });
    }

    if (!messages.length) {
      fail(`No Slack messages found for ${options.channel} in window ${options.window || '2d'}`);
    }

    occurredAt = new Date(Number(messages[0].ts) * 1000).toISOString();
  }

  const latestTs = threadMap.size
    ? Math.max(
        ...Array.from(threadMap.values()).flat().map((message) => Number(message.ts))
      )
    : Math.max(...messages.map((message) => Number(message.ts)));
  const endedAt = new Date(latestTs * 1000).toISOString();

  const userIds: string[] = [];
  for (const message of messages) {
    if (message.user) userIds.push(message.user);
    const replies = threadMap.get(message.ts) || [];
    for (const reply of replies) if (reply.user) userIds.push(reply.user);
  }
  const userNameMap = await buildUserMap(slackToken, userIds);

  return {
    title:
      options.title ||
      (normalized.threadTs
        ? `Slack Thread Import — #${channelInfo.name}`
        : `Slack Window Import — #${channelInfo.name}`),
    meetingType: normalized.threadTs ? 'slack_thread' : 'slack_channel_window',
    sourceType: 'slack',
    sourceUri: `slack://${channelInfo.id}${normalized.threadTs ? `/thread/${normalized.threadTs}` : ''}`,
    rawTextRef: `slack://${channelInfo.id}`,
    rawText: '',
    occurredAt,
    endedAt,
    summaryMd: null,
    decisionSummaryMd: null,
    actionSummaryMd: null,
    confidenceScore: 0.7,
    metadata: {
      channelId: channelInfo.id,
      channelName: channelInfo.name,
      threadTs: normalized.threadTs || null,
      query: options.query || null,
      window: options.window || null,
      importedFromSlack: true,
    },
    participants: buildParticipants(messages, threadMap, userNameMap),
    transcriptSegments: buildSegments(messages, threadMap, userNameMap),
  };
}
