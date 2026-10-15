// Linux-only process-tree sampler. RSS sums include shared pages more than once.
import { spawn, spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("Usage: node tests/e2e/harness/measure.mjs <command> [args...]");
const started = performance.now();
const child = spawn(command, args, { stdio: "inherit" });
let peakKiB = 0;
let samples = 0;
function sampleTreeRSS() {
  const result = spawnSync("ps", ["-e", "-o", "pid=,ppid=,rss="], { encoding: "utf8" });
  if (result.status !== 0) return;
  const rows = result.stdout.trim().split("\n").map((line) => line.trim().split(/\s+/).map(Number));
  const descendants = new Set([child.pid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [pid, parent] of rows) {
      if (descendants.has(parent) && !descendants.has(pid)) {
        descendants.add(pid);
        changed = true;
      }
    }
  }
  const rss = rows.reduce((sum, [pid, , kib]) => sum + (descendants.has(pid) ? kib : 0), 0);
  peakKiB = Math.max(peakKiB, rss);
  samples++;
}

// Collect once before the first interval so short commands still produce a metric.
sampleTreeRSS();
const timer = setInterval(sampleTreeRSS, 250);
child.on("error", (error) => {
  clearInterval(timer);
  console.error(error);
  process.exitCode = 1;
});
child.on("close", (code, signal) => {
  clearInterval(timer);
  console.error(JSON.stringify({
    seconds: Number(((performance.now() - started) / 1000).toFixed(2)),
    peakTreeRssMiB: samples ? Number((peakKiB / 1024).toFixed(1)) : null,
    samples,
    code,
    signal,
  }));
  process.exitCode = code === null || code < 0 ? 1 : code;
});
