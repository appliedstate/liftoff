import { runSerpMetricsQuery, runSerpQuerySpec, S1QuerySpec } from "../routes/s1";
import { serpVectorSearch } from "../scripts/vector/search_serp";

/**
 * Tool: total revenue for a keyword across all rows.
 */
export async function toolKeywordTotalRevenue(keyword: string) {
  const { runDate, rows } = await runSerpMetricsQuery({
    mode: "total_revenue",
    keyword,
  });

  const total = rows?.[0]?.total_revenue ?? 0;
  return {
    type: "keyword_total",
    keyword,
    runDate,
    totalRevenue: Number(total) || 0,
  };
}

/**
 * Tool: top slugs by revenue (with RPC/RPS from the enhanced query).
 */
export async function toolTopSlugs(limit = 100) {
  const { runDate, rows } = await runSerpMetricsQuery({
    mode: "top_slugs",
    limit,
  });

  return {
    type: "top_slugs",
    runDate,
    limit,
    rows,
  };
}

/**
 * Tool: top keywords for a given slug by revenue (with RPC/RPS).
 */
export async function toolKeywordsForSlug(slug: string, limit = 50) {
  const { runDate, rows } = await runSerpMetricsQuery({
    mode: "keywords_for_slug",
    keyword: slug,
    limit,
  });

  return {
    type: "keywords_for_slug",
    slug,
    runDate,
    limit,
    rows,
  };
}

/**
 * Tool: generic SERP vector search.
 */
export async function toolSerpSearch(query: string, limit = 50) {
  const searchResult = await serpVectorSearch({
    query,
    limit,
  });

  return {
    type: "qa_search",
    ...searchResult,
  };
}

/**
 * Tool: generic S1QuerySpec runner.
 *
 * This exposes a constrained analytics surface to the agent so it can
 * ask many different questions without inventing SQL or schema.
 */
export async function toolRunQuerySpec(spec: S1QuerySpec) {
  const { runDate, spec: effectiveSpec, rows } = await runSerpQuerySpec(spec);

  return {
    type: "query_spec",
    runDate,
    spec: effectiveSpec,
    rows,
  };
}


