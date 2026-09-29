import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function handwrittenGoLines(source) {
  const preamble = source.split(/^package\s/m, 1)[0] ?? "";
  if (/^\/\/ Code generated .* DO NOT EDIT\.$/m.test(preamble)) return null;
  if (!source) return 0;
  return source.split("\n").length - Number(source.endsWith("\n"));
}

export async function oversizedGoFiles(directory, maxLines = 500) {
  const violations = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") || ["node_modules", "vendor", "dist"].includes(entry.name)) continue;
      violations.push(...(await oversizedGoFiles(filename, maxLines)));
    } else if (entry.isFile() && entry.name.endsWith(".go")) {
      const lines = handwrittenGoLines(await readFile(filename, "utf8"));
      if (lines !== null && lines > maxLines) violations.push(`${filename}: ${lines} lines > ${maxLines}`);
    }
  }
  return violations;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = await oversizedGoFiles(".");
  for (const violation of violations) console.error(violation);
  if (violations.length) process.exitCode = 1;
}
