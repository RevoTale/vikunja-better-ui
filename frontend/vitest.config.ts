import { availableParallelism } from "node:os";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import { emojiDataPlugin } from "./src/features/task-discussion/emoji-build-plugin.ts";

export default defineConfig({
  plugins: [emojiDataPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // Bound memory on many-core hosts; keep fresh module state for every file.
    pool: "threads",
    maxWorkers: Math.min(4, availableParallelism()),
  },
});
