import axios, { AxiosInstance } from 'axios';
import type { IntentPacket } from './intentPacket';

export type System1RampPromptStatus = 'requested' | 'processing' | 'success' | 'failed' | string;

export type System1RampPrompt = {
  id: number;
  domain: string;
  marketing_angle: string;
  topic: string;
  target_language: string;
  target_geo: string;
  status: System1RampPromptStatus;
  publication_link: string | null;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
  headline?: string | null;
};

export type System1RampRejectedPrompt = {
  prompt?: Partial<System1RampGeneratePrompt> | null;
  marketing_angle?: string | null;
  topic?: string | null;
  target_language?: string | null;
  target_geo?: string | null;
  headline?: string | null;
  error_message?: string | null;
  errors?: string[] | null;
  reason?: string | null;
  [key: string]: any;
};

export type System1RampGeneratePrompt = {
  marketing_angle: string;
  topic: string;
  target_language: string;
  target_geo: string;
  headline?: string;
};

export type System1RampListResult = {
  prompts: System1RampPrompt[];
  pagination: {
    page: number;
    per_page: number;
    pages: number;
  };
  raw: any;
};

export type System1RampGenerateResult = {
  accepted: System1RampPrompt[];
  rejected: System1RampRejectedPrompt[];
  statusCode: number;
  raw: any;
};

export type System1RampQuota = {
  daily_domain_creations: number | null;
  alltime_domain_creations: number | null;
  daily_content_generations: number | null;
  daily_content_generations_maximum: number | null;
  raw: any;
};

export type IntentPacketRampArticleMode = 'submit_only' | 'wait_for_success';

export type IntentPacketRampArticleConfig = {
  rampArticleEnabled?: boolean | null;
  rampArticleMode?: IntentPacketRampArticleMode | null;
  rampArticleTopic?: string | null;
  rampMarketingAngle?: string | null;
  rampArticleTitle?: string | null;
  rampTargetLanguage?: string | null;
  rampTargetGeo?: string | null;
  rampPollIntervalMs?: number | null;
  rampPollTimeoutMs?: number | null;
};

export type IntentPacketRampArticlePlan = {
  enabled: boolean;
  mode: IntentPacketRampArticleMode;
  domain: string | null;
  apiKeyConfigured: boolean;
  prompt: System1RampGeneratePrompt | null;
  blockers: string[];
  pollIntervalMs: number;
  pollTimeoutMs: number;
};

export type IntentPacketRampArticleExecution = {
  plan: IntentPacketRampArticlePlan;
  quotaBefore: System1RampQuota | null;
  submission: System1RampGenerateResult | null;
  acceptedPrompt: System1RampPrompt | null;
  finalPrompt: System1RampPrompt | null;
};

type System1RampClientOptions = {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
};

