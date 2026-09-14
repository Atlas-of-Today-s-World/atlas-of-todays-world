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

Bez `.env.local` běží všechno kromě chatbota (satelitní podklad jede na
bezplatných dlaždicích Esri). Volitelná konfigurace:

```bash
cp .env.example .env.local
```

| Proměnná | K čemu |
|---|---|
| `NEXT_PUBLIC_MAPTILER_KEY` | Satelitní dlaždice MapTileru místo Esri. Pro produkci doporučeno (Esri nemá SLA pro komerční provoz). |
| `ANTHROPIC_API_KEY` | Zapne chatbota v panelu Global Encyclopedia. |
| `ANTHROPIC_MODEL` | Výchozí `claude-sonnet-5`. |
| `NEXT_PUBLIC_SITE_URL` | Kanonická adresa pro sitemapu, robots.txt a og:url. |

---

## Co je hotové

**1. 3D mapa světa (MVP)**

- Satelitní globus, plynulé otáčení i zoom (MapLibre GL JS 5, projekce `globe`).
- Obrysy 242 zemí z Natural Earth, hranice regionů zvýrazněné barvou regionu.
- Kliknutí na zemi → globus doletí na výřez její hlavní pevniny (Lucembursko
  zblízka, Rusko z dálky) a vpravo se otevře karta země se třemi a více daty.
- Zároveň se zvýrazní celý region, ke kterému země patří, a odkaz na jeho profil.
- Portrét regionu i encyklopedické heslo se vykreslují **uvnitř mapy** –
  uživatel s ní neztratí kontakt.

**2. Datové vrstvy (plná verze)**

Přepínač „Encyclopedia view" nabízí 9 datových pohledů s reálnými daty:
HDI, naděje dožití, HDP na obyvatele, politický režim, index volební demokracie,
vnímání korupce, extrémní chudoba, emise CO₂ na obyvatele, podíl uživatelů internetu.
Každý má vlastní legendu, zdroj a samostatnou URL (`/view/hdi`).

**3. Fulltext a chatbot (plná verze)**

- `/api/search` – fulltext (MiniSearch) nad regiony, zeměmi i hesly.
  Dotaz „political situation in Russia" vrátí profil Ruska i heslo o Putinově režimu.
- `/api/chat` – chatbot nad stejným indexem: odpovídá **jen** z obsahu Atlasu
  a ke každé odpovědi připojí odkazy na hesla, ze kterých čerpal.

**Přepínač Countries / Regions**

Na globusu se dá vybírat buď po státech, nebo rovnou po regionech Atlasu – tedy
po těch barevných celcích. V režimu regionů se najetím zvýrazní celý region,
kliknutí otevře jeho profil, naběhnou názvy regionů a hranice států ustoupí.

**SEO a geo optimalizace**

Každý region, země, datová vrstva i heslo mají vlastní předrenderovanou URL
(`/region/…`, `/country/…`, `/view/…`, `/entry/…`). Build vygeneruje ~270
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
| Encyklopedické heslo | `src/content/entries/<slug>.md` (Markdown + frontmatter) |
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
