import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vbu-tool-gates-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, "go.mod"), "module github.com/RevoTale/vikunja-better-ui\n\ngo 1.27.0\n");
  return directory;
}

test("real Go formatter and modernization output fail the gate", async (t) => {
  const directory = await fixture(t);
  const filename = path.join(directory, "example.go");
  await writeFile(filename, "package example\nfunc Value( )interface{} { return nil }\n");
  const gate = path.join(root, "tests/quality/empty-output.sh");
  for (const command of [["gofmt", "-d", filename], ["go", "fix", "-diff", "./..."]]) {
    const result = spawnSync("sh", [gate, ...command], { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /@@/);
  }
});

test("Go lint rejects missing docs and forbidden service dependencies", async (t) => {
  const directory = await fixture(t);
  await mkdir(path.join(directory, "internal/service"), { recursive: true });
  await mkdir(path.join(directory, "internal/graphql"), { recursive: true });
  await writeFile(path.join(directory, "internal/graphql/value.go"), "package graphql\nconst Value = 1\n");
  await writeFile(path.join(directory, "internal/service/value.go"),
    'package service\nimport "github.com/RevoTale/vikunja-better-ui/internal/graphql"\nfunc Value() int { return graphql.Value }\n');
  const result = spawnSync("golangci-lint", ["run", "--config", path.join(root, ".golangci.yml"),
    "--enable-only=revive,depguard", "./..."], { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /package-comments/);
  assert.match(result.stdout, /exported/);
  assert.match(result.stdout, /depguard/);
});

async function biome(t, source) {
  const directory = await mkdtemp(path.join(root, "frontend/src/quality-probe-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "probe.ts");
  await writeFile(filename, source);
  return spawnSync("pnpm", ["exec", "biome", "lint", filename], {
    cwd: path.join(root, "frontend"), encoding: "utf8",
  });
}

test("Biome rejects oversized files and functions while accepting small code", async (t) => {
  const small = await biome(t, "export const value = 1;\n");
  assert.equal(small.status, 0, small.stderr);
  const file = await biome(t, Array.from({ length: 301 }, (_, i) => `export const value${i} = ${i};\n`).join(""));
  assert.equal(file.status, 1);
  assert.match(file.stderr, /noExcessiveLinesPerFile/);
  const fn = await biome(t, `export function value(value: number) {\n${"  value += 1;\n".repeat(81)}return value;\n}\n`);
  assert.equal(fn.status, 1);
  assert.match(fn.stderr, /noExcessiveLinesPerFunction/);
});

test("Biome complexity accepts 15 and rejects 16 independent branches", async (t) => {
  for (const [count, status] of [[15, 0], [16, 1]]) {
    const branches = Array.from({ length: count }, (_, i) => `if (value === ${i}) value++;`).join("\n");
    const result = await biome(t, `export function calculate(value: number) {\n${branches}\nreturn value;\n}\n`);
    assert.equal(result.status, status, result.stdout + result.stderr);
    if (status) assert.match(result.stderr, /noExcessiveCognitiveComplexity/);
  }
});

test("Biome excludes generated routes, GraphQL and shadcn but checks handwritten files", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vbu-biome-scope-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const config = JSON.parse(await readFile(path.join(root, "frontend/biome.json"), "utf8"));
  config.vcs.enabled = false;
  await writeFile(path.join(directory, "biome.json"), JSON.stringify(config));
  const oversized = Array.from({ length: 301 }, (_, i) => `export const value${i} = ${i};\n`).join("");
  for (const name of ["src/routeTree.gen.ts", "src/graphql/generated.ts", "src/components/ui/button.tsx"]) {
    await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
    await writeFile(path.join(directory, name), oversized);
  }
  const handwritten = path.join(directory, "src/handwritten.ts");
  await writeFile(handwritten, "export const value = 1;\n");
  const lint = () => spawnSync("pnpm", ["exec", "biome", "lint", "--config-path", directory, directory], {
    cwd: path.join(root, "frontend"), encoding: "utf8",
  });
  const valid = lint();
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  await writeFile(handwritten, oversized);
  const invalid = lint();
  assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
  assert.match(invalid.stderr, /noExcessiveLinesPerFile/);
});
