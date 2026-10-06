# Komponenty, UI a deduplikace

> Část architektonické dokumentace Atlas of Today's World — přehled a mapa kapitol
> v [`ARCHITEKTURA.md`](../../ARCHITEKTURA.md). Čísla kapitol (§) se nemění: kód je
> cituje jako „ARCHITEKTURA x.y".

## 5. Komponenty a UI

### 5.1 Pravidla komponent

| Pravidlo | Proč |
|---|---|
| Server Component je výchozí; `"use client"` jen při stavu, efektech, událostech nebo browser API. | Menší JS, tajemství zůstávají na serveru. |
| Klientská komponenta nedostává celé DB řádky — jen props, které potřebuje. | Únik interních sloupců (owner_id, review_note). |
| Žádné `dangerouslySetInnerHTML` mimo komponentu `<SafeHtml html={…}/>`, která vstup znovu sanitizuje. | Obrana proti XSS i při chybě na vstupu. |
| URL z dat (`href`, `src`, `style: url()`) jen přes `safeUrl()` (povolí `https:`, `mailto:`, relativní cesty). | `javascript:` URL, CSS injection. |
| Interaktivní prvky ≥ 44×44 px, ovladatelné klávesnicí, viditelný focus. | P12 přístupnost. |
| Texty UI v `messages/{locale}.json` (příprava P15), ne natvrdo v komponentě. | Jazykové mutace. |

### 5.2 Katalog komponent

**Veřejná část**

| Skupina | Komponenty | Poznámka |
|---|---|---|
| `components/map/` | `AtlasGlobe`, `MapContext`, `MapFocus`, `MapControls`, `ModeSwitch`, `ViewSwitcher`, `MapLegend` | beze změny architektury; data vrstev z DB |
| `components/portrait/` | `Portrait` (jeden pro region i issue), `IndicatorCards`, `Timeline`, `ThematicEntries`, `VisualCarousel`, `ResourceLibrary`, `FaqList`, `EmptySection`, `PatronsCallout`, `Rail` | sjednotit 4 kopie karuselu do `Rail` (klávesnice, šipky) |
| `features/entries/components/` | `EntryHeader`, `EntryChapter`, `EntryAudio`, `AuthorBio` | P9 |
| `components/` | `ContentRail`, `Header`, `EncyclopediaPanel`, `NewsletterForm`, `SafeHtml` | |

**Administrace** (`app/admin/`, `components/ui` + `components/data-table/DataTable`, ADR-019)

| Sekce (= `role_permissions.section`) | Obrazovky | Datové operace |
|---|---|---|
| `news` | seznam hesel, editor (TipTap), náhled (`draftMode`), historie revizí s obnovou | `entries`, `entry_chapters`, `entry_countries`, Storage |
| `approvals` | fronta ke schválení, detail s diffem, vrátit s poznámkou | RPC `approve_entry`, `send_back_entry`, `unpublish_entry` |
| `regions` | portrét regionu: intro, metriky se zdrojem, timeline, FAQ, zdroje, vizuály | `regions`, `portrait_metrics`, `timeline_events`, … |
| `specials` | global issues: název, barvy, výběr zemí na mapě, portrét | `special_regions`, `special_region_countries` |
| `layers` | ukazatele, ruční hodnoty se zdrojem, palety | `indicators`, `indicator_values`, `indicator_styles` |
| `appearance` | téma webu | `site_theme` |
| `areas` | vlastní mapové oblasti (GeoJSON) | `map_areas` |
| `users` | účty, **pozvánky týmu s rolí**, povolené e-maily, přiřazení schvalovatelů, blokace | `profiles`, `invitations`, `allowed_emails`, `approver_*` |
| `permissions` | role × sekce matice, bezpečnostní nastavení, audit log | `roles`, `role_permissions`, `security_settings`, `audit_log` |
| `members` | členství (read-only z Stripe), bezplatná členství | `members_overview`, `memberships` |

Shell administrace: levé menu generované z `my_permissions()`; sekce bez práva `v` se nezobrazí **a zároveň** je
její stránka chráněná (layout sekce ověří `has_perm`). Každý formulář: `useActionState` + Zod chyby u polí +
potvrzení destruktivních akcí + stav „ukládám“.

### 5.3 Editor obsahu

- **TipTap** s povolenými rozšířeními: nadpisy h2–h4, odstavec, seznamy, tučné/kurzíva, odkaz, citace, tabulka,
  obrázek (jen ze Storage), vložení (jen Flourish/World Bank/YouTube přes schválený node).
- HTML se sanitizuje **při uložení** (Server Action) i **při vykreslení** (`<SafeHtml>`) stejnou allowlistou
  (`lib/security/sanitize.ts`, jediná definice).

---

## 15. Jednotnost komponent a deduplikace

Cíl: **každý vizuální vzor, konstanta a datová definice existuje v kódu právě jednou.** Nová obrazovka se
skládá z hotových dílů; když díl chybí, vznikne jako sdílený, ne jako kopie.

### 15.1 Hierarchie sdílených dílů (odkud brát, v tomto pořadí)

