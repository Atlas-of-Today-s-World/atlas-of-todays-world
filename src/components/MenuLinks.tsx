import Link from "@/components/i18n/Link";
import type { NavLink } from "@/features/navigation/model";
import type { SocialLink } from "@/features/site/model";
import { cn } from "@/lib/cn";
import { SocialIcon, socialNetwork } from "./SocialIcon";

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
 * Social network links as round buttons with the network's logo (SocialIcon);
 * a network without a logo shows its badge text from the admin. White logos on
 * a faint circle: small in the header's "Follow us" group, large (`size="lg"`)
 * in the mobile menu.
 */
export function SocialLinks({
  socials,
  size = "sm",
}: {
  socials: readonly SocialLink[];
  size?: "sm" | "lg";
}) {
  return socials.map((social) => {
    const network = socialNetwork(social.href);
    return (
      <a
        key={social.href}
        href={social.href}
        target="_blank"
        rel="noreferrer"
        aria-label={social.label}
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-white/12 font-bold text-white transition hover:bg-white hover:text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
          size === "sm" ? "size-8 text-[11px]" : "size-12 text-[13px]",
        )}
      >
        {network ? (
          <SocialIcon network={network} className={size === "sm" ? "size-4" : "size-6"} />
        ) : (
          social.icon
        )}
      </a>
    );
  });
}

/**
 * The header's social links as one labelled group ("Follow us" and the logos),
 * on a pill of its own so it reads apart from the menu items. The label hides
 * below `xl`, where the header has less room; the group keeps its name.
 */
export function FollowUs({
  socials,
  label,
  className,
}: {
  socials: readonly SocialLink[];
  label: string;
  className?: string;
}) {
  if (socials.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex items-center gap-1 rounded-full p-1 xl:pl-3", className)}
    >
      <span aria-hidden className="mr-1 text-[12px] whitespace-nowrap text-white/80 max-xl:hidden">
        {label}
      </span>
      <SocialLinks socials={socials} />
    </div>
  );
}
