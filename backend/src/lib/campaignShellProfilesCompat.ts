export type ValueCount = {
  value: string;
  count: number;
  pct: number;
};

export type NamingFamily = {
  pattern: string;
  count: number;
  pct: number;
  example: string;
};

export type CategoryShellProfile = {
  category: string;
  campaignCount: number;
  dominantValues: Record<string, ValueCount | null>;
  namingFamilies: NamingFamily[];
  exampleCampaigns: string[];
};

export type CampaignShellProfileReport = {
  scope: {
    buyer: string;
    campaignCount: number;
  };
  generatedAt: string;
  fields: any[];
  namingFamilies: NamingFamily[];
  categoryProfiles: CategoryShellProfile[];
  recommendation: {
    autoPopulateAlways: Record<string, string>;
    defaultButOverride: Record<string, ValueCount>;
    categoryScopedFields: string[];
    buyerInputFields: string[];
    missingForFacebookShell: string[];
    notes: string[];
  };
};
