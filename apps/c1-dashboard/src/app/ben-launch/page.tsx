"use client";

import { C1Chat } from "@thesysai/genui-sdk";
import "@crayonai/react-ui/styles/index.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

function copyJson(value: unknown) {
  return navigator.clipboard.writeText(JSON.stringify(value, null, 2));
}

// Shared Tailwind class fragments — keeps the markup readable and the palette consistent.
const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400";
const selectClass = inputClass;
const cardClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const subCardClass = "rounded-xl border border-slate-200 bg-slate-50";
const sectionLabel = "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";
const fieldLabel = "mb-1.5 block text-xs font-medium text-slate-600";
const pillClass =
  "inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600";
const buttonGhost =
  "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50";

export default function BenLaunchWorkbench() {
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
  const [showJson, setShowJson] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const response = await fetch("/api/ben-shell-catalog?buyer=Ben", { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.message || json?.error || "Failed to load catalog");
        }
        if (!isMounted) return;
        setCatalog(json);
        const firstProfile = json?.profiles?.[0];
        if (firstProfile) setSelectedProfileId(firstProfile.profileId);

        try {
          const articleResponse = await fetch("/api/ben-article-catalog?buyer=Ben", { cache: "no-store" });
          const articleJson = await articleResponse.json();
          if (articleResponse.ok && isMounted) setArticleCatalog(articleJson);
        } catch {
          if (isMounted) {
            setArticleCatalog({
              scope: { buyer: "Ben", campaignsAnalyzed: 0, articles: 0 },
              generatedAt: new Date().toISOString(),
              items: [],
              notes: ["Article catalog is temporarily unavailable."],
            });
          }
        }

        try {
          const campaignResponse = await fetch("/api/ben-campaign-catalog?buyer=Ben", { cache: "no-store" });
          const campaignJson = await campaignResponse.json();
          if (campaignResponse.ok && isMounted) {
            setCampaignCatalog(campaignJson);
          } else if (isMounted) {
            setCampaignCatalog({
              scope: { buyer: "Ben", organization: "Interlincx", campaigns: 0 },
              generatedAt: new Date().toISOString(),
              items: [],
              notes: [campaignJson?.message || campaignJson?.error || "Campaign clone catalog is unavailable."],
            });
          }
        } catch {
          if (isMounted) {
            setCampaignCatalog({
              scope: { buyer: "Ben", organization: "Interlincx", campaigns: 0 },
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
  }, []);

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
        buyer: catalog?.lockedDefaults.buyer || "ben",
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <div className={`${cardClass} px-6 py-4 text-sm`}>Loading Ben preset catalog…</div>
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-700">
        <div className={`${cardClass} max-w-lg p-6`}>
          <p className="text-base font-semibold text-slate-900">Could not load Ben workbench</p>
          <p className="mt-2 text-sm text-slate-600">{error || "Unknown error"}</p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Dashboard pane */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] px-6 py-6">
          {/* Header */}
          <header className={`${cardClass} mb-5 p-5`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 items-center rounded-md bg-indigo-50 px-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-700">
                    Ben Launch
                  </span>
                  <span className={pillClass}>one-screen shell</span>
                </div>
                <h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-slate-900">
                  Pick a proven launch shape, fill the content fields, and hand Facebook only the creative work.
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  {catalog.scope.strategistCampaigns} Strategis campaigns and{" "}
                  {catalog.scope.matchedFacebookAdSets} matched Facebook ad sets distilled into reusable presets.
                </p>
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

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Profiles", value: catalog.profiles.length },
                { label: "Locked defaults", value: Object.keys(catalog.lockedDefaults).length },
                { label: "Manual fields", value: catalog.manualFields.length },
                { label: "Readiness", value: `${readyCount}/5` },
              ].map((stat) => (
                <div key={stat.label} className={`${subCardClass} px-4 py-3`}>
                  <div className="text-xs text-slate-500">{stat.label}</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">{stat.value}</div>
                </div>
              ))}
            </div>
          </header>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            {/* Form column */}
            <section className={`${cardClass} p-5`}>
              {!selectedProfile ? null : (
                <>
                  {/* Preset row */}
                  <div className="border-b border-slate-100 pb-5">
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
                        <select
                          value={selectedProfile.profileId}
                          onChange={(e) => {
                            setSelectedProfileId(e.target.value);
                            setSelectedCampaignId("");
                            setForm(emptyForm());
                          }}
                          className={selectClass}
                        >
                          {filteredProfiles.map((profile) => (
                            <option key={profile.profileId} value={profile.profileId}>
                              {profile.category}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={fieldLabel}>Clone existing campaign</label>
                        <input
                          value={campaignQuery}
                          onChange={(e) => setCampaignQuery(e.target.value)}
                          placeholder="Search Ben campaigns…"
                          className={`${inputClass} mb-2`}
                        />
                        <select
                          value={selectedCampaignId}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            if (!nextId) {
                              setSelectedCampaignId("");
                              setForm(emptyForm());
                              return;
                            }
                            const nextCampaign = campaignItems.find((c) => c.campaignId === nextId);
                            if (nextCampaign) hydrateFromCampaign(nextCampaign);
                          }}
                          className={selectClass}
                        >
                          <option value="">Start from preset only</option>
                          {filteredCampaigns.map((campaign) => (
                            <option key={campaign.campaignId} value={campaign.campaignId}>
                              {campaign.campaignName}
                            </option>
                          ))}
                        </select>
                        <div className="mt-1.5 text-xs text-slate-500">
                          {campaignItems.length > 0
                            ? `${campaignItems.length} Ben campaigns available for cloning`
                            : campaignCatalog?.notes?.[0] || "Campaign clone catalog unavailable"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className={`${subCardClass} px-4 py-3`}>
                        <div className="text-xs text-slate-500">Current preset</div>
                        <div className="mt-1 font-semibold text-slate-900">{selectedProfile.label}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {selectedProfile.category.split(" > ").slice(0, -1).join(" • ") || "Category"}
                        </div>
                      </div>
                      <div className={`${subCardClass} px-4 py-3`}>
                        <div className="text-xs text-slate-500">Naming family</div>
                        <div className="mt-1 font-mono text-xs text-slate-700">
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

                  {/* Content inputs */}
                  <div className="space-y-4 pt-5">
                    <div className={`${subCardClass} p-4`}>
                      <div className={`${sectionLabel} mb-3`}>Content inputs</div>

                      {selectedCampaign ? (
                        <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900">
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
                            placeholder="Search Ben's articles for this category…"
                            className={`${inputClass} mb-2`}
                          />
                          <select
                            value={selectedArticle?.articleKey || ""}
                            onChange={(e) => {
                              const nextKey = e.target.value;
                              setSelectedArticleKey(nextKey);
                              const nextArticle = (articleCatalog?.items || []).find(
                                (item) => item.articleKey === nextKey
                              );
                              setForm((current) => ({
                                ...current,
                                article: nextArticle?.articleUrl || nextArticle?.articlePath || current.article,
                                headline: nextArticle?.headlineHints?.[0] || current.headline,
                              }));
                            }}
                            className={selectClass}
                          >
                            {filteredArticles.map((item) => (
                              <option key={item.articleKey} value={item.articleKey}>
                                {item.label} ({item.campaignCount})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                          <div className="text-slate-500">Article details</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">
                            {selectedArticle?.label || "No article selected"}
                          </div>
                          <div className="mt-1 text-slate-500">
                            {selectedArticle?.articleSlug || "No slug"}
                          </div>
                          <div className="mt-2 text-slate-500">
                            Used in {selectedArticle?.campaignCount || 0} campaign
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
                          placeholder="Headline Ben wants attached to this launch"
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
                        <div className="mt-2 text-xs text-slate-500">
                          Active forcekeys: {activeForcekeys.length}.
                        </div>
                      </div>
                    </div>

                    <div className={`${subCardClass} p-4`}>
                      <div className="mb-3 flex items-center justify-between">
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
                        <label className="block">
                          <div className={fieldLabel}>Selector variant</div>
                          <select
                            value={form.selectorVariant}
                            onChange={(e) => setForm((c) => ({ ...c, selectorVariant: e.target.value }))}
                            className={selectClass}
                          >
                            {selectorOptions.map((entry) => (
                              <option key={entry.key} value={entry.key}>
                                {entry.option.label}
                              </option>
                            ))}
                          </select>
                        </label>

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
                        <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-3">
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
                </>
              )}
            </section>

            {/* Summary column */}
            <aside className="space-y-4">
              <section className={`${cardClass} p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">Launch summary</h2>
                  <button
                    type="button"
                    onClick={() => setShowJson((v) => !v)}
                    className={buttonGhost}
                  >
                    {showJson ? "Hide JSON" : "Show JSON"}
                  </button>
                </div>

                <div className="space-y-3">
                  <div className={`${subCardClass} px-3 py-3`}>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Strategis</div>
                    <div className="mt-2 space-y-1 text-sm text-slate-800">
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

                  <div className={`${subCardClass} px-3 py-3`}>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Facebook</div>
                    <div className="mt-2 space-y-1 text-sm text-slate-800">
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

                  <div className={`${subCardClass} px-3 py-3`}>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Readiness</div>
                    <div className="mt-2 space-y-1.5">
                      {readyChecks.map((check) => (
                        <div
                          key={check.label}
                          className="flex items-center justify-between text-sm text-slate-800"
                        >
                          <span>{check.label}</span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              check.ok
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
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
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-amber-800">Warnings</div>
                      <ul className="mt-1.5 space-y-1 text-sm text-amber-900">
                        {[
                          ...(selectedCampaign?.notes || []),
                          ...(selectedProfile?.notes || []),
                        ].map((note) => (
                          <li key={note}>• {note}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className={`${cardClass} p-4`}>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Locked defaults
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(catalog.lockedDefaults).map(([key, value]) => (
                    <span key={key} className={pillClass}>
                      {key}: {value}
                    </span>
                  ))}
                </div>
              </section>

              {showJson ? (
                <>
                  <section className={`${cardClass} p-4`}>
                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Strategis shell JSON
                    </div>
                    <pre className="max-h-[280px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
                      {JSON.stringify(strategistPreview, null, 2)}
                    </pre>
                  </section>
                  <section className={`${cardClass} p-4`}>
                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Facebook shell JSON
                    </div>
                    <pre className="max-h-[280px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
                      {JSON.stringify(facebookPreview, null, 2)}
                    </pre>
                  </section>
                </>
              ) : null}
            </aside>
          </div>
        </div>
      </main>

      {/* Companion chat */}
      {chatOpen ? (
        <aside className="flex h-screen w-[420px] shrink-0 flex-col border-l border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                Launch Assistant
              </div>
              <div className="text-xs text-slate-500">Powered by Thesys C1</div>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className={buttonGhost}
              aria-label="Close assistant"
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <C1Chat apiUrl="/api/ben-launch" theme={{ mode: "light" }} agentName="Ben Launch Assistant" />
          </div>
        </aside>
      ) : null}
    </div>
  );
}
