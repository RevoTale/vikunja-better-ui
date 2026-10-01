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
  },
});
