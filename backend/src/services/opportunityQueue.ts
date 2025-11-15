/**
 * Opportunity Queue Service
 * 
 * Manages opportunity lifecycle: scoring, ranking, blueprint generation, and launch.
 */

import { getPgPool } from '../lib/pg';
import { randomUUID } from 'crypto';

export interface Opportunity {
  id?: string;
  source: 'system1' | 'facebook_pipeline';
  angle: string;
  category?: string;
  revenue_potential?: number;
  rpc_floor?: number;
  confidence_score?: number;
  keywords?: any[];
  states?: any[];
  top_keywords?: Array<{ keyword: string; revenue: number; rpc: number }>;
  top_slugs?: Array<{ slug: string; revenue: number; clicks: number }>;
  predicted_delta_cm?: number;
  recommended_budget?: number;
  recommended_lane_mix?: {
    asc: number;
    lal: number;
    interest: number;
  };
  overlap_risk?: 'low' | 'medium' | 'high';
  geo_conflicts?: string[];
  audience_conflicts?: string[];
  freeze_window_hours?: number;
  success_threshold_cpa?: number;
  kill_threshold_cpa?: number;
  status?: 'pending' | 'approved' | 'launched' | 'rejected';
}

export interface CampaignBlueprint {
  id?: string;
  opportunity_id?: string;
  vertical?: string;
  angle?: string;
  campaign_name?: string;
  lane_mix?: {
    asc: number;
    lal: number;
    interest: number;
  };
  budget_plan?: Record<string, any>;
  targeting?: Record<string, any>;
  creative_requirements?: Record<string, any>;
  kpi_targets?: Record<string, any>;
  status?: 'draft' | 'approved' | 'launched';
}

export class OpportunityQueue {
  /**
   * Add opportunity to queue
   */
  async addOpportunity(opportunity: Opportunity): Promise<Opportunity> {
    const pool = getPgPool();
    const id = opportunity.id || randomUUID();
    
    const result = await pool.query(
      `INSERT INTO opportunities (
        id, source, angle, category, revenue_potential, rpc_floor, confidence_score,
        keywords, states, top_keywords, top_slugs, predicted_delta_cm, recommended_budget,
        recommended_lane_mix, overlap_risk, geo_conflicts, audience_conflicts,
        freeze_window_hours, success_threshold_cpa, kill_threshold_cpa, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      ) RETURNING *`,
      [
        id,
        opportunity.source,
        opportunity.angle,
        opportunity.category || null,
        opportunity.revenue_potential || null,
        opportunity.rpc_floor || null,
        opportunity.confidence_score || null,
        JSON.stringify(opportunity.keywords || []),
        JSON.stringify(opportunity.states || []),
        JSON.stringify(opportunity.top_keywords || []),
        JSON.stringify(opportunity.top_slugs || []),
        opportunity.predicted_delta_cm || null,
        opportunity.recommended_budget || null,
        JSON.stringify(opportunity.recommended_lane_mix || {}),
        opportunity.overlap_risk || null,
        opportunity.geo_conflicts || [],
        opportunity.audience_conflicts || [],
        opportunity.freeze_window_hours || null,
        opportunity.success_threshold_cpa || null,
        opportunity.kill_threshold_cpa || null,
        opportunity.status || 'pending',
      ]
    );

    return this.mapRowToOpportunity(result.rows[0]);
  }

  /**
   * Get pending opportunities
   */
  async getPending(limit: number = 20): Promise<Opportunity[]> {
    const pool = getPgPool();
    
    const result = await pool.query(
      `SELECT * FROM opportunities 
       WHERE status = 'pending' 
       ORDER BY predicted_delta_cm DESC NULLS LAST, confidence_score DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => this.mapRowToOpportunity(row));
  }

  /**
   * Get opportunity by ID
   */
  async getById(id: string): Promise<Opportunity | null> {
    const pool = getPgPool();
    
    const result = await pool.query(
      `SELECT * FROM opportunities WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToOpportunity(result.rows[0]);
  }

  /**
   * Update opportunity status
   */
  async updateStatus(id: string, status: Opportunity['status']): Promise<Opportunity> {
    const pool = getPgPool();
    
    const result = await pool.query(
      `UPDATE opportunities 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Opportunity ${id} not found`);
    }

    return this.mapRowToOpportunity(result.rows[0]);
  }

  /**
   * List opportunities with filters
   */
  async list(filters: {
    status?: string;
    source?: string;
    category?: string;
    minConfidence?: number;
    limit?: number;
  }): Promise<Opportunity[]> {
    const pool = getPgPool();
    
    let query = 'SELECT * FROM opportunities WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters.source) {
      query += ` AND source = $${paramIndex++}`;
      params.push(filters.source);
    }

    if (filters.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(filters.category);
    }

    if (filters.minConfidence) {
      query += ` AND confidence_score >= $${paramIndex++}`;
      params.push(filters.minConfidence);
    }