function asNonEmptyString(value: any): string | null {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function normalizePrompt(value: any): System1RampPrompt | null {
  const id = Number(value?.id);
  const domain = asNonEmptyString(value?.domain);
  const marketingAngle = asNonEmptyString(value?.marketing_angle);
  const topic = asNonEmptyString(value?.topic);
  const targetLanguage = asNonEmptyString(value?.target_language);
  const targetGeo = asNonEmptyString(value?.target_geo);
  if (!Number.isFinite(id) || !domain || !marketingAngle || !topic || !targetLanguage || !targetGeo) {
    return null;
  }

  return {
    id,
    domain,
    marketing_angle: marketingAngle,
    topic,
    target_language: targetLanguage,
    target_geo: targetGeo,
    status: asNonEmptyString(value?.status) || 'requested',
    publication_link: asNonEmptyString(value?.publication_link),
    error_message: asNonEmptyString(value?.error_message),
    created_at: asNonEmptyString(value?.created_at),
    updated_at: asNonEmptyString(value?.updated_at),
    headline: asNonEmptyString(value?.headline),
  };
}

function coerceNumber(value: any): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeGenerateRejectedPrompt(value: any): System1RampRejectedPrompt {
  if (value && typeof value === 'object') {
    return value;
  }
  return { reason: asNonEmptyString(value) || 'rejected' };
}

function normalizeDomainKey(domain: string): string {
  return String(domain || '').trim().toLowerCase();
}

function domainToEnvSuffix(domain: string): string {
  return normalizeDomainKey(domain).replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').toUpperCase();
}

function clampPromptField(label: string, value: string, maxLength: number, blockers: string[]): string {
  const trimmed = value.trim();
  if (!trimmed) {
    blockers.push(`${label} is required for System1 article generation`);
    return '';
  }
  if (trimmed.length > maxLength) {
    blockers.push(`${label} exceeds System1's ${maxLength}-character limit`);
  }
  return trimmed.slice(0, maxLength);
}

function isValidLanguageCode(value: string): boolean {
  return /^[a-z]{2}$/.test(value);
}

function isValidGeoCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveSystem1RampApiKey(domain: string): string | null {
  const normalizedDomain = normalizeDomainKey(domain);
  if (!normalizedDomain) return null;

  const jsonValue = process.env.SYSTEM1_RAMP_API_KEYS_JSON;
  if (jsonValue) {
    try {
      const parsed = JSON.parse(jsonValue);
      if (parsed && typeof parsed === 'object') {
        const direct = asNonEmptyString((parsed as Record<string, any>)[normalizedDomain]);
        if (direct) return direct;
      }
    } catch (err) {
      throw new Error('SYSTEM1_RAMP_API_KEYS_JSON is not valid JSON');
    }
  }

  const suffix = domainToEnvSuffix(normalizedDomain);
  const domainScoped = asNonEmptyString(process.env[`SYSTEM1_RAMP_API_KEY_${suffix}`]);
  if (domainScoped) return domainScoped;

  return asNonEmptyString(process.env.SYSTEM1_RAMP_API_KEY);
}

export function buildIntentPacketRampArticlePlan(
  packet: IntentPacket,
  config: IntentPacketRampArticleConfig & { domain?: string | null }
): IntentPacketRampArticlePlan {
  const enabled = config.rampArticleEnabled !== false;
  const domain = asNonEmptyString(config.domain || packet.destinationDomain);
  const mode = config.rampArticleMode || 'submit_only';
  const pollIntervalMs = Math.max(2_000, Number(config.rampPollIntervalMs || 10_000));
  const pollTimeoutMs = Math.max(pollIntervalMs, Number(config.rampPollTimeoutMs || 300_000));
  const blockers: string[] = [];

  if (!enabled) {
    return {
      enabled,
      mode,
      domain,
      apiKeyConfigured: Boolean(domain && resolveSystem1RampApiKey(domain)),
      prompt: null,
      blockers,
      pollIntervalMs,
      pollTimeoutMs,
    };
  }

  if (!domain) {
    blockers.push('domain is required for System1 article generation');
  }

  const marketingAngle = clampPromptField(
    'rampMarketingAngle',
    String(config.rampMarketingAngle || packet.article.title || packet.intent.primaryKeyword || ''),
    100,
    blockers
  );
  const topic = clampPromptField(
    'rampArticleTopic',
    String(config.rampArticleTopic || packet.intent.primaryKeyword || ''),
    100,
    blockers
  );
  const targetLanguage = String(config.rampTargetLanguage || 'en').trim().toLowerCase();
  const targetGeo = String(config.rampTargetGeo || packet.market || 'US').trim().toUpperCase();

  if (!isValidLanguageCode(targetLanguage)) {
    blockers.push('rampTargetLanguage must be a lowercase ISO 639-1 code such as en');
  }
  if (!isValidGeoCode(targetGeo)) {
    blockers.push('rampTargetGeo must be an uppercase ISO 3166-1 alpha-2 code such as US');
  }

  const headline = asNonEmptyString(config.rampArticleTitle);
  if (headline && headline.length > 60) {
    blockers.push('rampArticleTitle exceeds the 60-character title limit from the RAMP guide');
  }

  const apiKeyConfigured = Boolean(domain && resolveSystem1RampApiKey(domain));
  if (!apiKeyConfigured) {
    blockers.push(`No System1 RAMP API key is configured for domain ${domain || '<missing-domain>'}`);
  }

  return {
    enabled,
    mode,
    domain,
    apiKeyConfigured,
    prompt: {
      marketing_angle: marketingAngle,
      topic,
      target_language: targetLanguage,
      target_geo: targetGeo,
      ...(headline ? { headline } : {}),
    },
    blockers,
    pollIntervalMs,
    pollTimeoutMs,
  };
}

export function extractArticleSlug(publicationLink: string | null | undefined): string | null {
  const link = asNonEmptyString(publicationLink);
  if (!link) return null;
  try {
    const url = new URL(link);
    const lastPath = url.pathname.split('/').filter(Boolean).pop();
    return asNonEmptyString(lastPath);
  } catch {
    return null;
  }
}

export function buildStrategisRampProperties(result: IntentPacketRampArticleExecution): Record<string, any> {
  const prompt = result.finalPrompt || result.acceptedPrompt;
  const promptPayload = result.plan.prompt;
  return {
    rampArticleEnabled: result.plan.enabled,
    rampArticleMode: result.plan.mode,
    rampArticleDomain: result.plan.domain,
    rampArticlePromptId: prompt?.id || null,
    rampArticleStatus: prompt?.status || null,
    rampArticlePublicationLink: prompt?.publication_link || null,
    rampArticleErrorMessage: prompt?.error_message || null,
    rampArticleTopic: promptPayload?.topic || null,
    rampMarketingAngle: promptPayload?.marketing_angle || null,
    rampArticleTargetLanguage: promptPayload?.target_language || null,
    rampArticleTargetGeo: promptPayload?.target_geo || null,
    rampArticleHeadline: promptPayload?.headline || null,
    rampArticleRequestedAt: prompt?.created_at || null,
  };
}

export class System1RampClient {
  private readonly http: AxiosInstance;

  constructor(private readonly opts: System1RampClientOptions) {
    this.http = axios.create({
      baseURL: (opts.baseUrl || process.env.SYSTEM1_RAMP_BASE_URL || 'https://api.system1.com').replace(/\/$/, ''),
      timeout: Number(opts.timeoutMs || process.env.SYSTEM1_RAMP_TIMEOUT_MS || 60_000),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': opts.apiKey,
      },
      validateStatus: (status) => status >= 200 && status < 300,
    });
  }

  async getQuota(): Promise<System1RampQuota> {
    const resp = await this.http.get('/v1/quota');
    return {
      daily_domain_creations: coerceNumber(resp.data?.daily_domain_creations),
      alltime_domain_creations: coerceNumber(resp.data?.alltime_domain_creations),
      daily_content_generations: coerceNumber(resp.data?.daily_content_generations),
      daily_content_generations_maximum: coerceNumber(resp.data?.daily_content_generations_maximum),
      raw: resp.data,
    };
  }

  async listPrompts(page = 1, perPage = 20): Promise<System1RampListResult> {
    const resp = await this.http.get('/v1/content-generation/list', {
      params: {
        page,
        per_page: perPage,
      },
    });

    const data = resp.data || {};
    const prompts = [
      ...toArray(data.prompts).map(normalizePrompt),
      ...toArray(data.content_generation_prompts).map(normalizePrompt),
    ].filter((value): value is System1RampPrompt => Boolean(value));

    const pagination = data.pagination && typeof data.pagination === 'object'
      ? data.pagination
      : {
          page: data.page,
          per_page: data.per_page,
          pages: data.pages,
        };

    return {
      prompts,
      pagination: {
        page: Math.max(1, Number(pagination?.page || page)),
        per_page: Math.max(1, Number(pagination?.per_page || perPage)),
        pages: Math.max(1, Number(pagination?.pages || 1)),
      },
      raw: data,
    };
  }

  async generatePrompts(prompts: System1RampGeneratePrompt[]): Promise<System1RampGenerateResult> {
    const resp = await this.http.post('/v1/content-generation/generate', { prompts });
    const data = resp.data || {};
    const accepted = [
      normalizePrompt(data.prompt),
      ...toArray(data.prompts_accepted).map(normalizePrompt),
    ].filter((value): value is System1RampPrompt => Boolean(value));
    const rejected = toArray(data.prompts_rejected).map(normalizeGenerateRejectedPrompt);

    return {
      accepted,
      rejected,
      statusCode: resp.status,
      raw: data,
    };
  }

  async waitForPrompt(promptId: number, opts?: { pollIntervalMs?: number; timeoutMs?: number }): Promise<System1RampPrompt> {
    const pollIntervalMs = Math.max(2_000, Number(opts?.pollIntervalMs || 10_000));
    const timeoutMs = Math.max(pollIntervalMs, Number(opts?.timeoutMs || 300_000));
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      const page = await this.listPrompts(1, 50);
      const prompt = page.prompts.find((item) => item.id === promptId);
      if (prompt && (prompt.status === 'success' || prompt.status === 'failed')) {
        return prompt;
      }
      if (prompt) {
        await sleep(pollIntervalMs);
        continue;
      }
      await sleep(pollIntervalMs);
    }

    throw new Error(`Timed out waiting for System1 prompt ${promptId} to reach a terminal status`);
  }
}

