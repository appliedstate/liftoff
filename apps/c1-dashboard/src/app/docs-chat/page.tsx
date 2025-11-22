"use client";

import { C1Chat } from "@thesysai/genui-sdk";
import "@crayonai/react-ui/styles/index.css";

/**
 * Repo Docs Chat Page
 *
 * C1Chat interface backed by backend /api/docs/qa RAG over the Liftoff docs.
 */
export default function DocsChatPage() {
  return (
    <div className="h-screen w-screen">
      <C1Chat apiUrl="/api/docs-chat" theme={{ mode: "dark" }} />
    </div>
  );
}




