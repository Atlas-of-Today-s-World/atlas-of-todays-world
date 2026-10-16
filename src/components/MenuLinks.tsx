import Link from "@/components/i18n/Link";
import type { NavLink } from "@/features/navigation/model";
import type { SocialLink } from "@/features/site/model";
import { cn } from "@/lib/cn";

/**
 * One menu item (header, mobile menu and the footer of pages without the
 * globe). A path on this site goes through the i18n `Link`; an https://
 * address opens in a new tab. The current page gets `aria-current` (no visual change).
 * Prefetched on intent (hover, focus, touch), not when shown: the menu is on
 * every page and its items lead into other layouts (full-width pages, the pages
 * without the globe, membership), each with scripts of its own — prefetching
 * them all on every page view cost every reader tens of kB they mostly never use.
 */
export function MenuLink({
  item,
  active = false,
  className,
}: {
  item: NavLink;
  active?: boolean;
  className: string;
}) {
  return (
    <Link
      href={item.href}
      prefetchOnIntent={!item.external}
      className={className}
      aria-current={active ? "page" : undefined}
      {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {item.label}
    </Link>
  );
}

/**
 * Social network links as round badges: white with dark letters, so they stand
 * out on the photo behind the home header as well as on the dark bar.
 */
export function SocialLinks({
  socials,
  className,
}: {
  socials: readonly SocialLink[];
  className: string;
}) {
  return socials.map((social) => (
    <a
      key={social.href}
      href={social.href}
      target="_blank"
      rel="noreferrer"
      aria-label={social.label}
      className={cn(
        "grid place-items-center rounded-full bg-white font-bold text-[var(--color-ink)] shadow-sm transition hover:bg-[var(--color-accent)] hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
        className,
      )}
    >
      {social.icon}
    </a>
  ));
}
