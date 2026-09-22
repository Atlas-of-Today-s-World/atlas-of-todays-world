#!/usr/bin/env node
/**
 * Rychlé kontroly proti běžící aplikaci.
 *
 * Neotvírá prohlížeč: stáhne stránky a ověří, že v nich je to, co tam podle
 * zadání být má. Smyslem je chytit regrese dřív, než se na ně někdo proklikne –
 * hlavně věci, které se snadno rozbijí přejmenováním nebo přesunem routy.
 *
 * Použití: npm run dev (v jiném okně) a pak `npm run test:smoke`
 *          nebo `BASE_URL=https://… npm run test:smoke` proti nasazené verzi.
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";

let passed = 0;
const failures = [];

async function check(name, run) {
  try {
    await run();
    passed += 1;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (error) {
    failures.push({ name, message: error.message });
    process.stdout.write(`  ✗ ${name}\n      ${error.message}\n`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function get(path, options = {}) {
  const response = await fetch(BASE + path, { redirect: "manual", ...options });
  const body = response.headers
    .get("content-type")
    ?.includes("application/json")
    ? JSON.stringify(await response.json())
    : await response.text();
  return { status: response.status, headers: response.headers, body };
}

/**
 * Text, který návštěvník opravdu vidí.
 *
 * Next posílá ve stránce i svoje data pro hydrataci (uvnitř <script>), takže
 * hledat v celém HTML by hlásilo nálezy, které na obrazovce nejsou. React
 * navíc rozděluje text komentáři `<!-- -->`, proto se vyhazují taky.
 */
function visible(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&rsquo;/g, "'")
    .replace(/\s+/g, " ");
}

