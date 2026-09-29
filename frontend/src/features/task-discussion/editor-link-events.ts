import { $isLinkNode } from "@lexical/link";
import { $getNearestNodeFromDOMNode, type LexicalEditor } from "lexical";

export function registerLinkEvents(editor: LexicalEditor, open: () => void): () => void {
  const click = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest("a[href]");
    if (!target) return;
    event.preventDefault();
    editor.update(
      () => {
        const link = $getNearestNodeFromDOMNode(target);
        if ($isLinkNode(link)) link.selectEnd();
      },
      { discrete: true },
    );
    open();
  };
  const shortcut = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      open();
    }
  };
  return editor.registerRootListener((root, previous) => {
    previous?.removeEventListener("click", click);
    previous?.removeEventListener("keydown", shortcut);
    root?.addEventListener("click", click);
    root?.addEventListener("keydown", shortcut);
  });
}
