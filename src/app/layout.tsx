import type { Metadata, Viewport } from "next";
import "@fontsource/archivo/latin-400.css";
import "@fontsource/archivo/latin-500.css";
import "@fontsource/archivo/latin-600.css";
import "@fontsource/archivo/latin-700.css";
import "@fontsource/archivo/latin-800.css";
import "@fontsource/archivo/latin-900.css";
import "@fontsource/archivo/latin-400-italic.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Burnout Wheels — Die-Cast Pit Lane for F1 Collectibles",
    template: "%s — Burnout Wheels",
  },
  description:
    "F1 Formula 1 die-cast and collectible racing metal, catalogued like telemetry and shipped from the pit lane. Authentic, inspected, and reserved the second you order.",
  keywords: ["diecast", "f1 diecast", "formula 1 model car", "red bull rb20", "collector diecast", "burnout wheels"],
  openGraph: {
    siteName: "Burnout Wheels",
    type: "website",
    locale: "en_IN",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="u-grain min-h-dvh">{children}</body>
    </html>
  );
}
