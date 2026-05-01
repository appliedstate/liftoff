/**
 * Campaign Factory API Routes
 * 
 * REST endpoints for campaign creation and management
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { StrategisCampaignSchema, StrategisClient, StrategisSchemaProperty } from '../services/strategisClient';
import { StrategisFacebookClient } from '../services/strategisFacebookClient';
import { CampaignFactory, CampaignPlan } from '../services/campaignFactory';
import { getPgPool } from '../lib/pg';
import { buildBenShellSelectorCatalog } from '../lib/benShellSelectorCatalog';
import { CampaignShellProfileReport } from '../lib/campaignShellProfilesCompat';
import { FacebookSettingsProfileReport } from '../lib/facebookSettingsProfilesCompat';
import { findCampaignDetailsSnapshot, loadBenArticleCatalogFromSnapshot } from '../lib/benArticleCatalog';
import { loadBenCampaignCatalog } from '../lib/benCampaignCatalog';
import { buildFallbackFacebookSettingsProfileReport } from '../lib/facebookSettingsProfilesFallback';
import { CampaignShellExportRow } from '../lib/campaignShellProfiles';
import { getSafariStrategisAuthToken } from '../lib/safariStrategisAuth';
import { LincxProxyFacebookClient } from '../services/lincxProxyFacebookClient';
import { cloneFacebookShellWithCreative } from '../services/facebookCloneCreativeLauncher';
import { buildBuyerLaunchIntelligence } from '../lib/buyerLaunchIntelligence';

const router = express.Router();
const strategisWriteBaseUrl =
  process.env.STRATEGIS_API_BASE_URL ||
  process.env.STRATEGIS_WRITE_BASE_URL ||
  'https://strategis.lincx.in';

function buildCampaignFactory(authToken?: string) {
  const strategisClient = new StrategisClient({
    baseUrl: strategisWriteBaseUrl,
    authToken,
    apiKey: process.env.STRATEGIS_API_KEY,
  });

  const strategisFacebookClient = new StrategisFacebookClient({
    baseUrl: strategisWriteBaseUrl,
    authToken,
    apiKey: process.env.STRATEGIS_API_KEY,
  });

  return new CampaignFactory(strategisClient, strategisFacebookClient);
}

function buildLincxProxyFacebookClient(authToken?: string) {
  return new LincxProxyFacebookClient({
    baseUrl: strategisWriteBaseUrl,
    authToken,
  });
}

type BenShellSetupMode = 'strategis' | 'facebook' | 'both';

type BenShellSetupRequest = {
  dryRun?: boolean;
  mode: BenShellSetupMode;
  buyer?: string;
  category: string;
  article: string;
  headline: string;
  forcekeys: string[];
  strategist: {
    rsocSite: string;
    subdirectory?: string;
    templateId: string;
    redirectDomain?: string;
    language?: string;
    networkAccountId?: string;
    namingFamilyHint?: string;
  };
  facebook: {
    adAccountId: string;
    pageId?: string;
    pixelId?: string;
    objective?: string;
    customEventType?: string;
    bidStrategy?: string;
    bidAmount?: string | number;
    budgetPerAdSet?: string;
    targeting: Record<string, any>;
    creativeMode?: 'inherit' | 'image_url' | 'video_url';
    creativeAssetUrl?: string;
    creativePrimaryText?: string;
    creativeDescription?: string;
    creativeCallToActionType?: string;
  };
  cloneSource?: {
    campaignId?: string;
    campaignName?: string;
  } | null;
};

type ReadinessCheck = {
  label: string;
  ok: boolean;
  detail?: string;
};

type DryRunResult = {
  mode: BenShellSetupMode;
  dryRun: true;
  runtime: {
    launchHistoryAvailable: boolean;
    notes: string[];
  };
  readiness: {
    strategis: { ready: boolean; checks: ReadinessCheck[] };
    facebook: { ready: boolean; checks: ReadinessCheck[] };
    both: { ready: boolean; checks: ReadinessCheck[] };
  };
  duplicateRisk: {
    level: 'none' | 'possible' | 'unknown';
    matches: Array<{
      requestId: string;
      campaignName: string;
      createdAt: string;
      status: string | null;
    }>;
    notes: string[];
  };
  operations: Array<{
    step: string;
    system: 'Strategis' | 'Facebook';
    method: string;
    target: string;
    purpose: string;
  }>;
  preview: {
    buyer: string;
    category: string;
    strategis: {
      organization: string;
      campaignName: string;
      templateId: string;
      rsocSite: string;
      article: string;
      headline: string;
      forcekeys: string[];
      routeUrlPreview: string | null;
    };
    facebook: {
      sourceCampaignId: string | null;
      sourceFacebookCampaignId: string | null;
      targetCampaignName: string | null;
      targetAdName: string | null;
      destinationUrl: string | null;
      creativeMode: 'inherit' | 'image_url' | 'video_url';
      creativeAssetUrl: string | null;
    };
  };
  warnings: string[];
};

type VerificationCheck = {
  label: string;
  ok: boolean;
  detail?: string;
};

type LaunchVerification = {
  strategis?: {
    ready: boolean;
    checks: VerificationCheck[];
  };
  facebook?: {
    ready: boolean;
    checks: VerificationCheck[];
  };
};

type VerificationSummary = {
  ready: boolean;
  checks: VerificationCheck[];
};

function latestBuyerJsonFileInDir(dir: string, buyerSlug: string, filename: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.toLowerCase().startsWith(buyerSlug.toLowerCase()))
    .map((entry) => {
      const fullPath = path.join(dir, entry.name, filename);
      if (!fs.existsSync(fullPath)) return null;
      return {
        path: fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .filter(Boolean) as Array<{ path: string; mtimeMs: number }>;
  entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return entries[0]?.path || null;
}

function loadBenShellCatalog(buyer = 'Ben') {
  const normalizedBuyer = buyer.toLowerCase();
  const generatedCatalogPath = path.join(
    process.cwd(),
    '.local',
    'strategis',
    'ben-shell-selector-catalog',
    `${normalizedBuyer}-live`,
    'catalog.json'
  );

  if (fs.existsSync(generatedCatalogPath)) {
    return JSON.parse(fs.readFileSync(generatedCatalogPath, 'utf8'));
  }

  const shellReportPath =
    [
      path.join(
        process.cwd(),
        '.local',
        'strategis',
        'campaign-shell-profiles',
        `${normalizedBuyer}-live`,
        'report.json'
      ),
      latestBuyerJsonFileInDir(
        path.join(process.cwd(), '.local', 'strategis', 'campaign-shell-profiles'),
        normalizedBuyer,
        'report.json'
      ),
    ].find((candidate): candidate is string => Boolean(candidate && fs.existsSync(candidate))) || null;

  const facebookReportPath =
    [
      path.join(
        process.cwd(),
        '.local',
        'strategis',
        'facebook-settings-profiles',
        `${normalizedBuyer}-live`,
        'report.json'
      ),
      latestBuyerJsonFileInDir(
        path.join(process.cwd(), '.local', 'strategis', 'facebook-settings-profiles'),
        normalizedBuyer,
        'report.json'
      ),
    ].find((candidate): candidate is string => Boolean(candidate && fs.existsSync(candidate))) || null;

  if (!shellReportPath) {
    throw new Error(`${buyer} shell selector catalog is not available yet`);
  }

  const shellReport = JSON.parse(fs.readFileSync(shellReportPath, 'utf8')) as CampaignShellProfileReport;
  const snapshotPath = findCampaignDetailsSnapshot(buyer);
  const facebookReport = facebookReportPath
    ? (JSON.parse(fs.readFileSync(facebookReportPath, 'utf8')) as FacebookSettingsProfileReport)
    : snapshotPath
      ? buildFallbackFacebookSettingsProfileReport({
          buyer,
          strategisRows: JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as CampaignShellExportRow[],
        })
      : null;

  if (!facebookReport) {
    throw new Error(`${buyer} Facebook settings profile is not available yet`);
  }

  return buildBenShellSelectorCatalog({
    shellReport,
    facebookReport,
  });
}

function normalizeAdAccountId(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

function slugToken(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function normalizeStrategisArticleValue(article: string, rsocSite: string, subdirectory?: string): string {
  const raw = String(article || '').trim();
  if (!raw) return raw;
  if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+|\/+$/g, '');

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./i, '');
    const expectedHost = String(rsocSite || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/g, '');
    if (!expectedHost || host !== expectedHost) {
      return raw;
    }
    const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    const normalizedSubdirectory = String(subdirectory || '').trim().replace(/^\/+|\/+$/g, '');
    if (normalizedSubdirectory && parts[0] === normalizedSubdirectory) {
      return parts.slice(1).join('/') || raw;
    }
    return parts.join('/') || raw;
  } catch {
    return raw;
  }
}

function cloneNameWithSuffix(name: string) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${name}_clone_${stamp}`;
}

function derivePublishedArticleUrl(article: string, rsocSite: string, subdirectory?: string): string | null {
  const raw = String(article || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const site = String(rsocSite || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/g, '');
  if (!site) return null;
  const normalizedArticle = raw.replace(/^\/+|\/+$/g, '');
  const normalizedSubdirectory = String(subdirectory || '').trim().replace(/^\/+|\/+$/g, '');
  return normalizedSubdirectory
    ? `https://${site}/${normalizedSubdirectory}/${normalizedArticle}`
    : `https://${site}/${normalizedArticle}`;
}

function buildLaunchClientRequestKey(args: {
  buyer: string;
  mode: BenShellSetupMode;
  cloneSourceCampaignId?: string | null;
  article: string;
  headline: string;
  adAccountId: string;
  creativeMode?: string | null;
}) {
  const raw = [
    args.buyer.trim().toLowerCase(),
    args.mode.trim().toLowerCase(),
    String(args.cloneSourceCampaignId || '').trim().toLowerCase(),
    args.article.trim().toLowerCase(),
    args.headline.trim().toLowerCase(),
    args.adAccountId.trim().toLowerCase(),
    String(args.creativeMode || '').trim().toLowerCase(),
  ].join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function toReadiness(checks: ReadinessCheck[]) {
  return {
    ready: checks.every((check) => check.ok),
    checks,
  };
}

async function persistLaunchArtifacts(args: {
  plan: CampaignPlan;
  requestId: string;
  campaignName: string;
  adSetNames: string[];
  mode: BenShellSetupMode;
  strategisCampaignIds: string[];
  trackingUrls: string[];
  facebookCampaignId?: string | null;
  facebookAdSetIds?: string[];
  facebookCreativeIds?: string[];
  facebookAdIds?: string[];
  status: string;
  step: string;
  clientRequestKey?: string | null;
}) {
  const pool = getPgPool();
  const planResult = await pool.query(
    `INSERT INTO campaign_plans (
      request_id, brand, objective, hook_set_id, market, channel, date, category,
      ad_account_id, organization, domain, destination, strategis_template_id,
      campaign_name, ad_set_names, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING id`,
    [
      args.requestId,
      args.plan.brand,
      args.plan.objective,
      args.plan.hookSetId,
      args.plan.market,
      args.plan.channel,
      args.plan.date,
      args.plan.category,
      args.plan.adAccountId,
      args.plan.organization,
      args.plan.domain,
      args.plan.destination,
      args.plan.strategisTemplateId || null,
      args.campaignName,
      args.adSetNames,
      args.status,
    ]
  );
  const campaignPlanId = planResult.rows[0].id;

  const mappingResult = await pool.query(
    `INSERT INTO campaign_mappings (
      campaign_plan_id, request_id, strategis_template_id,
      strategis_campaign_ids, facebook_campaign_id, facebook_ad_set_ids,
      facebook_creative_ids, facebook_ad_ids, tracking_urls, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id`,
    [
      campaignPlanId,
      args.requestId,
      args.plan.strategisTemplateId || null,
      args.strategisCampaignIds,
      args.facebookCampaignId || null,
      args.facebookAdSetIds || [],
      args.facebookCreativeIds || [],
      args.facebookAdIds || [],
      args.trackingUrls,
      args.status,
    ]
  );
  const campaignMappingId = mappingResult.rows[0].id;

  await pool.query(
    `INSERT INTO campaign_requests (
      request_id, client_request_key, campaign_plan_id, campaign_mapping_id, status, step
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (request_id) DO UPDATE SET
      client_request_key = COALESCE(EXCLUDED.client_request_key, campaign_requests.client_request_key),
      campaign_plan_id = EXCLUDED.campaign_plan_id,
      campaign_mapping_id = EXCLUDED.campaign_mapping_id,
      status = EXCLUDED.status,
      step = EXCLUDED.step,
      updated_at = NOW()`,
    [args.requestId, args.clientRequestKey || null, campaignPlanId, campaignMappingId, args.status, args.step]
  );

  return {
    mappingStored: true,
    mappingId: campaignMappingId as string,
    campaignPlanId: campaignPlanId as string,
  };
}

async function safePersistLaunchArtifacts(
  args: Parameters<typeof persistLaunchArtifacts>[0]
): Promise<{ mappingStored: boolean; mappingId: string | null; warnings: string[] }> {
  try {
    const stored = await persistLaunchArtifacts(args);
    return {
      mappingStored: stored.mappingStored,
      mappingId: stored.mappingId,
      warnings: [],
    };
  } catch (error) {
    return {
      mappingStored: false,
      mappingId: null,
      warnings: [
        `Launch succeeded, but history persistence failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }
}

async function detectRecentDuplicateRisk(args: {
  buyer: string;
  campaignName: string;
  clientRequestKey: string;
}): Promise<DryRunResult['duplicateRisk']> {
  if (!process.env.PGVECTOR_URL) {
    return {
      level: 'unknown',
      matches: [],
      notes: ['Duplicate detection is unavailable because PGVECTOR_URL is not configured in this runtime.'],
    };
  }

  try {
    const pool = getPgPool();
    const result = await pool.query(
      `SELECT
        cp.request_id,
        cp.campaign_name,
        cp.created_at,
        cr.status AS request_status,
        cr.client_request_key
      FROM campaign_plans cp
      LEFT JOIN campaign_requests cr ON cr.request_id = cp.request_id
      WHERE cp.brand = $1
        AND (
          cp.campaign_name = $2
          OR cr.client_request_key = $3
        )
      ORDER BY cp.created_at DESC
      LIMIT 5`,
      [args.buyer, args.campaignName, args.clientRequestKey]
    );
    const matches = result.rows.map((row) => ({
      requestId: String(row.request_id || ''),
      campaignName: String(row.campaign_name || ''),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ''),
      status: String(row.request_status || '').trim() || null,
    }));
    return {
      level: matches.length ? 'possible' : 'none',
      matches,
      notes: matches.length
        ? ['A recent launch has the same campaign name or launch fingerprint. Review before creating another one.']
        : [],
    };
  } catch (error) {
    return {
      level: 'unknown',
      matches: [],
      notes: [
        `Duplicate detection failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

async function verifyStrategisArtifacts(
  strategisClient: StrategisClient,
  campaignIds: string[],
  expected: {
    templateId?: string;
    article?: string;
    headline?: string;
  }
): Promise<VerificationSummary> {
  const checks: VerificationCheck[] = [];
  for (const campaignId of campaignIds) {
    const campaign = await strategisClient.getCampaign(campaignId);
    checks.push({
      label: `Strategis campaign ${campaignId} exists`,
      ok: Boolean(campaign?.id),
    });
    if (expected.templateId) {
      checks.push({
        label: `Strategis template matches for ${campaignId}`,
        ok: String((campaign as any)?.template?.id || '').trim() === expected.templateId,
        detail: String((campaign as any)?.template?.id || '').trim()
          ? `Found ${(campaign as any).template.id}`
          : 'No template id returned',
      });
    }
    if (expected.article) {
      checks.push({
        label: `Strategis article matches for ${campaignId}`,
        ok: String((campaign as any)?.properties?.article || '').trim() === expected.article,
      });
    }
    if (expected.headline) {
      checks.push({
        label: `Strategis headline matches for ${campaignId}`,
        ok: String((campaign as any)?.properties?.headline || '').trim() === expected.headline,
      });
    }
  }
  return {
    ready: checks.every((check) => check.ok),
    checks,
  };
}

async function verifyFacebookArtifacts(
  client: LincxProxyFacebookClient,
  args: {
    organization: string;
    adAccountId: string;
    campaignId?: string | null;
    adSetIds?: string[];
    adId?: string | null;
    creativeId?: string | null;
  }
): Promise<VerificationSummary> {
  const checks: VerificationCheck[] = [];

  if (args.campaignId) {
    const campaigns = await client.listCampaigns({
      organization: args.organization,
      adAccountId: args.adAccountId,
      fields: 'id,name,status,effective_status,account_id',
    });
    const campaign = campaigns.find((row) => String(row?.id || '').trim() === args.campaignId);
    checks.push({
      label: `Facebook campaign ${args.campaignId} exists`,
      ok: Boolean(campaign),
    });
    checks.push({
      label: `Facebook campaign ${args.campaignId} paused`,
      ok: ['PAUSED', 'ACTIVE'].includes(String(campaign?.effective_status || campaign?.status || '').toUpperCase()),
      detail: String(campaign?.effective_status || campaign?.status || '').trim() || 'No status returned',
    });
  }

  if (args.adSetIds?.length) {
    const adsets = await client.listAdSets({
      organization: args.organization,
      adAccountId: args.adAccountId,
      fields: 'id,name,status,effective_status,campaign_id,account_id',
    });
    for (const adSetId of args.adSetIds) {
      const adset = adsets.find((row) => String(row?.id || '').trim() === adSetId);
      checks.push({
        label: `Facebook ad set ${adSetId} exists`,
        ok: Boolean(adset),
      });
    }
  }

  if (args.adId) {
    const ads = await client.listAds({
      organization: args.organization,
      adAccountId: args.adAccountId,
      fields:
        'id,name,status,effective_status,campaign_id,adset_id,account_id,creative{id,name}',
    });
    const ad = ads.find((row) => String(row?.id || '').trim() === args.adId);
    checks.push({
      label: `Facebook ad ${args.adId} exists`,
      ok: Boolean(ad),
    });
    if (args.creativeId) {
      checks.push({
        label: `Facebook ad ${args.adId} points to creative ${args.creativeId}`,
        ok: String(ad?.creative?.id || '').trim() === args.creativeId,
      });
    }
  }

  if (args.creativeId) {
    const creative = await client.getObject(
      args.organization,
      args.creativeId,
      'id,name,title,body,effective_object_story_id,object_story_spec'
    );
    checks.push({
      label: `Facebook creative ${args.creativeId} exists`,
      ok: Boolean(String(creative?.id || '').trim()),
    });
  }

  return {
    ready: checks.every((check) => check.ok),
    checks,
  };
}

function getCampaignSchemaProperties(schema: StrategisCampaignSchema | null | undefined): Record<string, StrategisSchemaProperty> {
  return (schema?.properties?.properties as any)?.properties || {};
}

function getCampaignSchemaProperty(
  schema: StrategisCampaignSchema | null | undefined,
  key: string
): StrategisSchemaProperty | null {
  return getCampaignSchemaProperties(schema)[key] || null;
}

function schemaEnumEntries(property: StrategisSchemaProperty | null | undefined): unknown[] {
  return Array.isArray(property?.enum) ? property!.enum : [];
}

function schemaEnumCandidateStrings(entry: unknown): string[] {
  if (entry === null || entry === undefined) return [];
  if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
    return [String(entry).trim()];
  }
  if (typeof entry === 'object') {
    const obj = entry as Record<string, unknown>;
    return ['id', 'value', 'key', 'name', 'domain']
      .map((key) => String(obj[key] || '').trim())
      .filter(Boolean);
  }
  return [];
}

function findSchemaEnumEntry(
  property: StrategisSchemaProperty | null | undefined,
  rawValue: unknown
): unknown | null {
  const value = String(rawValue || '').trim();
  if (!value) return null;
  return schemaEnumEntries(property).find((entry) => schemaEnumCandidateStrings(entry).includes(value)) || null;
}

function firstSchemaEnumScalar(property: StrategisSchemaProperty | null | undefined): string | null {
  const first = schemaEnumEntries(property)[0];
  if (typeof first === 'string' || typeof first === 'number' || typeof first === 'boolean') {
    return String(first).trim();
  }
  return null;
}

function normalizePlanAgainstStrategisSchema(
  plan: CampaignPlan,
  schema: StrategisCampaignSchema,
  opts: { strict?: boolean; dropInvalidFbPage?: boolean } = {}
): { plan: CampaignPlan; warnings: string[] } {
  const warnings: string[] = [];
  const strict = opts.strict !== false;
  const dropInvalidFbPage = opts.dropInvalidFbPage === true;
  const properties: Record<string, any> = {
    buyer: plan.brand,
    networkName: 'facebook',
    networkAccountId: plan.adAccountId,
    destination: plan.destination,
    domain: plan.domain,
    article: plan.article,
    fbPage: plan.fbPage,
    fbAdAccount: plan.adAccountId.replace('act_', ''),
    templateId: plan.strategisTemplateId,
    ...(plan.strategisProperties || {}),
  };
  const nextPlan: CampaignPlan = {
    ...plan,
    strategisProperties: properties,
  };

  const validateExactEnum = (field: string, rawValue: unknown, label = field) => {
    const property = getCampaignSchemaProperty(schema, field);
    if (!schemaEnumEntries(property).length) return;
    if (!findSchemaEnumEntry(property, rawValue)) {
      if (strict) {
        throw new Error(`Strategis schema rejected ${label} "${String(rawValue || '').trim()}" for organization ${plan.organization}.`);
      }
      warnings.push(`Strategis schema would reject ${label} "${String(rawValue || '').trim()}".`);
    }
  };

  validateExactEnum('buyer', properties.buyer, 'buyer');
  validateExactEnum('networkName', properties.networkName, 'networkName');
  validateExactEnum('destination', properties.destination, 'destination');
  validateExactEnum('language', properties.language, 'language');
  validateExactEnum('country', properties.country, 'country');

  const rsocSiteProperty = getCampaignSchemaProperty(schema, 'rsocSite');
  if (schemaEnumEntries(rsocSiteProperty).length && !findSchemaEnumEntry(rsocSiteProperty, properties.rsocSite)) {
    if (strict) {
      throw new Error(`Strategis schema rejected rsocSite "${String(properties.rsocSite || '').trim()}".`);
    }
    warnings.push(`Strategis schema would reject rsocSite "${String(properties.rsocSite || '').trim()}".`);
  }

  const fbAdAccountProperty = getCampaignSchemaProperty(schema, 'fbAdAccount');
  if (schemaEnumEntries(fbAdAccountProperty).length && !findSchemaEnumEntry(fbAdAccountProperty, properties.fbAdAccount)) {
    if (strict) {
      throw new Error(`Strategis schema rejected fbAdAccount "${String(properties.fbAdAccount || '').trim()}".`);
    }
    warnings.push(`Strategis schema would reject fbAdAccount "${String(properties.fbAdAccount || '').trim()}".`);
  }

  const fbPageProperty = getCampaignSchemaProperty(schema, 'fbPage');
  if (String(properties.fbPage || '').trim() && schemaEnumEntries(fbPageProperty).length && !findSchemaEnumEntry(fbPageProperty, properties.fbPage)) {
    if (dropInvalidFbPage) {
      warnings.push(
        `Dropping fbPage "${String(properties.fbPage || '').trim()}" from the Strategis shell because the current schema does not allow it.`
      );
      delete properties.fbPage;
      delete nextPlan.fbPage;
    } else if (strict) {
      throw new Error(`Strategis schema rejected fbPage "${String(properties.fbPage || '').trim()}".`);
    } else {
      warnings.push(`Strategis schema would reject fbPage "${String(properties.fbPage || '').trim()}".`);
    }
  }

  const networkAccountProperty = getCampaignSchemaProperty(schema, 'networkAccountId');
  if (schemaEnumEntries(networkAccountProperty).length && !findSchemaEnumEntry(networkAccountProperty, properties.networkAccountId)) {
    const fallback = firstSchemaEnumScalar(networkAccountProperty);
    if (!fallback) {
      if (strict) {
        throw new Error(`Strategis schema rejected networkAccountId "${String(properties.networkAccountId || '').trim()}".`);
      }
      warnings.push(`Strategis schema would reject networkAccountId "${String(properties.networkAccountId || '').trim()}".`);
      return { plan: nextPlan, warnings };
    }
    warnings.push(
      `networkAccountId "${String(properties.networkAccountId || '').trim()}" is not valid for Strategis create; using schema-approved "${fallback}" instead.`
    );
    properties.networkAccountId = fallback;
  }

  return { plan: nextPlan, warnings };
}

function buildBenShellCampaignPlan(body: BenShellSetupRequest): CampaignPlan {
  const today = new Date().toISOString().slice(0, 10);
  const categoryLeaf = body.category.split(' > ').slice(-1)[0] || body.category;
  const normalizedArticle = normalizeStrategisArticleValue(
    body.article,
    body.strategist.rsocSite,
    body.strategist.subdirectory
  );
  const articleToken = slugToken(normalizedArticle.split('/').pop() || normalizedArticle || categoryLeaf);
  const buyer = String(body.buyer || 'Ben').trim() || 'Ben';
  const cloneCampaignName = String(body.cloneSource?.campaignName || '').trim() || null;
  const campaignNameOverride = cloneCampaignName ? cloneNameWithSuffix(cloneCampaignName) : undefined;
  const adSetNameOverride = cloneCampaignName
    ? `${cloneNameWithSuffix(cloneCampaignName)} | shell | ABO | v1`
    : `${slugToken(categoryLeaf) || 'campaign'} | shell | PURCHASE | ABO | v1`;

  const forcekeyMap = Object.fromEntries(
    body.forcekeys
      .map((value, index) => [String.fromCharCode(65 + index), String(value || '').trim()] as const)
      .filter(([, value]) => Boolean(value))
      .map(([slot, value]) => [`forcekey${slot}`, value])
  );

  return {
    brand: buyer,
    objective: 'CONVERSIONS',
    hookSetId: cloneCampaignName
      ? `clone_${slugToken(body.cloneSource?.campaignId || cloneCampaignName)}_${today.replace(/-/g, '')}`
      : `${slugToken(buyer)}_${slugToken(categoryLeaf)}_${articleToken}_${today.replace(/-/g, '')}`,
    market: 'US',
    channel: 'FB',
    date: today,
    category: body.category,
    adAccountId: normalizeAdAccountId(body.facebook.adAccountId),
    organization: 'Interlincx',
    domain: body.strategist.rsocSite,
    destination: 'S1',
    strategisTemplateId: body.strategist.templateId,
    strategisCloneSourceId: body.cloneSource?.campaignId || undefined,
    article: body.article,
    fbPage: body.facebook.pageId,
    redirectDomain: body.strategist.redirectDomain,
    campaignNameOverride,
    adSetNamesOverride: [adSetNameOverride],
    strategisProperties: {
      buyer: buyer.toLowerCase(),
      networkName: 'facebook',
      country: 'US - United States of America',
      language: body.strategist.language || 'EN - English',
      rsocSite: body.strategist.rsocSite,
      subdirectory: body.strategist.subdirectory || '',
      headline: body.headline,
      article: normalizedArticle,
      fbAdAccount: normalizeAdAccountId(body.facebook.adAccountId).replace('act_', ''),
      networkAccountId: body.strategist.networkAccountId || normalizeAdAccountId(body.facebook.adAccountId),
      redirectDomain: body.strategist.redirectDomain || '',
      namingFamilyHint: body.strategist.namingFamilyHint || '',
      ...forcekeyMap,
    },
    adSets: [
      {
        audienceKey: cloneCampaignName ? 'clone' : 'shell',
        placementKey: 'manual_workbench',
        optimizationEvent: 'PURCHASE',
        budgetType: 'ABO',
        version: 1,
        targeting: body.facebook.targeting || {},
        promotedObject: body.facebook.pixelId
          ? {
              pixelId: body.facebook.pixelId,
              customEventType: body.facebook.customEventType || 'LEAD',
            }
          : undefined,
        dailyBudget: String(body.facebook.budgetPerAdSet || '').trim() || undefined,
        bidStrategy: String(body.facebook.bidStrategy || '').trim() || 'LOWEST_COST_WITHOUT_CAP',
      },
    ],
  };
}

router.get('/ben-shell-catalog', async (req, res) => {
  try {
    const buyer = String(req.query.buyer || 'Ben').trim() || 'Ben';
    const catalog = loadBenShellCatalog(buyer);
    res.json(catalog);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load buyer shell selector catalog',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/ben-article-catalog', async (req, res) => {
  try {
    const buyer = String(req.query.buyer || 'Ben').trim() || 'Ben';
    const catalog = loadBenArticleCatalogFromSnapshot(buyer);
    res.json(catalog);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load buyer article catalog',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/ben-campaign-catalog', async (req, res) => {
  try {
    const buyer = String(req.query.buyer || 'Ben').trim() || 'Ben';
    const organization = String(req.query.organization || 'Interlincx').trim() || 'Interlincx';
    const authToken = String(req.query.authToken || '').trim() || null;
    const catalog = await loadBenCampaignCatalog({
      buyer,
      organization,
      authToken,
    });
    res.json(catalog);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load buyer campaign catalog',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/strategis-bootstrap', async (req, res) => {
  try {
    const authToken =
      String(req.headers['x-strategis-auth-token'] || '').trim() ||
      process.env.STRATEGIS_AUTH_TOKEN ||
      process.env.STRATEGIST_AUTH_TOKEN ||
      (await getSafariStrategisAuthToken()) ||
      undefined;
    const organization = String(req.query.organization || 'Interlincx').trim() || 'Interlincx';
    const strategisClient = new StrategisClient({
      baseUrl: strategisWriteBaseUrl,
      authToken,
    });
    const [schema, templates] = await Promise.all([
      strategisClient.getCampaignSchema(organization, { cached: true }),
      strategisClient.listTemplates(organization),
    ]);
    res.json({
      organization,
      schema,
      templates,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load Strategis bootstrap data',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/buyer-launch-intelligence', async (req, res) => {
  try {
    const authToken =
      String(req.headers['x-strategis-auth-token'] || '').trim() ||
      process.env.STRATEGIS_AUTH_TOKEN ||
      process.env.STRATEGIST_AUTH_TOKEN ||
      (await getSafariStrategisAuthToken()) ||
      undefined;
    const buyer = String(req.query.buyer || 'Ben').trim() || 'Ben';
    const organization = String(req.query.organization || 'Interlincx').trim() || 'Interlincx';

    const [catalog, schema] = await Promise.all([
      loadBenCampaignCatalog({
        buyer,
        organization,
        authToken,
      }),
      new StrategisClient({
        baseUrl: strategisWriteBaseUrl,
        authToken,
      }).getCampaignSchema(organization, { cached: true }),
    ]);

    const intelligence = await buildBuyerLaunchIntelligence({
      catalog,
      schema,
      organization,
      authToken,
    });

    res.json(intelligence);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load buyer launch intelligence',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/ben-setup', async (req, res) => {
  try {
    const authToken =
      String(req.headers['x-strategis-auth-token'] || '').trim() ||
      process.env.STRATEGIS_AUTH_TOKEN ||
      process.env.STRATEGIST_AUTH_TOKEN ||
      (await getSafariStrategisAuthToken()) ||
      undefined;
    const body = req.body as BenShellSetupRequest;
    if (!body?.mode || !body?.category || !body?.article || !body?.strategist?.templateId || !body?.strategist?.rsocSite) {
      return res.status(400).json({
        error: 'Missing required shell setup fields',
      });
    }
    if (!body?.facebook?.adAccountId) {
      return res.status(400).json({
        error: 'Ad account is required for shell setup',
      });
    }
    if (body.mode !== 'strategis' && body.mode !== 'facebook' && !body?.facebook?.targeting) {
      return res.status(400).json({
        error: 'Facebook shell fields are incomplete',
      });
    }

    const strategisClient = new StrategisClient({
      baseUrl: strategisWriteBaseUrl,
      authToken,
    });
    const schema = await strategisClient.getCampaignSchema('Interlincx', { cached: true });
    const schemaAdjusted = normalizePlanAgainstStrategisSchema(buildBenShellCampaignPlan(body), schema, {
      strict: body.mode !== 'facebook',
      dropInvalidFbPage: true,
    });
    const plan = schemaAdjusted.plan;
    const campaignFactory = buildCampaignFactory(authToken);
    const proxyFacebookClient = buildLincxProxyFacebookClient(authToken);
    const dryRun = body.dryRun === true;
    const clientRequestKey = buildLaunchClientRequestKey({
      buyer: body.buyer || 'Ben',
      mode: body.mode,
      cloneSourceCampaignId: body.cloneSource?.campaignId || null,
      article: body.article,
      headline: body.headline,
      adAccountId: body.facebook.adAccountId,
      creativeMode: body.facebook.creativeMode || 'inherit',
    });

    const sourceCatalog = body.cloneSource?.campaignId
      ? await loadBenCampaignCatalog({
          buyer: body.buyer || 'Ben',
          organization: 'Interlincx',
          authToken: authToken || null,
        })
      : null;
    const sourceCampaign =
      sourceCatalog?.items.find((item) => item.campaignId === body.cloneSource?.campaignId) || null;

    const strategisRoutePreview = `https://r.strateg.is/route?campaignId={strategisId}&fbclid={{fbclid}}`;
    const destinationUrl =
      derivePublishedArticleUrl(body.article, body.strategist.rsocSite, body.strategist.subdirectory) ||
      sourceCampaign?.articleUrl ||
      null;

    const strategisChecks: ReadinessCheck[] = [
      { label: 'Strategis auth token available', ok: Boolean(authToken) },
      { label: 'Template selected', ok: Boolean(body.strategist.templateId) },
      { label: 'RSOC site selected', ok: Boolean(body.strategist.rsocSite) },
      { label: 'Article provided', ok: Boolean(body.article.trim()) },
      { label: 'Headline provided', ok: Boolean(body.headline.trim()) },
      { label: 'At least one forcekey provided', ok: body.forcekeys.some((value) => String(value || '').trim()) },
    ];
    for (const warning of schemaAdjusted.warnings) {
      strategisChecks.push({
        label: 'Schema normalization applied',
        ok: true,
        detail: warning,
      });
    }

    const facebookChecks: ReadinessCheck[] = [
      { label: 'Strategis auth token available', ok: Boolean(authToken) },
      { label: 'Clone source selected', ok: Boolean(body.cloneSource?.campaignId) },
      {
        label: 'Clone source exists in buyer catalog',
        ok: Boolean(sourceCampaign),
        detail: body.cloneSource?.campaignId ? undefined : 'Facebook launch is clone-first right now.',
      },
      {
        label: 'Source Facebook campaign id available',
        ok: Boolean(sourceCampaign?.facebook.facebookCampaignId),
      },
      { label: 'Target ad account provided', ok: Boolean(body.facebook.adAccountId?.trim()) },
      { label: 'Destination article URL can be resolved', ok: Boolean(destinationUrl) },
      { label: 'Headline provided', ok: Boolean(body.headline.trim()) },
      {
        label: 'Creative asset present when upload mode is selected',
        ok:
          body.facebook.creativeMode === 'inherit' ||
          Boolean(String(body.facebook.creativeAssetUrl || '').trim()),
      },
    ];
    if (!body.facebook.pageId?.trim()) {
      facebookChecks.push({
        label: 'Facebook page missing on request',
        ok: true,
        detail: 'Clone flow can preserve the source creative page, but page override is blank.',
      });
    }

    const readiness = {
      strategis: toReadiness(strategisChecks),
      facebook: toReadiness(facebookChecks),
      both: toReadiness([...strategisChecks, ...facebookChecks]),
    };

    if (dryRun) {
      const duplicateRisk = await detectRecentDuplicateRisk({
        buyer: body.buyer || 'Ben',
        campaignName: plan.campaignNameOverride || '',
        clientRequestKey,
      });
      const runtimeNotes: string[] = [];
      if (!process.env.PGVECTOR_URL) {
        runtimeNotes.push('Launch history persistence is unavailable in this runtime because PGVECTOR_URL is not configured.');
      }
      const operations: DryRunResult['operations'] = [];
      if (body.mode === 'strategis' || body.mode === 'both') {
        operations.push(
          {
            step: 'load_campaign_schema',
            system: 'Strategis',
            method: 'GET',
            target: '/api/schemas/campaign?organization=Interlincx&cached=true',
            purpose: 'Load org-scoped validation enums and field constraints.',
          },
          {
            step: 'load_templates',
            system: 'Strategis',
            method: 'GET',
            target: '/api/templates',
            purpose: 'Resolve the full template object required for campaign create.',
          },
          {
            step: 'create_campaign',
            system: 'Strategis',
            method: 'POST',
            target: '/api/campaigns',
            purpose: 'Create the Strategis shell with full template payload and forcekeys.',
          }
        );
      }
      if (body.mode === 'facebook' || body.mode === 'both') {
        operations.push(
          {
            step: 'clone_campaign_shell',
            system: 'Facebook',
            method: 'POST',
            target: `/api/lincx-proxy -> /${sourceCampaign?.facebook.facebookCampaignId || '{campaignId}'}/copies`,
            purpose: 'Clone the source Facebook campaign shell in paused state.',
          }
        );
        if ((body.facebook.creativeMode || 'inherit') === 'image_url') {
          operations.push({
            step: 'upload_image',
            system: 'Facebook',
            method: 'POST',
            target: `/api/lincx-proxy -> /act_${normalizeAdAccountId(body.facebook.adAccountId).replace(/^act_/, '')}/adimages`,
            purpose: 'Upload the replacement image and obtain an image hash.',
          });
        }
        if ((body.facebook.creativeMode || 'inherit') === 'video_url') {
          operations.push({
            step: 'upload_video',
            system: 'Facebook',
            method: 'POST',
            target: `/api/lincx-proxy -> /act_${normalizeAdAccountId(body.facebook.adAccountId).replace(/^act_/, '')}/advideos`,
            purpose: 'Upload the replacement video and obtain a video id.',
          });
        }
        operations.push(
          {
            step: 'create_creative',
            system: 'Facebook',
            method: 'POST',
            target: `/api/lincx-proxy -> /act_${normalizeAdAccountId(body.facebook.adAccountId).replace(/^act_/, '')}/adcreatives`,
            purpose: 'Create a fresh ad creative pointed at the resolved destination URL.',
          },
          {
            step: 'swap_creative_on_cloned_ad',
            system: 'Facebook',
            method: 'POST',
            target: '/api/lincx-proxy -> /{clonedAdId}',
            purpose: 'Attach the new creative to the cloned ad and keep it paused.',
          }
        );
      }
      const result: DryRunResult = {
        mode: body.mode,
        dryRun: true,
        runtime: {
          launchHistoryAvailable: Boolean(process.env.PGVECTOR_URL),
          notes: runtimeNotes,
        },
        readiness,
        duplicateRisk,
        operations,
        preview: {
          buyer: body.buyer || 'Ben',
          category: body.category,
          strategis: {
            organization: 'Interlincx',
            campaignName: plan.campaignNameOverride || '',
            templateId: body.strategist.templateId,
            rsocSite: body.strategist.rsocSite,
            article: normalizeStrategisArticleValue(
              body.article,
              body.strategist.rsocSite,
              body.strategist.subdirectory
            ),
            headline: body.headline,
            forcekeys: body.forcekeys.map((value) => String(value || '').trim()).filter(Boolean),
            routeUrlPreview: strategisRoutePreview,
          },
          facebook: {
            sourceCampaignId: sourceCampaign?.campaignId || body.cloneSource?.campaignId || null,
            sourceFacebookCampaignId: sourceCampaign?.facebook.facebookCampaignId || null,
            targetCampaignName:
              plan.campaignNameOverride ||
              (sourceCampaign ? cloneNameWithSuffix(sourceCampaign.campaignName) : null),
            targetAdName:
              sourceCampaign
                ? `${plan.campaignNameOverride || cloneNameWithSuffix(sourceCampaign.campaignName)} | creative`
                : null,
            destinationUrl,
            creativeMode: body.facebook.creativeMode || 'inherit',
            creativeAssetUrl: String(body.facebook.creativeAssetUrl || '').trim() || null,
          },
        },
        warnings: schemaAdjusted.warnings,
      };
      return res.json(result);
    }

    const runCloneFacebookFlow = async (routeUrl?: string | null) => {
      if (!body.cloneSource?.campaignId) {
        throw new Error('Facebook setup currently requires selecting a clone source campaign.');
      }
      const source = sourceCampaign;
      if (!source) {
        throw new Error(`Could not find clone source ${body.cloneSource.campaignId} in the buyer campaign catalog.`);
      }
      if (!source.facebook.facebookCampaignId) {
        throw new Error(`Clone source ${source.campaignId} is missing a Facebook campaign id.`);
      }

      const destinationUrl =
        String(routeUrl || '').trim() ||
        derivePublishedArticleUrl(body.article, body.strategist.rsocSite, body.strategist.subdirectory) ||
        source.articleUrl ||
        null;

      if (!destinationUrl) {
        throw new Error('Unable to determine a destination URL for the cloned Facebook creative.');
      }

      return cloneFacebookShellWithCreative(proxyFacebookClient, {
        organization: 'Interlincx',
        sourceFacebookCampaignId: source.facebook.facebookCampaignId,
        sourceCampaignName: source.campaignName,
        adAccountId: normalizeAdAccountId(body.facebook.adAccountId),
        targetCampaignName: plan.campaignNameOverride || cloneNameWithSuffix(source.campaignName),
        targetAdName: `${plan.campaignNameOverride || cloneNameWithSuffix(source.campaignName)} | creative`,
        destinationUrl,
        headline: body.headline,
        primaryText: body.facebook.creativePrimaryText,
        description: body.facebook.creativeDescription,
        callToActionType: body.facebook.creativeCallToActionType,
        creativeMode: body.facebook.creativeMode || 'inherit',
        assetUrl: body.facebook.creativeAssetUrl,
      });
    };

    if (body.mode === 'strategis') {
      const result = await campaignFactory.createStrategisShellOnly(plan);
      const verification = await verifyStrategisArtifacts(
        strategisClient,
        (result.strategisCampaigns || []).map((item) => item.id),
        {
          templateId: body.strategist.templateId,
          article: normalizeStrategisArticleValue(
            body.article,
            body.strategist.rsocSite,
            body.strategist.subdirectory
          ),
          headline: body.headline,
        }
      );
      const stored = await safePersistLaunchArtifacts({
        plan,
        requestId: result.requestId,
        campaignName: result.campaignName,
        adSetNames: result.adSetNames,
        mode: body.mode,
        strategisCampaignIds: (result.strategisCampaigns || []).map((item) => item.id),
        trackingUrls: (result.strategisCampaigns || []).map((item) => item.trackingUrl),
        status: verification.ready ? 'verified' : 'created_unverified',
        step: 'strategis_verified',
        clientRequestKey,
      });
      result.mappingStored = stored.mappingStored;
      result.mappingId = stored.mappingId;
      (result as any).verification = { strategis: verification };
      result.warnings = [...(result.warnings || []), ...schemaAdjusted.warnings, ...stored.warnings];
      return res.json({ mode: body.mode, result });
    }
    if (body.mode === 'facebook') {
      const facebookResult = await runCloneFacebookFlow(null);
      const verification = await verifyFacebookArtifacts(proxyFacebookClient, {
        organization: 'Interlincx',
        adAccountId: normalizeAdAccountId(body.facebook.adAccountId),
        campaignId: facebookResult.facebookCampaign.id,
        adSetIds: facebookResult.facebookAdSet?.id ? [facebookResult.facebookAdSet.id] : [],
        adId: facebookResult.facebookAd?.id || null,
        creativeId: facebookResult.facebookCreative?.id || null,
      });
      const result: any = {
        requestId: `fbclone-${Date.now()}`,
        campaignName: facebookResult.facebookCampaign.name,
        adSetNames: facebookResult.facebookAdSet ? [facebookResult.facebookAdSet.name] : [],
        facebookCampaign: facebookResult.facebookCampaign,
        facebookAdSets: facebookResult.facebookAdSet ? [facebookResult.facebookAdSet] : [],
        facebookAd: facebookResult.facebookAd,
        facebookCreative: facebookResult.facebookCreative,
        verification: { facebook: verification },
        warnings: [...schemaAdjusted.warnings, ...facebookResult.warnings],
      };
      const stored = await safePersistLaunchArtifacts({
        plan,
        requestId: result.requestId,
        campaignName: result.campaignName,
        adSetNames: result.adSetNames,
        mode: body.mode,
        strategisCampaignIds: [],
        trackingUrls: [],
        facebookCampaignId: result.facebookCampaign.id,
        facebookAdSetIds: result.facebookAdSets.map((item: any) => item.id),
        facebookCreativeIds: result.facebookCreative?.id ? [result.facebookCreative.id] : [],
        facebookAdIds: result.facebookAd?.id ? [result.facebookAd.id] : [],
        status: verification.ready ? 'verified' : 'created_unverified',
        step: 'facebook_verified',
        clientRequestKey,
      });
      result.mappingStored = stored.mappingStored;
      result.mappingId = stored.mappingId;
      result.warnings.push(...stored.warnings);
      return res.json({ mode: body.mode, result });
    }

    const strategisResult = await campaignFactory.createStrategisShellOnly(plan);
    const facebookResult = await runCloneFacebookFlow(strategisResult.strategisCampaigns?.[0]?.trackingUrl || null);
    const strategisVerification = await verifyStrategisArtifacts(
      strategisClient,
      (strategisResult.strategisCampaigns || []).map((item) => item.id),
      {
        templateId: body.strategist.templateId,
        article: normalizeStrategisArticleValue(
          body.article,
          body.strategist.rsocSite,
          body.strategist.subdirectory
        ),
        headline: body.headline,
      }
    );
    const facebookVerification = await verifyFacebookArtifacts(proxyFacebookClient, {
      organization: 'Interlincx',
      adAccountId: normalizeAdAccountId(body.facebook.adAccountId),
      campaignId: facebookResult.facebookCampaign.id,
      adSetIds: facebookResult.facebookAdSet?.id ? [facebookResult.facebookAdSet.id] : [],
      adId: facebookResult.facebookAd?.id || null,
      creativeId: facebookResult.facebookCreative?.id || null,
    });
    const result: any = {
      requestId: strategisResult.requestId,
      campaignName: strategisResult.campaignName,
      adSetNames: strategisResult.adSetNames,
      facebookCampaign: facebookResult.facebookCampaign,
      facebookAdSets: facebookResult.facebookAdSet ? [facebookResult.facebookAdSet] : [],
      facebookAd: facebookResult.facebookAd,
      facebookCreative: facebookResult.facebookCreative,
      strategisCampaigns: strategisResult.strategisCampaigns,
      verification: {
        strategis: strategisVerification,
        facebook: facebookVerification,
      },
      mappingStored: false,
      mappingId: null,
      warnings: [
        ...schemaAdjusted.warnings,
        ...(strategisResult.warnings || []),
        ...facebookResult.warnings,
      ],
    };
    const stored = await safePersistLaunchArtifacts({
      plan,
      requestId: result.requestId,
      campaignName: result.campaignName,
      adSetNames: result.adSetNames,
      mode: body.mode,
      strategisCampaignIds: (result.strategisCampaigns || []).map((item: any) => item.id),
      trackingUrls: (result.strategisCampaigns || []).map((item: any) => item.trackingUrl),
      facebookCampaignId: result.facebookCampaign.id,
      facebookAdSetIds: result.facebookAdSets.map((item: any) => item.id),
      facebookCreativeIds: result.facebookCreative?.id ? [result.facebookCreative.id] : [],
      facebookAdIds: result.facebookAd?.id ? [result.facebookAd.id] : [],
      status:
        strategisVerification.ready && facebookVerification.ready ? 'verified' : 'created_unverified',
      step: 'both_verified',
      clientRequestKey,
    });
    result.mappingStored = stored.mappingStored;
    result.mappingId = stored.mappingId;
    result.warnings.push(...stored.warnings);
    return res.json({ mode: body.mode, result });
  } catch (error) {
    res.status(500).json({
      error: 'Buyer shell setup failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/campaign-factory/create
 * Create a new campaign with naming conventions
 */
