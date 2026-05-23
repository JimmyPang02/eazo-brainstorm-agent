import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DM_Sans, Instrument_Serif, JetBrains_Mono, Noto_Serif_SC } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/utils/utils";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
  display: "swap",
});
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
const notoSerifSc = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-serif-sc",
  display: "swap",
});

// Public origin used to resolve relative URLs in OG / Twitter Card tags
// and `canonical`. Picks up Vercel's auto-injected hostname; on other
// hosts (or when using a custom domain whose OG should not show the
// `*.vercel.app` URL), point `metadataBase` at the canonical URL
// directly instead of relying on this.
const SITE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : undefined;

const SITE_TITLE = "Sprout Brainstorm Assistant";
const SITE_DESCRIPTION = "A tree-shaped brainstorming workspace for exploring and pruning ideas.";

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: {
    icon: "https://eazo.ai/favicon.ico",
  },
  // Social preview cards (Open Graph + Twitter). Most platforms (X,
  // Facebook, LinkedIn, Slack, Discord, WeChat, iMessage) read these
  // tags directly. For the preview image, drop a 1200×630 PNG/JPG at
  // `src/app/opengraph-image.png` — Next.js auto-detects file-based
  // metadata and overrides `openGraph.images` below at build time.
  openGraph: {
    type: "website",
    siteName: "Eazo",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

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
    <html
      lang="zh-CN"
      className={cn(
        "h-full antialiased font-sans",
        dmSans.variable,
        instrumentSerif.variable,
        jetBrainsMono.variable,
        notoSerifSc.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
