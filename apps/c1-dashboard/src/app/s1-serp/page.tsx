"use client";

import { useState } from "react";

type SerpRow = {
  serp_keyword: string;
  content_slug: string;
  region_code: string;
  est_net_revenue: number | null;
  sellside_searches: number | null;
  sellside_clicks_network: number | null;
  rpc: number | null;
  rps: number | null;
  cos: number;
  finalScore: number;
};

type QaResponse = {
  status: string;
  runDate: string;
  query: string;
  params: {
    regionCodes: string[] | null;
    minRevenue: number | null;
    limit: number;
  };
  answer: string;
  context: {
    rows: SerpRow[];
  };
};

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function S1SerpCopilotPage() {
  const [query, setQuery] = useState(
    "What are the top Juvederm slugs and which states look strongest?"
  );
  const [runDate, setRunDate] = useState("2025-11-11");
  const [regionCodes, setRegionCodes] = useState("");
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<QaResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const body: any = {
        query,
        runDate: runDate || undefined,
        limit,
      };

      const regions = regionCodes
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      if (regions.length) body.regionCodes = regions;

      const res = await fetch(`${BACKEND_BASE}/api/s1/serp/qa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Backend returned ${res.status} ${res.statusText}: ${text}`
        );
      }

      const json = (await res.json()) as QaResponse;
      setResponse(json);
    } catch (err: any) {
      setError(err?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const rows = response?.context?.rows || [];

  return (
    <main className="min-h-screen bg-black text-white p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">
          S1 SERP Copilot – Juvederm / Vertical Explorer
        </h1>
        <p className="text-sm text-gray-400 max-w-2xl">
          Ask questions about System1 SERP performance. The backend uses
          pgvector over <code>serp_keyword_slug_embeddings</code> to fetch
          relevant rows and an LLM to summarize opportunities.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 border border-gray-800 rounded-lg p-4 bg-gray-950"
      >
        <div className="space-y-1">
          <label className="block text-sm font-medium">Question</label>
          <textarea
            className="w-full min-h-[100px] rounded-md bg-black border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium">Run date</label>
            <input
              type="date"
              className="w-full rounded-md bg-black border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={runDate}
              onChange={(e) => setRunDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Regions (comma-separated, optional)
            </label>
            <input
              type="text"
              placeholder="CA, TX, FL"
              className="w-full rounded-md bg-black border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={regionCodes}
              onChange={(e) => setRegionCodes(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Result limit (table)
            </label>
            <input
              type="number"
              min={1}
              max={200}
              className="w-full rounded-md bg-black border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 50)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium"
        >
          {loading ? "Asking…" : "Ask S1 SERP Copilot"}
        </button>

        {error && (
          <p className="text-sm text-red-400 whitespace-pre-wrap">{error}</p>
        )}
      </form>

      {response && (
        <section className="space-y-4">
          <div className="border border-gray-800 rounded-lg p-4 bg-gray-950">
            <h2 className="text-lg font-semibold mb-2">Answer</h2>
            <p className="whitespace-pre-wrap text-sm text-gray-100">
              {response.answer}
            </p>
          </div>

          <div className="border border-gray-800 rounded-lg p-4 bg-gray-950">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Context rows</h2>
              <span className="text-xs text-gray-400">
                runDate={response.runDate} • rows={rows.length}
              </span>
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-gray-400">
                No rows returned for this question and filters.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-900">
                      <th className="border border-gray-800 px-2 py-1 text-left">
                        Region
                      </th>
                      <th className="border border-gray-800 px-2 py-1 text-left">
                        Keyword
                      </th>
                      <th className="border border-gray-800 px-2 py-1 text-left">
                        Slug
                      </th>
                      <th className="border border-gray-800 px-2 py-1 text-right">
                        Revenue
                      </th>
                      <th className="border border-gray-800 px-2 py-1 text-right">
                        Searches
                      </th>
                      <th className="border border-gray-800 px-2 py-1 text-right">
                        Clicks
                      </th>
                      <th className="border border-gray-800 px-2 py-1 text-right">
                        RPC
                      </th>
                      <th className="border border-gray-800 px-2 py-1 text-right">
                        RPS
                      </th>
                      <th className="border border-gray-800 px-2 py-1 text-right">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr
                        key={`${r.region_code}-${r.content_slug}-${idx}`}
                        className={idx % 2 === 0 ? "bg-black" : "bg-gray-950"}
                      >
                        <td className="border border-gray-800 px-2 py-1">
                          {r.region_code}
                        </td>
                        <td className="border border-gray-800 px-2 py-1 max-w-[220px] truncate">
                          {r.serp_keyword}
                        </td>
                        <td className="border border-gray-800 px-2 py-1 max-w-[260px] truncate">
                          {r.content_slug}
                        </td>
                        <td className="border border-gray-800 px-2 py-1 text-right">
                          {r.est_net_revenue?.toFixed(2) ?? "-"}
                        </td>
                        <td className="border border-gray-800 px-2 py-1 text-right">
                          {r.sellside_searches ?? "-"}
                        </td>
                        <td className="border border-gray-800 px-2 py-1 text-right">
                          {r.sellside_clicks_network?.toFixed(1) ?? "-"}
                        </td>
                        <td className="border border-gray-800 px-2 py-1 text-right">
                          {r.rpc?.toFixed(3) ?? "-"}
                        </td>
                        <td className="border border-gray-800 px-2 py-1 text-right">
                          {r.rps?.toFixed(3) ?? "-"}
                        </td>
                        <td className="border border-gray-800 px-2 py-1 text-right">
                          {r.finalScore.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}


