import type { LinkMatcher } from "@lexical/link";

// Recognize candidates broadly, then let URL validate hosts, IPv6 and ports.
export const matchDiscussionUrl: LinkMatcher = (text) => {
  for (const match of text.matchAll(/(?:https?:\/\/|www\.)[^\s<>"']+/giu)) {
    if (match.index > 0 && /[\p{L}\p{N}_@/]/u.test(text[match.index - 1] ?? "")) continue;
    let value = match[0].replace(/[.,;:!?]+$/, "");
    for (const [open, close] of [
      ["(", ")"],
      ["[", "]"],
    ] as const) {
      let balance =
        [...value].filter((char) => char === open).length -
        [...value].filter((char) => char === close).length;
      while (balance < 0 && value.endsWith(close)) {
        value = value.slice(0, -1);
        balance++;
      }
    }
    const href = /^www\./i.test(value) ? `https://${value}` : value;
    try {
      const url = new URL(href);
      if (!url.hostname || url.hostname === "www." || url.username || url.password) continue;
      return {
        index: match.index,
        length: value.length,
        text: value,
        url: href,
        attributes: { target: "_blank", rel: "noopener noreferrer" },
      };
    } catch {
      /* Incomplete URLs stay literal. */
    }
  }
  return null;
};

export function discussionLinks(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  let remaining = text;
  while (remaining) {
    const match = matchDiscussionUrl(remaining);
    if (!match) {
      parts.push({ text: remaining });
      break;
    }
    if (match.index) parts.push({ text: remaining.slice(0, match.index) });
    parts.push({ text: match.text, href: match.url });
    remaining = remaining.slice(match.index + match.length);
  }
  return parts;
}
