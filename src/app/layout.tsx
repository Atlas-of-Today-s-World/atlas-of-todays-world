import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { BUILDER } from "@/config/organization";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { PrePaintScript } from "@/components/PrePaintScript";
import { SKIP_LINK } from "@/config/layout";
import { THEME_COLORS } from "@/config/palette";
import { serverEnv } from "@/lib/env.server";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/request";
import { titleSuffix } from "@/features/site/model";
import { getSiteSettings } from "@/features/site/queries";
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

/**
 * Site-wide defaults. The brand, the default title and description and the
 * default preview image come from the site settings (Admin → Site settings);
 * getSiteSettings() falls back to the built-in values when they can't be read.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    ...STATIC_METADATA,
    title: {
      default: site.seoTitle,
      template: `%s${titleSuffix(site)}`,
    },
    description: site.seoDescription,
    applicationName: site.name,
    authors: [{ name: site.name }],
    publisher: site.name,
    // Pages set their own URL, locale and image (features/seo/metadata.ts); this is the fallback.
    openGraph: {
      type: "website",
      siteName: site.name,
      images: [{ url: site.ogImage, width: 1200, height: 630 }],
    },
  };
}

const STATIC_METADATA: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Who built the website (config/organization.ts BUILDER; also JSON-LD, llms.txt, humans.txt).
  creator: `${BUILDER.name} (${BUILDER.url})`,
  category: "reference",
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
  themeColor: THEME_COLORS.space,
  colorScheme: "dark",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const t = await getMessagesFor(DEFAULT_LOCALE);
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
        <a href="#content" className={SKIP_LINK}>
          {t.common.skipToContent}
        </a>
        {children}
        {/* Analytics without cookies or personal data (F3); Vercel only. */}
        <Analytics />
        {/* Real visitors' Core Web Vitals (LCP, INP, CLS), same origin and cookie-less
            like the analytics; collected once enabled in the Vercel dashboard. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
