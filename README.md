# Atlas of Today's World

Interaktivní encyklopedie na 3D globusu. Implementace návrhu
[Atlas MVP Design](https://www.figma.com/design/iwr1VlkPCWHURaamQhD5I4/Atlas-MVP-Design)
v Next.js 15 + MapLibre GL JS 5.

---

## Rychlý start

```bash
npm install
npm run data:all      # stáhne hranice zemí + datové vrstvy (jednorázově)
npm run dev           # http://localhost:3000
```

Aplikace čte obsah ze Supabase, takže potřebuje `.env.local` s údaji
**dev** projektu (`atlas-dev`, nikdy produkce):

```bash
cp .env.example .env.local   # doplnit NEXT_PUBLIC_SUPABASE_URL a _ANON_KEY
```

| Proměnná | K čemu |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Veřejné čtení obsahu a přihlášení (povinné). |
| `SUPABASE_SERVICE_ROLE_KEY` | Jen server: smazání účtu, ban v Auth, rate limit, e2e účty. |
| `NEXT_PUBLIC_MAPTILER_KEY` | Satelitní dlaždice MapTileru místo Esri. Pro produkci doporučeno (Esri nemá SLA pro komerční provoz). |
| `NEXT_PUBLIC_SITE_URL` | Kanonická adresa pro sitemapu, robots.txt a og:url. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Kontakt v zásadách ochrany soukromí a prohlášení o přístupnosti. |
| `MAILCHIMP_API_KEY`, `MAILCHIMP_LIST_ID` | Odběr novinek. |

Prázdnou databázi naplní migrace (`supabase db push`) a `supabase/seed.sql`.
První admin: `npm run db:make-admin -- --project dev email@…` (po prvním přihlášení).

---|---|
| `NEXT_PUBLIC_MAPTILER_KEY` | Satelitní dlaždice MapTileru místo Esri. Pro produkci doporučeno (Esri nemá SLA pro komerční provoz). |
| `NEXT_PUBLIC_SITE_URL` | Kanonická adresa pro sitemapu, robots.txt a og:url. |

---

## Co je hotové

**1. 3D mapa světa (MVP)**

- Satelitní globus, plynulé otáčení i zoom (MapLibre GL JS 5, projekce `globe`).
- Obrysy 242 zemí z Natural Earth, hranice regionů zvýrazněné barvou regionu.
- Kliknutí na zemi → globus doletí na výřez její hlavní pevniny (Lucembursko
  zblízka, Rusko z dálky) a vpravo se otevře karta země se třemi a více daty.
- Zároveň se zvýrazní celý region, ke kterému země patří, a odkaz na jeho profil.
- Portrét regionu i novinku se vykreslují **uvnitř mapy** –
  uživatel s ní neztratí kontakt.

**2. Datové vrstvy (plná verze)**

Přepínač „Encyclopedia view" nabízí 9 datových pohledů s reálnými daty:
HDI, naděje dožití, HDP na obyvatele, politický režim, index volební demokracie,
vnímání korupce, extrémní chudoba, emise CO₂ na obyvatele, podíl uživatelů internetu.
Každý má vlastní legendu, zdroj a samostatnou URL (`/view/hdi`).

**3. Fulltext (plná verze)**

- `/api/search` – fulltext (MiniSearch) nad regiony, zeměmi i hesly.
  Dotaz „political situation in Russia" vrátí profil Ruska i heslo o Putinově režimu.
- Chatbot nad stejným indexem byl zatím odebrán; vrátit se dá z gitu
  (`src/app/api/chat/route.ts` a režim „Ask" v `EncyclopediaPanel.tsx`).

**Přepínač Countries / Regions / Global Issues**

Na globusu se dá vybírat po státech, po devíti regionech Atlasu, nebo po
vlastních celcích, které si redakce skládá v administraci. Vlastní celky můžou
hranice regionů Atlasu libovolně křížit – deset ukázkových (Demo region 1–10)
jde od severského a baltského pásu přes Sahel po severní Atlantik.

**Administrace (`/admin`)**

Přístup jen pro přihlášený tým; do týmu se vstupuje pozvánkou. Menu i obrazovky
se řídí rolí, o tom, kdo co smí, ale rozhoduje databáze (RLS). Admin a správce
oprávnění potřebují dvoufázové ověření (TOTP).

| Sekce | Co se tam dělá |
| --- | --- |
| Novinky a hesla | koncepty, editor (TipTap), obrázky, země, historie verzí; odeslání ke schválení |
| Schvalování | fronta podle přidělení (země, autoři), rozdíl proti zveřejněné verzi, schválit / vrátit s poznámkou |
| Regiony a země | portréty regionů (úvod, časová osa, ukazatele se zdrojem, zdroje, FAQ, vizuály) a profily zemí |
| Global Issues | celky zemí napříč regiony s vlastním portrétem |
| Datové vrstvy | ukazatele, palety, číselníky, ruční hodnoty (vždy se zdrojem) |
| Mapové oblasti, Vzhled mapy | vlastní plochy (GeoJSON) a sytost barev / síla hranic globusu |
| Účty a pozvánky | role, blokace, přiřazení schvalovatelů, pozvánky |
| Role a práva | matice oprávnění, vlastní role, bezpečnost, přepínače (režim údržby), záznam změn |
| Členové | Atlas Patrons, členství zdarma |

**Dva druhy ukazatelů.** Automatické (HDI, politický režim, korupce, chudoba…
z Our World in Data pro všech 228 zemí) jsou v databázi; v administraci (Data)
se u nich jen vybírá, které se u země ukážou. Ruční píše redakce
tam, kde OWID data nemá: etnické skupiny, míra svobody, vysídlení, dětská
chudoba. **Ruční ukazatel bez uvedeného zdroje se nepublikuje** — filtr je
v databázi (`portrait_metrics.source` je povinný), ne až ve vykreslování, takže se neúplná karta nedostane
ani do strukturovaných dat.

Když má region vlastní ukazatele, mají v portrétu přednost před dopočtem
z OWID; bez nich se kreslí dopočet, aby stránka nebyla prázdná skořápka.

**Výchozí pohled**

Globus se otevře ve vzdálenosti, kde vyplní okno a jsou čitelné názvy států,
otočený nad zemí návštěvníka. Poloha se bere z časového pásma prohlížeče,
jinak z jazyka, jinak střed Evropy. Geolokace se nepoužívá, aby stránka
nevyskakovala s dotazem na povolení.

**SEO a geo optimalizace**

Každý region, země, datová vrstva i heslo mají vlastní předrenderovanou URL
(`/region/…`, `/country/…`, `/view/…`, `/news/…`). Build vygeneruje ~270
statických stránek. K tomu:

- **Strukturovaná data** – `Country` s geo souřadnicemi, ISO identifikátory a
  všemi ukazateli jako `PropertyValue` (včetně zdroje a roku); `Place` pro
  regiony; `Article` s `contentLocation` a `about`; `Dataset` pro datové vrstvy;
  `FAQPage` z dossieru regionu; `BreadcrumbList` všude; `WebSite` +
  `Organization` + `SearchAction` na úvodní stránce.
- **Geo meta tagy** – `geo.position`, `geo.region` (ISO 3166-1 alpha-2),
  `geo.placename`, `ICBM` a `place:location:*` na profilech zemí a regionů.
- **robots.txt** otevřený všem robotům včetně AI crawlerů, `/api/` mimo index.
  Kdyby ATW obsah pro trénink modelů nechtělo, mění se to v `src/app/robots.ts`.
- **sitemap.xml** s `changeFrequency`, prioritami a obrázky.
- **hreflang** (zatím `en` a `x-default`) připravený na jazykové mutace.
- `max-image-preview: large` a neomezené úryvky pro Googlebot.
- Ikona webu, webový manifest a `/search?q=…` jako serverová stránka výsledků
  (neindexuje se, ale díky ní je `SearchAction` platná).

---

## Aktualizace dat

Všechno je hromadné, nic se neklika ručně.

```bash
npm run data:geo          # hranice a číselník zemí (Natural Earth)
```

Nová datová vrstva se přidává v administraci (Data); legenda, obarvení globusu,
přepínač i karta země se z jejích metadat vygenerují samy.

Když jeden zdroj spadne, ostatní se doimportují a stará data se nepřepíší.

---

## Ověření buildu, když běží dev server

`npm run build` píše do `.next`, ze které čte i běžící `npm run dev` – build by
ho shodil. Na kontrolu proto slouží:

```bash
npm run verify
```

Postaví produkční build do `.next-build` a vývojový server běží dál.

---

## Kam psát obsah

Veškerý obsah (novinky, portréty regionů a global issues, profily zemí, hodnoty
ukazatelů) je v databázi Supabase a upravuje se v administraci `/admin`.
Redakce nesahá do kódu. Prázdnou databázi naplní `supabase/seed.sql`.

Země bez redakčního textu mají profil složený z importovaných dat, takže žádná
ze 190+ zemí nezeje prázdnotou.

---

## Struktura

```
scripts/          hromadné importy dat (geodata, indikátory)
src/data/         geografická fakta z Natural Earth (vygenerované)
src/features/      doménové moduly: dotazy (queries.ts), Server Actions, schémata
src/lib/          klienti Supabase, bezpečnost, formátování
src/components/   UI; map/ = globus a jeho ovládání
src/app/(map)/    routy s globusem – /, /region, /country, /entry, /view
src/app/(pages)/  routy bez globusu – /about, /entries, /support
supabase/         migrace, seed a DB testy
public/data/      hranice zemí pro mapu
```

Globus je namontovaný v `src/app/(map)/layout.tsx`, takže při přechodu mezi
routami nepřenačítá. Stránky mu jen řeknou, kam se má dívat, komponentou
`<MapFocus />`.

---

## Co ještě chybí

Stav a pořadí úkolů je v [PLAN-REALIZACE.md](PLAN-REALIZACE.md) (fáze G a úkoly
vlastníka U5–U9). Mimo jiné:

- **Vektorové dlaždice.** `public/data/countries.geo.json` má 1,7 MB; převod na
  PMTiles ušetří první načtení.
- **Jazykové mutace**, **platby** (Stripe), **e-mailové přihlášení** (vlastní SMTP),
  **náhledy konceptů a plánované publikování**.
- **Sentry** a **UptimeRobot** (potřebují účty vlastníka).

---

## Zdroje dat

Hranice a názvy zemí: [Natural Earth](https://www.naturalearthdata.com/) (public domain).
Datové vrstvy: [Our World in Data](https://ourworldindata.org/) (CC BY), původní
zdroje jsou uvedené u každé vrstvy. Satelitní podklad: Esri World Imagery nebo MapTiler.
