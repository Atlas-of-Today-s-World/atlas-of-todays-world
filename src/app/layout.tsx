import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://atlasoftodaysworld.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Atlas of Today's World — an interactive encyclopedia on a 3D globe",
    template: "%s — Atlas of Today's World",
  },
  description:
    "Explore every country and world region on an interactive satellite globe: political systems, living conditions, human development and the stories behind them.",
  openGraph: {
    type: "website",
    siteName: "Atlas of Today's World",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body
        style={
          {
            "--font-sans": "var(--font-inter)",
            "--font-display": "var(--font-manrope)",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
