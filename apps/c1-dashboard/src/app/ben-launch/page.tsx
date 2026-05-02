"use client";

import { C1Chat, useThreadListManager } from "@thesysai/genui-sdk";
import { ThemeProvider as CrayonThemeProvider } from "@crayonai/react-ui/ThemeProvider";
import "@crayonai/react-ui/styles/index.css";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/lib/theme";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  buttonGhost,
  buttonOutline,
  buttonPrimary,
  buttonSecondary,
  cardClass,
  fieldLabel,
  inputClass,
  inputPublishClass,
  pickButtonActive,
  pillClass,
  pillPublishClass,
  sectionLabel,
} from "@/lib/ui";
import { Dropdown } from "@/components/Dropdown";
import { Combobox } from "@/components/Combobox";

type SelectorTargeting = {
  ageMin: number | null;
  ageMax: number | null;
  countries: string[];
  locationTypes: string[];
  publisherPlatforms: string[];
  facebookPositions: string[];
  instagramPositions: string[];
  advantageAudience: number | null;
};

type SelectorOption = {
  label: string;
  support: { count: number; pct: number };
  selector: {
    optimizationGoal: string;
    billingEvent: string;
    bidStrategy: string;
    bidAmount: string | number;
    promotedObject: { pixelId: string; event: string };
    targeting: SelectorTargeting;
  };
  sampleCampaignIds: string[];
};

type CatalogField = { value: string; support: { count: number; pct: number } };

type CatalogProfile = {
  profileId: string;
  label: string;
  category: string;
  strategist: {
    rsocSite: CatalogField | null;
    subdirectory: CatalogField | null;
    fbAdAccount: CatalogField | null;
    networkAccountId: CatalogField | null;
    language: CatalogField | null;
    headline: CatalogField | null;
    templateId: CatalogField | null;
    redirectDomain: CatalogField | null;
    namingFamily: CatalogField | null;
  };
  facebook: {
    adAccountId: CatalogField | null;
    pixelId: CatalogField | null;
    pageId: CatalogField | null;
    locked: { optimizationGoal: string; billingEvent: string; customEventType: string };
    primarySelector: SelectorOption | null;
    alternateSelectors: SelectorOption[];
  };
  workflow: { lockedInputs: string[]; buyerInputs: string[]; optionalOverrides: string[] };
  notes: string[];
};

type BenShellCatalog = {
  scope: {
    buyer: string;
    strategistCampaigns: number;
    matchedFacebookCampaigns: number;
    matchedFacebookAdSets: number;
    matchedFacebookAds: number;
  };
  generatedAt: string;
  lockedDefaults: Record<string, string>;
  manualFields: string[];
  profiles: CatalogProfile[];
};

type BenArticleCatalogItem = {
  articleKey: string;
  articleSlug: string | null;
  articleUrl: string | null;
  articlePath: string | null;
  category: string;
  label: string;
  domain: string | null;
  rsocSite: string | null;
  subdirectory: string | null;
  campaignCount: number;
  campaignIds: string[];
  campaignNames: string[];
  headlineHints: string[];
  buyers: string[];
  source: "strategist_campaigns";
  readyState: "configured";
};

type BenArticleCatalog = {
  scope: { buyer: string; campaignsAnalyzed: number; articles: number };
  generatedAt: string;
  items: BenArticleCatalogItem[];
  notes: string[];
};

type CloneSelector = {
  optimizationGoal: string;
  billingEvent: string;
  bidStrategy: string;
  bidAmount: string | number;
  promotedObject: { pixelId: string; event: string };
  targeting: SelectorTargeting;
};

type BenCampaignCatalogItem = {
  campaignId: string;
  campaignName: string;
  category: string;
  buyer: string | null;
  label: string;
  article: string | null;
  articleSlug: string | null;
  articleUrl: string | null;
  articlePath: string | null;
  headline: string | null;
  forcekeys: string[];
  forcekeyMap: Record<string, string>;
  rsocSite: string | null;
  subdirectory: string | null;
  templateId: string | null;
  redirectDomain: string | null;
  fbAdAccount: string | null;
  networkAccountId: string | null;
  fbPage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  facebook: {
    adAccountId: string | null;
    pageId: string | null;
    facebookCampaignId: string | null;
    cloneSelector: CloneSelector | null;
    budgetAmount: string | null;
    bidCap: string | null;
  };
  source: "live_strategis" | "snapshot";
  cloneReadyState: "exact_shell" | "partial_shell";
  notes: string[];
};

type BenCampaignCatalog = {
  scope: { buyer: string; organization: string; campaigns: number };
  generatedAt: string;
  items: BenCampaignCatalogItem[];
  notes: string[];
};

type ForcekeySelectorGeoValue = {
  token: "state" | "city" | "region";
  value: string;
  searches: number;
  clicks: number;
  revenue: number;
  rps: number;
  rpc: number;
  upliftPct: number;
  band: "premium" | "baseline" | "weak";
};

type ForcekeySelectorOption = {
  forcekey: string;
  normalizedForcekey: string;
  type: "exact" | "templated";
  category: string;
  intentPacketId?: string | null;
  dateWindow: {
    start: string;
    end: string;
    label: string;
  };
  metrics: {
    searches: number;
    clicks: number;
    revenue: number;
    rpc: number;
    rps: number;
    ctr: number;
  };
  score: {
    rankingScore: number;
    conservativeCtr: number;
    shrunkRpc: number;
    shrunkRps: number;
    confidence: "high" | "medium" | "low" | "insufficient_data";
  };
  comparison: {
    categoryRank: number;
    categoryCount: number;
    categoryRpsLiftPct: number;
    networkRpsLiftPct: number;
    networkRpcLiftPct: number;
  };
  geo: {
    token: "state" | "city" | "region";
    topValues: ForcekeySelectorGeoValue[];
    geoOpportunity: boolean;
    rationale: string;
  } | null;
  observedKeywordVariants: string[];
};

type ForcekeySelectorResponse = {
  generatedAt: string;
  buyer: string | null;
  category: string;
  intentPacketId?: string | null;
  dateWindow: {
    start: string;
    end: string;
    label: string;
    type: "trailing_complete_days";
  };
  baselines: {
    category: {
      searches: number;
      clicks: number;
      revenue: number;
      rpc: number;
      rps: number;
    };
    network: {
      searches: number;
      clicks: number;
      revenue: number;
      rpc: number;
      rps: number;
    };
  };
  options: ForcekeySelectorOption[];
  notes: string[];
};

type LaunchAssociationOption = {
  value: string;
  label: string;
  support: {
    count: number;
    pct: number;
  };
  sampleCampaignIds: string[];
  sampleCampaignNames: string[];
  source: "history" | "schema_only" | "history_not_in_schema";
};

type SiteAssociation = {
  site: string;
  campaignCount: number;
  redirectDomains: LaunchAssociationOption[];
  adAccounts: LaunchAssociationOption[];
  pages: LaunchAssociationOption[];
  networkAccounts: LaunchAssociationOption[];
};

type BuyerLaunchIntelligence = {
  scope: {
    buyer: string;
    organization: string;
    historicalCampaigns: number;
  };
  generatedAt: string;
  options: {
    sites: LaunchAssociationOption[];
    redirectDomains: LaunchAssociationOption[];
    adAccounts: LaunchAssociationOption[];
    pages: LaunchAssociationOption[];
    networkAccounts: LaunchAssociationOption[];
  };
  siteAssociations: SiteAssociation[];
  notes: string[];
};

type EntityPickerState =
  | {
      kind: "redirect" | "page" | "adAccount";
      title: string;
      placeholder: string;
    }
  | null;

type FormState = {
  article: string;
  headline: string;
  forcekeys: string[];
  budgetAmount: string;
  bidCap: string;
  creativeNotes: string;
  creativeMode: "inherit" | "image_url" | "video_url";
  creativeAssetUrl: string;
  creativePrimaryText: string;
  creativeDescription: string;
  creativeCallToActionType: string;
  selectorVariant: string;
  rsocSite: string;
  redirectDomain: string;
  pageId: string;
  adAccountId: string;
  networkAccountId: string;
};

const emptyForm = (): FormState => ({
  article: "",
  headline: "",
  forcekeys: Array.from({ length: 12 }, () => ""),
  budgetAmount: "30",
  bidCap: "",
  creativeNotes: "",
  creativeMode: "inherit",
  creativeAssetUrl: "",
  creativePrimaryText: "",
  creativeDescription: "",
  creativeCallToActionType: "LEARN_MORE",
  selectorVariant: "primary",
  rsocSite: "",
  redirectDomain: "",
  pageId: "",
  adAccountId: "",
  networkAccountId: "",
});

const BUYER_OPTIONS = [
  { value: "Ben", label: "Ben Holley" },
  { value: "Cook", label: "Andrew Cook" },
] as const;

const CREATIVE_MODE_OPTIONS = [
  { value: "inherit", label: "Inherit source media" },
  { value: "image_url", label: "Upload image URL" },
  { value: "video_url", label: "Upload video URL" },
] as const;

const CTA_OPTIONS = [
  { value: "LEARN_MORE", label: "Learn more" },
  { value: "APPLY_NOW", label: "Apply now" },
  { value: "SIGN_UP", label: "Sign up" },
  { value: "GET_QUOTE", label: "Get quote" },
  { value: "CONTACT_US", label: "Contact us" },
] as const;

const LAUNCH_MODE_OPTIONS = [
  {
    value: "preset",
    label: "Category",
    description: "Start from learned defaults for the category without inheriting a specific campaign shell.",
  },
  {
    value: "clone",
    label: "Clone",
    description: "Start from a specific historical campaign shell and make controlled changes.",
  },
  {
    value: "packet",
    label: "Intent packet",
    description: "Concept-first, more-from-scratch lane for brand-new packets or categories.",
  },
] as const;

const PACKET_VERTICAL_OPTIONS = [
  { value: "", label: "Auto-detect" },
  { value: "health", label: "Health" },
  { value: "finance", label: "Finance" },
  { value: "vehicles", label: "Vehicles" },
  { value: "technology", label: "Technology" },
  { value: "jobs", label: "Jobs" },
  { value: "general", label: "General" },
] as const;

type LaunchMode = "preset" | "clone" | "packet";

type IntentPacketFormState = {
  primaryKeyword: string;
  supportingKeywords: string;
  vertical: string;
  market: string;
  category: string;
  rsocSite: string;
  destinationDomain: string;
  destination: string;
  strategisTemplateId: string;
  adAccountId: string;
  fbPage: string;
  creativeMode: "link" | "video_url";
  publicVideoUrl: string;
};

function emptyIntentPacketForm(): IntentPacketFormState {
  return {
    primaryKeyword: "",
    supportingKeywords: "",
    vertical: "",
    market: "US",
    category: "",
    rsocSite: "",
    destinationDomain: "",
    destination: "Lincx",
    strategisTemplateId: "",
    adAccountId: "",
    fbPage: "",
    creativeMode: "link",
    publicVideoUrl: "",
  };
}

function trailingCompleteDayWindow(days: number) {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  const toYmd = (value: Date) => value.toISOString().slice(0, 10);
  return {
    startDate: toYmd(start),
    endDate: toYmd(end),
  };
}

function pctLabel(value: number) {
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

function moneyLabel(value: number) {
  return `$${value.toFixed(2)}`;
}

function supportSuffix(option: LaunchAssociationOption) {
  return option.support.count > 0 ? ` (${option.support.count})` : "";
}

function buildDropdownOptions(
  primary: LaunchAssociationOption[],
  all: LaunchAssociationOption[],
  currentValue?: string,
  currentLabelPrefix?: string
) {
  const seen = new Set<string>();
  const merged: Array<{ value: string; label: string }> = [];

  const push = (value: string, label: string) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    merged.push({ value, label });
  };

  // Primary = historical association for this exact site. Prefix with a green
  // bullet so it reads as 'past use' next to non-history options.
  for (const option of primary) {
    push(option.value, `● ${option.label}${supportSuffix(option)}`);
  }

  // 'all' may include further history items used on other sites — keep the
  // bullet for those too so users can see they're previously-used.
  for (const option of all) {
    const usedBefore = option.support.count > 0;
    push(option.value, `${usedBefore ? "● " : ""}${option.label}${supportSuffix(option)}`);
  }

  if (currentValue && !seen.has(currentValue)) {
    push(currentValue, currentLabelPrefix ? `${currentLabelPrefix} · ${currentValue}` : currentValue);
  }

  return merged;
}

function optionSourceLabel(option: LaunchAssociationOption) {
  if (option.source === "history") return option.support.count > 0 ? "history" : "recommended";
  if (option.source === "history_not_in_schema") return "history only";
  return "all options";
}

// Returns the option list with the currently-selected value pinned first
// (synthesizing a stub option if the value isn't in the historical list).
// Used so the user always sees their current selection as a green pill,
// even if the value came from the broader catalog via the entity picker.
function pinActiveFirst(
  options: LaunchAssociationOption[],
  activeValue: string,
): LaunchAssociationOption[] {
  if (!activeValue) return options;
  const idx = options.findIndex((o) => o.value === activeValue);
  if (idx === 0) return options;
  if (idx > 0) {
    const reordered = [...options];
    const [moved] = reordered.splice(idx, 1);
    reordered.unshift(moved);
    return reordered;
  }
  // Active value isn't in the historical list — synthesize a stub so it
  // still renders as a (green) pill in the row.
  return [
    {
      value: activeValue,
      label: activeValue,
      support: { count: 0, pct: 0 },
      sampleCampaignIds: [],
      sampleCampaignNames: [],
      source: "history" as const,
    },
    ...options,
  ];
}

function currentOptionLabel(
  value: string,
  options: LaunchAssociationOption[],
  fallbackPrefix: string
) {
  if (!value) return "";
  const match = options.find((option) => option.value === value);
  return match?.label || `${fallbackPrefix} · ${value}`;
}

function siteOptionLabel(option: LaunchAssociationOption) {
  if (option.support.count > 0) {
    return `${option.value} · Ben history · ${option.support.count} campaign${option.support.count === 1 ? "" : "s"}`;
  }
  return `${option.value} · Available site`;
}

function normalizeSiteHost(value: string) {
  return value.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/g, "").toLowerCase();
}

