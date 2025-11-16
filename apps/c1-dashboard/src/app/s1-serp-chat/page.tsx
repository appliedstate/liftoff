"use client";

import { C1Chat } from "@thesysai/genui-sdk";
import "@crayonai/react-ui/styles/index.css";

export default function S1SerpChatPage() {
  return (
    <C1Chat
      apiUrl="/api/s1-serp-chat"
      theme={{ mode: "dark" }}
      placeholder="Ask about System1 SERP performance…"
    />
  );
}


