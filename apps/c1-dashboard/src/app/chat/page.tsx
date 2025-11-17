"use client";

import { C1Chat } from "@thesysai/genui-sdk";
import "@crayonai/react-ui/styles/index.css";

/**
 * Basic C1Chat page wired to the working /api/chat route.
 *
 * This is used as a reference to validate the C1Chat SDK integration
 * and the expected streaming format.
 */
export default function ChatPage() {
  return (
    <div className="h-screen w-screen">
      <C1Chat apiUrl="/api/chat" theme={{ mode: "dark" }} />
    </div>
  );
}


