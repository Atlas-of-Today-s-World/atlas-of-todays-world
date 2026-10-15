import { Lead } from "@/components/atlas/Note";
import { adminRoutes } from "@/config/routes";
import { supabaseConfig } from "@/lib/supabase/config";
import { getMessagesFor, localeFrom } from "@/lib/i18n/request";
import { privateMetadata } from "@/features/seo/metadata";
import GoogleSignIn from "../login/GoogleSignIn";

// Rendered per request: the proxy sends it a nonce CSP (ADR-025), which a static page couldn't carry.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/pozvanka">) {
  return privateMetadata((await getMessagesFor(await localeFrom(params))).invite.title);
}

/**
 * The page an invitation link leads to. It carries no secret — the role is
 * assigned by the verified e-mail at sign-in (ARCHITEKTURA 7.3).
 */
export default async function InvitationPage({ params }: PageProps<"/[locale]/pozvanka">) {
  const t = (await getMessagesFor(await localeFrom(params))).invite;
  return (
    <main className="mx-auto max-w-md">
      <h1 className="font-display text-[28px] font-bold">{t.heading}</h1>
      <Lead className="mt-3">{t.lead}</Lead>
      <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">{t.validity}</p>
      <div className="mt-8">
        {supabaseConfig() ? (
          <GoogleSignIn next={adminRoutes.overview} />
        ) : (
          <p className="text-[13px] text-[var(--color-ink-muted)]">{t.unavailable}</p>
        )}
      </div>
    </main>
  );
}
