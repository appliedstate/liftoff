"use client";

import { C1Chat, useThreadListManager } from "@thesysai/genui-sdk";
import "@crayonai/react-ui/styles/index.css";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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

function copyJson(value: unknown) {
  return navigator.clipboard.writeText(JSON.stringify(value, null, 2));
}

// Framer-inspired: borderless fields, soft fills, tinted cards on a light background.
const inputClass =
  "w-full rounded-xl bg-neutral-100 px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 hover:bg-neutral-200/60 focus:bg-white focus:ring-2 focus:ring-[#0071e3]/25";
const selectClass = inputClass;
const cardClass =
  "rounded-xl bg-white ring-1 ring-black/5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.10)]";
const subCardClass = "rounded-xl bg-neutral-50/80 ring-1 ring-black/[0.04]";
const sectionLabel = "text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500";
const fieldLabel = "mb-1.5 block text-xs font-medium text-neutral-600";
const pillClass =
  "inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600";
const buttonGhost =
  "rounded-xl bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200";
const buttonPrimary =
  "rounded-xl bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300";
const buttonSecondary =
  "rounded-xl bg-[#0071e3] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:bg-[#0071e3]/30";
const buttonOutline =
  "rounded-xl bg-white px-3 py-2 text-xs font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-200 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400";

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

type DropdownOption = { value: string; label: string };

