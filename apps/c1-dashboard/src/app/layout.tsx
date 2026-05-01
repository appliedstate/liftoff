import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "C1 Chat",
  description: "Generative UI App powered by Thesys C1",
};

// Mobile browsers default to a 980px virtual viewport without this — the
// page renders at desktop width and gets scaled down, so our responsive
// breakpoints never kick in. Setting width=device-width tells the browser
// to use the real device width.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body className={`${inter.className} overflow-x-hidden antialiased`}>{children}</body>
    </html>
  );
}
