# Strategis Campaign Setup — Implementation Guide

## Document Purpose
This guide provides detailed implementation instructions for integrating Strategis campaign setup with the Attention Engine's naming conventions, based on confirmed answers from Devin.

**Status**: Implementation Guide ✅  
**Owner**: Engineering (Platform)  
**Version**: 1.0 (2025-01-XX)

---

## Architecture Overview

### Integration Pattern: Liftoff-Coordinated

```
Attention Engine
    ↓ (generates campaign plan + naming)
    ↓
Liftoff Campaign Factory Service
    ├─→ Meta Ads API (create Facebook campaigns/adsets/ads)
    │     ↓ Returns: FB Campaign ID, Ad Set IDs, Ad IDs
    └─→ Strategis API (create tracking campaigns)
          ↓ Returns: Strategis Campaign IDs
    ↓
Store Mappings (FB IDs ↔ Strategis IDs)
```

---

## Implementation Components

### 1. Naming Generator Service

**File**: `backend/src/services/namingGenerator.ts`

```typescript
import { CampaignPlan, AdSetPlan, AdPlan } from '../types/campaign';

export interface NamingInputs {
  brand: string;
  objective: string;
  hookSetId: string;
  market: string;
  channel: string;
  date: string; // YYYY-MM-DD
}

export interface AdSetNamingInputs {
  audienceKey: string;
  placementKey: string;
  optimizationEvent: string;
  budgetType: 'CBO' | 'ABO';
  version: number;
}

export interface AdNamingInputs {
  creativeType: 'IMG' | 'VID';
  hookId: string;
  variant: string;
  format: '1x1' | '4x5' | '9x16';
  lang: string;
}

/**
 * Generate campaign name according to Attention Engine convention
 * Format: {Brand} | {Objective} | {HookSet} | {Market} | {Channel} | {YYYY-MM-DD}
 */
export function generateCampaignName(inputs: NamingInputs): string {
  const { brand, objective, hookSetId, market, channel, date } = inputs;
  return `${brand} | ${objective} | ${hookSetId} | ${market} | ${channel} | ${date}`;
}

/**
 * Generate ad set name according to Attention Engine convention
 * Format: {AudienceKey} | {PlacementKey} | {OptimizationEvent} | {BudgetType} | v{N}
 */
export function generateAdSetName(inputs: AdSetNamingInputs): string {
  const { audienceKey, placementKey, optimizationEvent, budgetType, version } = inputs;
  return `${audienceKey} | ${placementKey} | ${optimizationEvent} | ${budgetType} | v${version}`;
}

/**
 * Generate ad name according to Attention Engine convention
 * Format: {CreativeType} | {HookId} | {Variant} | {Format} | {Lang}
 */
export function generateAdName(inputs: AdNamingInputs): string {
  const { creativeType, hookId, variant, format, lang } = inputs;
  return `${creativeType} | ${hookId} | ${variant} | ${format} | ${lang}`;
}

/**
 * Generate Strategis campaign name (combines campaign + ad set names)
 * Format: {CampaignName} - {AdSetName}
 */
export function generateStrategisCampaignName(
  campaignName: string,
  adSetName: string
): string {
  return `${campaignName} - ${adSetName}`;
}
```

---

### 2. Strategis API Client

**File**: `backend/src/services/strategisClient.ts`

```typescript
import axios, { AxiosInstance } from 'axios';

export interface StrategisCampaignRequest {
  name: string;
  category: string;
  template: { id: string };
  properties: {
    buyer: string;
    networkName: string;
    networkAccountId: string;
    destination: string;
    domain: string;
    fbAdAccount: string;
    fbPage?: string;
    fbCampaignId?: string;
    fbAdSetId?: string;
  };
  organizations: string[];
}

export interface StrategisCampaign {
  id: string;
  name: string;
  // ... other fields
}

export class StrategisClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.STRATEGIS_API_BASE_URL || 'https://api.strategis.internal';
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${process.env.STRATEGIS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Create a campaign in Strategis
   */
  async createCampaign(request: StrategisCampaignRequest): Promise<StrategisCampaign> {
    try {
      const response = await this.client.post<StrategisCampaign>('/api/campaigns', request);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Strategis API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`
        );
      }
      throw error;
    }
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(id: string): Promise<StrategisCampaign> {
    const response = await this.client.get<StrategisCampaign>(`/api/campaigns/${id}`);
    return response.data;
  }
}
```

---

### 3. Meta Ads API Client

**File**: `backend/src/services/metaAdsClient.ts`

```typescript
import axios, { AxiosInstance } from 'axios';

export interface FacebookCampaignRequest {
  name: string;
  objective: string;
  special_ad_categories: string[];
  status: 'PAUSED' | 'ACTIVE';
  buying_type?: 'AUCTION';
  is_campaign_budget_optimized?: boolean;
  daily_budget?: string; // in micros
}

