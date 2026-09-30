---
name: atlas-architektura
description: Architektura a závazné postupové standardy projektu Atlas of Today's World (Next.js 15 + Supabase + Vercel). Použij VŽDY před návrhem nebo změnou kódu, databáze (migrace, RLS, funkce), přihlašování a oprávnění, administrace, testů, CI/CD nebo bezpečnosti v tomto repozitáři, a při review PR.
---

# Atlas of Today's World — architektura a standardy

Úplný dokument: `ARCHITEKTURA.md` v kořeni repa (přečti relevantní kapitolu před prací).
Neveřejné konkrétní nálezy: `docs/architektura-nalezy.md` (SEC-xx, DB-xx) — složka `docs/` je
v `.gitignore` a repo je **veřejné**: nikdy necommituj `docs/`, tajné údaje ani popisy zranitelností.

## Kontext v kostce

- Next.js 15 App Router, React 19, TS strict, Tailwind 4, MapLibre (globus v layoutu `(map)`, nepřemontovává se).
- Supabase (Frankfurt): Postgres 17, 30 tabulek, RLS všude, role × sekce × `vced`, workflow
  `planned → draft → pending → published` jen přes RPC (`submit_entry`, `approve_entry`, `send_back_entry`, `unpublish_entry`).
- Vercel Hobby (nasazení jen z GitHub Actions přes token), GitHub veřejné repo `Atlas-of-Today-s-World/atlas-of-todays-world`.
- **Přihlášení:** Google OAuth (hned), vlastní e-mail kódem/magic linkem (až po zřízení SMTP). Bez hesel.
- **Čtenáři** se registrují sami → role `reader`, bez přístupu do administrace.
- **Interní tým jen na pozvánku** (`invitations`): admin určí roli a schvalování; přijetí `claim_invitation()`
  jen pro **ověřený** e-mail shodný s pozvánkou (odkaz nenese tajemství). Role a práva se mění v sekcích
  Účty / Role a práva. Administrace se nezamyká 404, ale přihlášením (čtenář → 403 „Nemáte přístup“).

## Nepřekročitelná pravidla

1. **DB rozhoduje, aplikace zobrazuje.** Autorizace = RLS / `SECURITY DEFINER` funkce. Kontrola v UI je jen UX.
2. **Klíče:** veřejné čtení = anon klient (`lib/supabase/public.ts`), akce uživatele = session klient
   (`lib/supabase/server.ts`), service key jen webhooky/importy (`lib/supabase/service.ts`, `import "server-only"`).
   Nic citlivého s prefixem `NEXT_PUBLIC_`.
3. **Na serveru identita vždy `supabase.auth.getUser()`**, nikdy jen `getSession()`.
4. **Mutace = Server Action** ve `features/<doména>/actions.ts`: Zod → getUser → sanitizace → zápis (RLS) →
   `mapDbError` → `revalidateTag` (tagy z `lib/cache/tags.ts`). Stav obsahu nikdy přímým UPDATE, jen RPC.
5. **Validace:** Zod na každé hranici; limity shodné s DB `CHECK`.
6. **HTML:** jen přes jedinou allowlist v `lib/security/sanitize.ts`, při uložení i vykreslení (`<SafeHtml>`).
   URL do `href/src/style` jen přes `safeUrl()`; `next`/redirect jen přes `safeRedirect()`.
7. **Veřejné stránky** statické/ISR s cache tagy; nikdy `force-dynamic` na veřejném obsahu. Admin `force-dynamic` + `noindex`.
8. **CSP s nonce**, bez `unsafe-eval`; nová externí služba = úprava `lib/security/csp.ts` + test.
9. **Rate limit** ve sdíleném úložišti (Postgres `rate_limits`), nikdy v paměti procesu.
10. **Žádné zápisy do filesystému** za běhu (Vercel je read-only).

## Databáze — standard

- Nová migrace: `supabase migration new <popis>`; **aplikovanou migraci nikdy neupravuj**.
- Zpětná kompatibilita (expand → migrate → contract); migrace běží v CI **před** nasazením aplikace.
- Každá tabulka: `enable row level security`, politiky **zvlášť pro select/insert/update/delete** (ne `for all`),
  explicitní granty (`anon` jen select veřejných dat), `CHECK` délek, `^https://` u URL, `updated_at` + `stamp_row`,
  **index na každý FK**.
- Funkce: `set search_path = public, pg_temp`; definer jen když nutné; `revoke execute … from public, anon`.
- **Guard triggery čtoucí RLS tabulky musí být `SECURITY DEFINER`** (jinak se kontrola tiše přeskočí).
- Interní sloupce (`owner_id`, `review_note`, `approved_by`, `profile_id`) neukazuj anon — veřejná view / column granty.
- Po migraci: `supabase gen types typescript --linked > src/lib/db/types.gen.ts`.
- Každá změna oprávnění = úprava `supabase/tests/authz-matrix.json` + DB test (anon / s právem / bez práva).

## Testy (co spustit)

| Příkaz | Kdy |
|---|---|
| `npm run typecheck && npm run lint && npm test` | každá změna |
| `npm run test:db` (PGlite, bez Dockeru) | změna DB, RLS, seedu |
| `npx playwright test` (po `npm run build`) | změna UI toků |
| `npm run test:smoke` (`BASE_URL=…`) | po nasazení |

Oprava chyby začíná testem, který ji reprodukuje. Server Action = unit test validace + integrační test bez/s právem.

## Definition of Done (PR)

- CI zelené (typecheck, lint, unit, DB, build); nové vstupy mají Zod; nová data RLS + test; žádná tajemství;
  správné cache tagy; přístupnost (klávesnice, 44 px); PR popis s **Security impact**, pokud se týká auth/RLS/
  migrací/middleware/`lib/security`; nová závislost zdůvodněná.

## Postupy

- **Nová tabulka:** ARCHITEKTURA 13.2 · **nová admin obrazovka:** 13.3 · **nová veřejná stránka:** 13.4 ·
  **přechod koncept → produkce:** 13.5 · **commity a větve:** 13.6.
- Nové architektonické rozhodnutí zapiš jako další řádek ADR v kapitole 11 (nepřepisuj staré).
- Po opravě nálezu SEC-xx/DB-xx přesuň položku v `docs/architektura-nalezy.md` do „Opraveno“ s odkazem na test.

## Provoz

- Nasazení: push do `main` → `.github/workflows/deploy.yml` → Vercel. Nikdy nenasazuj ručně do produkce,
  nikdy force-push na `main` bez výslovného souhlasu vlastníka.
- Supabase projekt `ewbzkxialhtwuqlenjof` (prod). Tajné údaje lokálně jen v `.env.deploy.local` (gitignored);
  nevypisuj jejich hodnoty do výstupu.
