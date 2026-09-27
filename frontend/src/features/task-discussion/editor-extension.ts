import { CodePrismExtension } from "@lexical/code-prism";
import { HistoryExtension } from "@lexical/history";
import { $generateNodesFromDOM } from "@lexical/html";
import { LinkExtension } from "@lexical/link";
import { CheckListExtension, ListExtension } from "@lexical/list";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { RichTextExtension } from "@lexical/rich-text";
import { TableExtension } from "@lexical/table";
import {
  $createParagraphNode,
  $getRoot,
  $insertNodes,
  $setSelection,
  configExtension,
  defineExtension,
} from "lexical";
import { editorDocument, safeLink } from "./html";
import { MediaNode } from "./media-node";

export function createDiscussionExtension(initialHtml: string) {
  return defineExtension({
    name: "vbu/discussion",
    nodes: [HorizontalRuleNode, MediaNode],
    dependencies: [
      RichTextExtension,
      HistoryExtension,
      ListExtension,
      CheckListExtension,
      CodePrismExtension,
      configExtension(TableExtension, { hasCellBackgroundColor: false }),
      configExtension(LinkExtension, { validateUrl: safeLink }),
    ],
    theme: {
      text: {
        bold: "font-bold",
        italic: "italic",
        underline: "underline",
        strikethrough: "line-through",
        underlineStrikethrough: "underline line-through",
        highlight: "bg-accent text-accent-foreground",
      },
      code: "discussion-code",
      codeHighlight: {
        keyword: "syntax-keyword",
        string: "syntax-string",
        comment: "syntax-comment",
        number: "syntax-number",
        function: "syntax-function",
        operator: "syntax-keyword",
        punctuation: "syntax-punctuation",
      },
      list: {
        checklist: "discussion-checklist",
        listitemChecked: "discussion-checked",
        listitemUnchecked: "discussion-unchecked",
      },
      table: "discussion-table",
      tableScrollableWrapper: "discussion-table-scroll",
    },
    $initialEditorState: (editor) => {
      const nodes = $generateNodesFromDOM(editor, editorDocument(initialHtml));
      $getRoot().select();
      $insertNodes(nodes);
      if ($getRoot().isEmpty()) $getRoot().append($createParagraphNode());
      $setSelection(null);
    },
  });
}