    query += ' ORDER BY predicted_delta_cm DESC NULLS LAST, confidence_score DESC NULLS LAST';
    query += ` LIMIT $${paramIndex++}`;
    params.push(filters.limit || 100);

    const result = await pool.query(query, params);
    return result.rows.map(row => this.mapRowToOpportunity(row));
  }

  /**
   * Create blueprint from opportunity
   */
  async createBlueprint(opportunityId: string, blueprint: CampaignBlueprint): Promise<CampaignBlueprint> {
    const pool = getPgPool();
    const id = blueprint.id || randomUUID();
    
    const result = await pool.query(
      `INSERT INTO campaign_blueprints (
        id, opportunity_id, vertical, angle, campaign_name,
        lane_mix, budget_plan, targeting, creative_requirements, kpi_targets, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        id,
        opportunityId,
        blueprint.vertical || null,
        blueprint.angle || null,
        blueprint.campaign_name || null,
        JSON.stringify(blueprint.lane_mix || {}),
        JSON.stringify(blueprint.budget_plan || {}),
        JSON.stringify(blueprint.targeting || {}),
        JSON.stringify(blueprint.creative_requirements || {}),
        JSON.stringify(blueprint.kpi_targets || {}),
        blueprint.status || 'draft',
      ]
    );

    return this.mapRowToBlueprint(result.rows[0]);
  }

  /**
   * Get blueprint by ID
   */
  async getBlueprintById(id: string): Promise<CampaignBlueprint | null> {
    const pool = getPgPool();
    
    const result = await pool.query(
      `SELECT * FROM campaign_blueprints WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToBlueprint(result.rows[0]);
  }

  /**
   * Get blueprints by opportunity ID
   */
  async getBlueprintsByOpportunity(opportunityId: string): Promise<CampaignBlueprint[]> {
    const pool = getPgPool();
    
    const result = await pool.query(
      `SELECT * FROM campaign_blueprints WHERE opportunity_id = $1 ORDER BY created_at DESC`,
      [opportunityId]
    );

    return result.rows.map(row => this.mapRowToBlueprint(row));
  }

  /**
   * Update blueprint status
   */
  async updateBlueprintStatus(id: string, status: CampaignBlueprint['status']): Promise<CampaignBlueprint> {
    const pool = getPgPool();
    
    const updateFields: string[] = ['status = $1'];
    const params: any[] = [status];
    let paramIndex = 2;

    if (status === 'approved') {
      updateFields.push(`approved_at = NOW()`);
    } else if (status === 'launched') {
      updateFields.push(`launched_at = NOW()`);
    }

    const result = await pool.query(
      `UPDATE campaign_blueprints 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramIndex++} 
       RETURNING *`,
      [...params, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Blueprint ${id} not found`);
    }

    return this.mapRowToBlueprint(result.rows[0]);
  }

  private mapRowToOpportunity(row: any): Opportunity {
    return {
      id: row.id,
      source: row.source,
      angle: row.angle,
      category: row.category,
      revenue_potential: row.revenue_potential ? Number(row.revenue_potential) : undefined,
      rpc_floor: row.rpc_floor ? Number(row.rpc_floor) : undefined,
      confidence_score: row.confidence_score ? Number(row.confidence_score) : undefined,
      keywords: row.keywords ? JSON.parse(row.keywords) : undefined,
      states: row.states ? JSON.parse(row.states) : undefined,
      top_keywords: row.top_keywords ? JSON.parse(row.top_keywords) : undefined,
      top_slugs: row.top_slugs ? JSON.parse(row.top_slugs) : undefined,
      predicted_delta_cm: row.predicted_delta_cm ? Number(row.predicted_delta_cm) : undefined,
      recommended_budget: row.recommended_budget ? Number(row.recommended_budget) : undefined,
      recommended_lane_mix: row.recommended_lane_mix ? JSON.parse(row.recommended_lane_mix) : undefined,
      overlap_risk: row.overlap_risk,
      geo_conflicts: row.geo_conflicts || [],
      audience_conflicts: row.audience_conflicts || [],
      freeze_window_hours: row.freeze_window_hours,
      success_threshold_cpa: row.success_threshold_cpa ? Number(row.success_threshold_cpa) : undefined,
      kill_threshold_cpa: row.kill_threshold_cpa ? Number(row.kill_threshold_cpa) : undefined,
      status: row.status,
    };
  }

  private mapRowToBlueprint(row: any): CampaignBlueprint {
    return {
      id: row.id,
      opportunity_id: row.opportunity_id,
      vertical: row.vertical,
      angle: row.angle,
      campaign_name: row.campaign_name,
      lane_mix: row.lane_mix ? JSON.parse(row.lane_mix) : undefined,
      budget_plan: row.budget_plan ? JSON.parse(row.budget_plan) : undefined,
      targeting: row.targeting ? JSON.parse(row.targeting) : undefined,
      creative_requirements: row.creative_requirements ? JSON.parse(row.creative_requirements) : undefined,
      kpi_targets: row.kpi_targets ? JSON.parse(row.kpi_targets) : undefined,
      status: row.status,
    };
  }
}

