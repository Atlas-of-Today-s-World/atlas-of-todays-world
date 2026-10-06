# Atlas of Today's World — architektura a postupové standardy

> **Stav:** návrh k realizaci · **Verze:** 1.0 · **Datum:** 2026-09-30
> **Platí pro:** všechen kód v tomto repozitáři (aplikace `src/`, databáze `supabase/`, skripty, CI).
> **Závaznost:** kapitoly 3–10 jsou *standardy* — odchylka jen s poznámkou v PR a zápisem do [ADR](docs/architecture/10-rozhodnuti-adr.md#11-rozhodnutí-adr).
> Konkrétní nálezy ze security review současného stavu jsou v neveřejném `docs/architektura-nalezy.md`
> (repo je veřejné); tady se na ně odkazuje jen identifikátorem (`SEC-xx`, `DB-xx`).

Dokumentace je rozdělená do souborů v [`docs/architecture/`](docs/architecture/) — jeden
soubor na téma, čísla kapitol (§) zůstávají, takže odkazy v kódu („ARCHITEKTURA 6.3")
dál platí: kapitola 6 je v souboru Databáze, oddíl 6.3 v něm.

| § | Kapitola |
|---|---|
| §1 | [Cíl a výchozí stav](docs/architecture/01-cil-a-principy.md) |
| §2 | [Architektonické principy](docs/architecture/01-cil-a-principy.md) |
| §3 | [Infrastruktura a prostředí](docs/architecture/02-infrastruktura.md) |
| §4 | [Aplikační architektura](docs/architecture/03-aplikace.md) |
| §5 | [Komponenty a UI](docs/architecture/04-komponenty-ui.md) |
| §6 | [Databáze](docs/architecture/05-databaze.md) |
| §7 | [Autentizace, role a oprávnění](docs/architecture/06-autentizace-role.md) |
| §8 | [Bezpečnostní standardy](docs/architecture/07-bezpecnost.md) |
| §9 | [Testování](docs/architecture/08-testovani.md) |
| §10 | [CI/CD a provoz](docs/architecture/09-ci-cd-provoz.md) |
| §11 | [Rozhodnutí (ADR)](docs/architecture/10-rozhodnuti-adr.md) |
| §12 | [Plán realizace](docs/architecture/11-plan-realizace.md) |
| §13 | [Postupové standardy (checklisty)](docs/architecture/12-postupy-a-standardy.md) |
| §14 | [Otevřené otázky](docs/architecture/13-otevrene-otazky.md) |
| §15 | [Jednotnost komponent a deduplikace](docs/architecture/04-komponenty-ui.md) |
| §16 | [Další standardy správné webové aplikace](docs/architecture/12-postupy-a-standardy.md) |

**Aktuální stav a technický dluh:** [analýza architektury (říjen 2026)](docs/architecture/analyza-2026-10.md)
— mapa vrstev a datových toků, porušení hranic modulů, deset hlavních rizik a co už je uklizené.
