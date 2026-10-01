import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";

// Rules follow ARCHITEKTURA.md ch. 8 (security) and 15 (deduplication).
const config = [
  {
    ignores: [
      ".next/**",
      ".next-build/**",
      ".next-dev/**",
      "node_modules/**",
      "demo/**",
      "public/maplibre/**",
      "storybook-static/**",
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
      // Dynamic object access is common and safe in data code (keys are
      // ISO codes and slugs from our own data); the rule is mostly noise.
      "security/detect-object-injection": "off",
      // React Compiler rules (eslint-config-next 16) apply in full (A11).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Supabase only via lib/supabase (the right key in the right place).
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
      // HTML only via <SafeHtml> (ARCHITEKTURA 5.1, 8.3).
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
    // Places where injecting HTML is legitimate: SafeHtml itself and JSON-LD
    // (escaped via jsonLdHtml).
    files: ["src/components/atlas/SafeHtml.tsx", "src/components/JsonLd.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    files: ["src/lib/supabase/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Node scripts and configs run outside the browser and read files from
    // paths they build themselves.
    files: ["scripts/**", "supabase/**", "*.config.*", "tests/**"],
    rules: {
      "security/detect-non-literal-fs-filename": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default config;
