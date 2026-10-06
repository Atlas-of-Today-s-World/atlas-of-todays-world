# Cíl, výchozí stav a principy

> Část architektonické dokumentace Atlas of Today's World — přehled a mapa kapitol
> v [`ARCHITEKTURA.md`](../../ARCHITEKTURA.md). Čísla kapitol (§) se nemění: kód je
> cituje jako „ARCHITEKTURA x.y".

## 1. Cíl a výchozí stav

### 1.1 Cíl

Z dnešní aplikace, která čte obsah ze souborů v gitu, udělat **plnohodnotnou webovou aplikaci nad Supabase**:

- veřejný web (globus, regiony, země, global issues, hesla, datové vrstvy) čte z databáze,
- přihlášení uživatelé **ukládají** obsah přímo do databáze přes administraci,
- oprávnění, schvalování a audit vynucuje **databáze** (RLS + funkce), aplikace je jen zobrazuje,
- **čtenáři** se registrují sami (Google, později vlastní e-mail) a dostanou roli `reader`,
- **interní tým** (admini, redaktoři, schvalovatelé…) vstupuje **jen na pozvánku** od admina, která rovnou
  určuje roli a práva (viz [7.3 Registrace a pozvánky](06-autentizace-role.md#73-registrace-čtenářů-a-pozvánky-týmu)).

### 1.2 Výchozí stav (2026-09-30)

| Oblast | Stav |
|---|---|
| Frontend | Next.js 15 App Router, React 19, TS `strict`, Tailwind 4, MapLibre GL 5 (globus). Globus je v layoutu `(map)` a mezi stránkami se nepřemontovává. |
| Obsah | Soubory: `src/content/**` (Markdown/JSON), generovaná data `src/data/*.generated.json`, geometrie `public/data/*.geo.json`. |
| Administrace | `/admin` se 4 záložkami (Novinky, Země, Regiony, Global Issues), ukládá **zápisem do souborů** — na Vercelu nefunkční (read-only FS). Přístup přes sdílené heslo `ADMIN_TOKEN`, bez něj v produkci 404. |
| Databáze | Supabase (Frankfurt), 5 migrací, 30 tabulek, RLS na všech, role × sekce × akce, schvalovací workflow, audit, revize, seed s reálnými daty. Aplikace ji **zatím nepoužívá**. Testy RLS v PGlite (`npm run test:db`). |
| Testy | Playwright (16 toků), fetch smoke test, DB testy v PGlite. Žádné unit testy aplikace, žádný lint. |
| CI/CD | GitHub Actions → Vercel (Hobby) přes token. CI zatím **nespouští testy**. |
| Hosting | Vercel Hobby, veřejný GitHub repozitář, Supabase Free. |

### 1.3 Mimo rozsah tohoto dokumentu

Webflow migrace (P16), platby Stripe (P10), jazykové mutace (P15) a audio (R4) mají v architektuře
připravené místo (kapitoly 4, 6), ale jejich realizace je samostatná etapa.

---

## 2. Architektonické principy

1. **Databáze rozhoduje, aplikace zobrazuje.** Každé pravidlo „kdo smí co“ je v RLS nebo v `SECURITY DEFINER`
   funkci. Kontrola v aplikaci je jen UX (skrytí tlačítka), nikdy jediná ochrana.
2. **Server first.** Server Components jsou výchozí. Klientská komponenta jen tam, kde je interaktivita
   (globus, formuláře, editor). Tajné klíče a privilegovaný přístup nikdy v prohlížeči.
3. **Jeden zdroj pravdy.** Po migraci obsahu do DB se `src/content/**` maže. Žádná data nejsou ve dvou místech.
   Výjimka: geometrie a generovaná data z importů zůstávají v gitu (jsou to build artefakty, ne redakční obsah).
4. **Least privilege.** Každý kód používá nejslabší klíč, který stačí: veřejné čtení = `anon`, akce uživatele
   = jeho session (RLS), servisní klíč jen webhooky a importy.
5. **Validace na každé hranici.** Vše, co přijde zvenku (formulář, URL, JSON, webhook, env), projde schématem (Zod).
6. **Nudné technologie.** Preferujeme oficiální knihovny a vzory ekosystému (`@supabase/ssr`, shadcn/ui, Zod,
   TanStack Table, TipTap). Nová závislost = jedna věta zdůvodnění v PR.
7. **Předání projektu.** Běžný webový vývojář musí projekt převzít podle tohoto dokumentu a README.
   Žádná „magie“, žádné ruční kroky při nasazení.
8. **Bezpečně ve výchozím stavu.** Nový endpoint, tabulka nebo bucket je zavřený, dokud ho explicitně neotevřeme.
