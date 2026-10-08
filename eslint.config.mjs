import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";

// Rules follow ARCHITEKTURA.md ch. 8 (security) and 15 (deduplication).

// HTML only via <SafeHtml> (ARCHITEKTURA 5.1, 8.3).
const NO_RAW_HTML = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message: "Vkládej HTML jen přes <SafeHtml> (ARCHITEKTURA 8.3).",
};
// Public URLs only via config/routes.ts (ARCHITEKTURA 15): no `/country/${slug}` by hand.
const NO_HAND_BUILT_ROUTE = {
  selector:
    "TemplateLiteral > TemplateElement:first-child[value.raw=/^[/](country|region|global-issue|news|authors|view|topics)[/]/]",
  message: "Build public URLs with routes.* from @/config/routes (ARCHITEKTURA 15).",
};

const config = [
  {
    ignores: [
      ".next/**",
      ".next-build/**",
      ".next-dev/**",
      "node_modules/**",
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
      "no-restricted-syntax": ["error", NO_RAW_HTML, NO_HAND_BUILT_ROUTE],
    },
  },
  {
    // Tests spell the expected URLs out on purpose.
    files: ["src/**/*.test.{ts,tsx}"],
    rules: { "no-restricted-syntax": ["error", NO_RAW_HTML] },
  },
  {
    // Places where injecting HTML is legitimate: SafeHtml itself, JSON-LD
    // (escaped via jsonLdHtml) and the fixed pre-paint script (no data in it).
    files: [
      "src/components/atlas/SafeHtml.tsx",
      "src/components/JsonLd.tsx",
      "src/components/PrePaintScript.tsx",
    ],
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
