import dotenv from 'dotenv';
import path from 'path';
import OpenAI from 'openai';

// Load env from backend/.env, then fall back to repo-root/.env if needed
dotenv.config();
if (!process.env.OPENAI_API_KEY) {
  const rootEnv = path.resolve(process.cwd(), '../.env');
  dotenv.config({ path: rootEnv });
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
    client = new OpenAI({ apiKey });
  }
  return client;
}

type GenerateTextInput = {
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
};

export async function generateText({ system, prompt, temperature = 0.2, maxTokens }: GenerateTextInput): Promise<string> {
  const c = getClient();
  const input = system ? `System:\n${system}\n\nUser:\n${prompt}` : prompt;

  const resp = await c.responses.create({
    model: 'gpt-5',
    input,
    temperature,
    max_output_tokens: maxTokens,
  });

  const text = (resp as any)?.output_text || '';
  return String(text).trim();
}


