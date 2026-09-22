import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Administrace — přihlášení",
  robots: { index: false, follow: false },
};

/**
 * Přihlášení do administrace sdíleným heslem z `ADMIN_TOKEN`.
 *
 * Je to mezistupeň, ne cíl: pořádné účty a role přijdou se Supabase Auth
 * (docs/build-brief.md, P14). Do té doby stačí, aby se redakce nedala otevřít
 * z internetu jen tím, že někdo uhodne adresu.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto max-w-md">
      <h1 className="font-display text-[28px] font-bold">Administrace</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        Redakční část Atlasu je zamčená sdíleným heslem. Dokud nebude hotové
        přihlášení s účty, tohle je jediná zábrana — heslo tedy nikam nelepte.
      </p>

      <LoginForm next={next ?? "/admin"} error={error} />
    </main>
  );
}
