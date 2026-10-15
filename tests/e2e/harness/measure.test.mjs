import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = new URL("./measure.mjs", import.meta.url);

test("test measurements preserve failing command status and report sampled tree RSS", () => {
  const result = spawnSync(process.execPath, [
    script.pathname,
    process.execPath,
    "-e",
    "setTimeout(() => process.exit(3), 600)",
  ], { encoding: "utf8", timeout: 5_000 });
  assert.equal(result.status, 3);
  const metrics = JSON.parse(result.stderr.trim());
  assert.equal(metrics.code, 3);
  assert.ok(metrics.seconds >= 0.6);
  assert.ok(metrics.samples > 0);
  assert.ok(metrics.peakTreeRssMiB > 0);
});

test("test measurements fail instead of reporting success for missing executables", () => {
  const result = spawnSync(process.execPath, [script.pathname, "/nonexistent-test-command"], {
    encoding: "utf8",
    timeout: 5_000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ENOENT/);
});
