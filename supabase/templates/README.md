# E-mailové šablony Supabase Auth (PLAN G1)

Šablony jsou Go templates, které renderuje Supabase Auth. Jazyk se volí podle
`.Data.locale` (user_metadata), které posílají `requestEmailCode` a
`createInvitation` (`en` | `cs`); bez něj angličtina.

- `magic_link.html` — kód pro přihlášení existujícího účtu (signInWithOtp)
- `confirmation.html` — kód pro první přihlášení (nový účet čtenáře)
- `invite.html` — pozvánka do týmu (inviteUserByEmail)

Lokálně je načte `supabase/config.toml` ([auth.email.template.*]). Na hostovaných
projektech (atlas-dev, produkce) se nahrají `supabase config push`, až bude
vlastní SMTP (U5) — vestavěný odesílatel Supabase je jen pro testy (pár e-mailů
za hodinu, jen členům organizace).
