import { type MediaKind, mediaReference } from "./media-reference";

export type MediaData = { source: string; kind: MediaKind; name: string; alt: string };

export function mediaFromElement(element: HTMLElement): MediaData | null {
  if (element.tagName === "IMG") {
    const source = element.getAttribute("data-src") || element.getAttribute("src") || "";
    return mediaReference(source)
      ? { source, kind: "image", name: "", alt: element.getAttribute("alt") ?? "" }
      : null;
  }
  const kind = element.getAttribute("data-media-kind");
  const source = element.getAttribute("href") ?? "";
  return element.tagName === "A" && (kind === "audio" || kind === "video") && mediaReference(source)
    ? { source, kind, name: element.textContent ?? "", alt: "" }
    : null;
}

export function normalizeMedia(fragment: DocumentFragment) {
  for (const image of fragment.querySelectorAll("img")) {
    const source = image.getAttribute("data-src") || image.getAttribute("src") || "";
    if (!mediaReference(source)) {
      image.replaceWith(document.createTextNode("[Unsupported image: view in native Vikunja]"));
      continue;
    }
    // The native client resolves data-src with its own auth; our renderer never
    // places this upstream URL in a browser src attribute.
    image.setAttribute("data-src", source);
    image.setAttribute("src", "#");
    image.removeAttribute("srcset");
  }
  for (const element of fragment.querySelectorAll("[data-media-kind]")) {
    if (!(element instanceof HTMLElement) || !mediaFromElement(element))
      element.removeAttribute("data-media-kind");
  }
}
