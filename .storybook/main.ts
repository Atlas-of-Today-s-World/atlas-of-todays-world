import type { StorybookConfig } from "@storybook/nextjs-vite";

/**
 * Katalog sdílených dílů (ARCHITEKTURA 15, PLAN A2.7): ui/, atlas/, portrait/
 * a admin/. Každá nová sdílená komponenta dostane story vedle sebe.
 */
const config: StorybookConfig = {
  framework: "@storybook/nextjs-vite",
  stories: ["../src/components/**/*.stories.tsx"],
  staticDirs: ["../public"],
  core: { disableTelemetry: true },
};

export default config;
