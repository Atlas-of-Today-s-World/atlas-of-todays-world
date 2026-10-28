/**
 * The networks the site has an icon for, recognised by the profile's address
 * (Admin → Site settings keeps only the label, the address and a badge text).
 * A network without an icon shows its badge text instead (SocialLinks).
 */
export type Network = "instagram" | "linkedin" | "facebook" | "bluesky";

const DOMAINS: Record<string, Network> = {
  "instagram.com": "instagram",
  "linkedin.com": "linkedin",
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "bsky.app": "bluesky",
};

export function socialNetwork(href: string): Network | null {
  let host: string;
  try {
    host = new URL(href).hostname;
  } catch {
    return null;
  }
  const match = Object.entries(DOMAINS).find(([d]) => host === d || host.endsWith(`.${d}`));
  return match ? match[1] : null;
}

/** Each network's own colour (the mobile menu's round buttons; white glyph on top). */
export const NETWORK_BG: Record<Network, string> = {
  instagram: "bg-[#E4405F]",
  linkedin: "bg-[#0A66C2]",
  facebook: "bg-[#1877F2]",
  bluesky: "bg-[#1185FE]",
};

/** The network's logo in one colour (currentColor), drawn on a 24 px grid. */
export function SocialIcon({ network, className }: { network: Network; className?: string }) {
  const svg = { viewBox: "0 0 24 24", "aria-hidden": true, focusable: false, className } as const;
  switch (network) {
    case "instagram":
      return (
        <svg {...svg} fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
          <circle cx="12" cy="12" r="4.25" />
          <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...svg} fill="currentColor">
          <circle cx="4.5" cy="4.5" r="2.25" />
          <rect x="2.5" y="8.5" width="4" height="13" />
          <path d="M16.25 8.25A5.75 5.75 0 0 1 22 14v7.5h-4V14.5a2.25 2.25 0 0 0-4.5 0v7h-4v-13h4v1.6a5.2 5.2 0 0 1 2.75-1.85z" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...svg} fill="currentColor">
          <path d="M13.5 22v-8.25h2.8l.45-3.5H13.5V8.1c0-1 .3-1.7 1.75-1.7h1.65V3.3A22 22 0 0 0 14.5 3.2c-2.4 0-4.05 1.45-4.05 4.15v2.9H7.75v3.5h2.7V22z" />
        </svg>
      );
    case "bluesky":
      return (
        <svg {...svg} fill="currentColor">
          <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" />
        </svg>
      );
  }
}
