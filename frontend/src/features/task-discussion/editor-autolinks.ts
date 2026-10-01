import { $isCodeNode } from "@lexical/code-core";
import { $createLinkNode, $isLinkNode, LinkNode } from "@lexical/link";
import {
  $findMatchingParent,
  $getNodeByKey,
  $getSelection,
  $hasUpdateTag,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  HISTORIC_TAG,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
  mergeRegister,
  PASTE_TAG,
  TextNode,
} from "lexical";
import { matchDiscussionUrl } from "./discussion-links";

function $linkifyText(node: TextNode, atBoundary = false) {
  if (
    $hasUpdateTag(HISTORIC_TAG) ||
    !node.isSimpleText() ||
    node.hasFormat("code") ||
    $findMatchingParent(node, (parent) => $isCodeNode(parent) || $isLinkNode(parent))
  )
    return;
  const text = node.getTextContent();
  const selection = $getSelection();
  if (
    !$hasUpdateTag(PASTE_TAG) &&
    !atBoundary &&
    (!$isRangeSelection(selection) ||
      !selection.isCollapsed() ||
      selection.anchor.key !== node.getKey() ||
      !/\s/u.test(text[selection.anchor.offset - 1] ?? ""))
  )
    return;
  const match = matchDiscussionUrl(text);
  if (!match) return;
  const end = match.index + match.length;
  if (!$hasUpdateTag(PASTE_TAG) && !atBoundary && !/^[.,;:!?)}\]]*\s/u.test(text.slice(end)))
    return;
  const parts = node.splitText(match.index, end);
  const matched = parts[match.index === 0 ? 0 : 1];
  if (!matched) return;
  const link = $createLinkNode(match.url, { target: "_blank", rel: "noopener noreferrer" });
  matched.insertBefore(link);
  link.append(matched);
}

export function taskLinkId(href: string, origin: string): string | null {
  try {
    const url = new URL(href);
    if (url.origin !== origin || url.username || url.password) return null;
    const id = /^\/tasks\/([1-9]\d*)(?:\/(?:discussion|edit))?\/?$/.exec(url.pathname)?.[1];
    return id && Number.isSafeInteger(Number(id)) ? id : null;
  } catch {
    return null;
  }
}

export function registerDiscussionLinks(
  editor: LexicalEditor,
  origin: string,
  resolveTitle: (id: string) => Promise<string | null>,
) {
  let active = true;
  const pending = new Map<string, object>();
  const queued = new Map<string, { id: string; href: string; text: string }>();
  const attempted = new Set<string>();
  const linkAtBoundary = () => {
    if (editor.isComposing()) return false;
    const selection = $getSelection();
    if ($isRangeSelection(selection) && selection.isCollapsed()) {
      const node = selection.anchor.getNode();
      if ($isTextNode(node) && /^\s*$/u.test(node.getTextContent().slice(selection.anchor.offset)))
        $linkifyText(node, true);
    }
    return false;
  };
  const unregister = mergeRegister(
    editor.registerCommand(KEY_ENTER_COMMAND, linkAtBoundary, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(INSERT_PARAGRAPH_COMMAND, linkAtBoundary, COMMAND_PRIORITY_HIGH),
    editor.registerNodeTransform(TextNode, (node) => {
      if (!editor.isComposing()) $linkifyText(node);
    }),
    editor.registerNodeTransform(LinkNode, (link) => {
      const key = link.getKey();
      if ($hasUpdateTag("vbu:initial-content") || $hasUpdateTag(HISTORIC_TAG) || attempted.has(key))
        return;
      const href = link.getURL();
      const text = link.getTextContent();
      const id = taskLinkId(href, origin);
      if (!id || text !== href || link.getChildrenSize() !== 1) return;
      const child = link.getFirstChild();
      if (!$isTextNode(child) || child.hasFormat("code")) return;
      attempted.add(key);
      queued.set(key, { id, href, text });
    }),
    editor.registerUpdateListener(({ dirtyElements, tags }) => {
      for (const key of pending.keys()) {
        if (tags.has(HISTORIC_TAG) || dirtyElements.has(key)) pending.delete(key);
      }
      // Start only after the link's first commit. Its own creation must not
      // invalidate the request, but any later content update must.
      for (const [key, { id, href, text }] of queued) {
        if (!active || !editor.isEditable() || tags.has(HISTORIC_TAG)) continue;
        const token = {};
        pending.set(key, token);
        void resolveTitle(id)
          .then((title) => {
            if (!title || !active || pending.get(key) !== token || !editor.isEditable()) return;
            pending.delete(key);
            editor.update(() => {
              const current = $getNodeByKey(key);
              if (
                !$isLinkNode(current) ||
                current.getURL() !== href ||
                current.getTextContent() !== text
              )
                return;
              const currentChild = current.getFirstChild();
              if ($isTextNode(currentChild) && current.getChildrenSize() === 1)
                currentChild.setTextContent(title);
            });
          })
          .catch(() => {
            /* Optional enrichment: the original link remains usable. */
          })
          .finally(() => {
            pending.delete(key);
          });
      }
      queued.clear();
    }),
    editor.registerEditableListener((editable) => {
      if (!editable) pending.clear();
    }),
  );
  return () => {
    active = false;
    pending.clear();
    queued.clear();
    unregister();
  };
}
