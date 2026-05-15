import { existsSync, mkdirSync, closeSync, openSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dbPath = join(root, "prisma", "dev.db");

mkdirSync(dirname(dbPath), { recursive: true });

if (!existsSync(dbPath)) {
  closeSync(openSync(dbPath, "w"));
}
