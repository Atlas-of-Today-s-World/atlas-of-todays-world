import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" v testech nic nehlídá (běží se v Node, ne v bundlu klienta).
      "server-only": fileURLToPath(new URL("./tests/unit/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      thresholds: {
        // ARCHITEKTURA 9.2: bezpečnostní utility musí být pokryté celé.
        "src/lib/security/**": { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
