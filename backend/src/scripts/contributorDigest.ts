import dotenv from 'dotenv';
import axios from 'axios';

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
  console.error(message);
  process.exit(1);
}

function parseArgs() {
  const [,, channelArg, windowArg, usersArg] = process.argv;
  if (!channelArg) fail('Usage: ts-node src/scripts/contributorDigest.ts <channel-id|#channel-name> [window] [comma-separated-usernames]');
  return {
    channel: channelArg,
    window: windowArg || '30d',
    usernames: (usersArg || '').split(',').map(s => s.trim()).filter(Boolean),
  };
}

function secondsFromWindow(window: string): number {
  const match = window.match(/^(\d+)([dhm])$/i);
  if (!match) return 30 * 24 * 60 * 60;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'd') return value * 24 * 60 * 60;
  if (unit === 'h') return value * 60 * 60;
  if (unit === 'm') return value * 60;
  return 30 * 24 * 60 * 60;
}

async function resolveChannelId(token: string, input: string): Promise<string> {
  if (/^[CGD][A-Z0-9]+$/.test(input)) return input;
  const name = input.replace(/^#/, '');
  let cursor: string | undefined;
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

async function usersList(token: string): Promise<Record<string, string>> {
  const res = await axios.get('https://slack.com/api/users.list?limit=1000', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.data.ok) fail(`Slack error (users.list): ${res.data.error}`);
  const map: Record<string, string> = {};
  for (const m of res.data.members || []) {
    const name = m.profile?.display_name || m.profile?.real_name || m.name || m.id;
    map[m.id] = name;
  }
  return map;
}

async function fetchHistory(token: string, channel: string, oldest: string, latest: string): Promise<SlackMessage[]> {
  const all: SlackMessage[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await axios.get('https://slack.com/api/conversations.history', {
      headers: { Authorization: `Bearer ${token}` },
      params: { channel, oldest, latest, limit: 200, inclusive: true, cursor },
    });
    if (!res.data.ok) fail(`Slack error (conversations.history): ${res.data.error}`);
    all.push(...(res.data.messages || []));
    cursor = res.data.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return all.filter(m => !m.subtype).sort((a,b) => Number(a.ts) - Number(b.ts));
}

function filterByUsers(messages: SlackMessage[], idToName: Record<string,string>, usernames: string[]): SlackMessage[] {
  if (usernames.length === 0) return messages;
  const lowered = usernames.map(u => u.toLowerCase());
  const allowedIds = new Set(
    Object.entries(idToName)
      .filter(([_, name]) => lowered.some(q => name.toLowerCase().includes(q)))
      .map(([id]) => id)
  );
  return messages.filter(m => m.user && allowedIds.has(m.user));
}

function extractGithubLinks(text: string | undefined): string[] {
  if (!text) return [];
  const regex = new RegExp('https://github.com/[^>|\\s]+', 'g');
  return [...(text.match(regex) || [])];
}

async function main() {
  const { channel, window, usernames } = parseArgs();
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) fail('Missing SLACK_BOT_TOKEN');

  const seconds = secondsFromWindow(window);
  const latest = Math.floor(Date.now() / 1000);
  const oldest = latest - seconds;

  const channelId = await resolveChannelId(token, channel);
  const idToName = await usersList(token);
  const messages = await fetchHistory(token, channelId, String(oldest), String(latest));
  const filtered = filterByUsers(messages, idToName, usernames);

  const lines: string[] = [];
  lines.push(`Contributor digest for ${usernames.join(', ') || 'all'} in last ${window} (channel ${channel})`);
  const grouped: Record<string, SlackMessage[]> = {};
  for (const m of filtered) {
    const name = idToName[m.user || ''] || m.user || 'user';
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(m);
  }

  for (const [name, msgs] of Object.entries(grouped)) {
    lines.push(`\n# ${name} — ${msgs.length} messages`);
    let ghCount = 0;
    for (const m of msgs) {
      const gh = extractGithubLinks(m.text);
      if (gh.length) ghCount += gh.length;
      lines.push(`- [${m.ts}] ${m.text || ''}`);
      if (gh.length) lines.push(`  GitHub: ${gh.join(', ')}`);
    }
    lines.push(`Total GitHub links: ${ghCount}`);
  }

  console.log(lines.join('\n'));
}

main().catch((err) => {
  console.error(err?.response?.data || err);
  process.exit(1);
});


