import { $isCodeNode } from "@lexical/code-core";
import { $generateNodesFromDOM } from "@lexical/html";
import { $toggleLink } from "@lexical/link";
import {
  $addUpdateTag,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  type LexicalEditor,
  PASTE_TAG,
} from "lexical";
import { matchDiscussionUrl } from "./discussion-links";
import { editorDocument, hasUnsupportedContent } from "./html";

export function $pasteClipboard(
  editor: LexicalEditor,
  clipboard: DataTransfer,
  onNotice: (notice: string) => void,
) {
  $addUpdateTag(PASTE_TAG);
  const selection = $getSelection();
  onNotice("");
  if (
    $isRangeSelection(selection) &&
    ($isCodeNode(selection.anchor.getNode()) || $isCodeNode(selection.anchor.getNode().getParent()))
  ) {
    selection.insertRawText(clipboard.getData("text/plain"));
    return;
  }
  const text = clipboard.getData("text/plain");
  const match = matchDiscussionUrl(text);
  if (
    $isRangeSelection(selection) &&
    !selection.isCollapsed() &&
    !selection.hasFormat("code") &&
    match?.text === text
  ) {
    $toggleLink(match.url, { target: "_blank", rel: "noopener noreferrer" });
    return;
  }
  const html = clipboard.getData("text/html");
  if (!html) {
    if ($isRangeSelection(selection)) selection.insertRawText(clipboard.getData("text/plain"));
    return;
  }
  if (hasUnsupportedContent(html))
    onNotice(
      "Some pasted content is unsupported here and was not inserted. Review the result before posting; upload media as task attachments instead.",
    );
  $insertNodes($generateNodesFromDOM(editor, editorDocument(html)));
}
