#!/usr/bin/env node
/**
 * Produkční build do .next-build, aby nesestřelil běžící `npm run dev`.
 * Windows nemá `VAR=x cmd`, proto je to skript a ne jednořádkový npm script.
 */
import { spawn } from "node:child_process";

const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, NEXT_DIST_DIR: ".next-build" },
});

child.on("exit", (code) => process.exit(code ?? 1));
