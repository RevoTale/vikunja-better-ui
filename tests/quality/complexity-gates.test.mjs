import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const config = path.join(process.cwd(), ".golangci.yml");

async function lintFixture(t, rule, body) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vbu-complexity-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, "go.mod"), "module fixture\n\ngo 1.27.0\n");
  await writeFile(path.join(directory, "fixture.go"), `// Package fixture exercises quality gates.\npackage fixture\n${body}`);
  return spawnSync("golangci-lint", ["run", "--config", config, `--enable-only=${rule}`, "./..."], {
    cwd: directory, encoding: "utf8",
  });
}

function branching(conditions) {
  const branches = Array.from({ length: conditions }, (_, i) => `if value == ${i} { value++ }`).join("\n");
  return `func Value(value int) int {\n${branches}\nreturn value\n}\n`;
}

test("Go complexity thresholds accept the maximum and reject the next score", async (t) => {
  for (const [rule, acceptedBranches] of [["gocyclo", 14], ["gocognit", 20]]) {
    const valid = await lintFixture(t, rule, branching(acceptedBranches));
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    const invalid = await lintFixture(t, rule, branching(acceptedBranches + 1));
    assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
    assert.match(invalid.stdout, new RegExp(rule));
  }
});

test("Go function limits include comments and enforce statement count", async (t) => {
  const long = await lintFixture(t, "funlen", `func Value() int {\n${"// explanation\n".repeat(61)}return 1\n}\n`);
  assert.equal(long.status, 1, long.stdout + long.stderr);
  assert.match(long.stdout, /too long/);
  const statements = await lintFixture(t, "funlen", `func Value(v int) int { ${"v++;".repeat(41)} return v }`);
  assert.equal(statements.status, 1, statements.stdout + statements.stderr);
  assert.match(statements.stdout, /too many statements/);
});

test("Go suppressions need a specific rule and explanation", async (t) => {
  for (const suppression of ["//nolint", "//nolint:errcheck", "//nolint:errcheck // Nothing here actually needs suppression."]) {
    const result = await lintFixture(t, "nolintlint,errcheck", `${suppression}\nfunc Value() int { return 1 }\n`);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /nolintlint/);
  }
});

test("Go function and width limits accept valid code and reject long lines", async (t) => {
  const valid = await lintFixture(t, "funlen,lll", "// Value returns its input.\nfunc Value(value int) int { return value }\n");
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  const invalid = await lintFixture(t, "lll", `// ${"x".repeat(118)}\nfunc Value() int { return 1 }\n`);
  assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
  assert.match(invalid.stdout, /lll/);
});
