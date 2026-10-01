#!/usr/bin/env node
/**
 * Production build into .next-build so it does not break a running `npm run dev`.
 * Windows has no `VAR=x cmd`, hence a script rather than a one-line npm script.
 */
import { spawn } from "node:child_process";

const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, NEXT_DIST_DIR: ".next-build" },
});

child.on("exit", (code) => process.exit(code ?? 1));