function articleHostFromValue(value: string) {
  const raw = value.trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    return new URL(raw).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function formatArticleBuyerLabel(item: BenArticleCatalogItem, currentBuyer: string) {
  const normalizedCurrentBuyer = currentBuyer.trim().toLowerCase();
  const normalizedBuyers = item.buyers.map((value) => value.trim()).filter(Boolean);
  const ownedByCurrentBuyer = normalizedBuyers.some((value) => value.toLowerCase() === normalizedCurrentBuyer);
  if (ownedByCurrentBuyer) {
    return `${item.label} (${item.campaignCount})`;
  }
  if (normalizedBuyers.length === 0) {
    return `${item.label} (${item.campaignCount})`;
  }
  return `${item.label} (${item.campaignCount}) · ${normalizedBuyers.join(", ")}`;
}

function copyJson(value: unknown) {
  return navigator.clipboard.writeText(JSON.stringify(value, null, 2));
}

function copyText(value: string) {
  return navigator.clipboard.writeText(value);
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return normalizeErrorMessage(error.message);
  }
  if (typeof error !== "string") {
    return "Setup failed";
  }
  try {
    const parsed = JSON.parse(error) as { message?: unknown; error?: unknown };
    if (typeof parsed?.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
    if (typeof parsed?.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    // Fall through to the raw string.
  }
  return error;
}

function setupModeLabel(mode: SetupMode): string {
  if (mode === "strategis") return "Strategis";
  if (mode === "facebook") return "Facebook";
  return "Both";
}

function facebookDestinationLabel(result: DryRunResponse): string {
  return result.mode === "facebook"
    ? "Required Strategis route URL for Facebook setup"
    : "Final Facebook destination after Strategis create";
}

function facebookDestinationValue(result: DryRunResponse): string {
  if (result.mode === "facebook") {
    return result.preview.facebook.destinationUrl || "Missing";
  }
  return result.preview.strategis.routeUrlPreview || "Pending Strategis create";
}

function ButtonSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        className="opacity-25"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        className="opacity-90"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

type SetupMode = "strategis" | "facebook" | "both";

type SetupResponse = {
  mode: SetupMode;
  result: {
    requestId: string;
    campaignName: string;
    adSetNames: string[];
    facebookCampaign?: { id: string; name: string } | null;
    facebookAdSets?: Array<{ id: string; name: string }>;
    facebookAd?: { id: string; name: string } | null;
    facebookCreative?: { id: string } | null;
    strategisCampaigns?: Array<{ id: string; name: string; trackingUrl: string }>;
    mappingStored?: boolean;
    mappingId?: string | null;
    verification?: {
      strategis?: { ready: boolean; checks: ReadinessCheck[] };
      facebook?: { ready: boolean; checks: ReadinessCheck[] };
    };
    warnings?: string[];
  };
};

type StrategisShellState = {
  id: string;
  name: string;
  trackingUrl: string;
  fingerprint: string;
};

type LaunchHistoryItem = {
  campaign_plan_id: string;
  request_id: string;
  brand: string;
  category: string;
  campaign_name: string;
  campaign_plan_status: string;
  created_at: string;
  updated_at: string;
  mapping_id: string | null;
  mapping_status: string | null;
  strategis_campaign_ids: string[] | null;
  facebook_campaign_id: string | null;
  facebook_ad_set_ids: string[] | null;
  facebook_creative_ids: string[] | null;
  facebook_ad_ids: string[] | null;
  request_status: string | null;
  request_step: string | null;
};

type LaunchHistoryResponse = {
  buyer: string | null;
  count: number;
  items: LaunchHistoryItem[];
  notes?: string[];
};

type BuyerPortalSessionSummary = {
  role: "buyer" | "admin";
  buyer: string | null;
  allowedBuyers: string[];
  displayName: string;
};

type IntentPacketDeployPreviewResponse = {
  packet: {
    id: string;
    packetName: string;
    vertical: string;
    market: string;
    intent: {
      primaryKeyword: string;
      supportingKeywords: string[];
      packetHypothesis: string;
    };
    article: {
      title: string;
      summary: string;
      widgetKeywordPhrases: string[];
    };
    launchTest: {
      recommendedDailyBudget: number;
      checklist: string[];
    };
    scores: {
      launchPriority: number;
      monetizationPotential: number;
      evidenceConfidence: number;
      metaRiskPenalty: number;
      googleRiskPenalty: number;
    };
  };
  deployMode: string;
  creativeMode: string;
  readyForLiveDeploy: boolean;
  blockers: string[];
  strategis: {
    createCampaignRequest: Record<string, any> | null;
  };
  facebook: {
    campaignRequest: Record<string, any> | null;
    adSetRequest: Record<string, any> | null;
    creativeRequest: Record<string, any> | null;
    adRequest: Record<string, any> | null;
  };
  shellContract: {
    notes: string[];
  };
};

type ReadinessCheck = {
  label: string;
  ok: boolean;
  detail?: string;
};

type DryRunResponse = {
  mode: SetupMode;
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
    level: "none" | "possible" | "unknown";
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
    system: "Strategis" | "Facebook";
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
      creativeMode: "inherit" | "image_url" | "video_url";
      creativeAssetUrl: string | null;
    };
  };
  warnings: string[];
};

const THREADS_STORAGE_KEY = "ben-launch-threads-v1";

type StoredThread = { threadId: string; title: string; createdAt: string };

function readStoredThreads(): StoredThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(THREADS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredThread[]) : [];
  } catch {
    return [];
  }
}

function writeStoredThreads(threads: StoredThread[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads));
}

function newThreadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function unavailableArticleCatalog(buyer: string): BenArticleCatalog {
  return {
    scope: { buyer, campaignsAnalyzed: 0, articles: 0 },
    generatedAt: new Date().toISOString(),
    items: [],
    notes: ["Article catalog is temporarily unavailable."],
  };
}

function unavailableCampaignCatalog(
  buyer: string,
  note = "Campaign clone catalog is temporarily unavailable."
): BenCampaignCatalog {
  return {
    scope: { buyer, organization: "Interlincx", campaigns: 0 },
    generatedAt: new Date().toISOString(),
    items: [],
    notes: [note],
  };
}

function emptyLaunchHistory(buyer: string): LaunchHistoryResponse {
  return { buyer, count: 0, items: [] };
}

