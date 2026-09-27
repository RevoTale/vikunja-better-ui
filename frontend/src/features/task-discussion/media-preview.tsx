import { useState } from "react";
import { type MediaKind, mediaReference } from "./media-reference";

export function MediaPreview({
  source,
  kind,
  alt,
  name,
}: {
  source: string;
  kind: MediaKind;
  alt: string;
  name: string;
}) {
  const [failed, setFailed] = useState(false);
  const reference = mediaReference(source);
  if (!reference) return null;
  if (failed)
    return (
      <p role="status">
        Attachment unavailable or unsupported by this browser:{" "}
        {name || alt || reference.attachmentId}
      </p>
    );
  const shared = {
    src: reference.contentUrl,
    onError: () => setFailed(true),
    className: "max-w-full rounded-md",
  };
  if (kind === "image") return <img {...shared} alt={alt} loading="lazy" />;
  // User-owned attachments may not have caption tracks. Never autoplay them.
  if (kind === "video")
    return (
      <video {...shared} controls preload="metadata" aria-label={name || "Video attachment"} />
    );
  return <audio {...shared} controls preload="metadata" aria-label={name || "Audio attachment"} />;
}
