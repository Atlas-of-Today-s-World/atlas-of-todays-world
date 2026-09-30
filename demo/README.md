# Sdílená ukázka Atlasu

Jedna HTML stránka s celým globusem: kreslí se na canvas přes d3-geo, data i
geometrii má vlepené uvnitř. Nepotřebuje server ani síť, takže se dá poslat
odkazem, otevřít z disku nebo vnořit do cizího webu.

## Sestavení

```bash
npm run demo:geo      # geometrie z public/data/countries.geo.json (plná + hrubá)
npm run demo:data     # obsah z běžící aplikace (npm run dev)
npm run demo:metrics  # surové hodnoty ukazatelů (barvy si stránka počítá sama)
npm run demo:build    # slepí demo/atlas.html
```

`atlas-filled.js` je psaný ručně a do buildu vstupuje jako ostatní vlepované
soubory. Nese obsah, který na webu zatím není — dopsané portréty osmi regionů,
pojmenované vlastní celky, medailonky zemí a novinky navíc. V ukázce se zapíná
přepínačem **Content** nad mapou a všude nese štítek „demo"; stránka `#/compare`
staví obojí vedle sebe. Eastern Europe & Central Asia tam schválně chybí, protože
ten portrét je na webu hotový a slouží jako měřítko.

Administrace stojí za přihlášením bez hesla: vybere se účet a s ním role.
Oprávnění drží matice (sekce × role × zobrazit/přidat/upravit/smazat), kterou
jde v administraci přenastavit — smí to `admin` a `permission admin`. Dvě věci
se do mřížky nevejdou a mají vlastní nastavení u role: čí články smí role
upravovat (`newsScope`) a kam až sahá její schvalování (`approvalScope`);
přidělené země a autory má u sebe konkrétní účet. Platební brána je předstíraná
a přijme jen testovací číslo karty, které zveřejňuje Stripe.

Vlastní plochy (`atlas.areas.v1`) jsou obrazce kreslené přímo na kouli nebo
zadané souřadnicemi. Vznikly proto, že speciální celek se skládá z celých zemí,
takže na Havaj neukáže — je to kus USA. Plocha má vlastní jméno a článek se na
ni věší napřímo (`entry.area`), bez volby země. Na kouli mají přednost před zemí
pod sebou a mají svou polohu přepínače nad mapou.

Klíče v `localStorage`: `atlas.session.v1`, `atlas.team.v1`, `atlas.roles.v1`,
`atlas.areas.v1`, `atlas.settings.v1`.

Administrace začíná **přehledem** (co na přihlášeného čeká, dlaždice s čísly,
pokrytí regionů, poslední změny) a končí **vlastním účtem** — obojí má každý
přihlášený. **Site settings** jsou vlastní řádek v matici oprávnění (výchozí
jen admin). Co se v ukázce projeví hned, nese štítek „Applies now": výchozí
pohled a vrstva globusu, popisky zemí, délka Hot News, řádek s adresou, rychlost
čtení, formát dat, jméno webu a oznámení o údržbě. Pravidla, která hlídá
databáze (schválení před zveřejněním, důvod při vrácení), jsou vidět, ale nejdou
vypnout. Článek jde autorovi vrátit jen s důvodem, stejně jako přes
`send_back_entry` v Supabase.

## Testy

```bash
npm run test:demo     # sestaví atlas.html a pustí demo/tests (počítač i telefon)
```

Konfigurace je `playwright.demo.config.ts`, běží proti souboru bez serveru a
každý test má čistý prohlížeč. Pokrývají role a přístup do sekcí, přehled,
nastavení a jejich dopad na veřejný globus, záznam změn, vlastní účet, cestu
článku přes vrácení s důvodem až na web a mobilní rozvržení (menu, hledání,
list s obsahem, vysouvací menu administrace, tabulky jako karty, nic nepřetéká
do boku).

Ukázka si barvy vrstev počítá z `atlas-metrics.js`, ne z hotových `colorSets`
v `atlas-data.js`. Jedině tak jde v administraci měnit paleta, sytost, počet
stupňů i rozsah škály — a jedině tak jdou přidávat vlastní ukazatele. Vlastní
ukazatele, přebarvení a ručně zadané hodnoty žijí v prohlížeči návštěvníka
(`localStorage`, klíče `atlas.theme.v1`, `atlas.customMetrics.v1`,
`atlas.metricValues.v1`).

`demo/atlas.html` je výsledek (~1,2 MB) a jediný soubor, který se nikam
nekopíruje po částech – všechno je v něm.

## Vnoření do webu (Webflow)

Stránka umí i „holou" podobu bez vlastní hlavičky, vyhledávání a poznámky
o ukázce – zapíná ji `?embed=1`. Do Webflow se přidá blokem **Embed**:

```html
<div style="position:relative;width:100%;height:620px">
  <iframe
    src="https://<kam-to-nahrajete>/atlas.html?embed=1"
    title="Atlas of Today's World – interactive globe"
    loading="lazy"
    style="position:absolute;inset:0;width:100%;height:100%;border:0"
  ></iframe>
</div>
```

Výšku klidně změň; globus se sám přizpůsobí a pod 760 px šířky se profil země
otevírá jako spodní panel.

Soubor musí ležet na nějakém statickém hostingu (Vercel, Netlify, GitHub Pages,
vlastní server). Artefakt na claude.ai slouží ke sdílení odkazem, ne k vnoření
do cizí stránky.

## Proč tohle není totéž co aplikace

Ukázka kreslí politickou mapu, ne satelitní podklad – vnořená stránka nesmí
stahovat dlaždice. Chybí taky chatbot, který potřebuje klíč k API na serveru.
Až bude nasazená aplikace v `src/`, hero na webu může místo téhle stránky
ukazovat rovnou ji, i se satelitem.
