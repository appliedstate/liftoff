export type ValueCount = {
  value: string;
  count: number;
  pct: number;
};

export type SelectorFamily = {
  key: string;
  count: number;
  pct: number;
  sampleCampaignIds: string[];
};

export type CategorySelectorProfile = {
  category: string;
  campaignCount: number;
  dominantAccountId: ValueCount | null;
  dominantPixelId: ValueCount | null;
  dominantPageId: ValueCount | null;
  selectorFamilies: SelectorFamily[];
};

export type FacebookSettingsProfileReport = {
  scope: {
    buyer: string;
    matchedCampaigns: number;
    matchedAdSets: number;
    matchedAds: number;
  };
  generatedAt: string;
  campaignFields: Record<string, ValueCount[]>;
  adSetFields: Record<string, ValueCount[]>;
  selectorFamilies: SelectorFamily[];
  categoryProfiles: CategorySelectorProfile[];
  recommendations: {
    lockedSelectors: string[];
    profileSelectors: string[];
    manualFields: string[];
    notes: string[];
  };
};
