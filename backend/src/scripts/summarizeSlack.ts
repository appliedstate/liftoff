import dotenv from 'dotenv';
import axios from 'axios';

// Load environment from backend/.env when invoked from backend directory
dotenv.config();

type SlackMessage = {
  ts: string;
  text?: string;
  user?: string;
  subtype?: string;
  thread_ts?: string;
  reply_count?: number;
};

function fail(message: string): never {
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(1);
}

function parseArgs() {
  const [,, channelArg, windowArg, queryArg] = process.argv;
  if (!channelArg) fail('Usage: ts-node src/scripts/summarizeSlack.ts <channel-id|#channel-name> [window] [query]\nExample: ts-node src/scripts/summarizeSlack.ts C012ABCDEF 2d newsbreak');
  return {
    channel: channelArg,
    window: windowArg || '2d',
    query: queryArg || '',
  };
}

function secondsFromWindow(window: string): number {
  const match = window.match(/^(\d+)([dhm])$/i);
  if (!match) return 2 * 24 * 60 * 60; // default 2d
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'd') return value * 24 * 60 * 60;
  if (unit === 'h') return value * 60 * 60;
  if (unit === 'm') return value * 60;
  return 2 * 24 * 60 * 60;
}

async function resolveChannelId(token: string, input: string): Promise<string> {
  if (/^[CGD][A-Z0-9]+$/.test(input)) return input; // already an ID
  const name = input.replace(/^#/, '');
  let cursor: string | undefined = undefined;
  do {
    const res: any = await axios.get('https://slack.com/api/conversations.list', {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 200, types: 'public_channel,private_channel', cursor },
    });
    if (!res.data.ok) fail(`Slack error (conversations.list): ${res.data.error}`);
    const found = (res.data.channels as any[]).find((c) => c.name === name);
    if (found) return found.id as string;
    cursor = res.data.response_metadata?.next_cursor || undefined;
  } while (cursor);
  fail(`Channel not found by name: ${input}`);
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
  return all
    .filter((m) => !m.subtype)
    .sort((a, b) => Number(a.ts) - Number(b.ts));
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
  // API returns parent as first element; keep chronological and skip parent in replies slice
  return thread
    .filter((m) => !m.subtype)
    .sort((a, b) => Number(a.ts) - Number(b.ts));
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
      }
    } catch (e) {
      map.set(user, user);
    }
  }
  return map;
}

function toPlainTranscriptWithThreads(
  messages: SlackMessage[],
  threadMap: Map<string, SlackMessage[]>,
  userNameMap: Map<string, string>
): string {
  const lines: string[] = [];
  for (const m of messages) {
    const author = (m.user && userNameMap.get(m.user)) || m.user || 'user';
    lines.push(`- ${author}: ${m.text || ''}`);
    const replies = threadMap.get(m.ts) || [];
    // Skip duplicate parent if present as first item
    const replyStartIndex = replies.length > 0 && replies[0].ts === m.ts ? 1 : 0;
    for (let i = replyStartIndex; i < replies.length; i += 1) {
      const r = replies[i];
      const replyAuthor = (r.user && userNameMap.get(r.user)) || r.user || 'user';
      lines.push(`  • ${replyAuthor}: ${r.text || ''}`);
    }
  }
  return lines.join('\n');
}

async function summarizeWithOpenAI(apiKey: string, channelName: string, transcript: string): Promise<string> {
  const body = {
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'You write crisp, high-signal executive summaries.' },
      { role: 'user', content: `Summarize the recent updates from #${channelName}. Return:\n1) Key developments\n2) Decisions/risks\n3) Shipped/accomplishments\n4) Next focus\n\nMessages:\n${transcript}` },
    ],
  } as const;
  const res = await axios.post('https://api.openai.com/v1/chat/completions', body, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });
  const content: string = res.data.choices?.[0]?.message?.content || '';
  return content.trim();
}

async function main() {
  const { channel, window, query } = parseArgs();
  const slackToken = process.env.SLACK_BOT_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!slackToken) fail('Missing SLACK_BOT_TOKEN in environment.');
  if (!openaiKey) fail('Missing OPENAI_API_KEY in environment.');

  const seconds = secondsFromWindow(window);
  const latest = Math.floor(Date.now() / 1000);
  const oldest = latest - seconds;

  const channelId = await resolveChannelId(slackToken, channel);

  const infoRes = await axios.get('https://slack.com/api/conversations.info', {
    headers: { Authorization: `Bearer ${slackToken}` },
    params: { channel: channelId },
  });
  if (!infoRes.data.ok) fail(`Slack error (conversations.info): ${infoRes.data.error}`);
  const channelName: string = infoRes.data.channel?.name || channel;

  let messages = await fetchMessages(slackToken, channelId, String(oldest), String(latest));
  const threadMap = new Map<string, SlackMessage[]>();
  // Preload replies for messages that have threads
  for (const m of messages) {
    const isThreadParent = m.thread_ts === m.ts && (m.reply_count || 0) > 0;
    if (isThreadParent) {
      const replies = await fetchThreadReplies(slackToken, channelId, m.ts);
      threadMap.set(m.ts, replies);
    }
  }
  if (query) {
    const q = query.toLowerCase();
    messages = messages.filter((m) => {
      const textMatch = (m.text || '').toLowerCase().includes(q);
      const replies = threadMap.get(m.ts) || [];
      const replyMatch = replies.some((r) => (r.text || '').toLowerCase().includes(q));
      return textMatch || replyMatch;
    });
  }
  if (messages.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`No messages found for #${channelName} in the last ${window}${query ? ` matching "${query}"` : ''}.`);
    return;
  }

  const userIds: string[] = [];
  for (const m of messages) {
    if (m.user) userIds.push(m.user);
    const replies = threadMap.get(m.ts) || [];
    for (const r of replies) if (r.user) userIds.push(r.user);
  }
  const userNameMap = await buildUserMap(slackToken, userIds);

  const transcript = toPlainTranscriptWithThreads(messages, threadMap, userNameMap);
  const summary = await summarizeWithOpenAI(openaiKey, channelName, transcript);

  // eslint-disable-next-line no-console
  console.log(`\n=== Digest: #${channelName} (${window}${query ? `, filter: ${query}` : ''}) ===\n`);
  // eslint-disable-next-line no-console
  console.log(summary);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.response?.data || err);
  process.exit(1);
});


