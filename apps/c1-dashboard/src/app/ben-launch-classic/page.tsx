"use client";

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
  support: {
    count: number;
    pct: number;
  };
  selector: {
    optimizationGoal: string;
    billingEvent: string;
    bidStrategy: string;
    bidAmount: string | number;
    promotedObject: {
      pixelId: string;
      event: string;
    };
    targeting: SelectorTargeting;
  };
  sampleCampaignIds: string[];
};

type CatalogField = {
  value: string;
  support: {
    count: number;
    pct: number;
  };
};

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
    locked: {
      optimizationGoal: string;
      billingEvent: string;
      customEventType: string;
    };
    primarySelector: SelectorOption | null;
    alternateSelectors: SelectorOption[];
  };
  workflow: {
    lockedInputs: string[];
    buyerInputs: string[];
    optionalOverrides: string[];
  };
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
  scope: {
    buyer: string;
    campaignsAnalyzed: number;
    articles: number;
  };
  generatedAt: string;
  items: BenArticleCatalogItem[];
  notes: string[];
};

type CloneSelector = {
  optimizationGoal: string;
  billingEvent: string;
  bidStrategy: string;
  bidAmount: string | number;
  promotedObject: {
    pixelId: string;
    event: string;
  };
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
  scope: {
    buyer: string;
    organization: string;
    campaigns: number;
  };
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

function pct(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function supportText(field: CatalogField | null) {
  if (!field) return "No prior";
  return `${field.support.count} launches · ${pct(field.support.pct)}`;
}

function formatSelectorDetails(targeting: SelectorTargeting) {
  const geo = targeting.countries.length > 0 ? targeting.countries.join(", ") : "Open country";
  const ages =
    targeting.ageMin !== null && targeting.ageMax !== null
      ? `${targeting.ageMin}-${targeting.ageMax}`
      : "Open age";
  const placements =
    targeting.publisherPlatforms.length > 0 ||
    targeting.facebookPositions.length > 0 ||
    targeting.instagramPositions.length > 0
      ? "Manual placements"
      : "Auto placements";
  const audience =
    targeting.advantageAudience === 1
      ? "Advantage+ on"
      : targeting.advantageAudience === 0
        ? "Advantage+ off"
        : "Advantage+ unknown";

  return [ages, geo, audience, placements].join(" · ");
}

function copyJson(value: unknown) {
  return navigator.clipboard.writeText(JSON.stringify(value, null, 2));
}

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
        if (firstProfile) {
          setSelectedProfileId(firstProfile.profileId);
        }

        try {
          const articleResponse = await fetch("/api/ben-article-catalog?buyer=Ben", { cache: "no-store" });
          const articleJson = await articleResponse.json();
          if (articleResponse.ok && isMounted) {
            setArticleCatalog(articleJson);
          }
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
      [profile.category, profile.label, profile.profileId].some((value) => value.toLowerCase().includes(lowered))
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
      [
        item.label,
        item.articleSlug,
        item.articleUrl,
        item.articlePath,
        ...item.headlineHints,
      ]
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
    const inCategory = (articleCatalog?.items || []).filter((item) => item.category === selectedProfile.category);
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
          support: {
            count: 1,
            pct: 1,
          },
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

  const selectedSelector = selectorOptions.find((entry) => entry.key === form.selectorVariant)?.option || selectorOptions[0]?.option || null;

  const activeForcekeys = form.forcekeys.map((value) => value.trim()).filter(Boolean);
  const readyChecks = [
    { label: "Preset selected", ok: !!selectedProfile },
    { label: "Article entered", ok: form.article.trim().length > 0 },
    { label: "Headline entered", ok: form.headline.trim().length > 0 },
    { label: "At least 5 forcekeys", ok: activeForcekeys.length >= 5 },
    { label: "Creative notes or upload handoff", ok: form.creativeNotes.trim().length > 0 },
  ];
  const readyCount = readyChecks.filter((item) => item.ok).length;

  const strategistPreview = selectedProfile
    ? {
        buyer: catalog?.lockedDefaults.buyer || "ben",
        networkName: catalog?.lockedDefaults.networkName || "facebook",
        country: catalog?.lockedDefaults.country || "US - United States of America",
        organization: catalog?.lockedDefaults.organization || "Interlincx",
        language: selectedProfile.strategist.language?.value || catalog?.lockedDefaults.language || "EN - English",
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

  const facebookPreview = selectedProfile && selectedSelector
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
    if (matchingProfile) {
      setSelectedProfileId(matchingProfile.profileId);
    }

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
      <div className="min-h-screen bg-[#f3efe6] text-[#1d2430]">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
          <div className="rounded-[28px] border border-[#d7cfc1] bg-white px-8 py-6 text-sm text-[#5f6774] shadow-[0_24px_70px_rgba(32,30,24,0.08)]">
            Loading Ben preset catalog...
          </div>
        </div>
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <div className="min-h-screen bg-[#f3efe6] text-[#1d2430]">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
          <div className="rounded-[28px] border border-[#e4b4a8] bg-[#fff6f3] p-8 shadow-[0_24px_70px_rgba(32,30,24,0.08)]">
            <p className="text-lg font-semibold">Could not load Ben workbench</p>
            <p className="mt-2 text-sm text-[#6f5f5a]">{error || "Unknown error"}</p>
            <Link href="/" className="mt-6 inline-flex rounded-full border border-[#d7cfc1] bg-white px-4 py-2 text-sm text-[#465063]">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3efe6] text-[#1d2430]">
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-5 rounded-[32px] border border-[#d7cfc1] bg-[linear-gradient(180deg,#fffdf8_0%,#f7f1e7_100%)] p-7 shadow-[0_24px_80px_rgba(34,31,25,0.08)] md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.32em] text-[#a45b33]">
              <span>Ben Launch Workbench</span>
              <span className="rounded-full border border-[#dbcdbf] bg-white px-3 py-1 tracking-[0.22em] text-[#6c6259]">
                one-screen shell
              </span>
            </div>
            <h1 className="max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.03em] text-[#1b2028] sm:text-[42px]">
              Pick a proven launch shape, fill the content fields, and hand Facebook only the creative work.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[#5f6774]">
              {catalog.scope.strategistCampaigns} Strategis campaigns and {catalog.scope.matchedFacebookAdSets} matched Facebook ad sets were distilled into reusable presets for Ben.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-[24px] border border-[#ddd2c4] bg-white px-4 py-3">
              <div className="text-[#7a736b]">Profiles</div>
              <div className="mt-1 text-2xl font-semibold text-[#1d2430]">{catalog.profiles.length}</div>
            </div>
            <div className="rounded-[24px] border border-[#ddd2c4] bg-white px-4 py-3">
              <div className="text-[#7a736b]">Locked defaults</div>
              <div className="mt-1 text-2xl font-semibold text-[#1d2430]">{Object.keys(catalog.lockedDefaults).length}</div>
            </div>
            <div className="rounded-[24px] border border-[#ddd2c4] bg-white px-4 py-3">
              <div className="text-[#7a736b]">Manual fields</div>
              <div className="mt-1 text-2xl font-semibold text-[#1d2430]">{catalog.manualFields.length}</div>
            </div>
            <div className="rounded-[24px] border border-[#ddd2c4] bg-white px-4 py-3">
              <div className="text-[#7a736b]">Readiness</div>
              <div className="mt-1 text-2xl font-semibold text-[#1d2430]">{readyCount}/5</div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-[30px] border border-[#d7cfc1] bg-white p-5 shadow-[0_20px_50px_rgba(36,33,27,0.06)]">
            {!selectedProfile ? null : (
              <>
                <div className="mb-5 border-b border-[#ece3d8] pb-5">
                  <div className="text-[11px] uppercase tracking-[0.3em] text-[#a45b33]">Launch preset</div>
                  <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_220px]">
                    <div>
                      <label className="mb-2 block text-sm text-[#58616f]">Category preset</label>
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search categories..."
                        className="mb-3 w-full rounded-[20px] border border-[#ddd4c8] bg-[#fcfaf6] px-4 py-3 text-sm text-[#1d2430] outline-none placeholder:text-[#9a9084]"
                      />
                      <select
                        value={selectedProfile.profileId}
                        onChange={(e) => {
                          setSelectedProfileId(e.target.value);
                          setSelectedCampaignId("");
                          setForm(emptyForm());
                        }}
                        className="w-full rounded-[20px] border border-[#ddd4c8] bg-white px-4 py-3 text-sm text-[#1d2430] outline-none"
                      >
                        {filteredProfiles.map((profile) => (
                          <option key={profile.profileId} value={profile.profileId}>
                            {profile.category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-[#58616f]">Clone existing campaign</label>
                      <input
                        value={campaignQuery}
                        onChange={(e) => setCampaignQuery(e.target.value)}
                        placeholder="Search Ben campaigns..."
                        className="mb-3 w-full rounded-[20px] border border-[#ddd4c8] bg-[#fcfaf6] px-4 py-3 text-sm text-[#1d2430] outline-none placeholder:text-[#9a9084]"
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
                          const nextCampaign = campaignItems.find((campaign) => campaign.campaignId === nextId);
                          if (nextCampaign) {
                            hydrateFromCampaign(nextCampaign);
                          }
                        }}
                        className="w-full rounded-[20px] border border-[#ddd4c8] bg-white px-4 py-3 text-sm text-[#1d2430] outline-none"
                      >
                        <option value="">Start from preset only</option>
                        {filteredCampaigns.map((campaign) => (
                          <option key={campaign.campaignId} value={campaign.campaignId}>
                            {campaign.campaignName}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 text-xs text-[#8f8579]">
                        {campaignItems.length > 0
                          ? `${campaignItems.length} Ben campaigns available for cloning`
                          : campaignCatalog?.notes?.[0] || "Campaign clone catalog unavailable"}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-[#e2d7ca] bg-[#faf6ef] px-4 py-3 text-sm text-[#626a77]">
                      <div className="text-xs uppercase tracking-[0.22em] text-[#8c8378]">Current preset</div>
                      <div className="mt-2 text-lg font-semibold text-[#20262f]">{selectedProfile.label}</div>
                      <div className="mt-2 text-xs text-[#8f8579]">{selectedProfile.category.split(" > ").slice(0, -1).join(" • ") || "Category"}</div>
                    </div>

                    <div className="rounded-[22px] border border-[#e2d7ca] bg-[#faf6ef] px-4 py-3 text-sm text-[#626a77]">
                      <div className="text-xs uppercase tracking-[0.22em] text-[#8c8378]">Naming family</div>
                      <div className="mt-2 font-mono text-xs text-[#252b34]">
                        {selectedProfile.strategist.namingFamily?.value || "No dominant family"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#6c746f]">
                    {selectedProfile.strategist.rsocSite?.value ? (
                      <span className="rounded-full border border-[#ded5c9] bg-[#faf6f0] px-3 py-1">{selectedProfile.strategist.rsocSite.value}</span>
                    ) : null}
                    {selectedProfile.facebook.adAccountId?.value ? (
                      <span className="rounded-full border border-[#ded5c9] bg-[#faf6f0] px-3 py-1">acct {selectedProfile.facebook.adAccountId.value}</span>
                    ) : null}
                    {selectedProfile.facebook.pageId?.value ? (
                      <span className="rounded-full border border-[#ded5c9] bg-[#faf6f0] px-3 py-1">page {selectedProfile.facebook.pageId.value}</span>
                    ) : null}
                    {selectedSelector ? (
                      <span className="rounded-full border border-[#ded5c9] bg-[#faf6f0] px-3 py-1">{selectedSelector.label}</span>
                    ) : null}
                    {selectedArticle?.articleSlug ? (
                      <span className="rounded-full border border-[#ded5c9] bg-[#faf6f0] px-3 py-1">article {selectedArticle.articleSlug}</span>
                    ) : null}
                    {selectedCampaign ? (
                      <span className="rounded-full border border-[#ded5c9] bg-[#faf6f0] px-3 py-1">clone {selectedCampaign.campaignId}</span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border border-[#ebe2d6] bg-[#fcfaf6] p-4">
                      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-[#877d72]">Content inputs</h3>
                      <div className="space-y-4">
                        {selectedCampaign ? (
                          <div className="rounded-[22px] border border-[#d9d1c5] bg-white px-4 py-3 text-sm text-[#5f6774]">
                            Cloning shell from <span className="font-semibold text-[#1f2630]">{selectedCampaign.campaignName}</span>. This copies the article, headline, forcekeys, redirect, page, and account into the workbench while leaving ads and creatives out.
                          </div>
                        ) : null}

                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                          <div>
                            <label className="mb-2 block text-sm text-[#58616f]">Article selector</label>
                            <input
                              value={articleQuery}
                              onChange={(e) => setArticleQuery(e.target.value)}
                              placeholder="Search Ben's articles for this category..."
                              className="mb-3 w-full rounded-[20px] border border-[#ddd4c8] bg-white px-4 py-3 text-sm text-[#1d2430] outline-none placeholder:text-[#9a9084]"
                            />
                            <select
                              value={selectedArticle?.articleKey || ""}
                              onChange={(e) => {
                                const nextKey = e.target.value;
                                setSelectedArticleKey(nextKey);
                                const nextArticle = (articleCatalog?.items || []).find((item) => item.articleKey === nextKey);
                                setForm((current) => ({
                                  ...current,
                                  article: nextArticle?.articleUrl || nextArticle?.articlePath || current.article,
                                  headline: nextArticle?.headlineHints?.[0] || current.headline,
                                }));
                              }}
                              className="w-full rounded-[20px] border border-[#ddd4c8] bg-white px-4 py-3 text-sm text-[#1d2430] outline-none"
                            >
                              {filteredArticles.map((item) => (
                                <option key={item.articleKey} value={item.articleKey}>
                                  {item.label} ({item.campaignCount})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="rounded-[22px] border border-[#e2d7ca] bg-[#faf6ef] px-4 py-3 text-sm text-[#626a77]">
                            <div className="text-xs uppercase tracking-[0.22em] text-[#8c8378]">Article details</div>
                            <div className="mt-2 text-sm font-semibold text-[#20262f]">{selectedArticle?.label || "No article selected"}</div>
                            <div className="mt-2 text-xs text-[#8f8579]">{selectedArticle?.articleSlug || "No slug"}</div>
                            <div className="mt-3 text-xs text-[#8f8579]">
                              Used in {selectedArticle?.campaignCount || 0} Ben campaign{selectedArticle?.campaignCount === 1 ? "" : "s"}
                            </div>
                          </div>
                        </div>

                        <label className="block">
                          <div className="mb-2 text-sm text-[#58616f]">Selected article URL or path</div>
                          <input
                            value={form.article}
                            onChange={(e) => setForm((current) => ({ ...current, article: e.target.value }))}
                            placeholder="Article URL or path"
                            className="w-full rounded-[20px] border border-[#ddd4c8] bg-white px-4 py-3 text-sm text-[#1d2430] outline-none placeholder:text-[#9a9084]"
                          />
                        </label>

                        <label className="block">
                          <div className="mb-2 text-sm text-[#58616f]">Headline</div>
                          <input
                            value={form.headline}
                            onChange={(e) => setForm((current) => ({ ...current, headline: e.target.value }))}
                            placeholder="Headline Ben wants attached to this launch"
                            className="w-full rounded-[20px] border border-[#ddd4c8] bg-white px-4 py-3 text-sm text-[#1d2430] outline-none placeholder:text-[#9a9084]"
                          />
                        </label>

                        <div>
                          <div className="mb-2 text-sm text-[#58616f]">Forcekeys</div>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                                className="rounded-[20px] border border-[#ddd4c8] bg-white px-4 py-3 text-sm text-[#1d2430] outline-none placeholder:text-[#9a9084]"
                              />
                            ))}
                          </div>
                          <div className="mt-2 text-xs text-[#958c80]">
                            Active forcekeys: {activeForcekeys.length}. Ben usually needs enough stack depth before this is worth handing to Facebook.
                          </div>
                        </div>
                      </div>
                  </div>

                  <div className="rounded-[28px] border border-[#ebe2d6] bg-[#fcfaf6] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-[#877d72]">Launch controls</h3>
                      <button
                        type="button"
                        onClick={() => setShowAdvanced((value) => !value)}
                        className="rounded-full border border-[#d8d0c3] bg-white px-3 py-1 text-xs text-[#5c6571] hover:bg-[#f7f3ed]"
                      >
                        {showAdvanced ? "Hide advanced" : "Show advanced"}
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="block">
                        <div className="mb-2 text-sm text-[#58616f]">Selector variant</div>
                        <select
                          value={form.selectorVariant}
                          onChange={(e) => setForm((current) => ({ ...current, selectorVariant: e.target.value }))}
                          className="w-full rounded-[20px] border border-[#ddd4c8] bg-white px-4 py-3 text-sm text-[#1d2430] outline-none"
                        >
                          {selectorOptions.map((entry) => (
                            <option key={entry.key} value={entry.key}>
                              {entry.option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <div className="mb-2 text-sm text-[#58616f]">Budget per ad set ($)</div>
                        <input
                          value={form.budgetAmount}
                          onChange={(e) => setForm((current) => ({ ...current, budgetAmount: e.target.value }))}
                          className="w-full rounded-[20px] border border-[#ddd4c8] bg-white px-4 py-3 text-sm text-[#1d2430] outline-none"
                        />
                      </label>

                      <label className="block">
                        <div className="mb-2 text-sm text-[#58616f]">Bid cap override</div>
                        <input
                          value={form.bidCap}
                          onChange={(e) => setForm((current) => ({ ...current, bidCap: e.target.value }))}
                          placeholder="Leave blank for preset bidding"
                          className="w-full rounded-[20px] border border-[#ddd4c8] bg-white px-4 py-3 text-sm text-[#1d2430] outline-none placeholder:text-[#9a9084]"
                        />
                      </label>
                    </div>

                    {showAdvanced ? (
                      <div className="mt-4 grid gap-4 border-t border-[#ece3d8] pt-4 md:grid-cols-2">
                        <label className="block">
                          <div className="mb-2 text-sm text-[#58616f]">Redirect domain override</div>
                          <input
                            value={form.redirectDomain}
                            onChange={(e) => setForm((current) => ({ ...current, redirectDomain: e.target.value }))}
                            className="w-full rounded-[20px] border border-[#ddd4c8] bg-white px-4 py-3 text-sm text-[#1d2430] outline-none"
                          />
                        </label>

                        <label className="block">
                          <div className="mb-2 text-sm text-[#58616f]">Facebook page override</div>
                          <input
                            value={form.pageId}
                            onChange={(e) => setForm((current) => ({ ...current, pageId: e.target.value }))}
                            className="w-full rounded-[20px] border border-[#ddd4c8] bg-white px-4 py-3 text-sm text-[#1d2430] outline-none"
                          />
                        </label>

                        <label className="block">
                          <div className="mb-2 text-sm text-[#58616f]">Ad account override</div>
                          <input
                            value={form.adAccountId}
                            onChange={(e) => setForm((current) => ({ ...current, adAccountId: e.target.value }))}
                            className="w-full rounded-[20px] border border-[#ddd4c8] bg-white px-4 py-3 text-sm text-[#1d2430] outline-none"
                          />
                        </label>
                      </div>
                    ) : null}

                    <label className="mt-4 block">
                      <div className="mb-2 text-sm text-[#58616f]">Creative handoff notes</div>
                      <textarea
                        value={form.creativeNotes}
                        onChange={(e) => setForm((current) => ({ ...current, creativeNotes: e.target.value }))}
                        placeholder="Anything Facebook upload still needs: angle, asset list, variants, page notes..."
                        className="min-h-[120px] w-full rounded-[20px] border border-[#ddd4c8] bg-white px-4 py-3 text-sm text-[#1d2430] outline-none placeholder:text-[#9a9084]"
                      />
                    </label>
                  </div>
                </div>
              </>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-[30px] border border-[#d7cfc1] bg-[#f8f4ec] p-5 shadow-[0_14px_42px_rgba(36,33,27,0.05)]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#1f2630]">Launch summary</h2>
                <button
                  type="button"
                  onClick={() => setShowJson((value) => !value)}
                  className="rounded-full border border-[#d8d0c3] bg-white px-3 py-1 text-xs text-[#5c6571] hover:bg-[#f7f3ed]"
                >
                  {showJson ? "Hide JSON" : "Show JSON"}
                </button>
              </div>

              <div className="space-y-3">
                <div className="rounded-[22px] border border-[#dfd6cb] bg-white px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-[#8b8379]">Strategis</div>
                  <div className="mt-2 space-y-1 text-sm text-[#222932]">
                    <div>Article: {selectedCampaign?.articleSlug || selectedArticle?.label || form.article || "Unset"}</div>
                    <div>Site: {strategistPreview?.rsocSite || "Unset"}</div>
                    <div>Subdirectory: {strategistPreview?.subdirectory || "Unset"}</div>
                    <div>Redirect: {strategistPreview?.redirectDomain || "Unset"}</div>
                    <div>Forcekeys: {activeForcekeys.length}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => strategistPreview && handleCopy("strategis", strategistPreview)}
                    className="mt-3 rounded-full border border-[#d8d0c3] bg-[#fcfaf6] px-3 py-1 text-xs text-[#5c6571]"
                  >
                    {copied === "strategis" ? "Copied" : "Copy Strategis JSON"}
                  </button>
                </div>

                <div className="rounded-[22px] border border-[#dfd6cb] bg-white px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-[#8b8379]">Facebook</div>
                  <div className="mt-2 space-y-1 text-sm text-[#222932]">
                    <div>Ad account: {facebookPreview?.adAccountId || "Unset"}</div>
                    <div>Page: {facebookPreview?.pageId || "Unset"}</div>
                    <div>Pixel: {facebookPreview?.pixelId || "Unset"}</div>
                    <div>Bid strategy: {facebookPreview?.bidStrategy || "Unset"}</div>
                    {selectedCampaign ? (
                      <div>Source campaign: {selectedCampaign.campaignId}</div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => facebookPreview && handleCopy("facebook", facebookPreview)}
                    className="mt-3 rounded-full border border-[#d8d0c3] bg-[#fcfaf6] px-3 py-1 text-xs text-[#5c6571]"
                  >
                    {copied === "facebook" ? "Copied" : "Copy Facebook JSON"}
                  </button>
                </div>

                <div className="rounded-[22px] border border-[#dfd6cb] bg-white px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-[#8b8379]">Readiness</div>
                  <div className="mt-2 space-y-2">
                    {readyChecks.map((check) => (
                      <div key={check.label} className="flex items-center justify-between text-sm text-[#2a313b]">
                        <span>{check.label}</span>
                        <span className={check.ok ? "text-emerald-700" : "text-amber-700"}>
                          {check.ok ? "Ready" : "Missing"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {(selectedProfile?.notes || []).length > 0 || (selectedCampaign?.notes || []).length > 0 ? (
                  <div className="rounded-[22px] border border-[#e6d4c6] bg-[#fff8f1] px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-[#9b5e38]">Warnings</div>
                    <ul className="mt-2 space-y-2 text-sm text-[#5d5349]">
                      {[...(selectedCampaign?.notes || []), ...(selectedProfile?.notes || [])].map((note) => (
                        <li key={note}>• {note}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[30px] border border-[#d7cfc1] bg-[#f8f4ec] p-5 shadow-[0_14px_42px_rgba(36,33,27,0.05)]">
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[#877d72]">Locked defaults</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(catalog.lockedDefaults).map(([key, value]) => (
                  <span key={key} className="rounded-full border border-[#dfd6cb] bg-white px-3 py-2 text-xs text-[#4d5562]">
                    {key}: {value}
                  </span>
                ))}
              </div>
            </section>

            {showJson ? (
              <>
                <section className="rounded-[30px] border border-[#d7cfc1] bg-[#f8f4ec] p-5 shadow-[0_14px_42px_rgba(36,33,27,0.05)]">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-[#877d72]">Strategis shell JSON</h3>
                  <pre className="max-h-[300px] overflow-auto rounded-[20px] border border-[#dfd6cb] bg-[#fffdfa] p-4 text-xs text-[#334050]">
                    {JSON.stringify(strategistPreview, null, 2)}
                  </pre>
                </section>

                <section className="rounded-[30px] border border-[#d7cfc1] bg-[#f8f4ec] p-5 shadow-[0_14px_42px_rgba(36,33,27,0.05)]">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-[#877d72]">Facebook shell JSON</h3>
                  <pre className="max-h-[300px] overflow-auto rounded-[20px] border border-[#dfd6cb] bg-[#fffdfa] p-4 text-xs text-[#334050]">
                    {JSON.stringify(facebookPreview, null, 2)}
                  </pre>
                </section>
              </>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
