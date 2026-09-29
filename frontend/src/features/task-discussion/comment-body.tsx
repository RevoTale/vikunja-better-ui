import { createElement, lazy, type ReactNode, Suspense, useMemo } from "react";
import { discussionLinks } from "./discussion-links";
import { cleanComment } from "./html";
import { mediaFromElement } from "./media-html";
import { MediaPreview } from "./media-preview";
import { mediaReference } from "./media-reference";
import { ReplyQuote } from "./reply-quote";

const CodeBlock = lazy(() =>
  import("./code-block").then((module) => ({ default: module.CodeBlock })),
);

export function CommentBody({
  html,
  onOriginal,
  taskId,
}: {
  html: string;
  onOriginal?: (id: string) => void;
  taskId?: string;
}) {
  const content = useMemo(() => {
    const body = new DOMParser().parseFromString(cleanComment(html), "text/html").body;
    return Array.from(body.childNodes, (node, key) =>
      renderRootNode(node, key, node === body.firstElementChild ? onOriginal : undefined, taskId),
    );
  }, [html, onOriginal, taskId]);
  return <div className="discussion-rich-text">{content}</div>;
}

function renderRootNode(
  node: ChildNode,
  key: number,
  onOriginal?: (id: string) => void,
  taskId?: string,
): ReactNode {
  const sourceId =
    node instanceof HTMLElement && node.tagName === "BLOCKQUOTE"
      ? node.getAttribute("data-comment-id")
      : null;
  if (sourceId && onOriginal && taskId)
    return (
      <ReplyQuote
        key={`${taskId}:${sourceId}`}
        taskId={taskId}
        sourceId={sourceId}
        onOriginal={onOriginal}
      >
        {Array.from(node.childNodes, renderNode)}
      </ReplyQuote>
    );
  return renderNode(node, key);
}

// Render the allowlisted DOM as React elements, never inject upstream HTML.
function renderNode(node: ChildNode, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return renderText(node);
  if (!(node instanceof HTMLElement)) return null;
  const media = mediaFromElement(node);
  if (media) return <MediaPreview key={key} {...media} />;
  if (/^H[1-6]$/.test(node.tagName))
    return createElement(
      "h3",
      { key, "data-heading-level": node.tagName.slice(1) },
      ...Array.from(node.childNodes, renderNode),
    );
  const tag = node.tagName.toLowerCase();
  if (tag === "pre")
    return (
      <Suspense
        key={key}
        fallback={
          <pre>
            <code>{node.textContent}</code>
          </pre>
        }
      >
        <CodeBlock
          code={node.textContent ?? ""}
          language={node.getAttribute("data-language") ?? "plain"}
        />
      </Suspense>
    );
  if (tag === "table")
    return (
      <section
        key={key}
        className="discussion-table-scroll"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable tables need keyboard horizontal scrolling.
        tabIndex={0}
        aria-label="Comment table"
      >
        <table>{Array.from(node.childNodes, renderNode)}</table>
      </section>
    );
  const props = { key, ...elementProps(node) };
  if (tag === "br" || tag === "hr") return createElement(tag, props);
  return createElement(tag, props, ...Array.from(node.childNodes, renderNode));
}

function elementProps(node: HTMLElement): Record<string, string | number> {
  const props: Record<string, string | number> = {};
  for (const attribute of [
    "href",
    "target",
    "rel",
    "start",
    "data-comment-id",
    "data-type",
    "data-checked",
    "data-language",
  ]) {
    const value = node.getAttribute(attribute);
    if (value !== null)
      props[attribute] =
        attribute === "href" ? (mediaReference(value)?.contentUrl ?? value) : value;
  }
  for (const [attr, prop] of [
    ["colspan", "colSpan"],
    ["rowspan", "rowSpan"],
  ] as const) {
    const value = node.getAttribute(attr);
    if (value) props[prop] = Number(value);
  }
  return props;
}

function renderText(node: ChildNode): ReactNode {
  if (node.parentElement?.closest("a,code,pre")) return node.textContent;
  return discussionLinks(node.textContent ?? "").map((part, index) =>
    part.href ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: Stateless segments of one immutable text node.
      <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">
        {part.text}
      </a>
    ) : (
      part.text
    ),
  );
}