router.post('/create', async (req, res) => {
  try {
    const authToken =
      String(req.headers['x-strategis-auth-token'] || '').trim() ||
      process.env.STRATEGIS_AUTH_TOKEN ||
      process.env.STRATEGIST_AUTH_TOKEN ||
      (await getSafariStrategisAuthToken()) ||
      undefined;
    const plan: CampaignPlan = req.body;

    // Validate required fields
    if (!plan.brand || !plan.objective || !plan.hookSetId || !plan.market || 
        !plan.channel || !plan.date || !plan.category || !plan.adAccountId || 
        !plan.organization || !plan.domain || !plan.destination || !plan.adSets) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: [
          'brand', 'objective', 'hookSetId', 'market', 'channel', 'date',
          'category', 'adAccountId', 'organization', 'domain', 'destination', 'adSets'
        ],
      });
    }

    // Validate strategisTemplateId is provided
    if (!plan.strategisTemplateId) {
      return res.status(400).json({
        error: 'strategisTemplateId is required',
      });
    }

    const campaignFactory = buildCampaignFactory(authToken);
    const result = await campaignFactory.createCampaignWithNaming(plan);

    res.status(201).json(result);
  } catch (error) {
    console.error('Campaign creation error:', error);
    res.status(500).json({
      error: 'Campaign creation failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/campaign-factory/requests/:requestId
 * Get request status by request ID
 */
router.get('/requests/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const pool = getPgPool();

    const result = await pool.query(
      `SELECT 
        cp.*,
        cm.id as mapping_id,
        cm.strategis_campaign_ids,
        cm.facebook_campaign_id,
        cm.facebook_ad_set_ids,
        cm.tracking_urls,
        cm.status as mapping_status
       FROM campaign_plans cp
       LEFT JOIN campaign_mappings cm ON cm.campaign_plan_id = cp.id
       WHERE cp.request_id = $1`,
      [requestId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({
      error: 'Failed to fetch request',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/launch-history', async (req, res) => {
  try {
    const buyer = String(req.query.buyer || '').trim();
    const limitRaw = Number(req.query.limit || 12);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.trunc(limitRaw))) : 12;
    if (!process.env.PGVECTOR_URL) {
      return res.json({
        buyer: buyer || null,
        count: 0,
        items: [],
        notes: ['Launch history storage is unavailable because PGVECTOR_URL is not configured in this runtime.'],
      });
    }
    const pool = getPgPool();
    const values: any[] = [];
    let where = '';
    if (buyer) {
      values.push(buyer);
      where = `WHERE cp.brand = $${values.length}`;
    }
    values.push(limit);
    const query = `
      SELECT
        cp.id AS campaign_plan_id,
        cp.request_id,
        cp.brand,
        cp.category,
        cp.campaign_name,
        cp.status AS campaign_plan_status,
        cp.created_at,
        cp.updated_at,
        cm.id AS mapping_id,
        cm.status AS mapping_status,
        cm.strategis_campaign_ids,
        cm.facebook_campaign_id,
        cm.facebook_ad_set_ids,
        cm.facebook_creative_ids,
        cm.facebook_ad_ids,
        cr.status AS request_status,
        cr.step AS request_step
      FROM campaign_plans cp
      LEFT JOIN campaign_mappings cm ON cm.campaign_plan_id = cp.id
      LEFT JOIN campaign_requests cr ON cr.request_id = cp.request_id
      ${where}
      ORDER BY cp.created_at DESC
      LIMIT $${values.length}
    `;
    const result = await pool.query(query, values);
    res.json({
      buyer: buyer || null,
      count: result.rows.length,
      items: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load launch history',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/campaign-factory/plans/:planId
 * Get campaign plan by ID
 */
router.get('/plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    const pool = getPgPool();

    const result = await pool.query(
      `SELECT * FROM campaign_plans WHERE id = $1`,
      [planId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign plan not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching campaign plan:', error);
    res.status(500).json({
      error: 'Failed to fetch campaign plan',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/campaign-factory/mappings/:mappingId
 * Get campaign mapping by ID
 */
router.get('/mappings/:mappingId', async (req, res) => {
  try {
    const { mappingId } = req.params;
    const pool = getPgPool();

    const result = await pool.query(
      `SELECT * FROM campaign_mappings WHERE id = $1`,
      [mappingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign mapping not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching campaign mapping:', error);
    res.status(500).json({
      error: 'Failed to fetch campaign mapping',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/campaign-factory/plans
 * List campaign plans with optional filters
 */
router.get('/plans', async (req, res) => {
  try {
    const { status, hookSetId, organization } = req.query;
    const pool = getPgPool();

    let query = 'SELECT * FROM campaign_plans WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (hookSetId) {
      query += ` AND hook_set_id = $${paramIndex++}`;
      params.push(hookSetId);
    }

    if (organization) {
      query += ` AND organization = $${paramIndex++}`;
      params.push(organization);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing campaign plans:', error);
    res.status(500).json({
      error: 'Failed to list campaign plans',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
