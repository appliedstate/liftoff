import dynamic from "next/dynamic";

// Render the C1 chat only on the client to avoid hydration mismatches
const S1SerpChat = dynamic(() => import("./s1-serp-chat/page"), {
  ssr: false,
});

export default function Home() {
  return <S1SerpChat />;
}

