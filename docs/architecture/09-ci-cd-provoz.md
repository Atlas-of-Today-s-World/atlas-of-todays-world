# CI/CD a provoz

> Část architektonické dokumentace Atlas of Today's World — přehled a mapa kapitol
> v [`ARCHITEKTURA.md`](../../ARCHITEKTURA.md). Čísla kapitol (§) se nemění: kód je
> cituje jako „ARCHITEKTURA x.y".

## 10. CI/CD a provoz

### 10.1 Pipeline (GitHub Actions)

```
PR:   install (npm ci) → typecheck → lint → unit → db tests (PGlite) → integrace (supabase start)
      → build → deploy preview (dev DB) → e2e + axe proti preview → Lighthouse (varování)
main: totéž bez preview → supabase db push (produkce) → vercel deploy --prod → smoke test produkce
noc:  zašifrovaná záloha DB · npm audit · CodeQL
```

- Workflow soubory: `ci.yml` (PR), `deploy.yml` (main), `nightly.yml`.
- Ruční jednorázové workflow s volbou `dev`/`prod` (produkce jen z `main`, přes heslo DB a psql): `import-topics.yml` (témata ze starého webu), `backfill-resource-previews.yml` (náhledové obrázky zdrojů bez obrázku; bez volby „apply" jen výpis).
- `main` je chráněná: merge jen přes PR se zelenými checky; žádné force-push (výjimka jen s dohodou vlastníka).
- Nasazení na Vercel jde **výhradně** z Actions přes `VERCEL_TOKEN` (Vercel Git integrace je vypnutá).
- Pořadí na `main`: **migrace před nasazením aplikace**; proto musí být migrace zpětně kompatibilní (6.3).
- Deploy nesmí mít ruční kroky; rollback = `vercel rollback` + případná opravná migrace.

### 10.2 Provoz a monitoring

- Logy: Vercel runtime logs (Hobby: 1 h) → pro koncept dostačující; pro provoz napojit Sentry (Free) na chyby.
- Uptime: Supabase Free se uspí po 7 dnech bez provozu → noční workflow provede lehký dotaz (udržuje projekt aktivní)
  a zároveň slouží jako health check.
- Audit log a revize jsou nástroj pro vyšetření změn obsahu.
- Metriky výkonu: Vercel Speed Insights (Free) nebo Lighthouse CI historie.
