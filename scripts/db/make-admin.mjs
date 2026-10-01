// One-off admin setup (ARCHITEKTURA 7.3, PLAN C5).
//
// Otherwise only an admin can invite an admin; the first admin(s) are therefore
// created here, with the service key, after that person's first Google sign-in
// (the profile must already exist).
//
// Usage (local only, keys from .env.deploy.local or the environment):
//   node scripts/db/make-admin.mjs --project prod|dev email@example.org [other@…]
import { readFileSync } from "node:fs";

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
    }
  } catch {
    // the file is optional
  }
}
loadEnv(".env.deploy.local");

const args = process.argv.slice(2);
const projectIndex = args.indexOf("--project");
const target = projectIndex >= 0 ? args[projectIndex + 1] : null;
const emails = args.filter((arg, i) => i !== projectIndex && i !== projectIndex + 1);

if (!["prod", "dev"].includes(target) || emails.length === 0) {
  console.error("Usage: node scripts/db/make-admin.mjs --project prod|dev email@example.org");
  process.exit(1);
}

const ref = target === "prod" ? "ewbzkxialhtwuqlenjof" : process.env.SUPABASE_DEV_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN or project ref.");
  process.exit(1);
}

// Via the Management API (SQL as owner, auth.uid() is null → the guard
// triggers let it through, and the change log records it).
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
    console.error(`✗ ${email}: invalid e-mail`);
    continue;
  }
  const rows = await sql(
    `update public.profiles set role_id = 'admin', kind = 'staff', status = 'active'
     where lower(email) = lower(${literal(email)}) and deleted_at is null
     returning email`,
  );
  if (rows.length) console.log(`✓ ${email} is admin (${target})`);
  else console.log(`… ${email}: profile does not exist yet — they must sign in with Google first`);
}
