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

Bez `.env.local` běží všechno (satelitní podklad jede na bezplatných
dlaždicích Esri). Volitelná konfigurace:

```bash
cp .env.example .env.local
```

| Proměnná | K čemu |
|---|---|
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

Čtyři záložky, každá s vlastním formulářem:

| Záložka | Co se tam nastavuje | Kam se to uloží |
| --- | --- | --- |
| Novinky | formulář nové novinky (otvírá se tlačítkem, ať nepřekáží seznamu) a seznam publikovaných s filtry podle regionu, země, Global Issue, kategorie a názvu | `src/content/news/<slug>.md` |
| Země | shrnutí, podtitulek, výběr automatických ukazatelů, ruční ukazatele s citací a delší text | `src/content/countries/<slug>.md` |
| Regiony | úvodní odstavec portrétu a ukazatele s citací; časová osa, zdroje a FAQ zůstávají beze změny | `src/content/regions/<slug>.json` |
| Global Issues | pojmenované množiny zemí napříč regiony | `src/content/global-issues.json` |

**Dva druhy ukazatelů.** Automatické počítá `npm run data:indicators` z Our
World in Data pro všech 228 zemí (HDI, politický režim, korupce, chudoba…) —
v administraci se u nich jen vybírá, které se u země ukážou. Ruční píše redakce
tam, kde OWID data nemá: etnické skupiny, míra svobody, vysídlení, dětská
chudoba. **Ruční ukazatel bez uvedeného zdroje se nepublikuje** — filtr je
v `src/lib/content.ts`, ne až ve vykreslování, takže se neúplná karta nedostane
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
npm run data:indicators   # datové vrstvy (Our World in Data) – jednou ročně
```

Přidání desáté datové vrstvy = jeden záznam v
[`scripts/indicators.config.mjs`](scripts/indicators.config.mjs) a nové spuštění
importu. Legenda, obarvení globusu, přepínač i karta země se z těch metadat
vygenerují samy.

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

Redakce nesahá do kódu:

| Co | Kde |
|---|---|
| Encyklopedické heslo | `src/content/news/<slug>.md` (Markdown + frontmatter) |
| Doplňky portrétu regionu (timeline, mapy, zdroje, FAQ) | `src/content/regions/<slug>.json` |
| Text profilu země | `src/content/countries/<slug>.md` |
| Definice regionů a jejich barvy | `src/data/regions.ts` |

Země bez redakčního textu mají profil složený z importovaných dat, takže žádná
ze 190+ zemí nezeje prázdnotou.

---

## Struktura

```
scripts/          hromadné importy dat (geodata, indikátory)
src/data/         regiony (ruční) + vygenerované číselníky
src/lib/          datová vrstva, fulltext, indikátory
src/components/   UI; map/ = globus a jeho ovládání
src/app/(map)/    routy s globusem – /, /region, /country, /entry, /view
src/app/(pages)/  routy bez globusu – /about, /entries, /support
src/content/      redakční obsah
public/data/      hranice zemí pro mapu
```

Globus je namontovaný v `src/app/(map)/layout.tsx`, takže při přechodu mezi
routami nepřenačítá. Stránky mu jen řeknou, kam se má dívat, komponentou
`<MapFocus />`.

---

## Co ještě chybí

- **Vektorové dlaždice.** `public/data/countries.geo.json` má 1,7 MB. Pro
  produkci doporučuji převést hranice na vektorové dlaždice (tippecanoe → PMTiles);
  ušetří to první načtení a umožní detailnější hranice při zoomu.
- **Jazykové mutace** (bod 5 zadání) – routy jsou připravené na prefix `/[locale]`,
  ale překlady zatím nejsou.
- **Platební brána** na `/support`.
- **AI audioverze hesel** (bod 4 zadání).
- **UX testování** (bod 7 zadání).

---

## Zdroje dat

Hranice a názvy zemí: [Natural Earth](https://www.naturalearthdata.com/) (public domain).
Datové vrstvy: [Our World in Data](https://ourworldindata.org/) (CC BY), původní
zdroje jsou uvedené u každé vrstvy. Satelitní podklad: Esri World Imagery nebo MapTiler.
