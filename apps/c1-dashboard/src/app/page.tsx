"use client";

import dynamic from "next/dynamic";

// Render the home navigation page
const HomePage = dynamic(() => import("./home/page"), {
  ssr: false,
});

export default function Home() {
  return <HomePage />;
}


