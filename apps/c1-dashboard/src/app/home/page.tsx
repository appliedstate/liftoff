"use client";

import Link from "next/link";

/**
 * Home Navigation Page
 * 
 * Provides links to different chat interfaces
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Liftoff Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/analytics"
            className="block p-6 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <h2 className="text-2xl font-semibold mb-2">📊 Generative Analytics</h2>
            <p className="text-gray-300">
              Conversational analytics with dynamic charts and tables. Ask questions in natural language
              and get instant visualizations of campaign performance, trends, and insights.
            </p>
          </Link>

          <Link
            href="/s1-serp-chat"
            className="block p-6 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <h2 className="text-2xl font-semibold mb-2">🔍 S1 SERP Chat</h2>
            <p className="text-gray-300">
              Chat interface for System1 SERP data queries and analysis.
            </p>
          </Link>

          <Link
            href="/docs-chat"
            className="block p-6 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <h2 className="text-2xl font-semibold mb-2">📚 Repo Docs Copilot</h2>
            <p className="text-gray-300">
              Ask questions about BOS, PRDs, infra, and other documentation. Answers are grounded in the latest embedded markdown files.
            </p>
          </Link>
        </div>

        <div className="mt-8 p-6 bg-gray-800 rounded-lg">
          <h3 className="text-xl font-semibold mb-4">Example Analytics Queries</h3>
          <ul className="space-y-2 text-gray-300">
            <li>• "Show me yesterday's performance"</li>
            <li>• "Quarterly revenue trends for last year"</li>
            <li>• "Split revenue by owner"</li>
            <li>• "Compare ROAS between ASC and LAL_1 lanes"</li>
            <li>• "What campaigns should I scale?"</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

