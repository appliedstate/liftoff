"use client";

import { C1Chat } from "@thesysai/genui-sdk";
import "@crayonai/react-ui/styles/index.css";

/**
 * Generative Analytics Chat Page
 * 
 * Provides conversational analytics interface using C1 by Thesys.
 * Generates dynamic UI components (charts, tables) based on user queries.
 */
export default function AnalyticsPage() {
  return (
    <div className="h-screen w-screen">
      <C1Chat
        apiUrl="/api/analytics-chat"
        theme={{ mode: "dark" }}
      />
    </div>
  );
}



