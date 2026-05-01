import { getPgPool } from './pg';

function normalize(value: string | null | undefined): string {
  return String(value || '').trim();
}

function toNumber(value: any): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function familyRank(value: string): number {
  switch (value) {
    case 'cross_buyer_reuse':
      return 0;
    case 'self_reuse':
      return 1;
    case 'original_only':
      return 2;
    default:
      return 3;
  }
}

export async function getPacketLineageGraphReport(options: { limit?: number } = {}): Promise<any> {
  const limit = options.limit || 12;
  try {
    const result = await getPgPool().query(
      `
        SELECT
          o.id AS opportunity_id,
          COALESCE(NULLIF(q.owner_name, ''), 'Unassigned') AS owner_label,
          COALESCE(NULLIF(o.source, ''), 'unknown') AS source,
          COALESCE(NULLIF(o.category, ''), 'uncategorized') AS category,
          COALESCE(NULLIF(o.status, ''), 'pending') AS opportunity_status,
          o.created_at,
          COUNT(cb.id) AS blueprint_count,
          COUNT(cb.id) FILTER (WHERE cb.status = 'approved') AS approved_blueprint_count,
          COUNT(cb.id) FILTER (WHERE cb.status = 'launched') AS launched_blueprint_count
        FROM opportunities o
        LEFT JOIN opportunity_ownership_queue q
          ON q.opportunity_id = o.id
        LEFT JOIN campaign_blueprints cb
          ON cb.opportunity_id = o.id
        GROUP BY
          o.id,
          q.owner_name,
          o.source,
          o.category,
          o.status,
          o.created_at
        ORDER BY o.created_at ASC
      `
    );

    const families = new Map<string, any>();

    for (const row of result.rows) {
      const source = normalize(row.source) || 'unknown';
      const category = normalize(row.category) || 'uncategorized';
      const familyKey = `${source.toLowerCase()}|${category.toLowerCase()}`;
      const ownerLabel = normalize(row.owner_label) || 'Unassigned';
      const createdAt = row.created_at ? new Date(row.created_at) : null;
      const current = families.get(familyKey) || {
        familyKey,
        packetLabel: `${source} / ${category}`,
        source,
        category,
        firstSeenAt: createdAt ? createdAt.toISOString() : null,
        originOwner: ownerLabel,
        opportunityCount: 0,
        launchedOpportunityCount: 0,
        blueprintCount: 0,
        approvedBlueprintCount: 0,
        launchedBlueprintCount: 0,
        owners: new Set<string>(),
      };

      current.opportunityCount += 1;
      if (String(row.opportunity_status || '') === 'launched') current.launchedOpportunityCount += 1;
      current.blueprintCount += toNumber(row.blueprint_count);
      current.approvedBlueprintCount += toNumber(row.approved_blueprint_count);
      current.launchedBlueprintCount += toNumber(row.launched_blueprint_count);
      current.owners.add(ownerLabel);

      if (createdAt && (!current.firstSeenAt || createdAt.getTime() < Date.parse(current.firstSeenAt))) {
        current.firstSeenAt = createdAt.toISOString();
        current.originOwner = ownerLabel;
      }

      families.set(familyKey, current);
    }

    const packets = Array.from(families.values()).map((family) => {
      const owners = Array.from<string>(family.owners).sort((a, b) => a.localeCompare(b));
      const reuseOwners = owners.filter((owner) => owner !== family.originOwner);
      let reuseState: 'ownerless' | 'original_only' | 'self_reuse' | 'cross_buyer_reuse' = 'original_only';
      if (!owners.length || (owners.length === 1 && owners[0] === 'Unassigned')) {
        reuseState = 'ownerless';
      } else if (owners.length > 1) {
        reuseState = 'cross_buyer_reuse';
      } else if (family.opportunityCount > 1 || family.blueprintCount > 1 || family.launchedBlueprintCount > 0) {
        reuseState = 'self_reuse';
      }

      const reasons: string[] = [];
      if (reuseState === 'cross_buyer_reuse') {
        reasons.push(`${reuseOwners.length} secondary owners appear on this packet family after ${family.originOwner}`);
      }
      if (family.launchedBlueprintCount > 0) {
        reasons.push(`${family.launchedBlueprintCount} launched blueprints were created from this family`);
      }
      if (family.opportunityCount > 1) {
        reasons.push(`${family.opportunityCount} opportunities exist inside this packet family`);
      }
      if (!reasons.length) reasons.push('this family currently looks like a single-owner original packet lane');

      return {
        familyKey: family.familyKey,
        packetLabel: family.packetLabel,
        source: family.source,
        category: family.category,
        firstSeenAt: family.firstSeenAt,
        originOwner: family.originOwner,
        currentOwners: owners,
        reuseOwners,
        ownerCount: owners.length,
        opportunityCount: family.opportunityCount,
        launchedOpportunityCount: family.launchedOpportunityCount,
        blueprintCount: family.blueprintCount,
        approvedBlueprintCount: family.approvedBlueprintCount,
        launchedBlueprintCount: family.launchedBlueprintCount,
        reuseState,
        reasons,
      };
    }).sort((a, b) => {
      return (
        familyRank(a.reuseState) - familyRank(b.reuseState) ||
        b.launchedBlueprintCount - a.launchedBlueprintCount ||
        b.opportunityCount - a.opportunityCount ||
        a.packetLabel.localeCompare(b.packetLabel)
      );
    });

    const summary = {
      totalFamilies: packets.length,
      crossBuyerReuseFamilies: packets.filter((item) => item.reuseState === 'cross_buyer_reuse').length,
      selfReuseFamilies: packets.filter((item) => item.reuseState === 'self_reuse').length,
      originalOnlyFamilies: packets.filter((item) => item.reuseState === 'original_only').length,
      ownerlessFamilies: packets.filter((item) => item.reuseState === 'ownerless').length,
      launchedFamilies: packets.filter((item) => item.launchedBlueprintCount > 0).length,
    };

    let operatorRead =
      'Packet lineage is now visible as a family graph, so the system can start distinguishing original creation from later reuse instead of treating all exploit behavior as the same.';
    if (summary.crossBuyerReuseFamilies > 0) {
      operatorRead =
        `${summary.crossBuyerReuseFamilies} packet families now show cross-buyer reuse, so the next question is whether downstream performance came from invention, adaptation, or copying.`;
    } else if (summary.selfReuseFamilies > 0) {
      operatorRead =
        `${summary.selfReuseFamilies} packet families show self-reuse but not yet clear cross-buyer spread, so the current leverage is still partly inside the originating lane.`;
    }

    return {
      summary,
      packets: packets.slice(0, limit),
      operatorRead,
    };
  } catch (error: any) {
    if (String(error?.message || '').includes('relation') || String(error?.code || '') === '42P01') {
      return {
        summary: {
          totalFamilies: 0,
          crossBuyerReuseFamilies: 0,
          selfReuseFamilies: 0,
          originalOnlyFamilies: 0,
          ownerlessFamilies: 0,
          launchedFamilies: 0,
        },
        packets: [],
        operatorRead: 'Packet lineage graph is unavailable in this environment because the opportunity or blueprint schema is missing.',
      };
    }
    throw error;
  }
}
