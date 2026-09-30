// Jednorázové nastavení admina (ARCHITEKTURA 7.3, PLAN C5).
//
// Admina jinak zve jen admin; první admin(y) proto vznikají tady, servisním
// klíčem, po prvním přihlášení dotyčného přes Google (profil už musí existovat).
//
// Použití (jen lokálně, klíče z .env.deploy.local nebo prostředí):
//   node scripts/db/make-admin.mjs --project prod|dev email@example.org [další@…]
import { readFileSync } from "node:fs";

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
    }
  } catch {
    // soubor není povinný
  }
}
loadEnv(".env.deploy.local");

const args = process.argv.slice(2);
const projectIndex = args.indexOf("--project");
const target = projectIndex >= 0 ? args[projectIndex + 1] : null;
const emails = args.filter((arg, i) => i !== projectIndex && i !== projectIndex + 1);

if (!["prod", "dev"].includes(target) || emails.length === 0) {
  console.error("Použití: node scripts/db/make-admin.mjs --project prod|dev email@example.org");
  process.exit(1);
}

const ref = target === "prod" ? "ewbzkxialhtwuqlenjof" : process.env.SUPABASE_DEV_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error("Chybí SUPABASE_ACCESS_TOKEN nebo ref projektu.");
  process.exit(1);
}

// Přes Management API (SQL jako vlastník, auth.uid() je null → ochranné
// triggery pustí, záznam změn to zapíše).
async function sql(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(body));
  return body;
}

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;

for (const email of emails) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`✗ ${email}: neplatný e-mail`);
    continue;
  }
  const rows = await sql(
    `update public.profiles set role_id = 'admin', kind = 'staff', status = 'active'
     where lower(email) = lower(${literal(email)}) and deleted_at is null
     returning email`,
  );
  if (rows.length) console.log(`✓ ${email} je admin (${target})`);
  else console.log(`… ${email}: profil zatím neexistuje — ať se nejdřív přihlásí přes Google`);
}
