# Sdílená ukázka Atlasu

Jedna HTML stránka s celým globusem: kreslí se na canvas přes d3-geo, data i
geometrii má vlepené uvnitř. Nepotřebuje server ani síť, takže se dá poslat
odkazem, otevřít z disku nebo vnořit do cizího webu.

## Sestavení

```bash
npm run demo:geo     # geometrie z public/data/countries.geo.json (plná + hrubá)
npm run demo:data    # obsah z běžící aplikace (npm run dev)
npm run demo:build   # slepí demo/atlas.html
```

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