export async function submitIntentPacketRampArticle(
  packet: IntentPacket,
  config: IntentPacketRampArticleConfig & { domain?: string | null }
): Promise<IntentPacketRampArticleExecution> {
  const plan = buildIntentPacketRampArticlePlan(packet, config);
  if (!plan.enabled) {
    return {
      plan,
      quotaBefore: null,
      submission: null,
      acceptedPrompt: null,
      finalPrompt: null,
    };
  }
  if (plan.blockers.length || !plan.domain || !plan.prompt) {
    throw new Error(`System1 article generation blocked: ${plan.blockers.join('; ')}`);
  }

  const apiKey = resolveSystem1RampApiKey(plan.domain);
  if (!apiKey) {
    throw new Error(`No System1 RAMP API key is configured for domain ${plan.domain}`);
  }

  const client = new System1RampClient({ apiKey });
  const quotaBefore = await client.getQuota();
  const currentUsage = quotaBefore.daily_content_generations;
  const maxUsage = quotaBefore.daily_content_generations_maximum;
  if (currentUsage !== null && maxUsage !== null && currentUsage >= maxUsage) {
    throw new Error(`System1 daily content-generation quota is exhausted for ${plan.domain} (${currentUsage}/${maxUsage})`);
  }

  const submission = await client.generatePrompts([plan.prompt]);
  if (submission.rejected.length) {
    const reasons = submission.rejected
      .map((item) => asNonEmptyString(item.error_message) || asNonEmptyString(item.reason) || toArray(item.errors).join(', '))
      .filter(Boolean);
    throw new Error(`System1 rejected the article prompt${reasons.length ? `: ${reasons.join('; ')}` : ''}`);
  }

  const acceptedPrompt = submission.accepted[0] || null;
  if (!acceptedPrompt) {
    throw new Error('System1 accepted the request but did not return an accepted prompt payload');
  }

  const finalPrompt =
    plan.mode === 'wait_for_success'
      ? await client.waitForPrompt(acceptedPrompt.id, {
          pollIntervalMs: plan.pollIntervalMs,
          timeoutMs: plan.pollTimeoutMs,
        })
      : null;

  if (finalPrompt?.status === 'failed') {
    throw new Error(`System1 article generation failed: ${finalPrompt.error_message || 'unknown failure'}`);
  }

  return {
    plan,
    quotaBefore,
    submission,
    acceptedPrompt,
    finalPrompt,
  };
}