export interface FacebookAdSetRequest {
  campaign_id: string;
  name: string;
  optimization_goal: string;
  billing_event: string;
  targeting: any;
  status: 'PAUSED' | 'ACTIVE';
  start_time?: string;
  promoted_object?: {
    pixel_id: string;
    custom_event_type: string;
  };
  daily_budget?: string; // for ABO
  bid_strategy?: string;
}

export interface FacebookAdRequest {
  adset_id: string;
  name: string;
  creative: {
    creative_id?: string;
    object_story_spec?: any;
  };
  status: 'PAUSED' | 'ACTIVE';
}

export class MetaAdsClient {
  private client: AxiosInstance;
  private accessToken: string;
  private apiVersion: string;

  constructor() {
    this.accessToken = process.env.META_ADS_ACCESS_TOKEN || '';
    this.apiVersion = process.env.META_ADS_API_VERSION || 'v24.0';
    this.client = axios.create({
      baseURL: `https://graph.facebook.com/${this.apiVersion}`,
      timeout: 30000,
    });
  }

  /**
   * Create a Facebook campaign
   */
  async createCampaign(
    adAccountId: string,
    request: FacebookCampaignRequest
  ): Promise<{ id: string }> {
    const response = await this.client.post(`/${adAccountId}/campaigns`, request, {
      params: { access_token: this.accessToken },
    });
    return response.data;
  }

  /**
   * Create a Facebook ad set
   */
  async createAdSet(request: FacebookAdSetRequest): Promise<{ id: string }> {
    const response = await this.client.post('/adcampaigns', request, {
      params: { access_token: this.accessToken },
    });
    return response.data;
  }

  /**
   * Create a Facebook ad
   */
  async createAd(request: FacebookAdRequest): Promise<{ id: string }> {
    const response = await this.client.post('/ads', request, {
      params: { access_token: this.accessToken },
    });
    return response.data;
  }
}
```

---

### 4. Campaign Factory Service

**File**: `backend/src/services/campaignFactory.ts`

```typescript
import { generateCampaignName, generateAdSetName, generateStrategisCampaignName } from './namingGenerator';
import { StrategisClient } from './strategisClient';
import { MetaAdsClient } from './metaAdsClient';

export interface CampaignPlan {
  brand: string;
  objective: string;
  hookSetId: string;
  market: string;
  channel: string;
  date: string;
  adAccountId: string;
  category: string;
  templateId: string;
  organization: string;
  domain: string;
  fbPage?: string;
  adSets: AdSetPlan[];
}

export interface AdSetPlan {
  audienceKey: string;
  placementKey: string;
  optimizationEvent: string;
  budgetType: 'CBO' | 'ABO';
  version: number;
  targeting: any;
  promotedObject?: {
    pixelId: string;
    customEventType: string;
  };
  dailyBudget?: string; // for ABO
  bidStrategy?: string;
  startTime?: string;
}

export interface CampaignCreationResult {
  facebookCampaign: { id: string; name: string };
  facebookAdSets: Array<{ id: string; name: string }>;
  strategisCampaigns: Array<{ id: string; name: string }>;
  mappings: {
    fbCampaignId: string;
    fbAdSetIds: string[];
    strategisCampaignIds: string[];
  };
}

export class CampaignFactory {
  constructor(
    private metaAdsClient: MetaAdsClient,
    private strategisClient: StrategisClient
  ) {}