function Dropdown({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className || ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputClass} flex w-full items-center justify-between text-left`}
      >
        <span className={`truncate ${selected ? "" : "text-neutral-400"}`}>
          {selected?.label || placeholder || "Select…"}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`ml-2 shrink-0 text-neutral-500 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1.5 max-h-72 overflow-auto rounded-xl bg-white p-1 ring-1 ring-black/[0.08] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18),0_4px_8px_-4px_rgba(0,0,0,0.08)]"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value || "__empty__"}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-2 shrink-0 text-[#0071e3]"
                  >
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

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
  const [chatOpen, setChatOpen] = useState(true);

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

  const categoryArticles = useMemo(() => {
    const items = articleCatalog?.items || [];
    if (!selectedProfile) return items;
    return items.filter((item) => item.category === selectedProfile.category);
  }, [articleCatalog, selectedProfile]);

  const filteredArticles = useMemo(() => {
    const lowered = articleQuery.trim().toLowerCase();
    if (!lowered) return categoryArticles;
    return categoryArticles.filter((item) =>
      [item.label, item.articleSlug, item.articleUrl, item.articlePath, ...item.headlineHints]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(lowered))
    );
  }, [categoryArticles, articleQuery]);

  const selectedArticle =
    filteredArticles.find((item) => item.articleKey === selectedArticleKey) ||
    categoryArticles.find((item) => item.articleKey === selectedArticleKey) ||
    filteredArticles[0] ||
    categoryArticles[0] ||
    null;

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
    const inCategory = (articleCatalog?.items || []).filter(
      (item) => item.category === selectedProfile.category
    );
    const currentStillValid = inCategory.some((item) => item.articleKey === selectedArticleKey);
    if (!currentStillValid) {
      setSelectedArticleKey(inCategory[0]?.articleKey || "");
      setArticleQuery("");
    }
  }, [selectedProfileId, selectedProfile, articleCatalog, selectedArticleKey]);

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

  const canRunSetup =
    Boolean(selectedProfile) &&
    Boolean(strategistPreview?.templateId) &&
    Boolean(strategistPreview?.rsocSite) &&
    Boolean(form.article.trim()) &&
    Boolean(form.headline.trim()) &&
    Boolean(facebookPreview?.adAccountId) &&
    Boolean(facebookPreview?.targeting) &&
    activeForcekeys.length >= 1;

  async function handleSetup(mode: SetupMode) {
    if (!selectedProfile || !strategistPreview || !facebookPreview) return;
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
          facebook: {
            adAccountId: facebookPreview.adAccountId,
            pageId: facebookPreview.pageId,
            pixelId: facebookPreview.pixelId,
            objective: facebookPreview.objective,
            customEventType: facebookPreview.customEventType,
            bidStrategy: facebookPreview.bidStrategy,
            bidAmount: facebookPreview.bidAmount,
            budgetPerAdSet: facebookPreview.budgetPerAdSet,
            targeting: facebookPreview.targeting,
          },
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
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] text-neutral-600">
        <div className={`${cardClass} px-6 py-4 text-sm`}>Loading {buyerLabel} preset catalog…</div>
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-6 text-neutral-700">
        <div className={`${cardClass} max-w-lg p-6`}>
          <p className="text-base font-semibold text-neutral-900">Could not load buyer workbench</p>
          <p className="mt-2 text-sm text-neutral-600">{error || "Unknown error"}</p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-xl bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f5f5f7] text-neutral-900">
      {/* Dashboard pane */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] px-6 py-6">
          {/* Header — flat text on page bg */}
          <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex h-6 items-center rounded-md bg-[#0071e3]/10 px-2 text-[11px] font-semibold uppercase tracking-wider text-[#0071e3]">
                Liftoff
              </div>
              <p className="mt-3 text-sm text-neutral-600">
                {buyerLabel} · {catalog.profiles.length} presets ·{" "}
                {Object.keys(catalog.lockedDefaults).length} locked defaults ·{" "}
                {catalog.manualFields.length} manual fields · {readyCount}/5 ready
              </p>
            </div>
            <div className="flex items-end gap-3">
              <div className="min-w-[220px]">
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
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                Locked defaults
              </span>
              {Object.entries(catalog.lockedDefaults).map(([key, value]) => (
                <span key={key} className={pillClass}>
                  {key}: {value}
                </span>
              ))}
            </div>
          ) : null}

          {/* Single canvas — form on the left, summary rail on the right */}
          <article className={cardClass}>
            <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] xl:divide-x xl:divide-black/[0.05]">
              {/* Form column */}
              <section className="p-6">
              {!selectedProfile ? null : (
                <div className="space-y-6">
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
                        <div className="mt-1.5 text-xs text-neutral-500">
                          {campaignItems.length > 0
                            ? `${campaignItems.length} ${buyerLabel} campaigns available for cloning`
                            : campaignCatalog?.notes?.[0] || "Campaign clone catalog unavailable"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-neutral-100 px-3.5 py-2.5">
                        <div className="text-xs text-neutral-500">Current preset</div>
                        <div className="mt-1 font-semibold text-neutral-900">{selectedProfile.label}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {selectedProfile.category.split(" > ").slice(0, -1).join(" • ") || "Category"}
                        </div>
                      </div>
                      <div className="rounded-xl bg-neutral-100 px-3.5 py-2.5">
                        <div className="text-xs text-neutral-500">Naming family</div>
                        <div className="mt-1 font-mono text-xs text-neutral-700">
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

                  <div className="h-px bg-black/[0.06]" />

                  {/* Content inputs */}
                  <div className="space-y-4">
                    <div className={sectionLabel}>Content inputs</div>

                      {selectedCampaign ? (
                        <div className="mb-3 rounded-xl bg-[#0071e3]/10 px-3 py-2.5 text-xs text-neutral-900">
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
                        </div>

                        <div className="rounded-xl bg-white px-3 py-2.5 text-xs text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                          <div className="text-neutral-500">Article details</div>
                          <div className="mt-1 text-sm font-semibold text-neutral-900">
                            {selectedArticle?.label || "No article selected"}
                          </div>
                          <div className="mt-1 text-neutral-500">
                            {selectedArticle?.articleSlug || "No slug"}
                          </div>
                          <div className="mt-2 text-neutral-500">
                            Used in {selectedArticle?.campaignCount || 0} {buyerLabel} campaign
                            {selectedArticle?.campaignCount === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>

                      <label className="mt-4 block">
                        <div className={fieldLabel}>Selected article URL or path</div>
                        <input
                          value={form.article}
                          onChange={(e) => setForm((c) => ({ ...c, article: e.target.value }))}
                          placeholder="Article URL or path"
                          className={inputClass}
                        />
                      </label>

                      <label className="mt-3 block">
                        <div className={fieldLabel}>Headline</div>
                        <input
                          value={form.headline}
                          onChange={(e) => setForm((c) => ({ ...c, headline: e.target.value }))}
                          placeholder={`Headline ${buyerLabel} wants attached to this launch`}
                          className={inputClass}
                        />
                      </label>

                      <div className="mt-3">
                        <div className={fieldLabel}>Forcekeys</div>
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {form.forcekeys.map((value, index) => (
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
                        <div className="mt-2 text-xs text-neutral-500">
                          Active forcekeys: {activeForcekeys.length}.
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-black/[0.06]" />

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
                        <div className="mt-4 grid gap-3 pt-4 md:grid-cols-3">
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

                      <div className="mt-4 rounded-xl bg-neutral-100/80 px-3 py-3">
                        <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                          Setup actions
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleSetup("strategis")}
                            disabled={!canRunSetup || runningSetup !== null}
                            className={buttonOutline}
                          >
                            {runningSetup === "strategis" ? "Setting up…" : "Setup in Strategis"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetup("facebook")}
                            disabled={!canRunSetup || runningSetup !== null}
                            className={buttonSecondary}
                          >
                            {runningSetup === "facebook" ? "Setting up…" : "Setup in Facebook"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetup("both")}
                            disabled={!canRunSetup || runningSetup !== null}
                            className={buttonPrimary}
                          >
                            {runningSetup === "both" ? "Setting up…" : "Setup in Both"}
                          </button>
                        </div>
                        <div className="mt-2 text-xs text-neutral-500">
                          Strategis creates the tracking shell only. Facebook creates the campaign and ad set shell
                          only. Both attempts both sides and stores the mapping when database access is available.
                        </div>
                      </div>

                      <label className="mt-4 block">
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
            <aside className="p-6">
              <div className="space-y-5">
                <div>
                  <div className={sectionLabel}>Strategis</div>
                  <div className="mt-2 space-y-1 text-sm text-neutral-800">
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

                <div className="h-px bg-black/[0.06]" />

                <div>
                  <div className={sectionLabel}>Facebook</div>
                  <div className="mt-2 space-y-1 text-sm text-neutral-800">
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

                <div className="h-px bg-black/[0.06]" />

                <div>
                  <div className={sectionLabel}>Readiness</div>
                  <div className="mt-2 space-y-1.5">
                    {readyChecks.map((check) => (
                      <div
                        key={check.label}
                        className="flex items-center justify-between text-sm text-neutral-800"
                      >
                        <span>{check.label}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            check.ok
                              ? "bg-[#34c759]/12 text-[#0a7d2e]"
                              : "bg-[#ff9500]/12 text-[#a55a00]"
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
                  <div className="rounded-xl bg-[#ff9500]/12 px-3 py-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-[#a55a00]">Warnings</div>
                    <ul className="mt-1.5 space-y-1 text-sm text-[#a55a00]">
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
                  <div className="rounded-xl bg-[#ff3b30]/10 px-3 py-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-[#a32018]">Setup error</div>
                    <div className="mt-1.5 text-sm text-[#a32018]">{setupError}</div>
                  </div>
                ) : null}

                {setupResult ? (
                  <div className="rounded-xl bg-[#34c759]/12 px-3 py-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-[#0a7d2e]">
                      {setupResult.mode} created
                    </div>
                    <div className="mt-1.5 space-y-1 text-sm text-[#063d15]">
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
                      <ul className="mt-2 space-y-1 text-xs text-[#0a7d2e]">
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
            <details className="group border-t border-black/[0.05]">
              <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-3 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 transition hover:bg-neutral-50">
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
              <div className="grid gap-4 px-6 pb-6 pt-2 lg:grid-cols-2">
                <div>
                  <div className={sectionLabel}>Strategis</div>
                  <pre className="mt-2 max-h-[280px] overflow-auto rounded-xl bg-neutral-100 p-3 text-xs text-neutral-800">
                    {JSON.stringify(strategistPreview, null, 2)}
                  </pre>
                </div>
                <div>
                  <div className={sectionLabel}>Facebook</div>
                  <pre className="mt-2 max-h-[280px] overflow-auto rounded-xl bg-neutral-100 p-3 text-xs text-neutral-800">
                    {JSON.stringify(facebookPreview, null, 2)}
                  </pre>
                </div>
              </div>
            </details>
          </article>
        </div>
      </main>

      {/* Companion chat — ChatGPT-style with multi-thread sidebar */}
      {chatOpen ? (
        <aside className="relative flex h-screen w-[560px] shrink-0 flex-col bg-white shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.08)] ring-1 ring-black/5">
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            aria-label="Close assistant"
            className="absolute right-3 top-3 z-30 inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition hover:bg-neutral-200"
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
            <C1Chat
              apiUrl={`/api/ben-launch?buyer=${encodeURIComponent(buyer)}`}
              formFactor="full-page"
              threadListManager={threadListManager}
            />
          </div>
        </aside>
      ) : null}
    </div>
  );
}
