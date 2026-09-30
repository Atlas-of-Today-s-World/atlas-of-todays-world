import type { Metadata } from "next";
import { supabaseConfig } from "@/lib/supabase/config";
import GoogleSignIn from "../login/GoogleSignIn";

export const metadata: Metadata = {
  title: "Pozvánka do týmu",
  robots: { index: false, follow: false },
};

/**
 * Stránka, na kterou vede odkaz z pozvánky. Nenese žádné tajemství — role se
 * přidělí podle ověřeného e-mailu při přihlášení (ARCHITEKTURA 7.3).
 */
export default function InvitationPage() {
  return (
    <main className="mx-auto max-w-md">
      <h1 className="font-display text-[28px] font-bold">Pozvánka do týmu Atlasu</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        Přihlaste se přes Google <strong>stejnou e-mailovou adresou</strong>, na kterou vám pozvánka
        přišla. Roli v týmu dostanete automaticky a otevře se vám administrace.
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
        Pozvánka platí 5 dní. Pokud vypršela nebo se přihlásíte jinou adresou, požádejte o novou
        toho, kdo vás zval.
      </p>
      <div className="mt-8">
        {supabaseConfig() ? (
          <GoogleSignIn next="/admin" />
        ) : (
          <p className="text-[13px] text-[var(--color-ink-muted)]">
            Přihlášení zatím není dostupné.
          </p>
        )}
      </div>
    </main>
  );
}