  /**
   * Create campaign with Attention Engine naming in both Facebook and Strategis
   */
  async createCampaignWithNaming(plan: CampaignPlan): Promise<CampaignCreationResult> {
    // 1. Generate names from Attention Engine
    const campaignName = generateCampaignName({
      brand: plan.brand,
      objective: plan.objective,
      hookSetId: plan.hookSetId,
      market: plan.market,
      channel: plan.channel,
      date: plan.date,
    });

    // 2. Create Facebook campaign
    const fbCampaign = await this.metaAdsClient.createCampaign(plan.adAccountId, {
      name: campaignName,
      objective: plan.objective,
      special_ad_categories: ['NONE'], // TODO: get from plan
      status: 'PAUSED',
      buying_type: 'AUCTION',
      is_campaign_budget_optimized: plan.adSets[0]?.budgetType === 'CBO',
      daily_budget: plan.adSets[0]?.budgetType === 'CBO' ? plan.adSets[0]?.dailyBudget : undefined,
    });

    // 3. Create Facebook ad sets
    const fbAdSets = [];
    for (const adSetPlan of plan.adSets) {
      const adSetName = generateAdSetName({
        audienceKey: adSetPlan.audienceKey,
        placementKey: adSetPlan.placementKey,
        optimizationEvent: adSetPlan.optimizationEvent,
        budgetType: adSetPlan.budgetType,
        version: adSetPlan.version,
      });

      const fbAdSet = await this.metaAdsClient.createAdSet({
        campaign_id: fbCampaign.id,
        name: adSetName,
        optimization_goal: this.mapOptimizationGoal(adSetPlan.optimizationEvent),
        billing_event: 'IMPRESSIONS',
        targeting: adSetPlan.targeting,
        status: 'PAUSED',
        start_time: adSetPlan.startTime,
        promoted_object: adSetPlan.promotedObject ? {
          pixel_id: adSetPlan.promotedObject.pixelId,
          custom_event_type: adSetPlan.promotedObject.customEventType,
        } : undefined,
        daily_budget: adSetPlan.budgetType === 'ABO' ? adSetPlan.dailyBudget : undefined,
        bid_strategy: adSetPlan.bidStrategy,
      });

      fbAdSets.push({ id: fbAdSet.id, name: adSetName });
    }

    // 4. Create Strategis campaigns (one per Facebook ad set)
    const strategisCampaigns = [];
    for (const [index, fbAdSet] of fbAdSets.entries()) {
      const adSetName = generateAdSetName({
        audienceKey: plan.adSets[index].audienceKey,
        placementKey: plan.adSets[index].placementKey,
        optimizationEvent: plan.adSets[index].optimizationEvent,
        budgetType: plan.adSets[index].budgetType,
        version: plan.adSets[index].version,
      });

      const strategisCampaignName = generateStrategisCampaignName(campaignName, adSetName);

      const strategisCampaign = await this.strategisClient.createCampaign({
        name: strategisCampaignName,
        category: plan.category,
        template: { id: plan.templateId },
        properties: {
          buyer: plan.brand,
          networkName: 'facebook',
          networkAccountId: plan.adAccountId,
          destination: 'S1', // TODO: get from plan
          domain: plan.domain,
          fbPage: plan.fbPage,
          fbAdAccount: plan.adAccountId.replace('act_', ''),
          fbCampaignId: fbCampaign.id,
          fbAdSetId: fbAdSet.id,
        },
        organizations: [plan.organization],
      });

      strategisCampaigns.push({ id: strategisCampaign.id, name: strategisCampaignName });
    }

    // 5. Store mappings (TODO: implement persistence)
    const mappings = {
      fbCampaignId: fbCampaign.id,
      fbAdSetIds: fbAdSets.map(a => a.id),
      strategisCampaignIds: strategisCampaigns.map(c => c.id),
    };

    return {
      facebookCampaign: { id: fbCampaign.id, name: campaignName },
      facebookAdSets: fbAdSets,
      strategisCampaigns,
      mappings,
    };
  }

  private mapOptimizationGoal(event: string): string {
    const mapping: Record<string, string> = {
      'PURCHASE': 'OFFSITE_CONVERSIONS',
      'LEAD_GENERATION': 'LEAD_GENERATION',
      // Add more mappings as needed
    };
    return mapping[event] || 'OFFSITE_CONVERSIONS';
  }
}
```

---

### 5. Error Handling & Saga Pattern

**File**: `backend/src/services/campaignFactorySaga.ts`

```typescript
import { CampaignFactory, CampaignPlan, CampaignCreationResult } from './campaignFactory';

export interface SagaState {
  step: 'facebook_campaign' | 'facebook_adsets' | 'strategis_campaigns' | 'complete' | 'rollback';
  facebookCampaignId?: string;
  facebookAdSetIds: string[];
  strategisCampaignIds: string[];
  errors: Array<{ step: string; error: Error }>;
}

export class CampaignFactorySaga {
  constructor(private campaignFactory: CampaignFactory) {}

  /**
   * Create campaign with rollback support
   */
  async createCampaignWithRollback(plan: CampaignPlan): Promise<CampaignCreationResult> {
    const state: SagaState = {
      step: 'facebook_campaign',
      facebookAdSetIds: [],
      strategisCampaignIds: [],
      errors: [],
    };

    try {
      // Step 1: Create Facebook campaign
      const campaignName = this.generateCampaignName(plan);
      const fbCampaign = await this.createFacebookCampaign(plan, campaignName);
      state.facebookCampaignId = fbCampaign.id;
      state.step = 'facebook_adsets';

      // Step 2: Create Facebook ad sets
      const fbAdSets = await this.createFacebookAdSets(plan, fbCampaign.id);
      state.facebookAdSetIds = fbAdSets.map(a => a.id);
      state.step = 'strategis_campaigns';

      // Step 3: Create Strategis campaigns
      const strategisCampaigns = await this.createStrategisCampaigns(
        plan,
        campaignName,
        fbCampaign.id,
        fbAdSets
      );
      state.strategisCampaignIds = strategisCampaigns.map(c => c.id);
      state.step = 'complete';

      return {
        facebookCampaign: { id: fbCampaign.id, name: campaignName },
        facebookAdSets: fbAdSets,
        strategisCampaigns,
        mappings: {
          fbCampaignId: fbCampaign.id,
          fbAdSetIds: state.facebookAdSetIds,
          strategisCampaignIds: state.strategisCampaignIds,
        },
      };
    } catch (error) {
      state.errors.push({ step: state.step, error: error as Error });
      await this.rollback(state);
      throw error;
    }
  }

