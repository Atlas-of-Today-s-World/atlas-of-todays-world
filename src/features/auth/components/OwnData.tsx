import { buttonVariants } from "@/components/ui/button";
import { apiRoutes } from "@/config/routes";
import { cn } from "@/lib/cn";
import type { Messages } from "@/lib/i18n/messages";
import DeleteAccount from "./DeleteAccount";

/**
 * GDPR self-service, the same for a reader (/account) and the team (admin →
 * My account): download of one's own data (Art. 15 and 20; a plain link, no
 * JavaScript) and deleting the account, collapsed below it.
 */
export function OwnData({ email, t }: { email: string; t: Messages["account"] }) {
  return (
    <>
      <section className="mt-8" aria-labelledby="own-data">
        <h2 id="own-data" className="font-display text-[17px] font-bold">
          {t.dataHeading}
        </h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
          {t.dataLead}
        </p>
        <a
          href={apiRoutes.accountExport}
          download
          className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
        >
          {t.download}
        </a>
      </section>
      <DeleteAccount email={email} t={t} />
    </>
  );
}

/** E-mail and role of the signed-in account, as a definition list. */
export function AccountFacts({
  email,
  role,
  t,
}: {
  email: string;
  role: string | null;
  t: Messages["account"];
}) {
  return (
    <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[14px]">
      <dt className="text-[var(--color-ink-muted)]">{t.email}</dt>
      <dd className="min-w-0 break-words">{email}</dd>
      {role ? (
        <>
          <dt className="text-[var(--color-ink-muted)]">{t.role}</dt>
          <dd>{role}</dd>
        </>
      ) : null}
    </dl>
  );
}
