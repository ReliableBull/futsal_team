#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const [command, ...input] = process.argv.slice(2);
if (!["dev", "start"].includes(command)) throw new Error("Usage: node scripts/run-server.mjs <dev|start> [--mode platform|legacy] [Next.js options]");
require("@next/env").loadEnvConfig(process.cwd(), command === "dev");
const args = [];
let mode = process.env.APP_MODE || "platform";
for (let i = 0; i < input.length; i++) {
  if (input[i] === "--mode") mode = input[++i];
  else if (input[i].startsWith("--mode=")) mode = input[i].slice(7);
  else args.push(input[i]);
}
if (!["platform", "legacy"].includes(mode)) throw new Error("APP_MODE / --mode must be platform or legacy");
console.log(`Starting ARENA in ${mode} mode`);
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), command, ...args], {
  stdio: "inherit", env: { ...process.env, APP_MODE: mode }
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 0));