  /**
   * Rollback created resources
   */
  private async rollback(state: SagaState): Promise<void> {
    // Rollback in reverse order
    if (state.step === 'strategis_campaigns') {
      // Delete Strategis campaigns
      for (const id of state.strategisCampaignIds) {
        try {
          await this.deleteStrategisCampaign(id);
        } catch (error) {
          console.error(`Failed to rollback Strategis campaign ${id}:`, error);
        }
      }
    }

    if (state.step === 'facebook_adsets' || state.step === 'strategis_campaigns') {
      // Delete Facebook ad sets
      for (const id of state.facebookAdSetIds) {
        try {
          await this.deleteFacebookAdSet(id);
        } catch (error) {
          console.error(`Failed to rollback Facebook ad set ${id}:`, error);
        }
      }
    }

    if (state.facebookCampaignId) {
      // Delete Facebook campaign
      try {
        await this.deleteFacebookCampaign(state.facebookCampaignId);
      } catch (error) {
        console.error(`Failed to rollback Facebook campaign ${state.facebookCampaignId}:`, error);
      }
    }
  }

  // Helper methods (implement based on your API clients)
  private async createFacebookCampaign(plan: CampaignPlan, name: string) {
    // Implementation
  }

  private async createFacebookAdSets(plan: CampaignPlan, campaignId: string) {
    // Implementation
  }

  private async createStrategisCampaigns(
    plan: CampaignPlan,
    campaignName: string,
    fbCampaignId: string,
    fbAdSets: Array<{ id: string; name: string }>
  ) {
    // Implementation
  }

  private async deleteFacebookCampaign(id: string) {
    // Implementation
  }

  private async deleteFacebookAdSet(id: string) {
    // Implementation
  }

  private async deleteStrategisCampaign(id: string) {
    // Implementation
  }

  private generateCampaignName(plan: CampaignPlan): string {
    // Implementation
  }
}
```

---

## Environment Variables

Add to `backend/ENV_TEMPLATE`:

```bash
# Strategis API Configuration
STRATEGIS_API_BASE_URL=https://api.strategis.internal
STRATEGIS_API_KEY=your-strategis-api-key

# Meta Ads API Configuration
META_ADS_ACCESS_TOKEN=your-meta-access-token
META_ADS_API_VERSION=v24.0
```

---

## API Route Example

**File**: `backend/src/routes/campaignFactory.ts`

```typescript
import express from 'express';
import { CampaignFactory } from '../services/campaignFactory';
import { MetaAdsClient } from '../services/metaAdsClient';
import { StrategisClient } from '../services/strategisClient';

const router = express.Router();

const campaignFactory = new CampaignFactory(
  new MetaAdsClient(),
  new StrategisClient()
);

/**
 * POST /api/campaign-factory/create
 * Create campaign with Attention Engine naming in both Facebook and Strategis
 */
router.post('/create', async (req, res) => {
  try {
    const plan = req.body; // CampaignPlan
    const result = await campaignFactory.createCampaignWithNaming(plan);
    res.json(result);
  } catch (error) {
    console.error('Campaign creation error:', error);
    res.status(500).json({ error: 'Failed to create campaign', details: error.message });
  }
});

export default router;
```

---

## Testing Strategy

### Unit Tests
- Test naming generator functions
- Test API client methods (with mocks)
- Test saga rollback logic

### Integration Tests
- Test full campaign creation flow (with sandbox accounts)
- Test error handling and rollback
- Test idempotency (if implemented)

### Manual Testing
1. Create test campaign with Attention Engine naming
2. Verify names match in both Facebook and Strategis
3. Verify mappings are stored correctly
4. Test rollback on failure

---

## Next Steps

1. ✅ **Implementation Guide Created** — This document
2. ⏭️ **Create Service Files** — Implement the services above
3. ⏭️ **Add Database Schema** — Store campaign mappings
4. ⏭️ **Add Idempotency** — Implement client-side idempotency
5. ⏭️ **Add Monitoring** — Logging and metrics
6. ⏭️ **Test with Real Campaigns** — Validate end-to-end

---

## References

- **Answers Document**: `docs/prd/strategis-facebook-campaign-setup-answers.md`
- **Exploration Document**: `docs/prd/strategis-campaign-setup-exploration.md`
- **Naming Conventions**: `docs/marketing/buyer-guide-naming-and-campaign-templates.md`

