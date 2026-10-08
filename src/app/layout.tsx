import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { PrePaintScript } from "@/components/PrePaintScript";
import { serverEnv } from "@/lib/env.server";
import { DEFAULT_OG_IMAGE, TITLE_SUFFIX } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/site";

// Only the basic Latin files are preloaded; accented letters (latin-ext) still
// load on demand through the @font-face unicode-range rules Next writes.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Atlas of Today's World — interactive atlas of every country",
    template: `%s${TITLE_SUFFIX}`,
  },
  description:
    "Explore every country and world region on an interactive satellite globe: political systems, living conditions, human development and the stories behind them.",
  applicationName: "Atlas of Today's World",
  authors: [{ name: "Atlas of Today's World" }],
  publisher: "Atlas of Today's World",
  // The website was built by Develogi.cz s.r.o. (https://develogi.cz) — also in /humans.txt.
  creator: "Develogi.cz s.r.o. (https://develogi.cz)",
  category: "reference",
  // Pages set their own URL, locale and image (lib/seo/metadata.ts); this is the fallback.
  openGraph: {
    type: "website",
    siteName: "Atlas of Today's World",
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
  verification: {
    google: serverEnv.GOOGLE_SITE_VERIFICATION,
    other: {
      ...(serverEnv.BING_SITE_VERIFICATION
        ? { "msvalidate.01": serverEnv.BING_SITE_VERIFICATION }
        : {}),
      ...(serverEnv.SEZNAM_SITE_VERIFICATION
        ? { "seznam-wmt": serverEnv.SEZNAM_SITE_VERIFICATION }
        : {}),
    },
  },
  robots: {
    index: true,
    follow: true,
    // No preview limits for every engine (Bing feeds Copilot/ChatGPT): long snippets
    // and large images are what make a page quotable in AI answers.
    "max-snippet": -1,
    "max-image-preview": "large",
    "max-video-preview": -1,
    googleBot: {
      index: true,
      follow: true,
      // No preview limits – the atlas lives on images and long snippets.
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a1020",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: PrePaintScript may add an attribute before React hydrates.
    <html lang="en" className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body
        style={
          {
            "--font-sans": "var(--font-inter)",
            "--font-display": "var(--font-manrope)",
          } as React.CSSProperties
        }
      >
        <PrePaintScript />
        {/* Keyboard and screen readers: straight to content, past the menu and map controls (WCAG 2.4.1). */}
        <a
          href="#content"
          className="sr-only z-[100] rounded-full bg-white px-5 py-3 text-[14px] font-medium text-[#0d1324] focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        {children}
        {/* Analytics without cookies or personal data (F3); Vercel only. */}
        <Analytics />
      </body>
    </html>
  );
}
