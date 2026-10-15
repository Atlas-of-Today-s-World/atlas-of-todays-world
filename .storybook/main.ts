import type { StorybookConfig } from "@storybook/nextjs-vite";
import { fileURLToPath } from "node:url";

const UPLOAD_ACTIONS = "@/features/uploads/actions";
const UPLOAD_ACTIONS_STUB = fileURLToPath(new URL("./mocks/upload-actions.ts", import.meta.url));

/**
 * Katalog sdílených dílů (ARCHITEKTURA 15, PLAN A2.7): ui/, atlas/, portrait/
 * a admin/. Každá nová sdílená komponenta dostane story vedle sebe; doménové
 * bloky ve features/ (např. vlastní mapa) mohou mít story také.
 */
const config: StorybookConfig = {
  framework: "@storybook/nextjs-vite",
  stories: ["../src/components/**/*.stories.tsx", "../src/features/**/*.stories.tsx"],
  staticDirs: ["../public"],
  core: { disableTelemetry: true },
  // Serverová akce nahrávání (node:crypto) v prohlížeči neběží: editor textu dostane náhradu.
  viteFinal: (vite) => ({
    ...vite,
    plugins: [
      ...(vite.plugins ?? []),
      {
        name: "atlas-stub-upload-actions",
        enforce: "pre",
        resolveId: (id: string) => (id === UPLOAD_ACTIONS ? UPLOAD_ACTIONS_STUB : null),
      },
    ],
  }),
};

export default config;
