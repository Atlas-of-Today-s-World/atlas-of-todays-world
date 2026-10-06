# Otevřené otázky

> Část architektonické dokumentace Atlas of Today's World — přehled a mapa kapitol
> v [`ARCHITEKTURA.md`](../../ARCHITEKTURA.md). Čísla kapitol (§) se nemění: kód je
> cituje jako „ARCHITEKTURA x.y".

## 14. Otevřené otázky

1. **Doména pro e-maily (SMTP)**: kdo spravuje DNS `atlasoftodaysworld.org`? Bez ověřené domény nelze posílat
   přihlašovací e-maily neomezenému okruhu lidí → do té doby použít přihlášení přes Google.
2. ~~Druhý Supabase projekt (dev)~~ — **založen 2026-09-30** (`atlas-dev`, Frankfurt).
3. **Google Cloud projekt** pro OAuth klienta — kdo ho založí a pod jakým účtem (doporučeno účet organizace Atlas).
4. ~~Platnost pozvánky a doménové omezení~~ — **rozhodnuto 2026-09-30:** 5 dní, bez omezení domény.
5. **Jazyky** (P15) a **audio** (R4) — potvrzení rozsahu před návrhem tabulky `translations` a bucketu `audio`.
6. **Platby** — Stripe Payment Links (brief) vs. hosted Checkout + webhook (plán provozu).
