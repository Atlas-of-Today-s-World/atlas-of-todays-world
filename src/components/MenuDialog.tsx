"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import type { Navigation } from "@/features/navigation/model";
import type { SocialLink } from "@/features/site/model";
import { useFocusTrap } from "@/lib/use-focus-trap";
import NewsletterForm from "@/features/newsletter/components/NewsletterForm";
import { AccountMenu } from "./AccountMenu";
import { BrandLogo } from "./atlas/BrandLogo";
import { useMessages } from "./i18n/LocaleProvider";
import { MenuLink, SocialLinks } from "./MenuLinks";

/**
 * The full-screen menu on narrow screens (both header looks). Header loads it
 * on demand (next/dynamic): it carries the newsletter form with Turnstile,
 * which no page needs before the hamburger is pressed. Mounted only while
 * open, so the focus trap is active for its whole life and gives the focus
 * back (to the hamburger) when it closes.
 */
export default function MenuDialog({
  nav,
  active,
  newsletter,
  captcha,
  socials,
  onClose,
}: {
  nav: Navigation;
  /** Id of the current page's item, if any. */
  active: string | null;
  newsletter: boolean;
  captcha: boolean;
  socials: readonly SocialLink[];
  onClose: () => void;
}) {
  const t = useMessages();
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog, true);
  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={t.header.menu}
      className="z-overlay pointer-events-auto fixed inset-0 flex flex-col overflow-y-auto overscroll-contain bg-[#0b101f]/97 px-6 py-5 text-white backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <BrandLogo tone="light" className="h-5" />
        <button
          type="button"
          onClick={onClose}
          aria-label={t.header.closeMenu}
          className="grid size-(--touch-min) place-items-center rounded-full border border-white/25 text-white transition hover:border-white/70"
        >
          <X size={18} strokeWidth={1.8} aria-hidden />
        </button>
      </div>

      <nav aria-label={t.header.main} className="mt-10 grid gap-1 text-[22px]">
        {nav.main.map((item) => (
          <MenuLink
            key={item.id}
            item={item}
            active={item.id === active}
            className="font-display flex min-h-14 items-center font-bold"
          />
        ))}
      </nav>

      {/* Right under the menu, in the networks' colours: seen without scrolling. */}
      {socials.length > 0 ? (
        <div role="group" aria-labelledby="menu-follow" className="mt-6">
          <p id="menu-follow" className="text-[12.5px] text-white/60">
            {t.header.followUs}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <SocialLinks socials={socials} look="brand" />
          </div>
        </div>
      ) : null}

      <div className="mt-auto space-y-6 pt-8 pb-2">
        {newsletter ? <NewsletterForm captcha={captcha} /> : null}

        <nav aria-label={t.header.legal} className="flex gap-4 text-[12.5px] text-white/60">
          {nav.legal.map((item) => (
            <MenuLink
              key={item.id}
              item={item}
              active={item.id === active}
              className="flex min-h-(--touch-min) min-w-(--touch-min) items-center justify-center"
            />
          ))}
        </nav>

        <div className="flex justify-end">
          <AccountMenu look="menu" />
        </div>
      </div>
    </div>
  );
}
