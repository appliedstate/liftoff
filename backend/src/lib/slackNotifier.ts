import axios from 'axios';

function requireSlackToken(): string {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error('Missing SLACK_BOT_TOKEN in environment.');
  }
  return token;
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
    if (!res.data.ok) {
      throw new Error(`Slack error (conversations.list): ${res.data.error}`);
    }
    const found = (res.data.channels as any[]).find((channel) => channel.name === name);
    if (found) return found.id as string;
    cursor = res.data.response_metadata?.next_cursor || undefined;
  } while (cursor);
  throw new Error(`Slack channel not found: ${input}`);
}

export async function postSlackMessage(input: {
  channel: string;
  text: string;
  blocks?: any[];
}): Promise<{ channelId: string; ts: string }> {
  const token = requireSlackToken();
  const channelId = await resolveChannelId(token, input.channel);

  const res: any = await axios.post(
    'https://slack.com/api/chat.postMessage',
    {
      channel: channelId,
      text: input.text,
      blocks: input.blocks,
      unfurl_links: false,
      unfurl_media: false,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.data.ok) {
    throw new Error(`Slack error (chat.postMessage): ${res.data.error}`);
  }

  return {
    channelId,
    ts: String(res.data.ts),
  };
}
