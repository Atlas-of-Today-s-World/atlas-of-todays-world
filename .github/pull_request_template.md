## Co a proč

<!-- Jednou až dvěma větami. Odkaz na úkol z PLAN-REALIZACE.md (např. A5). -->

## Jak otestováno

- [ ] CI zelené (typecheck, lint, unit, DB testy, build)
- [ ] Ručně / e2e:

## Definition of Done (ARCHITEKTURA 13.1)

- [ ] Nové vstupy mají Zod schéma s limity shodnými s DB
- [ ] Nová data mají RLS a DB test (anon / s právem / bez práva)
- [ ] Žádné tajemství v kódu, žádný citlivý `NEXT_PUBLIC_`
- [ ] Mutace invaliduje správné cache tagy
- [ ] Přístupnost (klávesnice, focus, 44 px)
- [ ] Žádná nová duplicita komponent (ARCHITEKTURA 15), nová závislost zdůvodněná

## Security impact

<!-- Vyplnit, pokud PR mění auth, RLS, migrace, middleware nebo src/lib/security. Jinak „žádný“. -->
