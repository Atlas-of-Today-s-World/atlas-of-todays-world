"use client";

import { LogIn, LogOut, Settings, UserRound } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { routes } from "@/config/routes";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/cn";
import type { MeResponse } from "@/app/api/me/route";

const ITEM =
  "flex min-h-(--touch-min) w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13.5px] text-[var(--color-ink)] transition hover:bg-[var(--color-surface-hover)] focus-visible:bg-[var(--color-surface-hover)] focus-visible:outline-none";

/**
 * The account icon in the header with a small menu: signed in — who you are,
 * your account, the administration (team only) and sign out; signed out —
 * sign in. The same on the home map and on the dark bar. Who is signed in is
 * asked from /api/me only when the menu first opens, so public pages stay
 * static and no reader is checked on every visit.
 */
export function AccountMenu({ className }: { className?: string }) {
  const t = useMessages().header;
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    if (!me) {
      apiFetch<MeResponse>("/api/me", { cache: "no-store" })
        .then((data) => setMe(data))
        .catch(() => setMe({ signedIn: false }));
    }
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !root.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open, me]);

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t.account}
        title={t.accountTitle}
        className="grid size-(--touch-min) place-items-center rounded-full text-current transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
      >
        <UserRound size={17} strokeWidth={1.6} aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          className="z-dropdown absolute top-full right-0 mt-2 w-64 rounded-xl bg-white p-1.5 text-left shadow-2xl ring-1 shadow-black/30 ring-black/5 [text-shadow:none]"
        >
          {!me ? (
            <p className="px-3 py-2.5 text-[13px] text-[var(--color-ink-muted)]">
              {t.accountLoading}
            </p>
          ) : me.signedIn ? (
            <>
              <p className="border-b border-[var(--color-line)] px-3 pt-2 pb-2.5 text-[12px] text-[var(--color-ink-muted)]">
                {t.accountSignedInAs}
                <span className="block truncate text-[13.5px] font-medium text-[var(--color-ink)]">
                  {me.name ?? me.email}
                </span>
                {me.name && me.email ? <span className="block truncate">{me.email}</span> : null}
              </p>
              <Link
                href={routes.account}
                className={cn(ITEM, "mt-1")}
                onClick={() => setOpen(false)}
              >
                <UserRound aria-hidden className="size-4" />
                {t.accountPage}
              </Link>
              {me.staff ? (
                // The administration is unlocalized and checks rights itself.
                <a href={routes.admin} className={ITEM}>
                  <Settings aria-hidden className="size-4" />
                  {t.accountAdmin}
                </a>
              ) : null}
              {/* Sign-out only by POST from our own page (route checks the origin). */}
              <form action="/auth/signout" method="post">
                <button type="submit" className={ITEM}>
                  <LogOut aria-hidden className="size-4" />
                  {t.accountSignOut}
                </button>
              </form>
            </>
          ) : (
            <Link href={routes.login} className={ITEM} onClick={() => setOpen(false)}>
              <LogIn aria-hidden className="size-4" />
              {t.accountSignIn}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
