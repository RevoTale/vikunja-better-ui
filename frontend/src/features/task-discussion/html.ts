import DOMPurify from "dompurify";
import { normalizeMedia } from "./media-html";
import { mediaReference } from "./media-reference";

export const maxCommentBytes = 100_000;

const supportedTags = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "code",
  "pre",
  "span",
  "div",
  "label",
  "input",
  "u",
  "s",
  "del",
  "mark",
  "sub",
  "sup",
  "hr",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "img",
  "colgroup",
  "col",
];

function unsupportedElement(element: Element): boolean {
  if (!supportedTags.includes(element.tagName.toLowerCase())) return true;
  if (element.hasAttribute("data-background-color")) return true;
  if (element.tagName === "A") {
    const href = element.getAttribute("href");
    if (href && !safeLink(href) && !mediaReference(href)) return true;
  }
  if (element.tagName === "IMG" && element.getAttribute("title")) return true;
  if (!(element instanceof HTMLElement)) return false;
  if (unsupportedStyle(element)) return true;
  if (element.tagName === "COL" && element.hasAttribute("width")) return true;
  return (
    element.tagName === "IMG" && (element.hasAttribute("width") || element.hasAttribute("height"))
  );
}

function unsupportedStyle(element: HTMLElement): boolean {
  // Lexical's whitespace declaration is representational, not extra formatting.
  // Everything else (colors, alignment, sizing, etc.) must not disappear on save.
  for (const property of Array.from(element.style)) {
    if (property === "min-width" && neutralTableWidth(element)) continue;
    if (property !== "white-space" || element.style.whiteSpace !== "pre-wrap") return true;
  }
  return false;
}

function neutralTableWidth(element: HTMLElement): boolean {
  if (element.tagName === "COL") return element.style.minWidth === "25px";
  if (element.tagName !== "TABLE") return false;
  const columns = element.querySelectorAll(":scope > colgroup > col");
  return (
    columns.length > 0 &&
    element.style.minWidth === `${columns.length * 25}px` &&
    Array.from(columns).every(
      (column) =>
        column instanceof HTMLElement &&
        column.style.minWidth === "25px" &&
        !column.style.width &&
        !column.hasAttribute("width"),
    )
  );
}

export function hasUnsupportedContent(html: string): boolean {
  // Inspect a detached sanitized fragment; never load native media to inspect it.
  const fragment = DOMPurify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    ADD_TAGS: ["iframe", "object", "embed", "mention-user"],
    // Detection only: retain native deep links so the editor can refuse a lossy
    // save. cleanComment uses a separate, restricted rendering allowlist.
    ALLOW_UNKNOWN_PROTOCOLS: true,
  });
  return (
    Array.from(fragment.querySelectorAll("*")).some(unsupportedElement) ||
    fragment.querySelector(
      'video, audio, svg, math, input:not(li[data-type="taskItem"] input), table table',
    ) !== null ||
    Array.from(fragment.querySelectorAll("img")).some(
      (image) => !mediaReference(image.getAttribute("data-src") || image.getAttribute("src") || ""),
    )
  );
}