export default function BenLaunchWorkbench() {
  const router = useRouter();
  const [buyer, setBuyer] = useState<string>("Ben");
  const [launchMode, setLaunchMode] = useState<LaunchMode>("preset");
  const [catalog, setCatalog] = useState<BenShellCatalog | null>(null);
  const [articleCatalog, setArticleCatalog] = useState<BenArticleCatalog | null>(null);
  const [campaignCatalog, setCampaignCatalog] = useState<BenCampaignCatalog | null>(null);
  const [launchIntelligence, setLaunchIntelligence] = useState<BuyerLaunchIntelligence | null>(null);
  const [forcekeySelector, setForcekeySelector] = useState<ForcekeySelectorResponse | null>(null);
  const [forcekeySelectorLoading, setForcekeySelectorLoading] = useState(false);
  const [forcekeySelectorError, setForcekeySelectorError] = useState<string | null>(null);
  const [launchHistory, setLaunchHistory] = useState<LaunchHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [articleQuery, setArticleQuery] = useState("");
  const [campaignQuery, setCampaignQuery] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [selectedArticleKey, setSelectedArticleKey] = useState<string>("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [packetForm, setPacketForm] = useState<IntentPacketFormState>(emptyIntentPacketForm);
  const [packetPreview, setPacketPreview] = useState<IntentPacketDeployPreviewResponse | null>(null);
  const [packetPreviewLoading, setPacketPreviewLoading] = useState(false);
  const [packetPreviewError, setPacketPreviewError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAllForcekeys, setShowAllForcekeys] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showAllRankedForcekeys, setShowAllRankedForcekeys] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [entityPicker, setEntityPicker] = useState<EntityPickerState>(null);
  const [entityPickerQuery, setEntityPickerQuery] = useState("");
  const { resolved: resolvedTheme } = useTheme();
  const [forcekeyWindow, setForcekeyWindow] = useState(() => trailingCompleteDayWindow(14));
  const [forcekeyRefreshNonce, setForcekeyRefreshNonce] = useState(0);
  const [sessionInfo, setSessionInfo] = useState<BuyerPortalSessionSummary | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const threadListManager = useThreadListManager({
    fetchThreadList: async () => {
      return readStoredThreads().map((t) => ({
        threadId: t.threadId,
        title: t.title,
        createdAt: new Date(t.createdAt),
      }));
    },
    createThread: async (firstMessage) => {
      const raw = (firstMessage as { message?: string; content?: string }) || {};
      const text = (raw.message || raw.content || "").toString().trim();
      const title = text ? text.slice(0, 60) : "New chat";
      const id = newThreadId();
      const createdAt = new Date();
      const stored: StoredThread = { threadId: id, title, createdAt: createdAt.toISOString() };
      writeStoredThreads([stored, ...readStoredThreads()]);
      return { threadId: id, title, createdAt };
    },
    deleteThread: async (id) => {
      writeStoredThreads(readStoredThreads().filter((t) => t.threadId !== id));
    },
    updateThread: async (updated) => {
      writeStoredThreads(
        readStoredThreads().map((t) =>
          t.threadId === updated.threadId
            ? { ...t, title: updated.title, createdAt: (updated.createdAt as Date).toISOString() }
            : t
        )
      );
      return updated;
    },
    onSwitchToNew: () => {},
    onSelectThread: () => {},
  });
  const [runningSetup, setRunningSetup] = useState<SetupMode | null>(null);
  const [setupResult, setSetupResult] = useState<SetupResponse | null>(null);
  const [strategisShell, setStrategisShell] = useState<StrategisShellState | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [runningDryRun, setRunningDryRun] = useState<SetupMode | null>(null);
  const [dryRunResult, setDryRunResult] = useState<DryRunResponse | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<SetupMode | null>(null);
  const [confirmPreview, setConfirmPreview] = useState<DryRunResponse | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const buyerLabel = BUYER_OPTIONS.find((option) => option.value === buyer)?.label || buyer;
  const canSwitchBuyer = sessionInfo?.role === "admin" && (sessionInfo.allowedBuyers?.length || 0) > 1;

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!response.ok) throw new Error("Unauthorized");
        const json = await response.json();
        if (!isMounted) return;
        setSessionInfo(json.session);
      } catch {
        if (!isMounted) return;
        router.replace("/login");
      } finally {
        if (isMounted) setSessionLoading(false);
      }
    }

    loadSession();
    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!sessionInfo || sessionInfo.role === "admin") return;
    const scopedBuyer = sessionInfo.buyer || "Ben";
    if (buyer !== scopedBuyer) {
      setBuyer(scopedBuyer);
    }
  }, [buyer, sessionInfo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentParam = new URLSearchParams(window.location.search).get("buyer");
    const nextBuyer = BUYER_OPTIONS.find((option) => option.value === currentParam)?.value || "Ben";
    if (buyer !== nextBuyer) {
      setBuyer(nextBuyer);
    }
  }, [buyer]);

  useEffect(() => {
    function refreshForcekeyWindow() {
      const next = trailingCompleteDayWindow(14);
      setForcekeyWindow((current) =>
        current.startDate === next.startDate && current.endDate === next.endDate ? current : next
      );
    }

    const interval = window.setInterval(refreshForcekeyWindow, 5 * 60 * 1000);
    window.addEventListener("focus", refreshForcekeyWindow);
    document.addEventListener("visibilitychange", refreshForcekeyWindow);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshForcekeyWindow);
      document.removeEventListener("visibilitychange", refreshForcekeyWindow);
    };
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (typeof window === "undefined") return;
    const currentParam = new URLSearchParams(window.location.search).get("buyer") || "Ben";
    if (currentParam !== buyer) {
      router.replace(`/ben-launch?buyer=${encodeURIComponent(buyer)}`);
    }
  }, [buyer, router, sessionLoading]);

  useEffect(() => {
    setLaunchMode("preset");
    setSelectedProfileId("");
    setSelectedArticleKey("");
    setSelectedCampaignId("");
    setQuery("");
    setArticleQuery("");
    setCampaignQuery("");
    setForm(emptyForm());
    setPacketForm(emptyIntentPacketForm());
    setPacketPreview(null);
    setPacketPreviewError(null);
    setSetupResult(null);
    setStrategisShell(null);
    setSetupError(null);
    setDryRunResult(null);
    setDryRunError(null);
    setConfirmMode(null);
    setConfirmPreview(null);
    setConfirmError(null);
    setForcekeySelector(null);
    setForcekeySelectorError(null);
    setLaunchHistory(null);
    setLaunchIntelligence(null);
  }, [buyer]);

  useEffect(() => {
    if (launchMode !== "clone" && selectedCampaignId) {
      setSelectedCampaignId("");
    }
  }, [launchMode, selectedCampaignId]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/ben-shell-catalog?buyer=${encodeURIComponent(buyer)}`, {
          cache: "no-store",
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.message || json?.error || "Failed to load catalog");
        }
        if (!isMounted) return;
        setCatalog(json);
        const firstProfile = json?.profiles?.[0];
        if (firstProfile) setSelectedProfileId(firstProfile.profileId);
        setLoading(false);

        void (async () => {
          try {
            const articleResponse = await fetch(`/api/ben-article-catalog?buyer=${encodeURIComponent(buyer)}`, {
              cache: "no-store",
            });
            const articleJson = await articleResponse.json();
            if (!isMounted) return;
            if (articleResponse.ok) {
              setArticleCatalog(articleJson);
            } else {
              setArticleCatalog(unavailableArticleCatalog(buyer));
            }
          } catch {
            if (isMounted) setArticleCatalog(unavailableArticleCatalog(buyer));
          }
        })();

        void (async () => {
          try {
            const campaignResponse = await fetch(`/api/ben-campaign-catalog?buyer=${encodeURIComponent(buyer)}`, {
              cache: "no-store",
            });
            const campaignJson = await campaignResponse.json();
            if (!isMounted) return;
            if (campaignResponse.ok) {
              setCampaignCatalog(campaignJson);
            } else {
              setCampaignCatalog(
                unavailableCampaignCatalog(
                  buyer,
                  campaignJson?.message || campaignJson?.error || "Campaign clone catalog is unavailable."
                )
              );
            }
          } catch {
            if (isMounted) setCampaignCatalog(unavailableCampaignCatalog(buyer));
          }
        })();

        void (async () => {
          try {
            const historyResponse = await fetch(`/api/ben-launch-history?buyer=${encodeURIComponent(buyer)}&limit=8`, {
              cache: "no-store",
            });
            const historyJson = await historyResponse.json();
            if (!isMounted) return;
            if (historyResponse.ok) {
              setLaunchHistory(historyJson);
            } else {
              setLaunchHistory(emptyLaunchHistory(buyer));
            }
          } catch {
            if (isMounted) setLaunchHistory(emptyLaunchHistory(buyer));
          }
        })();

        void (async () => {
          try {
            const intelligenceResponse = await fetch(
              `/api/ben-launch-intelligence?buyer=${encodeURIComponent(buyer)}`,
              {
                cache: "no-store",
              }
            );
            const intelligenceJson = await intelligenceResponse.json();
            if (!isMounted) return;
            if (intelligenceResponse.ok) {
              setLaunchIntelligence(intelligenceJson);
            } else {
              setLaunchIntelligence(null);
            }
          } catch {
            if (isMounted) setLaunchIntelligence(null);
          }
        })();
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [buyer]);

  const profiles = catalog?.profiles || [];

  const filteredProfiles = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    if (!lowered) return profiles;
    return profiles.filter((profile) =>
      [profile.category, profile.label, profile.profileId].some((value) =>
        value.toLowerCase().includes(lowered)
      )
    );
  }, [profiles, query]);

  const selectedProfile =
    profiles.find((profile) => profile.profileId === selectedProfileId) || filteredProfiles[0] || null;

  useEffect(() => {
    let isMounted = true;
    async function loadForcekeySelector() {
      if (!selectedProfile?.category) {
        if (isMounted) {
          setForcekeySelector(null);
          setForcekeySelectorError(null);
        }
        return;
      }

      try {
        if (isMounted) {
          setForcekeySelectorLoading(true);
          setForcekeySelectorError(null);
        }
        const response = await fetch(
          `/api/forcekey-selector?buyer=${encodeURIComponent(buyer)}&category=${encodeURIComponent(
            selectedProfile.category
          )}&startDate=${encodeURIComponent(forcekeyWindow.startDate)}&endDate=${encodeURIComponent(
            forcekeyWindow.endDate
          )}&limit=18`,
          { cache: "no-store" }
        );
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.message || json?.error || "Failed to load forcekey selector");
        }
        if (!isMounted) return;
        setForcekeySelector(json);
      } catch (error) {
        if (!isMounted) return;
        setForcekeySelector(null);
        setForcekeySelectorError(error instanceof Error ? error.message : String(error));
      } finally {
        if (isMounted) setForcekeySelectorLoading(false);
      }
    }

    loadForcekeySelector();
    return () => {
      isMounted = false;
    };
  }, [
    buyer,
    selectedProfile?.category,
    forcekeyRefreshNonce,
    forcekeyWindow.endDate,
    forcekeyWindow.startDate,
  ]);

  const campaignItems = campaignCatalog?.items || [];

  const filteredCampaigns = useMemo(() => {
    const lowered = campaignQuery.trim().toLowerCase();
    const ranked = [...campaignItems].sort((a, b) => {
      const aMatch = selectedProfile && a.category === selectedProfile.category ? 0 : 1;
      const bMatch = selectedProfile && b.category === selectedProfile.category ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.campaignName.localeCompare(b.campaignName);
    });
    if (!lowered) return ranked;
    return ranked.filter((campaign) =>
      [campaign.campaignName, campaign.category, campaign.campaignId, campaign.articleSlug, campaign.headline]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(lowered))
    );
  }, [campaignItems, campaignQuery, selectedProfile]);

  const selectedCampaign =
    campaignItems.find((campaign) => campaign.campaignId === selectedCampaignId) || null;

  const siteAssociationBySite = useMemo(
    () => new Map((launchIntelligence?.siteAssociations || []).map((association) => [association.site, association])),
    [launchIntelligence]
  );

  const adAccountLabelMap = useMemo(
    () => new Map((launchIntelligence?.options.adAccounts || []).map((option) => [option.value, option.label])),
    [launchIntelligence]
  );

  const pageLabelMap = useMemo(
    () => new Map((launchIntelligence?.options.pages || []).map((option) => [option.value, option.label])),
    [launchIntelligence]
  );

  const rankedArticles = useMemo(() => {
    const items = articleCatalog?.items || [];
    if (!selectedProfile) return items;
    const selectedSiteHost = normalizeSiteHost(form.rsocSite || selectedProfile.strategist.rsocSite?.value || "");
    return [...items].sort((a, b) => {
      const aSiteMatch = a.rsocSite && normalizeSiteHost(a.rsocSite) === selectedSiteHost ? 0 : 1;
      const bSiteMatch = b.rsocSite && normalizeSiteHost(b.rsocSite) === selectedSiteHost ? 0 : 1;
      if (aSiteMatch !== bSiteMatch) return aSiteMatch - bSiteMatch;
      const aBuyerMatch = a.buyers.some((value) => value.toLowerCase() === buyer.toLowerCase()) ? 0 : 1;
      const bBuyerMatch = b.buyers.some((value) => value.toLowerCase() === buyer.toLowerCase()) ? 0 : 1;
      if (aBuyerMatch !== bBuyerMatch) return aBuyerMatch - bBuyerMatch;
      const aMatch = a.category === selectedProfile.category ? 0 : 1;
      const bMatch = b.category === selectedProfile.category ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      if (a.campaignCount !== b.campaignCount) return b.campaignCount - a.campaignCount;
      return a.label.localeCompare(b.label);
    });
  }, [articleCatalog, buyer, form.rsocSite, selectedProfile]);

  const selectedSiteHost = normalizeSiteHost(form.rsocSite || selectedProfile?.strategist.rsocSite?.value || "");

  const selectedSiteScopedArticles = useMemo(() => {
    if (!selectedSiteHost) return [] as BenArticleCatalogItem[];
    return rankedArticles.filter(
      (item) => Boolean(item.rsocSite) && normalizeSiteHost(item.rsocSite || "") === selectedSiteHost
    );
  }, [rankedArticles, selectedSiteHost]);

  const effectiveArticlePool = useMemo(() => {
    if (selectedSiteScopedArticles.length > 0) return selectedSiteScopedArticles;
    return rankedArticles;
  }, [rankedArticles, selectedSiteScopedArticles]);

  const filteredArticles = useMemo(() => {
    const lowered = articleQuery.trim().toLowerCase();
    if (!lowered) return effectiveArticlePool;
    return effectiveArticlePool.filter((item) =>
      [item.label, item.articleSlug, item.articleUrl, item.articlePath, ...item.headlineHints]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(lowered))
    );
  }, [effectiveArticlePool, articleQuery]);

  const selectedArticleByKey =
    filteredArticles.find((item) => item.articleKey === selectedArticleKey) ||
    effectiveArticlePool.find((item) => item.articleKey === selectedArticleKey) ||
    null;
  const suggestedArticle = filteredArticles[0] || effectiveArticlePool[0] || null;
  const selectedArticle = selectedArticleByKey || suggestedArticle;

  const currentArticleValue = form.article.trim();
  const articleLooksLikeUrl = /^https?:\/\//i.test(currentArticleValue);
  const currentArticleSlug =
    selectedArticle?.articleSlug ||
    currentArticleValue.replace(/^https?:\/\/[^/]+\//i, "").replace(/^\/+|\/+$/g, "").split("/").filter(Boolean).pop() ||
    "";
  const hasCurrentArticle = currentArticleValue.length > 0;

  const matchedCurrentArticle = useMemo(() => {
    const items = articleCatalog?.items || [];
    const normalizedValue = currentArticleValue.replace(/^\/+|\/+$/g, "").trim().toLowerCase();
    if (!normalizedValue) return null;
    return (
      items.find((item) => (item.articleUrl || "").trim().toLowerCase() === currentArticleValue.toLowerCase()) ||
      items.find((item) => (item.articlePath || "").replace(/^\/+|\/+$/g, "").trim().toLowerCase() === normalizedValue) ||
      items.find((item) => (item.articleSlug || "").trim().toLowerCase() === normalizedValue) ||
      null
    );
  }, [articleCatalog, currentArticleValue]);

  const articleSiteHost = articleHostFromValue(currentArticleValue);
  const articleCatalogSiteHost = matchedCurrentArticle?.rsocSite
    ? normalizeSiteHost(matchedCurrentArticle.rsocSite)
    : null;
  const currentArticleRecord = matchedCurrentArticle || selectedArticleByKey || selectedArticle;
  const currentArticleResolvedSiteHost =
    articleSiteHost ||
    articleCatalogSiteHost ||
    (currentArticleRecord?.rsocSite ? normalizeSiteHost(currentArticleRecord.rsocSite) : null);
  const articleSiteMismatch = Boolean(
    selectedSiteHost &&
      currentArticleResolvedSiteHost &&
      currentArticleResolvedSiteHost !== selectedSiteHost
  );
  const articleSiteMismatchMessage = articleSiteMismatch
    ? `This article is tied to ${
        currentArticleResolvedSiteHost
      }, but the selected site is ${selectedSiteHost}. Paste a new article URL/path for ${selectedSiteHost}, or replace it from the ${selectedSiteHost} article list below.`
    : null;

  useEffect(() => {
    if (!articleQuery.trim()) return;
    if (filteredArticles.length === 0) return;
    const currentStillVisible = filteredArticles.some((item) => item.articleKey === selectedArticleKey);
    if (!currentStillVisible) {
      const nextArticle = filteredArticles[0];
      setSelectedArticleKey(nextArticle.articleKey);
      setForm((current) => ({
        ...current,
        article: nextArticle.articleUrl || nextArticle.articlePath || current.article,
        headline: nextArticle.headlineHints?.[0] || current.headline,
      }));
    }
  }, [articleQuery, filteredArticles, selectedArticleKey]);

  useEffect(() => {
    if (!selectedProfile) return;
    setForm((current) => ({
      ...current,
      article: current.article || selectedArticle?.articleUrl || selectedArticle?.articlePath || "",
      headline:
        current.headline ||
        selectedArticle?.headlineHints?.[0] ||
        selectedProfile.strategist.headline?.value ||
        "",
      rsocSite: current.rsocSite || selectedProfile.strategist.rsocSite?.value || "",
      redirectDomain: current.redirectDomain || selectedProfile.strategist.redirectDomain?.value || "",
      pageId: current.pageId || selectedProfile.facebook.pageId?.value || "",
      adAccountId:
        current.adAccountId ||
        selectedProfile.facebook.adAccountId?.value ||
        selectedProfile.strategist.fbAdAccount?.value ||
        "",
      networkAccountId:
        current.networkAccountId ||
        selectedProfile.strategist.networkAccountId?.value ||
        "",
    }));
  }, [selectedProfile, selectedArticle]);

  useEffect(() => {
    if (!selectedProfile) return;
    const availableArticles = effectiveArticlePool;
    const currentStillValid = availableArticles.some((item) => item.articleKey === selectedArticleKey);
    if (!currentStillValid) {
      setSelectedArticleKey(availableArticles[0]?.articleKey || "");
      setArticleQuery("");
    }
  }, [selectedProfileId, selectedProfile, effectiveArticlePool, selectedArticleKey]);

  const selectorOptions = useMemo(() => {
    if (!selectedProfile) return [];
    const entries: Array<{ key: string; option: SelectorOption }> = [];
    if (selectedCampaign?.facebook.cloneSelector) {
      entries.push({
        key: "cloned",
        option: {
          label: `Clone targeting from ${selectedCampaign.campaignName}`,
          support: { count: 1, pct: 1 },
          selector: selectedCampaign.facebook.cloneSelector,
          sampleCampaignIds: [selectedCampaign.campaignId],
        },
      });
    }
    if (selectedProfile.facebook.primarySelector) {
      entries.push({ key: "primary", option: selectedProfile.facebook.primarySelector });
    }
    selectedProfile.facebook.alternateSelectors.forEach((option, index) => {
      entries.push({ key: `alternate-${index}`, option });
    });
    return entries;
  }, [selectedProfile, selectedCampaign]);

  const selectedSelector =
    selectorOptions.find((entry) => entry.key === form.selectorVariant)?.option ||
    selectorOptions[0]?.option ||
    null;

  const activeForcekeys = form.forcekeys.map((value) => value.trim()).filter(Boolean);
  const readyChecks = [
    { label: "Preset selected", ok: !!selectedProfile },
    { label: "Article entered", ok: form.article.trim().length > 0 },
    { label: "Headline entered", ok: form.headline.trim().length > 0 },
    { label: "At least 5 forcekeys", ok: activeForcekeys.length >= 5 },
    { label: "Creative notes", ok: form.creativeNotes.trim().length > 0 },
  ];
  const readyCount = readyChecks.filter((item) => item.ok).length;

  const strategistPreview = selectedProfile
    ? {
        buyer: catalog?.lockedDefaults.buyer || buyer.toLowerCase(),
        networkName: catalog?.lockedDefaults.networkName || "facebook",
        country: catalog?.lockedDefaults.country || "US - United States of America",
        organization: catalog?.lockedDefaults.organization || "Interlincx",
        language:
          selectedProfile.strategist.language?.value ||
          catalog?.lockedDefaults.language ||
          "EN - English",
        rsocSite: form.rsocSite || selectedProfile.strategist.rsocSite?.value || "",
        subdirectory: selectedProfile.strategist.subdirectory?.value || "",
        templateId: selectedProfile.strategist.templateId?.value || "",
        redirectDomain: form.redirectDomain || selectedProfile.strategist.redirectDomain?.value || "",
        headline: form.headline,
        article: form.article,
        fbAdAccount: form.adAccountId || selectedProfile.strategist.fbAdAccount?.value || "",
        networkAccountId: form.networkAccountId || selectedProfile.strategist.networkAccountId?.value || "",
        forcekeys: activeForcekeys,
        namingFamilyHint: selectedProfile.strategist.namingFamily?.value || "",
      }
    : null;

  const facebookPreview =
    selectedProfile && selectedSelector
      ? {
          adAccountId: form.adAccountId || selectedProfile.facebook.adAccountId?.value || "",
          pageId: form.pageId || selectedProfile.facebook.pageId?.value || "",
          pixelId:
            selectedSelector.selector.promotedObject.pixelId ||
            selectedProfile.facebook.pixelId?.value ||
            "",
          objective: selectedProfile.facebook.locked.optimizationGoal,
          billingEvent: selectedProfile.facebook.locked.billingEvent,
          customEventType: selectedProfile.facebook.locked.customEventType,
          bidStrategy: form.bidCap.trim()
            ? "LOWEST_COST_WITH_BID_CAP"
            : selectedSelector.selector.bidStrategy || "LOWEST_COST_WITHOUT_CAP",
          bidAmount: form.bidCap.trim() || selectedSelector.selector.bidAmount || "",
          budgetPerAdSet: form.budgetAmount,
          targeting: selectedSelector.selector.targeting,
        }
      : null;

  const currentStrategisFingerprint = useMemo(
    () =>
      JSON.stringify({
        buyer,
        category: selectedProfile?.category || "",
        article: form.article.trim(),
        headline: form.headline.trim(),
        forcekeys: activeForcekeys,
        rsocSite: strategistPreview?.rsocSite || "",
        subdirectory: strategistPreview?.subdirectory || "",
        templateId: strategistPreview?.templateId || "",
        redirectDomain: strategistPreview?.redirectDomain || "",
        language: strategistPreview?.language || "",
        networkAccountId: strategistPreview?.networkAccountId || "",
        fbAdAccount: strategistPreview?.fbAdAccount || "",
      }),
    [
      activeForcekeys,
      buyer,
      form.article,
      form.headline,
      selectedProfile?.category,
      strategistPreview?.fbAdAccount,
      strategistPreview?.language,
      strategistPreview?.networkAccountId,
      strategistPreview?.redirectDomain,
      strategistPreview?.rsocSite,
      strategistPreview?.subdirectory,
      strategistPreview?.templateId,
    ]
  );

  const currentStrategisShell =
    strategisShell && strategisShell.fingerprint === currentStrategisFingerprint ? strategisShell : null;
  const currentStrategisRouteUrl = currentStrategisShell?.trackingUrl || "";

  const currentSiteAssociation =
    strategistPreview?.rsocSite ? siteAssociationBySite.get(strategistPreview.rsocSite) || null : null;

  useEffect(() => {
    if (!selectedProfile) return;
    setPacketForm((current) => ({
      ...current,
      category: current.category || selectedProfile.category,
      rsocSite: current.rsocSite || strategistPreview?.rsocSite || "",
      destinationDomain: current.destinationDomain || strategistPreview?.rsocSite || "",
      strategisTemplateId: current.strategisTemplateId || strategistPreview?.templateId || "",
      adAccountId: current.adAccountId || facebookPreview?.adAccountId || "",
      fbPage: current.fbPage || facebookPreview?.pageId || "",
    }));
  }, [
    selectedProfile,
    strategistPreview?.rsocSite,
    strategistPreview?.templateId,
    facebookPreview?.adAccountId,
    facebookPreview?.pageId,
  ]);

  const siteDropdownOptions = useMemo(
    () => {
      const primary = currentSiteAssociation
        ? [
            {
              value: currentSiteAssociation.site,
              label: siteOptionLabel({
                value: currentSiteAssociation.site,
                label: currentSiteAssociation.site,
                support: { count: currentSiteAssociation.campaignCount, pct: 1 },
                sampleCampaignIds: [],
                sampleCampaignNames: [],
                source: "history",
              }),
              support: { count: currentSiteAssociation.campaignCount, pct: 1 },
              sampleCampaignIds: [],
              sampleCampaignNames: [],
              source: "history" as const,
            },
          ]
        : [];
      const all = (launchIntelligence?.options.sites || []).map((option) => ({
        ...option,
        label: siteOptionLabel(option),
      }));
      return buildDropdownOptions(primary, all, strategistPreview?.rsocSite, "Current site");
    },
    [currentSiteAssociation, launchIntelligence, strategistPreview?.rsocSite]
  );

  const redirectDropdownOptions = useMemo(
    () =>
      buildDropdownOptions(
        currentSiteAssociation?.redirectDomains || [],
        launchIntelligence?.options.redirectDomains || [],
        form.redirectDomain,
        "Current redirect"
      ),
    [currentSiteAssociation, launchIntelligence, form.redirectDomain]
  );

  const adAccountDropdownOptions = useMemo(
    () =>
      buildDropdownOptions(
        currentSiteAssociation?.adAccounts || [],
        launchIntelligence?.options.adAccounts || [],
        form.adAccountId,
        "Current ad account"
      ),
    [currentSiteAssociation, launchIntelligence, form.adAccountId]
  );

  const pageDropdownOptions = useMemo(
    () =>
      buildDropdownOptions(
        currentSiteAssociation?.pages || [],
        launchIntelligence?.options.pages || [],
        form.pageId,
        "Current page"
      ),
    [currentSiteAssociation, launchIntelligence, form.pageId]
  );

  const allRedirectOptions = useMemo(
    () => buildDropdownOptions(currentSiteAssociation?.redirectDomains || [], launchIntelligence?.options.redirectDomains || []),
    [currentSiteAssociation, launchIntelligence]
  );

  const allPageOptions = useMemo(
    () => buildDropdownOptions(currentSiteAssociation?.pages || [], launchIntelligence?.options.pages || []),
    [currentSiteAssociation, launchIntelligence]
  );

  const allAdAccountOptions = useMemo(
    () => buildDropdownOptions(currentSiteAssociation?.adAccounts || [], launchIntelligence?.options.adAccounts || []),
    [currentSiteAssociation, launchIntelligence]
  );

  const currentRedirectLabel = useMemo(
    () => currentOptionLabel(form.redirectDomain, launchIntelligence?.options.redirectDomains || [], "Redirect"),
    [form.redirectDomain, launchIntelligence]
  );

  const currentPageLabel = useMemo(
    () => currentOptionLabel(form.pageId, launchIntelligence?.options.pages || [], "Page"),
    [form.pageId, launchIntelligence]
  );

  const currentAdAccountLabel = useMemo(
    () => currentOptionLabel(form.adAccountId, launchIntelligence?.options.adAccounts || [], "Ad account"),
    [form.adAccountId, launchIntelligence]
  );

  const entityPickerOptions = useMemo(() => {
    if (!entityPicker) return [];
    if (entityPicker.kind === "redirect") return launchIntelligence?.options.redirectDomains || [];
    if (entityPicker.kind === "page") return launchIntelligence?.options.pages || [];
    return launchIntelligence?.options.adAccounts || [];
  }, [entityPicker, launchIntelligence]);

  const filteredEntityPickerOptions = useMemo(() => {
    const lowered = entityPickerQuery.trim().toLowerCase();
    if (!lowered) return entityPickerOptions;
    return entityPickerOptions.filter((option) =>
      [option.label, option.value, ...option.sampleCampaignNames].some((value) =>
        String(value || "").toLowerCase().includes(lowered)
      )
    );
  }, [entityPickerOptions, entityPickerQuery]);

  function applySiteSelection(site: string) {
    const association = siteAssociationBySite.get(site) || null;
    const normalizedNextSite = normalizeSiteHost(site);
    const currentArticleHost =
      articleHostFromValue(form.article) ||
      (matchedCurrentArticle?.rsocSite ? normalizeSiteHost(matchedCurrentArticle.rsocSite) : null);
    const shouldClearSelectedArticle =
      Boolean(normalizedNextSite) &&
      Boolean(currentArticleHost) &&
      currentArticleHost !== normalizedNextSite;
    setForm((current) => ({
      ...current,
      rsocSite: site,
      redirectDomain: association?.redirectDomains[0]?.value || current.redirectDomain,
      pageId: association?.pages[0]?.value || current.pageId,
      adAccountId: association?.adAccounts[0]?.value || current.adAccountId,
      networkAccountId: association?.networkAccounts[0]?.value || current.networkAccountId,
    }));
    if (shouldClearSelectedArticle) {
      setSelectedArticleKey("");
      setArticleQuery("");
    }
  }

  function openEntityPicker(kind: "redirect" | "page" | "adAccount") {
    setEntityPickerQuery("");
    if (kind === "redirect") {
      setEntityPicker({ kind, title: "All redirect domains", placeholder: "Search redirect domains..." });
      return;
    }
    if (kind === "page") {
      setEntityPicker({ kind, title: "All Facebook pages", placeholder: "Search page names or IDs..." });
      return;
    }
    setEntityPicker({ kind, title: "All ad accounts", placeholder: "Search ad account names or IDs..." });
  }

  function closeEntityPicker() {
    setEntityPicker(null);
    setEntityPickerQuery("");
  }

  function hydrateFromCampaign(campaign: BenCampaignCatalogItem) {
    const matchingProfile = profiles.find((profile) => profile.category === campaign.category);
    if (matchingProfile) setSelectedProfileId(matchingProfile.profileId);

    const matchingArticle =
      (articleCatalog?.items || []).find((item) => item.campaignIds.includes(campaign.campaignId)) ||
      (articleCatalog?.items || []).find(
        (item) =>
          (campaign.articleUrl && item.articleUrl === campaign.articleUrl) ||
          (campaign.articlePath && item.articlePath === campaign.articlePath)
      ) ||
      null;

    setSelectedArticleKey(matchingArticle?.articleKey || "");
    setArticleQuery("");
    setSelectedCampaignId(campaign.campaignId);

    setForm({
      article: campaign.articleUrl || campaign.articlePath || campaign.article || "",
      headline: campaign.headline || "",
      forcekeys: Array.from({ length: 12 }, (_, index) => campaign.forcekeys[index] || ""),
      budgetAmount: campaign.facebook.budgetAmount || "30",
      bidCap: campaign.facebook.bidCap || "",
      creativeNotes: `Clone shell from ${campaign.campaignName}. Upload fresh creatives in Facebook.`,
      creativeMode: "inherit",
      creativeAssetUrl: "",
      creativePrimaryText: "",
      creativeDescription: "",
      creativeCallToActionType: "LEARN_MORE",
      selectorVariant: campaign.facebook.cloneSelector ? "cloned" : "primary",
      rsocSite: campaign.rsocSite || "",
      redirectDomain: campaign.redirectDomain || "",
      pageId: campaign.facebook.pageId || campaign.fbPage || "",
      adAccountId: campaign.facebook.adAccountId || campaign.networkAccountId || campaign.fbAdAccount || "",
      networkAccountId: campaign.networkAccountId || "",
    });
  }

  async function handleCopy(section: string, value: unknown) {
    await copyJson(value);
    setCopied(section);
    window.setTimeout(() => setCopied(null), 1200);
  }

  function addForcekeyToNextOpenSlot(forcekey: string) {
    setForm((current) => {
      const next = [...current.forcekeys];
      const existingIndex = next.findIndex(
        (value) => value.trim().toLowerCase() === forcekey.trim().toLowerCase()
      );
      if (existingIndex >= 0) return current;
      const targetIndex = next.findIndex((value) => !value.trim());
      if (targetIndex >= 0) {
        next[targetIndex] = forcekey;
      } else {
        next[next.length - 1] = forcekey;
      }
      return { ...current, forcekeys: next };
    });
  }

  function replaceForcekeyStack(stack: string[]) {
    setForm((current) => ({
      ...current,
      forcekeys: Array.from({ length: 12 }, (_, index) => stack[index] || ""),
    }));
  }

  function moveSelectedForcekey(fromIndex: number, direction: -1 | 1) {
    const active = form.forcekeys.map((value) => value.trim()).filter(Boolean);
    const targetIndex = fromIndex + direction;
    if (fromIndex < 0 || targetIndex < 0 || fromIndex >= active.length || targetIndex >= active.length) return;
    const next = [...active];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, moved);
    replaceForcekeyStack(next);
  }

  function removeSelectedForcekey(atIndex: number) {
    const active = form.forcekeys.map((value) => value.trim()).filter(Boolean);
    if (atIndex < 0 || atIndex >= active.length) return;
    replaceForcekeyStack(active.filter((_, index) => index !== atIndex));
  }

  function applyTopForcekeys(count: number) {
    if (!forcekeySelector?.options?.length) return;
    const top = forcekeySelector.options.slice(0, count).map((option) => option.forcekey);
    replaceForcekeyStack(top);
    setShowAllForcekeys(count > 5);
  }

  const canRunStrategisSetup =
    Boolean(selectedProfile) &&
    Boolean(strategistPreview?.templateId) &&
    Boolean(strategistPreview?.rsocSite) &&
    Boolean(form.article.trim()) &&
    Boolean(form.headline.trim()) &&
    !articleSiteMismatch &&
    activeForcekeys.length >= 1;

  const canRunFacebookCloneBase =
    Boolean(selectedProfile) &&
    Boolean(selectedCampaign?.campaignId) &&
    Boolean((facebookPreview?.adAccountId || form.adAccountId).trim()) &&
    Boolean(form.article.trim()) &&
    Boolean(form.headline.trim()) &&
    !articleSiteMismatch &&
    (form.creativeMode === "inherit" || Boolean(form.creativeAssetUrl.trim())) &&
    activeForcekeys.length >= 1;

  const canRunFacebookSetup = canRunFacebookCloneBase && Boolean(currentStrategisRouteUrl);

  const canRunBothSetup = canRunStrategisSetup && canRunFacebookCloneBase;

  const strategisReadinessChecks: ReadinessCheck[] = [
    { label: "Preset selected", ok: Boolean(selectedProfile) },
    { label: "Template selected", ok: Boolean(strategistPreview?.templateId) },
    { label: "RSOC site selected", ok: Boolean(strategistPreview?.rsocSite) },
    {
      label: "Article matches selected site",
      ok: !articleSiteMismatch,
      detail: articleSiteMismatchMessage || undefined,
    },
    { label: "Article provided", ok: Boolean(form.article.trim()) },
    { label: "Headline provided", ok: Boolean(form.headline.trim()) },
    { label: "At least one forcekey", ok: activeForcekeys.length >= 1 },
  ];

  const facebookCloneBaseReadinessChecks: ReadinessCheck[] = [
    { label: "Preset selected", ok: Boolean(selectedProfile) },
    {
      label: "Article matches selected site",
      ok: !articleSiteMismatch,
      detail: articleSiteMismatchMessage || undefined,
    },
    { label: "Clone source selected", ok: Boolean(selectedCampaign?.campaignId) },
    {
      label: "Source Facebook shell found",
      ok: Boolean(selectedCampaign?.facebook.facebookCampaignId),
      detail: selectedCampaign?.campaignId && !selectedCampaign?.facebook.facebookCampaignId
        ? "This source campaign is missing a mapped Facebook campaign id."
        : undefined,
    },
    { label: "Ad account available", ok: Boolean((facebookPreview?.adAccountId || form.adAccountId).trim()) },
    { label: "Article provided", ok: Boolean(form.article.trim()) },
    { label: "Headline provided", ok: Boolean(form.headline.trim()) },
    {
      label: "Creative asset present for upload mode",
      ok: form.creativeMode === "inherit" || Boolean(form.creativeAssetUrl.trim()),
      detail: form.creativeMode === "inherit" ? "Source media will be reused." : undefined,
    },
  ];

  const facebookReadinessChecks: ReadinessCheck[] = [
    {
      label: "Strategis route URL available",
      ok: Boolean(currentStrategisRouteUrl),
      detail: currentStrategisRouteUrl
        ? undefined
        : "Run Setup in Strategis first so Facebook can use the created route URL.",
    },
    ...facebookCloneBaseReadinessChecks,
  ];

  const bothReadinessChecks: ReadinessCheck[] = [
    ...strategisReadinessChecks,
    {
      label: "Strategis route URL will be created during setup",
      ok: true,
      detail: "Setup in Both creates the Strategis shell first, then uses that route URL for Facebook.",
    },
    ...facebookCloneBaseReadinessChecks,
  ];

  function buildSetupPayload(mode: SetupMode, dryRun: boolean) {
    if (!selectedProfile || !strategistPreview) return null;

    const setupFacebookPayload = facebookPreview
      ? {
          adAccountId: facebookPreview.adAccountId,
          pageId: facebookPreview.pageId,
          pixelId: facebookPreview.pixelId,
          objective: facebookPreview.objective,
          customEventType: facebookPreview.customEventType,
          bidStrategy: facebookPreview.bidStrategy,
          bidAmount: facebookPreview.bidAmount,
          budgetPerAdSet: facebookPreview.budgetPerAdSet,
          targeting: facebookPreview.targeting,
        }
      : {
          adAccountId: form.adAccountId.trim(),
          pageId: form.pageId.trim(),
          pixelId: "",
          objective: "",
          customEventType: "",
          bidStrategy: "",
          bidAmount: form.bidCap.trim(),
          budgetPerAdSet: form.budgetAmount.trim(),
          targeting: {},
        };

    return {
      dryRun,
      mode,
      buyer,
      strategisCampaignId: currentStrategisShell?.id || undefined,
      strategisRouteUrl: currentStrategisRouteUrl || undefined,
      category: selectedProfile.category,
      article: form.article.trim(),
      headline: form.headline.trim(),
      forcekeys: activeForcekeys,
      strategist: {
        rsocSite: strategistPreview.rsocSite,
        subdirectory: strategistPreview.subdirectory,
        templateId: strategistPreview.templateId,
        redirectDomain: strategistPreview.redirectDomain,
        language: strategistPreview.language,
        networkAccountId: strategistPreview.networkAccountId,
        namingFamilyHint: strategistPreview.namingFamilyHint,
      },
      facebook: {
        ...setupFacebookPayload,
        creativeMode: form.creativeMode,
        creativeAssetUrl: form.creativeAssetUrl.trim(),
        creativePrimaryText: form.creativePrimaryText.trim(),
        creativeDescription: form.creativeDescription.trim(),
        creativeCallToActionType: form.creativeCallToActionType.trim(),
      },
      cloneSource: selectedCampaign
        ? {
            campaignId: selectedCampaign.campaignId,
            campaignName: selectedCampaign.campaignName,
          }
        : null,
    };
  }

  async function runDryRunRequest(mode: SetupMode) {
    if (!selectedProfile || !strategistPreview) return;
    if (mode !== "strategis" && !((facebookPreview?.adAccountId || form.adAccountId).trim())) return;
    const payload = buildSetupPayload(mode, true);
    if (!payload) return null;

    try {
      setRunningDryRun(mode);
      setDryRunError(null);
      setDryRunResult(null);
      const response = await fetch("/api/ben-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.message || json?.error || "Dry run failed");
      }
      setDryRunResult(json);
      return json as DryRunResponse;
    } catch (error) {
      setDryRunError(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setRunningDryRun(null);
    }
  }

  async function handleDryRun(mode: SetupMode) {
    await runDryRunRequest(mode);
  }

  async function handleSetup(mode: SetupMode) {
    if (!selectedProfile || !strategistPreview) return;
    if (mode !== "strategis" && !((facebookPreview?.adAccountId || form.adAccountId).trim())) return;
    setConfirmError(null);
    const preview = await runDryRunRequest(mode);
    if (!preview) return;
    setConfirmPreview(preview);
    setConfirmMode(mode);
  }

  async function confirmAndRunSetup() {
    if (!confirmMode) return;
    const payload = buildSetupPayload(confirmMode, false);
    if (!payload) return;

    try {
      setRunningSetup(confirmMode);
      setSetupError(null);
      setSetupResult(null);
      setConfirmError(null);
      const response = await fetch("/api/ben-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.message || json?.error || "Setup failed");
      }
      setSetupResult(json);
      const createdStrategisShell = json?.result?.strategisCampaigns?.[0];
      if (
        createdStrategisShell?.id &&
        createdStrategisShell?.trackingUrl &&
        typeof createdStrategisShell.trackingUrl === "string"
      ) {
        setStrategisShell({
          id: createdStrategisShell.id,
          name: createdStrategisShell.name || json?.result?.campaignName || createdStrategisShell.id,
          trackingUrl: createdStrategisShell.trackingUrl,
          fingerprint: currentStrategisFingerprint,
        });
      }
      setConfirmMode(null);
      setConfirmPreview(null);
      try {
        const historyResponse = await fetch(`/api/ben-launch-history?buyer=${encodeURIComponent(buyer)}&limit=8`, {
          cache: "no-store",
        });
        const historyJson = await historyResponse.json();
        if (historyResponse.ok) setLaunchHistory(historyJson);
      } catch {
        // Ignore launch history refresh failures; setup itself already succeeded.
      }
    } catch (error) {
      const message = normalizeErrorMessage(error);
      setSetupError(message);
      setConfirmError(message);
    } finally {
      setRunningSetup(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function handleIntentPacketPreview() {
    try {
      setPacketPreviewLoading(true);
      setPacketPreviewError(null);
      setPacketPreview(null);

      const supportingKeywords = packetForm.supportingKeywords
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean);

      const response = await fetch("/api/intent-packets/deploy-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          packet: {
            primaryKeyword: packetForm.primaryKeyword.trim(),
            supportingKeywords,
            vertical: packetForm.vertical || undefined,
            market: packetForm.market.trim() || "US",
            buyer,
            rsocSite: packetForm.rsocSite.trim() || undefined,
            destinationDomain: packetForm.destinationDomain.trim() || undefined,
          },
          deployConfig: {
            organization: "Interlincx",
            buyer,
            category: packetForm.category.trim(),
            adAccountId: packetForm.adAccountId.trim(),
            domain: packetForm.destinationDomain.trim(),
            destination: packetForm.destination.trim() || "Lincx",
            strategisTemplateId: packetForm.strategisTemplateId.trim(),
            fbPage: packetForm.fbPage.trim() || undefined,
            rsocSite: packetForm.rsocSite.trim() || undefined,
            creativeMode: packetForm.creativeMode,
            publicVideoUrl: packetForm.publicVideoUrl.trim() || undefined,
          },
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.message || json?.error || "Intent packet preview failed");
      }
      setPacketPreview(json);
    } catch (error) {
      setPacketPreviewError(error instanceof Error ? error.message : String(error));
    } finally {
      setPacketPreviewLoading(false);
    }
  }

  const packetModePanel = (
    <div className="space-y-6">
      <div className="rounded-[22px] border border-[#0071e3]/20 bg-[#0071e3]/[0.06] px-5 py-4 text-sm text-neutral-800 dark:border-[#0a84ff]/30 dark:bg-[#0a84ff]/[0.10] dark:text-neutral-100">
        <div className="font-semibold text-neutral-900 dark:text-neutral-50">Intent packet lane</div>
        <div className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
          This is the more-from-scratch lane. It should be used when the buyer is starting from a concept, packet,
          or brand-new category shape rather than inheriting a specific historical shell.
        </div>
        <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
          The current implementation is preview-first: it builds the Strategis/Facebook shell plan and blockers
          without cluttering the clone workflow or triggering live setup from this page yet.
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <div className={fieldLabel}>Primary keyword</div>
          <input
            value={packetForm.primaryKeyword}
            onChange={(e) => setPacketForm((current) => ({ ...current, primaryKeyword: e.target.value }))}
            placeholder="online school that gives you $ and laptops"
            className={inputClass}
          />
        </label>
        <label className="block">
          <div className={fieldLabel}>Supporting keywords</div>
          <textarea
            value={packetForm.supportingKeywords}
            onChange={(e) => setPacketForm((current) => ({ ...current, supportingKeywords: e.target.value }))}
            placeholder="One per line or comma-separated"
            className={`${inputClass} min-h-[88px]`}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block">
          <div className={fieldLabel}>Vertical</div>
          <Dropdown
            value={packetForm.vertical}
            onChange={(value) => setPacketForm((current) => ({ ...current, vertical: value }))}
            options={PACKET_VERTICAL_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          />
        </label>
        <label className="block">
          <div className={fieldLabel}>Market</div>
          <input
            value={packetForm.market}
            onChange={(e) => setPacketForm((current) => ({ ...current, market: e.target.value }))}
            placeholder="US"
            className={inputClass}
          />
        </label>
        <label className="block xl:col-span-2">
          <div className={fieldLabel}>Launch category</div>
          <input
            value={packetForm.category}
            onChange={(e) => setPacketForm((current) => ({ ...current, category: e.target.value }))}
            placeholder="Education > Training > High School Diploma"
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block">
          <div className={fieldLabel}>RSOC site</div>
          <Dropdown
            value={packetForm.rsocSite}
            onChange={(value) => setPacketForm((current) => ({ ...current, rsocSite: value, destinationDomain: current.destinationDomain || value }))}
            options={siteDropdownOptions}
            placeholder="Select site"
          />
        </label>
        <label className="block">
          <div className={fieldLabel}>Destination domain</div>
          <input
            value={packetForm.destinationDomain}
            onChange={(e) => setPacketForm((current) => ({ ...current, destinationDomain: e.target.value }))}
            placeholder="simpliworld.com"
            className={inputClass}
          />
        </label>
        <label className="block">
          <div className={fieldLabel}>Strategis destination</div>
          <input
            value={packetForm.destination}
            onChange={(e) => setPacketForm((current) => ({ ...current, destination: e.target.value }))}
            placeholder="Lincx"
            className={inputClass}
          />
        </label>
        <label className="block">
          <div className={fieldLabel}>Template ID</div>
          <input
            value={packetForm.strategisTemplateId}
            onChange={(e) => setPacketForm((current) => ({ ...current, strategisTemplateId: e.target.value }))}
            placeholder="cm1kw4pev00mb0bs6h4x9eu6k"
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block xl:col-span-2">
          <div className={fieldLabel}>Facebook page</div>
          <Dropdown
            value={packetForm.fbPage}
            onChange={(value) => setPacketForm((current) => ({ ...current, fbPage: value }))}
            options={pageDropdownOptions}
            placeholder="Select page"
          />
        </label>
        <label className="block xl:col-span-2">
          <div className={fieldLabel}>Ad account</div>
          <Dropdown
            value={packetForm.adAccountId}
            onChange={(value) => setPacketForm((current) => ({ ...current, adAccountId: value }))}
            options={adAccountDropdownOptions}
            placeholder="Select ad account"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <div className={fieldLabel}>Creative mode</div>
          <Dropdown
            value={packetForm.creativeMode}
            onChange={(value) =>
              setPacketForm((current) => ({
                ...current,
                creativeMode: value as IntentPacketFormState["creativeMode"],
              }))
            }
            options={[
              { value: "link", label: "Link creative" },
              { value: "video_url", label: "Video creative" },
            ]}
          />
        </label>
        <label className="block">
          <div className={fieldLabel}>Public video URL</div>
          <input
            value={packetForm.publicVideoUrl}
            onChange={(e) => setPacketForm((current) => ({ ...current, publicVideoUrl: e.target.value }))}
            placeholder="Only needed for video creative preview"
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleIntentPacketPreview()}
          disabled={packetPreviewLoading}
          className={buttonPrimary}
        >
          <span className="inline-flex items-center gap-2">
            {packetPreviewLoading ? <ButtonSpinner /> : null}
            <span>{packetPreviewLoading ? "Previewing…" : "Preview intent packet launch"}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setPacketForm(emptyIntentPacketForm());
            setPacketPreview(null);
            setPacketPreviewError(null);
          }}
          className={buttonOutline}
        >
          Clear packet form
        </button>
      </div>

      {packetPreviewError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {packetPreviewError}
        </div>
      ) : null}

      {packetPreview ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                  Packet preview
                </div>
                <div className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                  {packetPreview.packet.packetName}
                </div>
              </div>
              <span className={packetPreview.readyForLiveDeploy ? pillClass : "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"}>
                {packetPreview.readyForLiveDeploy ? "Preview ready" : "Blocked"}
              </span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
              <div className="rounded-lg bg-white/80 dark:bg-neutral-900/70 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">Primary keyword</div>
                <div className="mt-1 font-semibold text-neutral-900 dark:text-neutral-50">{packetPreview.packet.intent.primaryKeyword}</div>
              </div>
              <div className="rounded-lg bg-white/80 dark:bg-neutral-900/70 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">Launch priority</div>
                <div className="mt-1 font-semibold text-neutral-900 dark:text-neutral-50">{packetPreview.packet.scores.launchPriority}</div>
              </div>
              <div className="rounded-lg bg-white/80 dark:bg-neutral-900/70 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">Recommended daily budget</div>
                <div className="mt-1 font-semibold text-neutral-900 dark:text-neutral-50">${packetPreview.packet.launchTest.recommendedDailyBudget}</div>
              </div>
            </div>
          </div>

          {packetPreview.blockers.length ? (
            <div className="rounded-xl bg-amber-100/70 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="font-semibold">Preview blockers</div>
              <ul className="mt-2 space-y-1">
                {packetPreview.blockers.map((blocker) => (
                  <li key={blocker}>• {blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 px-4 py-3 text-sm">
              <div className="font-semibold text-neutral-900 dark:text-neutral-50">Strategis shell plan</div>
              <div className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                <div>Category: {packetForm.category || "Missing"}</div>
                <div>Site: {packetForm.rsocSite || "Missing"}</div>
                <div>Template: {packetForm.strategisTemplateId || "Missing"}</div>
                <div>Destination: {packetForm.destination || "Missing"}</div>
                <div>Article: {packetPreview.packet.article.title}</div>
              </div>
            </div>
            <div className="rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 px-4 py-3 text-sm">
              <div className="font-semibold text-neutral-900 dark:text-neutral-50">Facebook shell plan</div>
              <div className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                <div>Ad account: {packetForm.adAccountId || "Missing"}</div>
                <div>Page: {packetForm.fbPage || "Missing"}</div>
                <div>Creative mode: {packetPreview.creativeMode}</div>
                <div>Campaign create: {packetPreview.facebook.campaignRequest ? "yes" : "no"}</div>
                <div>Ad set create: {packetPreview.facebook.adSetRequest ? "yes" : "no"}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 px-4 py-3 text-sm">
            <div className="font-semibold text-neutral-900 dark:text-neutral-50">Why this lane is separate</div>
            <ul className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
              {packetPreview.shellContract.notes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (loading || sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400">
        <div className={`${cardClass} px-6 py-4 text-sm`}>Loading {buyerLabel} preset catalog…</div>
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-neutral-950 px-6 text-neutral-700 dark:text-neutral-200">
        <div className={`${cardClass} max-w-lg p-6`}>
          <p className="text-base font-semibold text-neutral-900 dark:text-neutral-50">Could not load buyer workbench</p>
          <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">{error || "Unknown error"}</p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">
      {/* Dashboard pane */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] space-y-12 px-4 py-8 sm:px-6 sm:py-12">
          {/* Top bar — Liftoff badge (with buyer name beneath) on the left,
              theme toggle + log out + assistant icon on the right. All
              right-side controls share a 32px height for visual alignment. */}
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="inline-flex h-6 w-fit items-center rounded-md bg-[#0071e3]/12 dark:bg-[#0071e3]/[0.20] px-2 text-[11px] font-semibold uppercase tracking-wider text-[#0071e3] dark:text-[#4a9fff] ring-1 ring-inset ring-[#0071e3]/15 dark:ring-[#0071e3]/30">
                Liftoff
              </div>
              {canSwitchBuyer ? (
                <div className="min-w-[220px]">
                  <Dropdown
                    value={buyer}
                    onChange={(nextBuyer) => setBuyer(nextBuyer)}
                    options={BUYER_OPTIONS.filter((option) =>
                      sessionInfo?.allowedBuyers?.includes(option.value)
                    ).map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                </div>
              ) : (
                <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                  {sessionInfo?.displayName || buyerLabel}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="inline-flex h-8 items-center rounded-lg bg-neutral-100 px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                Log out
              </button>
              <button
                type="button"
                onClick={() => setChatOpen((v) => !v)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                aria-label={chatOpen ? "Hide assistant" : "Show assistant"}
                title={chatOpen ? "Hide assistant" : "Show assistant"}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </button>
            </div>
          </header>

          {Object.entries(catalog.lockedDefaults).filter(([key]) => key !== "buyer").length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 xl:max-w-[calc(100%-352px)]">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                Locked defaults
              </span>
              {Object.entries(catalog.lockedDefaults)
                .filter(([key]) => key !== "buyer")
                .map(([key, value]) => (
                  <span key={key} className={pillPublishClass}>
                    {key}: {value}
                  </span>
                ))}
            </div>
          ) : null}

          {/* Flow layout — no canvas card; form and rail sit on the page bg */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-8 xl:grid-cols-[minmax(0,1fr)_320px]">
              {/* Form column */}
              <section>
              {!selectedProfile ? null : (
                <div className="space-y-8">
                  {/* Start mode */}
                  <div className="space-y-3">
                    <div className={sectionLabel}>Start mode</div>
                    <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
                      {LAUNCH_MODE_OPTIONS.map((option) => {
                        const active = launchMode === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setLaunchMode(option.value)}
                            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                              active
                                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-neutral-50"
                                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {LAUNCH_MODE_OPTIONS.find((option) => option.value === launchMode)?.description}
                    </div>
                  </div>

                  {/* Launch preset */}
                  <div className="space-y-3">
                    <div className={sectionLabel}>Launch preset</div>
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
                      {launchMode !== "clone" ? (
                      <div className="space-y-2">
                        <label className={fieldLabel}>Category preset</label>
                        <Combobox
                          value={selectedProfile.profileId}
                          onChange={(v) => {
                            if (!v) return;
                            setSelectedProfileId(v);
                            setSelectedCampaignId("");
                            setForm(emptyForm());
                          }}
                          options={catalog.profiles.map((p) => ({
                            value: p.profileId,
                            label: p.category,
                          }))}
                          placeholder="Search categories…"
                          emptyLabel="No category presets match"
                        />
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {catalog.profiles.length} category preset{catalog.profiles.length === 1 ? "" : "s"} available.
                        </div>
                      </div>
                      ) : null}

                      {launchMode === "clone" ? (
                      <div className="space-y-2">
                        <label className={fieldLabel}>Clone existing campaign</label>
                        <Combobox
                          value={selectedCampaignId}
                          onChange={(v) => {
                            if (!v) {
                              setSelectedCampaignId("");
                              setForm(emptyForm());
                              return;
                            }
                            const nextCampaign = campaignItems.find((c) => c.campaignId === v);
                            if (nextCampaign) hydrateFromCampaign(nextCampaign);
                          }}
                          options={campaignItems.map((c) => ({
                            value: c.campaignId,
                            label: c.campaignName,
                          }))}
                          placeholder={`Search ${buyerLabel} campaigns…`}
                          emptyLabel={`No ${buyerLabel} campaigns match`}
                        />
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {campaignItems.length > 0
                            ? `${campaignItems.length} ${buyerLabel} campaigns available for cloning`
                            : campaignCatalog?.notes?.[0] || "Campaign clone catalog unavailable"}
                        </div>
                      </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Preset summary */}
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2.5">
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">Current preset</div>
                        <div className="font-semibold text-neutral-900 dark:text-neutral-50">{selectedProfile.label}</div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {selectedProfile.category.split(" > ").slice(0, -1).join(" • ") || "Category"}
                        </div>
                      </div>
                      <div className="space-y-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2.5">
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">Naming family</div>
                        <div className="font-mono text-xs text-neutral-700 dark:text-neutral-200">
                          {selectedProfile.strategist.namingFamily?.value || "No dominant family"}
                        </div>
                      </div>
                    </div>

                    {launchMode === "clone" && selectedCampaign ? (
                      <div className="flex flex-wrap gap-2">
                        <span className={pillClass}>clone {selectedCampaign.campaignId}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Launch controls — where this campaign is going to land.
                      Site cascade: changing site auto-recommends redirect, page,
                      and ad account. Historical associations show with a green
                      bullet inside the dropdowns. */}
                  <div className="space-y-3">
                    <div className={sectionLabel}>Launch controls</div>
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
                      <div className="min-w-0 md:col-span-2">
                        <div className={fieldLabel}>RSOC site</div>
                        <Dropdown
                          value={form.rsocSite || strategistPreview?.rsocSite || ""}
                          onChange={applySiteSelection}
                          options={siteDropdownOptions}
                          placeholder="Select site"
                          tone="publish"
                        />
                        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          Changing the site recommends the redirect, page, and ad account that {buyerLabel} has historically paired with it.
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className={fieldLabel}>Redirect domain</div>
                          <button type="button" onClick={() => openEntityPicker("redirect")} className="text-xs font-medium text-[#0071e3] hover:underline">
                            Show more
                          </button>
                        </div>
                        <Dropdown
                          value={form.redirectDomain}
                          onChange={(value) => setForm((c) => ({ ...c, redirectDomain: value }))}
                          options={redirectDropdownOptions}
                          placeholder="Select redirect domain"
                          tone="publish"
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className={fieldLabel}>Facebook page</div>
                          <button type="button" onClick={() => openEntityPicker("page")} className="text-xs font-medium text-[#0071e3] hover:underline">
                            Show more
                          </button>
                        </div>
                        <Dropdown
                          value={form.pageId}
                          onChange={(value) => setForm((c) => ({ ...c, pageId: value }))}
                          options={pageDropdownOptions}
                          placeholder="Select page"
                          tone="publish"
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className={fieldLabel}>Ad account</div>
                          <button type="button" onClick={() => openEntityPicker("adAccount")} className="text-xs font-medium text-[#0071e3] hover:underline">
                            Show more
                          </button>
                        </div>
                        <Dropdown
                          value={form.adAccountId}
                          onChange={(value) => setForm((c) => ({ ...c, adAccountId: value }))}
                          options={adAccountDropdownOptions}
                          placeholder="Select ad account"
                          tone="publish"
                        />
                      </div>

                      <div className="min-w-0">
                        <div className={fieldLabel}>Selector variant</div>
                        <Dropdown
                          value={form.selectorVariant}
                          onChange={(v) => setForm((c) => ({ ...c, selectorVariant: v }))}
                          options={selectorOptions.map((entry) => ({
                            value: entry.key,
                            label: entry.option.label,
                          }))}
                          tone="publish"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-black/[0.06] dark:bg-white/[0.10]" />

                  {launchMode === "packet" ? packetModePanel : null}

                  {/* Content inputs */}
                  <div className={launchMode === "packet" ? "hidden space-y-4" : "space-y-4"}>
                    <div className={sectionLabel}>Content inputs</div>

                      {selectedCampaign ? (
                        <div className="mb-3 rounded-xl bg-[#0071e3]/[0.06] px-3 py-2.5 text-xs text-neutral-900 dark:text-neutral-50">
                          Cloning shell from{" "}
                          <span className="font-semibold">{selectedCampaign.campaignName}</span>. Article, headline,
                          forcekeys, redirect, page, and account are copied. Creatives are out of scope.
                        </div>
                      ) : null}

                      {/* Single source of truth — the canonical article field on top,
                          a 'pick from catalog' search affordance beneath. */}
                      <div className="space-y-3">
                        <div>
                          <label className={fieldLabel}>Article</label>
                          <input
                            value={form.article}
                            onChange={(e) => setForm((c) => ({ ...c, article: e.target.value }))}
                            placeholder="Article URL or path"
                            className={inputClass}
                          />
                          {articleSiteMismatch ? (
                            <div className="mt-2 rounded-xl bg-[#ff9500]/[0.10] px-3 py-2 text-xs text-[#a55a00] dark:text-[#ffb84a]">
                              <div className="font-medium">Article/site mismatch</div>
                              <div className="mt-1">{articleSiteMismatchMessage}</div>
                            </div>
                          ) : null}
                          {hasCurrentArticle && currentArticleRecord ? (
                            <div className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                              {currentArticleRecord.label} · used in {currentArticleRecord.campaignCount || 0} campaign{currentArticleRecord.campaignCount === 1 ? "" : "s"} · buyers: {currentArticleRecord.buyers.join(", ")}
                            </div>
                          ) : hasCurrentArticle ? (
                            <div className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                              {articleLooksLikeUrl ? "Direct URL." : "Article path."} Goes to Strategis as-is.
                            </div>
                          ) : (
                            <div className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                              Paste a URL/path or pick one from the catalog below.
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                            {hasCurrentArticle ? `Replace from ${buyerLabel}'s catalog` : `Pick from ${buyerLabel}'s catalog`}
                          </div>
                          <Combobox
                            value={selectedArticleByKey?.articleKey || ""}
                            onChange={(v) => {
                              setSelectedArticleKey(v);
                              const nextArticle = (effectiveArticlePool.length > 0 ? effectiveArticlePool : articleCatalog?.items || []).find(
                                (item) => item.articleKey === v
                              );
                              setForm((current) => ({
                                ...current,
                                article: nextArticle?.articleUrl || nextArticle?.articlePath || current.article,
                                headline: nextArticle?.headlineHints?.[0] || current.headline,
                              }));
                            }}
                            options={filteredArticles.map((item) => ({
                              value: item.articleKey,
                              label: formatArticleBuyerLabel(item, buyer),
                            }))}
                            placeholder={hasCurrentArticle ? `Search ${buyerLabel}'s articles to replace…` : `Search ${buyerLabel}'s articles…`}
                            emptyLabel={
                              selectedSiteHost
                                ? `No ${buyerLabel} articles match ${selectedSiteHost}`
                                : `No ${buyerLabel} articles match`
                            }
                          />
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            {selectedSiteScopedArticles.length > 0 ? (
                              <>
                                Showing articles on <span className="font-medium">{form.rsocSite || strategistPreview?.rsocSite || "the selected site"}</span> first. {buyerLabel}&rsquo;s history ranks next. If an article comes from another buyer&rsquo;s history, the buyer name appears in the result label.
                              </>
                            ) : (
                              <>
                                No site-matching article history was found for <span className="font-medium">{form.rsocSite || strategistPreview?.rsocSite || "the selected site"}</span>. Broader catalog results are shown instead.
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <label className="block">
                        <div className={fieldLabel}>Headline</div>
                        <input
                          value={form.headline}
                          onChange={(e) => setForm((c) => ({ ...c, headline: e.target.value }))}
                          placeholder={`Headline ${buyerLabel} wants attached to this launch`}
                          className={inputClass}
                        />
                      </label>

                      <details className="group space-y-4">
                        <summary className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
                          <div className={sectionLabel}>Forcekey selector</div>
                          <details
                            className="group/info relative"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <summary
                              className="inline-flex h-3.5 w-3.5 translate-y-[1px] cursor-pointer list-none items-center justify-center rounded-full bg-neutral-200 text-[8px] font-bold leading-none text-neutral-600 transition hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600 [&::-webkit-details-marker]:hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              i
                            </summary>
                            <div className="absolute left-0 top-7 z-30 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-black/[0.08] bg-white p-3 text-sm text-neutral-700 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18)] dark:border-white/[0.10] dark:bg-neutral-900 dark:text-neutral-200">
                              <div className="font-semibold text-neutral-900 dark:text-neutral-50">How to use this section</div>
                              <div className="mt-2 space-y-2">
                                <div>
                                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">Step 1</div>
                                  <div className="mt-0.5">Click <code>Add</code> on ranked keywords or use <code>Autofill top 6/12</code>.</div>
                                </div>
                                <div>
                                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">Step 2</div>
                                  <div className="mt-0.5">Use <code>Show all ranked keywords</code> to investigate beyond the default list.</div>
                                </div>
                                <div>
                                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">Step 3</div>
                                  <div className="mt-0.5">Selected rows show slot badges and reorder controls directly in the table.</div>
                                </div>
                              </div>
                            </div>
                          </details>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="ml-1 text-neutral-500 transition-transform duration-150 group-open:rotate-180 dark:text-neutral-400"
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </summary>

                        <div className="mt-3 space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                {forcekeySelector?.dateWindow.label ||
                                  `Trailing 14 complete days: ${forcekeyWindow.startDate} - ${forcekeyWindow.endDate}`}
                              </div>
                              <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                                Excludes the current partial day.
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setForcekeyWindow(trailingCompleteDayWindow(14));
                                  setForcekeyRefreshNonce((value) => value + 1);
                                }}
                                className={buttonGhost}
                              >
                                Refresh stats
                              </button>
                              <button
                                type="button"
                                onClick={() => applyTopForcekeys(6)}
                                disabled={!forcekeySelector?.options?.length}
                                className={buttonGhost}
                              >
                                Autofill top 6
                              </button>
                              <button
                                type="button"
                                onClick={() => applyTopForcekeys(12)}
                                disabled={!forcekeySelector?.options?.length}
                                className={buttonGhost}
                              >
                                Autofill top 12
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                          <span className={pillClass}>Category: {selectedProfile.category}</span>
                          {forcekeySelector ? (
                            <>
                              <span className={pillClass}>
                                Category baseline RPS {forcekeySelector.baselines.category.rps.toFixed(2)}
                              </span>
                              <span className={pillClass}>
                                Network baseline RPS {forcekeySelector.baselines.network.rps.toFixed(2)}
                              </span>
                            </>
                          ) : null}
                        </div>

                        {forcekeySelectorLoading ? (
                          <div className="text-sm text-neutral-500 dark:text-neutral-400">
                            Loading forcekey analysis…
                          </div>
                        ) : forcekeySelectorError ? (
                          <div className="rounded-xl bg-[#ff3b30]/[0.08] px-3 py-3 text-sm text-[#a32018] dark:text-[#ff7066]">
                            {forcekeySelectorError}
                          </div>
                        ) : forcekeySelector?.options?.length ? (
                          <div className="space-y-3">
                            {(() => {
                              const totalRanked = forcekeySelector.options.length;
                              const visibleRanked = showAllRankedForcekeys
                                ? forcekeySelector.options
                                : forcekeySelector.options.slice(0, 8);
                              return (
                                <>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-neutral-500 dark:text-neutral-400">
                                      Showing {visibleRanked.length} of {totalRanked} ranked keywords.
                                    </span>
                                    {totalRanked > 8 ? (
                                      <button
                                        type="button"
                                        onClick={() => setShowAllRankedForcekeys((value) => !value)}
                                        className={buttonGhost}
                                      >
                                        {showAllRankedForcekeys ? "Show top 8 only" : "Show all ranked keywords"}
                                      </button>
                                    ) : null}
                                  </div>

                                  <div className="divide-y divide-black/[0.06] dark:divide-white/[0.10]">
                                    {visibleRanked.map((option) => {
                                      const selectedIndex = form.forcekeys.findIndex(
                                        (value) =>
                                          value.trim().toLowerCase() === option.forcekey.trim().toLowerCase()
                                      );
                                      const alreadySelected = selectedIndex >= 0;
                                      return (
                                        <details
                                          key={option.normalizedForcekey}
                                          className={`group px-1 py-3 transition hover:bg-neutral-50 dark:hover:bg-neutral-800 [&_summary::-webkit-details-marker]:hidden ${
                                            alreadySelected ? "bg-[#0071e3]/[0.06] dark:bg-[#0a84ff]/[0.10]" : ""
                                          }`}
                                        >
                                          <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                                            <div className="min-w-0">
                                              <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                                                  {option.forcekey}
                                                </span>
                                                {alreadySelected ? (
                                                  <span className={pillClass}>
                                                    slot {String.fromCharCode(65 + selectedIndex)}
                                                  </span>
                                                ) : null}
                                                <span className={pillClass}>{option.type}</span>
                                                <span className={pillClass}>
                                                  rank #{option.comparison.categoryRank}
                                                </span>
                                                <span className={pillClass}>{option.score.confidence}</span>
                                              </div>
                                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                                                <span>{option.metrics.searches} searches</span>
                                                <span>{option.metrics.clicks} clicks</span>
                                                <span>{moneyLabel(option.metrics.revenue)} revenue</span>
                                                <span>RPC {option.metrics.rpc.toFixed(2)}</span>
                                                <span>RPS {option.metrics.rps.toFixed(2)}</span>
                                                <span>vs category {pctLabel(option.comparison.categoryRpsLiftPct)}</span>
                                              </div>
                                            </div>
                                            {alreadySelected ? (
                                              <div
                                                className="flex shrink-0 items-center gap-2"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                }}
                                              >
                                                <div
                                                  className="grid grid-cols-2 gap-0.5 rounded-lg border border-black/[0.08] bg-black/[0.03] px-2 py-2 dark:border-white/[0.10] dark:bg-white/[0.03]"
                                                  title="Selected in final stack"
                                                >
                                                  {Array.from({ length: 6 }).map((_, dotIndex) => (
                                                    <span
                                                      key={dotIndex}
                                                      className="h-1 w-1 rounded-full bg-neutral-400 dark:bg-neutral-500"
                                                    />
                                                  ))}
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => moveSelectedForcekey(selectedIndex, -1)}
                                                  disabled={selectedIndex === 0}
                                                  className="rounded-lg border border-black/[0.08] px-2 py-1 text-xs font-medium text-neutral-700 transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.10] dark:text-neutral-200 dark:hover:bg-white/[0.06]"
                                                >
                                                  Up
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => moveSelectedForcekey(selectedIndex, 1)}
                                                  disabled={selectedIndex === activeForcekeys.length - 1}
                                                  className="rounded-lg border border-black/[0.08] px-2 py-1 text-xs font-medium text-neutral-700 transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.10] dark:text-neutral-200 dark:hover:bg-white/[0.06]"
                                                >
                                                  Down
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => removeSelectedForcekey(selectedIndex)}
                                                  className="rounded-lg border border-black/[0.08] px-2 py-1 text-xs font-medium text-neutral-700 transition hover:bg-black/[0.04] dark:border-white/[0.10] dark:text-neutral-200 dark:hover:bg-white/[0.06]"
                                                >
                                                  Remove
                                                </button>
                                              </div>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  addForcekeyToNextOpenSlot(option.forcekey);
                                                }}
                                                className={buttonSecondary}
                                              >
                                                Add
                                              </button>
                                            )}
                                          </summary>
                                          <div className="mt-3 space-y-3 text-sm text-neutral-700 dark:text-neutral-200">
                                            <div className="h-px bg-black/[0.06] dark:bg-white/[0.10]" />
                                            <div className="grid gap-x-6 gap-y-2 md:grid-cols-3">
                                              <div>
                                                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">
                                                  Ranking score
                                                </div>
                                                <div className="mt-0.5 font-semibold text-neutral-900 dark:text-neutral-50">
                                                  {option.score.rankingScore.toFixed(2)}
                                                </div>
                                              </div>
                                              <div>
                                                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">
                                                  Network RPS lift
                                                </div>
                                                <div className="mt-0.5 font-semibold text-neutral-900 dark:text-neutral-50">
                                                  {pctLabel(option.comparison.networkRpsLiftPct)}
                                                </div>
                                              </div>
                                              <div>
                                                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">
                                                  Network RPC lift
                                                </div>
                                                <div className="mt-0.5 font-semibold text-neutral-900 dark:text-neutral-50">
                                                  {pctLabel(option.comparison.networkRpcLiftPct)}
                                                </div>
                                              </div>
                                            </div>
                                            {option.geo ? (
                                              <div>
                                                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                                                  Geo analysis
                                                </div>
                                                <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                                                  {option.geo.rationale}
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                  {option.geo.topValues.slice(0, 3).map((geo) => (
                                                    <span key={`${geo.token}-${geo.value}`} className={pillClass}>
                                                      {geo.value} · RPS {geo.rps.toFixed(2)} · {geo.band}
                                                    </span>
                                                  ))}
                                                </div>
                                              </div>
                                            ) : null}
                                            {option.observedKeywordVariants.length > 0 ? (
                                              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                                Observed variants: {option.observedKeywordVariants.slice(0, 3).join(" · ")}
                                                {option.observedKeywordVariants.length > 3
                                                  ? ` +${option.observedKeywordVariants.length - 3} more`
                                                  : ""}
                                              </div>
                                            ) : null}
                                          </div>
                                        </details>
                                      );
                                    })}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="text-sm text-neutral-500 dark:text-neutral-400">
                            No trailing 14-day forcekey analysis is available for this category yet.
                          </div>
                        )}

                        {forcekeySelector?.notes?.length ? (
                          <div className="space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {forcekeySelector.notes.slice(0, 4).map((note, index) => (
                              <div key={`${note}-${index}`}>{note}</div>
                            ))}
                          </div>
                        ) : null}
                        </div>
                      </details>

                      {(() => {
                        const lastFilledIndex = form.forcekeys.reduce(
                          (max, v, i) => (v.trim() ? i : max),
                          -1
                        );
                        const naturalVisibleCount = Math.min(
                          12,
                          Math.max(5, lastFilledIndex + 2)
                        );
                        const visibleCount = showAllForcekeys ? 12 : naturalVisibleCount;
                        const canToggle = naturalVisibleCount < 12;
                        const allowReorder = launchMode !== "clone";
                        return (
                          <div className="space-y-4">
                            <div>
                              <div className={fieldLabel}>Forcekeys</div>
                              <div className="space-y-1">
                                {form.forcekeys.slice(0, visibleCount).map((value, index) => {
                                  const filled = value.trim().length > 0;
                                  const dragHandlers = allowReorder
                                    ? {
                                        draggable: true,
                                        onDragStart: () => setDragIndex(index),
                                        onDragOver: (e: React.DragEvent) => {
                                          e.preventDefault();
                                          setDragOverIndex(index);
                                        },
                                        onDragEnd: () => {
                                          if (
                                            dragIndex !== null &&
                                            dragOverIndex !== null &&
                                            dragIndex !== dragOverIndex
                                          ) {
                                            setForm((current) => {
                                              const next = [...current.forcekeys];
                                              const [moved] = next.splice(dragIndex, 1);
                                              next.splice(dragOverIndex, 0, moved);
                                              return { ...current, forcekeys: next };
                                            });
                                          }
                                          setDragIndex(null);
                                          setDragOverIndex(null);
                                        },
                                      }
                                    : {};
                                  return (
                                    <div
                                      key={index}
                                      {...dragHandlers}
                                      className={`group flex items-center gap-2 rounded-lg transition ${
                                        allowReorder && dragIndex === index
                                          ? "opacity-40"
                                          : allowReorder && dragOverIndex === index
                                            ? "ring-2 ring-[#0071e3] rounded-lg"
                                            : ""
                                      }`}
                                    >
                                      {allowReorder ? (
                                        <div className="flex shrink-0 cursor-grab items-center text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-neutral-600 active:cursor-grabbing">
                                          <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 16 16"
                                            fill="currentColor"
                                          >
                                            <circle cx="6" cy="4" r="1.5" />
                                            <circle cx="10" cy="4" r="1.5" />
                                            <circle cx="6" cy="8" r="1.5" />
                                            <circle cx="10" cy="8" r="1.5" />
                                            <circle cx="6" cy="12" r="1.5" />
                                            <circle cx="10" cy="12" r="1.5" />
                                          </svg>
                                        </div>
                                      ) : null}
                                      <input
                                        value={value}
                                        onChange={(e) =>
                                          setForm((current) => {
                                            const next = [...current.forcekeys];
                                            next[index] = e.target.value;
                                            return { ...current, forcekeys: next };
                                          })
                                        }
                                        placeholder={`forcekey${String.fromCharCode(65 + index)}`}
                                        className={filled ? inputPublishClass : inputClass}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs">
                                <span className="text-neutral-500 dark:text-neutral-400">
                                  Active forcekeys: {activeForcekeys.length}.
                                </span>
                                {canToggle ? (
                                  <button
                                    type="button"
                                    onClick={() => setShowAllForcekeys((v) => !v)}
                                    className="font-medium text-[#0071e3] hover:underline"
                                  >
                                    {showAllForcekeys ? "Show fewer fields" : "Show all 12 fields"}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="h-px bg-black/[0.06] dark:bg-white/[0.10]" />

                    <div className="space-y-4">
                      <div className={sectionLabel}>Budget &amp; bidding</div>

                      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
                        <label className="block">
                          <div className={fieldLabel}>Budget per ad set ($)</div>
                          <input
                            value={form.budgetAmount}
                            onChange={(e) => setForm((c) => ({ ...c, budgetAmount: e.target.value }))}
                            className={inputClass}
                          />
                        </label>

                        <label className="block">
                          <div className={fieldLabel}>Bid cap override</div>
                          <input
                            value={form.bidCap}
                            onChange={(e) => setForm((c) => ({ ...c, bidCap: e.target.value }))}
                            placeholder="Leave blank for preset bidding"
                            className={inputClass}
                          />
                        </label>
                      </div>

                      <div className="rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 px-3 py-3">
                        <div className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                          Launch readiness
                        </div>
                        {launchHistory?.notes?.length ? (
                          <div className="mb-3 rounded-lg bg-amber-100/70 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                            {launchHistory.notes[0]}
                          </div>
                        ) : null}
                        <div className="grid gap-3 md:grid-cols-3">
                          {[
                            { label: "Strategis", checks: strategisReadinessChecks, ready: canRunStrategisSetup },
                            { label: "Facebook clone", checks: facebookReadinessChecks, ready: canRunFacebookSetup },
                            { label: "Both", checks: bothReadinessChecks, ready: canRunBothSetup },
                          ].map((group) => (
                            <div key={group.label} className="rounded-xl bg-white/80 dark:bg-neutral-900/70 px-3 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                                  {group.label}
                                </div>
                                <span className={group.ready ? pillClass : "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"}>
                                  {group.ready ? "Ready" : "Blocked"}
                                </span>
                              </div>
                              <div className="mt-2 space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                                {group.checks.map((check, index) => (
                                  <div key={`${group.label}-${check.label}-${index}`}>
                                    <div>
                                      {check.ok ? "• " : "• "}
                                      <span className={check.ok ? "text-neutral-700 dark:text-neutral-300" : "text-amber-700 dark:text-amber-300"}>
                                        {check.label}
                                      </span>
                                    </div>
                                    {check.detail ? (
                                      <div className="pl-3 text-neutral-500 dark:text-neutral-500">{check.detail}</div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 px-3 py-3">
                        <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                          Setup actions
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleDryRun("strategis")}
                            disabled={runningSetup !== null || runningDryRun !== null}
                            className={buttonGhost}
                          >
                            {runningDryRun === "strategis" ? "Previewing…" : "Dry run Strategis"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDryRun("facebook")}
                            disabled={runningSetup !== null || runningDryRun !== null}
                            className={buttonGhost}
                          >
                            {runningDryRun === "facebook" ? "Previewing…" : "Dry run Facebook"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDryRun("both")}
                            disabled={runningSetup !== null || runningDryRun !== null}
                            className={buttonGhost}
                          >
                            {runningDryRun === "both" ? "Previewing…" : "Dry run Both"}
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleSetup("strategis")}
                            disabled={!canRunStrategisSetup || runningSetup !== null || runningDryRun !== null}
                            className={buttonOutline}
                          >
                            <span className="inline-flex items-center gap-2">
                              {runningSetup === "strategis" ? <ButtonSpinner /> : null}
                              <span>{runningSetup === "strategis" ? "Setting up…" : "Setup in Strategis"}</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetup("facebook")}
                            disabled={!canRunFacebookSetup || runningSetup !== null || runningDryRun !== null}
                            className={buttonSecondary}
                          >
                            <span className="inline-flex items-center gap-2">
                              {runningSetup === "facebook" ? <ButtonSpinner /> : null}
                              <span>{runningSetup === "facebook" ? "Setting up…" : "Setup in Facebook"}</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetup("both")}
                            disabled={!canRunBothSetup || runningSetup !== null || runningDryRun !== null}
                            className={buttonPrimary}
                          >
                            <span className="inline-flex items-center gap-2">
                              {runningSetup === "both" ? <ButtonSpinner /> : null}
                              <span>{runningSetup === "both" ? "Setting up…" : "Setup in Both"}</span>
                            </span>
                          </button>
                        </div>
                        <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                          Strategis creates the tracking shell only. Facebook currently clones the selected source
                          campaign shell, creates a fresh creative, and swaps that creative onto the cloned ad while
                          keeping the clone paused. Setup in Facebook requires the route URL returned by Setup in
                          Strategis.
                        </div>
                        {runningSetup ? (
                          <div className="mt-3 rounded-xl bg-[#0071e3]/[0.10] px-3 py-3 text-sm text-[#0b63ce] dark:text-[#72b7ff]">
                            {setupModeLabel(runningSetup)} setup in progress. This can take a moment, especially while
                            Strategis returns the created shell.
                          </div>
                        ) : null}
                        {!runningSetup && setupResult ? (
                          <div className="mt-3 rounded-xl bg-[#34c759]/[0.10] px-3 py-3 text-sm text-[#0a7d2e] dark:text-[#5dd680]">
                            <div>
                              {setupModeLabel(setupResult.mode)} setup complete for{" "}
                              <span className="font-semibold">{setupResult.result.campaignName}</span>
                              {setupResult.result.strategisCampaigns?.[0]?.id
                                ? ` (${setupResult.result.strategisCampaigns[0].id})`
                                : ""}
                              .
                            </div>
                            {setupResult.result.strategisCampaigns?.[0]?.trackingUrl ? (
                              <div className="mt-3 rounded-lg bg-white/70 px-3 py-3 text-xs text-[#063d15] dark:bg-neutral-950/40 dark:text-[#a3e8b8]">
                                <div className="font-medium uppercase tracking-[0.14em] text-[#0a7d2e] dark:text-[#5dd680]">
                                  New campaign URL
                                </div>
                                <div className="mt-2 break-all font-mono">
                                  {setupResult.result.strategisCampaigns[0].trackingUrl}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await copyText(setupResult.result.strategisCampaigns![0].trackingUrl);
                                      setCopied("strategis-route-url");
                                      window.setTimeout(() => setCopied(null), 1200);
                                    }}
                                    className={buttonGhost}
                                  >
                                    {copied === "strategis-route-url" ? "Copied route URL" : "Copy route URL"}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {dryRunError ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                          {dryRunError}
                        </div>
                      ) : null}

                      {dryRunResult ? (
                        <div className="rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 px-3 py-3">
                          <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                            Dry run result
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl bg-white/80 dark:bg-neutral-900/70 px-3 py-3 text-sm">
                              <div className="font-semibold text-neutral-900 dark:text-neutral-50">Strategis preview</div>
                              <div className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                                <div>Org: {dryRunResult.preview.strategis.organization}</div>
                                <div>Campaign name: {dryRunResult.preview.strategis.campaignName || "Will derive on create"}</div>
                                <div>Template: {dryRunResult.preview.strategis.templateId}</div>
                                <div>Site: {dryRunResult.preview.strategis.rsocSite}</div>
                                <div>Article: {dryRunResult.preview.strategis.article}</div>
                                <div>Forcekeys: {dryRunResult.preview.strategis.forcekeys.length}</div>
                                <div>
                                  Route URL pattern after Strategis create:{" "}
                                  {dryRunResult.preview.strategis.routeUrlPreview || "N/A"}
                                </div>
                              </div>
                            </div>
                            <div className="rounded-xl bg-white/80 dark:bg-neutral-900/70 px-3 py-3 text-sm">
                              <div className="font-semibold text-neutral-900 dark:text-neutral-50">Facebook preview</div>
                              <div className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                                <div>Source campaign: {dryRunResult.preview.facebook.sourceCampaignId || "Missing"}</div>
                                <div>Source FB campaign: {dryRunResult.preview.facebook.sourceFacebookCampaignId || "Missing"}</div>
                                <div>Target campaign: {dryRunResult.preview.facebook.targetCampaignName || "Pending"}</div>
                                <div>Target ad: {dryRunResult.preview.facebook.targetAdName || "Pending"}</div>
                                <div>Creative mode: {dryRunResult.preview.facebook.creativeMode}</div>
                                <div>{facebookDestinationLabel(dryRunResult)}: {facebookDestinationValue(dryRunResult)}</div>
                                {dryRunResult.preview.facebook.creativeAssetUrl ? (
                                  <div>Asset URL: {dryRunResult.preview.facebook.creativeAssetUrl}</div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          {dryRunResult.runtime.notes.length ? (
                            <div className="mt-3 rounded-lg bg-amber-100/70 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                              {dryRunResult.runtime.notes.map((note, index) => (
                                <div key={`${note}-${index}`}>{note}</div>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl bg-white/80 dark:bg-neutral-900/70 px-3 py-3 text-sm">
                              <div className="font-semibold text-neutral-900 dark:text-neutral-50">Duplicate risk</div>
                              <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                                Level: {dryRunResult.duplicateRisk.level}
                              </div>
                              {dryRunResult.duplicateRisk.notes.length ? (
                                <div className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300">
                                  {dryRunResult.duplicateRisk.notes.map((note, index) => (
                                    <div key={`${note}-${index}`}>{note}</div>
                                  ))}
                                </div>
                              ) : null}
                              {dryRunResult.duplicateRisk.matches.length ? (
                                <div className="mt-2 space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                                  {dryRunResult.duplicateRisk.matches.map((match) => (
                                    <div key={match.requestId} className="rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 py-2">
                                      <div className="font-medium text-neutral-900 dark:text-neutral-50">{match.campaignName}</div>
                                      <div>{match.createdAt}</div>
                                      <div>{match.status || "unknown status"}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <div className="rounded-xl bg-white/80 dark:bg-neutral-900/70 px-3 py-3 text-sm">
                              <div className="font-semibold text-neutral-900 dark:text-neutral-50">Planned operations</div>
                              <div className="mt-2 space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                                {dryRunResult.operations.map((op) => (
                                  <div key={`${op.system}-${op.step}`} className="rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 py-2">
                                    <div className="font-medium text-neutral-900 dark:text-neutral-50">
                                      {op.system} · {op.method} · {op.step}
                                    </div>
                                    <div className="mt-1 font-mono text-[11px] break-all">{op.target}</div>
                                    <div className="mt-1">{op.purpose}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          {dryRunResult.warnings.length ? (
                            <div className="mt-3 space-y-1 text-xs text-amber-700 dark:text-amber-300">
                              {dryRunResult.warnings.map((warning, index) => (
                                <div key={`${warning}-${index}`}>{warning}</div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block">
                          <div className={fieldLabel}>Creative mode</div>
                          <Dropdown
                            value={form.creativeMode}
                            onChange={(nextValue) =>
                              setForm((c) => ({
                                ...c,
                                creativeMode: nextValue as FormState["creativeMode"],
                              }))
                            }
                            options={CREATIVE_MODE_OPTIONS.map((option) => ({
                              value: option.value,
                              label: option.label,
                            }))}
                          />
                        </label>
                        <label className="block">
                          <div className={fieldLabel}>
                            {form.creativeMode === "video_url" ? "Video URL" : "Asset URL"}
                          </div>
                          <input
                            value={form.creativeAssetUrl}
                            onChange={(e) => setForm((c) => ({ ...c, creativeAssetUrl: e.target.value }))}
                            placeholder={
                              form.creativeMode === "inherit"
                                ? "Leave blank to preserve source media"
                                : "https://…"
                            }
                            className={inputClass}
                          />
                        </label>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block">
                          <div className={fieldLabel}>Creative primary text</div>
                          <textarea
                            value={form.creativePrimaryText}
                            onChange={(e) => setForm((c) => ({ ...c, creativePrimaryText: e.target.value }))}
                            placeholder="Optional. Falls back to the source ad copy."
                            className={`${inputClass} min-h-[88px]`}
                          />
                        </label>
                        <div className="grid gap-3">
                          <label className="block">
                            <div className={fieldLabel}>Creative description</div>
                            <input
                              value={form.creativeDescription}
                              onChange={(e) => setForm((c) => ({ ...c, creativeDescription: e.target.value }))}
                              placeholder="Optional link description"
                              className={inputClass}
                            />
                          </label>
                          <label className="block">
                            <div className={fieldLabel}>Call to action</div>
                            <Dropdown
                              value={form.creativeCallToActionType}
                              onChange={(nextValue) =>
                                setForm((c) => ({ ...c, creativeCallToActionType: nextValue }))
                              }
                              options={CTA_OPTIONS.map((option) => ({
                                value: option.value,
                                label: option.label,
                              }))}
                            />
                          </label>
                        </div>
                      </div>

                      <label className="block">
                        <div className={fieldLabel}>Creative handoff notes</div>
                        <textarea
                          value={form.creativeNotes}
                          onChange={(e) => setForm((c) => ({ ...c, creativeNotes: e.target.value }))}
                          placeholder="Anything Facebook upload still needs: angle, asset list, variants, page notes…"
                          className={`${inputClass} min-h-[110px]`}
                        />
                      </label>
                    </div>
                </div>
              )}
            </section>

            {/* Summary rail — flat sections divided by hairlines */}
            <aside>
              {launchMode === "packet" ? (
                <div className="space-y-8">
                  <div>
                    <div className={sectionLabel}>Intent packet</div>
                    <div className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                      <div>Primary keyword: {packetForm.primaryKeyword || "—"}</div>
                      <div>Category: {packetForm.category || "—"}</div>
                      <div>Site: {packetForm.rsocSite || "—"}</div>
                      <div>Destination domain: {packetForm.destinationDomain || "—"}</div>
                      <div>Ad account: {packetForm.adAccountId || "—"}</div>
                      <div>Page: {packetForm.fbPage || "—"}</div>
                    </div>
                  </div>

                  <div className="h-px bg-black/[0.06] dark:bg-white/[0.10]" />

                  <div>
                    <div className={sectionLabel}>Packet preview</div>
                    {packetPreview ? (
                      <div className="mt-2 space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                        <div>Packet: {packetPreview.packet.packetName}</div>
                        <div>Vertical: {packetPreview.packet.vertical}</div>
                        <div>Launch priority: {packetPreview.packet.scores.launchPriority}</div>
                        <div>Monetization potential: {packetPreview.packet.scores.monetizationPotential}</div>
                        <div>Recommended budget: ${packetPreview.packet.launchTest.recommendedDailyBudget}</div>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        Preview the packet lane to see the Strategis and Facebook shell plan.
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-black/[0.06] dark:bg-white/[0.10]" />

                  <div>
                    <div className={sectionLabel}>Operational note</div>
                    <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                      This lane is intentionally separated from clone/setup actions so buyers can reason about a
                      brand-new packet shell without mixing it into the existing historical-shell workflow.
                    </div>
                  </div>
                </div>
              ) : (
              <div className="space-y-8">
                <div>
                  <div className={sectionLabel}>Strategis</div>
                  <div className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                    <div>Article: {selectedCampaign?.articleSlug || selectedArticle?.label || form.article || "—"}</div>
                    <div>Site: {strategistPreview?.rsocSite || "—"}</div>
                    <div>Subdirectory: {strategistPreview?.subdirectory || "—"}</div>
                    <div>Redirect: {strategistPreview?.redirectDomain || "—"}</div>
                    <div>Forcekeys: {activeForcekeys.length}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => strategistPreview && handleCopy("strategis", strategistPreview)}
                    className={`${buttonGhost} mt-3`}
                  >
                    {copied === "strategis" ? "Copied" : "Copy Strategis JSON"}
                  </button>
                </div>

                <div className="h-px bg-black/[0.06] dark:bg-white/[0.10]" />

                <div>
                  <div className={sectionLabel}>Facebook</div>
                  <div className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                    <div>
                      Ad account:{" "}
                      {facebookPreview?.adAccountId
                        ? adAccountLabelMap.get(facebookPreview.adAccountId) || facebookPreview.adAccountId
                        : "—"}
                    </div>
                    <div>
                      Page:{" "}
                      {facebookPreview?.pageId
                        ? pageLabelMap.get(facebookPreview.pageId) || facebookPreview.pageId
                        : "—"}
                    </div>
                    <div>Pixel: {facebookPreview?.pixelId || "—"}</div>
                    <div>Bid strategy: {facebookPreview?.bidStrategy || "—"}</div>
                    {selectedCampaign ? <div>Source campaign: {selectedCampaign.campaignId}</div> : null}
                    <div>Creative mode: {form.creativeMode}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => facebookPreview && handleCopy("facebook", facebookPreview)}
                    className={`${buttonGhost} mt-3`}
                  >
                    {copied === "facebook" ? "Copied" : "Copy Facebook JSON"}
                  </button>
                </div>

                <div className="h-px bg-black/[0.06] dark:bg-white/[0.10]" />

                <div>
                  <div className={sectionLabel}>Readiness</div>
                  <div className="mt-2 space-y-1.5">
                    {readyChecks.map((check) => (
                      <div
                        key={check.label}
                        className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400"
                      >
                        <span>{check.label}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            check.ok
                              ? "bg-[#34c759]/[0.08] text-[#0a7d2e] dark:text-[#5dd680]"
                              : "bg-[#ff9500]/[0.08] text-[#a55a00] dark:text-[#ffb84a]"
                          }`}
                        >
                          {check.ok ? "Ready" : "Missing"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {(selectedProfile?.notes || []).length > 0 ||
                (selectedCampaign?.notes || []).length > 0 ? (
                  <div className="space-y-1.5 rounded-xl bg-[#ff9500]/[0.08] px-3 py-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-[#a55a00] dark:text-[#ffb84a]">Warnings</div>
                    <ul className="space-y-1 text-sm text-[#a55a00] dark:text-[#ffb84a]">
                      {[
                        ...(selectedCampaign?.notes || []),
                        ...(selectedProfile?.notes || []),
                      ].map((note) => (
                        <li key={note}>• {note}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {setupError ? (
                  <div className="space-y-1.5 rounded-xl bg-[#ff3b30]/[0.08] px-3 py-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-[#a32018] dark:text-[#ff7066]">Setup error</div>
                    <div className="text-sm text-[#a32018] dark:text-[#ff7066]">{setupError}</div>
                  </div>
                ) : null}

                {setupResult ? (
                  <div className="rounded-xl bg-[#34c759]/[0.08] px-3 py-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-[#0a7d2e] dark:text-[#5dd680]">
                      {setupResult.mode} created
                    </div>
                    <div className="mt-1.5 space-y-1 text-sm text-[#063d15] dark:text-[#a3e8b8]">
                      <div>Request: {setupResult.result.requestId}</div>
                      <div>Campaign: {setupResult.result.campaignName}</div>
                      {setupResult.result.facebookCampaign?.id ? (
                        <div>Facebook campaign: {setupResult.result.facebookCampaign.id}</div>
                      ) : null}
                      {setupResult.result.facebookAd?.id ? (
                        <div>Facebook ad: {setupResult.result.facebookAd.id}</div>
                      ) : null}
                      {setupResult.result.facebookCreative?.id ? (
                        <div>Facebook creative: {setupResult.result.facebookCreative.id}</div>
                      ) : null}
                      {setupResult.result.strategisCampaigns?.[0]?.id ? (
                        <div>Strategis campaign: {setupResult.result.strategisCampaigns[0].id}</div>
                      ) : null}
                      {setupResult.result.strategisCampaigns?.[0]?.trackingUrl ? (
                        <div>Route URL: {setupResult.result.strategisCampaigns[0].trackingUrl}</div>
                      ) : null}
                      {setupResult.mode === "both" ? (
                        <div>
                          Mapping: {setupResult.result.mappingStored ? setupResult.result.mappingId || "stored" : "not stored"}
                        </div>
                      ) : null}
                      {setupResult.result.verification?.strategis ? (
                        <div>
                          Strategis verification: {setupResult.result.verification.strategis.ready ? "passed" : "needs review"}
                        </div>
                      ) : null}
                      {setupResult.result.verification?.facebook ? (
                        <div>
                          Facebook verification: {setupResult.result.verification.facebook.ready ? "passed" : "needs review"}
                        </div>
                      ) : null}
                    </div>
                    {(setupResult.result.warnings || []).length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-[#0a7d2e] dark:text-[#5dd680]">
                        {setupResult.result.warnings?.map((warning) => (
                          <li key={warning}>• {warning}</li>
                        ))}
                      </ul>
                    ) : null}
                    {setupResult.result.verification ? (
                      <div className="mt-3 space-y-2 text-xs text-[#0a7d2e] dark:text-[#5dd680]">
                        {setupResult.result.verification.strategis?.checks?.length ? (
                          <div>
                            <div className="font-medium">Strategis checks</div>
                            <ul className="mt-1 space-y-1">
                              {setupResult.result.verification.strategis.checks.map((check) => (
                                <li key={`strategis-${check.label}`}>• {check.label}: {check.ok ? "ok" : "failed"}{check.detail ? ` — ${check.detail}` : ""}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {setupResult.result.verification.facebook?.checks?.length ? (
                          <div>
                            <div className="font-medium">Facebook checks</div>
                            <ul className="mt-1 space-y-1">
                              {setupResult.result.verification.facebook.checks.map((check) => (
                                <li key={`facebook-${check.label}`}>• {check.label}: {check.ok ? "ok" : "failed"}{check.detail ? ` — ${check.detail}` : ""}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 px-3 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Recent launches
                  </div>
                  {launchHistory?.items?.length ? (
                    <div className="mt-2 space-y-2">
                      {launchHistory.items.slice(0, 6).map((item) => (
                        <div key={item.request_id} className="rounded-lg bg-white/80 dark:bg-neutral-900/70 px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">
                          <div className="font-medium text-neutral-900 dark:text-neutral-50">{item.campaign_name}</div>
                          <div className="mt-1">{item.category}</div>
                          <div className="mt-1">
                            {item.request_status || item.campaign_plan_status}
                            {item.request_step ? ` · ${item.request_step}` : ""}
                          </div>
                          <div className="mt-1">
                            Strategis {item.strategis_campaign_ids?.length || 0} · FB campaign {item.facebook_campaign_id ? "yes" : "no"} · FB ads {item.facebook_ad_ids?.length || 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                      No persisted launch history yet.
                    </div>
                  )}
                </div>
              </div>
              )}
            </aside>
          </div>

          {entityPicker ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/45 px-6">
              <div className={`${cardClass} w-full max-w-3xl p-6`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                      Search all options
                    </div>
                    <div className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                      {entityPicker.title}
                    </div>
                    <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                      Search across the full {entityPicker.kind === "redirect" ? "redirect" : entityPicker.kind === "page" ? "page" : "ad account"} set, not just the historical recommendations for this site.
                    </div>
                  </div>
                  <button type="button" onClick={closeEntityPicker} className={buttonGhost}>
                    Close
                  </button>
                </div>

                <div className="mt-4">
                  <input
                    value={entityPickerQuery}
                    onChange={(e) => setEntityPickerQuery(e.target.value)}
                    placeholder={entityPicker.placeholder}
                    className={inputClass}
                    autoFocus
                  />
                </div>

                <div className="mt-4 max-h-[28rem] overflow-auto rounded-xl border border-black/[0.06] dark:border-white/[0.10]">
                  {filteredEntityPickerOptions.length ? (
                    <div className="divide-y divide-black/[0.06] dark:divide-white/[0.10]">
                      {filteredEntityPickerOptions.map((option) => {
                        const isSelected =
                          (entityPicker.kind === "redirect" && option.value === form.redirectDomain) ||
                          (entityPicker.kind === "page" && option.value === form.pageId) ||
                          (entityPicker.kind === "adAccount" && option.value === form.adAccountId);
                        return (
                          <button
                            key={`${entityPicker.kind}-${option.value}`}
                            type="button"
                            onClick={() => {
                              setForm((current) => ({
                                ...current,
                                ...(entityPicker.kind === "redirect" ? { redirectDomain: option.value } : {}),
                                ...(entityPicker.kind === "page" ? { pageId: option.value } : {}),
                                ...(entityPicker.kind === "adAccount" ? { adAccountId: option.value } : {}),
                              }));
                              closeEntityPicker();
                            }}
                            className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition ${
                              isSelected
                                ? "bg-neutral-100 dark:bg-neutral-800"
                                : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                                {option.label}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                                <span className={pillClass}>{optionSourceLabel(option)}</span>
                                {option.support.count > 0 ? (
                                  <span className={pillClass}>
                                    {option.support.count} {buyerLabel} campaign{option.support.count === 1 ? "" : "s"}
                                  </span>
                                ) : null}
                              </div>
                              {option.sampleCampaignNames.length ? (
                                <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                                  Seen on: {option.sampleCampaignNames.slice(0, 2).join(" · ")}
                                  {option.sampleCampaignNames.length > 2 ? ` +${option.sampleCampaignNames.length - 2} more` : ""}
                                </div>
                              ) : null}
                            </div>
                            {isSelected ? (
                              <span className={pillClass}>Selected</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">
                      No matches for this search.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {confirmMode && confirmPreview ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/45 px-6">
              <div className={`${cardClass} w-full max-w-3xl p-6`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                      Confirm launch
                    </div>
                    <div className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                      {confirmMode === "strategis"
                        ? "Setup in Strategis"
                        : confirmMode === "facebook"
                          ? "Setup in Facebook"
                          : "Setup in Both"}
                    </div>
                    <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                      This will perform real writes. Facebook clone launches stay paused by default.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmMode(null);
                      setConfirmPreview(null);
                      setConfirmError(null);
                    }}
                    className={buttonGhost}
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 px-4 py-3 text-sm">
                    <div className="font-semibold text-neutral-900 dark:text-neutral-50">Launch summary</div>
                    <div className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                      <div>Buyer: {confirmPreview.preview.buyer}</div>
                      <div>Category: {confirmPreview.preview.category}</div>
                      <div>Campaign: {confirmPreview.preview.strategis.campaignName || "Will derive on create"}</div>
                      <div>Article: {confirmPreview.preview.strategis.article}</div>
                      <div>Source FB campaign: {confirmPreview.preview.facebook.sourceFacebookCampaignId || "N/A"}</div>
                      <div>Creative mode: {confirmPreview.preview.facebook.creativeMode}</div>
                      <div>{facebookDestinationLabel(confirmPreview)}: {facebookDestinationValue(confirmPreview)}</div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 px-4 py-3 text-sm">
                    <div className="font-semibold text-neutral-900 dark:text-neutral-50">Risk checks</div>
                    <div className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                      <div>Duplicate risk: {confirmPreview.duplicateRisk.level}</div>
                      <div>History storage: {confirmPreview.runtime.launchHistoryAvailable ? "available" : "unavailable in this runtime"}</div>
                      {confirmPreview.duplicateRisk.notes.map((note, index) => (
                        <div key={`${note}-${index}`} className="text-amber-700 dark:text-amber-300">{note}</div>
                      ))}
                      {confirmPreview.runtime.notes.map((note, index) => (
                        <div key={`${note}-${index}`} className="text-amber-700 dark:text-amber-300">{note}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 px-4 py-3">
                  <div className="font-semibold text-neutral-900 dark:text-neutral-50">Exact operations</div>
                  <div className="mt-2 space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                    {confirmPreview.operations.map((op) => (
                      <div key={`${op.system}-${op.step}`} className="rounded-lg bg-white/80 dark:bg-neutral-900/70 px-3 py-2">
                        <div className="font-medium text-neutral-900 dark:text-neutral-50">{op.system} · {op.method} · {op.step}</div>
                        <div className="mt-1 font-mono text-[11px] break-all">{op.target}</div>
                        <div className="mt-1">{op.purpose}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {confirmError ? (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                    {confirmError}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmMode(null);
                      setConfirmPreview(null);
                      setConfirmError(null);
                    }}
                    className={buttonOutline}
                    disabled={runningSetup !== null}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmAndRunSetup()}
                    className={buttonPrimary}
                    disabled={runningSetup !== null}
                  >
                    <span className="inline-flex items-center gap-2">
                      {runningSetup === confirmMode ? <ButtonSpinner /> : null}
                      <span>{runningSetup === confirmMode ? "Launching…" : "Confirm and launch"}</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Footer — collapsed JSON shells */}
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400 transition hover:text-neutral-700 dark:text-neutral-200">
              <span>JSON shells</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform group-open:rotate-180"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div>
                <div className={sectionLabel}>Strategis</div>
                <pre className="mt-2 max-h-[280px] overflow-auto rounded-xl bg-neutral-100 dark:bg-neutral-800 p-3 text-xs text-neutral-800 dark:text-neutral-200">
                  {JSON.stringify(strategistPreview, null, 2)}
                </pre>
              </div>
              <div>
                <div className={sectionLabel}>Facebook</div>
                <pre className="mt-2 max-h-[280px] overflow-auto rounded-xl bg-neutral-100 dark:bg-neutral-800 p-3 text-xs text-neutral-800 dark:text-neutral-200">
                  {JSON.stringify(facebookPreview, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        </div>
      </main>

      {/* Companion chat — ChatGPT-style with multi-thread sidebar.
          On <lg viewports it's an overlay (slide-over), on lg+ it pushes content. */}
      {chatOpen ? (
        <>
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            aria-label="Close assistant"
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          />
          <aside className="fixed inset-y-0 right-0 z-40 flex h-screen w-[min(560px,100vw)] flex-col bg-white dark:bg-neutral-900 shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.08)] ring-1 ring-black/5 dark:ring-white/10 lg:relative lg:w-[560px] lg:shrink-0">
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            aria-label="Close assistant"
            className="absolute right-3 top-3 z-30 inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
          <div className="min-h-0 flex-1 overflow-hidden">
            <CrayonThemeProvider mode={resolvedTheme}>
              <C1Chat
                apiUrl={`/api/ben-launch?buyer=${encodeURIComponent(buyer)}`}
                formFactor="full-page"
                threadListManager={threadListManager}
                disableThemeProvider
              />
            </CrayonThemeProvider>
          </div>
        </aside>
        </>
      ) : null}
    </div>
  );
}
