#!/usr/bin/env python3
"""
Capital allocation decision engine for a Google arbitrage media business.

The engine is intentionally built as a standalone Python module so it can be
run today with SQLite and later extended with live channel APIs, richer
forecasting, or a PostgreSQL-backed deployment.
"""

from __future__ import annotations

import json
import math
import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class AllocationCandidate:
    """Immutable view of an asset during a single allocation turn."""

    asset_id: str
    source: str
    campaign: str
    article_template: str
    cluster_id: str
    is_proven: bool
    confidence_score: float
    projected_profit_per_dollar: float
    score: float
    scalability_ceiling: float
    latest_spend: float
    creative_fatigue_score: float
    roi: float


class CapitalAllocationEngine:
    """
    Production-oriented allocator for paid traffic arbitrage capital.

    Design constraints encoded here:
    - Every turn evaluates the full capital pool.
    - Pareto concentration pushes the majority of traffic spend into the best
      proven assets while still reserving exploration, improvement, and defense.
    - Every plan must project a monthly net profit above the configured floor or
      be flagged as rejected.
    - The engine persists asset history, decision audits, cluster stats, and
      global turn logs in SQLite.
    """

    def __init__(
        self,
        db_path: str = "capital_allocation_engine.sqlite",
        turn_granularity: str = "daily",
        horizon_turns: int = 90,
        monthly_profit_floor: float = 100_000.0,
        initial_capital: float = 60_000.0,
        reserve_allocation_pct: float = 0.05,
        improvement_allocation_pct: float = 0.05,
        exploration_allocation_pct: float = 0.10,
        pareto_top_asset_pct: float = 0.20,
        pareto_capital_pct: float = 0.80,
        initial_assets: Optional[List[Dict[str, Any]]] = None,
        reset_db: bool = False,
        random_seed: int = 7,
    ) -> None:
        self.db_path = db_path
        self.turn_granularity = turn_granularity.lower()
        self.horizon_turns = int(horizon_turns)
        self.monthly_profit_floor = float(monthly_profit_floor)
        self.initial_capital = float(initial_capital)
        self.reserve_allocation_pct = float(reserve_allocation_pct)
        self.improvement_allocation_pct = float(improvement_allocation_pct)
        self.exploration_allocation_pct = float(exploration_allocation_pct)
        self.pareto_top_asset_pct = float(pareto_top_asset_pct)
        self.pareto_capital_pct = float(pareto_capital_pct)
        self.random_seed = int(random_seed)
        self.rng = np.random.default_rng(self.random_seed)
        self.external_signal_overrides: Dict[str, Dict[str, Any]] = {}

        if reset_db and os.path.exists(self.db_path):
            os.remove(self.db_path)

        if self.turn_granularity not in {"hourly", "daily", "weekly"}:
            raise ValueError("turn_granularity must be 'hourly', 'daily', or 'weekly'")

        if self.reserve_allocation_pct < 0 or self.improvement_allocation_pct < 0:
            raise ValueError("reserve and improvement allocations must be non-negative")

        if self.reserve_allocation_pct + self.improvement_allocation_pct + self.exploration_allocation_pct >= 1:
            raise ValueError("allocation percentages must leave room for core winners")

        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self._setup_schema()
        self._bootstrap_engine_state()
        self.turn_number = self._get_engine_state()["turn_number"]
        self.cash_balance = self._get_engine_state()["cash_balance"]

        if initial_assets:
            for asset in initial_assets:
                self.add_asset(**asset)

    # ---------------------------------------------------------------------
    # Public API
    # ---------------------------------------------------------------------

    def advance_turn(
        self,
        current_revenue: float,
        external_infusion: float = 0,
    ) -> Tuple[Dict[str, Any], str]:
        """
        Main turn advancement method.

        Sequence:
        1. Realize prior-turn cash inflows and any fresh capital.
        2. Evaluate every active asset and cluster.
        3. Build a full-capital allocation plan.
        4. Enforce the monthly net profit floor.
        5. Persist turn logs and decision audit rows.
        """

        current_revenue = float(current_revenue)
        external_infusion = float(external_infusion)

        state = self._get_engine_state()
        self.turn_number = int(state["turn_number"]) + 1
        self.cash_balance = float(state["cash_balance"]) + current_revenue + external_infusion

        assets_df = self._load_assets_df()
        history_df = self._load_asset_history_df()
        external_signals = self._compute_external_signals(assets_df, history_df)
        evaluated_df = self._evaluate_assets(assets_df, history_df, external_signals)
        self._persist_cluster_metrics(self.turn_number, evaluated_df, history_df)
        self._persist_external_signals(self.turn_number, external_signals)

        allocation = self._build_allocation_plan(
            available_capital=self.cash_balance,
            turn_number=self.turn_number,
            evaluated_df=evaluated_df,
            persist=True,
        )

        # Capital is committed at the start of the turn. Revenue returns later
        # when the caller records actual performance and advances the next turn.
        self.cash_balance -= allocation["allocated_capital"]
        self._save_engine_state(self.turn_number, self.cash_balance)

        json_log = json.dumps(allocation, indent=2, sort_keys=False)
        self.conn.execute(
            """
            INSERT OR REPLACE INTO turn_logs (
                turn_number,
                turn_granularity,
                current_revenue,
                external_infusion,
                available_capital,
                allocated_capital,
                reserve_budget,
                improvement_budget,
                exploration_budget,
                projected_turn_net_profit,
                projected_monthly_net_profit,
                projected_capital_at_horizon,
                projected_net_profit_at_horizon,
                turns_remaining,
                monthly_profit_floor,
                monthly_profit_target_met,
                approved,
                summary_json,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                self.turn_number,
                self.turn_granularity,
                current_revenue,
                external_infusion,
                allocation["capital_pool"],
                allocation["allocated_capital"],
                allocation["reserve_budget"],
                allocation["improvement_budget"],
                allocation["exploration_budget"],
                allocation["projected_turn_net_profit"],
                allocation["projected_monthly_net_profit"],
                allocation["projected_capital_at_horizon"],
                allocation["projected_net_profit_at_horizon"],
                allocation["turns_remaining"],
                self.monthly_profit_floor,
                int(allocation["monthly_profit_target_met"]),
                int(allocation["approved"]),
                json_log,
                self._utcnow(),
            ),
        )
        self.conn.commit()

        return allocation, json_log

    def add_asset(
        self,
        source: str,
        campaign: str,
        article_template: str,
        cluster_id: str,
        base_expected_profit_per_dollar: float,
        scalability_ceiling: float,
        is_proven: bool = False,
        status: str = "active",
        ltv: float = 1.0,
        creative_fatigue_score: float = 0.15,
        volatility: float = 0.08,
        synergy_score: float = 0.10,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Registers or updates a traffic asset."""

        asset_id = self._asset_id(source, campaign, article_template)
        self.conn.execute(
            """
            INSERT INTO assets (
                asset_id,
                source,
                campaign,
                article_template,
                cluster_id,
                status,
                is_proven,
                base_expected_profit_per_dollar,
                scalability_ceiling,
                ltv,
                creative_fatigue_score,
                volatility,
                synergy_score,
                metadata_json,
                created_turn,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(asset_id) DO UPDATE SET
                cluster_id = excluded.cluster_id,
                status = excluded.status,
                is_proven = excluded.is_proven,
                base_expected_profit_per_dollar = excluded.base_expected_profit_per_dollar,
                scalability_ceiling = excluded.scalability_ceiling,
                ltv = excluded.ltv,
                creative_fatigue_score = excluded.creative_fatigue_score,
                volatility = excluded.volatility,
                synergy_score = excluded.synergy_score,
                metadata_json = excluded.metadata_json,
                updated_at = excluded.updated_at
            """,
            (
                asset_id,
                source,
                campaign,
                article_template,
                cluster_id,
                status,
                int(is_proven),
                float(base_expected_profit_per_dollar),
                float(scalability_ceiling),
                float(ltv),
                float(creative_fatigue_score),
                float(volatility),
                float(synergy_score),
                json.dumps(metadata or {}, sort_keys=True),
                self.turn_number,
                self._utcnow(),
            ),
        )
        self.conn.commit()
        return asset_id

    def scale_asset(
        self,
        asset_id: str,
        scale_multiplier: float = 1.10,
        efficiency_lift_pct: float = 0.0,
        reason: str = "manual scale request",
    ) -> Dict[str, Any]:
        """
        Expands an asset's ceiling and optionally improves its baseline edge.

        This is the explicit manual helper counterpart to the allocator's
        automated budget growth.
        """

        row = self.conn.execute(
            """
            SELECT asset_id, source, campaign, article_template, cluster_id,
                   base_expected_profit_per_dollar, scalability_ceiling
            FROM assets
            WHERE asset_id = ?
            """,
            (asset_id,),
        ).fetchone()
        if row is None:
            raise ValueError(f"Unknown asset_id: {asset_id}")

        new_ceiling = float(row["scalability_ceiling"]) * float(scale_multiplier)
        new_ppd = float(row["base_expected_profit_per_dollar"]) * (1 + float(efficiency_lift_pct))

        self.conn.execute(
            """
            UPDATE assets
            SET scalability_ceiling = ?, base_expected_profit_per_dollar = ?, updated_at = ?
            WHERE asset_id = ?
            """,
            (new_ceiling, new_ppd, self._utcnow(), asset_id),
        )
        self.conn.execute(
            """
            INSERT INTO decision_audit (
                turn_number,
                asset_id,
                cluster_id,
                allocation_bucket,
                allocated_dollars,
                reason,
                confidence_score,
                projected_net_profit,
                projected_profit_per_dollar,
                monthly_profit_target_met,
                rejected,
                variance,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                self.turn_number,
                asset_id,
                row["cluster_id"],
                "manual_scale",
                0.0,
                reason,
                1.0,
                0.0,
                new_ppd,
                1,
                0,
                0.0,
                self._utcnow(),
            ),
        )
        self.conn.commit()
        return {
            "asset_id": asset_id,
            "scale_multiplier": scale_multiplier,
            "efficiency_lift_pct": efficiency_lift_pct,
            "new_scalability_ceiling": new_ceiling,
            "new_expected_profit_per_dollar": new_ppd,
            "reason": reason,
        }

    def record_performance(
        self,
        asset_id: str,
        metrics: Dict[str, float],
        turn_number: Optional[int] = None,
        predicted_profit_per_dollar: Optional[float] = None,
        confidence_score: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Stores realized performance and updates the asset's priors.

        Required metric keys:
        - spend
        - impressions
        - clicks
        - revenue

        Optional:
        - ltv
        - creative_fatigue_score
        - scalability_ceiling
        """

        asset = self.conn.execute(
            """
            SELECT asset_id, is_proven, base_expected_profit_per_dollar,
                   creative_fatigue_score, scalability_ceiling, ltv
            FROM assets
            WHERE asset_id = ?
            """,
            (asset_id,),
        ).fetchone()
        if asset is None:
            raise ValueError(f"Unknown asset_id: {asset_id}")

        turn = int(turn_number or self.turn_number)
        spend = float(metrics["spend"])
        impressions = float(metrics["impressions"])
        clicks = float(metrics["clicks"])
        revenue = float(metrics["revenue"])
        net_profit = revenue - spend
        profit_per_dollar = net_profit / spend if spend else 0.0
        roi = profit_per_dollar
        margin = net_profit / revenue if revenue else 0.0
        ltv = float(metrics.get("ltv", asset["ltv"]))
        fatigue = float(metrics.get("creative_fatigue_score", asset["creative_fatigue_score"]))
        ceiling = float(metrics.get("scalability_ceiling", asset["scalability_ceiling"]))
        variance = None
        if predicted_profit_per_dollar is not None:
            variance = profit_per_dollar - float(predicted_profit_per_dollar)

        self.conn.execute(
            """
            INSERT INTO asset_turn_metrics (
                turn_number,
                asset_id,
                spend,
                impressions,
                clicks,
                revenue,
                net_profit,
                net_profit_per_dollar,
                roi,
                margin,
                ltv,
                creative_fatigue_score,
                scalability_ceiling,
                predicted_profit_per_dollar,
                confidence_score,
                variance_to_prediction,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                turn,
                asset_id,
                spend,
                impressions,
                clicks,
                revenue,
                net_profit,
                profit_per_dollar,
                roi,
                margin,
                ltv,
                fatigue,
                ceiling,
                predicted_profit_per_dollar,
                confidence_score,
                variance,
                self._utcnow(),
            ),
        )

        new_prior = (0.70 * float(asset["base_expected_profit_per_dollar"])) + (0.30 * profit_per_dollar)
        new_fatigue = min(0.98, max(0.02, fatigue))
        proven = bool(asset["is_proven"])
        positive_turns = self.conn.execute(
            """
            SELECT COUNT(*) AS positive_turns
            FROM asset_turn_metrics
            WHERE asset_id = ? AND net_profit_per_dollar > 0
            """,
            (asset_id,),
        ).fetchone()["positive_turns"]
        if positive_turns >= 3:
            proven = True

        self.conn.execute(
            """
            UPDATE assets
            SET is_proven = ?,
                base_expected_profit_per_dollar = ?,
                creative_fatigue_score = ?,
                scalability_ceiling = ?,
                ltv = ?,
                updated_at = ?
            WHERE asset_id = ?
            """,
            (
                int(proven),
                float(np.clip(new_prior, -0.20, 0.60)),
                new_fatigue,
                ceiling,
                ltv,
                self._utcnow(),
                asset_id,
            ),
        )

        if variance is not None:
            self.conn.execute(
                """
                UPDATE decision_audit
                SET actual_net_profit = ?, variance = ?
                WHERE turn_number = ? AND asset_id = ? AND allocation_bucket IN ('winner', 'exploration')
                """,
                (net_profit, variance, turn, asset_id),
            )

        self.conn.commit()
        return {
            "asset_id": asset_id,
            "turn_number": turn,
            "net_profit": net_profit,
            "net_profit_per_dollar": profit_per_dollar,
            "roi": roi,
            "margin": margin,
            "ltv": ltv,
            "creative_fatigue_score": new_fatigue,
        }

    def run_improvement_project(
        self,
        name: str,
        spend: float,
        target_clusters: Optional[Iterable[str]] = None,
        expected_lift_pct: float = 0.02,
        notes: str = "",
    ) -> Dict[str, Any]:
        """
        Funds a reusable systems improvement and applies a durable lift to
        matching assets.
        """

        target_clusters = list(target_clusters or [])
        project_id = f"turn-{self.turn_number}-{self._slug(name)}"
        self.conn.execute(
            """
            INSERT OR REPLACE INTO improvement_projects (
                project_id,
                turn_number,
                name,
                spend,
                target_clusters_json,
                expected_lift_pct,
                notes,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                self.turn_number,
                name,
                float(spend),
                json.dumps(target_clusters),
                float(expected_lift_pct),
                notes,
                self._utcnow(),
            ),
        )

        if target_clusters:
            placeholders = ",".join(["?"] * len(target_clusters))
            target_rows = self.conn.execute(
                f"""
                SELECT asset_id, base_expected_profit_per_dollar, creative_fatigue_score, scalability_ceiling
                FROM assets
                WHERE cluster_id IN ({placeholders}) AND status = 'active'
                """,
                tuple(target_clusters),
            ).fetchall()
        else:
            target_rows = self.conn.execute(
                """
                SELECT asset_id, base_expected_profit_per_dollar, creative_fatigue_score, scalability_ceiling
                FROM assets
                WHERE status = 'active'
                """
            ).fetchall()

        updated_assets: List[str] = []
        for row in target_rows:
            new_ppd = float(row["base_expected_profit_per_dollar"]) * (1 + float(expected_lift_pct))
            new_fatigue = max(0.02, float(row["creative_fatigue_score"]) - (expected_lift_pct * 0.5))
            new_ceiling = float(row["scalability_ceiling"]) * (1 + (float(expected_lift_pct) * 1.5))
            self.conn.execute(
                """
                UPDATE assets
                SET base_expected_profit_per_dollar = ?, creative_fatigue_score = ?, scalability_ceiling = ?, updated_at = ?
                WHERE asset_id = ?
                """,
                (
                    float(np.clip(new_ppd, -0.20, 0.60)),
                    new_fatigue,
                    new_ceiling,
                    self._utcnow(),
                    row["asset_id"],
                ),
            )
            updated_assets.append(row["asset_id"])

        self.conn.commit()
        return {
            "project_id": project_id,
            "name": name,
            "spend": spend,
            "target_clusters": target_clusters,
            "expected_lift_pct": expected_lift_pct,
            "updated_assets": updated_assets,
            "notes": notes,
        }

    def simulate_horizon(self, n_turns: int) -> Dict[str, Any]:
        """
        Forward simulation using current priors and the same profit-floor rules.

        The simulation is deliberately conservative:
        - projected edge decays slightly each turn,
        - fatigue drifts up when heavily spent,
        - improvement projects soften that decay,
        - the profit floor must remain satisfied every turn to be counted as
          sustained.
        """

        n_turns = int(n_turns)
        if n_turns <= 0:
            raise ValueError("n_turns must be positive")

        assets_df = self._load_assets_df().copy()
        history_df = self._load_asset_history_df()
        signals = self._compute_external_signals(assets_df, history_df)
        latest_realized_revenue = self._latest_turn_revenue(self.turn_number)
        simulated_cash = max(self.cash_balance + latest_realized_revenue, self.initial_capital * 0.25)
        simulated_turns: List[Dict[str, Any]] = []
        floor_respected = True

        for step in range(1, n_turns + 1):
            evaluated_df = self._evaluate_assets(assets_df, history_df, signals)
            plan = self._build_allocation_plan(
                available_capital=simulated_cash,
                turn_number=self.turn_number + step,
                evaluated_df=evaluated_df,
                persist=False,
            )

            if not plan["approved"]:
                expanded_assets_df = self._spawn_capacity_asset(assets_df, evaluated_df, step)
                if expanded_assets_df is not None:
                    assets_df = expanded_assets_df
                    evaluated_df = self._evaluate_assets(assets_df, history_df, signals)
                    plan = self._build_allocation_plan(
                        available_capital=simulated_cash,
                        turn_number=self.turn_number + step,
                        evaluated_df=evaluated_df,
                        persist=False,
                    )

            simulated_turns.append(
                {
                    "turn_offset": step,
                    "capital_pool": plan["capital_pool"],
                    "projected_turn_net_profit": plan["projected_turn_net_profit"],
                    "projected_monthly_net_profit": plan["projected_monthly_net_profit"],
                    "approved": plan["approved"],
                    "monthly_profit_target_met": plan["monthly_profit_target_met"],
                }
            )

            if not plan["approved"]:
                floor_respected = False
                break

            simulated_cash += plan["projected_turn_net_profit"]
            floor_respected = floor_respected and bool(plan["monthly_profit_target_met"])

            spend_map = {
                item["asset_id"]: item["allocated_spend"]
                for item in plan["winner_allocations"] + plan["exploration_allocations"]
            }
            improvement_map: Dict[str, float] = {}
            for project in plan["improvement_projects"]:
                for cluster_id in project["target_clusters"]:
                    improvement_map[cluster_id] = improvement_map.get(cluster_id, 0.0) + float(project["expected_lift_pct"])

            for idx in assets_df.index:
                asset_id = assets_df.at[idx, "asset_id"]
                planned_spend = spend_map.get(asset_id, 0.0)
                intensity = planned_spend / max(float(assets_df.at[idx, "scalability_ceiling"]), 1.0)
                ppd = float(assets_df.at[idx, "base_expected_profit_per_dollar"])
                fatigue = float(assets_df.at[idx, "creative_fatigue_score"])
                cluster_id = str(assets_df.at[idx, "cluster_id"])
                ceiling = float(assets_df.at[idx, "scalability_ceiling"])

                project_lift = improvement_map.get(cluster_id, 0.0)
                improvement_boost = (0.004 if planned_spend > 0 else 0.001) + (project_lift * 0.80)
                natural_decay = 0.0005 + (0.004 * intensity)
                fatigue = min(0.85, max(0.02, fatigue + (0.018 * intensity) - 0.015 - (project_lift * 0.70)))
                ppd = ppd * (1 - natural_decay) + improvement_boost - (fatigue * 0.002)
                ceiling = ceiling * (1 + (project_lift * 1.2)) if project_lift > 0 else ceiling * 1.005

                assets_df.at[idx, "creative_fatigue_score"] = fatigue
                assets_df.at[idx, "base_expected_profit_per_dollar"] = float(np.clip(ppd, -0.20, 0.60))
                assets_df.at[idx, "scalability_ceiling"] = ceiling

        last_turn = simulated_turns[-1] if simulated_turns else {}
        return {
            "n_turns": n_turns,
            "floor_respected": floor_respected,
            "projected_capital_at_horizon": simulated_cash,
            "projected_net_profit_at_horizon": float(last_turn.get("projected_monthly_net_profit", 0.0)),
            "turns": simulated_turns,
        }

    def _spawn_capacity_asset(
        self,
        assets_df: pd.DataFrame,
        evaluated_df: pd.DataFrame,
        step: int,
    ) -> Optional[pd.DataFrame]:
        """
        Adds a synthetic high-synergy winner variant when capital outgrows
        existing ceilings during horizon simulation.
        """

        if evaluated_df.empty:
            return None

        best_row = evaluated_df.sort_values("score", ascending=False).iloc[0]
        cluster_id = str(best_row["cluster_id"])
        cluster_assets = evaluated_df[evaluated_df["cluster_id"] == cluster_id]
        if cluster_assets.empty:
            return None

        base_asset = cluster_assets.sort_values("score", ascending=False).iloc[0]
        new_asset_id = f"{base_asset['asset_id']}-capacity-{step}"
        if new_asset_id in assets_df["asset_id"].tolist():
            return None

        mean_ceiling = float(cluster_assets["scalability_ceiling"].mean())
        mean_synergy = float(cluster_assets["synergy_score"].mean())
        new_row = {
            "asset_id": new_asset_id,
            "source": base_asset["source"],
            "campaign": f"{base_asset['campaign']}-Capacity-{step}",
            "article_template": f"{base_asset['article_template']}-Variant-{step}",
            "cluster_id": cluster_id,
            "status": "active",
            "is_proven": 1,
            "base_expected_profit_per_dollar": float(base_asset["projected_profit_per_dollar"] * 0.95),
            "scalability_ceiling": max(mean_ceiling * 0.90, float(base_asset["scalability_ceiling"]) * 0.80),
            "ltv": float(base_asset["ltv"]),
            "creative_fatigue_score": max(0.05, float(base_asset["creative_fatigue_score"]) - 0.08),
            "volatility": max(0.04, float(base_asset["rolling_std"]) + 0.02),
            "synergy_score": float(np.clip(mean_synergy + 0.04, 0.05, 0.35)),
            "metadata_json": json.dumps(
                {
                    "spawned_for_capacity": True,
                    "simulation_step": step,
                    "cloned_from": base_asset["asset_id"],
                },
                sort_keys=True,
            ),
        }
        return pd.concat([assets_df, pd.DataFrame([new_row])], ignore_index=True)

    # ---------------------------------------------------------------------
    # Internal helpers
    # ---------------------------------------------------------------------

    def _build_allocation_plan(
        self,
        available_capital: float,
        turn_number: int,
        evaluated_df: pd.DataFrame,
        persist: bool,
    ) -> Dict[str, Any]:
        available_capital = float(max(0.0, available_capital))
        reserve_budget = available_capital * self.reserve_allocation_pct
        improvement_budget = available_capital * self.improvement_allocation_pct
        exploration_budget = available_capital * self.exploration_allocation_pct
        winner_budget = available_capital - reserve_budget - improvement_budget - exploration_budget

        evaluated_df = evaluated_df.copy()
        positive_df = evaluated_df[evaluated_df["projected_profit_per_dollar"] > 0].copy()
        top_count = max(1, math.ceil(max(len(evaluated_df), 1) * self.pareto_top_asset_pct))
        top_assets_df = positive_df.sort_values("score", ascending=False).head(top_count).copy()
        proven_positive_df = positive_df[positive_df["is_proven"] == 1].sort_values("score", ascending=False).copy()
        exploration_candidates_df = evaluated_df[
            (evaluated_df["is_proven"] == 0) & (evaluated_df["projected_profit_per_dollar"] > -0.02)
        ].sort_values("score", ascending=False).copy()

        winner_alloc_df = self._allocate_candidate_budget(
            top_assets_df,
            budget=min(winner_budget, available_capital * self.pareto_capital_pct),
            bucket="winner",
        )
        winner_allocated = float(winner_alloc_df["allocated_spend"].sum()) if not winner_alloc_df.empty else 0.0
        remaining_winner_budget = max(0.0, winner_budget - winner_allocated)

        if remaining_winner_budget > 0 and not proven_positive_df.empty:
            secondary_alloc_df = self._allocate_candidate_budget(
                proven_positive_df,
                budget=remaining_winner_budget,
                bucket="winner",
                existing_allocations=winner_alloc_df[["asset_id", "allocated_spend"]] if not winner_alloc_df.empty else None,
            )
            winner_alloc_df = self._merge_allocation_frames(winner_alloc_df, secondary_alloc_df)

        exploration_alloc_df = self._allocate_candidate_budget(
            exploration_candidates_df,
            budget=exploration_budget,
            bucket="exploration",
        )

        # If exploration hurts the monthly floor, shrink exploration first and
        # redirect those dollars to proven winners.
        projected_turn_net = self._project_turn_net_profit(winner_alloc_df, exploration_alloc_df, improvement_budget)
        projected_monthly_net = projected_turn_net * self._turns_per_month()
        exploration_reduction_notes: List[str] = []

        if projected_monthly_net < self.monthly_profit_floor and not exploration_alloc_df.empty and not proven_positive_df.empty:
            for reduction_pct in (0.50, 0.75, 1.00):
                retained_exploration = exploration_budget * (1 - reduction_pct)
                trimmed_exploration_df = exploration_alloc_df.copy()
                if retained_exploration <= 0:
                    trimmed_exploration_df["allocated_spend"] = 0.0
                else:
                    scale = retained_exploration / max(float(trimmed_exploration_df["allocated_spend"].sum()), 1.0)
                    trimmed_exploration_df["allocated_spend"] *= scale

                recycled_budget = exploration_budget - float(trimmed_exploration_df["allocated_spend"].sum())
                top_up_winner_df = self._allocate_candidate_budget(
                    proven_positive_df,
                    budget=recycled_budget,
                    bucket="winner",
                    existing_allocations=winner_alloc_df[["asset_id", "allocated_spend"]] if not winner_alloc_df.empty else None,
                )
                candidate_winner_df = self._merge_allocation_frames(winner_alloc_df, top_up_winner_df)
                candidate_turn_net = self._project_turn_net_profit(candidate_winner_df, trimmed_exploration_df, improvement_budget)
                candidate_monthly_net = candidate_turn_net * self._turns_per_month()

                if candidate_monthly_net >= projected_monthly_net:
                    winner_alloc_df = candidate_winner_df
                    exploration_alloc_df = trimmed_exploration_df
                    projected_turn_net = candidate_turn_net
                    projected_monthly_net = candidate_monthly_net
                    exploration_reduction_notes.append(
                        f"Exploration reduced by {int(reduction_pct * 100)}% to defend the monthly net profit floor."
                    )

                if projected_monthly_net >= self.monthly_profit_floor:
                    break

        improvement_projects = self._design_improvement_projects(improvement_budget, evaluated_df)
        if persist:
            for project in improvement_projects:
                self.run_improvement_project(
                    name=project["name"],
                    spend=project["spend"],
                    target_clusters=project["target_clusters"],
                    expected_lift_pct=project["expected_lift_pct"],
                    notes=project["notes"],
                )

        winner_allocations = self._allocation_records_from_df(winner_alloc_df, bucket="winner")
        exploration_allocations = self._allocation_records_from_df(exploration_alloc_df, bucket="exploration")
        projected_turn_net = self._project_turn_net_profit(winner_alloc_df, exploration_alloc_df, improvement_budget)
        projected_monthly_net = projected_turn_net * self._turns_per_month()
        approved = projected_monthly_net >= self.monthly_profit_floor

        projected_capital_at_horizon, projected_net_profit_at_horizon = self._quick_horizon_projection(
            available_capital=available_capital,
            projected_turn_net_profit=projected_turn_net,
            turns_remaining=max(self.horizon_turns - turn_number, 0),
        )

        warnings = self._collect_warnings(evaluated_df)
        warnings.extend(exploration_reduction_notes)
        if not approved:
            warnings.append(
                "Projected monthly net profit is below the configured floor; plan is flagged as rejected and requires more edge or more capital."
            )

        allocation: Dict[str, Any] = {
            "turn_number": turn_number,
            "capital_pool": round(available_capital, 2),
            "allocated_capital": round(
                sum(item["allocated_spend"] for item in winner_allocations + exploration_allocations)
                + improvement_budget
                + reserve_budget,
                2,
            ),
            "current_cash_after_commitment": round(max(0.0, self.cash_balance - available_capital), 2) if persist else 0.0,
            "reserve_budget": round(reserve_budget, 2),
            "improvement_budget": round(improvement_budget, 2),
            "exploration_budget": round(sum(item["allocated_spend"] for item in exploration_allocations), 2),
            "winner_budget": round(sum(item["allocated_spend"] for item in winner_allocations), 2),
            "monthly_profit_floor": round(self.monthly_profit_floor, 2),
            "projected_turn_net_profit": round(projected_turn_net, 2),
            "projected_monthly_net_profit": round(projected_monthly_net, 2),
            "monthly_profit_target_met": bool(approved),
            "approved": bool(approved),
            "turns_remaining": max(self.horizon_turns - turn_number, 0),
            "projected_capital_at_horizon": round(projected_capital_at_horizon, 2),
            "projected_net_profit_at_horizon": round(projected_net_profit_at_horizon, 2),
            "winner_allocations": winner_allocations,
            "exploration_allocations": exploration_allocations,
            "improvement_projects": improvement_projects,
            "reserve_allocation": {
                "amount": round(reserve_budget, 2),
                "reason": "Held for policy shocks, outages, rapid reallocation, and drawdown defense.",
            },
            "cluster_summary": self._cluster_summary_records(evaluated_df),
            "warnings": warnings,
        }

        if persist:
            self._persist_decision_audit(
                turn_number=turn_number,
                winner_allocations=winner_allocations,
                exploration_allocations=exploration_allocations,
                improvement_projects=improvement_projects,
                reserve_budget=reserve_budget,
                approved=approved,
            )

        return allocation

    def _design_improvement_projects(self, improvement_budget: float, evaluated_df: pd.DataFrame) -> List[Dict[str, Any]]:
        if improvement_budget <= 0 or evaluated_df.empty:
            return []

        cluster_profit = (
            evaluated_df.groupby("cluster_id", as_index=False)["projected_profit_per_dollar"].mean()
            .rename(columns={"projected_profit_per_dollar": "cluster_ppd"})
            .sort_values("cluster_ppd", ascending=False)
        )
        fatigue_cluster = (
            evaluated_df.groupby("cluster_id", as_index=False)["creative_fatigue_score"].mean()
            .rename(columns={"creative_fatigue_score": "cluster_fatigue"})
            .sort_values("cluster_fatigue", ascending=False)
        )

        projects: List[Dict[str, Any]] = []
        top_profit_cluster = cluster_profit.iloc[0]["cluster_id"] if not cluster_profit.empty else None
        top_fatigue_cluster = fatigue_cluster.iloc[0]["cluster_id"] if not fatigue_cluster.empty else None

        if top_profit_cluster is not None:
            projects.append(
                {
                    "name": "Predictive bidding and pacing model",
                    "spend": round(improvement_budget * 0.60, 2),
                    "target_clusters": [str(top_profit_cluster)],
                    "expected_lift_pct": 0.050,
                    "notes": "Reinforces the highest-return cluster with better pacing, intraday signals, and bid controls.",
                }
            )

        if top_fatigue_cluster is not None:
            projects.append(
                {
                    "name": "Creative refresh pipeline",
                    "spend": round(improvement_budget * 0.40, 2),
                    "target_clusters": [str(top_fatigue_cluster)],
                    "expected_lift_pct": 0.035,
                    "notes": "Counteracts fatigue and lifts downstream RSOC monetization via faster creative and landing refresh.",
                }
            )

        if len(projects) == 2 and projects[0]["target_clusters"] == projects[1]["target_clusters"]:
            total_spend = round(sum(project["spend"] for project in projects), 2)
            return [
                {
                    "name": "Unified optimization stack",
                    "spend": total_spend,
                    "target_clusters": projects[0]["target_clusters"],
                    "expected_lift_pct": 0.060,
                    "notes": "Bundles bidding automation, creative refresh, and fraud/quality controls into a single cluster upgrade.",
                }
            ]
        return projects

    def _project_turn_net_profit(
        self,
        winner_alloc_df: pd.DataFrame,
        exploration_alloc_df: pd.DataFrame,
        improvement_budget: float,
    ) -> float:
        winner_profit = (
            float((winner_alloc_df["allocated_spend"] * winner_alloc_df["projected_profit_per_dollar"]).sum())
            if not winner_alloc_df.empty
            else 0.0
        )
        exploration_profit = (
            float((exploration_alloc_df["allocated_spend"] * exploration_alloc_df["projected_profit_per_dollar"]).sum())
            if not exploration_alloc_df.empty
            else 0.0
        )
        return winner_profit + exploration_profit - float(improvement_budget)

    def _collect_warnings(self, evaluated_df: pd.DataFrame) -> List[str]:
        warnings: List[str] = []
        if evaluated_df.empty:
            warnings.append("No active assets are available for allocation.")
            return warnings

        hot_fatigue = evaluated_df[evaluated_df["creative_fatigue_score"] >= 0.75]
        if not hot_fatigue.empty:
            assets = ", ".join(hot_fatigue["asset_id"].head(3).tolist())
            warnings.append(f"Creative fatigue is elevated on: {assets}.")

        policy_pressure = evaluated_df[evaluated_df["policy_alert_level"] >= 0.60]
        if not policy_pressure.empty:
            sources = ", ".join(sorted(policy_pressure["source"].unique().tolist()))
            warnings.append(f"Policy pressure detected on sources: {sources}.")

        negative_assets = evaluated_df[evaluated_df["projected_profit_per_dollar"] <= 0]
        if not negative_assets.empty:
            assets = ", ".join(negative_assets["asset_id"].head(4).tolist())
            warnings.append(f"Assets suppressed from scaling due to weak edge: {assets}.")

        return warnings

    def _quick_horizon_projection(
        self,
        available_capital: float,
        projected_turn_net_profit: float,
        turns_remaining: int,
    ) -> Tuple[float, float]:
        projected_capital = float(available_capital)
        decay = 0.996
        turn_profit = float(projected_turn_net_profit)
        monthly_run_rate = turn_profit * self._turns_per_month()

        for _ in range(max(0, turns_remaining)):
            projected_capital += turn_profit
            turn_profit *= decay
            monthly_run_rate = turn_profit * self._turns_per_month()

        return projected_capital, monthly_run_rate

    def _allocation_records_from_df(self, allocation_df: pd.DataFrame, bucket: str) -> List[Dict[str, Any]]:
        if allocation_df.empty:
            return []

        records: List[Dict[str, Any]] = []
        allocation_df = allocation_df[allocation_df["allocated_spend"] > 0].copy()
        allocation_df = allocation_df.sort_values(["allocated_spend", "score"], ascending=[False, False])
        for _, row in allocation_df.iterrows():
            records.append(
                {
                    "asset_id": row["asset_id"],
                    "source": row["source"],
                    "campaign": row["campaign"],
                    "article_template": row["article_template"],
                    "cluster_id": row["cluster_id"],
                    "bucket": bucket,
                    "allocated_spend": round(float(row["allocated_spend"]), 2),
                    "projected_profit_per_dollar": round(float(row["projected_profit_per_dollar"]), 4),
                    "projected_net_profit": round(float(row["allocated_spend"] * row["projected_profit_per_dollar"]), 2),
                    "confidence_score": round(float(row["confidence_score"]), 4),
                    "roi": round(float(row["roi"]), 4),
                    "creative_fatigue_score": round(float(row["creative_fatigue_score"]), 4),
                    "scalability_ceiling": round(float(row["scalability_ceiling"]), 2),
                    "reason": self._reason_for_row(row, bucket),
                }
            )
        return records

    def _reason_for_row(self, row: pd.Series, bucket: str) -> str:
        cluster_bonus = float(row.get("cluster_bonus", 0.0))
        trend = float(row.get("trend_score", 0.0))
        return (
            f"{bucket.title()} allocation because {row['asset_id']} is projecting "
            f"{row['projected_profit_per_dollar']:.2%} net profit per dollar with "
            f"{row['confidence_score']:.0%} confidence, trend {trend:+.2%}, and "
            f"cluster synergy bonus {cluster_bonus:+.2%}."
        )

    def _cluster_summary_records(self, evaluated_df: pd.DataFrame) -> List[Dict[str, Any]]:
        if evaluated_df.empty:
            return []
        grouped = (
            evaluated_df.groupby("cluster_id", as_index=False)
            .agg(
                asset_count=("asset_id", "count"),
                avg_projected_ppd=("projected_profit_per_dollar", "mean"),
                avg_confidence=("confidence_score", "mean"),
                avg_fatigue=("creative_fatigue_score", "mean"),
                avg_cluster_bonus=("cluster_bonus", "mean"),
            )
            .sort_values("avg_projected_ppd", ascending=False)
        )
        return [
            {
                "cluster_id": row["cluster_id"],
                "asset_count": int(row["asset_count"]),
                "avg_projected_profit_per_dollar": round(float(row["avg_projected_ppd"]), 4),
                "avg_confidence": round(float(row["avg_confidence"]), 4),
                "avg_creative_fatigue": round(float(row["avg_fatigue"]), 4),
                "avg_cluster_bonus": round(float(row["avg_cluster_bonus"]), 4),
            }
            for _, row in grouped.iterrows()
        ]

    def _persist_decision_audit(
        self,
        turn_number: int,
        winner_allocations: List[Dict[str, Any]],
        exploration_allocations: List[Dict[str, Any]],
        improvement_projects: List[Dict[str, Any]],
        reserve_budget: float,
        approved: bool,
    ) -> None:
        rows: List[Tuple[Any, ...]] = []
        for item in winner_allocations + exploration_allocations:
            rows.append(
                (
                    turn_number,
                    item["asset_id"],
                    item["cluster_id"],
                    item["bucket"],
                    item["allocated_spend"],
                    item["reason"],
                    item["confidence_score"],
                    item["projected_net_profit"],
                    item["projected_profit_per_dollar"],
                    int(approved),
                    int(not approved),
                    None,
                    self._utcnow(),
                )
            )

        for project in improvement_projects:
            rows.append(
                (
                    turn_number,
                    None,
                    ",".join(project["target_clusters"]),
                    "improvement",
                    project["spend"],
                    project["notes"],
                    0.85,
                    0.0,
                    project["expected_lift_pct"],
                    int(approved),
                    int(not approved),
                    0.0,
                    self._utcnow(),
                )
            )

        rows.append(
            (
                turn_number,
                None,
                None,
                "reserve",
                reserve_budget,
                "Defense reserve preserved for outages, policy changes, and abrupt source degradation.",
                1.0,
                0.0,
                0.0,
                int(approved),
                int(not approved),
                0.0,
                self._utcnow(),
            )
        )

        self.conn.executemany(
            """
            INSERT INTO decision_audit (
                turn_number,
                asset_id,
                cluster_id,
                allocation_bucket,
                allocated_dollars,
                reason,
                confidence_score,
                projected_net_profit,
                projected_profit_per_dollar,
                monthly_profit_target_met,
                rejected,
                variance,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        self.conn.commit()

    def _allocate_candidate_budget(
        self,
        candidate_df: pd.DataFrame,
        budget: float,
        bucket: str,
        existing_allocations: Optional[pd.DataFrame] = None,
    ) -> pd.DataFrame:
        if candidate_df.empty or budget <= 0:
            return pd.DataFrame(columns=list(candidate_df.columns) + ["allocated_spend"])

        allocation_df = candidate_df.copy()
        allocation_df["allocated_spend"] = 0.0

        existing_map: Dict[str, float] = {}
        if existing_allocations is not None and not existing_allocations.empty:
            existing_map = dict(zip(existing_allocations["asset_id"], existing_allocations["allocated_spend"]))

        rank_weights = np.array([1 / (rank ** (1.3 if bucket == "winner" else 1.1)) for rank in range(1, len(allocation_df) + 1)])
        score_weights = allocation_df["score"].clip(lower=0.0001).to_numpy(dtype=float)
        weights = rank_weights * score_weights
        weights = weights / weights.sum()

        remaining = float(budget)
        for idx, (_, row) in enumerate(allocation_df.iterrows()):
            asset_id = row["asset_id"]
            existing_spend = float(existing_map.get(asset_id, 0.0))
            max_room = max(0.0, float(row["scalability_ceiling"]) - existing_spend)
            proposed = float(budget * weights[idx])

            if bucket == "exploration":
                exploration_cap = min(max_room, max(1_500.0, float(row["scalability_ceiling"]) * 0.35))
                spend = min(exploration_cap, proposed, remaining)
            else:
                spend = min(max_room, proposed, remaining)

            allocation_df.at[row.name, "allocated_spend"] = spend
            remaining -= spend

        # Recycle any budget left because of ceilings back into the strongest rows.
        safety_counter = 0
        while remaining > 1e-6 and safety_counter < 12:
            safety_counter += 1
            delta_applied = 0.0
            for _, row in allocation_df.sort_values("score", ascending=False).iterrows():
                asset_id = row["asset_id"]
                already_allocated = float(allocation_df.loc[allocation_df["asset_id"] == asset_id, "allocated_spend"].iloc[0])
                existing_spend = float(existing_map.get(asset_id, 0.0))
                max_room = max(0.0, float(row["scalability_ceiling"]) - existing_spend - already_allocated)
                if max_room <= 0:
                    continue
                delta = min(max_room, remaining)
                allocation_df.loc[allocation_df["asset_id"] == asset_id, "allocated_spend"] += delta
                remaining -= delta
                delta_applied += delta
                if remaining <= 1e-6:
                    break
            if delta_applied <= 1e-6:
                break

        return allocation_df

    def _merge_allocation_frames(self, left: pd.DataFrame, right: pd.DataFrame) -> pd.DataFrame:
        if left.empty:
            return right.copy()
        if right.empty:
            return left.copy()

        merged = pd.concat([left, right], ignore_index=True)
        group_cols = [column for column in merged.columns if column != "allocated_spend"]
        merged = (
            merged.groupby(group_cols, dropna=False, as_index=False)["allocated_spend"]
            .sum()
            .sort_values("allocated_spend", ascending=False)
        )
        return merged

    def _evaluate_assets(
        self,
        assets_df: pd.DataFrame,
        history_df: pd.DataFrame,
        external_signals: Dict[str, Dict[str, float]],
    ) -> pd.DataFrame:
        if assets_df.empty:
            return pd.DataFrame(
                columns=[
                    "asset_id",
                    "source",
                    "campaign",
                    "article_template",
                    "cluster_id",
                    "is_proven",
                    "score",
                    "projected_profit_per_dollar",
                    "confidence_score",
                    "creative_fatigue_score",
                    "scalability_ceiling",
                    "roi",
                    "cluster_bonus",
                    "policy_alert_level",
                    "trend_score",
                ]
            )

        history_df = history_df.sort_values(["asset_id", "turn_number"])
        evaluation_rows: List[Dict[str, Any]] = []

        for _, asset in assets_df.iterrows():
            asset_history = history_df[history_df["asset_id"] == asset["asset_id"]].copy()
            recent_history = asset_history.tail(7)
            turns_observed = len(recent_history)

            last_ppd = float(recent_history["net_profit_per_dollar"].iloc[-1]) if turns_observed else float(asset["base_expected_profit_per_dollar"])
            mean_ppd = float(recent_history["net_profit_per_dollar"].mean()) if turns_observed else float(asset["base_expected_profit_per_dollar"])
            rolling_std = float(recent_history["net_profit_per_dollar"].std(ddof=0)) if turns_observed >= 2 else float(asset["volatility"])
            roi = float(recent_history["roi"].iloc[-1]) if turns_observed else float(asset["base_expected_profit_per_dollar"])
            last_spend = float(recent_history["spend"].iloc[-1]) if turns_observed else 0.0
            fatigue = (
                float(recent_history["creative_fatigue_score"].iloc[-1])
                if turns_observed
                else float(asset["creative_fatigue_score"])
            )
            scale_ceiling = (
                float(recent_history["scalability_ceiling"].iloc[-1])
                if turns_observed
                else float(asset["scalability_ceiling"])
            )

            trend_score = 0.0
            if turns_observed >= 2:
                x = np.arange(turns_observed, dtype=float)
                y = recent_history["net_profit_per_dollar"].to_numpy(dtype=float)
                trend_score = float(np.polyfit(x, y, 1)[0])

            source_signals = external_signals.get(asset["source"], {})
            policy_alert_level = float(source_signals.get("policy_alert_level", 0.0))
            cpc_trend = float(source_signals.get("cpc_trend", 0.0))
            widget_rpm_change = float(source_signals.get("widget_rpm_change", 0.0))
            competitor_activity = float(source_signals.get("competitor_activity", 0.0))

            fatigue_penalty = max(0.55, 1 - (fatigue * 0.55))
            volatility_penalty = max(0.45, 1 - (rolling_std * 1.1))
            source_factor = (
                1
                - (0.20 * max(cpc_trend, 0.0))
                + (0.30 * widget_rpm_change)
                - (0.18 * competitor_activity)
                - (0.35 * policy_alert_level)
            )
            source_factor = float(np.clip(source_factor, 0.45, 1.45))

            raw_projected_ppd = (
                (0.45 * last_ppd)
                + (0.35 * mean_ppd)
                + (0.20 * float(asset["base_expected_profit_per_dollar"]))
            )
            raw_projected_ppd *= (1 + (trend_score * 1.5))
            raw_projected_ppd *= fatigue_penalty
            raw_projected_ppd *= volatility_penalty
            raw_projected_ppd *= source_factor
            raw_projected_ppd = float(np.clip(raw_projected_ppd, -0.25, 0.65))

            headroom_ratio = max(0.10, (scale_ceiling - last_spend) / max(scale_ceiling, 1.0))
            confidence = (
                0.30
                + min(0.35, turns_observed * 0.07)
                + (0.12 if int(asset["is_proven"]) == 1 else 0.0)
                + max(0.0, raw_projected_ppd) * 0.45
                - min(0.20, rolling_std * 0.50)
                - (policy_alert_level * 0.10)
            )
            confidence = float(np.clip(confidence, 0.05, 0.97))

            evaluation_rows.append(
                {
                    "asset_id": asset["asset_id"],
                    "source": asset["source"],
                    "campaign": asset["campaign"],
                    "article_template": asset["article_template"],
                    "cluster_id": asset["cluster_id"],
                    "is_proven": int(asset["is_proven"]),
                    "status": asset["status"],
                    "latest_spend": last_spend,
                    "roi": roi,
                    "ltv": float(asset["ltv"]),
                    "creative_fatigue_score": fatigue,
                    "scalability_ceiling": scale_ceiling,
                    "synergy_score": float(asset["synergy_score"]),
                    "policy_alert_level": policy_alert_level,
                    "cpc_trend": cpc_trend,
                    "widget_rpm_change": widget_rpm_change,
                    "competitor_activity": competitor_activity,
                    "turns_observed": turns_observed,
                    "trend_score": trend_score,
                    "rolling_std": rolling_std,
                    "headroom_ratio": headroom_ratio,
                    "confidence_score": confidence,
                    "raw_projected_profit_per_dollar": raw_projected_ppd,
                }
            )

        evaluated_df = pd.DataFrame(evaluation_rows)
        cluster_stats = (
            evaluated_df.groupby("cluster_id", as_index=False)
            .agg(
                cluster_mean_ppd=("raw_projected_profit_per_dollar", "mean"),
                cluster_asset_count=("asset_id", "count"),
                cluster_synergy_mean=("synergy_score", "mean"),
                cluster_positive_share=("raw_projected_profit_per_dollar", lambda s: float((s > 0).mean())),
            )
            .sort_values("cluster_mean_ppd", ascending=False)
        )
        evaluated_df = evaluated_df.merge(cluster_stats, on="cluster_id", how="left")

        correlation_rows = self._compute_asset_correlations(history_df, assets_df)
        correlation_map = {
            row["cluster_id"]: row["avg_positive_correlation"]
            for row in correlation_rows
        }
        evaluated_df["avg_positive_correlation"] = evaluated_df["cluster_id"].map(correlation_map).fillna(0.0)
        evaluated_df["cluster_bonus"] = (
            (evaluated_df["cluster_mean_ppd"] * 0.30)
            + (evaluated_df["cluster_synergy_mean"] * 0.25)
            + (evaluated_df["cluster_positive_share"] * 0.10)
            + (evaluated_df["avg_positive_correlation"] * 0.10)
        ).clip(lower=-0.10, upper=0.25)

        evaluated_df["projected_profit_per_dollar"] = (
            evaluated_df["raw_projected_profit_per_dollar"] * (1 + evaluated_df["cluster_bonus"])
        ).clip(lower=-0.25, upper=0.65)
        evaluated_df["score"] = (
            evaluated_df["projected_profit_per_dollar"]
            * evaluated_df["confidence_score"]
            * evaluated_df["headroom_ratio"]
            * (1 + evaluated_df["synergy_score"])
        )

        return evaluated_df.sort_values("score", ascending=False).reset_index(drop=True)

    def _compute_asset_correlations(
        self,
        history_df: pd.DataFrame,
        assets_df: pd.DataFrame,
    ) -> List[Dict[str, Any]]:
        if history_df.empty:
            return []

        merged = history_df.merge(assets_df[["asset_id", "cluster_id"]], on="asset_id", how="left")
        results: List[Dict[str, Any]] = []

        for cluster_id, cluster_df in merged.groupby("cluster_id"):
            pivot = cluster_df.pivot_table(
                index="turn_number",
                columns="asset_id",
                values="net_profit_per_dollar",
                aggfunc="mean",
            )
            if pivot.shape[1] < 2 or pivot.shape[0] < 3:
                continue

            correlation_matrix = pivot.corr().fillna(0.0)
            positive_values: List[float] = []
            for col_a in correlation_matrix.columns:
                for col_b in correlation_matrix.columns:
                    if col_a >= col_b:
                        continue
                    corr = float(correlation_matrix.loc[col_a, col_b])
                    positive_values.append(max(0.0, corr))

            results.append(
                {
                    "cluster_id": cluster_id,
                    "avg_positive_correlation": float(np.mean(positive_values)) if positive_values else 0.0,
                    "matrix": correlation_matrix,
                }
            )
        return results

    def _persist_cluster_metrics(
        self,
        turn_number: int,
        evaluated_df: pd.DataFrame,
        history_df: pd.DataFrame,
    ) -> None:
        if evaluated_df.empty:
            return

        grouped = (
            evaluated_df.groupby("cluster_id", as_index=False)
            .agg(
                asset_count=("asset_id", "count"),
                projected_profit_per_dollar=("projected_profit_per_dollar", "mean"),
                confidence_score=("confidence_score", "mean"),
                cluster_bonus=("cluster_bonus", "mean"),
            )
            .sort_values("projected_profit_per_dollar", ascending=False)
        )
        for _, row in grouped.iterrows():
            self.conn.execute(
                """
                INSERT OR REPLACE INTO cluster_turn_metrics (
                    turn_number,
                    cluster_id,
                    asset_count,
                    projected_profit_per_dollar,
                    confidence_score,
                    cluster_bonus,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    turn_number,
                    row["cluster_id"],
                    int(row["asset_count"]),
                    float(row["projected_profit_per_dollar"]),
                    float(row["confidence_score"]),
                    float(row["cluster_bonus"]),
                    self._utcnow(),
                ),
            )

        for correlation in self._compute_asset_correlations(history_df, self._load_assets_df()):
            matrix = correlation["matrix"]
            cluster_id = correlation["cluster_id"]
            for col_a in matrix.columns:
                for col_b in matrix.columns:
                    if col_a >= col_b:
                        continue
                    self.conn.execute(
                        """
                        INSERT INTO asset_correlations (
                            turn_number,
                            cluster_id,
                            asset_id_a,
                            asset_id_b,
                            profit_correlation,
                            created_at
                        ) VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            turn_number,
                            cluster_id,
                            col_a,
                            col_b,
                            float(matrix.loc[col_a, col_b]),
                            self._utcnow(),
                        ),
                    )
        self.conn.commit()

    def _compute_external_signals(
        self,
        assets_df: pd.DataFrame,
        history_df: pd.DataFrame,
    ) -> Dict[str, Dict[str, float]]:
        signals: Dict[str, Dict[str, float]] = {}
        if assets_df.empty:
            return signals

        merged = history_df.merge(assets_df[["asset_id", "source"]], on="asset_id", how="left")
        for source in sorted(assets_df["source"].unique()):
            source_history = merged[merged["source"] == source].sort_values("turn_number")
            recent = source_history.tail(10)

            cpc_trend = 0.0
            widget_rpm_change = 0.0
            competitor_activity = 0.18
            policy_alert_level = 0.05
            notes = []

            if len(recent) >= 2:
                recent = recent.copy()
                recent["cpc"] = recent["spend"] / recent["clicks"].replace(0, np.nan)
                recent["rpm"] = (recent["revenue"] / recent["impressions"].replace(0, np.nan)) * 1000

                cpc_series = recent["cpc"].dropna()
                rpm_series = recent["rpm"].dropna()

                if len(cpc_series) >= 2 and cpc_series.iloc[0] != 0:
                    cpc_trend = float((cpc_series.iloc[-1] - cpc_series.iloc[0]) / abs(cpc_series.iloc[0]))

                if len(rpm_series) >= 2 and rpm_series.iloc[0] != 0:
                    widget_rpm_change = float((rpm_series.iloc[-1] - rpm_series.iloc[0]) / abs(rpm_series.iloc[0]))

                avg_variance = float(recent["variance_to_prediction"].dropna().mean()) if recent["variance_to_prediction"].notna().any() else 0.0
                if avg_variance < -0.04:
                    competitor_activity += 0.12
                    notes.append("Underperformed forecasts; competitor pressure assumed higher.")
                if widget_rpm_change < -0.08:
                    policy_alert_level += 0.12
                    notes.append("Widget RPM deteriorated; monetization pressure elevated.")
                if cpc_trend > 0.10:
                    competitor_activity += 0.08
                    notes.append("Traffic costs rose materially.")

            overrides = self.external_signal_overrides.get(source, {})
            signals[source] = {
                "cpc_trend": float(overrides.get("cpc_trend", np.clip(cpc_trend, -0.25, 0.40))),
                "widget_rpm_change": float(overrides.get("widget_rpm_change", np.clip(widget_rpm_change, -0.30, 0.30))),
                "competitor_activity": float(overrides.get("competitor_activity", np.clip(competitor_activity, 0.0, 1.0))),
                "policy_alert_level": float(overrides.get("policy_alert_level", np.clip(policy_alert_level, 0.0, 1.0))),
                "notes": overrides.get("notes", " ".join(notes) if notes else "No abnormal external signal detected."),
            }
        return signals

    def _persist_external_signals(
        self,
        turn_number: int,
        external_signals: Dict[str, Dict[str, float]],
    ) -> None:
        for source, signal in external_signals.items():
            self.conn.execute(
                """
                INSERT INTO external_signals (
                    turn_number,
                    source,
                    cpc_trend,
                    widget_rpm_change,
                    competitor_activity,
                    policy_alert_level,
                    notes,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    turn_number,
                    source,
                    signal["cpc_trend"],
                    signal["widget_rpm_change"],
                    signal["competitor_activity"],
                    signal["policy_alert_level"],
                    signal.get("notes", ""),
                    self._utcnow(),
                ),
            )
        self.conn.commit()

    def _load_assets_df(self) -> pd.DataFrame:
        return pd.read_sql_query(
            """
            SELECT asset_id, source, campaign, article_template, cluster_id,
                   status, is_proven, base_expected_profit_per_dollar,
                   scalability_ceiling, ltv, creative_fatigue_score,
                   volatility, synergy_score, metadata_json
            FROM assets
            WHERE status = 'active'
            ORDER BY source, campaign, article_template
            """,
            self.conn,
        )

    def _load_asset_history_df(self) -> pd.DataFrame:
        return pd.read_sql_query(
            """
            SELECT turn_number, asset_id, spend, impressions, clicks, revenue,
                   net_profit, net_profit_per_dollar, roi, margin, ltv,
                   creative_fatigue_score, scalability_ceiling,
                   predicted_profit_per_dollar, confidence_score,
                   variance_to_prediction
            FROM asset_turn_metrics
            ORDER BY turn_number, asset_id
            """,
            self.conn,
        )

    def _latest_turn_revenue(self, turn_number: int) -> float:
        row = self.conn.execute(
            """
            SELECT COALESCE(SUM(revenue), 0.0) AS total_revenue
            FROM asset_turn_metrics
            WHERE turn_number = ?
            """,
            (int(turn_number),),
        ).fetchone()
        return float(row["total_revenue"]) if row is not None else 0.0

    def _turns_per_month(self) -> float:
        if self.turn_granularity == "hourly":
            return 24.0 * 30.0
        if self.turn_granularity == "weekly":
            return 52.0 / 12.0
        return 30.0

    def _asset_id(self, source: str, campaign: str, article_template: str) -> str:
        return self._slug(f"{source}-{campaign}-{article_template}")

    def _slug(self, value: str) -> str:
        safe = "".join(char.lower() if char.isalnum() else "-" for char in value)
        while "--" in safe:
            safe = safe.replace("--", "-")
        return safe.strip("-")

    def _utcnow(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _bootstrap_engine_state(self) -> None:
        row = self.conn.execute("SELECT COUNT(*) AS row_count FROM engine_state").fetchone()
        if int(row["row_count"]) == 0:
            self.conn.execute(
                """
                INSERT INTO engine_state (
                    singleton_id,
                    turn_number,
                    cash_balance,
                    config_json,
                    created_at,
                    updated_at
                ) VALUES (1, 0, ?, ?, ?, ?)
                """,
                (
                    self.initial_capital,
                    json.dumps(
                        {
                            "turn_granularity": self.turn_granularity,
                            "horizon_turns": self.horizon_turns,
                            "monthly_profit_floor": self.monthly_profit_floor,
                            "reserve_allocation_pct": self.reserve_allocation_pct,
                            "improvement_allocation_pct": self.improvement_allocation_pct,
                            "exploration_allocation_pct": self.exploration_allocation_pct,
                            "pareto_top_asset_pct": self.pareto_top_asset_pct,
                            "pareto_capital_pct": self.pareto_capital_pct,
                        },
                        sort_keys=True,
                    ),
                    self._utcnow(),
                    self._utcnow(),
                ),
            )
            self.conn.commit()

    def _get_engine_state(self) -> Dict[str, Any]:
        row = self.conn.execute(
            """
            SELECT turn_number, cash_balance, config_json
            FROM engine_state
            WHERE singleton_id = 1
            """
        ).fetchone()
        if row is None:
            raise RuntimeError("Engine state is missing")
        return {
            "turn_number": int(row["turn_number"]),
            "cash_balance": float(row["cash_balance"]),
            "config_json": row["config_json"],
        }

    def _save_engine_state(self, turn_number: int, cash_balance: float) -> None:
        self.conn.execute(
            """
            UPDATE engine_state
            SET turn_number = ?, cash_balance = ?, updated_at = ?
            WHERE singleton_id = 1
            """,
            (int(turn_number), float(cash_balance), self._utcnow()),
        )
        self.conn.commit()

    def _setup_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS engine_state (
                singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
                turn_number INTEGER NOT NULL,
                cash_balance REAL NOT NULL,
                config_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS assets (
                asset_id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                campaign TEXT NOT NULL,
                article_template TEXT NOT NULL,
                cluster_id TEXT NOT NULL,
                status TEXT NOT NULL,
                is_proven INTEGER NOT NULL DEFAULT 0,
                base_expected_profit_per_dollar REAL NOT NULL,
                scalability_ceiling REAL NOT NULL,
                ltv REAL NOT NULL,
                creative_fatigue_score REAL NOT NULL,
                volatility REAL NOT NULL,
                synergy_score REAL NOT NULL,
                metadata_json TEXT NOT NULL,
                created_turn INTEGER NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS asset_turn_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                turn_number INTEGER NOT NULL,
                asset_id TEXT NOT NULL,
                spend REAL NOT NULL,
                impressions REAL NOT NULL,
                clicks REAL NOT NULL,
                revenue REAL NOT NULL,
                net_profit REAL NOT NULL,
                net_profit_per_dollar REAL NOT NULL,
                roi REAL NOT NULL,
                margin REAL NOT NULL,
                ltv REAL NOT NULL,
                creative_fatigue_score REAL NOT NULL,
                scalability_ceiling REAL NOT NULL,
                predicted_profit_per_dollar REAL,
                confidence_score REAL,
                variance_to_prediction REAL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (asset_id) REFERENCES assets (asset_id)
            );

            CREATE TABLE IF NOT EXISTS cluster_turn_metrics (
                turn_number INTEGER NOT NULL,
                cluster_id TEXT NOT NULL,
                asset_count INTEGER NOT NULL,
                projected_profit_per_dollar REAL NOT NULL,
                confidence_score REAL NOT NULL,
                cluster_bonus REAL NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (turn_number, cluster_id)
            );

            CREATE TABLE IF NOT EXISTS asset_correlations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                turn_number INTEGER NOT NULL,
                cluster_id TEXT NOT NULL,
                asset_id_a TEXT NOT NULL,
                asset_id_b TEXT NOT NULL,
                profit_correlation REAL NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS external_signals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                turn_number INTEGER NOT NULL,
                source TEXT NOT NULL,
                cpc_trend REAL NOT NULL,
                widget_rpm_change REAL NOT NULL,
                competitor_activity REAL NOT NULL,
                policy_alert_level REAL NOT NULL,
                notes TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS improvement_projects (
                project_id TEXT PRIMARY KEY,
                turn_number INTEGER NOT NULL,
                name TEXT NOT NULL,
                spend REAL NOT NULL,
                target_clusters_json TEXT NOT NULL,
                expected_lift_pct REAL NOT NULL,
                notes TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS decision_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                turn_number INTEGER NOT NULL,
                asset_id TEXT,
                cluster_id TEXT,
                allocation_bucket TEXT NOT NULL,
                allocated_dollars REAL NOT NULL,
                reason TEXT NOT NULL,
                confidence_score REAL NOT NULL,
                projected_net_profit REAL NOT NULL,
                projected_profit_per_dollar REAL NOT NULL,
                monthly_profit_target_met INTEGER NOT NULL,
                rejected INTEGER NOT NULL,
                actual_net_profit REAL,
                variance REAL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS turn_logs (
                turn_number INTEGER PRIMARY KEY,
                turn_granularity TEXT NOT NULL,
                current_revenue REAL NOT NULL,
                external_infusion REAL NOT NULL,
                available_capital REAL NOT NULL,
                allocated_capital REAL NOT NULL,
                reserve_budget REAL NOT NULL,
                improvement_budget REAL NOT NULL,
                exploration_budget REAL NOT NULL,
                projected_turn_net_profit REAL NOT NULL,
                projected_monthly_net_profit REAL NOT NULL,
                projected_capital_at_horizon REAL NOT NULL,
                projected_net_profit_at_horizon REAL NOT NULL,
                turns_remaining INTEGER NOT NULL,
                monthly_profit_floor REAL NOT NULL,
                monthly_profit_target_met INTEGER NOT NULL,
                approved INTEGER NOT NULL,
                summary_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        self.conn.commit()


def main() -> None:
    """
    Demonstrates the engine with plausible example traffic assets and five
    simulated turns. The demo uses a dedicated SQLite file so it is safe to run
    repeatedly.
    """

    demo_db_path = os.path.join(os.path.dirname(__file__), "capital_allocation_demo.sqlite")

    example_assets = [
        {
            "source": "Facebook",
            "campaign": "Facebook-Arb",
            "article_template": "Finance-Comparisons",
            "cluster_id": "cluster-finance-meta",
            "base_expected_profit_per_dollar": 0.24,
            "scalability_ceiling": 26_000,
            "is_proven": True,
            "ltv": 1.18,
            "creative_fatigue_score": 0.20,
            "volatility": 0.05,
            "synergy_score": 0.16,
            "metadata": {"buyer": "alpha", "vertical": "finance"},
        },
        {
            "source": "Facebook",
            "campaign": "Facebook-HomeQuotes",
            "article_template": "Home-Services",
            "cluster_id": "cluster-home-meta",
            "base_expected_profit_per_dollar": 0.20,
            "scalability_ceiling": 18_000,
            "is_proven": True,
            "ltv": 1.12,
            "creative_fatigue_score": 0.24,
            "volatility": 0.06,
            "synergy_score": 0.14,
            "metadata": {"buyer": "beta", "vertical": "home services"},
        },
        {
            "source": "NewsBreak",
            "campaign": "NewsBreak-Viral",
            "article_template": "Local-Deals",
            "cluster_id": "cluster-local-news",
            "base_expected_profit_per_dollar": 0.18,
            "scalability_ceiling": 14_000,
            "is_proven": True,
            "ltv": 1.09,
            "creative_fatigue_score": 0.19,
            "volatility": 0.07,
            "synergy_score": 0.12,
            "metadata": {"buyer": "gamma", "vertical": "local"},
        },
        {
            "source": "Taboola",
            "campaign": "Taboola-Health",
            "article_template": "Health-Explainers",
            "cluster_id": "cluster-health-native",
            "base_expected_profit_per_dollar": 0.17,
            "scalability_ceiling": 16_000,
            "is_proven": True,
            "ltv": 1.10,
            "creative_fatigue_score": 0.27,
            "volatility": 0.07,
            "synergy_score": 0.13,
            "metadata": {"buyer": "delta", "vertical": "health"},
        },
        {
            "source": "NewsBreak",
            "campaign": "NewsBreak-InsuranceTest",
            "article_template": "Insurance-Eligibility",
            "cluster_id": "cluster-finance-meta",
            "base_expected_profit_per_dollar": 0.13,
            "scalability_ceiling": 8_500,
            "is_proven": False,
            "ltv": 1.05,
            "creative_fatigue_score": 0.14,
            "volatility": 0.10,
            "synergy_score": 0.10,
            "metadata": {"buyer": "explore-1", "vertical": "insurance"},
        },
        {
            "source": "Taboola",
            "campaign": "Taboola-RetirementTest",
            "article_template": "Retirement-Tools",
            "cluster_id": "cluster-finance-meta",
            "base_expected_profit_per_dollar": 0.11,
            "scalability_ceiling": 7_000,
            "is_proven": False,
            "ltv": 1.04,
            "creative_fatigue_score": 0.12,
            "volatility": 0.11,
            "synergy_score": 0.09,
            "metadata": {"buyer": "explore-2", "vertical": "retirement"},
        },
    ]

    engine = CapitalAllocationEngine(
        db_path=demo_db_path,
        turn_granularity="daily",
        horizon_turns=90,
        monthly_profit_floor=100_000,
        initial_capital=80_000,
        reserve_allocation_pct=0.05,
        improvement_allocation_pct=0.05,
        exploration_allocation_pct=0.10,
        pareto_top_asset_pct=0.20,
        pareto_capital_pct=0.80,
        initial_assets=example_assets,
        reset_db=True,
        random_seed=11,
    )

    revenue_to_realize_next_turn = 0.0
    per_source_cpc = {
        "Facebook": 0.78,
        "NewsBreak": 0.46,
        "Taboola": 0.55,
    }
    per_source_ctr = {
        "Facebook": 0.018,
        "NewsBreak": 0.024,
        "Taboola": 0.021,
    }

    print("\nCapital Allocation Engine Demo\n")
    for _ in range(5):
        allocation, _ = engine.advance_turn(current_revenue=revenue_to_realize_next_turn, external_infusion=0.0)
        print(f"Turn {allocation['turn_number']}")
        print(f"  Capital pool: ${allocation['capital_pool']:,.2f}")
        print(f"  Winner budget: ${allocation['winner_budget']:,.2f}")
        print(f"  Exploration budget: ${allocation['exploration_budget']:,.2f}")
        print(f"  Improvement budget: ${allocation['improvement_budget']:,.2f}")
        print(f"  Reserve budget: ${allocation['reserve_budget']:,.2f}")
        print(f"  Projected monthly net profit: ${allocation['projected_monthly_net_profit']:,.2f}")
        print(f"  Monthly profit floor met: {allocation['monthly_profit_target_met']}")
        print(f"  Turns remaining: {allocation['turns_remaining']}")
        print(f"  Projected net profit at horizon: ${allocation['projected_net_profit_at_horizon']:,.2f}")

        realized_turn_revenue = 0.0
        for item in allocation["winner_allocations"] + allocation["exploration_allocations"]:
            spend = float(item["allocated_spend"])
            projected_ppd = float(item["projected_profit_per_dollar"])
            source = item["source"]

            # Realized edge is noisy but centered around the forecast, with
            # slightly wider dispersion for exploration cells.
            bucket_noise = 0.03 if item["bucket"] == "winner" else 0.05
            realized_ppd = float(np.clip(engine.rng.normal(projected_ppd, bucket_noise), -0.12, 0.45))
            cpc = per_source_cpc[source] * float(np.clip(engine.rng.normal(1.0, 0.05), 0.90, 1.12))
            clicks = max(spend / max(cpc, 0.05), 1.0)
            ctr = per_source_ctr[source] * float(np.clip(engine.rng.normal(1.0, 0.08), 0.85, 1.18))
            impressions = max(clicks / max(ctr, 0.005), clicks)
            revenue = spend * (1 + realized_ppd)
            realized_turn_revenue += revenue

            fatigue = min(0.95, item["creative_fatigue_score"] + (spend / max(item["scalability_ceiling"], 1.0)) * 0.05)
            ceiling = item["scalability_ceiling"] * float(np.clip(engine.rng.normal(1.01, 0.03), 0.95, 1.08))
            ltv = float(np.clip(engine.rng.normal(1.08, 0.04), 0.95, 1.25))

            engine.record_performance(
                asset_id=item["asset_id"],
                metrics={
                    "spend": spend,
                    "impressions": impressions,
                    "clicks": clicks,
                    "revenue": revenue,
                    "ltv": ltv,
                    "creative_fatigue_score": fatigue,
                    "scalability_ceiling": ceiling,
                },
                predicted_profit_per_dollar=projected_ppd,
                confidence_score=item["confidence_score"],
            )

        revenue_to_realize_next_turn = realized_turn_revenue
        print(f"  Realized turn revenue queued into next turn: ${revenue_to_realize_next_turn:,.2f}\n")

    # Demonstrate the capacity-expansion helpers before the longer horizon run.
    engine.scale_asset(
        "facebook-facebook-arb-finance-comparisons",
        scale_multiplier=1.40,
        efficiency_lift_pct=0.03,
        reason="Expand the top Meta finance winner before the 90-turn projection.",
    )
    engine.scale_asset(
        "facebook-facebook-homequotes-home-services",
        scale_multiplier=1.25,
        efficiency_lift_pct=0.02,
        reason="Open more volume on the second-best Meta cluster before horizon simulation.",
    )
    engine.add_asset(
        source="SmartNews",
        campaign="SmartNews-Scale",
        article_template="Finance-Comparisons-Clone",
        cluster_id="cluster-finance-meta",
        base_expected_profit_per_dollar=0.19,
        scalability_ceiling=18_000,
        is_proven=True,
        ltv=1.11,
        creative_fatigue_score=0.10,
        volatility=0.06,
        synergy_score=0.15,
        metadata={"buyer": "epsilon", "vertical": "finance", "purpose": "horizon expansion"},
    )
    print("Capacity expansion actions applied before horizon simulation")
    print("  Scaled: Facebook-Arb, Facebook-HomeQuotes")
    print("  Added: SmartNews-Scale\n")

    horizon_projection = engine.simulate_horizon(90)
    print("Final 90-turn projection")
    print(f"  Profit floor sustained: {horizon_projection['floor_respected']}")
    print(f"  Projected capital at horizon: ${horizon_projection['projected_capital_at_horizon']:,.2f}")
    print(f"  Projected monthly net profit at horizon: ${horizon_projection['projected_net_profit_at_horizon']:,.2f}")


if __name__ == "__main__":
    main()