| Úroveň | Kde | Co tam patří |
|---|---|---|
| 1. Design tokeny | `src/app/globals.css` (`@theme` v Tailwind 4) + `src/config/layout.ts` | barvy, radiusy, stíny, typografie, **rozměry layoutu** (`--rail-width`, `--rail-width-wide`, `--header-h`, `--touch-min: 44px`) |
| 2. Primitiva | `src/components/ui/` (shadcn/ui) | `Button`, `IconButton`, `Input`, `Select`, `Dialog`, `Sheet`, `Tabs`, `Tooltip`, `Badge`, `Card`, `Skeleton`, `Form*` |
| 3. Vzory Atlasu | `src/components/atlas/` | `Rail` (jediný karusel), `Section`, `SectionLabel`, `MetricCard`, `EmptySection`, `PatronsCallout`, `SafeHtml`, `ExternalLink`, `Breadcrumbs` |
| 4. Doménové bloky | `src/components/portrait/`, `features/*/components/` | `Portrait` (region **i** global issue), `CountryCard`, `EntryHeader`… |
| 5. Stránky | `src/app/**` | jen skládání bloků + data; žádné vlastní styly nad rámec rozvržení |

Pravidla:

- **Než vytvoříš komponentu, hledej** v úrovních 1–4 (podle názvu i podle tříd). Existuje-li podobná,
  rozšiř ji o variantu, nevytvářej novou.
- **Varianty přes `cva`** (class-variance-authority, standard shadcn) — `variant`, `size`, `tone`; ne
  kopírováním dlouhých `className`. Opakovaný řetězec delší než ~6 utilit = signál pro variantu.
- **Žádná magická čísla v komponentách**: rozměry panelů, breakpointy a z-indexy jen z tokenů. JS, který
  potřebuje rozměr (např. padding globusu), ho čte z `config/layout.ts`, ze kterého vznikají i CSS proměnné.
- **Jedna datová definice**: navigace (`src/config/navigation.ts`) pro všechna menu (desktop, mobil, stránky
  bez globusu, patička); kategorie, sekce oprávnění, typy zdrojů — z DB typů nebo jednoho `const`, nikdy
  opsané do komponenty.
- **Stejná data = stejná komponenta**: region a global issue mají stejné sekce → jedna `Portrait` s propsem
  `subject: { kind: "region" | "issue", … }`.
- **Formuláře administrace** z jednoho vzoru: `FormField` (label + control + chyba ze Zod) + `useActionState`;
  tabulky z jednoho `DataTable` (`components/data-table`, ADR-019) s konfigurací sloupců.
- **Klientské volání serveru** jen přes Server Actions nebo jeden `apiFetch()` helper (timeout, chyby) —
  ne ručně psaný `fetch` v každé komponentě.
- **Ikony** z jedné sady (`lucide-react`), ne vložené SVG v každém souboru.
- **Texty** z `messages/{locale}.json`; opakovaný text (CTA, chybové hlášky) má jeden klíč.

### 15.2 Nástroje, které duplicitu hlídají (CI)

| Nástroj | Co hlídá | Práh |
|---|---|---|
| `jscpd` | copy-paste bloky v `src/` | selže nad 1 % duplicit nebo u bloku ≥ 30 řádků |
| `knip` | nepoužité soubory, exporty, závislosti | 0 nálezů (výjimky v `knip.json` s komentářem) |
| ESLint `no-restricted-imports` | import interních souborů cizí domény; `@supabase/supabase-js` mimo `lib/supabase` | chyba |
| ESLint `no-restricted-syntax` | `dangerouslySetInnerHTML` mimo `SafeHtml`; `fetch(` v `components/` | chyba |
| `prettier-plugin-tailwindcss` | jednotné řazení tříd (snazší hledání duplicit) | formát |
| Storybook (nebo Ladle) | katalog dílů úrovně 2–4 → je vidět, co existuje | každý sdílený díl má story |

### 15.3 Známé duplicity k odstranění (stav 2026-09-30)

| # | Duplicita | Cíl |
|---|---|---|
| D1 | Šířka panelu natvrdo na 4 místech (`ContentRail`, `Header`, `MapControls`, `AtlasGlobe`: `27rem`/`432`, `46rem`/`52vw`) | tokeny `--rail-width(-wide)` + `config/layout.ts` |
| D2 | 4 karusely v `PortraitSections` (`Timeline`, `ThematicEntries`, `VisualCarousel`, `ResourceLibrary`) + `NewsTabs` | jeden `Rail` (šipky, klávesnice, snap) |
| D3 | Stránka global issue (218 ř.) skládá portrét znovu místo `RegionPortrait` | jedna `Portrait` |
| D4 | Menu definované 2× (`Header.tsx` pole `NAV`, `(pages)/layout.tsx` natvrdo) | `config/navigation.ts` |
| D5 | ≥ 7 ručních variant primárního tlačítka, přestože existuje `PrimaryButton` | `ui/Button` s variantami |
| D6 | `fetch` ručně v 7 klientských komponentách (admin formuláře, newsletter, search, login) | Server Actions / `apiFetch` |
| D7 | Tři admin formuláře (530, 664, 357 ř.) s vlastní validací a stavem | `FormField` + Zod + `useActionState`, `DataTable` |
| D8 | Obsah renderuje aplikace i `demo/` zvlášť | demo jen jako prezentace nad exportem, nebo zrušit |
