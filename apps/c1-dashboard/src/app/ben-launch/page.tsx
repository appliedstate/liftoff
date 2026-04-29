"use client";

import { C1Chat, useThreadListManager } from "@thesysai/genui-sdk";
import { ThemeProvider as CrayonThemeProvider } from "@crayonai/react-ui/ThemeProvider";
import "@crayonai/react-ui/styles/index.css";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/lib/theme";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  buttonGhost,
  buttonOutline,
  buttonPrimary,
  buttonSecondary,
  cardClass,
  fieldLabel,
  inputClass,
  pillClass,
  sectionLabel,
  subCardClass,
} from "@/lib/ui";
import { Dropdown } from "@/components/Dropdown";

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

type FormState = {
  article: string;
  headline: string;
  forcekeys: string[];
  budgetAmount: string;
  bidCap: string;
  creativeNotes: string;
  selectorVariant: string;
  redirectDomain: string;
  pageId: string;
  adAccountId: string;
};

const emptyForm = (): FormState => ({
  article: "",
  headline: "",
  forcekeys: Array.from({ length: 12 }, () => ""),
  budgetAmount: "30",
  bidCap: "",
  creativeNotes: "",
  selectorVariant: "primary",
  redirectDomain: "",
  pageId: "",
  adAccountId: "",
});

const BUYER_OPTIONS = [
  { value: "Ben", label: "Ben Holley" },
  { value: "Cook", label: "Andrew Cook" },
] as const;

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

function copyJson(value: unknown) {
  return navigator.clipboard.writeText(JSON.stringify(value, null, 2));
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
    strategisCampaigns?: Array<{ id: string; name: string; trackingUrl: string }>;
    mappingStored?: boolean;
    mappingId?: string | null;
    warnings?: string[];
  };
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

