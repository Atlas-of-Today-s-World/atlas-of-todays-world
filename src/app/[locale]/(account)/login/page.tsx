import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getFlags } from "@/features/flags/queries";
import { localePath } from "@/features/i18n/config";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { safeRedirect } from "@/lib/security/redirect";
import { supabaseConfig } from "@/lib/supabase/config";
import { currentUser } from "@/lib/supabase/server";
import { EmailSignIn } from "./EmailSignIn";
import GoogleSignIn from "./GoogleSignIn";
import { routes } from "@/config/routes";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = getMessages(await localeFrom(params)).auth;
  return { title: t.title, robots: { index: false, follow: false } };
}

/**
 * Sign-in (ARCHITEKTURA 7.1): Google right away, the e-mail code only with our own
 * SMTP (`email_auth` switch, G1). Signing in also registers a reader;
 * joining the editorial team is by invitation.
 */
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const locale = await localeFrom(params);
  const t = getMessages(locale).auth;
  const { next, error } = await searchParams;
  const target = safeRedirect(next, localePath(locale, routes.account));
  const configured = supabaseConfig() !== null;
  const emailAuth = configured && (await getFlags()).emailAuth;

  if (configured && (await currentUser())) redirect(target);

  return (
    <main className="mx-auto max-w-md">
      <h1 className="font-display text-[28px] font-bold">{t.title}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">{t.lead}</p>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error === "config" ? t.errors.config : t.errors.callback}
        </p>
      ) : null}

      <div className="mt-8">
        {configured ? (
          <GoogleSignIn next={target} />
        ) : (
          <p className="text-[13px] text-[var(--color-ink-muted)]">{t.errors.config}</p>
        )}
      </div>

      {emailAuth ? (
        <>
          <p className="my-6 flex items-center gap-3 text-[12px] text-[var(--color-ink-muted)] before:h-px before:flex-1 before:bg-[var(--color-line)] after:h-px after:flex-1 after:bg-[var(--color-line)]">
            {t.or}
          </p>
          <EmailSignIn next={target} />
        </>
      ) : null}

      <p className="mt-8 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
        {t.privacy} {emailAuth ? null : t.emailSoon}
      </p>
    </main>
  );
}
