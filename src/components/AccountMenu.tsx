"use client";

import { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import Link from "@/components/i18n/Link";
import { Popover, focusFirstMenuItem } from "@/components/ui/popover";
import { adminRoutes, apiRoutes, isAtOrUnder, routes } from "@/config/routes";
import { readMe, type Me } from "@/features/auth/types";
import { ApiError, apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/cn";
import { format, type Messages } from "@/lib/i18n/messages";
import { useMessages } from "./i18n/LocaleProvider";

/** Where the button sits: over the home globe, in the dark bar, in the mobile menu. */
type Look = "globe" | "bar" | "menu";

type State = { status: "loading" } | { status: "failed" } | { status: "ready"; me: Me };

const TRIGGER: Record<Look, string> = {
  globe:
    "grid min-h-(--touch-min) min-w-(--touch-min) place-items-center text-white/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] transition hover:text-white",
  bar: "grid size-(--touch-min) place-items-center rounded-full border border-white/25 text-white transition hover:border-white/60",
  menu: "flex min-h-(--touch-min) min-w-(--touch-min) items-center justify-center gap-2 text-[13px] whitespace-nowrap text-white/70 transition hover:text-white",
};

const ITEM =
  "flex min-h-(--touch-min) w-full items-center rounded-lg px-3 text-left text-[13.5px] text-[var(--color-ink)] transition hover:bg-[var(--color-line)]/50 focus-visible:bg-[var(--color-accent-soft)] focus-visible:outline-none";

/**
 * The person icon in the header: a menu that asks `/api/me` who is signed in
 * when it opens (the header is on static pages, so the server never reads the
 * session for it). Signed out: Sign in (back to this page afterwards). A team
 * member: e-mail and role, the administration, My account (admin), Sign out.
 * A reader: e-mail, Account settings (/account), Sign out. Sign-out is the
 * same POST form as before (the route checks the Origin).
 */
export function AccountMenu({ look }: { look: Look }) {
  const messages = useMessages();
  const t = messages.accountMenu;
  const [state, setState] = useState<State>({ status: "loading" });
  // The page to come back to after signing in, read when the menu opens.
  const [here, setHere] = useState<string>(routes.home);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  const onOpenChange = (open: boolean) => {
    request.current?.abort();
    request.current = null;
    if (!open) return;
    setHere(`${window.location.pathname}${window.location.search}`);
    setState({ status: "loading" });
    const controller = new AbortController();
    request.current = controller;
    apiFetch<unknown>(apiRoutes.me, { signal: controller.signal, cache: "no-store" })
      .then((body) => setState({ status: "ready", me: readMe(body) }))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.kind === "aborted") return;
        setState({ status: "failed" });
      });
  };

  const me = state.status === "ready" && state.me.signedIn ? state.me : null;
  const label = me?.email ? format(t.signedInAs, { email: me.email }) : t.label;

  return (
    <Popover
      role="menu"
      label={label}
      align="end"
      onOpenChange={onOpenChange}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={look === "menu" ? undefined : messages.header.account}
          title={look === "menu" ? undefined : messages.header.accountTitle}
          className={TRIGGER[look]}
        >
          <UserRound size={look === "globe" ? 17 : 18} strokeWidth={1.6} aria-hidden />
          {look === "menu" ? t.label : null}
        </button>
      )}
    >
      {(close) => <MenuItems state={state} here={here} messages={messages} onPick={close} />}
    </Popover>
  );
}

function MenuItems({
  state,
  here,
  messages,
  onPick,
}: {
  state: State;
  here: string;
  messages: Messages;
  onPick: () => void;
}) {
  const t = messages.accountMenu;
  const list = useRef<HTMLDivElement>(null);

  // The items replace the loading line, which had the focus: hand it to the first one.
  useEffect(() => {
    if (state.status !== "loading") focusFirstMenuItem(list.current);
  }, [state.status]);

  if (state.status === "loading") {
    return (
      <div
        role="menuitem"
        aria-disabled="true"
        tabIndex={-1}
        className={cn(ITEM, "text-[var(--color-ink-muted)]")}
      >
        {t.loading}
      </div>
    );
  }

  const me = state.status === "ready" && state.me.signedIn ? state.me : null;
  const link = (href: string, text: string) => (
    <Link role="menuitem" tabIndex={-1} href={href} onClick={onPick} className={ITEM}>
      {text}
    </Link>
  );

  return (
    <div ref={list} role="none" className="grid gap-0.5">
      {state.status === "failed" ? (
        <p role="none" className="px-3 py-2 text-[12.5px] text-[var(--color-ink-muted)]">
          {t.unavailable}
        </p>
      ) : null}
      {me ? (
        <>
          <div role="none" className="mb-1 border-b border-[var(--color-line)] px-3 pt-1 pb-2">
            <p className="truncate font-medium" title={me.email ?? undefined}>
              {me.email}
            </p>
            {me.isStaff && me.roleName ? (
              <p className="text-[12px] text-[var(--color-ink-muted)]">{me.roleName}</p>
            ) : null}
          </div>
          {me.isStaff ? (
            <>
              {link(adminRoutes.overview, t.openAdmin)}
              {link(adminRoutes.account, t.myAccount)}
            </>
          ) : (
            link(routes.account, t.settings)
          )}
          <form role="none" action={routes.signOut} method="post">
            <button role="menuitem" tabIndex={-1} type="submit" className={ITEM}>
              {t.signOut}
            </button>
          </form>
        </>
      ) : (
        link(signInHref(here), messages.nav.signIn)
      )}
    </div>
  );
}

/** Sign-in that brings the visitor back to this page (not to the sign-in pages themselves). */
function signInHref(here: string): string {
  const path = here.split("?")[0] ?? "";
  const signingIn = [routes.login, routes.invitation].some((page) => isAtOrUnder(path, page));
  return signingIn ? routes.login : `${routes.login}?next=${encodeURIComponent(here)}`;
}