/** Vytáhne ze stránky všechny bloky strukturovaných dat. */
function jsonLd(html) {
  const blocks = [
    ...html.matchAll(
      /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ];
  return blocks.flatMap((block) => {
    const parsed = JSON.parse(block[1].replace(/\\u003c/g, "<"));
    return Array.isArray(parsed) ? parsed : [parsed];
  });
}

async function main() {
  process.stdout.write(`Kontroly proti ${BASE}\n\n`);

  process.stdout.write("Mapa a rozcestníky\n");
  for (const path of ["/", "/news", "/about", "/patrons", "/search"]) {
    await check(`${path} odpovídá`, async () => {
      const { status } = await get(path);
      assert(status === 200, `čekal jsem 200, dostal ${status}`);
    });
  }

  process.stdout.write("\nPortrét regionu\n");
  await check("otevře se rovnou úplný portrét", async () => {
    const { status, body } = await get("/region/middle-east-north-africa");
    assert(status === 200, `status ${status}`);
    const text = visible(body);
    assert(text.includes("Key indicators"), "chybí sekce Key indicators");
    assert(
      !text.includes("A Comprehensive Portrait"),
      "zůstal štítek portrétu, který měl zmizet",
    );
    assert(
      !/\d+ news items? published/.test(text),
      "zůstalo počítadlo novinek, které mělo zmizet",
    );
  });

  await check("nenapsané sekce mají výzvu k podpoře", async () => {
    const text = visible((await get("/region/east-asia")).body);
    assert(
      text.includes("Help Us Complete It By Joining Atlas Patrons"),
      "chybí výzva u prázdného portrétu",
    );
    assert(text.includes("Not written yet"), "chybí označení prázdné sekce");
  });

  await check("ukazatele mají data i u prázdného regionu", async () => {
    const text = visible((await get("/region/east-asia")).body);
    assert(text.includes("Key indicators"), "chybí ukazatele");
    assert(/\d+ of \d+ countries/.test(text), "chybí pokrytí zemí u ukazatele");
    assert(text.includes("Human Development Index"), "chybí HDI");
  });

  await check("stará adresa /full přesměrovává", async () => {
    const { status, headers } = await get("/region/east-asia/full");
    assert(status === 308, `čekal jsem 308, dostal ${status}`);
    assert(
      headers.get("location")?.endsWith("/region/east-asia"),
      `špatný cíl: ${headers.get("location")}`,
    );
  });

  process.stdout.write("\nPanel země\n");
  await check("drobečková navigace do regionu", async () => {
    const text = visible((await get("/country/ukraine")).body);
    assert(
      text.includes("Eastern Europe & Central Asia"),
      "chybí region v drobečkové navigaci",
    );
    assert(text.includes("Explore the region"), "chybí karta regionu");
    assert(
      !/\d+ news items? published/.test(text),
      "zůstalo počítadlo novinek",
    );
  });

  await check("Kosovo má profil i data", async () => {
    const { status, body } = await get("/country/kosovo");
    assert(status === 200, `status ${status}`);
    const text = visible(body);
    assert(text.includes("Life expectancy"), "chybí ukazatele");
    assert(text.includes("Disputed territory"), "chybí poznámka ke statusu");
    assert(text.includes("1244"), "chybí rezoluce, o kterou se status opírá");
  });

  await check("Západní Sahara je samostatná", async () => {
    const { status, body } = await get("/country/western-sahara");
    assert(status === 200, `status ${status}`);
    assert(
      visible(body).includes("Non-Self-Governing"),
      "chybí poznámka o nesamosprávném území",
    );
  });

  process.stdout.write("\nGlobal Issues\n");
  await check("první global issue je válka na Ukrajině", async () => {
    const { status, body } = await get("/global-issue/russia-ukraine-war");
    assert(status === 200, `status ${status}`);
    const text = visible(body);
    assert(text.includes("Russia–Ukraine War"), "chybí název");
    assert(text.includes("Ukraine"), "chybí země celku");
  });

  await check("stará adresa /special přesměrovává", async () => {
    const { status, headers } = await get("/special/russia-ukraine-war");
    assert(status === 308, `čekal jsem 308, dostal ${status}`);
    assert(
      headers.get("location")?.includes("/global-issue/russia-ukraine-war"),
      `špatný cíl: ${headers.get("location")}`,
    );
  });

  process.stdout.write("\nObsah a vazby\n");
  await check("novinka drží zemi, region i global issue", async () => {
    const text = visible((await get("/news/sahel-coup-belt")).body);
    assert(text.includes("Sub-Saharan Africa"), "chybí region");
    assert(text.includes("Food Insecurity"), "chybí global issue");
  });

  await check("obsah neobsahuje nebezpečné HTML", async () => {
    const { body } = await get("/news/putins-regime");
    // Markdown prochází přes sanitize-html; tohle hlídá, že to platí i po
    // budoucích změnách vykreslování.
    for (const pattern of ["onerror=", "onclick=", "javascript:", "<iframe"]) {
      assert(!body.includes(pattern), `v obsahu je ${pattern}`);
    }
  });

  process.stdout.write("\nStrukturovaná data a SEO\n");
  await check("země má platný JSON-LD", async () => {
    const { body } = await get("/country/ukraine");
    const blocks = jsonLd(body);
    assert(blocks.length > 0, "žádná strukturovaná data");
    assert(
      blocks.some((block) => block["@type"] === "Country"),
      "chybí typ Country",
    );
  });

  await check("sitemap zná regiony i global issues", async () => {
    const { body } = await get("/sitemap.xml");
    assert(body.includes("/region/middle-east-north-africa"), "chybí region");
    assert(!body.includes("/full"), "sitemap ještě nabízí zrušenou /full");
  });

  await check("robots.txt odkazuje na sitemapu", async () => {
    const { body } = await get("/robots.txt");
    assert(body.toLowerCase().includes("sitemap"), "chybí odkaz na sitemapu");
  });

  process.stdout.write("\nBezpečnost\n");
  await check("odpovědi nesou bezpečnostní hlavičky", async () => {
    const { headers } = await get("/");
    assert(headers.get("content-security-policy"), "chybí CSP");
    assert(headers.get("x-content-type-options") === "nosniff", "chybí nosniff");
    assert(headers.get("x-frame-options") === "DENY", "chybí X-Frame-Options");
  });

  await check("administrace je zamčená, když má heslo", async () => {
    const { status } = await get("/admin");
    const locked = status === 307 || status === 404;
    const open = status === 200 && !process.env.ADMIN_TOKEN;
    assert(
      locked || open,
      `s nastaveným ADMIN_TOKEN čekám přesměrování, dostal jsem ${status}`,
    );
  });

  await check("zápis do obsahu chce přihlášení", async () => {
    const { status } = await get("/api/admin/news", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    const guarded = status === 401 || status === 404;
    const openDev = status === 400 && !process.env.ADMIN_TOKEN;
    assert(guarded || openDev, `nečekaný status ${status}`);
  });

  process.stdout.write(
    `\n${passed} v pořádku, ${failures.length} chyb\n`,
  );
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
