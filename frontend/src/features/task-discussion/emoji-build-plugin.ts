import data from "emojibase-data/en/compact.json" with { type: "json" };
import shortcodes from "emojibase-data/en/shortcodes/emojibase.json" with { type: "json" };
import type { Plugin } from "vite";

const moduleId = "virtual:vbu-emoji";
const resolvedId = `\0${moduleId}`;

// Project the maintained dataset at build time; do not ship unused metadata or duplicated labels.
// https://vite.dev/guide/api-plugin#importing-a-virtual-file
export function emojiDataPlugin(): Plugin {
  return {
    name: "vbu-emoji-data",
    resolveId(id) {
      return id === moduleId ? resolvedId : undefined;
    },
    load(id) {
      if (id !== resolvedId) return undefined;
      const rows = data.flatMap((entry) =>
        [entry, ...(entry.skins ?? [])]
          .filter((emoji) => emoji.order !== undefined)
          .map((emoji) => [
            emoji.unicode,
            emoji.label,
            [...(emoji.tags ?? []), shortcodes[emoji.hexcode] ?? ""].join(" "),
          ]),
      );
      return `export default ${JSON.stringify(rows)}`;
    },
  };
}
