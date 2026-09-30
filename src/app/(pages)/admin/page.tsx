import type { Metadata } from "next";
import Link from "next/link";
import { can, getAccess } from "@/features/auth/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administrace",
  robots: { index: false, follow: false },
};

/** Úvod administrace: kam dál podle oprávnění. */
export default async function AdminPage() {
  const access = await getAccess();
  if (!access) return null;

  return (
    <main>
      <h1 className="font-display text-[28px] font-bold">Administrace</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        Obsah Atlasu je v databázi. Co smíte upravovat, určuje vaše role ({access.roleName}).
      </p>
      <ul className="mt-8 grid gap-2 text-[14px]">
        {can(access.permissions, "users", "v") ? (
          <li>
            <Link href="/admin/pozvanky" className="text-[var(--color-link)] underline">
              Tým a pozvánky
            </Link>
          </li>
        ) : null}
      </ul>
    </main>
  );
}
