import { $generateNodesFromDOM } from "@lexical/html";
import { $convertToMarkdownString, CHECK_LIST, TRANSFORMERS } from "@lexical/markdown";
import { $getRoot, $insertNodes, createEditor } from "lexical";
import { editorDocument } from "./html";
import { mediaReference } from "./media-reference";

const transformers = [...TRANSFORMERS, CHECK_LIST];

export function commentMarkdown(html: string): string {
  const document = editorDocument(html);
  // Markdown permits HTML: retain rich structures that its standard syntax cannot represent.
  if (
    document.querySelector("table,img,[data-media-kind],u,mark,sub,sup,hr") ||
    [...document.querySelectorAll("pre")].some((node) => node.textContent.includes("```"))
  ) {
    for (const element of document.querySelectorAll("img,[data-media-kind]")) {
      const source = element.getAttribute("data-src") ?? element.getAttribute("href") ?? "";
      const media = mediaReference(source);
      if (!media) continue;
      element.setAttribute(
        element.tagName === "IMG" ? "src" : "href",
        new URL(media.contentUrl, window.location.origin).href,
      );
    }
    return document.body.innerHTML;
  }
  const editor = createEditor({
    nodes: [
      ...new Set(
        transformers.flatMap((transformer) =>
          "dependencies" in transformer ? transformer.dependencies : [],
        ),
      ),
    ],
    onError: (error) => {
      throw error;
    },
  });
  editor.update(
    () => {
      $getRoot().select();
      $insertNodes($generateNodesFromDOM(editor, document));
    },
    { discrete: true },
  );
  return editor.read(() => $convertToMarkdownString(transformers));
}
