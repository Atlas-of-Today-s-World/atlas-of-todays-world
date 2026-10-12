/**
 * Lets plain Node load src/ TypeScript modules that import their siblings
 * without an extension (`import { SITE_URL } from "./site"`), as Next and
 * Vitest resolve them. Import this before importing anything from src/.
 */
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const relative = specifier.startsWith("./") || specifier.startsWith("../");
      if (!relative || error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});
