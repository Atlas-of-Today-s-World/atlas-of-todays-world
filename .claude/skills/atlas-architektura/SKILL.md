---
name: atlas-architektura
description: Architektura a závazné postupové standardy projektu Atlas of Today's World (Next.js 15 + Supabase + Vercel). Použij VŽDY před návrhem nebo změnou kódu, databáze (migrace, RLS, funkce), přihlašování a oprávnění, administrace, testů, CI/CD nebo bezpečnosti v tomto repozitáři, a při review PR.
---

# Atlas of Today's World — architektura a standardy

Úplný dokument: `ARCHITEKTURA.md` v kořeni repa je rejstřík; kapitoly jsou v `docs/architecture/` (přečti relevantní kapitolu před prací, aktuální stav a dluh v `docs/architecture/analyza-2026-10.md`).
Neveřejné konkrétní nálezy: `docs/architektura-nalezy.md` (SEC-xx, DB-xx) — složka `docs/` je
v `.gitignore` a repo je **veřejné**: nikdy necommituj `docs/`, tajné údaje ani popisy zranitelností.

## Kontext v kostce

- **Web je jen v angličtině** (ADR-022): žádný `cs.json`, přepínač jazyka ani `/cs` adresy (ty přesměrují na angličtinu). Texty UI dál z `messages/en.json`. Nový jazyk jen na výslovné přání vlastníka.
- **Téma (topic) = heslo `kind='entry'`** s vlastními dlaždicemi ze šablony (`topic_templates`, ADR-024); počty témat na mapě počítá `features/topics/map-counts.ts`. Sdílené dlaždice `entry_id is null` jsou jen pro staré `resources.kind`, nečti je.
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

## Komponenty a deduplikace (ARCHITEKTURA kap. 15)

Každý vizuální vzor, konstanta a datová definice existuje **právě jednou**. Postup u každé UI změny:

1. **Nejdřív hledej**, v tomto pořadí: tokeny (`globals.css` `@theme`, `config/layout.ts`) → primitiva
   `components/ui/` (shadcn) → vzory `components/atlas/` (`Rail`, `Section`, `MetricCard`, `EmptySection`,
   `SafeHtml`…) → doménové bloky (`components/portrait/`, `features/*/components/`). Hledej podle názvu i tříd.
2. **Podobné existuje → přidej variantu** (`cva`: `variant`/`size`/`tone`), nekopíruj. Nová komponenta jen
   když nic podobného není — a rovnou na správnou úroveň, sdílenou.
3. **Žádná magická čísla**: šířky panelu, breakpointy, z-indexy, 44 px cíle jen z tokenů / `config/layout.ts`.
4. **Jedna datová definice**: menu z `config/navigation.ts`; kategorie, sekce, typy z DB typů nebo jednoho `const`.
5. **Stejná data = stejná komponenta**: region i global issue → `Portrait`; všechny karusely → `Rail`;
   formuláře → `FormField` + Zod + `useActionState`; tabulky → `DataTable` (skill `atlas-datatable`, vždy s akcemi v řádku); ikony → `lucide-react`;
   volání serveru z klienta → Server Action nebo `apiFetch()`, nikdy ruční `fetch` v komponentě.
6. **Při úpravě souboru s duplicitou z tabulky D1–D8** (ARCHITEKTURA 15.3) ji v témže PR odstraň nebo
   zapiš, proč ne. Nezaváděj nové výskyty.
7. CI hlídá: `jscpd` (≤ 1 %, blok < 30 ř.), `knip` (0 nepoužitých exportů), ESLint zákazy
   (`dangerouslySetInnerHTML` mimo `SafeHtml`, `fetch(` v `components/`, `@supabase/supabase-js` mimo `lib/supabase`).
   Každý sdílený díl má story ve Storybooku.

## Co má mít správná webová aplikace (ARCHITEKTURA kap. 16)

