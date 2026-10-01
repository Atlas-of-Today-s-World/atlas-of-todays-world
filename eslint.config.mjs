import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";

// Pravidla vychází z ARCHITEKTURA.md kap. 8 (bezpečnost) a 15 (deduplikace).
const config = [
  {
    ignores: [
      ".next/**",
      ".next-build/**",
      ".next-dev/**",
      "node_modules/**",
      "demo/**",
      "public/maplibre/**",
      "test-results/**",
      "playwright-report/**",
      "coverage/**",
      "next-env.d.ts",
      "src/lib/db/types.gen.ts",
    ],
  },
  ...nextVitals,
  ...nextTs,
  security.configs.recommended,
  {
    rules: {
      // Dynamický přístup k objektům je v datovém kódu běžný a bezpečný (klíče
      // jsou ISO kódy a slugy z vlastních dat); pravidlo dává hlavně šum.
      "security/detect-object-injection": "off",
      // Pravidla pro React Compiler (eslint-config-next 16). Stávající kód je
      // porušuje ve vzorech, které dnes fungují (ref s poslední hodnotou v
      // globusu, setState v efektu po načtení, Date.now v serverové stránce);
      // přepis je samostatný úkol A11 v PLAN-REALIZACE.md, do té doby varování.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Supabase jen přes lib/supabase (správný klíč na správném místě).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@supabase/supabase-js",
              message: "Použij klienta z @/lib/supabase/* (ARCHITEKTURA 4.1).",
              allowTypeImports: true,
            },
          ],
        },
      ],
      // HTML jen přes <SafeHtml> (ARCHITEKTURA 5.1, 8.3).
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Vkládej HTML jen přes <SafeHtml> (ARCHITEKTURA 8.3).",
        },
      ],
    },
  },
  {
    // Místa, kde je vložení HTML legitimní: SafeHtml samotná a JSON-LD
    // (escapované přes jsonLdHtml).
    files: ["src/components/atlas/SafeHtml.tsx", "src/components/JsonLd.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    files: ["src/lib/supabase/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Node skripty a konfigurace běží mimo prohlížeč a čtou soubory z cest,
    // které si samy skládají.
    files: ["scripts/**", "supabase/**", "*.config.*", "tests/**"],
    rules: {
      "security/detect-non-literal-fs-filename": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default config;
