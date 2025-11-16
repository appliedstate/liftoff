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
    if (!apiKey) {
      throw new Error('Missing OPENAI_API_KEY');
    }
    // Limit request time so Cloudflare’s 100s timeout doesn’t kill long LLM calls with 524
    client = new OpenAI({
      apiKey,
      timeout: 30000, // 30 seconds
    });
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

  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  // Some models error on temperature; send only when defined and supported
  const base: any = { model, input };
  if (typeof temperature === 'number' && !/^gpt-5($|-)/.test(model)) base.temperature = temperature;
  if (typeof maxTokens === 'number') base.max_output_tokens = maxTokens;

  let resp;
  try {
    resp = await c.responses.create(base);
  } catch (e: any) {
    // Retry without temperature if model rejects it
    if (base.temperature) {
      delete base.temperature;
      resp = await c.responses.create(base);
    } else {
      throw e;
    }
  }

  const text = (resp as any)?.output_text || '';
  return String(text).trim();
}


