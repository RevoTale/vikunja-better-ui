import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNodeByKey,
  $getState,
  $setState,
  createState,
  DecoratorNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type NodeKey,
} from "lexical";
import { type ReactNode, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type MediaData, mediaFromElement } from "./media-html";
import { MediaPreview } from "./media-preview";
import { mediaReference } from "./media-reference";

const mediaState = createState("media", {
  parse(value: unknown): MediaData {
    const fallback: MediaData = { source: "", kind: "image", name: "", alt: "" };
    if (!value || typeof value !== "object") return fallback;
    const candidate = value as Partial<MediaData>;
    return {
      source:
        typeof candidate.source === "string" && mediaReference(candidate.source)
          ? candidate.source
          : "",
      kind: candidate.kind === "audio" || candidate.kind === "video" ? candidate.kind : "image",
      name: typeof candidate.name === "string" ? candidate.name : "",
      alt: typeof candidate.alt === "string" ? candidate.alt : "",
    };
  },
});

export class MediaNode extends DecoratorNode<ReactNode> {
  override $config() {
    return this.config("discussion-media", {
      extends: DecoratorNode,
      stateConfigs: [{ flat: true, stateConfig: mediaState }],
    });
  }

  getMedia(): MediaData {
    return $getState(this, mediaState);
  }
  setMedia(data: MediaData): this {
    return $setState(this, mediaState, data);
  }
  override isInline(): false {
    return false;
  }
  override createDOM(): HTMLElement {
    return document.createElement("div");
  }
  override updateDOM(): false {
    return false;
  }

  static override importDOM(): DOMConversionMap {
    const convert = (element: HTMLElement) => {
      const data = mediaFromElement(element);
      return data
        ? { conversion: () => ({ node: $createMediaNode(data) }), priority: 4 as const }
        : null;
    };
    return { img: convert, a: convert };
  }

  override exportDOM(): DOMExportOutput {
    const data = this.getMedia();
    if (!mediaReference(data.source)) return { element: null };
    if (data.kind === "image") {
      const element = document.createElement("img");
      element.setAttribute("data-src", data.source);
      element.setAttribute("src", "#");
      element.alt = data.alt;
      return { element };
    }
    const element = document.createElement("a");
    element.href = data.source;
    element.setAttribute("data-media-kind", data.kind);
    element.textContent = data.name || `${data.kind} attachment`;
    return { element };
  }

  override decorate(): ReactNode {
    return <EditableMedia nodeKey={this.getKey()} data={this.getMedia()} />;
  }
}

export function $createMediaNode(data: MediaData): MediaNode {
  return new MediaNode().setMedia(data);
}

function EditableMedia({ nodeKey, data }: { nodeKey: NodeKey; data: MediaData }) {
  const [editor] = useLexicalComposerContext();
  const altInputId = useId();
  return (
    <figure className="my-3 space-y-2 rounded-md border p-2" contentEditable={false}>
      {data.source ? <MediaPreview {...data} /> : <p role="status">Uploading {data.name}…</p>}
      {data.kind === "image" && data.source ? (
        <label className="block text-sm" htmlFor={altInputId}>
          Image alternative text
          <Input
            id={altInputId}
            value={data.alt}
            onChange={(event) => {
              const alt = event.target.value;
              editor.update(() => {
                const node = $getNodeByKey(nodeKey);
                if (node instanceof MediaNode) node.setMedia({ ...node.getMedia(), alt });
              });
            }}
          />
        </label>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="min-h-11"
        onClick={() => editor.update(() => $getNodeByKey(nodeKey)?.remove())}
      >
        Remove media
      </Button>
      <p className="text-xs text-muted-foreground">
        Removing this reference does not delete the task attachment.
      </p>
    </figure>
  );
}
