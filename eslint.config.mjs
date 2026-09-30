import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import security from "eslint-plugin-security";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

// Pravidla vychází z ARCHITEKTURA.md kap. 8 (bezpečnost) a 15 (deduplikace).
const config = [
  {
    ignores: [
      ".next/**",
      ".next-build/**",
      ".next-dev/**",
      "node_modules/**",
      "demo/**",
      "test-results/**",
      "playwright-report/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  security.configs.recommended,
  {
    rules: {
      // Dynamický přístup k objektům je v datovém kódu běžný a bezpečný (klíče
      // jsou ISO kódy a slugy z vlastních dat); pravidlo dává hlavně šum.
      "security/detect-object-injection": "off",
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