export default function BenLaunchWorkbench() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const buyerParam = searchParams.get("buyer");
  const initialBuyer = BUYER_OPTIONS.find((option) => option.value === buyerParam)?.value || "Ben";
  const [buyer, setBuyer] = useState<string>(initialBuyer);
  const [catalog, setCatalog] = useState<BenShellCatalog | null>(null);
  const [articleCatalog, setArticleCatalog] = useState<BenArticleCatalog | null>(null);
  const [campaignCatalog, setCampaignCatalog] = useState<BenCampaignCatalog | null>(null);
  const [forcekeySelector, setForcekeySelector] = useState<ForcekeySelectorResponse | null>(null);
  const [forcekeySelectorLoading, setForcekeySelectorLoading] = useState(false);
  const [forcekeySelectorError, setForcekeySelectorError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [articleQuery, setArticleQuery] = useState("");
  const [campaignQuery, setCampaignQuery] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [selectedArticleKey, setSelectedArticleKey] = useState<string>("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAllForcekeys, setShowAllForcekeys] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const { resolved: resolvedTheme } = useTheme();
  const [forcekeyWindow, setForcekeyWindow] = useState(() => trailingCompleteDayWindow(14));
  const [forcekeyRefreshNonce, setForcekeyRefreshNonce] = useState(0);

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
  const [setupError, setSetupError] = useState<string | null>(null);
  const buyerLabel = BUYER_OPTIONS.find((option) => option.value === buyer)?.label || buyer;

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
    const currentParam = searchParams.get("buyer") || "Ben";
    if (currentParam !== buyer) {
      router.replace(`/ben-launch?buyer=${encodeURIComponent(buyer)}`);
    }
  }, [buyer, router, searchParams]);

  useEffect(() => {
    setSelectedProfileId("");
    setSelectedArticleKey("");
    setSelectedCampaignId("");
    setQuery("");
    setArticleQuery("");
    setCampaignQuery("");
    setForm(emptyForm());
    setSetupResult(null);
    setSetupError(null);
    setForcekeySelector(null);
    setForcekeySelectorError(null);
  }, [buyer]);

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

        try {
          const articleResponse = await fetch(`/api/ben-article-catalog?buyer=${encodeURIComponent(buyer)}`, {
            cache: "no-store",
          });
          const articleJson = await articleResponse.json();
          if (articleResponse.ok && isMounted) setArticleCatalog(articleJson);
        } catch {
          if (isMounted) {
            setArticleCatalog({
              scope: { buyer, campaignsAnalyzed: 0, articles: 0 },
              generatedAt: new Date().toISOString(),
              items: [],
              notes: ["Article catalog is temporarily unavailable."],
            });
          }
        }

        try {
          const campaignResponse = await fetch(`/api/ben-campaign-catalog?buyer=${encodeURIComponent(buyer)}`, {
            cache: "no-store",
          });
          const campaignJson = await campaignResponse.json();
          if (campaignResponse.ok && isMounted) {
            setCampaignCatalog(campaignJson);
          } else if (isMounted) {
            setCampaignCatalog({
              scope: { buyer, organization: "Interlincx", campaigns: 0 },
              generatedAt: new Date().toISOString(),
              items: [],
              notes: [campaignJson?.message || campaignJson?.error || "Campaign clone catalog is unavailable."],
            });
          }
        } catch {
          if (isMounted) {
            setCampaignCatalog({
              scope: { buyer, organization: "Interlincx", campaigns: 0 },
              generatedAt: new Date().toISOString(),
              items: [],
              notes: ["Campaign clone catalog is temporarily unavailable."],
            });
          }
        }
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

  const rankedArticles = useMemo(() => {
    const items = articleCatalog?.items || [];
    if (!selectedProfile) return items;
    return [...items].sort((a, b) => {
      const aMatch = a.category === selectedProfile.category ? 0 : 1;
      const bMatch = b.category === selectedProfile.category ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      if (a.campaignCount !== b.campaignCount) return b.campaignCount - a.campaignCount;
      return a.label.localeCompare(b.label);
    });
  }, [articleCatalog, selectedProfile]);

  const filteredArticles = useMemo(() => {
    const lowered = articleQuery.trim().toLowerCase();
    if (!lowered) return rankedArticles;
    return rankedArticles.filter((item) =>
      [item.label, item.articleSlug, item.articleUrl, item.articlePath, ...item.headlineHints]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(lowered))
    );
  }, [rankedArticles, articleQuery]);

  const selectedArticle =
    filteredArticles.find((item) => item.articleKey === selectedArticleKey) ||
    filteredArticles[0] ||
    rankedArticles.find((item) => item.articleKey === selectedArticleKey) ||
    rankedArticles[0] ||
    null;

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
      redirectDomain: current.redirectDomain || selectedProfile.strategist.redirectDomain?.value || "",
      pageId: current.pageId || selectedProfile.facebook.pageId?.value || "",
      adAccountId:
        current.adAccountId ||
        selectedProfile.facebook.adAccountId?.value ||
        selectedProfile.strategist.fbAdAccount?.value ||
        "",
    }));
  }, [selectedProfile, selectedArticle]);

  useEffect(() => {
    if (!selectedProfile) return;
    const availableArticles = articleCatalog?.items || [];
    const currentStillValid = availableArticles.some((item) => item.articleKey === selectedArticleKey);
    if (!currentStillValid) {
      setSelectedArticleKey(rankedArticles[0]?.articleKey || "");
      setArticleQuery("");
    }
  }, [selectedProfileId, selectedProfile, articleCatalog, rankedArticles, selectedArticleKey]);

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
        rsocSite: selectedProfile.strategist.rsocSite?.value || "",
        subdirectory: selectedProfile.strategist.subdirectory?.value || "",
        templateId: selectedProfile.strategist.templateId?.value || "",
        redirectDomain: form.redirectDomain || selectedProfile.strategist.redirectDomain?.value || "",
        headline: form.headline,
        article: form.article,
        fbAdAccount: form.adAccountId || selectedProfile.strategist.fbAdAccount?.value || "",
        networkAccountId: selectedProfile.strategist.networkAccountId?.value || "",
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
      selectorVariant: campaign.facebook.cloneSelector ? "cloned" : "primary",
      redirectDomain: campaign.redirectDomain || "",
      pageId: campaign.facebook.pageId || campaign.fbPage || "",
      adAccountId: campaign.facebook.adAccountId || campaign.networkAccountId || campaign.fbAdAccount || "",
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

  function applyTopForcekeys(count: number) {
    if (!forcekeySelector?.options?.length) return;
    const top = forcekeySelector.options.slice(0, count).map((option) => option.forcekey);
    setForm((current) => {
      const next = Array.from({ length: 12 }, (_, index) => top[index] || "");
      return { ...current, forcekeys: next };
    });
    setShowAllForcekeys(count > 5);
  }

  const canRunStrategisSetup =
    Boolean(selectedProfile) &&
    Boolean(strategistPreview?.templateId) &&
    Boolean(strategistPreview?.rsocSite) &&
    Boolean(form.article.trim()) &&
    Boolean(form.headline.trim()) &&
    activeForcekeys.length >= 1;

  const canRunFacebookSetup =
    Boolean(selectedProfile) &&
    Boolean(facebookPreview?.adAccountId) &&
    Boolean(facebookPreview?.pageId) &&
    Boolean(facebookPreview?.pixelId) &&
    Boolean(facebookPreview?.targeting) &&
    activeForcekeys.length >= 1;

  const canRunBothSetup = canRunStrategisSetup && canRunFacebookSetup;

  async function handleSetup(mode: SetupMode) {
    if (!selectedProfile || !strategistPreview) return;
    if (mode !== "strategis" && !facebookPreview) return;

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

    try {
      setRunningSetup(mode);
      setSetupError(null);
      setSetupResult(null);
      const response = await fetch("/api/ben-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          buyer,
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
          facebook: setupFacebookPayload,
          cloneSource: selectedCampaign
            ? {
                campaignId: selectedCampaign.campaignId,
                campaignName: selectedCampaign.campaignName,
              }
            : null,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.message || json?.error || "Setup failed");
      }
      setSetupResult(json);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : String(error));
    } finally {
      setRunningSetup(null);
    }
  }

  if (loading) {
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
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">
      {/* Dashboard pane */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] space-y-12 px-6 py-12">
          {/* Header — flat text on page bg, mirrors the form/rail grid below */}
          <header className="grid grid-cols-1 items-end gap-x-8 gap-y-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="inline-flex h-6 items-center rounded-md bg-[#0071e3]/12 dark:bg-[#0071e3]/[0.20] px-2 text-[11px] font-semibold uppercase tracking-wider text-[#0071e3] dark:text-[#4a9fff] ring-1 ring-inset ring-[#0071e3]/15 dark:ring-[#0071e3]/30">
                Liftoff
              </div>
              <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
                {buyerLabel} · {catalog.profiles.length} presets ·{" "}
                {Object.keys(catalog.lockedDefaults).length} locked defaults ·{" "}
                {catalog.manualFields.length} manual fields · {readyCount}/5 ready
              </p>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1 min-w-0">
                <label className={fieldLabel}>Buyer profile</label>
                <Dropdown
                  value={buyer}
                  onChange={(nextBuyer) => setBuyer(nextBuyer)}
                  options={BUYER_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />
              </div>
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setChatOpen((v) => !v)}
                className={buttonGhost}
                aria-label="Toggle assistant"
              >
                {chatOpen ? "Hide assistant" : "Show assistant"}
              </button>
            </div>
          </header>

          {Object.entries(catalog.lockedDefaults).length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 xl:max-w-[calc(100%-352px)]">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                Locked defaults
              </span>
              {Object.entries(catalog.lockedDefaults).map(([key, value]) => (
                <span key={key} className={pillClass}>
                  {key}: {value}
                </span>
              ))}
            </div>
          ) : null}

          {/* Flow layout — no canvas card; form and rail sit on the page bg */}
          <div className="grid gap-x-8 gap-y-8 xl:grid-cols-[minmax(0,1fr)_320px]">
              {/* Form column */}
              <section>
              {!selectedProfile ? null : (
                <div className="space-y-8">
                  {/* Preset row */}
                  <div>
                    <div className={sectionLabel}>Launch preset</div>
                    <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div>
                        <label className={fieldLabel}>Category preset</label>
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search categories…"
                          className={`${inputClass} mb-2`}
                        />
                        <Dropdown
                          value={selectedProfile.profileId}
                          onChange={(v) => {
                            setSelectedProfileId(v);
                            setSelectedCampaignId("");
                            setForm(emptyForm());
                          }}
                          options={filteredProfiles.map((p) => ({
                            value: p.profileId,
                            label: p.category,
                          }))}
                          placeholder="Select preset…"
                        />
                      </div>

                      <div>
                        <label className={fieldLabel}>Clone existing campaign</label>
                        <input
                          value={campaignQuery}
                          onChange={(e) => setCampaignQuery(e.target.value)}
                          placeholder={`Search ${buyerLabel} campaigns…`}
                          className={`${inputClass} mb-2`}
                        />
                        <Dropdown
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
                          options={[
                            { value: "", label: "Start from preset only" },
                            ...filteredCampaigns.map((c) => ({
                              value: c.campaignId,
                              label: c.campaignName,
                            })),
                          ]}
                        />
                        <div className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                          {campaignItems.length > 0
                            ? `${campaignItems.length} ${buyerLabel} campaigns available for cloning`
                            : campaignCatalog?.notes?.[0] || "Campaign clone catalog unavailable"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
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

                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedProfile.strategist.rsocSite?.value ? (
                        <span className={pillClass}>{selectedProfile.strategist.rsocSite.value}</span>
                      ) : null}
                      {selectedProfile.facebook.adAccountId?.value ? (
                        <span className={pillClass}>acct {selectedProfile.facebook.adAccountId.value}</span>
                      ) : null}
                      {selectedProfile.facebook.pageId?.value ? (
                        <span className={pillClass}>page {selectedProfile.facebook.pageId.value}</span>
                      ) : null}
                      {selectedSelector ? <span className={pillClass}>{selectedSelector.label}</span> : null}
                      {selectedArticle?.articleSlug ? (
                        <span className={pillClass}>article {selectedArticle.articleSlug}</span>
                      ) : null}
                      {selectedCampaign ? (
                        <span className={pillClass}>clone {selectedCampaign.campaignId}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="h-px bg-black/[0.06] dark:bg-white/[0.10]" />

                  {/* Content inputs */}
                  <div className="space-y-4">
                    <div className={sectionLabel}>Content inputs</div>

                      {selectedCampaign ? (
                        <div className="mb-3 rounded-xl bg-[#0071e3]/[0.06] px-3 py-2.5 text-xs text-neutral-900 dark:text-neutral-50">
                          Cloning shell from{" "}
                          <span className="font-semibold">{selectedCampaign.campaignName}</span>. Article, headline,
                          forcekeys, redirect, page, and account are copied. Creatives are out of scope.
                        </div>
                      ) : null}

                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                        <div>
                          <label className={fieldLabel}>Article selector</label>
                          <input
                            value={articleQuery}
                            onChange={(e) => setArticleQuery(e.target.value)}
                            placeholder={`Search ${buyerLabel}'s articles for this category…`}
                            className={`${inputClass} mb-2`}
                          />
                          <Dropdown
                            value={selectedArticle?.articleKey || ""}
                            onChange={(v) => {
                              setSelectedArticleKey(v);
                              const nextArticle = (articleCatalog?.items || []).find(
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
                              label: `${item.label} (${item.campaignCount})`,
                            }))}
                            placeholder="Select an article…"
                          />
                          <div className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                            Showing all {buyerLabel} articles with this category ranked first.
                          </div>
                        </div>

                        <div className="rounded-xl bg-white dark:bg-neutral-900 px-3 py-2.5 text-xs text-neutral-600 dark:text-neutral-400 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                          <div className="text-neutral-500 dark:text-neutral-400">Article details</div>
                          <div className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                            {selectedArticle?.label || "No article selected"}
                          </div>
                          <div className="mt-1 text-neutral-500 dark:text-neutral-400">
                            {selectedArticle?.articleSlug || "No slug"}
                          </div>
                          <div className="mt-2 text-neutral-500 dark:text-neutral-400">
                            Used in {selectedArticle?.campaignCount || 0} {buyerLabel} campaign
                            {selectedArticle?.campaignCount === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>

                      <label className="block">
                        <div className={fieldLabel}>Selected article URL or path</div>
                        <input
                          value={form.article}
                          onChange={(e) => setForm((c) => ({ ...c, article: e.target.value }))}
                          placeholder="Article URL or path"
                          className={inputClass}
                        />
                        <div className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                          This is the final Strategis article value. The selector above pre-fills it, and you can override it manually here.
                        </div>
                      </label>

                      <label className="block">
                        <div className={fieldLabel}>Headline</div>
                        <input
                          value={form.headline}
                          onChange={(e) => setForm((c) => ({ ...c, headline: e.target.value }))}
                          placeholder={`Headline ${buyerLabel} wants attached to this launch`}
                          className={inputClass}
                        />
                      </label>

                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className={sectionLabel}>Forcekey selector</div>
                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {forcekeySelector?.dateWindow.label ||
                                `Trailing 14 complete days: ${forcekeyWindow.startDate} - ${forcekeyWindow.endDate}`}
                            </div>
                            <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500 dark:text-neutral-400">
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
                          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.10]">
                            {forcekeySelector.options.slice(0, 8).map((option) => {
                              const alreadySelected = form.forcekeys.some(
                                (value) => value.trim().toLowerCase() === option.forcekey.trim().toLowerCase()
                              );
                              return (
                                <details
                                  key={option.normalizedForcekey}
                                  className="group px-1 py-3 transition hover:bg-neutral-50 dark:hover:bg-neutral-800 [&_summary::-webkit-details-marker]:hidden"
                                >
                                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                                          {option.forcekey}
                                        </span>
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
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        addForcekeyToNextOpenSlot(option.forcekey);
                                      }}
                                      className={alreadySelected ? buttonOutline : buttonSecondary}
                                    >
                                      {alreadySelected ? "Selected" : "Add"}
                                    </button>
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
                        return (
                          <div>
                            <div className={fieldLabel}>Forcekeys</div>
                            <div className="space-y-2">
                              {form.forcekeys.slice(0, visibleCount).map((value, index) => (
                                <input
                                  key={index}
                                  value={value}
                                  onChange={(e) =>
                                    setForm((current) => {
                                      const next = [...current.forcekeys];
                                      next[index] = e.target.value;
                                      return { ...current, forcekeys: next };
                                    })
                                  }
                                  placeholder={`forcekey${String.fromCharCode(65 + index)}`}
                                  className={inputClass}
                                />
                              ))}
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
                        );
                      })()}
                    </div>

                    <div className="h-px bg-black/[0.06] dark:bg-white/[0.10]" />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className={sectionLabel}>Launch controls</div>
                        <button
                          type="button"
                          onClick={() => setShowAdvanced((v) => !v)}
                          className={buttonGhost}
                        >
                          {showAdvanced ? "Hide advanced" : "Show advanced"}
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <div className={fieldLabel}>Selector variant</div>
                          <Dropdown
                            value={form.selectorVariant}
                            onChange={(v) => setForm((c) => ({ ...c, selectorVariant: v }))}
                            options={selectorOptions.map((entry) => ({
                              value: entry.key,
                              label: entry.option.label,
                            }))}
                          />
                        </div>

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

                      {showAdvanced ? (
                        <div className="grid gap-3 md:grid-cols-3">
                          <label className="block">
                            <div className={fieldLabel}>Redirect domain</div>
                            <input
                              value={form.redirectDomain}
                              onChange={(e) => setForm((c) => ({ ...c, redirectDomain: e.target.value }))}
                              className={inputClass}
                            />
                          </label>
                          <label className="block">
                            <div className={fieldLabel}>Facebook page</div>
                            <input
                              value={form.pageId}
                              onChange={(e) => setForm((c) => ({ ...c, pageId: e.target.value }))}
                              className={inputClass}
                            />
                          </label>
                          <label className="block">
                            <div className={fieldLabel}>Ad account</div>
                            <input
                              value={form.adAccountId}
                              onChange={(e) => setForm((c) => ({ ...c, adAccountId: e.target.value }))}
                              className={inputClass}
                            />
                          </label>
                        </div>
                      ) : null}

                      <div className="rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 px-3 py-3">
                        <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                          Setup actions
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleSetup("strategis")}
                            disabled={!canRunStrategisSetup || runningSetup !== null}
                            className={buttonOutline}
                          >
                            {runningSetup === "strategis" ? "Setting up…" : "Setup in Strategis"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetup("facebook")}
                            disabled={!canRunFacebookSetup || runningSetup !== null}
                            className={buttonSecondary}
                          >
                            {runningSetup === "facebook" ? "Setting up…" : "Setup in Facebook"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetup("both")}
                            disabled={!canRunBothSetup || runningSetup !== null}
                            className={buttonPrimary}
                          >
                            {runningSetup === "both" ? "Setting up…" : "Setup in Both"}
                          </button>
                        </div>
                        <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                          Strategis creates the tracking shell only. Facebook creates the campaign and ad set shell
                          only. Both attempts both sides and stores the mapping when database access is available.
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
                    <div>Ad account: {facebookPreview?.adAccountId || "—"}</div>
                    <div>Page: {facebookPreview?.pageId || "—"}</div>
                    <div>Pixel: {facebookPreview?.pixelId || "—"}</div>
                    <div>Bid strategy: {facebookPreview?.bidStrategy || "—"}</div>
                    {selectedCampaign ? <div>Source campaign: {selectedCampaign.campaignId}</div> : null}
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
                      {setupResult.result.strategisCampaigns?.[0]?.id ? (
                        <div>Strategis campaign: {setupResult.result.strategisCampaigns[0].id}</div>
                      ) : null}
                      {setupResult.mode === "both" ? (
                        <div>
                          Mapping: {setupResult.result.mappingStored ? setupResult.result.mappingId || "stored" : "not stored"}
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
                  </div>
                ) : null}
              </div>
            </aside>
          </div>

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

      {/* Companion chat — ChatGPT-style with multi-thread sidebar */}
      {chatOpen ? (
        <aside className="relative flex h-screen w-[560px] shrink-0 flex-col bg-white dark:bg-neutral-900 shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.08)] ring-1 ring-black/5 dark:ring-white/10">
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
      ) : null}
    </div>
  );
}
