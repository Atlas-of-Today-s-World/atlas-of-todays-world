-- =============================================================================
-- Přihlášení a pozvánky e-mailem (PLAN G1) — zatím vypnuté
-- =============================================================================
--
-- Kód je připravený, ale posílat e-maily neomezenému okruhu lidí jde až
-- s vlastním SMTP a ověřenou doménou (U5). Do té doby přepínač zůstává
-- vypnutý; zapíná se v administraci (Role a práva → Přepínače).
-- =============================================================================

insert into public.feature_flags (key, enabled, note)
values ('email_auth', false,
        'Přihlášení kódem z e-mailu a pozvánky e-mailem. Zapnout až s vlastním SMTP (U5).')
on conflict (key) do nothing;
