import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

export function offlineShellPlugin(): Plugin {
  let root = "";
  return {
    name: "offline-shell",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      root = config.root;
    },
    async generateBundle(_, bundle) {
      const html = bundle["index.html"];
      if (html?.type !== "asset" || typeof html.source !== "string") {
        throw new Error("Missing build HTML");
      }
      const publicFiles = [
        "favicon.svg",
        "site.webmanifest",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
        "icon-maskable-512.png",
      ];
      const hash = createHash("sha256").update(html.source);
      for (const name of publicFiles) hash.update(await readFile(resolve(root, "public", name)));
      const source = await readFile(resolve(root, "src/app/pwa/worker.js"), "utf8");
      hash.update(source);
      const version = hash.digest("hex").slice(0, 20);
      html.source = html.source.replace(
        "</head>",
        `<meta name="app-build" content="${version}" /></head>`,
      );
      const assets = [
        "/index.html",
        ...Object.keys(bundle)
          .filter((name) => name.startsWith("assets/") && !name.endsWith(".map"))
          .map((name) => `/${name}`),
        ...publicFiles.map((name) => `/${name}`),
      ];
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: source
          .replace("__BUILD_VERSION__", version)
          .replace('JSON.parse("__BUILD_ASSETS__")', JSON.stringify(assets)),
      });
    },
  };
}
