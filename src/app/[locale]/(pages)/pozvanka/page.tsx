import type { Metadata } from "next";
import { supabaseConfig } from "@/lib/supabase/config";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import GoogleSignIn from "../login/GoogleSignIn";

// Rendered per request: the proxy sends it a nonce CSP (ADR-025), which a static page couldn't carry.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return {
    title: getMessages(await localeFrom(params)).invite.title,
    robots: { index: false, follow: false },
  };
}

/**
 * The page an invitation link leads to. It carries no secret — the role is
 * assigned by the verified e-mail at sign-in (ARCHITEKTURA 7.3).
 */
export default async function InvitationPage({ params }: { params: Promise<{ locale: string }> }) {
  const t = getMessages(await localeFrom(params)).invite;
  return (
    <main className="mx-auto max-w-md">
      <h1 className="font-display text-[28px] font-bold">{t.heading}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">{t.lead}</p>
      <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">{t.validity}</p>
      <div className="mt-8">
        {supabaseConfig() ? (
          <GoogleSignIn next="/admin" />
        ) : (
          <p className="text-[13px] text-[var(--color-ink-muted)]">{t.unavailable}</p>
        )}
      </div>
    </main>
  );
}