Při každé větší změně zkontroluj, jestli se jí netýká některý chybějící standard, a navrhni ho:
error/not-found/loading stránky · režim údržby · privacy/terms · GDPR export a smazání účtu ·
e-mailové šablony Auth · přístupnost (skip-link, focus trap, axe) · OG obrázky a hreflang ·
`draftMode` náhled · plánované publikování · autosave editoru · správa přesměrování při změně slugu ·
kontrola mrtvých odkazů · `/api/health` · Sentry · cookie-less analytika · uptime monitor · feature flagy v DB ·
runbook incidentů · test obnovy záloh · `SECURITY.md` + `security.txt` · ochrana `main` + CodeQL ·
rotace klíčů · revize přístupů · `typedRoutes` · pre-commit (lint-staged) · Conventional Commits + CHANGELOG ·
PR šablona + CODEOWNERS · Renovate/Dependabot · bundle analyzer.

## Plán realizace

Pořadí a stav úkolů: `PLAN-REALIZACE.md` v kořeni repa. Pracuj po úkolech (jeden úkol = jedna větev = jeden PR),
po dokončení zaškrtni úkol a doplň odkaz na PR.

## Databáze — standard

- Nová migrace: `supabase migration new <popis>`; **aplikovanou migraci nikdy neupravuj**.
- Zpětná kompatibilita (expand → migrate → contract); migrace běží v CI **před** nasazením aplikace.
- Každá tabulka: `enable row level security`, politiky **zvlášť pro select/insert/update/delete** (ne `for all`),
  explicitní granty (`anon` jen select veřejných dat), `CHECK` délek, `^https://` u URL, `updated_at` + `stamp_row`,
  **index na každý FK**.
- Funkce: `set search_path = public, pg_temp`; definer jen když nutné; `revoke execute … from public, anon`.
- **V RLS politikách volej helpery s konstantními argumenty v sub-selectu** — `(select public.has_perm('users','v'))`, `(select auth.uid())`, `(select public.is_admin())` — jinak běží pro každý řádek; hlídá to test v `supabase/tests/rls.test.mjs` (migrace 20261008000050). Helpery s argumentem z řádku (`can_edit_entry(owner_id)`) zůstávají holé.
- **Guard triggery čtoucí RLS tabulky musí být `SECURITY DEFINER`** (jinak se kontrola tiše přeskočí).
- Interní sloupce (`owner_id`, `review_note`, `approved_by`, `profile_id`) anon nevidí — **sloupcová práva**;
  veřejný web se proto ptá na vyjmenované sloupce, **nikdy `select *` přes anon klienta**.
- Ochranné triggery obchází jen servisní klíč (`auth.uid()` null) nebo security definer funkce přes
  `internal_profile_grants` (povolení na jednu transakci). **Nikdy** přes `set_config`/JWT příznaky — klient je umí podstrčit.
- Pozvánky: `invitations` + `claim_invitation()`; role se přiděluje jen pro ověřený e-mail (`email_confirmed_at`).
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
- Supabase projekty: `ewbzkxialhtwuqlenjof` (prod), `bognwszwhxxyjafqzfuh` (`atlas-dev` — preview, e2e, zkoušení migrací; **testy a pokusy vždy sem, nikdy do prod**). Tajné údaje lokálně jen v `.env.deploy.local` (gitignored);
  nevypisuj jejich hodnoty do výstupu.

## Pracovní dohody (projektová paměť)

- **GitHub účet:** pro tento repozitář jen účet vlastníka `vojtechgottvald` přes `GH_TOKEN` z `.env.deploy.local`
  (`gh` s tímto tokenem, push přes `git -c credential.helper='!gh auth git-credential'`). Jiné globálně
  přihlášené účty v shellu nepoužívej a globální přihlášení neměň. Token nikdy nevypisuj.
- **Paralelní session:** na plánu pracuje víc session najednou. Před větší změnou se domluv (vlastnictví souborů,
  čísla migrací, pořadí slučování); jeden úkol = jedna větev = jeden PR, žádné společné rozpracované soubory.
- **Komentáře a názvy testů anglicky**, texty UI administrace anglicky, veřejný web přes `src/messages/{en,cs}.json`.
- **Migrace a atlas-dev:** e2e v CI běží proti `atlas-dev`; novou migraci aplikuj na `atlas-dev` dřív, než na ni
  spoléháš v e2e (ověř project-ref = dev).
- **Tajné údaje** jen v GitHub Secrets / `.env*.local` (gitignored); repo je veřejné.
