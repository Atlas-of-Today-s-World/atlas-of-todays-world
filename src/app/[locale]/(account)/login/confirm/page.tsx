import { Lead } from "@/components/atlas/Note";
import Link from "@/components/i18n/Link";
import { Button } from "@/components/ui/button";
import { getMessagesFor, localeFrom } from "@/features/i18n/request";
import { firstParam } from "@/lib/query-params";
import { privateMetadata } from "@/lib/seo/metadata";
import { routes } from "@/config/routes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/login/confirm">) {
  return privateMetadata((await getMessagesFor(await localeFrom(params))).auth.confirm.title);
}

/**
 * Step between an e-mail link and the session (/auth/confirm): signing in
 * needs this button, posted from our own site. Opening a link someone else
 * sent never signs the browser in on its own.
 */
export default async function ConfirmSignInPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login/confirm">) {
  const messages = (await getMessagesFor(await localeFrom(params))).auth;
  const t = messages.confirm;
  const query = await searchParams;
  const [tokenHash, type, next] = [query.token_hash, query.type, query.next].map(firstParam);

  return (
    <main className="mx-auto max-w-md">
      <h1 className="font-display text-[28px] font-bold">{t.title}</h1>
      {tokenHash && type ? (
        <>
          <Lead className="mt-3">{t.lead}</Lead>
          <form method="post" action="/auth/confirm" className="mt-8">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <Button type="submit">{t.continue}</Button>
          </form>
          <p className="mt-6 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
            {t.notYou}
          </p>
        </>
      ) : (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {messages.errors.callback} <Link href={routes.login}>{messages.title}</Link>
        </p>
      )}
    </main>
  );
}