export function safeLink(value: string): boolean {
  if (/^\/tasks\/[1-9]\d*(?:\/(?:discussion|edit))?\/?(?:[?#][^\s\\]*)?$/u.test(value)) return true;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function cleanComment(html: string): string {
  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: supportedTags,
    ALLOWED_ATTR: [
      "href",
      "data-comment-id",
      "start",
      "class",
      "data-language",
      "data-type",
      "data-checked",
      "aria-checked",
      "__lexicallisttype",
      "colspan",
      "rowspan",
      "checked",
      "type",
      "src",
      "data-src",
      "alt",
      "data-media-kind",
    ],
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  normalizeRichText(fragment);
  normalizeMedia(fragment);
  for (const link of fragment.querySelectorAll("a")) {
    if (
      !safeLink(link.getAttribute("href") ?? "") &&
      !mediaReference(link.getAttribute("href") ?? "")
    )
      link.removeAttribute("href");
    else {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
  }
  for (const quote of fragment.querySelectorAll("[data-comment-id]")) {
    if (
      quote.tagName !== "BLOCKQUOTE" ||
      !/^[1-9]\d*$/.test(quote.getAttribute("data-comment-id") ?? "")
    ) {
      quote.removeAttribute("data-comment-id");
    }
  }
  const wrapper = document.createElement("div");
  wrapper.append(fragment);
  return wrapper.innerHTML;
}

function normalizeRichText(fragment: DocumentFragment) {
  normalizeCodeBlocks(fragment);
  normalizeChecklists(fragment);
  for (const input of fragment.querySelectorAll("input")) input.remove();
  // Native TipTap adds a 25px minimum column scaffold even to unsized tables.
  // Custom sizing is protected by the unsupported-content guard before editing.
  for (const column of fragment.querySelectorAll("colgroup, col")) column.remove();
  for (const element of fragment.querySelectorAll("[class]")) {
    if (element.tagName !== "CODE" || element.parentElement?.tagName !== "PRE")
      element.removeAttribute("class");
  }
  for (const element of fragment.querySelectorAll("td, th")) {
    for (const attr of ["colspan", "rowspan"]) {
      const span = Number(element.getAttribute(attr));
      if (!Number.isInteger(span) || span < 1 || span > 100) element.removeAttribute(attr);
    }
  }
}

function normalizeCodeBlocks(fragment: DocumentFragment) {
  for (const pre of fragment.querySelectorAll("pre")) {
    const language =
      pre.getAttribute("data-language") ??
      pre.querySelector("code")?.className.replace(/^language-/, "") ??
      "plain";
    for (const br of pre.querySelectorAll("br")) br.replaceWith("\n");
    const code = document.createElement("code");
    code.textContent = pre.textContent;
    const safeLanguage = /^[a-z0-9#+-]{1,32}$/i.test(language) ? language : "plain";
    code.className = `language-${safeLanguage}`;
    pre.setAttribute("data-language", safeLanguage);
    pre.replaceChildren(code);
  }
}

function normalizeChecklists(fragment: DocumentFragment) {
  for (const list of fragment.querySelectorAll(
    'ul[__lexicallisttype="check"], ul[data-type="taskList"]',
  )) {
    list.setAttribute("data-type", "taskList");
    for (const item of Array.from(list.children)) {
      if (item.tagName !== "LI") continue;
      item.setAttribute("data-type", "taskItem");
      const checked =
        item.getAttribute("aria-checked") ?? item.getAttribute("data-checked") ?? "false";
      item.setAttribute("data-checked", checked === "true" ? "true" : "false");
      item.removeAttribute("aria-checked");
      for (const label of item.querySelectorAll(":scope > label")) label.remove();
    }
    list.removeAttribute("__lexicallisttype");
  }
}

export function editorDocument(html: string): Document {
  const doc = new DOMParser().parseFromString(cleanComment(html), "text/html");
  for (const list of doc.querySelectorAll('ul[data-type="taskList"]'))
    list.setAttribute("__lexicalListType", "check");
  for (const item of doc.querySelectorAll('li[data-type="taskItem"]'))
    item.setAttribute("aria-checked", item.getAttribute("data-checked") ?? "false");
  return doc;
}

export function commentText(html: string): string {
  const doc = new DOMParser().parseFromString(cleanComment(html), "text/html");
  for (const image of doc.querySelectorAll("img"))
    image.replaceWith(document.createTextNode(image.alt || "[Image attachment]"));
  return doc.body.textContent?.trim() ?? "";
}

export function hasCommentContent(html: string): boolean {
  const doc = new DOMParser().parseFromString(cleanComment(html), "text/html");
  return Boolean(doc.body.textContent?.trim() || doc.querySelector("img[data-src]"));
}

export function splitReply(html: string): { quote: string; body: string; sourceId: string | null } {
  const doc = new DOMParser().parseFromString(cleanComment(html), "text/html");
  const first = doc.body.firstElementChild;
  if (first?.tagName !== "BLOCKQUOTE" || !first.hasAttribute("data-comment-id")) {
    return { quote: "", body: doc.body.innerHTML, sourceId: null };
  }
  const quote = first.outerHTML;
  const sourceId = first.getAttribute("data-comment-id");
  first.remove();
  return { quote, body: doc.body.innerHTML, sourceId };
}

export function replyQuote(id: string, html: string): string {
  const quote = document.createElement("blockquote");
  quote.setAttribute("data-comment-id", id);
  // Keep one compact source excerpt, not an ever-growing chain of nested replies.
  quote.textContent = commentText(splitReply(html).body).slice(0, 500);
  return cleanComment(quote.outerHTML);
}
